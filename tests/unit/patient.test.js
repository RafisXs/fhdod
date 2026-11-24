const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function pesquisa(perguntas) {
  let chips = [], go, back;
  const contexto = vm.createContext({
    setTimeout, clearTimeout,
    esc: String,
    draw(html) {
      chips = [...html.matchAll(/class="chip" data-i="(\d+)" aria-pressed="(true|false)"/g)].map(m => ({
        dataset: { i: m[1] }, pressed: m[2],
        setAttribute(nome, valor) { if (nome === 'aria-pressed') this.pressed = valor; }
      }));
      go = {}; back = {};
    },
    document: { getElementById(id) { return id === 'back' ? back : go; } },
    app: { querySelectorAll(selector) { return selector === '.chip' ? chips : []; } }
  });
  const codigo = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/pages/patient.js'), 'utf8');
  vm.runInContext(codigo.replace(/boot\(\);\s*$/, ''), contexto);
  contexto.PQ = { teste: perguntas };
  contexto.cur = { id: 'teste', nome: 'Teste' };
  contexto.ans = { r: {}, aceite_privacidade: true };
  const gravacoes = [];
  contexto.salvar = q => gravacoes.push(Array.from(contexto.ans.r[q.id]));
  return { contexto, gravacoes, chips: () => chips, go: () => go, back: () => back };
}

test('todas as alternativas de múltipla escolha são independentes e persistem ao voltar', () => {
  for (const tipo of ['positivos', 'negativos']) {
    const q = { id: 1, tipo, texto: 'Aspectos', opcoes: ['Demora', 'Limpeza', 'Nada a melhorar', 'Nenhum outro'] };
    const p = pesquisa([q, { ...q, id: 2 }]);
    p.contexto.render();
    for (let i = 0; i < q.opcoes.length; i++) {
      p.chips()[i].onclick();
      assert.deepEqual(p.gravacoes.at(-1), q.opcoes.slice(0, i + 1));
      assert.equal(p.chips().filter(c => c.pressed === 'true').length, i + 1);
    }
    p.go().onclick(); p.back().onclick();
    assert.equal(p.chips().filter(c => c.pressed === 'true').length, q.opcoes.length);
    for (let i = 0; i < q.opcoes.length; i++) {
      p.chips()[i].onclick();
      assert.deepEqual(p.gravacoes.at(-1), q.opcoes.slice(i + 1));
    }
  }
});

module.exports = { pesquisa };
