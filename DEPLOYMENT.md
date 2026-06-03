# Deployment Guide / 部署指南

[English](#english) | [中文](#中文)

## English

This guide covers a practical production deployment for API Hub Mobile.

### 1. Requirements

- Node.js 18 or later
- A persistent `data/` directory
- HTTPS reverse proxy for public access
- Strong admin password and encryption secret

### 2. Environment Variables

| Variable | Recommended | Description |
| --- | --- | --- |
| `PORT` | `4173` | HTTP listen port |
| `APIHUB_ADMIN_USER` | `admin` | Admin username |
| `APIHUB_ADMIN_PASSWORD` | Required | Admin login password |
| `APIHUB_SECRET` | Required | Secret used to derive the AES-GCM encryption key |
| `APIHUB_COOKIE_SECURE` | `true` with HTTPS | Adds `Secure` to the session cookie |
| `APIHUB_ENABLE_MOCKS` | `false` in production | Disables local mock remote endpoints |

### 3. Start the App

Linux / macOS:

```bash
PORT=4173 \
APIHUB_ADMIN_USER=admin \
APIHUB_ADMIN_PASSWORD=replace-with-a-strong-password \
APIHUB_SECRET=replace-with-a-long-random-secret \
APIHUB_COOKIE_SECURE=true \
APIHUB_ENABLE_MOCKS=false \
node server.js
```

Windows PowerShell:

```powershell
$env:PORT="4173"
$env:APIHUB_ADMIN_USER="admin"
$env:APIHUB_ADMIN_PASSWORD="replace-with-a-strong-password"
$env:APIHUB_SECRET="replace-with-a-long-random-secret"
$env:APIHUB_COOKIE_SECURE="true"
$env:APIHUB_ENABLE_MOCKS="false"
node server.js
```

### 4. Reverse Proxy

Put the app behind Nginx, Caddy, Traefik, or a platform gateway.

Production checklist:

- Serve the public site over HTTPS.
- Set `APIHUB_COOKIE_SECURE=true`.
- Do not expose `data/` as static files.
- Keep request logs free of credentials.
- Persist and back up `data/store.json`.
- Keep `APIHUB_SECRET` stable. Changing it will make existing encrypted credentials unreadable.

### 5. Data Files

`data/` may contain:

- `store.json`: local app data and encrypted credentials
- `secret.key`: generated local encryption key when `APIHUB_SECRET` is not set
- `initial-admin-password.txt`: generated first-run password when `APIHUB_ADMIN_PASSWORD` is not set

Never commit these files.

### 6. Pre-Deployment Checks

```bash
node --check server.js
node --check public/app.js
git status --short --ignored
```

Confirm that `data/` and `verification/` are ignored.

## 中文

这份文档用于说明 API Hub Mobile 的生产部署方式。

### 1. 运行要求

- Node.js 18 或更高版本
- 持久化 `data/` 目录
- 公开访问时建议使用 HTTPS 反向代理
- 强管理员密码和加密密钥

### 2. 环境变量

| 变量 | 建议值 | 说明 |
| --- | --- | --- |
| `PORT` | `4173` | HTTP 监听端口 |
| `APIHUB_ADMIN_USER` | `admin` | 管理员用户名 |
| `APIHUB_ADMIN_PASSWORD` | 必填 | 管理员登录密码 |
| `APIHUB_SECRET` | 必填 | 用于派生 AES-GCM 加密密钥 |
| `APIHUB_COOKIE_SECURE` | HTTPS 下设为 `true` | 为会话 Cookie 添加 `Secure` |
| `APIHUB_ENABLE_MOCKS` | 生产设为 `false` | 关闭本地 mock 远端接口 |

### 3. 启动应用

Linux / macOS：

```bash
PORT=4173 \
APIHUB_ADMIN_USER=admin \
APIHUB_ADMIN_PASSWORD=replace-with-a-strong-password \
APIHUB_SECRET=replace-with-a-long-random-secret \
APIHUB_COOKIE_SECURE=true \
APIHUB_ENABLE_MOCKS=false \
node server.js
```

Windows PowerShell：

```powershell
$env:PORT="4173"
$env:APIHUB_ADMIN_USER="admin"
$env:APIHUB_ADMIN_PASSWORD="replace-with-a-strong-password"
$env:APIHUB_SECRET="replace-with-a-long-random-secret"
$env:APIHUB_COOKIE_SECURE="true"
$env:APIHUB_ENABLE_MOCKS="false"
node server.js
```

### 4. 反向代理

建议使用 Nginx、Caddy、Traefik 或平台网关提供 HTTPS。

生产检查清单：

- 对外使用 HTTPS。
- 设置 `APIHUB_COOKIE_SECURE=true`。
- 不要把 `data/` 作为静态文件暴露。
- 请求日志不要记录凭证。
- 持久化并备份 `data/store.json`。
- 保持 `APIHUB_SECRET` 稳定。更换后，已有加密凭证将无法解密。

### 5. 数据文件

`data/` 可能包含：

- `store.json`：本地应用数据和加密凭证
- `secret.key`：未设置 `APIHUB_SECRET` 时生成的本地加密密钥
- `initial-admin-password.txt`：未设置 `APIHUB_ADMIN_PASSWORD` 时生成的首次登录密码

不要提交这些文件。

### 6. 部署前检查

```bash
node --check server.js
node --check public/app.js
git status --short --ignored
```

确认 `data/` 和 `verification/` 被忽略。
