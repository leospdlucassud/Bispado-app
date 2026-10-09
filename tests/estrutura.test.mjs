// Estrutura do app — as regras que já quebraram (ou quase) e que nenhum outro
// teste pega. Rodar com `npm test`. Lê os arquivos como texto, sem navegador.
//
// Por que cada uma existe:
// - painel fora do #main-content: um </div> a mais deixou 3 abas em branco de
//   29/07 a 08/10/2026 (v5.17.1) sem ninguém perceber;
// - módulo fora do main.js ou do ASSETS: funciona online e quebra offline;
// - handler inline (onclick=): o app saiu disso na migração para ES Modules e
//   a CSP do netlify.toml os bloquearia;
// - pushState fora do ui.js: a pilha de modais e o Voltar dependem de um dono só.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const ler = arq => readFileSync(join(RAIZ, arq), 'utf8');
const INDEX = ler('index.html');
const MODULOS = readdirSync(join(RAIZ, 'js')).filter(f => f.endsWith('.js')).sort();
// páginas com entrada própria: não entram no main.js (ver o comentário dele)
const FORA_DO_MAIN = ['convite.js', 'redirecionar-convite.js'];
const semComentarios = html => html.replace(/<!--[\s\S]*?-->/g, m => m.replace(/[^\n]/g, ' '));

test('todo painel é filho direto do #main-content', () => {
  const html = semComentarios(INDEX);
  const re = /<div\b[^>]*>|<\/div\s*>/gi;
  const pilha = [];
  const pais = {};
  let m;
  while ((m = re.exec(html))) {
    if (m[0][1] === '/') { pilha.pop(); continue; }
    const id = (m[0].match(/\bid="([^"]+)"/) || [])[1] || null;
    if (id?.startsWith('panel-')) pais[id] = pilha.at(-1);
    pilha.push(id);
  }
  assert.equal(pilha.length, 0, 'há <div> sem fechamento (ou </div> sobrando) no index.html');
  const fora = Object.entries(pais).filter(([, pai]) => pai !== 'main-content');
  assert.deepEqual(fora, [], 'painéis dentro de outro elemento (somem da tela)');
});

test('cada aba tem botão, painel e opção no seletor do celular', () => {
  const botoes = [...INDEX.matchAll(/class="tab-btn[^"]*" data-tab="([^"]+)"/g)].map(m => m[1]).sort();
  const seletor = INDEX.slice(INDEX.indexOf('class="tabs-select"'));
  const opcoes = [...seletor.slice(0, seletor.indexOf('</select>')).matchAll(/<option value="([^"]+)"/g)].map(m => m[1]).sort();
  const paineis = [...INDEX.matchAll(/<div[^>]*\bid="panel-([^"]+)"/g)].map(m => m[1]).sort();
  assert.ok(botoes.length >= 10, 'não achei os botões das abas');
  assert.deepEqual(opcoes, botoes, 'seletor do celular e botões das abas divergem');
  assert.deepEqual(paineis, botoes, 'abas sem painel, ou painel sem aba');
});

test('o main.js carrega todos os módulos de js/', () => {
  const main = ler('js/main.js');
  const importados = [...main.matchAll(/^import '\.\/([^']+)';/gm)].map(m => m[1]).sort();
  const esperados = MODULOS.filter(f => f !== 'main.js' && !FORA_DO_MAIN.includes(f));
  assert.deepEqual(importados, esperados);
});

test('o service worker guarda todos os arquivos do app, e todos existem', () => {
  const sw = ler('sw.js');
  const lista = sw.slice(sw.indexOf('const ASSETS'), sw.indexOf('];', sw.indexOf('const ASSETS')));
  const assets = [...lista.matchAll(/'(\/[^']*)'/g)].map(m => m[1]);
  const inexistentes = assets.filter(a => a !== '/' && !existsSync(join(RAIZ, a)));
  assert.deepEqual(inexistentes, [], 'ASSETS aponta para arquivos que não existem (o SW não instala)');
  const faltando = [
    ...MODULOS.map(f => '/js/' + f), '/index.html', '/convite.html', '/css/style.css',
    '/manifest.webmanifest', '/icons/sprite.svg',
  ].filter(a => !assets.includes(a));
  assert.deepEqual(faltando, [], 'arquivos fora do ASSETS (não abrem sem internet)');
});

test('nenhum handler inline (onclick= etc.) no HTML nem nos templates', () => {
  const arquivos = ['index.html', 'convite.html', ...MODULOS.map(f => 'js/' + f)];
  const achados = arquivos.flatMap(arq =>
    [...ler(arq).matchAll(/<[a-z][^>]*?(?<![\w-])(on[a-z]+)\s*=\s*["']/gi)].map(m => `${arq}: ${m[1]}`));
  assert.deepEqual(achados, []);
});

test('só o ui.js mexe na pilha do histórico (pushState, go, back)', () => {
  const achados = MODULOS.filter(f => f !== 'ui.js')
    .filter(f => /history\.(pushState|go|back|forward)\s*\(/.test(ler('js/' + f).replace(/\/\/.*$/gm, '')));
  assert.deepEqual(achados, [], 'use registrarNoHistorico/fecharModal do ui.js');
});

test('a versão é a mesma em config.js, version.json, sw.js e package.json', () => {
  const versoes = {
    'js/config.js': ler('js/config.js').match(/export const VERSAO = '([^']+)'/)?.[1],
    'version.json': JSON.parse(ler('version.json')).versao,
    'sw.js': ler('sw.js').match(/const CACHE = 'bispado-app-v([^']+)'/)?.[1],
    'package.json': JSON.parse(ler('package.json')).version,
  };
  const unicas = [...new Set(Object.values(versoes))];
  assert.equal(unicas.length, 1, `versões divergem: ${JSON.stringify(versoes)} — use node scripts/versao.mjs`);
});

test('ids únicos no index.html e no convite.html', () => {
  for (const arq of ['index.html', 'convite.html']) {
    const ids = [...semComentarios(ler(arq)).matchAll(/\sid="([^"$]+)"/g)].map(m => m[1]);
    const repetidos = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
    assert.deepEqual(repetidos, [], `${arq}: id repetido`);
  }
});

test('todo ícone usado existe no sprite', () => {
  const sprite = new Set([...ler('icons/sprite.svg').matchAll(/<symbol id="i-([^"]+)"/g)].map(m => m[1]));
  const usados = new Set([
    ...[INDEX, ...MODULOS.map(f => ler('js/' + f))].flatMap(s => [
      ...[...s.matchAll(/sprite\.svg#i-([a-z0-9-]+)/g)].map(m => m[1]),
      ...[...s.matchAll(/\bico\('([a-z0-9-]+)'\)/g)].map(m => m[1]),
    ]),
  ]);
  assert.ok(usados.size > 10, 'não achei os ícones usados');
  assert.deepEqual([...usados].filter(n => !sprite.has(n)), [], 'ícone sem <symbol> no icons/sprite.svg');
});
