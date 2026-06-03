# Testing Guide / 测试指南

[English](#english) | [中文](#中文)

## English

This guide is for validating real New API and Sub2API deployments.

### Do Not Share Secrets

Please do not paste these values into issues, chats, screenshots, or pull requests:

- New API user access token
- Sub2API Auth Token / JWT
- Sub2API Refresh Token
- Sub2API Cookie
- API Key
- Admin Token
- Passwords
- Full `data/store.json`

### Baseline Test

1. Start the app.
2. Log in as the admin user.
3. Add a local mock New API site:

```text
http://localhost:4173/mock/newapi
```

4. Add a local mock Sub2API site:

```text
http://localhost:4173/mock/sub2api
```

5. Confirm these pages work:

- Dashboard
- Site connection test
- Site diagnostics
- API Key list
- Model list and price labels
- Usage page
- API credential library

If mock sites work but real sites do not, the issue is likely adapter compatibility, permissions, or remote-site route differences.

### Real Site Test

For each real site:

1. Add the site with the correct type and credential.
2. Run **Connection Test**.
3. Run **Diagnostics** from the site detail panel.
4. Open Keys, Models, Usage, and Credentials pages.

### Sub2API Permission Checks

Sub2API deployments expose different information depending on the credential type:

- A normal `API Key` usually validates `/v1/models`, but may not read balance, usage, logs, or account statistics.
- `JWT / Auth Token` usually maps to the original site's `auth_token` in Local Storage and is the preferred credential for user-level information.
- `Refresh Token` is exchanged through `/api/v1/auth/refresh`. If the remote response says `invalid refresh token`, log in to the original Sub2API site again and copy the latest token.
- `Cookie` can be used when the original site relies on a browser session cookie.
- `Admin Token` is mainly for self-hosted deployments that expose admin APIs.

Useful Sub2API diagnostic routes include:

```text
/api/v1/auth/me
/api/v1/user/profile
/api/v1/keys
/api/v1/usage/stats?period=today
/v1/models
```

If `/v1/models` works but usage routes return `401`, the credential can call models but does not have account-level permissions.

### What to Report

When something fails, report:

- Site type: `newapi` or `sub2api`
- Auth type: `system-token`, `jwt`, `api-key`, `admin-token`, `cookie`, or `refresh-token`
- Whether mock sites work
- Which page failed: Dashboard, Site, Keys, Models, Usage, Credentials
- The diagnostic result summary:
  - route
  - status code
  - content type
  - JSON top-level keys
  - error message

Example:

```text
Type: sub2api
Auth: refresh-token
Feature: Usage
Route: /api/v1/usage/stats?period=today
Status: 401
Content-Type: application/json
Keys: code, message
Message: invalid refresh token
```

### Useful Checks

```bash
node --check server.js
node --check public/app.js
```

With Docker Compose:

```bash
docker compose config
docker compose logs -f
```

## 中文

这份指南用于验证真实 New API 和 Sub2API 部署。

### 不要分享敏感信息

请不要把这些内容发到 issue、聊天、截图或 PR 里：

- New API 用户 Access Token
- Sub2API Auth Token / JWT
- Sub2API Refresh Token
- Sub2API Cookie
- API Key
- Admin Token
- 密码
- 完整 `data/store.json`

### 基线测试

1. 启动应用。
2. 使用管理员账号登录。
3. 添加本地 mock New API 站点：

```text
http://localhost:4173/mock/newapi
```

4. 添加本地 mock Sub2API 站点：

```text
http://localhost:4173/mock/sub2api
```

5. 确认这些页面可用：

- 仪表盘
- 站点连接测试
- 站点诊断
- API Key 列表
- 模型列表和价格标签
- 用量页面
- API 凭据库

如果 mock 站点可用但真实站点不可用，问题大概率在适配器兼容性、凭证权限或真实站点接口路径差异。

### 真实站点测试

对每个真实站点：

1. 使用正确站点类型和凭证添加站点。
2. 执行 **连接测试**。
3. 在站点详情中执行 **诊断**。
4. 分别打开 Keys、模型、用量和凭据页面。

### Sub2API 权限检查

Sub2API 不同部署会根据凭证类型开放不同信息：

- 普通 `API Key` 通常可验证 `/v1/models`，但不一定能读取余额、用量、日志或账户统计。
- `JWT / Auth Token` 通常对应原站 Local Storage 里的 `auth_token`，最适合读取用户级信息。
- `Refresh Token` 会通过 `/api/v1/auth/refresh` 换取 access token。如果远端返回 `invalid refresh token`，请重新登录原 Sub2API 站点并复制最新 token。
- `Cookie` 适合原站使用浏览器 Cookie 登录态的场景。
- `Admin Token` 主要用于开放了管理接口的自建部署。

常见可用诊断路径：

```text
/api/v1/auth/me
/api/v1/user/profile
/api/v1/keys
/api/v1/usage/stats?period=today
/v1/models
```

如果 `/v1/models` 可用但用量路径返回 `401`，说明当前凭证可以调用模型，但没有账户级权限。

### 反馈哪些信息

功能失败时，请反馈：

- 站点类型：`newapi` 或 `sub2api`
- 授权方式：`system-token`、`jwt`、`api-key`、`admin-token`、`cookie` 或 `refresh-token`
- mock 站点是否可用
- 失败页面：仪表盘、站点、Keys、模型、用量、凭据
- 诊断结果摘要：
  - route
  - status code
  - content type
  - JSON 顶层 keys
  - error message

示例：

```text
类型：sub2api
授权：refresh-token
功能：用量
路径：/api/v1/usage/stats?period=today
状态：401
Content-Type：application/json
Keys：code, message
Message：invalid refresh token
```

### 常用检查

```bash
node --check server.js
node --check public/app.js
```

使用 Docker Compose 时：

```bash
docker compose config
docker compose logs -f
```
