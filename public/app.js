"use strict";

const app = document.querySelector("#app");
const toastBox = document.querySelector("#toast");

const state = {
  user: null,
  active: "dashboard",
  sites: [],
  selectedSiteId: null,
  dashboard: null,
  keys: [],
  models: [],
  usage: null,
  sourceRoute: ""
};

const tabs = [
  ["dashboard", "仪表盘", "M12 3v18M3.5-15h9M3.5 6h9M3.5 6h9"],
  ["sites", "站点", "M4 8h16M4 16h16M8 4h8v16H8z"],
  ["keys", "Keys", "M15 7a4 4 0 1 1-3.3 6.3L9 16H6v3H3v-3.5l5.2-5.2A4 4 0 0 1 15 7z"],
  ["models", "模型", "M5 7l7-4 7 4-7 4-7-4zm0 6l7 4 7-4M5 19l7 4 7-4"],
  ["usage", "用量", "M4 19V5M10 19v-8M16 19V9M22 19V3"],
  ["settings", "设置", "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0-5v3m0 12v3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1M3 12h3m12 0h3M5.6 18.4l2.1-2.1m8.6-8.6 2.1-2.1"]
];

function icon(path) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"></path></svg>`;
}

function h(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function money(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n.toLocaleString("zh-CN", { maximumFractionDigits: 4 }) : "0";
}

function dateText(value) {
  if (!value) return "未记录";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("zh-CN", { hour12: false });
}

function selectedSite() {
  return state.sites.find((site) => site.id === state.selectedSiteId) || state.sites[0] || null;
}

function toast(message, tone = "dark") {
  toastBox.textContent = message;
  toastBox.style.background = tone === "danger" ? "#b42318" : tone === "ok" ? "#15803d" : "#111827";
  toastBox.classList.add("show");
  clearTimeout(toastBox._timer);
  toastBox._timer = setTimeout(() => toastBox.classList.remove("show"), 3200);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && path !== "/api/login") {
      state.user = null;
      renderLogin();
    }
    const detail = Array.isArray(payload.details) ? `：${payload.details.join("；")}` : "";
    throw new Error(`${payload.error || "请求失败"}${detail}`);
  }
  return payload;
}

async function boot() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/service-worker.js").catch(() => {});
  }
  try {
    const session = await api("/api/session");
    state.user = session.user;
    await loadSites();
    await refreshDashboard();
    renderApp();
  } catch {
    renderLogin();
  }
}

function renderLogin() {
  app.innerHTML = `
    <main class="login">
      <section class="login-card">
        <div class="login-head">
          <img src="/icon.svg" alt="" class="login-logo">
          <div>
            <h1>API Hub Mobile</h1>
            <p>登录后管理 New API 与 Sub2API 站点。会话使用 HttpOnly Cookie，凭证只保存在后端代理。</p>
          </div>
        </div>
        <form id="login-form">
          <div class="field">
            <label for="username">用户名</label>
            <input id="username" name="username" autocomplete="username" value="admin" required>
          </div>
          <div class="field">
            <label for="password">密码</label>
            <input id="password" name="password" type="password" autocomplete="current-password" placeholder="初始密码文件或环境变量" required>
          </div>
          <button class="btn primary" type="submit">${icon("M5 12h14M13 5l7 7-7 7")}登录</button>
        </form>
      </section>
    </main>
  `;
}

async function loadSites() {
  const data = await api("/api/sites");
  state.sites = data.sites || [];
  if (!state.sites.some((site) => site.id === state.selectedSiteId)) {
    state.selectedSiteId = state.sites[0]?.id || null;
  }
}

async function refreshDashboard() {
  state.dashboard = await api("/api/dashboard");
}

async function refreshActive() {
  if (state.active === "dashboard") return refreshDashboard();
  if (state.active === "sites") return loadSites();
  const site = selectedSite();
  if (!site && ["keys", "models", "usage"].includes(state.active)) return;
  if (state.active === "keys") return refreshKeys();
  if (state.active === "models") return refreshModels();
  if (state.active === "usage") return refreshUsage();
}

async function refreshKeys() {
  const site = selectedSite();
  if (!site) return;
  const data = await api(`/api/sites/${site.id}/keys`);
  state.keys = data.keys || [];
  state.sourceRoute = data.sourceRoute || "";
}

async function refreshModels() {
  const site = selectedSite();
  if (!site) return;
  const data = await api(`/api/sites/${site.id}/models`);
  state.models = data.models || [];
  state.sourceRoute = data.sourceRoute || "";
}

async function refreshUsage() {
  const site = selectedSite();
  if (!site) return;
  const data = await api(`/api/sites/${site.id}/usage`);
  state.usage = data.usage;
  state.sourceRoute = data.sourceRoute || "";
}

function renderApp() {
  app.innerHTML = `
    <div class="workspace">
      <header class="topbar">
        <div class="topbar-inner">
          <div class="brand">
            <img src="/icon.svg" alt="">
            <div>
              <strong>API Hub Mobile</strong>
              <span>${h(state.user?.username || "")} · ${state.sites.length} 个站点</span>
            </div>
          </div>
          <button class="btn ghost" data-action="logout" title="退出">${icon("M10 17l5-5-5-5M15 12H3M21 3v18")}退出</button>
        </div>
      </header>
      <main id="screen">${renderScreen()}</main>
      <footer class="bottom-nav">
        <nav aria-label="主导航">
          ${tabs.map(([id, label, d]) => `
            <button class="nav-btn ${state.active === id ? "active" : ""}" data-tab="${id}" type="button" aria-label="${label}">
              ${icon(d)}<span>${label}</span>
            </button>
          `).join("")}
        </nav>
      </footer>
      <div id="modal" class="modal" role="dialog" aria-modal="true"></div>
    </div>
  `;
}

function renderScreen() {
  if (state.active === "dashboard") return renderDashboard();
  if (state.active === "sites") return renderSites();
  if (state.active === "keys") return renderKeys();
  if (state.active === "models") return renderModels();
  if (state.active === "usage") return renderUsage();
  return renderSettings();
}

function renderSitePicker() {
  if (!state.sites.length) return `<div class="empty">还没有站点，请先添加 New API 或 Sub2API。</div>`;
  return `
    <div class="field">
      <label for="site-picker">当前站点</label>
      <select id="site-picker" data-action="select-site">
        ${state.sites.map((site) => `<option value="${site.id}" ${site.id === state.selectedSiteId ? "selected" : ""}>${h(site.name)} · ${site.type}</option>`).join("")}
      </select>
    </div>
  `;
}

function renderDashboard() {
  const summaries = state.dashboard?.summaries || [];
  const totalBalance = summaries.reduce((sum, item) => sum + Number(item.usage?.balance || 0), 0);
  const usedToday = summaries.reduce((sum, item) => sum + Number(item.usage?.usedToday || 0), 0);
  const requests = summaries.reduce((sum, item) => sum + Number(item.usage?.requestCountToday || 0), 0);
  return `
    <section class="screen">
      <div class="screen-head">
        <div>
          <h1>仪表盘</h1>
          <p>统一查看站点状态、余额与今日请求。</p>
        </div>
        <button class="btn" data-action="refresh">${icon("M21 12a9 9 0 0 1-9 9 9.7 9.7 0 0 1-6.7-2.7M3 12a9 9 0 0 1 15.7-6.3M21 4v7h-7M3 20v-7h7")}刷新</button>
      </div>
      <div class="grid stats">
        <article class="card metric"><span>站点</span><strong>${state.dashboard?.totalSites || 0}</strong><span>已配置</span></article>
        <article class="card metric"><span>在线</span><strong>${state.dashboard?.onlineSites || 0}</strong><span>最近测试成功</span></article>
        <article class="card metric"><span>余额</span><strong>${money(totalBalance)}</strong><span>聚合展示</span></article>
        <article class="card metric"><span>今日用量</span><strong>${money(usedToday)}</strong><span>${money(requests)} 次请求</span></article>
      </div>
      <div class="list" style="margin-top:12px">
        ${summaries.length ? summaries.map((item) => siteSummary(item)).join("") : `<div class="empty">添加站点后，这里会展示状态和基础用量。</div>`}
      </div>
    </section>
  `;
}

function siteSummary(item) {
  const site = item.site;
  return `
    <article class="list-card">
      <div class="list-title">
        <strong>${h(site.name)}</strong>
        <span class="pill ${item.ok ? "ok" : "bad"}">${item.ok ? "可连接" : "异常"}</span>
      </div>
      <div class="meta">
        <span class="pill">${site.type}</span>
        <span class="pill">余额 ${money(item.usage?.balance)}</span>
        <span class="pill">今日 ${money(item.usage?.usedToday)}</span>
      </div>
      ${item.error ? `<p class="muted">${h(item.error)}</p>` : ""}
    </article>
  `;
}

function renderSites() {
  return `
    <section class="screen">
      <div class="screen-head">
        <div>
          <h1>站点管理</h1>
          <p>后端保存并注入凭证，前端只显示脱敏状态。</p>
        </div>
        <button class="btn primary" data-action="open-site">${icon("M12 5v14M5 12h14")}新增</button>
      </div>
      <div class="split">
        <div class="list">
          ${state.sites.length ? state.sites.map(renderSiteCard).join("") : `<div class="empty">还没有站点。点击新增开始配置。</div>`}
        </div>
        <aside class="form-panel">
          ${selectedSite() ? renderSiteDetail(selectedSite()) : `<p class="muted">选择一个站点后可以测试连接或编辑。</p>`}
        </aside>
      </div>
    </section>
  `;
}

function renderSiteCard(site) {
  const statusClass = site.lastStatus === "online" ? "ok" : site.lastStatus === "failed" ? "bad" : "warn";
  return `
    <article class="list-card ${site.id === state.selectedSiteId ? "active" : ""}">
      <div class="list-title">
        <strong>${h(site.name)}</strong>
        <button class="btn ghost" data-select-site="${site.id}" type="button">${icon("M9 18l6-6-6-6")}选择</button>
      </div>
      <div class="meta">
        <span class="pill">${site.type}</span>
        <span class="pill ${statusClass}">${site.lastStatus || "unknown"}</span>
        <span class="pill">${site.enabled ? "启用" : "停用"}</span>
      </div>
      <p class="muted">${h(site.baseUrl)}</p>
    </article>
  `;
}

function renderSiteDetail(site) {
  return `
    <h2 style="margin:0 0 8px;font-size:20px">${h(site.name)}</h2>
    <p class="muted">${h(site.baseUrl)}</p>
    <div class="meta">
      <span class="pill">${site.authType}</span>
      <span class="pill">凭证 ${h(site.maskedCredential || "未显示")}</span>
      <span class="pill">上次 ${h(dateText(site.lastCheckedAt))}</span>
    </div>
    ${site.lastError ? `<p class="muted">${h(site.lastError)}</p>` : ""}
    <div class="actions">
      <button class="btn primary" data-action="test-site">${icon("M20 6L9 17l-5-5")}测试连接</button>
      <button class="btn" data-action="diagnose-site">${icon("M9 3h6M9 21h6M4 8h16M4 16h16")}诊断</button>
      <button class="btn" data-action="open-site" data-edit="1">${icon("M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z")}编辑</button>
      <button class="btn danger" data-action="delete-site">${icon("M3 6h18M8 6V4h8v2M6 6l1 16h10l1-16")}删除</button>
    </div>
  `;
}

function renderDiagnostics(data) {
  const labels = {
    test: "连接测试",
    models: "模型列表",
    keys: "Key 列表",
    usage: "基础用量"
  };
  const sections = Object.entries(data.actions || {}).map(([action, rows]) => `
    <section class="form-panel" style="box-shadow:none;margin-top:10px">
      <h3 style="margin:0 0 8px;font-size:16px">${labels[action] || action}</h3>
      <div class="list">
        ${(rows || []).map((row) => `
          <article class="list-card">
            <div class="list-title">
              <strong>${h(row.route)}</strong>
              <span class="pill ${row.ok ? "ok" : "bad"}">${row.status || "ERR"}</span>
            </div>
            <div class="meta">
              <span class="pill">${h(row.method)}</span>
              ${row.contentType ? `<span class="pill">${h(row.contentType.split(";")[0])}</span>` : ""}
              ${row.body?.kind ? `<span class="pill">${h(row.body.kind)}</span>` : ""}
              ${row.body?.dataKind ? `<span class="pill">data ${h(row.body.dataKind)}${Number.isFinite(row.body.dataLength) ? `(${row.body.dataLength})` : ""}</span>` : ""}
            </div>
            ${row.body?.keys?.length ? `<p class="muted">keys: ${h(row.body.keys.join(", "))}</p>` : ""}
            ${row.error ? `<p class="muted">${h(row.error)}</p>` : ""}
          </article>
        `).join("")}
      </div>
    </section>
  `).join("");
  openModal(`
    <h2>站点诊断</h2>
    <p class="muted">${h(data.site?.name || "")} · ${h(dateText(data.checkedAt))}</p>
    <p class="muted">诊断只展示状态码和响应结构摘要，不展示远端响应正文或凭证明文。</p>
    ${sections}
    <div class="actions"><button class="btn primary" type="button" data-action="close-modal">${icon("M20 6L9 17l-5-5")}完成</button></div>
  `);
}

function renderKeys() {
  const site = selectedSite();
  return `
    <section class="screen">
      <div class="screen-head">
        <div>
          <h1>API Key 管理</h1>
          <p>创建结果可短时显示一次，列表默认脱敏。</p>
        </div>
        <button class="btn primary" data-action="open-key" ${site ? "" : "disabled"}>${icon("M12 5v14M5 12h14")}创建</button>
      </div>
      ${renderSitePicker()}
      <div class="actions"><button class="btn" data-action="refresh">${icon("M21 12a9 9 0 0 1-9 9M3 12a9 9 0 0 1 9-9")}刷新</button>${state.sourceRoute ? `<span class="pill">来源 ${h(state.sourceRoute)}</span>` : ""}</div>
      <div class="list" style="margin-top:12px">
        ${site ? (state.keys.length ? state.keys.map(renderKeyCard).join("") : `<div class="empty">暂无 Key 数据，或远端接口未返回列表。</div>`) : ""}
      </div>
    </section>
  `;
}

function renderKeyCard(key) {
  return `
    <article class="list-card">
      <div class="list-title">
        <strong>${h(key.name)}</strong>
        <span class="pill ${key.status === "active" ? "ok" : "warn"}">${h(key.status)}</span>
      </div>
      <p class="secret-once">${h(key.maskedKey || "未返回脱敏 Key")}</p>
      <div class="meta">
        <span class="pill">额度 ${money(key.quota)}</span>
        <span class="pill">已用 ${money(key.used)}</span>
        <span class="pill">${h(key.group || "default")}</span>
      </div>
      <div class="actions"><button class="btn danger" data-delete-key="${h(key.id)}">${icon("M3 6h18M8 6V4h8v2M6 6l1 16h10l1-16")}删除</button></div>
    </article>
  `;
}

function renderModels() {
  const site = selectedSite();
  return `
    <section class="screen">
      <div class="screen-head">
        <div>
          <h1>模型列表</h1>
          <p>按统一模型结构展示名称、分组与价格。</p>
        </div>
        <button class="btn" data-action="refresh" ${site ? "" : "disabled"}>${icon("M21 12a9 9 0 0 1-9 9M3 12a9 9 0 0 1 9-9")}刷新</button>
      </div>
      ${renderSitePicker()}
      <div class="list" style="margin-top:12px">
        ${site ? (state.models.length ? state.models.map((model) => `
          <article class="list-card">
            <div class="list-title"><strong>${h(model.name)}</strong><span class="pill ${model.enabled ? "ok" : "warn"}">${model.enabled ? "启用" : "停用"}</span></div>
            <div class="meta">
              <span class="pill">${h(model.provider)}</span>
              <span class="pill">${h(model.group)}</span>
              <span class="pill">输入 ${money(model.inputPrice)}</span>
              <span class="pill">输出 ${money(model.outputPrice)}</span>
            </div>
          </article>
        `).join("") : `<div class="empty">暂无模型数据。</div>`) : ""}
      </div>
    </section>
  `;
}

function renderUsage() {
  const usage = state.usage || {};
  return `
    <section class="screen">
      <div class="screen-head">
        <div>
          <h1>基础用量</h1>
          <p>MVP 展示余额、今日用量、总用量和今日请求数。</p>
        </div>
        <button class="btn" data-action="refresh">${icon("M21 12a9 9 0 0 1-9 9M3 12a9 9 0 0 1 9-9")}刷新</button>
      </div>
      ${renderSitePicker()}
      <div class="grid stats" style="margin-top:12px">
        <article class="card metric"><span>余额</span><strong>${money(usage.balance)}</strong><span>${h(state.sourceRoute || "远端接口")}</span></article>
        <article class="card metric"><span>今日用量</span><strong>${money(usage.usedToday)}</strong><span>当前站点</span></article>
        <article class="card metric"><span>总用量</span><strong>${money(usage.usedTotal)}</strong><span>累计</span></article>
        <article class="card metric"><span>今日请求</span><strong>${money(usage.requestCountToday)}</strong><span>请求数</span></article>
      </div>
    </section>
  `;
}

function renderSettings() {
  return `
    <section class="screen">
      <div class="screen-head">
        <div>
          <h1>设置</h1>
          <p>安全设置与 PWA 状态。</p>
        </div>
      </div>
      <div class="split">
        <form class="form-panel" id="password-form">
          <h2 style="margin:0 0 12px;font-size:20px">修改密码</h2>
          <div class="field"><label for="currentPassword">当前密码</label><input id="currentPassword" name="currentPassword" type="password" autocomplete="current-password" required></div>
          <div class="field"><label for="nextPassword">新密码</label><input id="nextPassword" name="nextPassword" type="password" autocomplete="new-password" minlength="10" required></div>
          <button class="btn primary" type="submit">${icon("M20 6L9 17l-5-5")}保存</button>
        </form>
        <section class="form-panel">
          <h2 style="margin:0 0 12px;font-size:20px">PWA</h2>
          <div class="meta">
            <span class="pill">${navigator.serviceWorker ? "Service Worker 可用" : "Service Worker 不可用"}</span>
            <span class="pill">${window.matchMedia("(display-mode: standalone)").matches ? "独立窗口" : "浏览器窗口"}</span>
            <span class="pill">移动端优先</span>
          </div>
          <p class="muted">iOS Safari 可通过分享菜单添加到主屏幕；Android Chrome 可通过安装提示或菜单安装。</p>
        </section>
      </div>
    </section>
  `;
}

function openModal(content) {
  const modal = document.querySelector("#modal");
  modal.innerHTML = `<div class="modal-box">${content}</div>`;
  modal.classList.add("open");
}

function closeModal() {
  const modal = document.querySelector("#modal");
  if (modal) {
    modal.classList.remove("open");
    modal.innerHTML = "";
  }
}

function siteForm(edit = false) {
  const site = edit ? selectedSite() : {};
  openModal(`
    <h2>${edit ? "编辑站点" : "新增站点"}</h2>
    <form id="site-form" data-edit="${edit ? "1" : "0"}">
      <div class="field"><label for="site-name">站点名称</label><input id="site-name" name="name" value="${h(site.name || "")}" required></div>
      <div class="field"><label for="site-type">站点类型</label><select id="site-type" name="type">
        <option value="newapi" ${site.type === "newapi" ? "selected" : ""}>New API</option>
        <option value="sub2api" ${site.type === "sub2api" ? "selected" : ""}>Sub2API</option>
        <option value="auto">自动识别</option>
      </select></div>
      <div class="field"><label for="base-url">Base URL</label><input id="base-url" name="baseUrl" value="${h(site.baseUrl || "")}" inputmode="url" placeholder="https://api.example.com" required></div>
      <div class="field"><label for="auth-type">授权方式</label><select id="auth-type" name="authType">
        <option value="system-token" ${site.authType === "system-token" ? "selected" : ""}>系统 Token + 用户 ID</option>
        <option value="jwt" ${site.authType === "jwt" ? "selected" : ""}>JWT</option>
        <option value="api-key" ${site.authType === "api-key" ? "selected" : ""}>API Key</option>
        <option value="admin-token" ${site.authType === "admin-token" ? "selected" : ""}>Admin Token</option>
      </select></div>
      <div class="field secret-newapi"><label for="user-id">New API 用户 ID</label><input id="user-id" name="userId" value="${h(site.userId || "")}" autocomplete="off"></div>
      <div class="field secret-newapi"><label for="system-token">New API 系统 Token</label><input id="system-token" name="systemToken" type="password" autocomplete="off" placeholder="${edit ? "留空表示不修改" : "由后端加密保存"}"></div>
      <div class="field secret-sub2api"><label for="jwt">Sub2API JWT</label><input id="jwt" name="jwt" type="password" autocomplete="off" placeholder="${edit ? "留空表示不修改" : "由后端加密保存"}"></div>
      <div class="field secret-sub2api"><label for="apiKey">Sub2API API Key</label><input id="apiKey" name="apiKey" type="password" autocomplete="off" placeholder="${edit ? "留空表示不修改" : "由后端加密保存"}"></div>
      <div class="field secret-sub2api"><label for="adminToken">Sub2API Admin Token</label><input id="adminToken" name="adminToken" type="password" autocomplete="off" placeholder="可选"></div>
      <div class="field"><label for="note">备注</label><textarea id="note" name="note">${h(site.note || "")}</textarea></div>
      <div class="actions">
        <button class="btn primary" type="submit">${icon("M20 6L9 17l-5-5")}保存</button>
        <button class="btn" type="button" data-action="close-modal">取消</button>
      </div>
    </form>
  `);
  updateSecretFields();
}

function keyForm() {
  openModal(`
    <h2>创建 API Key</h2>
    <form id="key-form">
      <div class="field"><label for="key-name">名称</label><input id="key-name" name="name" required></div>
      <div class="field"><label for="key-quota">额度</label><input id="key-quota" name="quota" type="number" min="0" step="1" value="0"></div>
      <div class="field"><label for="key-group">分组</label><input id="key-group" name="group" value="default"></div>
      <div class="field"><label for="key-expires">过期时间</label><input id="key-expires" name="expiresAt" type="datetime-local"></div>
      <div class="actions">
        <button class="btn primary" type="submit">${icon("M12 5v14M5 12h14")}创建</button>
        <button class="btn" type="button" data-action="close-modal">取消</button>
      </div>
    </form>
  `);
}

function onceKeyModal(key) {
  openModal(`
    <h2>创建成功</h2>
    <p class="muted">明文只在本次结果中展示。关闭后请到远端站点重新生成。</p>
    <p class="secret-once">${h(key.plainKey || key.maskedKey || "远端未返回明文 Key")}</p>
    <div class="actions"><button class="btn primary" type="button" data-action="close-modal">${icon("M20 6L9 17l-5-5")}完成</button></div>
  `);
}

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function updateSecretFields() {
  const type = document.querySelector("#site-type")?.value;
  document.querySelectorAll(".secret-newapi").forEach((el) => el.classList.toggle("hidden", type === "sub2api"));
  document.querySelectorAll(".secret-sub2api").forEach((el) => el.classList.toggle("hidden", type === "newapi"));
}

document.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target;
  try {
    if (form.id === "login-form") {
      const data = await api("/api/login", { method: "POST", body: JSON.stringify(formData(form)) });
      state.user = data.user;
      await loadSites();
      await refreshDashboard();
      renderApp();
      toast("登录成功", "ok");
    }

    if (form.id === "site-form") {
      const edit = form.dataset.edit === "1";
      const site = selectedSite();
      const path = edit ? `/api/sites/${site.id}` : "/api/sites";
      const method = edit ? "PUT" : "POST";
      await api(path, { method, body: JSON.stringify(formData(form)) });
      closeModal();
      await loadSites();
      await refreshDashboard();
      renderApp();
      toast("站点已保存", "ok");
    }

    if (form.id === "key-form") {
      const site = selectedSite();
      const data = await api(`/api/sites/${site.id}/keys`, { method: "POST", body: JSON.stringify(formData(form)) });
      await refreshKeys();
      renderApp();
      onceKeyModal(data.key);
    }

    if (form.id === "password-form") {
      await api("/api/password", { method: "PATCH", body: JSON.stringify(formData(form)) });
      form.reset();
      toast("密码已更新", "ok");
    }
  } catch (error) {
    toast(error.message, "danger");
  }
});

document.addEventListener("change", async (event) => {
  if (event.target.id === "site-type") updateSecretFields();
  if (event.target.dataset.action === "select-site") {
    state.selectedSiteId = event.target.value;
    state.keys = [];
    state.models = [];
    state.usage = null;
    try {
      await refreshActive();
    } catch (error) {
      toast(error.message, "danger");
    }
    renderApp();
  }
});

document.addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  if (!button) {
    if (event.target.id === "modal") closeModal();
    return;
  }
  const tab = button.dataset.tab;
  const action = button.dataset.action;
  const selectSiteId = button.dataset.selectSite;
  const deleteKeyId = button.dataset.deleteKey;

  try {
    if (tab) {
      state.active = tab;
      await refreshActive();
      renderApp();
      return;
    }

    if (selectSiteId) {
      state.selectedSiteId = selectSiteId;
      renderApp();
      return;
    }

    if (deleteKeyId) {
      if (!confirm("确定删除这个 API Key？该操作会转发到远端站点。")) return;
      const site = selectedSite();
      await api(`/api/sites/${site.id}/keys/${encodeURIComponent(deleteKeyId)}`, { method: "DELETE" });
      await refreshKeys();
      renderApp();
      toast("Key 已删除", "ok");
      return;
    }

    if (action === "logout") {
      await api("/api/logout", { method: "POST" });
      state.user = null;
      renderLogin();
      return;
    }

    if (action === "refresh") {
      await refreshActive();
      renderApp();
      toast("已刷新", "ok");
      return;
    }

    if (action === "open-site") {
      siteForm(button.dataset.edit === "1");
      return;
    }

    if (action === "open-key") {
      keyForm();
      return;
    }

    if (action === "close-modal") {
      closeModal();
      return;
    }

    if (action === "test-site") {
      const site = selectedSite();
      const result = await api(`/api/sites/${site.id}/test`, { method: "POST" });
      await loadSites();
      renderApp();
      toast(`连接成功：${result.route}`, "ok");
      return;
    }

    if (action === "diagnose-site") {
      const site = selectedSite();
      const data = await api(`/api/sites/${site.id}/diagnostics`);
      renderDiagnostics(data);
      return;
    }

    if (action === "delete-site") {
      const site = selectedSite();
      if (!confirm(`确定删除站点「${site.name}」？后端保存的凭证会一并删除。`)) return;
      await api(`/api/sites/${site.id}`, { method: "DELETE" });
      await loadSites();
      await refreshDashboard();
      renderApp();
      toast("站点已删除", "ok");
    }
  } catch (error) {
    toast(error.message, "danger");
  }
});

boot();
