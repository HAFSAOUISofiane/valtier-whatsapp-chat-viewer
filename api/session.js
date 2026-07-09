const { allowMethods, getBearerToken, sendError, sendJson } = require('./_lib/http');
const { verifySessionToken } = require('./_lib/session');
const { CONFIG } = require('./_lib/config');
const { getGoogleCredentialsStatus } = require('./_lib/googleSheets');

module.exports = async function handler(req, res) {
  if (!allowMethods(req, res, ['GET'])) {
    return;
  }

  try {
    const session = verifySessionToken(getBearerToken(req));
    sendJson(res, 200, {
      ok: true,
      session,
      sheetName: CONFIG.sheetName,
      demoMode: CONFIG.demoMode,
      demoSamplePhone: CONFIG.demoSamplePhone,
      googleCredentials: getGoogleCredentialsStatus(),
    });
  } catch (error) {
    sendError(res, 401, error);
  }
};
