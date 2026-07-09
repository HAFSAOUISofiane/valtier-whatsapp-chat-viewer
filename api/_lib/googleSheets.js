const crypto = require('crypto');
const fs = require('fs');
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

  if (CONFIG.localCsvFile) {
    return parseCsv(fs.readFileSync(CONFIG.localCsvFile, 'utf8'));
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
  const jsonFile = process.env.GOOGLE_SERVICE_ACCOUNT_FILE || '';

  if (json || jsonBase64) {
    const parsed = JSON.parse(json || Buffer.from(jsonBase64, 'base64').toString('utf8'));
    return {
      client_email: parsed.client_email,
      private_key: normalizePrivateKey(parsed.private_key),
    };
  }

  if (jsonFile) {
    const parsed = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
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

function getGoogleCredentialsStatus() {
  if (CONFIG.demoMode) {
    return {
      configured: false,
      source: 'demo',
      message: 'Demo mode is active.',
    };
  }

  if (CONFIG.localCsvFile) {
    return {
      configured: fs.existsSync(CONFIG.localCsvFile),
      source: 'LOCAL_SHEET_CSV_FILE',
      message: fs.existsSync(CONFIG.localCsvFile)
        ? 'Local CSV snapshot is configured.'
        : 'LOCAL_SHEET_CSV_FILE points to a file that does not exist.',
    };
  }

  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    return {
      configured: true,
      source: 'GOOGLE_SERVICE_ACCOUNT_JSON',
      message: 'Google service account JSON is configured.',
    };
  }

  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64) {
    return {
      configured: true,
      source: 'GOOGLE_SERVICE_ACCOUNT_JSON_BASE64',
      message: 'Google service account JSON base64 is configured.',
    };
  }

  if (process.env.GOOGLE_SERVICE_ACCOUNT_FILE) {
    return {
      configured: fs.existsSync(process.env.GOOGLE_SERVICE_ACCOUNT_FILE),
      source: 'GOOGLE_SERVICE_ACCOUNT_FILE',
      message: fs.existsSync(process.env.GOOGLE_SERVICE_ACCOUNT_FILE)
        ? 'Google service account file is configured.'
        : 'GOOGLE_SERVICE_ACCOUNT_FILE points to a file that does not exist.',
    };
  }

  if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
    return {
      configured: true,
      source: 'GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY',
      message: 'Google service account email and private key are configured.',
    };
  }

  return {
    configured: false,
    source: '',
    message: 'Missing Google service account credentials.',
  };
}

function parseCsv(csvText) {
  const rows = [];
  let row = [];
  let value = '';
  let inQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index];
    const nextChar = csvText[index + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        value += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        value += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(value);
      value = '';
    } else if (char === '\n') {
      row.push(value);
      rows.push(row);
      row = [];
      value = '';
    } else if (char !== '\r') {
      value += char;
    }
  }

  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }

  return rows.map((csvRow) => csvRow.slice(0, 12));
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
  getGoogleCredentialsStatus,
  readSheetValues,
};
