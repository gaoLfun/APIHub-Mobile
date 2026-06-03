# Security Policy / 安全说明

## English

API Hub Mobile is designed so the frontend never stores remote plaintext credentials.

### Credential Handling

- Admin login uses an HttpOnly cookie session.
- Remote New API / Sub2API credentials are encrypted on the backend with AES-GCM.
- The frontend does not use `localStorage` or `sessionStorage` for secrets.
- API keys returned by list endpoints are masked.
- A newly created plaintext key may be shown once if the remote site returns it, then it is discarded from frontend state.

### Production Checklist

- Set `APIHUB_ADMIN_PASSWORD`.
- Set a strong `APIHUB_SECRET`.
- Use HTTPS.
- Set `APIHUB_COOKIE_SECURE=true`.
- Set `APIHUB_ENABLE_MOCKS=false`.
- Keep `data/` private and out of Git.
- Rotate remote site credentials if the server host is compromised.

### Reporting Issues

If this is a private repository, report issues to the repository owner. If it becomes public, add a dedicated security contact or GitHub private vulnerability reporting instructions.

## 中文

API Hub Mobile 的安全边界是：前端不保存远端明文凭证。

### 凭证处理

- 管理员登录使用 HttpOnly Cookie 会话。
- New API / Sub2API 远端凭证在后端使用 AES-GCM 加密。
- 前端不使用 `localStorage` 或 `sessionStorage` 保存敏感信息。
- API Key 列表默认脱敏。
- 创建 Key 时，如果远端返回明文，前端只在一次性结果弹层展示，之后丢弃。

### 生产检查清单

- 设置 `APIHUB_ADMIN_PASSWORD`。
- 设置强随机 `APIHUB_SECRET`。
- 使用 HTTPS。
- 设置 `APIHUB_COOKIE_SECURE=true`。
- 设置 `APIHUB_ENABLE_MOCKS=false`。
- 保持 `data/` 私有，并确保不提交到 Git。
- 如果服务器主机泄露，请轮换远端站点凭证。

### 漏洞报告

如果仓库是私有仓库，请联系仓库所有者。如果仓库公开，建议补充专门的安全联系人或启用 GitHub 私密漏洞报告。
