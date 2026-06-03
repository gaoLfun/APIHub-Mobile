# API Hub Mobile

[English](README.md) | [中文](README.zh-CN.md)

API Hub Mobile 是一个移动端优先的 Web/PWA，用于通过自有后端代理管理 [New API](https://github.com/QuantumNous/new-api)、Sub2API / simple-one-api 风格服务，以及 OpenAI-compatible API 网关。

它面向经常在手机上管理 API 账号的用户：查看站点健康状态、余额和用量，浏览模型列表，管理 API Key，同时避免远端凭证暴露在浏览器端。

## 项目亮点

- **移动端优先 PWA**：适配 iOS Safari 和 Android Chrome，包含 manifest、service worker 和安全区布局。
- **New API 与 Sub2API 双适配**：支持站点管理、连接测试、Key/Token 管理、模型列表和基础用量。
- **后端凭证代理**：远端 Token、JWT、API Key、管理员 Token 只在后端加密保存，并在代理请求时注入。
- **前端不保存明文凭证**：浏览器不使用 `localStorage` 或 `sessionStorage` 保存远端敏感信息。
- **单用户管理登录**：HttpOnly Cookie 会话、修改密码、随机初始密码。
- **支持 Docker Compose**：通过持久化数据卷和环境变量密钥运行应用。

## 截图

| iOS Safari 390px | Android Chrome 412px |
| --- | --- |
| ![API Hub Mobile 在 iOS Safari 390px 下的仪表盘](docs/assets/ios-safari-390.png) | ![API Hub Mobile 在 Android Chrome 412px 下的模型页](docs/assets/android-chrome-412.png) |

## 已实现功能

| 模块 | 已实现 |
| --- | --- |
| 登录认证 | 单用户登录、HttpOnly Cookie 会话、修改密码 |
| 站点管理 | 新增、编辑、删除、启用/停用、连接测试 |
| New API | 系统 Token + 用户 ID 代理注入、Token 列表/创建/删除、模型、用量 |
| Sub2API | JWT / API Key / Admin Token 代理注入、Key 列表/创建/删除、模型、用量 |
| 仪表盘 | 站点数量、在线状态、余额、今日用量、请求数 |
| API Key | 脱敏列表、创建结果一次性展示、删除确认 |
| 模型列表 | 统一展示名称、供应商、分组、价格、启用状态 |
| PWA | manifest、service worker、移动底部导航、安装支持 |
| 安全 | AES-GCM 加密凭证、本地数据目录忽略、Secure Cookie 选项 |
| 部署 | Node.js 运行、Docker 镜像、Docker Compose |

## 快速开始

### Docker Compose

```bash
cp .env.example .env
```

编辑 `.env` 后运行：

```bash
docker compose up -d --build
```

打开：

```text
http://localhost:4173
```

### Node.js

```bash
node server.js
```

首次启动如果没有设置 `APIHUB_ADMIN_PASSWORD`，系统会生成随机初始密码并写入：

```text
data/initial-admin-password.txt
```

使用 Docker Compose 时，请在 `.env` 中设置 `APIHUB_ADMIN_PASSWORD` 和 `APIHUB_SECRET`；compose 文件会强制要求这两个值。

## 生产环境示例

```bash
APIHUB_ADMIN_USER=admin \
APIHUB_ADMIN_PASSWORD=your-strong-password \
APIHUB_SECRET=your-32-byte-or-longer-secret \
APIHUB_COOKIE_SECURE=true \
APIHUB_ENABLE_MOCKS=false \
node server.js
```

Docker、Compose 与反向代理部署细节见 [DEPLOYMENT.md](DEPLOYMENT.md)。

## 架构

```text
手机浏览器 / PWA
        |
        v
静态 Web 前端
        |
        v
API Hub Mobile 后端
  - 会话管理
  - 加密保存凭证
  - 适配器路由映射
  - 代理请求注入凭证
        |
        v
New API / Sub2API / OpenAI-compatible Gateway
```

## 安全模型

- 管理登录使用 HttpOnly Cookie。
- 站点凭证先用 AES-GCM 加密，再写入 `data/store.json`。
- 浏览器只接收脱敏后的凭证信息。
- New API 系统 Token、Sub2API JWT、API Key、管理员 Token 不会写入前端源码。
- `data/`、`.env*`、日志和本地验证截图都被 Git 忽略。
- HTTPS 部署时请设置 `APIHUB_COOKIE_SECURE=true`。

更多信息见 [SECURITY.md](SECURITY.md)。

## 参考与兼容项目

API Hub Mobile 不是 New API 或 Sub2API 的 fork，也没有复制它们的源码。本项目围绕以下项目/生态中的常见场景和接口形态实现移动端管理层：

- [New API](https://github.com/QuantumNous/new-api)
- [Sub2API / simple-one-api](https://github.com/fruitbars/simple-one-api)
- OpenAI-compatible API 网关，包括 `/v1/models` 等常见接口

兼容性说明见 [docs/REFERENCES.md](docs/REFERENCES.md)。

## 文档

- [部署指南](DEPLOYMENT.md)
- [中文使用指南](docs/zh-CN/USER_GUIDE.md)
- [English README](README.md)
- [English User Guide](docs/en-US/USER_GUIDE.md)
- [安全说明](SECURITY.md)
- [贡献指南](CONTRIBUTING.md)

## 开发检查

```bash
node --check server.js
node --check public/app.js
```

## 许可证

[MIT](LICENSE)
