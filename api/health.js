const { allowMethods, sendJson } = require('./_lib/http');
const { CONFIG } = require('./_lib/config');
const { getGoogleCredentialsStatus } = require('./_lib/googleSheets');

module.exports = async function handler(req, res) {
  if (!allowMethods(req, res, ['GET'])) {
    return;
  }

  sendJson(res, 200, {
    ok: true,
    app: 'Valtier WhatsApp Chat Viewer',
    sheetName: CONFIG.sheetName,
    demoMode: CONFIG.demoMode,
    googleCredentials: getGoogleCredentialsStatus(),
  });
};
