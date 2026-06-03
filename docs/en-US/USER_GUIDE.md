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
- Auth type:
  - `API Key`
  - `JWT / Auth Token`
  - `Admin Token`
  - `Cookie`
  - `Refresh Token`
- The matching credential value

After saving, run the connection test. The backend injects the configured credential headers.

### Which Sub2API Credential Should I Use?

Sub2API deployments expose different permissions depending on the credential type.

Use `API Key` first when you only need model validation or OpenAI-compatible access. A normal `sk-...` key often works for `/v1/models`, but it usually cannot read account balance, usage logs, today's request count, or backend statistics.

Use `JWT / Auth Token` when you need user-level information. On many Sub2API frontends the token is stored as `auth_token` in the original site's Local Storage:

1. Open the original Sub2API site.
2. Log in there.
3. Open browser developer tools.
4. Go to `Application -> Local Storage`.
5. Select the Sub2API domain.
6. Copy `auth_token`.
7. Paste it into `Sub2API JWT / Auth Token` in API Hub Mobile.

Use `Refresh Token` when the original site stores `refresh_token`. API Hub Mobile exchanges it through `/api/v1/auth/refresh`, uses the returned access token, and encrypts any rotated refresh token returned by the remote site. If the remote site says `invalid refresh token`, log in to the original Sub2API site again and copy the latest `refresh_token`.

Use `Cookie` when the original site relies on cookie sessions. Copy the full cookie string from `Application -> Cookies -> <Sub2API domain>`, for example `session=...; token=...`, and paste it into `Sub2API Cookie`.

Use `Admin Token` only for self-hosted deployments that expose administrative APIs.

Never share plaintext tokens, cookies, or `data/store.json` in screenshots, issues, or chats.

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
- Today's prompt/completion token count
- Recent usage logs when supported by the remote site

For Sub2API, balance and detailed usage require `JWT / Auth Token`, `Refresh Token`, `Cookie`, or `Admin Token`. A normal API Key may only show models and limited key information.

## 8. API Credential Library

Open the Credentials page to store OpenAI-compatible API keys independently from managed sites.

Supported actions:

- Add a credential with a name, provider, Base URL, and API Key
- Test `/v1/models`
- Inspect reachable models and price fields
- Delete the credential

The credential library is useful for validating client-facing keys without mixing them with New API or Sub2API account-management credentials.

## 9. PWA Usage

iOS Safari:

1. Open the site.
2. Tap Share.
3. Select Add to Home Screen.

Android Chrome:

1. Open the site.
2. Use the install prompt, or install it from the browser menu.

## 10. Local Mock Sites

For development validation, use:

```text
http://localhost:4173/mock/newapi
http://localhost:4173/mock/sub2api
```

For production deployments, set:

```bash
APIHUB_ENABLE_MOCKS=false
```
