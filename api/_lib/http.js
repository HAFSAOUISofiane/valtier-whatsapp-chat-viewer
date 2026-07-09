function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

function sendError(res, statusCode, error) {
  const message = error && error.message ? error.message : String(error || 'Unexpected error.');
  sendJson(res, statusCode, { error: message });
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;

      if (body.length > 1024 * 1024) {
        reject(new Error('Request body is too large.'));
        req.destroy();
      }
    });

    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error('Invalid JSON request body.'));
      }
    });

    req.on('error', reject);
  });
}

function getBearerToken(req) {
  const header = req.headers.authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1] : '';
}

function allowMethods(req, res, methods) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Allow', methods.join(', '));
    res.end();
    return false;
  }

  if (!methods.includes(req.method)) {
    res.statusCode = 405;
    res.setHeader('Allow', methods.join(', '));
    res.end('Method Not Allowed');
    return false;
  }

  return true;
}

module.exports = {
  allowMethods,
  getBearerToken,
  readJson,
  sendError,
  sendJson,
};
