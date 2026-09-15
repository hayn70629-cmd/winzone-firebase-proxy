# WinZone Firebase RTDB Proxy

A small Node.js proxy for the WinZone HTML app.

## What it does

Browser:
WinZone HTML -> this proxy -> Firebase Realtime Database

The browser sends a Firebase ID token in:
`Authorization: Bearer <ID_TOKEN>`

The proxy forwards that token to Firebase RTDB REST as `access_token`.

## Files

- `server.js` — proxy server
- `package.json` — Node configuration
- `.env.example` — Firebase database URL
- `README.md` — setup

## Deploy

You can deploy this GitHub repository to any Node.js hosting service that supports a public HTTP service.

Set this environment variable:

`FIREBASE_DB_URL=https://winzone-sports-default-rtdb.firebaseio.com`

Start command:

`npm start`

The service must expose port `3000` (or the platform's `PORT`).

## Test

Open the deployed root URL:

`https://YOUR-DOMAIN/`

Expected:

```json
{"ok":true,"service":"WinZone Firebase RTDB Proxy","endpoint":"/api/rtdb"}
```

## API

Example:

`GET /api/rtdb?path=users/example`

Header:

`Authorization: Bearer FIREBASE_ID_TOKEN`

For writes, send JSON body and use PUT/PATCH/POST/DELETE.

## Important

Do not put a Firebase service-account private key into the browser.

This package does not require a Firebase Admin SDK private key.

The existing Firebase Auth ID token is passed through to RTDB.
