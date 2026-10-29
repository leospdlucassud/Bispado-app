// Texto oficial dos roteiros de entrevista (netlify/functions/_roteiros.js) — `npm test`.
// O HTML aqui é inventado: o texto real da Igreja não fica no repositório.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FONTES_ROTEIRO, blocosDoHtml, lerRoteiroOficial, recortarSecao, textoDoHtml, urlDoConteudo,
} from '../netlify/functions/_roteiros.js';
import { readFileSync } from 'node:fs';

// manual.js mexe no DOM ao carregar: os ids dos roteiros saem do código-fonte
const IDS_ROTEIROS = [...readFileSync(new URL('../js/manual.js', import.meta.url), 'utf8').matchAll(/id: '([a-z-]+)', icone:/g)].map(m => m[1]);

const PAGINA = `
<section><header><p class="title-number">9.1</p><h2 data-aid="100" id="title1">Antes</h2></header>
  <p data-aid="101">Fora da seção.</p></section>
<section id="sec2">
  <header><p class="title-number" data-aid="199">9.2</p><h3 data-aid="200" id="title2">Perguntas de exemplo</h3></header>
  <p data-aid="201">Introdução com <a href="/x">link</a> &amp; entidade&nbsp;aqui.</p>
  <ol class="decimal" start="1">
    <li data-marker="1."><p data-aid="202">Primeira pergunta?</p></li>
    <li data-marker="2."><p data-aid="203">Segunda, parte A.</p><p data-aid="204">Parte B?</p>
      <ul class="bullet"><li><p data-aid="205">Subitem</p></li></ul>
    </li>
  </ol>
  <section><header><p class="title-number">9.2.1</p><h4 data-aid="210" id="title3">Subseção</h4></header>
    <p data-aid="211">Dentro da subseção.</p></section>
</section>
<section><header><h2 data-aid="300" id="title4">Depois</h2></header><p data-aid="301">Já é outra.</p></section>`;

test('textoDoHtml tira as tags e decodifica as entidades', () => {
  assert.equal(textoDoHtml('A <b>b</b> &amp; c&nbsp;d &#233; &#x2014; &quot;e&quot;'), 'A b & c d é — "e"');
  assert.equal(textoDoHtml('<span class="page-break"></span>  Oi\n  você'), 'Oi você');
});

test('recortarSecao pega a seção do título, com as subseções, e para nela', () => {
  const s = recortarSecao(PAGINA, '200');
  assert.ok(s.startsWith('<section id="sec2">'));
  assert.ok(s.includes('Dentro da subseção'));
  assert.ok(!s.includes('Já é outra') && !s.includes('Fora da seção'));
  assert.equal(recortarSecao(PAGINA, '999'), null);
  assert.equal(recortarSecao(PAGINA, ''), null);
});

test('blocosDoHtml: títulos com o número, parágrafos e itens com o marcador e o nível', () => {
  const b = blocosDoHtml(recortarSecao(PAGINA, '200'));
  assert.deepEqual(b[0], { tipo: 'titulo', num: '9.2', texto: 'Perguntas de exemplo', ancora: 'title2' });
  assert.deepEqual(b[1], { tipo: 'p', texto: 'Introdução com link & entidade aqui.' });
  assert.deepEqual(b[2], { tipo: 'item', marcador: '1.', nivel: 1, textos: ['Primeira pergunta?'] });
  assert.deepEqual(b[3], { tipo: 'item', marcador: '2.', nivel: 1, textos: ['Segunda, parte A.', 'Parte B?'] });
  assert.deepEqual(b[4], { tipo: 'item', marcador: '•', nivel: 2, textos: ['Subitem'] });
  assert.deepEqual(b[5], { tipo: 'titulo', num: '9.2.1', texto: 'Subseção', ancora: 'title3' });
  assert.deepEqual(b[6], { tipo: 'p', texto: 'Dentro da subseção.' });
  assert.equal(b.length, 7);
});

test('todo roteiro da aba tem fonte oficial, e só eles', () => {
  assert.equal(IDS_ROTEIROS.length, 8);
  assert.deepEqual(Object.keys(FONTES_ROTEIRO).sort(), IDS_ROTEIROS.sort());
  for (const f of Object.values(FONTES_ROTEIRO)) {
    for (const p of f.partes) assert.match(p.uri, /^\/manual\/[a-z0-9-]+(\/[a-z0-9-]+)?$/);
  }
});

test('lerRoteiroOficial lê só as páginas da lista e monta a fonte com o link da seção', async () => {
  const pedidas = [];
  const buscarJson = async u => {
    pedidas.push(u);
    return { content: { body: PAGINA.replace('data-aid="200"', `data-aid="${FONTES_ROTEIRO['recom-renovacao'].partes[0].aid}"`) } };
  };
  const r = await lerRoteiroOficial('recom-renovacao', buscarJson);
  assert.equal(r.semLista, false);
  assert.equal(r.partes.length, 1);
  assert.equal(r.partes[0].fonte, 'Manual Geral 9.2');
  assert.equal(r.partes[0].url, 'https://www.churchofjesuschrist.org/study/manual/general-handbook/26-temple-recommends?lang=por&id=title2#title2');
  assert.deepEqual(pedidas, [urlDoConteudo('/manual/general-handbook/26-temple-recommends')]);
  assert.ok(pedidas[0].startsWith('https://www.churchofjesuschrist.org/study/api/v3/language-pages/type/content?lang=por&uri='));

  assert.equal(await lerRoteiroOficial('../../etc', buscarJson), null);
  assert.equal(await lerRoteiroOficial('constructor', buscarJson), null);
  // seção que sumiu da página (o Manual mudou): erro, para o app mostrar o link
  await assert.rejects(lerRoteiroOficial('recom-renovacao', async () => ({ content: { body: '<p>nada</p>' } })));
  assert.equal((await lerRoteiroOficial('jovens-anual', async () => ({ content: { body: PAGINA.replace('data-aid="200"', 'data-aid="151405242"') } }))).semLista, true);
});
