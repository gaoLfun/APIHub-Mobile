# API Hub Mobile

[English](README.md) | [中文](README.zh-CN.md)

API Hub Mobile 是一个移动端优先的 Web/PWA，用于通过自有后端代理管理 [New API](https://github.com/QuantumNous/new-api)、Sub2API / simple-one-api 风格服务，以及 OpenAI-compatible API 网关。

它面向经常在手机上管理 API 账号的用户：查看站点健康状态、余额和用量，浏览模型与价格，管理 API Key，同时避免远端凭证明文暴露在浏览器端。

## 项目亮点

- **移动端优先 PWA**：适配 iOS Safari 和 Android Chrome，包含 manifest、service worker、安全区布局和底部导航。
- **New API 与 Sub2API 双适配**：支持站点管理、自动识别、连接测试、Key/Token 管理、模型列表、价格展示、基础用量和可用日志。
- **后端凭证代理**：远端 Access Token、JWT/Auth Token、Refresh Token、Cookie、API Key、Admin Token 只在后端加密保存，并在代理请求时注入。
- **前端不保存明文凭证**：浏览器不会把远端敏感凭证写入 `localStorage` 或 `sessionStorage`。
- **单用户管理登录**：HttpOnly Cookie 会话、修改密码、首次随机密码。
- **API 凭据库**：单独保存 OpenAI-compatible API Key，用于模型验证和后续客户端配置导出。
- **支持 Docker Compose**：通过持久化数据卷和环境变量密钥运行应用。

## 截图

| iOS Safari 390px | Android Chrome 412px |
| --- | --- |
| ![API Hub Mobile dashboard on iOS Safari 390px](docs/assets/ios-safari-390.png) | ![API Hub Mobile models page on Android Chrome 412px](docs/assets/android-chrome-412.png) |

## 已实现功能

| 模块 | 已实现 |
| --- | --- |
| 登录认证 | 单用户登录、HttpOnly Cookie 会话、修改密码 |
| 站点管理 | 新增、编辑、删除、启用/停用、自动识别、连接测试、诊断 |
| New API | 用户 Access Token + 用户 ID 代理注入、Token 列表/创建/删除、模型、余额、用量、使用日志 |
| Sub2API | Auth Token/JWT、API Key、Admin Token、Cookie、Refresh Token 代理注入；Key 列表/创建/删除、模型、具备权限时展示余额和用量 |
| 仪表盘 | 站点数量、在线状态、余额、今日用量、今日请求数、今日 Token |
| API Key | 脱敏列表、创建结果一次性展示、删除确认 |
| API 凭据库 | 独立保存 OpenAI-compatible API Key，测试 `/v1/models`，查看可访问模型 |
| 模型列表 | 统一展示名称、供应商、分组、输入/输出价格、价格来源、启用状态 |
| 用量 | 余额、今日用量、总用量、今日请求、今日输入/输出 Token、最近使用日志 |
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

## 凭证说明

### New API

New API 站点请填写远端站点里的用户 Access Token 和用户 ID。这里不是 OpenAI-compatible 客户端使用的 `sk-...` API Key。

### Sub2API

不同 Sub2API 部署差异较大。建议先使用权限最小的凭证，功能不足时再补更高权限：

- `API Key`：通常可用于 `/v1/models` 和 OpenAI-compatible 调用，但往往不能读取余额、日志和账户统计。
- `Auth Token / JWT`：原 Sub2API 前端登录后保存的访问令牌，常见字段名是 `auth_token`。它最适合读取用户级余额、用量和 Key 管理接口。
- `Refresh Token`：常见字段名是 `refresh_token`。API Hub Mobile 会通过 `/api/v1/auth/refresh` 换取 access token，并把远端返回的新 refresh token 加密保存。
- `Cookie`：如果远端使用 Cookie 登录态，可以从原 Sub2API 站点登录后的浏览器 Cookie 中复制完整字符串。
- `Admin Token`：仅用于开放了管理接口的自建部署。

不要在 issue、PR、截图或聊天中泄露明文 token、Cookie 或完整 `data/store.json`。

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
- 浏览器只接收脱敏后的凭证状态。
- New API Access Token、Sub2API Auth Token/JWT、Refresh Token、Cookie、API Key、Admin Token 不会写入前端源码。
- `data/`、`.env*`、日志和本地验证截图都被 Git 忽略。
- HTTPS 部署时请设置 `APIHUB_COOKIE_SECURE=true`。

更多信息见 [SECURITY.md](SECURITY.md)。

## 免责声明

API Hub Mobile 是一个独立开源项目，不隶属于 New API、Sub2API、simple-one-api、all-api-hub、OpenAI 或本仓库提到的任何 API 服务提供商，也不代表这些项目或服务的官方立场。

本项目仅用于学习、自托管和合法的 API 账号管理。你需要自行遵守所连接远端服务的服务条款、安全策略、额度规则和所在地法律法规。因部署不当、凭证泄露、违规使用、远端服务变更、计费争议或数据丢失造成的后果，项目维护者不承担责任。

## 参考与兼容项目

API Hub Mobile 不是 New API 或 Sub2API 的 fork，也没有复制它们的源码。本项目围绕以下项目/生态中的常见场景和接口形态实现移动端管理层：

- [New API](https://github.com/QuantumNous/new-api)
- [Sub2API / simple-one-api](https://github.com/fruitbars/simple-one-api)
- [all-api-hub](https://github.com/qixing-jk/all-api-hub)
- OpenAI-compatible API 网关，包括 `/v1/models` 等常见接口

兼容性说明见 [docs/REFERENCES.md](docs/REFERENCES.md)。

## 鸣谢

感谢以下开源项目和社区为 API Hub Mobile 提供接口形态、产品思路和生态参考：

- [New API](https://github.com/QuantumNous/new-api)：提供了 OpenAI-compatible 分发、用户 Token、模型、用量和管理面板等典型场景参考。
- [simple-one-api / Sub2API 生态](https://github.com/fruitbars/simple-one-api)：提供了 Sub2API 风格的 API Key、模型、额度和用量管理形态参考。
- [all-api-hub](https://github.com/qixing-jk/all-api-hub)：提供了多账号资产管理、模型对比、浏览器登录态识别和用量分析等产品思路参考。
- OpenAI-compatible 网关和 API 管理工具生态：提供了 `/v1/models`、Key 管理、模型展示和用量统计等通用约定参考。

API Hub Mobile 仅参考上述项目的公开行为、接口形态和产品思路，没有内置或复制它们的源码。

## 文档

- [部署指南](DEPLOYMENT.md)
- [中文使用指南](docs/zh-CN/USER_GUIDE.md)
- [测试指南](TESTING.md)
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
