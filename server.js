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
  return JSON.parse(await fs.readFile(STORE_FILE, "utf8"));
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

  for (const field of ["systemToken", "jwt", "apiKey", "adminToken", "password"]) {
    if (input[field]) {
      secrets[field] = await encryptSecret(input[field]);
      if (["systemToken", "jwt", "apiKey", "adminToken"].includes(field)) maskedCredential = mask(input[field]);
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

function inferType(input) {
  if (input.systemToken || input.userId) return "newapi";
  return "sub2api";
}

function normalizeModels(site, payload) {
  const list = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : Array.isArray(payload?.models) ? payload.models : [];
  return list.map((item) => ({
    id: String(item.id || item.model || item.name || id("model")),
    siteId: site.id,
    name: String(item.name || item.id || item.model || "未知模型"),
    provider: String(item.provider || item.owned_by || item.type || site.type),
    group: String(item.group || item.quota_type || item.category || "default"),
    inputPrice: Number(item.inputPrice ?? item.input_price ?? item.prompt_price ?? 0),
    outputPrice: Number(item.outputPrice ?? item.output_price ?? item.completion_price ?? 0),
    enabled: item.enabled !== false
  }));
}

function normalizeKeys(site, payload) {
  const list = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : Array.isArray(payload?.tokens) ? payload.tokens : Array.isArray(payload?.keys) ? payload.keys : [];
  return list.map((item) => ({
    id: String(item.id || item.key_id || item.token_id || item.name || id("key")),
    siteId: site.id,
    name: String(item.name || item.key_name || item.token_name || "未命名 Key"),
    maskedKey: item.maskedKey || item.masked_key || mask(item.key || item.token || item.value || ""),
    status: item.status || (item.deleted ? "disabled" : "active"),
    quota: Number(item.quota ?? item.remain_quota ?? item.unlimited_quota ?? 0),
    used: Number(item.used ?? item.used_quota ?? 0),
    group: String(item.group || item.access_group || "default"),
    expiresAt: item.expiresAt || item.expired_time || item.expires_at || null,
    createdAt: item.createdAt || item.created_at || null
  }));
}

function normalizeUsage(site, payload) {
  return {
    siteId: site.id,
    balance: Number(payload?.balance ?? payload?.quota ?? payload?.remain_quota ?? payload?.data?.balance ?? 0),
    usedToday: Number(payload?.usedToday ?? payload?.today_used ?? payload?.data?.usedToday ?? 0),
    usedTotal: Number(payload?.usedTotal ?? payload?.used_quota ?? payload?.total_used ?? payload?.data?.usedTotal ?? 0),
    requestCountToday: Number(payload?.requestCountToday ?? payload?.today_requests ?? payload?.data?.requestCountToday ?? 0)
  };
}

async function adapterHeaders(site) {
  const headers = { "Content-Type": "application/json" };
  if (site.type === "newapi") {
    const token = await decryptSecret(site.secrets?.systemToken);
    if (token) headers.Authorization = `Bearer ${token}`;
    if (site.userId) headers["New-Api-User"] = site.userId;
  } else {
    const jwt = await decryptSecret(site.secrets?.jwt);
    const apiKey = await decryptSecret(site.secrets?.apiKey);
    const adminToken = await decryptSecret(site.secrets?.adminToken);
    if (jwt) headers.Authorization = `Bearer ${jwt}`;
    else if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    if (adminToken) headers["X-Admin-Token"] = adminToken;
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
      try { payload = text ? JSON.parse(text) : {}; } catch { payload = { message: text }; }
      if (response.ok) return { route, payload, status: response.status };
      errors.push(`${route}: HTTP ${response.status}`);
    } catch (error) {
      errors.push(`${route}: ${error.name === "AbortError" ? "请求超时" : error.message}`);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new HttpError(502, "远端站点请求失败", errors.slice(0, 3));
}

function describePayload(payload) {
  if (Array.isArray(payload)) {
    return { kind: "array", length: payload.length };
  }
  if (payload && typeof payload === "object") {
    const keys = Object.keys(payload).slice(0, 12);
    const data = payload.data;
    return {
      kind: "object",
      keys,
      dataKind: Array.isArray(data) ? "array" : data && typeof data === "object" ? "object" : typeof data,
      dataLength: Array.isArray(data) ? data.length : undefined
    };
  }
  return { kind: typeof payload };
}

async function probeSiteRoute(site, method, route) {
  const headers = await adapterHeaders(site);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
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
      test: ["/api/status", "/status", "/api/user/self", "/api/models", "/v1/models"],
      models: ["/v1/models", "/api/models", "/models"],
      keys: ["/api/token/", "/api/token", "/api/tokens", "/api/user/token"],
      createKey: ["/api/token/", "/api/token", "/api/tokens"],
      deleteKey: (keyId) => [`/api/token/${encodeURIComponent(keyId)}`, `/api/tokens/${encodeURIComponent(keyId)}`],
      usage: ["/api/user/self", "/api/user/quota", "/api/dashboard"]
    },
    sub2api: {
      test: ["/api/user", "/api/me", "/user", "/v1/models"],
      models: ["/v1/models", "/api/models", "/models"],
      keys: ["/api/keys", "/api/key", "/keys"],
      createKey: ["/api/keys", "/api/key", "/keys"],
      deleteKey: (keyId) => [`/api/keys/${encodeURIComponent(keyId)}`, `/api/key/${encodeURIComponent(keyId)}`, `/keys/${encodeURIComponent(keyId)}`],
      usage: ["/api/usage", "/api/user", "/api/me"]
    }
  };
  return tables[site.type][action];
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
        site.lastError = error.message;
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
      const payload = {
        name: body.name,
        token_name: body.name,
        key_name: body.name,
        quota: Number(body.quota || 0),
        group: body.group || "default",
        expires_at: body.expiresAt || null
      };
      const result = await requestSite(site, "POST", routesFor(site, "createKey"), payload);
      const rawKey = result.payload.key || result.payload.token || result.payload.value || result.payload.data?.key || "";
      return send(res, 201, {
        key: {
          id: String(result.payload.id || result.payload.data?.id || id("key")),
          siteId: site.id,
          name: body.name,
          maskedKey: mask(rawKey),
          plainKey: rawKey || undefined,
          status: "active",
          quota: payload.quota,
          used: 0,
          group: payload.group,
          expiresAt: payload.expires_at,
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
      const result = await requestSite(site, "GET", routesFor(site, "usage"));
      return send(res, 200, { usage: normalizeUsage(site, result.payload), sourceRoute: result.route });
    }
  }

  if (pathname === "/api/dashboard" && req.method === "GET") {
    const store = await readStore();
    const summaries = [];
    for (const site of store.sites.filter((item) => item.enabled)) {
      try {
        const usage = await requestSite(site, "GET", routesFor(site, "usage"));
        summaries.push({ site: sanitizeSite(site), usage: normalizeUsage(site, usage.payload), ok: true });
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
  const isNewApi = pathname.startsWith("/mock/newapi");
  if (!hasBearer || (isNewApi && !req.headers["new-api-user"])) {
    throw new HttpError(401, "Mock 远端未收到后端注入的授权头");
  }

  if (pathname.endsWith("/api/status") || pathname.endsWith("/api/user") || pathname.endsWith("/api/me")) {
    return send(res, 200, { status: "ok", balance: 128.5, usedToday: 7.25, usedTotal: 860.75, requestCountToday: 42 });
  }

  if (pathname.endsWith("/api/user/self") || pathname.endsWith("/api/user/quota") || pathname.endsWith("/api/usage")) {
    return send(res, 200, { balance: 128.5, usedToday: 7.25, usedTotal: 860.75, requestCountToday: 42 });
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
    res.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
      "Cache-Control": ext === ".html" ? "no-store" : "public, max-age=3600"
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
