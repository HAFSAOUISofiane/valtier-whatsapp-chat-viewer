const DEFAULT_SHEET_ID = '1DYo_vjtkWOQgm9_TmcK4jf0ZR_pYgkkJZELujNDMn-M';
const DEFAULT_SHEET_NAME = 'Hoja 1';

const CONFIG = {
  sheetId: process.env.GOOGLE_SHEET_ID || DEFAULT_SHEET_ID,
  sheetName: process.env.GOOGLE_SHEET_NAME || DEFAULT_SHEET_NAME,
  sheetRange: process.env.GOOGLE_SHEET_RANGE || 'A1:L',
  accessCode: process.env.ACCESS_CODE || '',
  sessionSecret: process.env.SESSION_SECRET || '',
  sessionHours: Number(process.env.SESSION_HOURS || 8),
  demoMode: process.env.DEMO_MODE === 'true',
};

function requireAccessCode() {
  if (!CONFIG.accessCode) {
    throw new Error('Missing ACCESS_CODE environment variable.');
  }

  return CONFIG.accessCode;
}

function getSessionSecret() {
  if (CONFIG.sessionSecret) {
    return CONFIG.sessionSecret;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('Missing SESSION_SECRET environment variable.');
  }

  return 'local-dev-session-secret-change-before-production';
}

module.exports = {
  CONFIG,
  requireAccessCode,
  getSessionSecret,
};
