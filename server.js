const fs = require('fs');
const http = require('http');
const path = require('path');
const { URL } = require('url');

loadEnvFile(path.join(__dirname, '.env'));
loadEnvFile(path.join(__dirname, '.env.local'));

const apiHandlers = {
  '/api/health': require('./api/health'),
  '/api/login': require('./api/login'),
  '/api/search': require('./api/search'),
  '/api/session': require('./api/session'),
};

const publicDir = path.join(__dirname, 'public');
const port = Number(process.env.PORT || 5174);

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (apiHandlers[requestUrl.pathname]) {
    try {
      await apiHandlers[requestUrl.pathname](req, res);
    } catch (error) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: error.message || String(error) }));
    }
    return;
  }

  serveStatic(requestUrl.pathname, res);
});

server.listen(port, () => {
  console.log(`Valtier WhatsApp Chat Viewer running at http://localhost:${port}`);
});

function serveStatic(pathname, res) {
  const cleanPath = pathname === '/' ? '/index.html' : pathname;
  const requestedPath = path.normalize(path.join(publicDir, cleanPath));

  if (!requestedPath.startsWith(publicDir)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  const filePath = fs.existsSync(requestedPath) && fs.statSync(requestedPath).isFile()
    ? requestedPath
    : path.join(publicDir, 'index.html');

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.statusCode = 404;
      res.end('Not Found');
      return;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', getContentType(filePath));
    res.end(data);
  });
}

function getContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();

  return {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
  }[extension] || 'application/octet-stream';
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);

  lines.forEach((line) => {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      return;
    }

    const separatorIndex = trimmed.indexOf('=');

    if (separatorIndex === -1) {
      return;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
}
