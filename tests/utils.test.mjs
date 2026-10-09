// Utilitários de data e de cor — rodar com `npm test`.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { corSegura, dataLocal, dataParaExibir, esc } from '../js/utils.js';

test('"hoje" às 22h continua sendo hoje (era o dia seguinte, em UTC)', () => {
  assert.equal(dataLocal(new Date(2026, 9, 8, 22, 30)), '2026-10-08');
  assert.equal(dataLocal(new Date(2026, 9, 31, 23, 59)), '2026-10-31');
  assert.equal(dataLocal(new Date(2026, 0, 1, 0, 0)), '2026-01-01');
});

test('data AAAA-MM-DD é exibida no próprio dia, sem voltar um', () => {
  assert.equal(dataParaExibir('2026-10-08'), '08/10/2026');
  assert.equal(dataParaExibir(''), '');
  assert.equal(dataParaExibir('lixo'), '');
});

test('cor vinda dos dados só passa se for hex', () => {
  assert.equal(corSegura('#34d399'), '#34d399');
  assert.equal(corSegura('red;background:url(x)'), '#94a3b8');
  assert.equal(corSegura(undefined), '#94a3b8');
});

test('esc escapa o que quebraria o HTML', () => {
  assert.equal(esc(`<img src=x onerror="a">'&`), '&lt;img src=x onerror=&quot;a&quot;&gt;&#39;&amp;');
});
