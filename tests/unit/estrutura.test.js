const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const app = require('../../src/app');
const { pool } = require('../../src/db');

test('Servidor reorganizado serve telas e recursos sem expor código ou consultar o banco', async t => {
  // Este teste verifica os caminhos de arquivos sem depender de um MySQL disponível.
  const originalQuery = pool.query;
  pool.query = () => { throw new Error('Este teste não deve consultar o banco'); };
  const server = app.listen(0, '127.0.0.1');
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    pool.query = originalQuery;
    await pool.end();
  });
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const route of ['/', '/index.html', '/admin', '/admin.html', '/qr.html', '/tv.html', '/privacidade.html']) {
    const response = await fetch(base + route);
    assert.equal(response.status, 200, route);
    const html = await response.text();
    for (const [, asset] of html.matchAll(/<(?:script|link|img)\b[^>]*?(?:src|href)="([^"]+)"/g)) {
      const url = new URL(asset, base + route);
      assert.equal(url.origin, base);
      assert.equal((await fetch(url)).status, 200, route + ': ' + asset);
    }
  }
  // /src é a URL dos recursos do frontend; nunca deve apontar para o backend.
  assert.equal(await (await fetch(base + '/src/App.js')).text(), fs.readFileSync(path.resolve(__dirname, '../../frontend/src/App.js'), 'utf8'));
  for (const route of ['/.env', '/src/server.js', '/src/config/env.js', '/src/db/index.js', '/src/controller/admin.js', '/src/model/avaliacoes.js', '/certs/ca.pem', '/package.json', '/database/schema.sql']) {
    assert.equal((await fetch(base + route)).status, 404, route);
  }
  assert.equal((await fetch(base + '/api/vivo')).status, 200);
  assert.equal((await fetch(base + '/api/admin/avaliacoes')).status, 401);
});
