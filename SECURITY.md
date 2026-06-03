# Security Policy / 安全说明

## English

API Hub Mobile is designed so the frontend never stores remote plaintext credentials.

### Credential Handling

- Admin login uses an HttpOnly cookie session.
- Remote New API / Sub2API credentials are encrypted on the backend with AES-GCM.
- Supported remote credentials include New API access tokens, Sub2API Auth Tokens/JWTs, Refresh Tokens, Cookies, API Keys, and Admin Tokens.
- The frontend does not use `localStorage` or `sessionStorage` for remote secrets.
- Site lists and detail views only expose masked credential previews.
- API keys returned by list endpoints are masked where the remote site supports masking.
- A newly created plaintext key may be shown once if the remote site returns it, then it is discarded from frontend state.
- Sub2API refresh-token exchange is performed on the backend. If the remote site rotates the refresh token, the new value is encrypted and stored on the backend.

### Production Checklist

- Set `APIHUB_ADMIN_PASSWORD`.
- Set a strong `APIHUB_SECRET`.
- Use HTTPS.
- Set `APIHUB_COOKIE_SECURE=true`.
- Set `APIHUB_ENABLE_MOCKS=false`.
- Keep `data/` private and out of Git.
- Avoid logging remote response bodies that may contain secrets.
- Rotate remote site credentials if the server host is compromised.

### Reporting Issues

Do not include plaintext tokens, cookies, complete `data/store.json`, or `.env` files in reports. If this is a private repository, report issues to the repository owner. If it becomes public, add a dedicated security contact or GitHub private vulnerability reporting instructions.

## 中文

API Hub Mobile 的安全边界是：前端不保存远端明文凭证。

### 凭证处理

- 管理员登录使用 HttpOnly Cookie 会话。
- New API / Sub2API 远端凭证在后端使用 AES-GCM 加密。
- 支持的远端凭证包括 New API Access Token、Sub2API Auth Token/JWT、Refresh Token、Cookie、API Key 和 Admin Token。
- 前端不使用 `localStorage` 或 `sessionStorage` 保存远端敏感凭证。
- 站点列表和详情页只展示脱敏后的凭证预览。
- API Key 列表在远端支持时默认脱敏。
- 创建 Key 时，如果远端返回明文，前端只在一次性结果弹层展示，之后丢弃。
- Sub2API refresh token 换 access token 的过程在后端完成。如果远端轮换 refresh token，新值会在后端加密保存。

### 生产检查清单

- 设置 `APIHUB_ADMIN_PASSWORD`。
- 设置强随机 `APIHUB_SECRET`。
- 使用 HTTPS。
- 设置 `APIHUB_COOKIE_SECURE=true`。
- 设置 `APIHUB_ENABLE_MOCKS=false`。
- 保持 `data/` 私有，并确保不提交到 Git。
- 避免记录可能包含敏感信息的远端响应正文。
- 如果服务器主机泄露，请轮换远端站点凭证。

### 漏洞报告

请不要在报告中包含明文 token、Cookie、完整 `data/store.json` 或 `.env` 文件。如果仓库是私有仓库，请联系仓库所有者；如果仓库公开，建议补充专门的安全联系人或启用 GitHub 私密漏洞报告。
