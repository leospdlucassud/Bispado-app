// Progresso da leitura de PDF e o botão Aplicar (js/pdf-progresso.js) — `npm test`.
// Elementos de mentira, só com o que o módulo usa: sem navegador.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { destravarAplicar, liberarAplicar, textoDasPaginas, travarAplicar } from '../js/pdf-progresso.js';

function botao({ disabled = true } = {}) {
  const atributos = new Map(disabled ? [['aria-disabled', 'true']] : []);
  return {
    disabled, innerHTML: 'Aplicar', textContent: 'Aplicar',
    setAttribute: (k, v) => atributos.set(k, v), removeAttribute: k => atributos.delete(k),
    attr: k => atributos.get(k),
  };
}
const caixa = b => ({ querySelector: sel => (sel === 'button[data-act="aplicar"]' ? b : null) });

test('o Aplicar nasce desligado e só liga quando a prévia termina', () => {
  const b = botao();
  const c = caixa(b);
  assert.equal(travarAplicar(c), false, 'desligado: tocar não grava');
  liberarAplicar(c);
  assert.equal(b.disabled, false);
  assert.equal(b.attr('aria-disabled'), undefined);
});

test('tocar no Aplicar desliga o botão: o segundo toque não grava de novo', () => {
  const b = botao({ disabled: false });
  const c = caixa(b);
  assert.equal(travarAplicar(c), true, 'primeiro toque segue');
  assert.equal(b.disabled, true);
  assert.match(b.innerHTML, /Aplicando/);
  assert.equal(travarAplicar(c), false, 'segundo toque, com a gravação em andamento, para aqui');
  destravarAplicar(c);
  assert.equal(b.disabled, false, 'se a gravação falhar com a prévia aberta, o botão volta');
  assert.equal(b.textContent, 'Aplicar');
});

test('sem botão na janela (aviso no lugar da prévia), nada quebra', () => {
  const vazia = { querySelector: () => null };
  assert.equal(travarAplicar(vazia), false);
  liberarAplicar(vazia);
  destravarAplicar(vazia);
  liberarAplicar(null);
});

test('a leitura avisa o progresso a cada página', async () => {
  const doc = { numPages: 3, getPage: async i => ({ getTextContent: async () => ({ items: [{ str: 'p' + i }] }) }) };
  const visto = [];
  const paginas = await textoDasPaginas(doc, { pagina: (f, t) => visto.push(`${f}/${t}`) });
  assert.deepEqual(visto, ['1/3', '2/3', '3/3']);
  assert.deepEqual(paginas.map(p => p[0].str), ['p1', 'p2', 'p3']);
  assert.equal((await textoDasPaginas(doc)).length, 3, 'sem progresso também lê');
});
