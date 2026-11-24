const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const ExcelJS = require('exceljs');
require('../../src/config/env');
if (!/^fhdod_verify_\d+$/.test(process.env.DB_NAME || '')) throw new Error('Teste de volume exige o banco temporário criado por test:painel.');
const { pool } = require('../../src/db');
const BASE = process.env.BASE_URL;
const SETOR = 'cargateste';
const TOTAL = 20001;

test('Relatórios completos acima dos antigos limites de volume', { timeout: 180000 }, async t => {
  let usuarioId;
  try {
    await pool.query("INSERT INTO setores (id,nome,ordem,origem) VALUES (?, 'Setor exclusivo de volume', 119, 'cadastrado')", [SETOR]);
    for (let i = 0; i < 11; i++) await pool.query('INSERT INTO perguntas (setor_id,ordem,texto,tipo) VALUES (?,?,?,?)', [SETOR, i + 1, 'Pergunta de volume ' + i, i ? 'escala' : 'nps']);
    const [user] = await pool.query("INSERT INTO usuarios (nome,email,senha_hash,papel,setor_id,trocar_senha) VALUES ('Volume','volume@teste.invalid',?,'visualizador',?,0)", [crypto.randomBytes(32).toString('hex'), SETOR]);
    usuarioId = user.insertId;
    const cookie = 'fhdod_token=' + jwt.sign({ id: usuarioId, sv: 0 }, process.env.JWT_SECRET, { expiresIn: '10m' });
    const request = async route => {
      const r = await fetch(BASE + route, { headers: { Cookie: cookie }, signal: AbortSignal.timeout(120000) });
      assert.equal(r.status, 200, route);
      return r;
    };
    for (let n = 0; n < TOTAL; n += 500) {
      const values = Array.from({ length: Math.min(500, TOTAL - n) }, () => [SETOR, 10, 5, 0, '2026-01-01', 'Dia', 'Paciente', 'SUS']);
      await pool.query('INSERT INTO avaliacoes (setor_id,nps,nota_media,abaixo_media,data_atendimento,turno,respondente,tipo_atendimento) VALUES ?', [values]);
    }
    const [qs] = await pool.query('SELECT id,texto,tipo FROM perguntas WHERE setor_id=? ORDER BY ordem', [SETOR]);
    const [avs] = await pool.query('SELECT id FROM avaliacoes WHERE setor_id=? ORDER BY id', [SETOR]);
    for (let n = 0; n < avs.length; n += 500) {
      const values = avs.slice(n, n + 500).flatMap(a => qs.map(q => [a.id, q.id, q.texto, q.tipo, q.tipo === 'nps' ? 10 : 5]));
      await pool.query('INSERT INTO respostas (avaliacao_id,pergunta_id,pergunta_texto,tipo,valor_num) VALUES ?', [values]);
    }
    await t.test('Paginação percorre todos os registros sem duplicar nem sair do setor', async () => {
      const ids = new Set(); let antes = null;
      do {
        const page = await (await request('/api/admin/avaliacoes/paginas' + (antes ? '?antes=' + antes : ''))).json();
        assert.ok(page.itens.length <= 500);
        for (const row of page.itens) {
          assert.equal(row.setor, SETOR); assert.equal(row.telefone, null);
          assert.equal(ids.has(row.id), false); ids.add(row.id);
        }
        antes = page.proxima;
      } while (antes);
      assert.equal(ids.size, TOTAL);
    });
    await t.test('API de compatibilidade não corta mais nas 5.000 avaliações', async () => {
      const rows = await (await request('/api/admin/avaliacoes')).json();
      assert.equal(rows.length, TOTAL);
    });
    await t.test('Agregação inclui mais de 200.000 respostas e mantém os indicadores', async () => {
      const data = await (await request('/api/admin/resultado-perguntas?p=all')).json();
      assert.equal(data.itens.length, 11);
      for (const q of data.itens) {
        assert.equal(q.total, TOTAL);
        assert.equal(q.media, q.tipo === 'nps' ? 10 : 5);
        if (q.tipo === 'nps') assert.equal(q.nps, 100);
        else assert.equal(q.satisfeitos, 100);
      }
    });
    await t.test('Excel exporta mais de 20.000 registros e o resumo usa a mesma base', async () => {
      const r = await request('/api/admin/export.xlsx?p=all');
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(Buffer.from(await r.arrayBuffer()));
      assert.equal(workbook.getWorksheet('Avaliações').actualRowCount, TOTAL + 1);
      assert.equal(workbook.getWorksheet('Resumo por setor').getCell('B2').value, TOTAL);
      assert.equal(workbook.getWorksheet('Resumo por setor').getCell('D2').value, 100);
    });
    await t.test('Paginação inválida e acesso anônimo são recusados', async () => {
      assert.equal((await fetch(BASE + '/api/admin/avaliacoes/paginas?antes=abc', { headers: { Cookie: cookie } })).status, 400);
      assert.equal((await fetch(BASE + '/api/admin/avaliacoes/paginas')).status, 401);
    });
    await t.test('Saúde do serviço suporta amostra de requisições concorrentes', async () => {
      const durations = [];
      for (let i = 0; i < 10; i++) await Promise.all(Array.from({ length: 10 }, async () => {
        const inicio = performance.now();
        const r = await fetch(BASE + '/api/saude', { signal: AbortSignal.timeout(10000) });
        assert.equal(r.status, 200); assert.equal((await r.json()).ok, true);
        durations.push(performance.now() - inicio);
      }));
      durations.sort((a, b) => a - b);
      console.log('Amostra local: 100 requisições, concorrência 10, p95=' + Math.round(durations[94]) + ' ms.');
    });
  } finally {
    // A trava no início do arquivo impede qualquer execução desta limpeza em banco operacional.
    await pool.query('DELETE FROM avaliacoes WHERE setor_id=?', [SETOR]);
    if (usuarioId) await pool.query('DELETE FROM usuarios WHERE id=?', [usuarioId]);
    await pool.query('DELETE FROM perguntas WHERE setor_id=?', [SETOR]);
    await pool.query('DELETE FROM setores WHERE id=?', [SETOR]);
    await pool.end();
  }
});
