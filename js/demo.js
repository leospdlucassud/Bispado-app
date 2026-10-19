// =============================================
// MODO DEMONSTRAÇÃO — `?demo` na URL
//
// Para apresentar o app sem expor a ala. Os dados são fictícios (demo-dados.js)
// e moram só neste navegador. Nada da demonstração chega aos dados da ala, e
// nada dos dados da ala aparece na demonstração:
//  - todo pedido ao /api/ é atendido por demo-servidor.js, sem ir à rede;
//  - o localStorage e o IndexedDB ganham um compartimento próprio (prefixo
//    "demo:"): notas privadas, cargo escolhido, fila de alterações sem sinal e
//    tema da demonstração não tocam nos do app de verdade.
//
// Por isso este módulo é o PRIMEIRO import do main.js e do convite.js: o
// desvio tem de existir antes de qualquer módulo ler o armazenamento (notas.js,
// usuario.js e tema.js leem ao carregar) ou buscar dados.
//
// O que liga o modo é a URL; o que o mantém é o sessionStorage, que morre com a
// aba. Fechar a aba encerra a demonstração, e o endereço normal abre o app de
// verdade. Os dados valem pelo dia em que foram gerados (as datas saem de
// hoje): dentro do mesmo dia, recarregar ou abrir outra aba preserva o que foi
// mexido. "Recomeçar dados" e a virada do dia geram tudo de novo — e as outras
// abas da demonstração recarregam sozinhas.
// =============================================

import { gerar } from './demo-dados.js';
import { criarServidor } from './demo-servidor.js';
import { dataLocal } from './utils.js';

// Sobe quando demo-dados.js muda de forma: a carga guardada deixa de valer e é
// gerada de novo, em vez de abrir dados no formato antigo
export const VERSAO_DEMO = 6;   // 6: os relatórios da aba Vamos crescer a Ala e um ano de frequência nas atas

const CHAVE_ABA = 'bispado_demo';       // sessionStorage: a demonstração vale por aba
const PREFIXO = 'demo:';                // compartimento do localStorage e do IndexedDB
const MARCA = 'srv:_semeado';           // "VERSAO|dia" da carga atual
const PREFERENCIAS = ['theme', 'escalaFonte'];   // sobrevivem ao "Recomeçar dados"

function pedidaNestaAba() {
  let naUrl = false;
  try { naUrl = new URLSearchParams(location.search).has('demo'); } catch (e) { /* sem location */ }
  try {
    if (naUrl) sessionStorage.setItem(CHAVE_ABA, '1');
    return sessionStorage.getItem(CHAVE_ABA) === '1';
  } catch (e) { return naUrl; }
}

export const EM_DEMO = typeof window !== 'undefined' && pedidaNestaAba();

// ---------- compartimento próprio ----------
const S = typeof Storage !== 'undefined' ? Storage.prototype : null;
const original = S ? { getItem: S.getItem, setItem: S.setItem, removeItem: S.removeItem, key: S.key } : null;
const ehLocal = st => { try { return st === window.localStorage; } catch (e) { return false; } };

function separarArmazenamento() {
  const k = (st, chave) => (ehLocal(st) ? PREFIXO + chave : chave);
  S.getItem = function (chave) { return original.getItem.call(this, k(this, chave)); };
  S.setItem = function (chave, valor) { return original.setItem.call(this, k(this, chave), valor); };
  S.removeItem = function (chave) { return original.removeItem.call(this, k(this, chave)); };
  // clear() apagaria os dados de verdade: na demonstração, limpa só o compartimento
  S.clear = function () {
    if (!ehLocal(this)) return;
    for (const c of chavesDaDemo()) original.removeItem.call(this, c);
  };
  if (typeof IDBFactory !== 'undefined') {
    const abrir = IDBFactory.prototype.open, apagar = IDBFactory.prototype.deleteDatabase;
    IDBFactory.prototype.open = function (nome, ...resto) { return abrir.call(this, PREFIXO + nome, ...resto); };
    IDBFactory.prototype.deleteDatabase = function (nome) { return apagar.call(this, PREFIXO + nome); };
  }
}

function chavesDaDemo() {
  const ls = window.localStorage, todas = [];
  for (let i = 0; i < ls.length; i++) {
    const c = original.key.call(ls, i);
    if (c && c.startsWith(PREFIXO)) todas.push(c);
  }
  return todas;
}

// ---------- a carga fictícia ----------
const marcaDeHoje = () => `${VERSAO_DEMO}|${dataLocal()}`;
const ler = nome => { try { return JSON.parse(localStorage.getItem('srv:' + nome) || 'null'); } catch (e) { return null; } };
const gravar = (nome, valor) => localStorage.setItem('srv:' + nome, JSON.stringify(valor));

// Tudo que pode falhar (gerar) vem ANTES de apagar: uma falha deixa a
// demonstração como estava, em vez de vazia. O dia entra no id: uma aba
// esquecida aberta desde ontem não acha (e não altera) o registro de hoje que
// herdaria o mesmo id.
function semear() {
  const hoje = dataLocal();
  const carga = gerar(hoje);
  const dia = hoje.replace(/-/g, '');
  const criadoEm = new Date().toISOString();
  const colecoes = Object.entries(carga.colecoes).map(([nome, linhas]) =>
    [nome, linhas.map((l, i) => ({ id: `demo-${dia}-${nome}-${i}`, criadoEm, ...l }))]);

  for (const c of chavesDaDemo()) {
    if (!PREFERENCIAS.some(p => c === PREFIXO + p)) original.removeItem.call(window.localStorage, c);
  }
  // e a fila de alterações sem sinal da demonstração (IndexedDB "demo:bispado-offline",
  // pelo desvio acima): sem isto, o que ficou nela voltava por cima da carga nova.
  // Com o banco aberto nesta página, a exclusão espera o reload fechá-lo — e a
  // abertura da página nova espera a exclusão (o IndexedDB atende em ordem).
  try { indexedDB.deleteDatabase('bispado-offline'); } catch (e) { /* sem IndexedDB: não há fila */ }
  for (const [nome, linhas] of colecoes) gravar(nome, linhas);
  gravar('membros', carga.membros);
  // um documento só, como o /api/chamados (demo-servidor.js) o lê
  gravar('chamados', carga.chamados);
  // idem o /api/crescimento: { publico, privado } — o privado (a lista das
  // recomendações, com o elenco fictício) sai só com a sessão, que já vem aberta
  gravar('crescimento', carga.crescimento);
  localStorage.setItem('notas_privadas', JSON.stringify(carga.notasPrivadas));
  // abre como o bispo, que vê tudo (inclusive o sigiloso); a troca de cargo é
  // parte do que se demonstra
  localStorage.setItem('cargo_atual', 'Bispo');
  // ...já conectado (o login do Bispo e do ADM também se demonstra: senha "demo")
  localStorage.setItem('sessao_bispado', JSON.stringify({ papel: 'bispo', token: 'demo.bispo', exp: Date.now() + 30 * 24 * 60 * 60 * 1000 }));
  localStorage.setItem(MARCA, marcaDeHoje());
}

// ---------- a rede ----------
function desviarRede() {
  const fetchReal = window.fetch.bind(window);
  const servidor = criarServidor({ ler, gravar });
  window.fetch = async function (entrada, opcoes) {
    let req;
    try { req = new Request(entrada, opcoes); } catch (e) { return fetchReal(entrada, opcoes); }
    const url = new URL(req.url, location.href);
    const daApi = url.origin === location.origin && /^\/(api|\.netlify)\//.test(url.pathname);
    if (!daApi) return fetchReal(entrada, opcoes);
    await new Promise(r => setTimeout(r, 80));   // um respiro, como a rede: o "Sincronizando…" aparece
    return servidor.atender(req);
  };
}

// ---------- a faixa ----------
const naPaginaDoMembro = () => /\/convite\.html$/.test(location.pathname);

function pintarFaixa() {
  const faixa = document.createElement('div');
  faixa.className = 'demo-faixa';
  faixa.setAttribute('role', 'note');
  faixa.innerHTML = `<span><strong>🎭 Demonstração</strong> — dados fictícios, guardados só neste navegador. Nada aqui chega aos dados da ala.</span>`
    + (FALHA_DEMO ? '<span class="demo-faixa__erro">Não foi possível montar os dados da demonstração. Toque em “Recomeçar dados”.</span>' : '')
    + (naPaginaDoMembro() ? '' : `<span class="demo-faixa__acoes">
        <button type="button" class="demo-faixa__btn" data-demo="recomecar">Recomeçar dados</button>
        <button type="button" class="demo-faixa__btn" data-demo="sair">Sair da demonstração</button></span>`);
  faixa.addEventListener('click', async e => {
    const acao = e.target.closest('[data-demo]')?.dataset.demo;
    if (acao === 'recomecar') {
      const { confirmar } = await import('./dialogo.js');
      if (!await confirmar('Recomeçar a demonstração? Os dados fictícios voltam ao estado inicial, e o que foi mexido durante a apresentação se perde.', { okLabel: 'Recomeçar' })) return;
      try { semear(); } catch (err) {
        console.error('[demo] falha ao recomeçar:', err);
        const { toast } = await import('./usuario.js');
        toast('Não foi possível recomeçar agora — os dados atuais continuam.');
        return;
      }
      // fechar o diálogo devolve a entrada dele no histórico (history.go, em
      // ui.js), e essa volta cancelava o reload: espera ela terminar
      await new Promise(r => {
        const fim = () => { removeEventListener('popstate', fim); r(); };
        addEventListener('popstate', fim);
        setTimeout(fim, 900);
      });
      location.reload();
    } else if (acao === 'sair') {
      try { sessionStorage.removeItem(CHAVE_ABA); } catch (err) { /* segue */ }
      location.replace('/');
    }
  });
  document.body.prepend(faixa);
  // a tela do membro (convite.js) reescreve o <body> inteiro: a faixa volta
  new MutationObserver(() => { if (!faixa.isConnected) document.body.prepend(faixa); })
    .observe(document.body, { childList: true });
}

// ---------- liga ----------
export let FALHA_DEMO = '';
if (EM_DEMO) {
  separarArmazenamento();
  desviarRede();
  try {
    if (localStorage.getItem(MARCA) !== marcaDeHoje()) semear();
  } catch (err) {
    FALHA_DEMO = String(err?.message || err);
    console.error('[demo] falha ao montar a demonstração:', err);
  }
  // outra aba recomeçou (ou virou o dia): esta passaria a agir sobre registros
  // que não existem mais — recarrega
  window.addEventListener('storage', e => { if (e.key === PREFIXO + MARCA && e.newValue) location.reload(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pintarFaixa);
  else pintarFaixa();
}

// O link do convite que a demonstração manda leva o modo junto: a tela do
// membro (convite.html) abre os dados fictícios. No MESMO navegador são os
// mesmos dados, e a resposta chega ao painel. Em outro aparelho, ele gera a
// sua própria cópia do dia: as entrevistas da carga aparecem, uma criada na
// apresentação não, e a resposta fica lá — sem servidor não há como cruzar
// aparelhos (e um servidor quebraria o isolamento).
export const comDemo = url => (EM_DEMO ? url + (url.includes('?') ? '&' : '?') + 'demo' : url);

// O nome com que uma chave do localStorage aparece no evento `storage` (que
// traz a chave crua, sem o desvio): na demonstração, com o prefixo
export const chaveNoArmazenamento = chave => (EM_DEMO ? PREFIXO + chave : chave);
