"use strict";

const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const STORE_FILE = path.join(DATA_DIR, "store.json");
const SECRET_FILE = path.join(DATA_DIR, "secret.key");
const PORT = Number(process.env.PORT || 4173);
const COOKIE_NAME = "apihub_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const DEFAULT_USER = process.env.APIHUB_ADMIN_USER || "admin";
const CONFIGURED_PASSWORD = process.env.APIHUB_ADMIN_PASSWORD || "";
const LEGACY_DEFAULT_PASSWORD = "ChangeMe123!";
const COOKIE_SECURE = process.env.APIHUB_COOKIE_SECURE === "true";

const sessions = new Map();
const refreshAccessCache = new Map();
let cachedSecret;
let bootstrapPasswordNotice = "";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json; charset=utf-8"
};

function id(prefix = "id") {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

function nowIso() {
  return new Date().toISOString();
}

function timingSafeEqualText(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(String(password), salt, 210000, 32, "sha256").toString("hex");
  return { salt, hash };
}

function verifyPassword(password, record) {
  const attempt = hashPassword(password, record.salt);
  return timingSafeEqualText(attempt.hash, record.hash);
}

function randomPassword() {
  return crypto.randomBytes(24).toString("base64url");
}

async function persistInitialPassword(password) {
  const file = path.join(DATA_DIR, "initial-admin-password.txt");
  await fs.writeFile(
    file,
    [
      "API Hub Mobile initial admin password",
      "",
      `username: ${DEFAULT_USER}`,
      `password: ${password}`,
      "",
      "Log in once, change this password in Settings, then delete this file."
    ].join("\n"),
    { mode: 0o600 }
  );
  bootstrapPasswordNotice = `Initial admin password was written to ${file}`;
}

async function ensureData() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(STORE_FILE);
    const store = JSON.parse(await fs.readFile(STORE_FILE, "utf8"));
    if (!CONFIGURED_PASSWORD && verifyPassword(LEGACY_DEFAULT_PASSWORD, store.user.password)) {
      const password = randomPassword();
      store.user.password = hashPassword(password);
      await writeStore(store);
      await persistInitialPassword(password);
    }
  } catch {
    const initialPassword = CONFIGURED_PASSWORD || randomPassword();
    const password = hashPassword(initialPassword);
    await writeStore({
      version: 1,
      user: { username: DEFAULT_USER, password },
      sites: [],
      audit: []
    });
    if (!CONFIGURED_PASSWORD) await persistInitialPassword(initialPassword);
  }
}

async function masterSecret() {
  if (cachedSecret) return cachedSecret;
  if (process.env.APIHUB_SECRET) {
    cachedSecret = crypto.createHash("sha256").update(process.env.APIHUB_SECRET).digest();
    return cachedSecret;
  }
  try {
    const existing = await fs.readFile(SECRET_FILE, "utf8");
    cachedSecret = Buffer.from(existing.trim(), "hex");
    return cachedSecret;
  } catch {
    const created = crypto.randomBytes(32);
    await fs.writeFile(SECRET_FILE, created.toString("hex"), { mode: 0o600 });
    cachedSecret = created;
    return cachedSecret;
  }
}

async function readStore() {
  await ensureData();
  const store = JSON.parse(await fs.readFile(STORE_FILE, "utf8"));
  if (!Array.isArray(store.sites)) store.sites = [];
  if (!Array.isArray(store.credentials)) store.credentials = [];
  if (!Array.isArray(store.audit)) store.audit = [];
  return store;
}

async function writeStore(store) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(STORE_FILE, `${JSON.stringify(store, null, 2)}\n`);
}

async function encryptSecret(value) {
  if (!value) return null;
  const key = await masterSecret();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
  return {
    alg: "aes-256-gcm",
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: encrypted.toString("base64")
  };
}

async function decryptSecret(record) {
  if (!record) return "";
  const key = await masterSecret();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(record.iv, "base64"));
  decipher.setAuthTag(Buffer.from(record.tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(record.data, "base64")),
    decipher.final()
  ]).toString("utf8");
}

function mask(value) {
  if (!value) return "";
  const text = String(value);
  if (text.length <= 8) return "••••";
  return `${text.slice(0, 4)}••••${text.slice(-4)}`;
}

function sanitizeSite(site) {
  return {
    id: site.id,
    name: site.name,
    type: site.type,
    baseUrl: site.baseUrl,
    authType: site.authType,
    enabled: site.enabled,
    note: site.note || "",
    lastCheckedAt: site.lastCheckedAt || null,
    lastStatus: site.lastStatus || "unknown",
    lastError: site.lastError || "",
    userId: site.userId || "",
    maskedCredential: site.maskedCredential || ""
  };
}

function sanitizeCredential(credential) {
  return {
    id: credential.id,
    name: credential.name,
    baseUrl: credential.baseUrl,
    provider: credential.provider || "openai-compatible",
    group: credential.group || "default",
    enabled: credential.enabled,
    note: credential.note || "",
    lastCheckedAt: credential.lastCheckedAt || null,
    lastStatus: credential.lastStatus || "unknown",
    lastError: credential.lastError || "",
    maskedKey: credential.maskedKey || ""
  };
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError(400, "请求体不是有效 JSON");
  }
}

class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function send(res, status, data, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers
  });
  res.end(JSON.stringify(data));
}

function setSessionCookie(res, token) {
  const secure = COOKIE_SECURE ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_MS / 1000}${secure}`);
}

function clearSessionCookie(res) {
  const secure = COOKIE_SECURE ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
}

function cookie(req, name) {
  const source = req.headers.cookie || "";
  for (const part of source.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return "";
}

async function requireSession(req) {
  const token = cookie(req, COOKIE_NAME);
  const session = token && sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    if (token) sessions.delete(token);
    throw new HttpError(401, "请先登录");
  }
  session.expiresAt = Date.now() + SESSION_TTL_MS;
  return session;
}

function cleanBaseUrl(baseUrl) {
  try {
    const parsed = new URL(baseUrl);
    parsed.pathname = parsed.pathname.replace(/\/+$/, "");
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    throw new HttpError(400, "Base URL 格式不正确");
  }
}

async function siteFromInput(input, existing = {}) {
  const type = input.type === "auto" ? inferType(input) : input.type;
  if (!["newapi", "sub2api"].includes(type)) throw new HttpError(400, "站点类型必须是 New API 或 Sub2API");
  const secrets = { ...(existing.secrets || {}) };
  let maskedCredential = existing.maskedCredential || "";

  for (const field of ["systemToken", "jwt", "apiKey", "adminToken", "sessionCookie", "refreshToken", "password"]) {
    if (input[field]) {
      secrets[field] = await encryptSecret(input[field]);
      if (["systemToken", "jwt", "apiKey", "adminToken", "sessionCookie", "refreshToken"].includes(field)) maskedCredential = mask(input[field]);
    }
  }

  return {
    ...existing,
    id: existing.id || id("site"),
    name: String(input.name || existing.name || "").trim(),
    type,
    baseUrl: cleanBaseUrl(input.baseUrl || existing.baseUrl || ""),
    authType: input.authType || existing.authType || (type === "newapi" ? "system-token" : "jwt"),
    enabled: Boolean(input.enabled ?? existing.enabled ?? true),
    note: String(input.note ?? existing.note ?? "").trim(),
    userId: String(input.userId ?? existing.userId ?? "").trim(),
    username: String(input.username ?? existing.username ?? "").trim(),
    maskedCredential,
    secrets,
    createdAt: existing.createdAt || nowIso(),
    updatedAt: nowIso()
  };
}

async function credentialFromInput(input, existing = {}) {
  const secrets = { ...(existing.secrets || {}) };
  let maskedKey = existing.maskedKey || "";
  if (input.apiKey) {
    secrets.apiKey = await encryptSecret(input.apiKey);
    maskedKey = mask(input.apiKey);
  }
  return {
    ...existing,
    id: existing.id || id("cred"),
    name: String(input.name || existing.name || "").trim(),
    provider: String(input.provider || existing.provider || "openai-compatible").trim(),
    baseUrl: cleanBaseUrl(input.baseUrl || existing.baseUrl || ""),
    group: String(input.group ?? existing.group ?? "default").trim() || "default",
    enabled: Boolean(input.enabled ?? existing.enabled ?? true),
    note: String(input.note ?? existing.note ?? "").trim(),
    maskedKey,
    secrets,
    createdAt: existing.createdAt || nowIso(),
    updatedAt: nowIso()
  };
}

function inferType(input) {
  if (input.systemToken || input.userId) return "newapi";
  return "sub2api";
}

const COMMON_LIST_KEYS = ["items", "rows", "list", "records", "results", "data"];
const NEW_API_QUOTA_PER_USD = 500000;
const NEW_API_USER_ID_HEADERS = [
  "New-API-User",
  "Veloera-User",
  "X-Api-User",
  "voapi-user",
  "User-id",
  "Rix-Api-User",
  "neo-api-user"
];

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function asNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function looksLikeModel(item) {
  if (typeof item === "string") return true;
  if (!isPlainObject(item)) return false;
  return ["id", "model", "name", "owned_by", "provider", "quota_type", "category", "price", "groups"].some((key) => item[key] !== undefined);
}

function looksLikeKey(item) {
  if (!isPlainObject(item)) return false;
  return [
    "id",
    "key_id",
    "token_id",
    "key",
    "token",
    "value",
    "maskedKey",
    "masked_key",
    "name",
    "key_name",
    "token_name",
    "description",
    "api_key",
    "access_token",
    "quota",
    "used_quota",
    "remain_quota",
    "usage",
    "limit"
  ].some((key) => item[key] !== undefined);
}

function looksLikeLog(item) {
  if (!isPlainObject(item)) return false;
  return [
    "id",
    "created_at",
    "createdAt",
    "token_name",
    "key_name",
    "model_name",
    "model",
    "quota",
    "usage",
    "prompt_tokens",
    "completion_tokens",
    "total_tokens",
    "content"
  ].some((key) => item[key] !== undefined);
}

function objectValuesAsList(value, predicate) {
  if (!isPlainObject(value)) return [];
  const values = Object.entries(value)
    .map(([key, item]) => (isPlainObject(item) ? { id: key, ...item } : item))
    .filter((item) => isPlainObject(item) || typeof item === "string");
  if (!values.length) return [];
  return values.some(predicate) ? values : [];
}

function extractList(payload, keys, predicate) {
  if (Array.isArray(payload)) return payload;
  if (!isPlainObject(payload)) return [];

  const listKeys = [...keys, ...COMMON_LIST_KEYS];
  const candidates = [payload, payload.data].filter(isPlainObject);

  for (const source of candidates) {
    for (const key of listKeys) {
      const value = source[key];
      if (Array.isArray(value)) return value;
      const mapped = objectValuesAsList(value, predicate);
      if (mapped.length) return mapped;
    }
  }

  for (const source of candidates) {
    const mapped = objectValuesAsList(source, predicate);
    if (mapped.length) return mapped;
  }

  return [];
}

function computeModelPricing(site, item) {
  const directInput = firstDefined(
    item.inputPrice,
    item.input_price,
    item.prompt_price,
    item.price?.input,
    item.pricing?.input
  );
  const directOutput = firstDefined(
    item.outputPrice,
    item.output_price,
    item.completion_price,
    item.price?.output,
    item.pricing?.output
  );
  const modelRatio = asNumber(firstDefined(item.model_ratio, item.modelRatio, item.ratio, item.quota_ratio), 0);
  const completionRatio = asNumber(firstDefined(item.completion_ratio, item.completionRatio, item.output_ratio), 1);
  const groupRatio = asNumber(firstDefined(item.group_ratio, item.groupRatio, item.groups?.[0]?.ratio), 1);
  const modelPrice = asNumber(firstDefined(item.model_price, item.modelPrice), 0);
  const promptQuotaPer1K = modelPrice > 0 ? modelPrice : modelRatio * groupRatio * 1000;
  const completionQuotaPer1K = modelPrice > 0 ? modelPrice : modelRatio * completionRatio * groupRatio * 1000;
  const inputUsd = directInput !== undefined ? asNumber(directInput) : site.type === "newapi" ? quotaToUsd(promptQuotaPer1K) : 0;
  const outputUsd = directOutput !== undefined ? asNumber(directOutput) : site.type === "newapi" ? quotaToUsd(completionQuotaPer1K) : 0;
  return {
    inputPer1KUsd: inputUsd,
    outputPer1KUsd: outputUsd,
    blendedPer1KUsd: inputUsd || outputUsd ? (inputUsd + outputUsd) / 2 : 0,
    promptQuotaPer1K,
    completionQuotaPer1K,
    modelRatio,
    completionRatio,
    groupRatio,
    source: directInput !== undefined || directOutput !== undefined ? "direct" : modelRatio || modelPrice ? "newapi-ratio" : "unknown"
  };
}

function normalizeModels(site, payload) {
  const list = extractList(payload, ["models"], looksLikeModel);
  return list.map((item) => ({
    id: String(item.id || item.model || item.name || item || id("model")),
    siteId: site.id,
    name: String(item.name || item.id || item.model || item || "未知模型"),
    provider: String(item.provider || item.owned_by || item.type || site.type),
    group: String(item.group || item.groups?.[0] || item.quota_type || item.category || "default"),
    inputPrice: Number(item.inputPrice ?? item.input_price ?? item.prompt_price ?? item.price?.input ?? 0),
    outputPrice: Number(item.outputPrice ?? item.output_price ?? item.completion_price ?? item.price?.output ?? 0),
    pricing: computeModelPricing(site, item),
    enabled: item.enabled !== false
  }))
    .map((model) => ({
      ...model,
      inputPrice: model.inputPrice || model.pricing.inputPer1KUsd,
      outputPrice: model.outputPrice || model.pricing.outputPer1KUsd
    }))
    .filter((item, index, array) => item.name && array.findIndex((candidate) => candidate.name === item.name) === index)
    .sort((a, b) => {
      const ap = Number(a.pricing?.blendedPer1KUsd || 0) || Number.MAX_SAFE_INTEGER;
      const bp = Number(b.pricing?.blendedPer1KUsd || 0) || Number.MAX_SAFE_INTEGER;
      return ap - bp || a.name.localeCompare(b.name);
    });
}

function normalizeKeys(site, payload) {
  const list = extractList(payload, ["tokens", "keys"], looksLikeKey);
  return list.map((item) => ({
    id: String(item.id || item.key_id || item.token_id || item.name || id("key")),
    siteId: site.id,
    name: String(item.name || item.key_name || item.token_name || "未命名 Key"),
    maskedKey: item.maskedKey || item.masked_key || item.key_preview || mask(item.key || item.token || item.value || item.api_key || item.access_token || ""),
    status: item.status || (item.deleted ? "disabled" : "active"),
    quota: Number(item.quota ?? item.remain_quota ?? item.unlimited_quota ?? item.limit ?? item.max_usage ?? 0),
    used: Number(item.used ?? item.used_quota ?? item.usage ?? item.used_amount ?? 0),
    group: String(item.group || item.access_group || item.group_name || "default"),
    expiresAt: item.expiresAt || item.expired_time || item.expires_at || item.expire_at || item.expires || null,
    createdAt: item.createdAt || item.created_at || null
  }));
}

function normalizeUsage(site, payload) {
  return normalizeUsageFromRoute(site, payload, "");
}

function quotaToUsd(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n / NEW_API_QUOTA_PER_USD : 0;
}

function normalizeNewApiUsage(site, values) {
  const balanceQuota = Number(values.balance || 0);
  const usedTodayQuota = Number(values.usedToday || 0);
  const usedTotalQuota = Number(values.usedTotal || 0);
  return {
    siteId: site.id,
    balance: quotaToUsd(balanceQuota),
    usedToday: quotaToUsd(usedTodayQuota),
    usedTotal: quotaToUsd(usedTotalQuota),
    requestCountToday: Number(values.requestCountToday || 0),
    promptTokensToday: Number(values.promptTokensToday || 0),
    completionTokensToday: Number(values.completionTokensToday || 0),
    totalTokensToday: Number(values.totalTokensToday || 0),
    unit: "usd",
    rawQuota: {
      balance: balanceQuota,
      usedToday: usedTodayQuota,
      usedTotal: usedTotalQuota
    }
  };
}

function normalizeUsageFromRoute(site, payload, route = "") {
  const data = isPlainObject(payload?.data) ? payload.data : {};
  if (route.includes("/api/log/self/stat")) {
    const statUsage = {
      siteId: site.id,
      balance: 0,
      usedToday: Number(payload?.quota ?? data.quota ?? 0),
      usedTotal: 0,
      requestCountToday: Number(payload?.count ?? payload?.request_count ?? data.count ?? data.request_count ?? 0)
    };
    return site.type === "newapi" ? normalizeNewApiUsage(site, statUsage) : statUsage;
  }

  const usage = {
    siteId: site.id,
    balance: Number(payload?.balance ?? payload?.quota ?? payload?.remain_quota ?? payload?.remaining ?? payload?.credit ?? data.balance ?? data.quota ?? data.remain_quota ?? data.remaining ?? data.credit ?? 0),
    usedToday: Number(payload?.usedToday ?? payload?.today_used ?? payload?.today_usage ?? payload?.today_quota_consumption ?? payload?.total_actual_cost ?? payload?.total_cost ?? data.usedToday ?? data.today_used ?? data.today_usage ?? data.today_quota_consumption ?? data.total_actual_cost ?? data.total_cost ?? 0),
    usedTotal: Number(payload?.usedTotal ?? payload?.used_quota ?? payload?.used ?? payload?.total_used ?? payload?.total_usage ?? payload?.total_actual_cost ?? payload?.total_cost ?? data.usedTotal ?? data.used_quota ?? data.used ?? data.total_used ?? data.total_usage ?? data.total_actual_cost ?? data.total_cost ?? 0),
    requestCountToday: Number(payload?.requestCountToday ?? payload?.today_requests ?? payload?.today_requests_count ?? payload?.total_requests ?? payload?.request_count ?? data.requestCountToday ?? data.today_requests ?? data.today_requests_count ?? data.total_requests ?? data.request_count ?? 0),
    promptTokensToday: Number(payload?.promptTokensToday ?? payload?.prompt_tokens ?? payload?.input_tokens ?? payload?.today_prompt_tokens ?? payload?.today_input_tokens ?? payload?.total_input_tokens ?? data.promptTokensToday ?? data.prompt_tokens ?? data.input_tokens ?? data.today_prompt_tokens ?? data.today_input_tokens ?? data.total_input_tokens ?? 0),
    completionTokensToday: Number(payload?.completionTokensToday ?? payload?.completion_tokens ?? payload?.output_tokens ?? payload?.today_completion_tokens ?? payload?.today_output_tokens ?? payload?.total_output_tokens ?? data.completionTokensToday ?? data.completion_tokens ?? data.output_tokens ?? data.today_completion_tokens ?? data.today_output_tokens ?? data.total_output_tokens ?? 0),
    totalTokensToday: Number(payload?.totalTokensToday ?? payload?.total_tokens ?? payload?.today_tokens ?? data.totalTokensToday ?? data.total_tokens ?? data.today_tokens ?? 0)
  };
  return site.type === "newapi" ? normalizeNewApiUsage(site, usage) : usage;
}

function mergeUsage(base, extra) {
  const promptTokensToday = Number(extra?.promptTokensToday || base.promptTokensToday || 0);
  const completionTokensToday = Number(extra?.completionTokensToday || base.completionTokensToday || 0);
  return {
    siteId: base.siteId,
    balance: Number(base.balance || 0),
    usedToday: Number(extra?.usedToday || base.usedToday || 0),
    usedTotal: Number(base.usedTotal || extra?.usedTotal || 0),
    requestCountToday: Number(extra?.requestCountToday || base.requestCountToday || 0),
    promptTokensToday,
    completionTokensToday,
    totalTokensToday: Number(extra?.totalTokensToday || base.totalTokensToday || (promptTokensToday + completionTokensToday)),
    unit: base.unit || extra?.unit,
    rawQuota: {
      balance: Number(base.rawQuota?.balance || 0),
      usedToday: Number(extra?.rawQuota?.usedToday || base.rawQuota?.usedToday || 0),
      usedTotal: Number(base.rawQuota?.usedTotal || extra?.rawQuota?.usedTotal || 0)
    }
  };
}

function todayRangeSeconds() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return {
    start: Math.floor(start.getTime() / 1000),
    end: Math.floor(end.getTime() / 1000)
  };
}

function todayLogStatRoute() {
  const { start, end } = todayRangeSeconds();
  const params = new URLSearchParams({
    p: "1",
    page_size: "20",
    token_name: "",
    model_name: "",
    start_timestamp: String(start),
    end_timestamp: String(end),
    type: "2",
    group: ""
  });
  return `/api/log/self/stat?${params.toString()}`;
}

function usageLogRoute(page = 1, pageSize = 50) {
  const { start, end } = todayRangeSeconds();
  const params = new URLSearchParams({
    p: String(page),
    page_size: String(pageSize),
    token_name: "",
    model_name: "",
    start_timestamp: String(start),
    end_timestamp: String(end),
    type: "2",
    group: ""
  });
  return `/api/log/self?${params.toString()}`;
}

function summarizeUsageLogs(site, logsResult) {
  const promptTokensToday = logsResult.logs.reduce((sum, log) => sum + Number(log.promptTokens || 0), 0);
  const completionTokensToday = logsResult.logs.reduce((sum, log) => sum + Number(log.completionTokens || 0), 0);
  const fallbackTotalTokensToday = logsResult.logs.reduce((sum, log) => sum + Number(log.totalTokens || 0), 0);
  return {
    siteId: site.id,
    balance: 0,
    usedToday: 0,
    usedTotal: 0,
    requestCountToday: Number(logsResult.total || logsResult.logs.length || 0),
    promptTokensToday,
    completionTokensToday,
    totalTokensToday: promptTokensToday + completionTokensToday || fallbackTotalTokensToday,
    unit: site.type === "newapi" ? "usd" : ""
  };
}

function normalizeLogTime(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(n > 100000000000 ? n : n * 1000).toISOString();
}

function normalizeUsageLogs(site, payload) {
  const root = isPlainObject(payload?.data) ? payload.data : payload;
  const list = extractList(payload, ["items", "logs"], looksLikeLog);
  const total = Number(root?.total ?? payload?.total ?? list.length);
  return {
    total: Number.isFinite(total) ? total : list.length,
    logs: list.map((item) => {
      const rawQuota = Number(item.quota ?? item.used_quota ?? 0);
      return {
        id: String(item.id || id("log")),
        siteId: site.id,
        createdAt: normalizeLogTime(item.created_at || item.createdAt || item.time || item.timestamp || item.created || item.date),
        tokenName: String(item.token_name || item.tokenName || item.key_name || item.keyName || item.name || ""),
        modelName: String(item.model_name || item.modelName || item.model || ""),
        content: payloadMessage({ message: item.content || item.message || "" }),
        promptTokens: Number(item.prompt_tokens ?? item.promptTokens ?? item.input_tokens ?? item.inputTokens ?? 0),
        completionTokens: Number(item.completion_tokens ?? item.completionTokens ?? item.output_tokens ?? item.outputTokens ?? 0),
        totalTokens: Number(item.total_tokens ?? item.totalTokens ?? 0),
        quota: site.type === "newapi" ? quotaToUsd(rawQuota) : Number(item.amount ?? item.cost ?? item.usage ?? rawQuota),
        unit: site.type === "newapi" ? "usd" : "",
        rawQuota
      };
    })
  };
}

async function fetchUsageLogsForSite(site) {
  const routes = site.type === "newapi" ? [usageLogRoute()] : routesFor(site, "logs");
  try {
    const result = await requestSite(site, "GET", routes);
    return {
      ...normalizeUsageLogs(site, result.payload),
      sourceRoute: result.route.split("?")[0]
    };
  } catch (error) {
    if (site.type !== "newapi") return { logs: [], total: 0, sourceRoute: "" };
    throw error;
  }
}

async function fetchUsageLogSummaryForSite(site) {
  if (site.type !== "newapi") {
    try {
      return summarizeUsageLogs(site, await fetchUsageLogsForSite(site));
    } catch {
      return summarizeUsageLogs(site, { logs: [], total: 0 });
    }
  }

  const pageSize = 100;
  const maxPages = 20;
  const first = await requestSite(site, "GET", [usageLogRoute(1, pageSize)]);
  const firstPage = normalizeUsageLogs(site, first.payload);
  const logs = [...firstPage.logs];
  const total = Number(firstPage.total || logs.length);
  const totalPages = Math.min(maxPages, Math.max(1, Math.ceil(total / pageSize)));

  for (let page = 2; page <= totalPages; page++) {
    const result = await requestSite(site, "GET", [usageLogRoute(page, pageSize)]);
    logs.push(...normalizeUsageLogs(site, result.payload).logs);
  }

  return summarizeUsageLogs(site, { logs, total });
}

function buildCreateKeyPayload(site, body) {
  const quota = Number(body.quota || 0);
  const expiredTime = body.expiresAt ? Math.floor(new Date(body.expiresAt).getTime() / 1000) : -1;
  const name = body.name || "mobile-key";
  const group = body.group || "default";

  if (site.type === "sub2api") {
    const payload = {
      name,
      quota,
      expires_in_days: expiredTime > 0 ? Math.max(1, Math.ceil((expiredTime - Math.floor(Date.now() / 1000)) / 86400)) : 0,
      ip_whitelist: "",
      group
    };
    if (/^\d+$/.test(String(group))) payload.group_id = Number(group);
    return { payload, quota, group, expiresAt: body.expiresAt || null };
  }

  return {
    payload: {
      name,
      remain_quota: quota > 0 ? quota : 0,
      expired_time: expiredTime,
      unlimited_quota: quota <= 0,
      model_limits_enabled: false,
      model_limits: "",
      allow_ips: "",
      group,
      token_name: name,
      key_name: name,
      quota
    },
    quota,
    group,
    expiresAt: body.expiresAt || null
  };
}

async function exchangeRefreshToken(site, refreshToken) {
  if (!refreshToken) return "";
  const cacheKey = site.id || site.baseUrl;
  const cached = refreshAccessCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 30000) return cached.accessToken;
  if (cached && cached.errorUntil > Date.now()) return "";

  for (const route of ["/api/v1/auth/refresh", "/auth/refresh"]) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    try {
      const response = await fetch(`${site.baseUrl}${route}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
        signal: controller.signal
      });
      const payload = await response.json().catch(() => ({}));
      const data = isPlainObject(payload?.data) ? payload.data : payload;
      const accessToken = data.access_token || data.accessToken || data.token || "";
      if (response.ok && (payload.code === 0 || payload.success !== false) && accessToken) {
        const nextRefreshToken = data.refresh_token || data.refreshToken || "";
        if (nextRefreshToken && nextRefreshToken !== refreshToken && site.id) {
          try {
            const store = await readStore();
            const index = store.sites.findIndex((item) => item.id === site.id);
            if (index >= 0) {
              store.sites[index].secrets = {
                ...(store.sites[index].secrets || {}),
                refreshToken: await encryptSecret(nextRefreshToken)
              };
              store.sites[index].maskedCredential = mask(nextRefreshToken);
              store.sites[index].updatedAt = nowIso();
              await writeStore(store);
            }
          } catch {
            // Refresh-token rotation is useful but must not block the current request.
          }
        }
        const expiresIn = Number(data.expires_in || data.expiresIn || 900);
        refreshAccessCache.set(cacheKey, {
          accessToken,
          expiresAt: Date.now() + Math.max(60, expiresIn - 30) * 1000
        });
        return accessToken;
      }
      if (response.status === 429) {
        refreshAccessCache.set(cacheKey, { accessToken: "", expiresAt: 0, errorUntil: Date.now() + 120000 });
        return "";
      }
    } catch {
      // Try the next compatible refresh route.
    } finally {
      clearTimeout(timer);
    }
  }
  refreshAccessCache.set(cacheKey, { accessToken: "", expiresAt: 0, errorUntil: Date.now() + 45000 });
  return "";
}

async function adapterHeaders(site) {
  const headers = { "Content-Type": "application/json" };
  if (site.type === "newapi") {
    const token = await decryptSecret(site.secrets?.systemToken);
    if (!token) throw new HttpError(400, "New API 系统 Token 未配置");
    if (!site.userId) throw new HttpError(400, "New API 用户 ID 未配置");
    if (token) headers.Authorization = `Bearer ${token}`;
    for (const header of NEW_API_USER_ID_HEADERS) headers[header] = site.userId;
  } else {
    const jwt = await decryptSecret(site.secrets?.jwt);
    const apiKey = await decryptSecret(site.secrets?.apiKey);
    const adminToken = await decryptSecret(site.secrets?.adminToken);
    const sessionCookie = await decryptSecret(site.secrets?.sessionCookie);
    const refreshToken = await decryptSecret(site.secrets?.refreshToken);
    if (!jwt && !apiKey && !adminToken && !sessionCookie && !refreshToken) throw new HttpError(400, "Sub2API JWT、API Key 或 Admin Token 至少需要配置一个");
    const refreshedAccessToken = refreshToken ? await exchangeRefreshToken(site, refreshToken) : "";
    if (jwt) headers.Authorization = `Bearer ${jwt}`;
    else if (refreshedAccessToken) headers.Authorization = `Bearer ${refreshedAccessToken}`;
    else if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    else if (refreshToken) headers.Authorization = `Bearer ${refreshToken}`;
    if (apiKey) headers["X-API-Key"] = apiKey;
    if (sessionCookie) headers.Cookie = sessionCookie;
    if (refreshToken) {
      headers["X-Refresh-Token"] = refreshToken;
      headers["Refresh-Token"] = refreshToken;
      headers.refresh_token = refreshToken;
    }
    if (adminToken) {
      headers["X-Admin-Token"] = adminToken;
      headers["New-API-Admin"] = adminToken;
      headers["Authorization-Admin"] = adminToken;
    }
  }
  return headers;
}

async function requestSite(site, method, paths, body) {
  const headers = await adapterHeaders(site);
  const errors = [];
  for (const route of paths) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    try {
      const response = await fetch(`${site.baseUrl}${route}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal
      });
      const text = await response.text();
      let payload = {};
      let parsedJson = false;
      try {
        payload = text ? JSON.parse(text) : {};
        parsedJson = true;
      } catch {
        payload = { message: text };
      }
      if (response.ok) {
        if (text && !parsedJson) {
          errors.push(`${route}: HTTP ${response.status} returned non-JSON response`);
          continue;
        }
        if (payload && typeof payload === "object" && payload.success === false) {
          const message = payloadMessage(payload);
          errors.push(`${route}: ${message || `HTTP ${response.status} returned success=false`}`);
          continue;
        }
        if (method !== "GET" && payload && typeof payload === "object" && payload.success === true) {
          return { route, payload, status: response.status };
        }
        if (!payloadHasUsefulData(payload)) {
          const message = payloadMessage(payload);
          errors.push(`${route}: HTTP ${response.status} returned no usable data${message ? ` (${message})` : ""}`);
          continue;
        }
        return { route, payload, status: response.status };
      }
      errors.push(`${route}: HTTP ${response.status}`);
    } catch (error) {
      errors.push(`${route}: ${error.name === "AbortError" ? "请求超时" : error.message}`);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new HttpError(502, "远端站点请求失败", errors.slice(0, 3));
}

function transientHeaders(input, type) {
  const headers = { "Content-Type": "application/json" };
  if (type === "newapi") {
    if (input.systemToken) headers.Authorization = `Bearer ${input.systemToken}`;
    if (input.userId) {
      for (const header of NEW_API_USER_ID_HEADERS) headers[header] = String(input.userId);
    }
  } else {
    if (input.jwt) headers.Authorization = `Bearer ${input.jwt}`;
    else if (input.apiKey) headers.Authorization = `Bearer ${input.apiKey}`;
    else if (input.refreshToken) headers.Authorization = `Bearer ${input.refreshToken}`;
    if (input.apiKey) headers["X-API-Key"] = input.apiKey;
    if (input.sessionCookie) headers.Cookie = input.sessionCookie;
    if (input.refreshToken) {
      headers["X-Refresh-Token"] = input.refreshToken;
      headers["Refresh-Token"] = input.refreshToken;
      headers.refresh_token = input.refreshToken;
    }
    if (input.adminToken) {
      headers["X-Admin-Token"] = input.adminToken;
      headers["New-API-Admin"] = input.adminToken;
      headers["Authorization-Admin"] = input.adminToken;
    }
  }
  return headers;
}

async function probeBaseRoute(baseUrl, route, headers = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(`${baseUrl}${route}`, {
      method: "GET",
      headers,
      signal: controller.signal
    });
    const contentType = response.headers.get("content-type") || "";
    const text = await response.text();
    let payload = {};
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = { message: text };
    }
    return {
      route,
      ok: response.ok && payload?.success !== false,
      status: response.status,
      contentType,
      body: describePayload(payload),
      payload
    };
  } catch (error) {
    return {
      route,
      ok: false,
      status: null,
      error: error.name === "AbortError" ? "timeout" : error.message
    };
  } finally {
    clearTimeout(timer);
  }
}

function extractUserId(payload) {
  const data = isPlainObject(payload?.data) ? payload.data : payload;
  return String(firstDefined(data?.id, data?.user_id, data?.userId, data?.user?.id, payload?.id, "") || "");
}

async function detectSite(input) {
  const baseUrl = cleanBaseUrl(input.baseUrl || "");
  const candidates = [
    {
      type: "newapi",
      authType: "system-token",
      routes: ["/api/user/self", "/api/token/?p=0&size=1", "/api/user/models", "/api/status"],
      headers: transientHeaders(input, "newapi")
    },
    {
      type: "sub2api",
      authType: input.jwt ? "jwt" : input.adminToken ? "admin-token" : input.sessionCookie ? "cookie" : input.refreshToken ? "refresh-token" : "api-key",
      routes: ["/api/v1/auth/me", "/api/v1/keys?page=1&size=1", "/api/status", "/v1/models"],
      headers: transientHeaders(input, "sub2api")
    }
  ];

  const results = [];
  for (const candidate of candidates) {
    const probes = [];
    for (const route of candidate.routes) {
      probes.push(await probeBaseRoute(baseUrl, route, candidate.headers));
    }
    const okCount = probes.filter((probe) => probe.ok).length;
    const bestPayload = probes.find((probe) => probe.ok && probe.payload)?.payload;
    results.push({
      type: candidate.type,
      authType: candidate.authType,
      confidence: okCount / candidate.routes.length,
      userId: candidate.type === "newapi" ? extractUserId(bestPayload) || String(input.userId || "") : "",
      probes: probes.map(({ payload, ...probe }) => probe)
    });
  }

  const detected = [...results].sort((a, b) => b.confidence - a.confidence)[0];
  return {
    baseUrl,
    detectedType: detected?.confidence > 0 ? detected.type : "",
    recommendation: detected?.confidence > 0 ? {
      type: detected.type,
      authType: detected.authType,
      userId: detected.userId
    } : null,
    results
  };
}

async function credentialHeaders(credential) {
  const apiKey = await decryptSecret(credential.secrets?.apiKey);
  if (!apiKey) throw new HttpError(400, "API key is not configured");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
    "X-API-Key": apiKey
  };
}

async function requestCredential(credential, paths) {
  const headers = await credentialHeaders(credential);
  const errors = [];
  for (const route of paths) {
    const result = await probeBaseRoute(credential.baseUrl, route, headers);
    if (result.ok && payloadHasUsefulData(result.payload)) return { route, payload: result.payload, status: result.status };
    errors.push(`${route}: HTTP ${result.status || "ERR"}`);
  }
  throw new HttpError(502, "Credential request failed", errors.slice(0, 3));
}

function payloadHasUsefulData(payload) {
  if (Array.isArray(payload)) return true;
  if (!payload || typeof payload !== "object") return false;
  if (payload.success === false) return false;
  if (payload.code === 0 && payload.data !== undefined) return true;
  if (Array.isArray(payload.data) || Array.isArray(payload.tokens) || Array.isArray(payload.keys) || Array.isArray(payload.models) || Array.isArray(payload.logs)) return true;
  if (extractList(payload, ["models"], looksLikeModel).length || extractList(payload, ["tokens", "keys"], looksLikeKey).length || extractList(payload, ["logs", "items"], looksLikeLog).length) return true;
  if (payload.success === true && payload.data && typeof payload.data === "object" && Object.keys(payload.data).length > 0) return true;
  return ["balance", "quota", "remain_quota", "used_quota", "today_used", "today_usage", "requestCountToday", "total_tokens"].some((key) => payload[key] !== undefined);
}

function redactMessage(value) {
  if (!value) return "";
  return String(value)
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/sk-[A-Za-z0-9._-]{8,}/g, "sk-[redacted]")
    .replace(/[A-Za-z0-9+/=_-]{48,}/g, "[redacted]")
    .slice(0, 160);
}

function payloadMessage(payload) {
  if (!payload || typeof payload !== "object") return "";
  if (typeof payload.message === "string") return redactMessage(payload.message);
  if (payload.error && typeof payload.error === "object" && typeof payload.error.message === "string") return redactMessage(payload.error.message);
  if (typeof payload.error === "string") return redactMessage(payload.error);
  return "";
}

function describePayload(payload) {
  if (Array.isArray(payload)) {
    return { kind: "array", length: payload.length };
  }
  if (payload && typeof payload === "object") {
    const keys = Object.keys(payload).slice(0, 12);
    const data = payload.data;
    const dataKeys = isPlainObject(data) ? Object.keys(data).slice(0, 12) : undefined;
    const dataArrays = isPlainObject(data)
      ? Object.entries(data)
        .filter(([, value]) => Array.isArray(value))
        .slice(0, 8)
        .map(([key, value]) => ({ key, length: value.length }))
      : undefined;
    return {
      kind: "object",
      keys,
      success: typeof payload.success === "boolean" ? payload.success : undefined,
      message: payloadMessage(payload) || undefined,
      dataKind: Array.isArray(data) ? "array" : data && typeof data === "object" ? "object" : typeof data,
      dataLength: Array.isArray(data) ? data.length : undefined,
      dataKeys,
      dataArrays
    };
  }
  return { kind: typeof payload };
}

async function probeSiteRoute(site, method, route) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const headers = await adapterHeaders(site);
    const response = await fetch(`${site.baseUrl}${route}`, {
      method,
      headers,
      signal: controller.signal
    });
    const contentType = response.headers.get("content-type") || "";
    const text = await response.text();
    let payload;
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = null;
    }
    return {
      route,
      method,
      ok: response.ok,
      status: response.status,
      contentType,
      body: payload ? describePayload(payload) : { kind: "text", length: text.length }
    };
  } catch (error) {
    return {
      route,
      method,
      ok: false,
      status: null,
      error: error.name === "AbortError" ? "请求超时" : error.message
    };
  } finally {
    clearTimeout(timer);
  }
}

async function diagnoseSite(site) {
  const actions = ["test", "models", "keys", "usage"];
  const result = {};
  for (const action of actions) {
    result[action] = [];
    for (const route of routesFor(site, action)) {
      result[action].push(await probeSiteRoute(site, "GET", route));
    }
  }
  return {
    site: sanitizeSite(site),
    checkedAt: nowIso(),
    actions: result
  };
}

function routesFor(site, action) {
  const tables = {
    newapi: {
      test: ["/api/user/self", "/api/token/?p=0&size=1", "/api/user/models", "/api/available_model"],
      models: ["/api/user/models", "/api/available_model", "/api/models", "/v1/models"],
      keys: ["/api/token/?p=0&size=100", "/api/token/"],
      createKey: ["/api/token/"],
      deleteKey: (keyId) => [`/api/token/${encodeURIComponent(keyId)}`],
      usage: ["/api/user/self", todayLogStatRoute()],
      logs: [usageLogRoute()]
    },
    sub2api: {
      test: ["/api/v1/auth/me", "/api/v1/user/profile", "/api/v1/user/platform-quotas", "/api/v1/user/self", "/api/v1/keys?page=1&size=1", "/api/user", "/api/me", "/api/keys", "/api/status", "/v1/models"],
      models: ["/v1/models", "/api/v1/models", "/api/models", "/models", "/api/available_model"],
      keys: ["/api/v1/keys?page=1&size=100", "/api/v1/tokens?page=1&size=100", "/api/keys", "/api/key", "/api/tokens", "/keys"],
      createKey: ["/api/v1/keys", "/api/v1/tokens", "/api/keys", "/api/key", "/api/tokens", "/keys"],
      deleteKey: (keyId) => [`/api/v1/keys/${encodeURIComponent(keyId)}`, `/api/v1/tokens/${encodeURIComponent(keyId)}`, `/api/keys/${encodeURIComponent(keyId)}`, `/api/key/${encodeURIComponent(keyId)}`, `/api/tokens/${encodeURIComponent(keyId)}`, `/keys/${encodeURIComponent(keyId)}`],
      usage: ["/api/v1/usage/stats?period=today", "/api/v1/usage/dashboard/stats", "/api/v1/user/profile", "/api/v1/user/platform-quotas", "/api/v1/auth/me", "/api/v1/usage", "/api/v1/dashboard", "/api/usage", "/api/user", "/api/me"],
      logs: ["/api/v1/usage?page=1&page_size=50", "/api/v1/logs?page=1&size=50", "/api/v1/usage/logs?page=1&size=50", "/api/logs?page=1&size=50", "/api/usage/logs?page=1&size=50", "/logs?page=1&size=50"]
    }
  };
  return tables[site.type][action];
}

async function fetchUsageForSite(site) {
  if (site.type !== "newapi") {
    let usage = normalizeUsage(site, {});
    let sourceRoute = "";
    try {
      const profileResult = await requestSite(site, "GET", ["/api/v1/user/profile", "/api/v1/auth/me", "/api/user", "/api/me"]);
      usage = mergeUsage(normalizeUsageFromRoute(site, profileResult.payload, profileResult.route), usage);
      sourceRoute = profileResult.route;
    } catch {
      sourceRoute = "profile endpoint unavailable";
    }
    try {
      const statResult = await requestSite(site, "GET", ["/api/v1/usage/stats?period=today", "/api/v1/usage/dashboard/stats", "/api/v1/usage"]);
      usage = mergeUsage(usage, normalizeUsageFromRoute(site, statResult.payload, statResult.route));
      sourceRoute = `${sourceRoute} + ${statResult.route}`;
    } catch {
      if (!sourceRoute) sourceRoute = "usage endpoint unavailable";
    }
    try {
      usage = mergeUsage(usage, await fetchUsageLogSummaryForSite(site));
      sourceRoute = `${sourceRoute} + logs`;
    } catch {
      // Sub2API logs are optional across deployments.
    }
    return {
      usage,
      sourceRoute
    };
  }

  const quotaResult = await requestSite(site, "GET", ["/api/user/self"]);
  const baseUsage = normalizeUsageFromRoute(site, quotaResult.payload, quotaResult.route);
  let usage = baseUsage;
  let sourceRoute = quotaResult.route;

  try {
    const statResult = await requestSite(site, "GET", [todayLogStatRoute()]);
    usage = mergeUsage(usage, normalizeUsageFromRoute(site, statResult.payload, statResult.route));
    sourceRoute = `${sourceRoute} + ${statResult.route.split("?")[0]}`;
  } catch {
    // The stat endpoint is optional; account balance remains useful without it.
  }

  try {
    usage = mergeUsage(usage, await fetchUsageLogSummaryForSite(site));
    sourceRoute = `${sourceRoute} + /api/log/self`;
  } catch {
    // Logs are optional for compatibility; do not fail the whole usage card.
  }

  return { usage, sourceRoute };
}

async function findSite(store, siteId) {
  const site = store.sites.find((item) => item.id === siteId);
  if (!site) throw new HttpError(404, "站点不存在");
  if (!site.enabled) throw new HttpError(400, "站点已停用");
  return site;
}

async function api(req, res, pathname) {
  if (pathname === "/api/login" && req.method === "POST") {
    const body = await readJson(req);
    const store = await readStore();
    if (body.username !== store.user.username || !verifyPassword(body.password || "", store.user.password)) {
      throw new HttpError(401, "用户名或密码错误");
    }
    const token = id("session");
    sessions.set(token, { username: store.user.username, expiresAt: Date.now() + SESSION_TTL_MS });
    setSessionCookie(res, token);
    return send(res, 200, { user: { username: store.user.username } });
  }

  if (pathname === "/api/logout" && req.method === "POST") {
    const token = cookie(req, COOKIE_NAME);
    if (token) sessions.delete(token);
    clearSessionCookie(res);
    return send(res, 200, { ok: true });
  }

  await requireSession(req);

  if (pathname === "/api/session" && req.method === "GET") {
    const store = await readStore();
    return send(res, 200, { user: { username: store.user.username } });
  }

  if (pathname === "/api/password" && req.method === "PATCH") {
    const body = await readJson(req);
    const store = await readStore();
    if (!verifyPassword(body.currentPassword || "", store.user.password)) throw new HttpError(403, "当前密码不正确");
    if (!body.nextPassword || String(body.nextPassword).length < 10) throw new HttpError(400, "新密码至少 10 位");
    store.user.password = hashPassword(body.nextPassword);
    await writeStore(store);
    return send(res, 200, { ok: true });
  }

  if (pathname === "/api/sites/detect" && req.method === "POST") {
    const body = await readJson(req);
    return send(res, 200, await detectSite(body));
  }

  if (pathname === "/api/sites" && req.method === "GET") {
    const store = await readStore();
    return send(res, 200, { sites: store.sites.map(sanitizeSite) });
  }

  if (pathname === "/api/sites" && req.method === "POST") {
    const body = await readJson(req);
    const store = await readStore();
    const site = await siteFromInput(body);
    if (!site.name) throw new HttpError(400, "站点名称不能为空");
    store.sites.push(site);
    await writeStore(store);
    return send(res, 201, { site: sanitizeSite(site) });
  }

  if (pathname === "/api/credentials" && req.method === "GET") {
    const store = await readStore();
    return send(res, 200, { credentials: store.credentials.map(sanitizeCredential) });
  }

  if (pathname === "/api/credentials" && req.method === "POST") {
    const body = await readJson(req);
    const store = await readStore();
    const credential = await credentialFromInput(body);
    if (!credential.name) throw new HttpError(400, "Credential name is required");
    if (!credential.secrets?.apiKey) throw new HttpError(400, "API key is required");
    store.credentials.push(credential);
    await writeStore(store);
    return send(res, 201, { credential: sanitizeCredential(credential) });
  }

  const credentialMatch = pathname.match(/^\/api\/credentials\/([^/]+)(?:\/(.*))?$/);
  if (credentialMatch) {
    const [, credentialId, tail = ""] = credentialMatch;
    const store = await readStore();
    const index = store.credentials.findIndex((item) => item.id === credentialId);
    if (index < 0) throw new HttpError(404, "Credential not found");
    const credential = store.credentials[index];

    if (!tail && req.method === "PUT") {
      const body = await readJson(req);
      const updated = await credentialFromInput(body, credential);
      store.credentials[index] = updated;
      await writeStore(store);
      return send(res, 200, { credential: sanitizeCredential(updated) });
    }

    if (!tail && req.method === "DELETE") {
      store.credentials.splice(index, 1);
      await writeStore(store);
      return send(res, 200, { ok: true });
    }

    if (tail === "test" && req.method === "POST") {
      try {
        const result = await requestCredential(credential, ["/v1/models", "/models", "/api/models"]);
        credential.lastCheckedAt = nowIso();
        credential.lastStatus = "online";
        credential.lastError = "";
        store.credentials[index] = credential;
        await writeStore(store);
        return send(res, 200, { ok: true, route: result.route, status: result.status });
      } catch (error) {
        credential.lastCheckedAt = nowIso();
        credential.lastStatus = "failed";
        credential.lastError = Array.isArray(error.details) && error.details.length
          ? `${error.message}: ${error.details.join("; ")}`
          : error.message;
        store.credentials[index] = credential;
        await writeStore(store);
        throw error;
      }
    }

    if (tail === "models" && req.method === "GET") {
      const result = await requestCredential(credential, ["/v1/models", "/models", "/api/models"]);
      const siteLike = { id: credential.id, type: "sub2api" };
      return send(res, 200, { models: normalizeModels(siteLike, result.payload), sourceRoute: result.route });
    }
  }

  const siteMatch = pathname.match(/^\/api\/sites\/([^/]+)(?:\/(.*))?$/);
  if (siteMatch) {
    const [, siteId, tail = ""] = siteMatch;
    const store = await readStore();
    const index = store.sites.findIndex((item) => item.id === siteId);
    if (index < 0) throw new HttpError(404, "站点不存在");
    const site = store.sites[index];
    if (tail && !site.enabled) {
      throw new HttpError(400, "站点已停用");
    }

    if (!tail && req.method === "PUT") {
      const body = await readJson(req);
      const updated = await siteFromInput(body, site);
      refreshAccessCache.delete(updated.id);
      store.sites[index] = updated;
      await writeStore(store);
      return send(res, 200, { site: sanitizeSite(updated) });
    }

    if (!tail && req.method === "DELETE") {
      store.sites.splice(index, 1);
      await writeStore(store);
      return send(res, 200, { ok: true });
    }

    if (tail === "test" && req.method === "POST") {
      try {
        const result = await requestSite(site, "GET", routesFor(site, "test"));
        site.lastCheckedAt = nowIso();
        site.lastStatus = "online";
        site.lastError = "";
        store.sites[index] = site;
        await writeStore(store);
        return send(res, 200, { ok: true, route: result.route, status: result.status });
      } catch (error) {
        site.lastCheckedAt = nowIso();
        site.lastStatus = "failed";
        site.lastError = Array.isArray(error.details) && error.details.length
          ? `${error.message}: ${error.details.join("; ")}`
          : error.message;
        store.sites[index] = site;
        await writeStore(store);
        throw error;
      }
    }

    if (tail === "diagnostics" && req.method === "GET") {
      return send(res, 200, await diagnoseSite(site));
    }

    if (tail === "models" && req.method === "GET") {
      const result = await requestSite(site, "GET", routesFor(site, "models"));
      return send(res, 200, { models: normalizeModels(site, result.payload), sourceRoute: result.route });
    }

    if (tail === "keys" && req.method === "GET") {
      const result = await requestSite(site, "GET", routesFor(site, "keys"));
      return send(res, 200, { keys: normalizeKeys(site, result.payload), sourceRoute: result.route });
    }

    if (tail === "keys" && req.method === "POST") {
      const body = await readJson(req);
      const { payload, quota, group, expiresAt } = buildCreateKeyPayload(site, body);
      const result = await requestSite(site, "POST", routesFor(site, "createKey"), payload);
      const rawKey = result.payload.key || result.payload.token || result.payload.value || result.payload.data?.key || "";
      return send(res, 201, {
        key: {
          id: String(result.payload.id || result.payload.data?.id || id("key")),
          siteId: site.id,
          name: payload.name,
          maskedKey: mask(rawKey),
          plainKey: rawKey || undefined,
          status: "active",
          quota,
          used: 0,
          group,
          expiresAt,
          createdAt: nowIso()
        },
        sourceRoute: result.route
      });
    }

    const keyDeleteMatch = tail.match(/^keys\/([^/]+)$/);
    if (keyDeleteMatch && req.method === "DELETE") {
      const result = await requestSite(site, "DELETE", routesFor(site, "deleteKey")(keyDeleteMatch[1]));
      return send(res, 200, { ok: true, sourceRoute: result.route });
    }

    if (tail === "usage" && req.method === "GET") {
      return send(res, 200, await fetchUsageForSite(site));
    }

    if (tail === "logs" && req.method === "GET") {
      return send(res, 200, await fetchUsageLogsForSite(site));
    }
  }

  if (pathname === "/api/dashboard" && req.method === "GET") {
    const store = await readStore();
    const summaries = [];
    for (const site of store.sites.filter((item) => item.enabled)) {
      try {
        const usage = await fetchUsageForSite(site);
        summaries.push({ site: sanitizeSite(site), usage: usage.usage, ok: true, sourceRoute: usage.sourceRoute });
      } catch (error) {
        summaries.push({ site: sanitizeSite(site), usage: normalizeUsage(site, {}), ok: false, error: error.message });
      }
    }
    return send(res, 200, {
      totalSites: store.sites.length,
      onlineSites: store.sites.filter((item) => item.lastStatus === "online").length,
      summaries
    });
  }

  throw new HttpError(404, "接口不存在");
}

async function mockApi(req, res, pathname) {
  if (process.env.APIHUB_ENABLE_MOCKS === "false") throw new HttpError(404, "Mock 接口未启用");
  const hasBearer = Boolean(req.headers.authorization || "");
  const hasSessionAuth = hasBearer || Boolean(req.headers.cookie || req.headers["x-refresh-token"] || req.headers["refresh-token"] || req.headers.refresh_token);
  const isNewApi = pathname.startsWith("/mock/newapi");
  if (!hasSessionAuth || (isNewApi && !req.headers["new-api-user"])) {
    throw new HttpError(401, "Mock 远端未收到后端注入的授权头");
  }

  const mockUsage = isNewApi
    ? { balance: 64250000, usedToday: 3625000, usedTotal: 430375000, requestCountToday: 42 }
    : { balance: 128.5, usedToday: 7.25, usedTotal: 860.75, requestCountToday: 42 };

  if (pathname.endsWith("/api/status") || pathname.endsWith("/api/user") || pathname.endsWith("/api/me")) {
    return send(res, 200, { status: "ok", ...mockUsage });
  }

  if (pathname.endsWith("/api/user/self") || pathname.endsWith("/api/user/quota") || pathname.endsWith("/api/usage")) {
    return send(res, 200, mockUsage);
  }

  if (pathname.endsWith("/api/log/self/stat")) {
    return send(res, 200, { success: true, message: "", data: { quota: isNewApi ? 3625000 : 7.25, count: 42 } });
  }

  if (
    pathname.endsWith("/api/log/self") ||
    pathname.endsWith("/api/v1/logs") ||
    pathname.endsWith("/api/v1/usage/logs") ||
    pathname.endsWith("/api/logs") ||
    pathname.endsWith("/api/usage/logs") ||
    pathname.endsWith("/logs")
  ) {
    const now = Math.floor(Date.now() / 1000);
    return send(res, 200, {
      success: true,
      message: "",
      data: {
        items: [
          { id: "log_1", created_at: now - 3600, token_name: "mobile-demo", model_name: "gpt-4o-mini", quota: isNewApi ? 150000 : 0.3, prompt_tokens: 860, completion_tokens: 240, content: "模型调用消费" },
          { id: "log_2", created_at: now - 7200, token_name: "mobile-demo", model_name: "qwen-plus", quota: isNewApi ? 85000 : 0.17, prompt_tokens: 420, completion_tokens: 180, content: "模型调用消费" }
        ],
        total: 2
      }
    });
  }

  if (pathname.endsWith("/v1/models") || pathname.endsWith("/api/models") || pathname.endsWith("/models")) {
    return send(res, 200, {
      data: [
        { id: "gpt-4o-mini", owned_by: "openai", group: "default", input_price: 0.15, output_price: 0.6, enabled: true },
        { id: "claude-3-5-sonnet", owned_by: "anthropic", group: "premium", input_price: 3, output_price: 15, enabled: true },
        { id: "qwen-plus", owned_by: "dashscope", group: "default", input_price: 0.8, output_price: 2, enabled: true }
      ]
    });
  }

  if (pathname.endsWith("/api/token/") || pathname.endsWith("/api/token") || pathname.endsWith("/api/tokens") || pathname.endsWith("/api/user/token") || pathname.endsWith("/api/keys") || pathname.endsWith("/api/key") || pathname.endsWith("/keys")) {
    if (req.method === "GET") {
      return send(res, 200, {
        data: [
          { id: "demo_key_1", name: "mobile-demo", key: "sk-demo-mobile-0001", status: "active", quota: 1000, used: 42, group: "default" }
        ]
      });
    }
    if (req.method === "POST") {
      const body = await readJson(req);
      return send(res, 201, {
        id: id("remote_key"),
        name: body.name || body.token_name || body.key_name || "new-key",
        key: `sk-created-${crypto.randomBytes(12).toString("hex")}`
      });
    }
  }

  if (/\/(api\/token|api\/tokens|api\/keys|api\/key|keys)\//.test(pathname) && req.method === "DELETE") {
    return send(res, 200, { ok: true });
  }

  throw new HttpError(404, "Mock 路由不存在");
}

async function staticFile(req, res, pathname) {
  let filePath = path.join(PUBLIC_DIR, pathname === "/" ? "index.html" : pathname);
  const resolved = path.resolve(filePath);
  const publicRoot = `${path.resolve(PUBLIC_DIR)}${path.sep}`;
  if (resolved !== path.resolve(PUBLIC_DIR) && !resolved.startsWith(publicRoot)) throw new HttpError(403, "禁止访问");
  try {
    const stat = await fs.stat(resolved);
    if (stat.isDirectory()) filePath = path.join(resolved, "index.html");
    const ext = path.extname(filePath);
    const fileName = path.basename(filePath);
    const noStoreAssets = new Set([".html", ".js", ".css", ".webmanifest"]);
    res.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
      "Cache-Control": noStoreAssets.has(ext) || fileName === "service-worker.js" ? "no-store" : "public, max-age=3600"
    });
    res.end(await fs.readFile(filePath));
  } catch {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    res.end(await fs.readFile(path.join(PUBLIC_DIR, "index.html")));
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/mock/")) await mockApi(req, res, url.pathname);
    else if (url.pathname.startsWith("/api/")) await api(req, res, url.pathname);
    else await staticFile(req, res, decodeURIComponent(url.pathname));
  } catch (error) {
    const status = error.status || 500;
    send(res, status, {
      error: error.message || "服务器错误",
      details: error.details || undefined
    });
  }
});

ensureData().then(() => {
  server.listen(PORT, () => {
    console.log(`API Hub Mobile is running at http://localhost:${PORT}`);
    console.log(`Admin user: ${DEFAULT_USER}`);
    if (bootstrapPasswordNotice) console.log(bootstrapPasswordNotice);
    if (COOKIE_SECURE) console.log("Secure cookie mode is enabled.");
  });
});
