# API Hub Mobile User Guide

## 1. Log In

Start the service and open:

```text
http://localhost:4173
```

The default username is `admin`. If `APIHUB_ADMIN_PASSWORD` was not set on first start, read the generated initial password from `data/initial-admin-password.txt`.

After logging in, change the password in Settings and delete the initial password file.

## 2. Add a New API Site

Go to Site Management and tap Add.

Fill in:

- Site name
- Site type: `New API`
- Base URL, for example `https://api.example.com`
- Auth type: `System Token + User ID`
- New API user ID
- New API system token

After saving, run the connection test. The backend injects:

```text
Authorization: Bearer <system-token>
New-Api-User: <user-id>
```

The frontend never stores or displays the plaintext system token.

## 3. Add a Sub2API Site

Go to Site Management and tap Add.

Fill in:

- Site name
- Site type: `Sub2API`
- Base URL
- Auth type: `JWT`, `API Key`, or `Admin Token`
- The matching credential

After saving, run the connection test. The backend injects the configured credential headers.

## 4. Dashboard

The dashboard shows:

- Configured site count
- Recently online site count
- Aggregated balance
- Today's usage and request count
- Per-site status summary

If a remote API is unavailable, the dashboard shows an error summary without exposing credentials.

## 5. API Key Management

Open the Keys page and select a site.

Supported actions:

- List keys / tokens
- Create a key / token
- Delete a key / token

When creating a key, if the remote site returns a plaintext key, the app shows it once in the result modal. After closing it, the frontend no longer keeps the plaintext value.

## 6. Model List

Open the Models page, select a site, and refresh.

Models are normalized into:

- Name
- Provider
- Group
- Input price
- Output price
- Enabled state

## 7. Basic Usage

Open the Usage page, select a site, and refresh.

It shows:

- Balance
- Today's usage
- Total usage
- Today's request count

## 8. PWA Usage

iOS Safari:

1. Open the site.
2. Tap Share.
3. Select Add to Home Screen.

Android Chrome:

1. Open the site.
2. Use the install prompt, or install it from the browser menu.

## 9. Local Mock Sites

For development validation, use:

```text
http://localhost:4173/mock/newapi
http://localhost:4173/mock/sub2api
```

For production deployments, set:

```bash
APIHUB_ENABLE_MOCKS=false
```
