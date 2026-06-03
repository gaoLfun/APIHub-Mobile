# API Hub Mobile 使用指南

## 1. 登录管理面板

启动服务后打开：

```text
http://localhost:4173
```

用户名默认为 `admin`。首次启动如果没有设置 `APIHUB_ADMIN_PASSWORD`，请从 `data/initial-admin-password.txt` 读取初始密码。

登录后建议立即进入“设置”页修改密码，并删除初始密码文件。

## 2. 添加 New API 站点

进入“站点管理”，点击“新增”。

填写：

- 站点名称
- 站点类型：`New API`
- Base URL，例如 `https://api.example.com`
- 授权方式：`系统 Token + 用户 ID`
- New API 用户 ID
- New API 系统 Token

保存后点击“测试连接”。后端会在代理请求中注入：

```text
Authorization: Bearer <system-token>
New-Api-User: <user-id>
```

前端不会保存或显示系统 Token 明文。

## 3. 添加 Sub2API 站点

进入“站点管理”，点击“新增”。

填写：

- 站点名称
- 站点类型：`Sub2API`
- Base URL
- 授权方式：`JWT`、`API Key` 或 `Admin Token`
- 对应凭证

保存后点击“测试连接”。后端会根据配置注入授权头。

## 4. 仪表盘

仪表盘展示：

- 已配置站点数量
- 最近连接测试在线数量
- 聚合余额
- 今日用量与请求数
- 每个站点的状态摘要

如果远端接口不可用，仪表盘会显示错误摘要，但不会泄露凭证。

## 5. API Key 管理

进入“Keys”页后选择站点。

支持：

- 查看 Key / Token 列表
- 创建 Key / Token
- 删除 Key / Token

创建 Key 时，如果远端返回明文 Key，应用只在结果弹层展示一次。关闭后前端不再保留明文。

## 6. 模型列表

进入“模型”页后选择站点并刷新。

模型会被转换为统一结构：

- 名称
- 提供方
- 分组
- 输入价格
- 输出价格
- 启用状态

## 7. 基础用量

进入“用量”页后选择站点并刷新。

展示：

- 余额
- 今日用量
- 总用量
- 今日请求数

## 8. PWA 使用

iOS Safari：

1. 打开站点
2. 点击分享按钮
3. 选择“添加到主屏幕”

Android Chrome：

1. 打开站点
2. 使用浏览器安装提示，或从菜单选择安装应用

## 9. 本地 Mock 站点

开发验证时可以使用：

```text
http://localhost:4173/mock/newapi
http://localhost:4173/mock/sub2api
```

生产部署请设置：

```bash
APIHUB_ENABLE_MOCKS=false
```
