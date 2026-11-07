// Hinos do autocompletar das atas (js/hinos.js) — `npm test`.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HINARIO_HINOS, HINARIO_LAR_IGREJA, HINOS, completarHino, hinoPeloNumero, rotuloHino } from '../js/hinos.js';

test('os dois hinários: Hinos 1–204 sem buraco; Para o lar e a Igreja a partir de 1001', () => {
  assert.equal(HINARIO_HINOS.length, 204);
  HINARIO_HINOS.forEach(([n], i) => assert.equal(n, i + 1));
  assert.ok(HINARIO_LAR_IGREJA.length >= 90);
  assert.equal(HINARIO_LAR_IGREJA[0][0], 1001);
  assert.ok(HINARIO_LAR_IGREJA.every(([n]) => n > 1000));
  // número único e título preenchido em todos
  assert.equal(new Set(HINOS.map(h => h[0])).size, HINOS.length);
  assert.ok(HINOS.every(([, t]) => typeof t === 'string' && t.trim() && !/[<>]/.test(t)));
});

test('rótulo e busca pelo número', () => {
  assert.equal(rotuloHino([1, 'A Alva Rompe']), '1 — A Alva Rompe');
  assert.equal(hinoPeloNumero('1')?.[1], 'A Alva Rompe');
  assert.equal(hinoPeloNumero(999), null);
});

test('completarHino: só o número vira "número — título"; o resto fica como está', () => {
  assert.equal(completarHino('1'), '1 — A Alva Rompe');
  assert.equal(completarHino(' nº 1 '), '1 — A Alva Rompe');
  assert.equal(completarHino('#1001'), rotuloHino(hinoPeloNumero(1001)));
  assert.equal(completarHino('999'), '999', 'número que não existe: como digitado');
  assert.equal(completarHino('1 — A Alva Rompe'), '1 — A Alva Rompe');
  assert.equal(completarHino('Hino da Primária'), 'Hino da Primária');
  assert.equal(completarHino(''), '');
  assert.equal(completarHino(null), '');
});
