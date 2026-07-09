# Valtier WhatsApp Chat Viewer

Standalone web app for Valtier agents to search WhatsApp chat history by client phone number and view the conversation in a WhatsApp-style read-only interface.

This replaces the Google Apps Script deployment with a normal web app that can live in GitHub and be deployed later on Vercel or another Node-capable host.

There are two usable versions:

- Local or backend-hosted app: connects to a local CSV snapshot or private Google Sheets credentials.
- Free GitHub Pages app: runs fully in the browser from `docs/`; it can auto-load a public Sheet, use Google OAuth when configured, or accept a CSV snapshot fallback.

## What It Does

- Login with a private access code.
- Search by full phone, local phone, formatted phone, or digits only.
- Reads the Google Sheet server-side.
- Shows client messages on the left and Valtiera/AI replies on the right.
- Splits rows where `direction = user` into:
  - client bubble from `message`
  - AI bubble from `ai_reply`
- Hides internal CRM/context rows by default.
- Can show internal records with a toggle.

## Connected Sheet

- Google Sheet: `Whatsapp Chat History`
- Sheet ID: `1DYo_vjtkWOQgm9_TmcK4jf0ZR_pYgkkJZELujNDMn-M`
- Tab: `Hoja 1`
- Range: `A1:L`

Expected columns:

```text
phone_digits, phone_local, wa_name, direction, message, ai_reply, timestamp,
LeadScore, LeadCategory, LeadReason, message_es, client_lang
```

## Local Run

1. Copy the environment template:

```bash
cp .env.example .env
```

2. For quick preview, keep:

```bash
DEMO_MODE=true
ACCESS_CODE=test
SESSION_SECRET=local-test-secret
```

3. Start the app:

```bash
npm run dev
```

4. Open:

```text
http://localhost:5174
```

5. Login with the `ACCESS_CODE` from `.env`.

In demo mode, real client numbers will not match. Use this sample phone:

```text
34638771742
```

To search real clients, switch `DEMO_MODE=false` and configure the Google service account variables below.

## Local Snapshot From Google Drive Plugin

Codex can read/export the Sheet through the connected Google Drive plugin, but the standalone web app cannot call Codex plugins at runtime.

For local testing with real data, export the Sheet as CSV and point the app at it:

```bash
DEMO_MODE=false
LOCAL_SHEET_CSV_FILE=/absolute/path/to/whatsapp-chat-history.csv
```

Recommended local path:

```text
data/whatsapp-chat-history.csv
```

The `data/` folder is ignored by Git so private chat history is not pushed to GitHub.

The local web app also has an upload panel when the CSV is missing:

1. Export the Google Sheet tab `Hoja 1` as CSV.
2. In the app, click `Choose CSV`.
3. Select the exported file.
4. Search the phone number again.

The server saves it to the configured `LOCAL_SHEET_CSV_FILE` path.

If you see:

```text
Local Sheet CSV snapshot not found
```

it means `LOCAL_SHEET_CSV_FILE` points to a CSV path that does not exist yet. Create the `data/` folder if needed, then save the exported CSV with the exact filename configured in `.env.local`.

## Live Google Sheet Connection

Use a Google Cloud service account. Do not put credentials in GitHub.

1. Create a Google Cloud service account.
2. Create a JSON key for that service account.
3. Share the `Whatsapp Chat History` Google Sheet with the service account email as a viewer.
4. Set the local environment values.

Simplest local option:

```bash
DEMO_MODE=false
GOOGLE_SERVICE_ACCOUNT_FILE=/absolute/path/to/service-account.json
```

Or use direct environment fields:

```bash
DEMO_MODE=false
GOOGLE_SHEET_ID=1DYo_vjtkWOQgm9_TmcK4jf0ZR_pYgkkJZELujNDMn-M
GOOGLE_SHEET_NAME=Hoja 1
GOOGLE_SHEET_RANGE=A1:L
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Alternative: set the full service account JSON in `GOOGLE_SERVICE_ACCOUNT_JSON` or base64 it into `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64`.

## GitHub

### Free GitHub Pages Deployment

The `docs/` folder contains a static GitHub Pages version. It is safe to publish because it does not include the WhatsApp chat CSV, `.env.local`, or Google credentials.

Current access code:

```text
valtierrealestate2026
```

How agents use it:

1. Open the GitHub Pages link.
2. Enter the access code.
3. The app tries to load the Google Sheet directly.
4. If Google blocks browser access, connect with Google when OAuth is configured, or upload the exported `Whatsapp Chat History - Hoja 1.csv`.
5. Search by full phone number, local phone number, or formatted number.

GitHub Pages settings live in:

```text
docs/config.js
```

Important: the GitHub Pages access code is only a light gate because static website code is public. It is useful for a free prototype, but not strong security.

Direct Google Sheet options on GitHub Pages:

- Public browser read: the Sheet must be public/readable by link. This is not recommended for private WhatsApp history.
- Google OAuth: set `googleOAuthClientId` in `docs/config.js`, enable the Google Sheets API, and add the GitHub Pages URL as an authorized JavaScript origin in Google Cloud.
- Secure backend: deploy the backend version on Vercel or another Node host with service account credentials.

From this folder:

```bash
git init
git add .
git commit -m "Build WhatsApp chat viewer web app"
```

If GitHub CLI is authenticated:

```bash
gh repo create valtier-whatsapp-chat-viewer --public --source=. --remote=origin --push
```

Then enable GitHub Pages from branch `main` and folder `/docs`.

## Vercel Deployment

1. Push this folder to GitHub.
2. Import the repository into Vercel.
3. Set these environment variables in Vercel:
   - `ACCESS_CODE`
   - `SESSION_SECRET`
   - `DEMO_MODE=false`
   - `GOOGLE_SHEET_ID`
   - `GOOGLE_SHEET_NAME`
   - `GOOGLE_SHEET_RANGE`
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `GOOGLE_PRIVATE_KEY`
4. Deploy.

Important: GitHub Pages alone is not enough for the live private Sheet connection because the app needs a secure backend. Vercel, Render, Railway, or another Node host is the right deployment target.

## Security Notes

- Never commit `.env` or service account JSON files.
- The browser never receives Google credentials.
- The shared access code is simple and practical for now.
- A stronger later version can add Google Workspace login and agent-level access logs.

## Checks

Run:

```bash
npm run check
```

This validates JavaScript syntax and the core phone-search transcript logic.
