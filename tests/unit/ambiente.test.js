const test = require('node:test');
const assert = require('node:assert/strict');
const { validarAmbiente } = require('../../src/validations/ambiente');

const producao = { NODE_ENV: 'production', COOKIE_SECURE: 'true', JWT_SECRET: 'a'.repeat(64), DB_USER: 'fhdod_app', DB_PASSWORD: 'somente-teste', DB_NAME: 'teste', PORT: '3000', TRUST_PROXY: '1' };

test('Desenvolvimento preserva a configuração local', () => {
  assert.deepEqual(validarAmbiente({}), []);
});
test('Produção aceita configuração protegida e recusa cookies inseguros', () => {
  assert.deepEqual(validarAmbiente(producao), []);
  assert.ok(validarAmbiente({ ...producao, COOKIE_SECURE: 'false' }).some(e => e.includes('COOKIE_SECURE')));
});
test('Produção recusa segredo fraco, usuário root e senha ausente', () => {
  for (const alteracao of [{ JWT_SECRET: 'curto' }, { DB_USER: 'root' }, { DB_PASSWORD: '' }, { DB_NAME: '' }]) {
    assert.ok(validarAmbiente({ ...producao, ...alteracao }).length);
  }
});
test('Portas, proxy e booleanos inválidos não usam fallback permissivo', () => {
  for (const alteracao of [{ PORT: '0' }, { PORT: '65536' }, { PORT: 'abc' }, { TRUST_PROXY: 'true' }, { COOKIE_SECURE: 'yes' }, { AUTO_MIGRATE: '1' }]) {
    assert.ok(validarAmbiente({ ...producao, ...alteracao }).length);
  }
  assert.deepEqual(validarAmbiente({ ...producao, TRUST_PROXY: '0', AUTO_MIGRATE: 'false' }), []);
});
