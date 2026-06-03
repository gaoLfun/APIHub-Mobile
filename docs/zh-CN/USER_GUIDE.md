# API Hub Mobile 使用指南

## 1. 登录管理面板

启动服务后打开：

```text
http://localhost:4173
```

用户名默认是 `admin`。首次启动如果没有设置 `APIHUB_ADMIN_PASSWORD`，请从下面的文件读取初始密码：

```text
data/initial-admin-password.txt
```

登录后建议立即进入“设置”页修改密码，并删除初始密码文件。

## 2. 添加 New API 站点

进入“站点管理”，点击“新增”。

填写：

- 站点名称
- 站点类型：`New API`
- Base URL，例如 `https://api.example.com`
- 授权方式：`用户 Access Token + 用户 ID`
- New API 用户 ID
- New API 用户 Access Token

保存后点击“测试连接”。后端会在代理请求中注入：

```text
Authorization: Bearer <access-token>
New-API-User: <user-id>
```

前端不会保存或显示 Access Token 明文。注意：这里不是 OpenAI-compatible 客户端使用的 `sk-...` API Key。

## 3. 添加 Sub2API 站点

进入“站点管理”，点击“新增”。

填写：

- 站点名称
- 站点类型：`Sub2API`
- Base URL
- 授权方式：`API Key`、`JWT / Auth Token`、`Admin Token`、`Cookie` 或 `Refresh Token`
- 对应凭证

保存后点击“测试连接”。后端会根据配置注入授权头或 Cookie。

### Sub2API 凭证怎么选

不同 Sub2API 部署暴露的权限不同，建议按下面顺序尝试。

`API Key`：
通常是 `sk-...`，适合测试 `/v1/models` 和 OpenAI-compatible 调用。普通 API Key 往往不能读取余额、使用日志、今日请求、后台统计。

`JWT / Auth Token`：
适合读取当前用户级别的余额、用量、Key 管理信息。很多 Sub2API 前端会把它存成 `auth_token`。

获取方式：

1. 打开原 Sub2API 站点。
2. 在原站登录。
3. 打开浏览器开发者工具。
4. 进入 `Application -> Local Storage`。
5. 选择 Sub2API 域名。
6. 找 `auth_token`。
7. 复制后填入 API Hub Mobile 的 `Sub2API JWT / Auth Token`。

`Refresh Token`：
很多站点会把它存成 `refresh_token`。API Hub Mobile 会调用 `/api/v1/auth/refresh` 换取 access token，并把远端返回的新 refresh token 加密保存。

如果诊断中出现 `invalid refresh token`，说明当前 refresh token 已失效，需要重新登录原 Sub2API 站点，再复制最新的 `refresh_token`。

`Cookie`：
如果原站使用 Cookie 登录态，可以打开 `Application -> Cookies -> <Sub2API 域名>`，复制完整 Cookie 字符串，例如：

```text
session=...; token=...
```

然后填入 `Sub2API Cookie`。

`Admin Token`：
一般只适用于自建部署或开放了管理接口的站点，常见于 `.env`、`docker-compose.yml` 或服务端配置。

不要把明文 token、Cookie 或完整 `data/store.json` 发到 issue、PR、截图或聊天里。

## 4. 站点诊断

进入“站点管理”，选择站点后点击“诊断”。

诊断会显示：

- 可用路径
- 权限不足路径，例如 `401` 或 `403`
- 候选路径 `404`
- 返回结构摘要

对 Sub2API 来说，很多 `404` 只是候选路径不属于该站点，不代表所有功能都失败。重点看“可用路径”和是否存在 `401/403`。如果 `/v1/models` 成功但 `/api/v1/usage/stats` 是 `401`，通常说明当前凭证只能调用模型接口，不能读取用量。

## 5. 仪表盘

仪表盘展示：

- 已配置站点数量
- 最近连接测试在线数量
- 聚合余额
- 今日用量与请求数
- 今日 Token
- 每个站点的状态摘要

如果远端接口不可用，仪表盘会显示错误摘要，但不会泄露凭证。

## 6. API Key 管理

进入“Keys”页后选择站点。

支持：

- 查看 Key / Token 列表
- 创建 Key / Token
- 删除 Key / Token

创建 Key 时，如果远端返回明文 Key，应用只在结果弹层展示一次。关闭后前端不再保留明文。

Sub2API 的创建/删除 Key 可能需要 `JWT / Auth Token`、`Cookie` 或 `Admin Token`。普通 API Key 不一定有管理权限。

## 7. 模型列表

进入“模型”页后选择站点并刷新。

模型会被转换为统一结构：

- 名称
- 提供方
- 分组
- 输入价格
- 输出价格
- 价格来源
- 启用状态

New API 会尽量根据倍率和 quota 单位估算 USD/1K Token；远端直接返回价格字段时优先使用远端字段。

## 8. 基础用量

进入“用量”页后选择站点并刷新。

展示：

- 余额
- 今日用量
- 总用量
- 今日请求数
- 今日输入 / 输出 Token
- 最近使用日志

Sub2API 的余额、日志和今日 Token 依赖远端是否开放用户接口，以及当前凭证是否具备权限。

## 9. API 凭据库

进入“凭据”页，可以独立保存 OpenAI-compatible API Key。

支持：

- 新增凭据：名称、Provider、Base URL、API Key
- 测试 `/v1/models`
- 查看该凭据可访问的模型与价格字段
- 删除凭据

凭据库适合验证客户端用的 API Key，不要和 New API / Sub2API 的站点管理凭证混用。

## 10. PWA 使用

iOS Safari：

1. 打开站点。
2. 点击分享按钮。
3. 选择“添加到主屏幕”。

Android Chrome：

1. 打开站点。
2. 使用浏览器安装提示，或从菜单选择安装应用。

## 11. 本地 Mock 站点

开发验证时可以使用：

```text
http://localhost:4173/mock/newapi
http://localhost:4173/mock/sub2api
```

生产部署请设置：

```bash
APIHUB_ENABLE_MOCKS=false
```
