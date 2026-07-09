# Valtier WhatsApp Chat Viewer

Standalone web app for Valtier agents to search WhatsApp chat history by client phone number and view the conversation in a WhatsApp-style read-only interface.

This replaces the Google Apps Script deployment with a normal web app that can live in GitHub and be deployed later on Vercel or another Node-capable host.

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

## Live Google Sheet Connection

Use a Google Cloud service account. Do not put credentials in GitHub.

1. Create a Google Cloud service account.
2. Create a JSON key for that service account.
3. Share the `Whatsapp Chat History` Google Sheet with the service account email as a viewer.
4. Set:

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

From this folder:

```bash
git init
git add .
git commit -m "Build WhatsApp chat viewer web app"
```

If GitHub CLI is authenticated:

```bash
gh repo create valtier-whatsapp-chat-viewer --private --source=. --remote=origin --push
```

Keep the repo private because this is an internal operations tool.

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
