const http = require('node:http');

const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function toBase62(num) {
  if (num === 0) return ALPHABET[0];
  let out = '';
  while (num > 0) {
    out = ALPHABET[num % 62] + out;
    num = Math.floor(num / 62);
  }
  return out;
}

function isValidUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function createApp() {
  const store = new Map(); // code -> { url, hits, createdAt }
  let nextId = 1000; // começa em 1000 pra não gerar códigos de 1 caractere logo de cara

  function readBody(req) {
    return new Promise((resolve, reject) => {
      let raw = '';
      req.on('data', (chunk) => {
        raw += chunk;
        if (raw.length > 10_000) req.destroy();
      });
      req.on('end', () => resolve(raw));
      req.on('error', reject);
    });
  }

  function sendJson(res, status, body) {
    const payload = JSON.stringify(body);
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(payload);
  }

  async function handler(req, res) {
    const url = new URL(req.url, 'http://localhost');

    if (req.method === 'POST' && url.pathname === '/api/shorten') {
      let parsed;
      try {
        const raw = await readBody(req);
        parsed = JSON.parse(raw || '{}');
      } catch {
        return sendJson(res, 400, { error: 'JSON inválido no corpo da requisição' });
      }

      const { url: targetUrl } = parsed;
      if (!targetUrl || !isValidUrl(targetUrl)) {
        return sendJson(res, 400, { error: 'campo "url" ausente ou inválido (precisa ser http/https)' });
      }

      const code = toBase62(nextId);
      nextId += 1;
      store.set(code, { url: targetUrl, hits: 0, createdAt: new Date().toISOString() });

      return sendJson(res, 201, { code, url: targetUrl, shortPath: `/${code}` });
    }

    if (req.method === 'GET' && url.pathname.startsWith('/api/stats/')) {
      const code = url.pathname.slice('/api/stats/'.length);
      const entry = store.get(code);
      if (!entry) return sendJson(res, 404, { error: 'código não encontrado' });
      return sendJson(res, 200, { code, ...entry });
    }

    if (req.method === 'GET' && url.pathname !== '/' && !url.pathname.startsWith('/api/')) {
      const code = url.pathname.slice(1);
      const entry = store.get(code);
      if (!entry) return sendJson(res, 404, { error: 'código não encontrado' });
      entry.hits += 1;
      res.writeHead(302, { Location: entry.url });
      return res.end();
    }

    return sendJson(res, 404, { error: 'rota não encontrada' });
  }

  return http.createServer(handler);
}

module.exports = { createApp, toBase62, isValidUrl };

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  createApp().listen(PORT, () => {
    console.log(`encurtador rodando em http://localhost:${PORT}`);
  });
}
