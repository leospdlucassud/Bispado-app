// Imprimir / PDF (js/impressao.js e o @media print do style.css) — `npm test`.
// O módulo mexe no DOM; aqui se confere o que não pode se perder numa edição.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const ler = f => readFileSync(join(RAIZ, f), 'utf8');
const IMPRESSAO = ler('js/impressao.js');
const CSS = ler('css/style.css');
const INDEX = ler('index.html');

const blocoPrint = () => {
  const i = CSS.indexOf('@media print {');
  assert.ok(i >= 0, 'sem @media print no style.css');
  let prof = 0, j = i + '@media print '.length;
  for (; j < CSS.length; j++) { if (CSS[j] === '{') prof++; else if (CSS[j] === '}' && --prof === 0) break; }
  return CSS.slice(i, j);
};

test('toda aba com botão de imprimir existe no index.html', () => {
  const lista = IMPRESSAO.match(/IMPRIMIVEIS = \[([^\]]+)\]/)[1].match(/'([^']+)'/g).map(s => s.slice(1, -1));
  assert.ok(lista.length >= 8);
  for (const id of lista) assert.ok(INDEX.includes(`id="panel-${id}"`), id);
});

test('no papel, o sigiloso sai só com a linha sem nome nem assunto', () => {
  const p = blocoPrint();
  assert.match(p, /\[data-sigiloso\] > :not\(\.sigilo-papel\)\s*\{\s*display:none !important;/);
  for (const f of ['js/agenda.js', 'js/acompanhamento.js']) {
    const s = ler(f);
    assert.ok(s.includes("data-sigiloso") && s.includes('sigilo-papel'), f);
  }
});

test('o papel tem o topo da folha e não tem a navegação', () => {
  const p = blocoPrint();
  assert.match(p, /#impressao-topo \{ display:block !important;/);
  // #search-results fica fora da busca e das abas: aberto, levava ao papel até entrevista sigilosa
  for (const sel of ['header', '.barra-nav', '#search-results', '.demo-faixa', '.modal-overlay', '.impressao-barra']) assert.ok(p.includes(sel), sel);
});

// ---------- o topo da folha ----------
import { detalheDaFolha, semContagem } from '../js/impressao-regras.js';

test('com item sigiloso na lista, o termo da busca não vai para o papel', () => {
  const d = detalheDaFolha({ filtros: ['Todas (17)'], buscas: ['Queiroz Bastos, Rosa'], temSigiloso: true });
  assert.ok(!d.includes('Rosa'), d);
  assert.match(d, /o termo não sai no papel, por sigilo/);
  assert.match(d, /Itens sigilosos saem sem nome nem assunto/);
  assert.ok(d.startsWith('Todas · '), d);
});

test('sem sigiloso, a busca, o filtro, o select e o mês vão para o topo', () => {
  assert.equal(detalheDaFolha({ periodo: ['Outubro 2026'], filtros: ['Pendentes (4)'], selecoes: ['Responsável: Bispo'], buscas: ['  souza '] }),
    'Outubro 2026 · Pendentes · Responsável: Bispo · Busca: “souza”');
  assert.equal(detalheDaFolha({}), '');
  assert.equal(semContagem('Conselho da Ala (1)'), 'Conselho da Ala');
});

test('as abas com lista cortada na tela saem inteiras no papel', () => {
  assert.match(ler('js/rodizio.js'), /addEventListener\('beforeprint'[\s\S]{0,300}rodLimite = Infinity/);
  assert.match(ler('js/calendario.js'), /addEventListener\('beforeprint'[\s\S]{0,200}todosNoDia = true/);
});
