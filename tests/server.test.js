const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp, toBase62, isValidUrl } = require('../src/server');

function startServer() {
  const server = createApp();
  return new Promise((resolve) => {
    server.listen(0, () => {
      const { port } = server.address();
      resolve({ server, base: `http://localhost:${port}` });
    });
  });
}

test('toBase62 codifica números crescentes sem repetir', () => {
  assert.equal(toBase62(0), 'a');
  assert.equal(toBase62(1000), toBase62(1000));
  assert.notEqual(toBase62(1000), toBase62(1001));
});

test('isValidUrl aceita http/https e rejeita o resto', () => {
  assert.equal(isValidUrl('https://exemplo.com'), true);
  assert.equal(isValidUrl('http://exemplo.com/pagina'), true);
  assert.equal(isValidUrl('ftp://exemplo.com'), false);
  assert.equal(isValidUrl('não é url'), false);
});

test('POST /api/shorten cria um código e GET /:code redireciona', async () => {
  const { server, base } = await startServer();
  try {
    const createRes = await fetch(`${base}/api/shorten`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://anthropic.com' }),
    });
    assert.equal(createRes.status, 201);
    const created = await createRes.json();
    assert.equal(created.url, 'https://anthropic.com');
    assert.ok(created.code.length > 0);

    const redirectRes = await fetch(`${base}/${created.code}`, { redirect: 'manual' });
    assert.equal(redirectRes.status, 302);
    assert.equal(redirectRes.headers.get('location'), 'https://anthropic.com');
  } finally {
    server.close();
  }
});

test('GET /api/stats/:code conta os acessos', async () => {
  const { server, base } = await startServer();
  try {
    const createRes = await fetch(`${base}/api/shorten`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.org' }),
    });
    const { code } = await createRes.json();

    await fetch(`${base}/${code}`, { redirect: 'manual' });
    await fetch(`${base}/${code}`, { redirect: 'manual' });

    const statsRes = await fetch(`${base}/api/stats/${code}`);
    const stats = await statsRes.json();
    assert.equal(stats.hits, 2);
    assert.equal(stats.url, 'https://example.org');
  } finally {
    server.close();
  }
});

test('POST /api/shorten rejeita url inválida', async () => {
  const { server, base } = await startServer();
  try {
    const res = await fetch(`${base}/api/shorten`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'não-é-url' }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test('GET em código inexistente retorna 404', async () => {
  const { server, base } = await startServer();
  try {
    const res = await fetch(`${base}/xyz123`);
    assert.equal(res.status, 404);
  } finally {
    server.close();
  }
});
