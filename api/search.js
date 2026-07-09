const { allowMethods, getBearerToken, readJson, sendError, sendJson } = require('./_lib/http');
const { verifySessionToken } = require('./_lib/session');
const { readSheetValues } = require('./_lib/googleSheets');
const { buildChatResult } = require('./_lib/chat');

module.exports = async function handler(req, res) {
  if (!allowMethods(req, res, ['POST'])) {
    return;
  }

  try {
    verifySessionToken(getBearerToken(req));

    const body = await readJson(req);
    const values = await readSheetValues();
    const result = buildChatResult(values, body.phone);

    sendJson(res, 200, result);
  } catch (error) {
    const status = /session|invalid/i.test(error.message || '') ? 401 : 500;
    sendError(res, status, error);
  }
};
