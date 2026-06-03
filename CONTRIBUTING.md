# Contributing / 贡献指南

## English

Thanks for contributing to API Hub Mobile.

### Local Checks

Run these before opening a pull request:

```bash
node --check server.js
node --check public/app.js
git status --short --ignored
```

### Development Notes

- Keep the frontend free of plaintext remote credentials.
- Do not introduce `localStorage` or `sessionStorage` for secrets.
- Keep adapters backend-only.
- Keep UI mobile-first and verify around 390px width.
- Do not commit `data/`, `.env`, logs, or local screenshots.

### Pull Request Summary

Please include:

- What changed
- How it was tested
- Any security impact
- Any adapter compatibility notes

## 中文

感谢参与 API Hub Mobile。

### 本地检查

提交 PR 前请运行：

```bash
node --check server.js
node --check public/app.js
git status --short --ignored
```

### 开发注意事项

- 前端不得保存远端明文凭证。
- 不要用 `localStorage` 或 `sessionStorage` 保存敏感信息。
- 适配器逻辑应保持在后端。
- UI 保持移动端优先，并围绕 390px 宽度验证。
- 不要提交 `data/`、`.env`、日志或本地截图。

### PR 说明建议

请包含：

- 改动内容
- 测试方式
- 安全影响
- 适配器兼容性说明
