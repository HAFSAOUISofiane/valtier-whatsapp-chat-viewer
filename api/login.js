const { allowMethods, readJson, sendError, sendJson } = require('./_lib/http');
const { createSessionToken, verifyAccessCode } = require('./_lib/session');
const { CONFIG } = require('./_lib/config');
const { getGoogleCredentialsStatus } = require('./_lib/googleSheets');

module.exports = async function handler(req, res) {
  if (!allowMethods(req, res, ['POST'])) {
    return;
  }

  try {
    const body = await readJson(req);

    if (!verifyAccessCode(body.accessCode)) {
      sendError(res, 401, new Error('The access code is not valid.'));
      return;
    }

    sendJson(res, 200, {
      token: createSessionToken(),
      expiresInHours: CONFIG.sessionHours,
      sheetName: CONFIG.sheetName,
      demoMode: CONFIG.demoMode,
      demoSamplePhone: CONFIG.demoSamplePhone,
      googleCredentials: getGoogleCredentialsStatus(),
    });
  } catch (error) {
    sendError(res, 500, error);
  }
};
