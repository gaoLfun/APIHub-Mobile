# Deployment Guide / 部署指南

[English](#english) | [中文](#中文)

## English

This guide covers Node.js, Docker, Docker Compose, persistent data, and reverse proxy deployment for API Hub Mobile.

### 1. Requirements

- Docker 24+ and Docker Compose v2, or Node.js 18+
- A persistent data directory or Docker volume
- HTTPS reverse proxy for public access
- Strong admin password and encryption secret

### 2. Docker Compose

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env`:

```dotenv
APIHUB_HOST_PORT=4173
APIHUB_ADMIN_USER=admin
APIHUB_ADMIN_PASSWORD=replace-with-a-strong-password
APIHUB_SECRET=replace-with-a-long-random-secret
APIHUB_COOKIE_SECURE=false
APIHUB_ENABLE_MOCKS=false
```

Start the service:

```bash
docker compose up -d --build
```

Open:

```text
http://localhost:4173
```

View logs:

```bash
docker compose logs -f
```

Stop:

```bash
docker compose down
```

Keep the named volume unless you intentionally want to delete local app data:

```bash
docker volume ls
```

### 3. Docker Image

Build manually:

```bash
docker build -t apihub-mobile:latest .
```

Run manually:

```bash
docker run -d \
  --name apihub-mobile \
  -p 4173:4173 \
  -e APIHUB_ADMIN_USER=admin \
  -e APIHUB_ADMIN_PASSWORD=replace-with-a-strong-password \
  -e APIHUB_SECRET=replace-with-a-long-random-secret \
  -e APIHUB_COOKIE_SECURE=false \
  -e APIHUB_ENABLE_MOCKS=false \
  -v apihub_data:/app/data \
  apihub-mobile:latest
```

### 4. Node.js Runtime

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

### 5. Environment Variables

| Variable | Recommended | Description |
| --- | --- | --- |
| `PORT` | `4173` | HTTP listen port inside the app |
| `APIHUB_HOST_PORT` | `4173` | Host port used by Docker Compose |
| `APIHUB_ADMIN_USER` | `admin` | Admin username |
| `APIHUB_ADMIN_PASSWORD` | Required | Admin login password |
| `APIHUB_SECRET` | Required | Secret used to derive the AES-GCM encryption key |
| `APIHUB_COOKIE_SECURE` | `true` with HTTPS | Adds `Secure` to the session cookie |
| `APIHUB_ENABLE_MOCKS` | `false` in production | Disables local mock remote endpoints |

### 6. Reverse Proxy

Put the app behind Nginx, Caddy, Traefik, or a platform gateway for HTTPS.

Production checklist:

- Serve the public site over HTTPS.
- Set `APIHUB_COOKIE_SECURE=true` when HTTPS is used.
- Do not expose `/app/data` or local `data/` as static files.
- Keep request logs free of credentials.
- Persist and back up `data/store.json` or the Docker volume.
- Keep `APIHUB_SECRET` stable. Changing it will make existing encrypted credentials unreadable.

### 7. Data Files

`data/` or `/app/data` may contain:

- `store.json`: local app data and encrypted credentials
- `secret.key`: generated local encryption key when `APIHUB_SECRET` is not set
- `initial-admin-password.txt`: generated first-run password when `APIHUB_ADMIN_PASSWORD` is not set

Docker Compose requires `APIHUB_ADMIN_PASSWORD` and `APIHUB_SECRET`, so first-run password generation is mainly for direct Node.js use.

Never commit these files.

### 8. Pre-Deployment Checks

```bash
node --check server.js
node --check public/app.js
docker compose config
git status --short --ignored
```

Confirm that `data/`, `verification/`, and real `.env` files are ignored.

## 中文

这份文档说明 API Hub Mobile 的 Node.js、Docker、Docker Compose、持久化数据和反向代理部署方式。

### 1. 运行要求

- Docker 24+ 和 Docker Compose v2，或 Node.js 18+
- 持久化数据目录或 Docker volume
- 公开访问时建议使用 HTTPS 反向代理
- 强管理员密码和加密密钥

### 2. Docker Compose

复制环境变量示例：

```bash
cp .env.example .env
```

编辑 `.env`：

```dotenv
APIHUB_HOST_PORT=4173
APIHUB_ADMIN_USER=admin
APIHUB_ADMIN_PASSWORD=replace-with-a-strong-password
APIHUB_SECRET=replace-with-a-long-random-secret
APIHUB_COOKIE_SECURE=false
APIHUB_ENABLE_MOCKS=false
```

启动服务：

```bash
docker compose up -d --build
```

打开：

```text
http://localhost:4173
```

查看日志：

```bash
docker compose logs -f
```

停止服务：

```bash
docker compose down
```

除非你明确要删除本地应用数据，否则不要删除命名 volume：

```bash
docker volume ls
```

### 3. Docker 镜像

手动构建：

```bash
docker build -t apihub-mobile:latest .
```

手动运行：

```bash
docker run -d \
  --name apihub-mobile \
  -p 4173:4173 \
  -e APIHUB_ADMIN_USER=admin \
  -e APIHUB_ADMIN_PASSWORD=replace-with-a-strong-password \
  -e APIHUB_SECRET=replace-with-a-long-random-secret \
  -e APIHUB_COOKIE_SECURE=false \
  -e APIHUB_ENABLE_MOCKS=false \
  -v apihub_data:/app/data \
  apihub-mobile:latest
```

### 4. Node.js 运行

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

### 5. 环境变量

| 变量 | 建议值 | 说明 |
| --- | --- | --- |
| `PORT` | `4173` | 应用内部 HTTP 监听端口 |
| `APIHUB_HOST_PORT` | `4173` | Docker Compose 映射到宿主机的端口 |
| `APIHUB_ADMIN_USER` | `admin` | 管理员用户名 |
| `APIHUB_ADMIN_PASSWORD` | 必填 | 管理员登录密码 |
| `APIHUB_SECRET` | 必填 | 用于派生 AES-GCM 加密密钥 |
| `APIHUB_COOKIE_SECURE` | HTTPS 下设为 `true` | 为会话 Cookie 添加 `Secure` |
| `APIHUB_ENABLE_MOCKS` | 生产设为 `false` | 关闭本地 mock 远端接口 |

### 6. 反向代理

建议使用 Nginx、Caddy、Traefik 或平台网关提供 HTTPS。

生产检查清单：

- 对外使用 HTTPS。
- 使用 HTTPS 时设置 `APIHUB_COOKIE_SECURE=true`。
- 不要把 `/app/data` 或本地 `data/` 作为静态文件暴露。
- 请求日志不要记录凭证。
- 持久化并备份 `data/store.json` 或 Docker volume。
- 保持 `APIHUB_SECRET` 稳定。更换后，已有加密凭证将无法解密。

### 7. 数据文件

`data/` 或 `/app/data` 可能包含：

- `store.json`：本地应用数据和加密凭证
- `secret.key`：未设置 `APIHUB_SECRET` 时生成的本地加密密钥
- `initial-admin-password.txt`：未设置 `APIHUB_ADMIN_PASSWORD` 时生成的首次登录密码

Docker Compose 会强制要求 `APIHUB_ADMIN_PASSWORD` 和 `APIHUB_SECRET`，所以首次密码文件主要用于直接运行 Node.js 的场景。

不要提交这些文件。

### 8. 部署前检查

```bash
node --check server.js
node --check public/app.js
docker compose config
git status --short --ignored
```

确认 `data/`、`verification/` 和真实 `.env` 文件都被忽略。
