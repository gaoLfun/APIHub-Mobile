# API Hub Mobile 部署指南

## 运行环境

- Node.js 18 或更高版本
- HTTPS 反向代理，生产环境推荐
- 持久化 `data/` 目录

## 环境变量

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `PORT` | 否 | HTTP 监听端口，默认 `4173` |
| `APIHUB_ADMIN_USER` | 否 | 管理员用户名，默认 `admin` |
| `APIHUB_ADMIN_PASSWORD` | 生产建议必填 | 管理员密码。未设置时首次启动会生成随机初始密码 |
| `APIHUB_SECRET` | 生产建议必填 | AES-GCM 主密钥来源。未设置时写入 `data/secret.key` |
| `APIHUB_COOKIE_SECURE` | HTTPS 部署建议 `true` | 为会话 Cookie 添加 `Secure` |
| `APIHUB_ENABLE_MOCKS` | 生产建议 `false` | 是否启用本地 mock 远端接口 |

## 本地运行

```bash
node server.js
```

## 生产运行示例

```bash
PORT=4173 \
APIHUB_ADMIN_USER=admin \
APIHUB_ADMIN_PASSWORD=replace-with-a-strong-password \
APIHUB_SECRET=replace-with-a-long-random-secret \
APIHUB_COOKIE_SECURE=true \
APIHUB_ENABLE_MOCKS=false \
node server.js
```

Windows PowerShell 示例：

```powershell
$env:PORT="4173"
$env:APIHUB_ADMIN_USER="admin"
$env:APIHUB_ADMIN_PASSWORD="replace-with-a-strong-password"
$env:APIHUB_SECRET="replace-with-a-long-random-secret"
$env:APIHUB_COOKIE_SECURE="true"
$env:APIHUB_ENABLE_MOCKS="false"
node server.js
```

## 反向代理建议

生产环境建议通过 Nginx、Caddy、Traefik 或平台网关提供 HTTPS。

需要确保：

- 对外使用 HTTPS
- `APIHUB_COOKIE_SECURE=true`
- `data/` 目录不暴露给静态文件服务
- 不把 `data/`、`.env`、日志中的敏感信息提交到仓库

## 数据目录

`data/` 包含：

- `store.json`：用户、站点配置、加密凭证
- `secret.key`：未设置 `APIHUB_SECRET` 时生成的本地加密密钥
- `initial-admin-password.txt`：首次启动生成的初始密码文件

这些文件不应提交到 GitHub。

## GitHub 提交前检查

```bash
node --check server.js
node --check public/app.js
git status --short --ignored
```

确认 `data/` 和 `verification/` 被忽略。
