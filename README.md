# API Hub Mobile

[English](README.md) | [中文](README.zh-CN.md)

API Hub Mobile is a mobile-first Web/PWA for managing [New API](https://github.com/QuantumNous/new-api), Sub2API / simple-one-api style services, and OpenAI-compatible API gateways through a private backend proxy.

It is built for users who manage API accounts from a phone: check site health, inspect balance and usage, browse models, and manage API keys without exposing remote credentials in the browser.

## Highlights

- **Mobile-first PWA**: optimized for iOS Safari and Android Chrome, with manifest, service worker, and safe-area layout.
- **New API and Sub2API adapters**: supports site management, connection tests, key/token management, model lists, and basic usage views.
- **Backend credential proxy**: remote tokens, JWTs, API keys, and admin tokens are encrypted on the backend and injected only during proxy requests.
- **No plaintext secrets in frontend storage**: the browser does not store remote credentials in `localStorage` or `sessionStorage`.
- **Single-user admin login**: HttpOnly cookie session, password change, and generated initial password.
- **Local mock endpoints**: built-in New API / Sub2API mock routes for validating adapter behavior.

## What It Can Do

| Area | Implemented |
| --- | --- |
| Authentication | Single-user login, HttpOnly cookie session, password change |
| Site management | Create, edit, delete, enable/disable, connection test |
| New API | System token + user ID proxy injection, token list/create/delete, model list, usage |
| Sub2API | JWT / API Key / Admin Token proxy injection, key list/create/delete, model list, usage |
| Dashboard | Site count, online state, balance, today's usage, request count |
| API keys | Masked list, one-time plaintext create result, delete confirmation |
| Models | Normalized name, provider, group, price, enabled state |
| PWA | Manifest, service worker, mobile navigation, install support |
| Security | AES-GCM encrypted credentials, ignored local data directory, secure-cookie option |

## Quick Start

```bash
node server.js
```

Open:

```text
http://localhost:4173
```

Default username:

```text
admin
```

If `APIHUB_ADMIN_PASSWORD` is not set on first start, the app generates a random initial password and writes it to:

```text
data/initial-admin-password.txt
```

After logging in, change the password in Settings and delete the initial password file.

## Production Example

```bash
APIHUB_ADMIN_USER=admin \
APIHUB_ADMIN_PASSWORD=your-strong-password \
APIHUB_SECRET=your-32-byte-or-longer-secret \
APIHUB_COOKIE_SECURE=true \
APIHUB_ENABLE_MOCKS=false \
node server.js
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for deployment details.

## Architecture

```text
Mobile Browser / PWA
        |
        v
Static Web UI
        |
        v
API Hub Mobile Backend
  - session management
  - encrypted credential storage
  - adapter route mapping
  - credential injection
        |
        v
New API / Sub2API / OpenAI-compatible Gateway
```

## Security Model

- Admin login uses an HttpOnly cookie.
- Site credentials are encrypted with AES-GCM before being written to `data/store.json`.
- The browser receives masked credentials only.
- New API system tokens, Sub2API JWTs, API keys, and admin tokens are never embedded in frontend source code.
- `data/`, `.env*`, logs, and local verification screenshots are ignored by Git.
- Set `APIHUB_COOKIE_SECURE=true` when serving over HTTPS.

See [SECURITY.md](SECURITY.md) for more details.

## References and Compatibility

API Hub Mobile is not a fork of New API or Sub2API and does not copy their source code. It implements a mobile management layer around common use cases and API shapes from:

- [New API](https://github.com/QuantumNous/new-api)
- [Sub2API / simple-one-api](https://github.com/fruitbars/simple-one-api)
- OpenAI-compatible API gateways, including common routes such as `/v1/models`

See [docs/REFERENCES.md](docs/REFERENCES.md) for compatibility notes.

## Documentation

- [Deployment Guide](DEPLOYMENT.md)
- [User Guide](docs/en-US/USER_GUIDE.md)
- [中文说明](README.zh-CN.md)
- [中文使用指南](docs/zh-CN/USER_GUIDE.md)
- [Security Policy](SECURITY.md)
- [Contributing Guide](CONTRIBUTING.md)

## Development Checks

```bash
node --check server.js
node --check public/app.js
```

## License

[MIT](LICENSE)
