# API Hub Mobile Deployment Guide

## Runtime

- Node.js 18 or later
- HTTPS reverse proxy for production
- Persistent `data/` directory

## Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| `PORT` | No | HTTP listen port, default `4173` |
| `APIHUB_ADMIN_USER` | No | Admin username, default `admin` |
| `APIHUB_ADMIN_PASSWORD` | Recommended for production | Admin password. If unset on first start, a random initial password is generated |
| `APIHUB_SECRET` | Recommended for production | Source secret for AES-GCM encryption. If unset, `data/secret.key` is generated |
| `APIHUB_COOKIE_SECURE` | Recommended as `true` for HTTPS | Adds `Secure` to the session cookie |
| `APIHUB_ENABLE_MOCKS` | Recommended as `false` for production | Enables or disables local mock remote APIs |

## Local Run

```bash
node server.js
```

## Production Example

```bash
PORT=4173 \
APIHUB_ADMIN_USER=admin \
APIHUB_ADMIN_PASSWORD=replace-with-a-strong-password \
APIHUB_SECRET=replace-with-a-long-random-secret \
APIHUB_COOKIE_SECURE=true \
APIHUB_ENABLE_MOCKS=false \
node server.js
```

Windows PowerShell example:

```powershell
$env:PORT="4173"
$env:APIHUB_ADMIN_USER="admin"
$env:APIHUB_ADMIN_PASSWORD="replace-with-a-strong-password"
$env:APIHUB_SECRET="replace-with-a-long-random-secret"
$env:APIHUB_COOKIE_SECURE="true"
$env:APIHUB_ENABLE_MOCKS="false"
node server.js
```

## Reverse Proxy Recommendations

For production, serve the app behind Nginx, Caddy, Traefik, or a platform gateway with HTTPS.

Make sure:

- External access uses HTTPS.
- `APIHUB_COOKIE_SECURE=true` is set.
- The `data/` directory is never exposed by static hosting.
- Sensitive files such as `data/`, `.env`, and credential-bearing logs are not committed.

## Data Directory

`data/` contains:

- `store.json`: user, site configuration, and encrypted credentials
- `secret.key`: local encryption key generated when `APIHUB_SECRET` is not set
- `initial-admin-password.txt`: generated initial password file

These files must not be committed to GitHub.

## Pre-Commit Checks

```bash
node --check server.js
node --check public/app.js
git status --short --ignored
```

Confirm that `data/` and `verification/` are ignored.
