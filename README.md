# API Hub Mobile

Mobile-first Web/PWA for New API and Sub2API account management, API key management, model list browsing, basic usage dashboards, and secure backend credential proxying.

移动端优先的 New API / Sub2API 管理面板，支持 API Key 管理、模型列表、基础用量仪表盘，以及后端代理加密保存和注入凭证。

[中文](#中文) | [English](#english)

Search keywords: `New API mobile`, `Sub2API mobile`, `API Hub Mobile`, `API key manager`, `API token manager`, `OpenAI compatible gateway`, `PWA API dashboard`, `backend credential proxy`, `New API PWA`, `Sub2API PWA`.

## 中文

API Hub Mobile 是一个移动端优先的 Web/PWA，用于通过自有后端代理统一管理 New API 与 Sub2API 站点。前端只访问本地后端；远端系统访问令牌、JWT、API Key 和管理员令牌只保存在后端，并以 AES-GCM 加密。

### 已实现功能

| 模块 | 功能 |
| --- | --- |
| 登录与会话 | 单用户登录、HttpOnly Cookie、修改密码、随机初始密码 |
| 站点管理 | 新增、编辑、删除、启用状态、连接测试、失败状态记录 |
| New API 适配 | 系统 Token + 用户 ID 代理注入、Token 列表、创建、删除、模型、用量 |
| Sub2API 适配 | JWT / API Key / Admin Token 代理注入、Key 列表、创建、删除、模型、用量 |
| 仪表盘 | 站点数量、在线状态、余额、今日用量、请求数 |
| API Key 管理 | 脱敏列表、创建结果一次性展示、危险删除确认 |
| 模型列表 | 统一模型结构、供应商、分组、输入/输出价格、启用状态 |
| PWA | manifest、service worker、iOS Safari / Android Chrome 移动布局 |
| 安全 | AES-GCM 后端加密、前端不保存明文凭证、不使用 localStorage/sessionStorage 保存敏感信息 |
| 开发验证 | 本地 mock New API / Sub2API 远端接口 |

### 参考与兼容项目

本项目不是 New API 或 Sub2API 的 fork，也没有复制它们的源码。实现时参考了这些项目/生态的使用场景和接口风格：

- [New API](https://github.com/QuantumNous/new-api)：OpenAI API 分发与管理面板，本项目提供移动端优先的站点管理和用户侧 Token/模型/用量视图。
- [Sub2API / simple-one-api](https://github.com/fruitbars/simple-one-api)：Sub2API 相关的 API Key 与模型管理场景，本项目提供后端代理适配与移动端 PWA 管理界面。
- OpenAI-compatible API gateways：兼容 `/v1/models` 等常见 OpenAI-compatible 网关接口，便于展示模型列表。

详细说明见：[References and Compatibility](docs/REFERENCES.md)。

### 快速启动

```bash
node server.js
```

默认地址：`http://localhost:4173`

默认用户名：`admin`

首次启动如果没有设置 `APIHUB_ADMIN_PASSWORD`，系统会生成随机初始密码并写入：

```text
data/initial-admin-password.txt
```

登录后请在设置页修改密码，并删除初始密码文件。

### 生产环境建议

```bash
APIHUB_ADMIN_USER=admin
APIHUB_ADMIN_PASSWORD=your-strong-password
APIHUB_SECRET=your-32-byte-or-longer-secret
APIHUB_COOKIE_SECURE=true
APIHUB_ENABLE_MOCKS=false
node server.js
```

### 让项目更容易被搜索到

发布到 GitHub 后，建议在仓库 Topics 中添加：

```text
new-api
sub2api
api-key-manager
api-token-manager
pwa
mobile-first
openai-compatible
api-gateway
credential-proxy
dashboard
```

如果部署公开演示站点，建议保留 `public/index.html` 中的 SEO meta 标签，并把仓库 URL、演示 URL 写入 GitHub About 区域。

更多说明：

- [中文使用指南](docs/zh-CN/USER_GUIDE.md)
- [中文部署指南](docs/zh-CN/DEPLOYMENT.md)
- [安全说明](SECURITY.md)
- [参考与兼容项目](docs/REFERENCES.md)

## English

API Hub Mobile is a mobile-first Web/PWA for managing New API and Sub2API sites through a private backend proxy. The browser only talks to the local backend. Remote system tokens, JWTs, API keys, and admin tokens are stored on the backend and encrypted with AES-GCM.

### Implemented Features

| Area | Features |
| --- | --- |
| Login and sessions | Single-user login, HttpOnly cookie, password change, random initial password |
| Site management | Create, edit, delete, enabled state, connection test, failed-state recording |
| New API adapter | System token + user ID proxy injection, token list, create, delete, models, usage |
| Sub2API adapter | JWT / API Key / Admin Token proxy injection, key list, create, delete, models, usage |
| Dashboard | Site count, online state, balance, today's usage, request count |
| API key management | Masked list, one-time create result display, delete confirmation |
| Model list | Normalized model structure, provider, group, input/output price, enabled state |
| PWA | Manifest, service worker, iOS Safari / Android Chrome mobile layout |
| Security | AES-GCM backend encryption, no plaintext remote credentials in frontend storage, no localStorage/sessionStorage for secrets |
| Development validation | Local mock New API / Sub2API remote endpoints |

### Referenced and Compatible Projects

This project is not a fork of New API or Sub2API and does not copy their source code. It references their use cases and common API patterns:

- [New API](https://github.com/QuantumNous/new-api): an OpenAI API distribution and management panel. API Hub Mobile adds a mobile-first site management and user-side token/model/usage experience.
- [Sub2API / simple-one-api](https://github.com/fruitbars/simple-one-api): Sub2API API key and model management scenarios. API Hub Mobile adds backend proxy adapters and a mobile PWA management UI.
- OpenAI-compatible API gateways: supports common gateway routes such as `/v1/models` for model list display.

See also: [References and Compatibility](docs/REFERENCES.md).

### Quick Start

```bash
node server.js
```

Default URL: `http://localhost:4173`

Default username: `admin`

If `APIHUB_ADMIN_PASSWORD` is not set on first start, the app generates a random initial password and writes it to:

```text
data/initial-admin-password.txt
```

After logging in, change the password in Settings and delete the initial password file.

### Production Recommendation

```bash
APIHUB_ADMIN_USER=admin
APIHUB_ADMIN_PASSWORD=your-strong-password
APIHUB_SECRET=your-32-byte-or-longer-secret
APIHUB_COOKIE_SECURE=true
APIHUB_ENABLE_MOCKS=false
node server.js
```

### Make the Project Discoverable

After publishing to GitHub, add these repository topics:

```text
new-api
sub2api
api-key-manager
api-token-manager
pwa
mobile-first
openai-compatible
api-gateway
credential-proxy
dashboard
```

If you deploy a public demo, keep the SEO meta tags in `public/index.html`, and add the repository URL and demo URL to the GitHub About section.

More documentation:

- [English user guide](docs/en-US/USER_GUIDE.md)
- [English deployment guide](docs/en-US/DEPLOYMENT.md)
- [Security policy](SECURITY.md)
- [References and compatibility](docs/REFERENCES.md)
