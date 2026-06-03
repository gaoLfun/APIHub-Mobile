# References and Compatibility / 参考与兼容项目

## 中文

API Hub Mobile 是独立实现的移动端 Web/PWA。它不是下列项目的 fork，也没有复制它们的源码。文档中的“参考”指产品场景、适配目标和常见接口形态。

### New API

- 项目：New API
- GitHub：https://github.com/QuantumNous/new-api
- 参考点：OpenAI-compatible API 分发、用户 Token、模型、用量和管理面板场景
- 本项目实现：移动端优先站点管理、后端代理注入 `Authorization: Bearer <system-token>` 与 `New-Api-User`、Token/模型/用量统一展示

### Sub2API / simple-one-api

- 项目：simple-one-api / Sub2API 相关生态
- GitHub：https://github.com/fruitbars/simple-one-api
- 参考点：Sub2API 风格的 API Key、模型、用量管理场景
- 本项目实现：Sub2API 站点管理、Auth Token/JWT、API Key、Admin Token、Cookie、Refresh Token 后端保存与代理注入；Refresh Token 换取 access token；Key/模型/用量统一展示

### all-api-hub

- 项目：all-api-hub
- GitHub：https://github.com/qixing-jk/all-api-hub
- 参考点：多账号资产管理、浏览器登录态识别、Sub2API refresh-token 会话、模型价格对比和用量分析场景
- 本项目实现：在 Web/PWA + 自有后端代理模式下实现移动端站点管理、凭证加密保存、Sub2API Auth Token/Cookie/Refresh Token 注入和模型价格展示。本项目不是 all-api-hub 的 fork，也没有复制其源码。

### OpenAI-Compatible API Gateways

- 参考点：常见 `/v1/models` 模型列表接口和 OpenAI-compatible 网关习惯
- 本项目实现：在 New API / Sub2API 适配器中尝试多组候选路径，并转换为统一模型结构

## 兼容范围

API Hub Mobile 当前覆盖这些 MVP 能力：

- 连接测试
- 基础用量摘要
- API Key / Token 列表
- API Key / Token 创建
- API Key / Token 删除
- 模型列表
- 模型价格展示
- 用量日志与今日 Token 统计（取决于远端接口与凭证权限）
- 独立 API 凭据库
- 移动端 PWA 管理界面

不同 New API / Sub2API 部署可能暴露不同版本的接口路径。后端适配器已使用候选路径，但生产使用时仍可能需要在 `server.js` 中调整路由表。

## English

API Hub Mobile is an independently implemented mobile Web/PWA. It is not a fork of the projects below and does not copy their source code. "Referenced" means product scenarios, adapter targets, and common API shapes.

### New API

- Project: New API
- GitHub: https://github.com/QuantumNous/new-api
- Reference points: OpenAI-compatible API distribution, user tokens, models, usage, and management panel scenarios
- API Hub Mobile implementation: mobile-first site management, backend proxy injection for `Authorization: Bearer <system-token>` and `New-Api-User`, unified token/model/usage views

### Sub2API / simple-one-api

- Project: simple-one-api / Sub2API ecosystem
- GitHub: https://github.com/fruitbars/simple-one-api
- Reference points: Sub2API-style API key, model, and usage management
- API Hub Mobile implementation: Sub2API site management, backend storage and proxy injection for Auth Token/JWT, API Key, Admin Token, Cookie, and Refresh Token; refresh-token exchange for access tokens; unified key/model/usage views

### all-api-hub

- Project: all-api-hub
- GitHub: https://github.com/qixing-jk/all-api-hub
- Reference points: multi-account asset management, browser-session detection, Sub2API refresh-token sessions, model price comparison, and usage analytics
- API Hub Mobile implementation: mobile site management, encrypted backend credential storage, Sub2API Auth Token/Cookie/Refresh Token injection, and model price display in a Web/PWA + private backend proxy model. API Hub Mobile is not a fork of all-api-hub and does not copy its source code.

### OpenAI-Compatible API Gateways

- Reference points: common `/v1/models` model-list route and OpenAI-compatible gateway conventions
- API Hub Mobile implementation: adapter candidate routes for New API / Sub2API and normalized model output

## Compatibility Scope

API Hub Mobile currently targets these MVP capabilities:

- Connection test
- Basic usage summary
- API Key / Token list
- API Key / Token creation
- API Key / Token deletion
- Model list
- Model price display
- Usage logs and today's token summary, depending on remote APIs and credential permissions
- Independent API credential library
- Mobile PWA management UI

Different New API / Sub2API deployments may expose different route versions. The backend adapters use candidate routes, but production users may still need to adjust route tables in `server.js`.
