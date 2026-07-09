const crypto = require('crypto');
const { CONFIG } = require('./config');

let cachedAccessToken = null;
let cachedAccessTokenExpiresAt = 0;

const DEMO_VALUES = [
  ['phone_digits', 'phone_local', 'wa_name', 'direction', 'message', 'ai_reply', 'timestamp', 'LeadScore', 'LeadCategory', 'LeadReason', 'message_es', 'client_lang'],
  ['34638771742', '638771742', 'Pablo terol', 'assistant', '', 'Buenas tardes Pablo,\n\nSoy Valtiera, asistente virtual de Valtier Real Estate.\n\nTe contactamos porque recibimos tu solicitud de informacion sobre esta vivienda:\n\nReferencia: 3580\nLink: https://www.valtier.es/es/inmueble/ref-3580', '2026-06-29T12:58:58.892+02:00', '10', 'To be qualified', '', '', ''],
  ['34638771742', '638771742', 'VALTIER RE', 'user', 'Si me interesa', 'Perfecto. Para preparar la solicitud, confirmame fecha de entrada, duracion, numero de personas y mascota.', '2026-06-30T15:09:24.657+02:00', '95', 'HOT', '', '', ''],
  ['34638771742', '638771742', 'VALTIER RE', 'user', '15 julio, larga estancia, 3, no mascotas', 'Perfecto, gracias. Para terminar dime situacion laboral y preferencia de contacto.', '2026-06-30T15:21:45.734+02:00', '98', 'HOT', '', '', ''],
  ['34638771742', '638771742', 'Pablo terol', 'assistant', '', 'Contexto interno: solicitud activa 52909 para ref. 3580.', '2026-06-30T15:24:22.298+02:00', '99', 'HOT', '', '', ''],
];

async function readSheetValues() {
  if (CONFIG.demoMode) {
    return DEMO_VALUES;
  }

  const accessToken = await getGoogleAccessToken();
  const range = quoteSheetName(CONFIG.sheetName) + '!' + CONFIG.sheetRange;
  const url = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.sheetId}/values/${encodeURIComponent(range)}`);
  url.searchParams.set('majorDimension', 'ROWS');
  url.searchParams.set('valueRenderOption', 'FORMATTED_VALUE');

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    const message = data && data.error && data.error.message
      ? data.error.message
      : `Google Sheets API error: ${response.status}`;
    throw new Error(message);
  }

  return data.values || [];
}

async function getGoogleAccessToken() {
  const now = Math.floor(Date.now() / 1000);

  if (cachedAccessToken && cachedAccessTokenExpiresAt - 60 > now) {
    return cachedAccessToken;
  }

  const serviceAccount = getServiceAccount();
  const assertion = createJwtAssertion(serviceAccount, now);
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  const data = await response.json();

  if (!response.ok) {
    const message = data && data.error_description
      ? data.error_description
      : `Google OAuth error: ${response.status}`;
    throw new Error(message);
  }

  cachedAccessToken = data.access_token;
  cachedAccessTokenExpiresAt = now + Number(data.expires_in || 3600);

  return cachedAccessToken;
}

function getServiceAccount() {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '';
  const jsonBase64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 || '';

  if (json || jsonBase64) {
    const parsed = JSON.parse(json || Buffer.from(jsonBase64, 'base64').toString('utf8'));
    return {
      client_email: parsed.client_email,
      private_key: normalizePrivateKey(parsed.private_key),
    };
  }

  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    throw new Error('Missing Google service account credentials. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY, or enable DEMO_MODE=true.');
  }

  return {
    client_email: clientEmail,
    private_key: normalizePrivateKey(privateKey),
  };
}

function createJwtAssertion(serviceAccount, now) {
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };
  const unsignedToken = [
    base64Url(JSON.stringify(header)),
    base64Url(JSON.stringify(payload)),
  ].join('.');
  const signature = crypto
    .createSign('RSA-SHA256')
    .update(unsignedToken)
    .sign(serviceAccount.private_key);

  return `${unsignedToken}.${base64Url(signature)}`;
}

function normalizePrivateKey(privateKey) {
  return String(privateKey || '').replace(/\\n/g, '\n');
}

function base64Url(input) {
  return Buffer
    .from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function quoteSheetName(sheetName) {
  return `'${String(sheetName || '').replace(/'/g, "''")}'`;
}

module.exports = {
  readSheetValues,
};
