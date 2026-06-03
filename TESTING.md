# Testing Guide / 测试指南

[English](#english) | [中文](#中文)

## English

This guide is for validating real New API and Sub2API deployments.

### Do Not Share Secrets

Please do not paste these values into issues, chats, screenshots, or pull requests:

- New API system token
- Sub2API JWT
- API Key
- Admin token
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
- API Key list
- Model list
- Usage page

If mock sites work but real sites do not, the issue is likely adapter compatibility or remote-site route differences.

### Real Site Test

For each real site:

1. Add the site with the correct type and credential.
2. Run **Connection Test**.
3. Run **Diagnostics** from the site detail panel.
4. Open Keys, Models, and Usage pages.

### What to Report

When something fails, report:

- Site type: `newapi` or `sub2api`
- Auth type: `system-token`, `jwt`, `api-key`, or `admin-token`
- Whether mock sites work
- Which page failed: Dashboard, Site, Keys, Models, Usage
- The diagnostic result summary:
  - route
  - status code
  - content type
  - JSON top-level keys
  - error message

Example:

```text
Type: newapi
Auth: system-token
Feature: Models
Route: /v1/models
Status: 404
Content-Type: application/json
Keys: success, message
Message: not found
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

这份指南用于协助验证真实 New API 和 Sub2API 部署。

### 不要分享敏感信息

请不要把这些内容发到 issue、聊天、截图或 PR 里：

- New API 系统 Token
- Sub2API JWT
- API Key
- 管理员 Token
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
- API Key 列表
- 模型列表
- 用量页面

如果 mock 站点可用但真实站点不可用，问题大概率在适配器兼容性或真实站点接口路径差异。

### 真实站点测试

对每个真实站点：

1. 使用正确站点类型和凭证添加站点。
2. 执行 **连接测试**。
3. 在站点详情中执行 **诊断**。
4. 分别打开 Keys、模型、用量页面。

### 反馈哪些信息

功能失败时，请反馈：

- 站点类型：`newapi` 或 `sub2api`
- 授权方式：`system-token`、`jwt`、`api-key` 或 `admin-token`
- mock 站点是否可用
- 失败页面：仪表盘、站点、Keys、模型、用量
- 诊断结果摘要：
  - route
  - status code
  - content type
  - JSON 顶层 keys
  - error message

示例：

```text
类型：newapi
授权：system-token
功能：模型
路径：/v1/models
状态：404
Content-Type：application/json
Keys：success, message
Message：not found
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
