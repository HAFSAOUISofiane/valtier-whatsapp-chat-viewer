const crypto = require('crypto');
const { CONFIG, getSessionSecret, requireAccessCode } = require('./config');

function base64Url(input) {
  return Buffer
    .from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function decodeBase64Url(input) {
  const padded = String(input || '').replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(padded, 'base64').toString('utf8');
}

function sign(value) {
  return crypto
    .createHmac('sha256', getSessionSecret())
    .update(value)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function createSessionToken() {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: 'valtier-agent',
    iat: now,
    exp: now + CONFIG.sessionHours * 60 * 60,
  };
  const encoded = base64Url(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
}

function verifySessionToken(token) {
  const cleanToken = String(token || '').trim();
  const parts = cleanToken.split('.');

  if (parts.length !== 2) {
    throw new Error('Session missing. Please log in again.');
  }

  const expectedSignature = sign(parts[0]);
  const providedSignature = parts[1];

  if (!timingSafeEqual(expectedSignature, providedSignature)) {
    throw new Error('Invalid session. Please log in again.');
  }

  const payload = JSON.parse(decodeBase64Url(parts[0]));
  const now = Math.floor(Date.now() / 1000);

  if (!payload.exp || payload.exp < now) {
    throw new Error('Session expired. Please log in again.');
  }

  return payload;
}

function verifyAccessCode(accessCode) {
  const expected = requireAccessCode();
  return timingSafeEqual(String(accessCode || '').trim(), expected);
}

function timingSafeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ''));
  const rightBuffer = Buffer.from(String(right || ''));

  if (leftBuffer.length !== rightBuffer.length) {
    crypto.timingSafeEqual(leftBuffer, leftBuffer);
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

module.exports = {
  createSessionToken,
  verifySessionToken,
  verifyAccessCode,
};
