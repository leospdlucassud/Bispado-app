// Upsert por campo único (servidor e fila) — rodar com `npm test`.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inserirOuMesclar, limparCorpo } from '../js/crud-regras.js';

const base = [{ id: '1', data: '2026-10-18', criadoEm: 'c1', a: 'x' }, { id: '2', data: '2026-10-18', criadoEm: 'c2' }];
const opts = { campo: 'data', agora: 'AGORA', novoId: '9' };

test('data nova cria o registro', () => {
  const r = inserirOuMesclar(base, { data: '2026-10-25', b: 1 }, opts);
  assert.equal(r.criado, true);
  assert.deepEqual(r.item, { data: '2026-10-25', b: 1, id: '9', criadoEm: 'AGORA' });
  assert.equal(r.lista.length, 3);
});

test('data que já existe junta no PRIMEIRO registro, sem trocar id nem criação', () => {
  const r = inserirOuMesclar(base, { data: '2026-10-18', a: 'y', id: 'falso', criadoEm: 'falso' }, opts);
  assert.equal(r.criado, false);
  assert.equal(r.item.id, '1');
  assert.equal(r.item.criadoEm, 'c1');
  assert.equal(r.item.atualizadoEm, 'AGORA');
  assert.equal(r.item.a, 'y');
  assert.equal(r.lista.length, 2);
  assert.equal(base[0].a, 'x');   // não altera a lista original
});

test('corpo sem o campo único cria', () => {
  assert.equal(inserirOuMesclar(base, { a: 1 }, opts).criado, true);
});

test('fundir pode descartar campos e avisa', () => {
  const fundir = (e, c) => ({ registro: { ...e }, descartados: [1] });
  const r = inserirOuMesclar(base, { data: '2026-10-18', a: 'z' }, { ...opts, fundir });
  assert.deepEqual(r.descartados, [1]);
  assert.equal(r.item.a, 'x');
});

test('limparCorpo tira os campos do servidor e não mexe no original', () => {
  const corpo = { id: 1, criadoEm: 2, atualizadoEm: 3, _descartados: [1], data: 'd', x: 4 };
  assert.deepEqual(limparCorpo(corpo, ['data']), { x: 4 });
  assert.equal(corpo.id, 1);
  assert.deepEqual(limparCorpo(null), {});
  assert.deepEqual(limparCorpo([1, 2]), {});
});

// ---------- trava (a vaga de orador que outro aparelho mudou) ----------
import { aplicarPut } from '../js/crud-regras.js';
import { travarVagas } from '../js/discursos-regras.js';

const domingo = { id: '1', data: '2026-10-18', criadoEm: 'c1', orador1: 'Helena Teste', orador1Chave: 'helena teste',
  orador1Status: 'convidado', orador1ConvidadoEm: 'ontem' };

test('PUT de tela velha ("Aceitou" para quem saiu da vaga) não apaga o convite da pessoa nova', () => {
  const r = aplicarPut(domingo, { orador1Status: 'aceito', orador1Chave: 'gil teste', orador1RespostaEm: 'agora', _vaga1: 'gil teste', primeiroHino: '2' },
    { agora: 'AGORA', travar: travarVagas });
  assert.deepEqual(r.descartados, [1]);
  assert.equal(r.item.orador1Status, 'convidado');
  assert.equal(r.item.orador1Chave, 'helena teste');
  assert.equal(r.item.primeiroHino, '2');            // o resto do corpo entra
  assert.ok(!('_vaga1' in r.item));
});

test('PUT com a vaga como o aparelho a viu passa, e a marca não é gravada', () => {
  const r = aplicarPut(domingo, { orador1Status: 'aceito', orador1Chave: 'helena teste', _vaga1: 'helena teste' },
    { agora: 'AGORA', travar: travarVagas });
  assert.deepEqual(r.descartados, []);
  assert.equal(r.item.orador1Status, 'aceito');
  assert.ok(!('_vaga1' in r.item));
});

test('POST: domingo novo com marca de vaga vazia entra; marca de alguém que não está lá é descartada', () => {
  const novo = inserirOuMesclar([], { data: '2026-10-25', orador2: 'Ana', orador2Chave: 'ana', _vaga2: '' },
    { ...opts, travar: travarVagas });
  assert.equal(novo.item.orador2, 'Ana');
  assert.deepEqual(novo.descartados, []);
  assert.ok(!('_vaga2' in novo.item));
  const velho = inserirOuMesclar([domingo], { data: '2026-10-18', orador1Status: 'aceito', _vaga1: 'gil teste' },
    { ...opts, travar: travarVagas });
  assert.deepEqual(velho.descartados, [1]);
  assert.equal(velho.item.orador1Status, 'convidado');
});
