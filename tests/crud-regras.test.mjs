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
