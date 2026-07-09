const fs = require('fs');
const path = require('path');
const { allowMethods, getBearerToken, readJson, sendError, sendJson } = require('./_lib/http');
const { CONFIG } = require('./_lib/config');
const { verifySessionToken } = require('./_lib/session');
const { getGoogleCredentialsStatus } = require('./_lib/googleSheets');

module.exports = async function handler(req, res) {
  if (!allowMethods(req, res, ['POST'])) {
    return;
  }

  try {
    verifySessionToken(getBearerToken(req));

    if (!CONFIG.localCsvFile) {
      sendError(res, 400, new Error('LOCAL_SHEET_CSV_FILE is not configured.'));
      return;
    }

    const body = await readJson(req, { maxBytes: 25 * 1024 * 1024 });
    const csvText = String(body.csvText || '');

    if (!csvText.trim()) {
      sendError(res, 400, new Error('The uploaded CSV is empty.'));
      return;
    }

    if (!csvText.slice(0, 500).includes('phone_digits')) {
      sendError(res, 400, new Error('This CSV does not look like the WhatsApp Chat History export. Expected a phone_digits column.'));
      return;
    }

    fs.mkdirSync(path.dirname(CONFIG.localCsvFile), { recursive: true });
    fs.writeFileSync(CONFIG.localCsvFile, csvText, 'utf8');

    sendJson(res, 200, {
      ok: true,
      filePath: CONFIG.localCsvFile,
      bytes: Buffer.byteLength(csvText, 'utf8'),
      googleCredentials: getGoogleCredentialsStatus(),
    });
  } catch (error) {
    const status = /session|invalid/i.test(error.message || '') ? 401 : 500;
    sendError(res, status, error);
  }
};
