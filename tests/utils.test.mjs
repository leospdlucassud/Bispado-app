// Utilitários de data e de cor — rodar com `npm test`.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  corSegura, dataLocal, dataParaExibir, digitosTelefone, encadearPorChave, esc, hrefWhatsApp, norm,
  partesDoNascimento, realcar,
} from '../js/utils.js';

test('telefone do WhatsApp só com DDD', () => {
  assert.equal(digitosTelefone('(63) 99999-0000'), '5563999990000');
  assert.equal(digitosTelefone('+55 63 99999-0000'), '5563999990000');
  assert.equal(digitosTelefone('99999-0000'), '');      // sem DDD: antes virava 55+número
  assert.equal(digitosTelefone(''), '');
});

test('link do WhatsApp, com e sem número', () => {
  assert.equal(hrefWhatsApp('', 'oi a'), 'https://wa.me/?text=oi%20a');
  assert.equal(hrefWhatsApp('(63) 99999-0000', 'oi'), 'https://wa.me/5563999990000?text=oi');
});

test('norm e nascimento do LCR', () => {
  assert.equal(norm('  Ána  B '), 'ana b');
  assert.deepEqual(partesDoNascimento('03 fev 2010'), { a: 2010, m: 2, d: 3 });
  assert.equal(partesDoNascimento('31 fev 2010'), null);
  assert.equal(partesDoNascimento('lixo'), null);
});

test('realcar escapa o texto e não parte entidades', () => {
  assert.equal(realcar('a<b>amp', 'amp'), 'a&lt;b&gt;<mark>amp</mark>');
  assert.equal(realcar('Tom & Jerry', 'amp'), 'Tom &amp; Jerry');
  assert.equal(realcar('Ana', 'an'), '<mark>An</mark>a');
  assert.equal(realcar('x', ''), 'x');
});

test('encadearPorChave: mesma chave em ordem, chaves diferentes não esperam', async () => {
  const fila = encadearPorChave();
  const ordem = [];
  const espera = (ms, v) => () => new Promise(r => setTimeout(() => { ordem.push(v); r(v); }, ms));
  const a1 = fila('a', espera(30, 'a1'));
  const a2 = fila('a', espera(1, 'a2'));
  const b1 = fila('b', espera(5, 'b1'));
  await Promise.all([a1, a2, b1]);
  assert.deepEqual(ordem, ['b1', 'a1', 'a2']);
  // uma falha não trava a seguinte
  const falha = fila('c', () => Promise.reject(new Error('x')));
  await assert.rejects(falha);
  assert.equal(await fila('c', () => Promise.resolve('ok')), 'ok');
});

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
