// ── FILA OFFLINE (IndexedDB) ──
import { atualizarUltimaSinc, carregarDados, esperarGravacoes, haGravacoes, rotuloSync, setSyncStatus } from './api.js';
import { MODO_CONVITE, VERSAO } from './config.js';
import { idProvisorio } from './pendentes.js';
import { haModalAberto, quandoSemModal } from './ui.js';
import { toast } from './usuario.js';

export const DB_NAME = 'bispado-offline';
export const STORE_Q = 'fila-pendente';
export let dbInstance = null;

export function abrirDB() {
  return new Promise((resolve, reject) => {
    if (dbInstance) return resolve(dbInstance);
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore(STORE_Q, { keyPath: 'id', autoIncrement: true });
    req.onsuccess = e => { dbInstance = e.target.result; resolve(dbInstance); };
    req.onerror = () => reject(req.error);
  });
}

// Guarda a requisição inteira (url + método + corpo) para reenviar depois.
// A assinatura antiga era (chave, dados) e recebia 3 argumentos de apiFetch:
// o corpo era descartado e a fila guardava o método no lugar dele.
// Devolve o ts do item: 'local_' + ts é o id provisório do que foi criado sem
// sinal (ver pendentes.js) — o mesmo que o módulo põe na tela, para os dois
// lados falarem do mesmo item. Estritamente crescente: dois itens no mesmo
// milissegundo teriam o mesmo id.
let ultimoTs = 0;
export async function salvarNaFila(url, method, body) {
  const ts = ultimoTs = Math.max(Date.now(), ultimoTs + 1);
  try {
    const db = await abrirDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_Q, 'readwrite');
      tx.objectStore(STORE_Q).add({ url, method, body, ts });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch(e) {}
  atualizarContadorPendentes();
  return ts;
}

const idDaUrl = url => { try { return new URL(url, location.href).searchParams.get('id'); } catch (e) { return null; } };
const caminhoDa = url => { try { return new URL(url, location.href).pathname; } catch (e) { return ''; } };

// Ids definitivos do que foi criado sem sinal e já saiu da fila: até a próxima
// carga, a tela ainda usa o provisório (local_…), e uma edição tem de ir para o
// id que o servidor deu.
const idsReais = new Map();
export function comIdReal(url) {
  const id = idDaUrl(url);
  if (!id || !idsReais.has(id)) return url;
  const u = new URL(url, location.href);
  u.searchParams.set('id', idsReais.get(id));
  return u.pathname + u.search;
}

// Editar ou excluir algo criado sem sinal, cuja criação ainda está na fila: em
// vez de mandar um PUT/DELETE para um id que o servidor nunca viu (que voltava
// 404 e era descartado — a edição sumia e o excluído reaparecia), ajusta a
// própria criação. Devolve 'mesclado', 'removido' ou false (não era o caso).
export async function ajustarCriacaoNaFila(url, method, body) {
  const id = idDaUrl(url);
  if (!id || !id.startsWith('local_')) return false;
  if (envioEmCurso) await envioEmCurso.catch(() => {});   // a criação pode estar saindo agora
  // e um envio não começa no meio do ajuste (mandaria a criação sem a edição)
  let liberar;
  ajusteEmCurso = new Promise(r => { liberar = r; });
  try { return await ajustar(url, method, body, id); }
  finally { ajusteEmCurso = null; liberar(); }
}

let ajusteEmCurso = null;

async function ajustar(url, method, body, id) {
  const fila = await lerFila();
  const criacao = fila.find(i => i.method === 'POST' && idProvisorio(i) === id && caminhoDa(i.url) === caminhoDa(url));
  if (!criacao) return false;
  try {
    const db = await abrirDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_Q, 'readwrite');
      const st = tx.objectStore(STORE_Q);
      if (method === 'DELETE') {
        // nunca chegou ao servidor: some da fila, com o que mais houver para ele
        for (const i of fila) if (i === criacao || idDaUrl(i.url) === id) st.delete(i.id);
      } else {
        st.put({ ...criacao, body: { ...(criacao.body || {}), ...(body || {}) } });
      }
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) { return false; }
  atualizarContadorPendentes();
  return method === 'DELETE' ? 'removido' : 'mesclado';
}

export async function lerFila() {
  try {
    const db = await abrirDB();
    return new Promise((resolve, reject) => {
      const req = db.transaction(STORE_Q, 'readonly').objectStore(STORE_Q).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = reject;
    });
  } catch(e) { return []; }
}

export async function removerDaFila(id) {
  try {
    const db = await abrirDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_Q, 'readwrite');
      tx.objectStore(STORE_Q).delete(id);
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });
  } catch(e) {}
}

// Alterações recusadas de vez pelo servidor (ex.: editar algo já excluído em
// outro aparelho). Um toast sumia — coberto pelo toast da gravação seguinte —
// e a perda passava despercebida: fica no botão da barra até a pessoa tocar.
const CHAVE_RECUSADAS = 'recusadas_nao_vistas';
let recusadasNaoVistas = (() => { try { return parseInt(localStorage.getItem(CHAVE_RECUSADAS), 10) || 0; } catch (e) { return 0; } })();
const guardarRecusadas = () => { try { localStorage.setItem(CHAVE_RECUSADAS, String(recusadasNaoVistas)); } catch (e) {} };
function mostrarRecusadas() {
  guardarRecusadas();
  toast(recusadasNaoVistas === 1
    ? 'Uma alteração foi recusada pelo servidor e descartada'
    : `${recusadasNaoVistas} alterações foram recusadas pelo servidor e descartadas`);
  atualizarContadorPendentes();
}
export function verRecusadas() {
  if (!recusadasNaoVistas) return false;
  toast(recusadasNaoVistas === 1
    ? 'Uma alteração foi recusada pelo servidor (o item já não existia lá) e não foi salva'
    : `${recusadasNaoVistas} alterações foram recusadas pelo servidor (os itens já não existiam lá) e não foram salvas`);
  recusadasNaoVistas = 0;
  guardarRecusadas();
  atualizarContadorPendentes();
  return true;
}

// Quantas alterações esperam o servidor — fica à mostra na barra de
// sincronização até sair (o aviso de "sem conexão" somia em 4 s).
export async function atualizarContadorPendentes() {
  const el = document.getElementById('sync-pendentes');
  if (!el) return;
  const n = (await lerFila()).filter(i => i.url).length;
  const r = recusadasNaoVistas;
  el.hidden = !n && !r;
  // Recusada tem cara própria (✕, vermelho, texto curto que aparece também no
  // celular): igual a "⚠ 1 não enviada", parecia algo que ainda ia sair.
  el.classList.toggle('recusadas', !!r);
  const partes = [];
  if (n) partes.push(`<span class="pend-num">⚠ ${n}</span><span class="pend-txt">${n === 1 ? ' alteração não enviada' : ' alterações não enviadas'}</span>`);
  if (r) partes.push(`<span class="pend-rec">✕ ${r} ${r === 1 ? 'recusada' : 'recusadas'}</span>`);
  // só números e textos fixos: nada de texto de usuário aqui
  el.innerHTML = partes.join('<span class="pend-sep"> · </span>');
  const descricao = [
    n && `${n} ${n === 1 ? 'alteração não enviada' : 'alterações não enviadas'} (guardada neste aparelho)`,
    r && `${r} ${r === 1 ? 'recusada' : 'recusadas'} pelo servidor`,
  ].filter(Boolean).join('; ');
  el.title = descricao + ' — toque para ver e enviar';
  el.setAttribute('aria-label', el.title);
}

// Uma remessa por vez: o "voltou a rede" e o Sincronizar ao mesmo tempo
// mandavam a mesma alteração duas vezes (e duplicavam o que era criado).
let envioEmCurso = null;
export function enviarFilaPendente() {
  if (!envioEmCurso) {
    envioEmCurso = (async () => {
      if (ajusteEmCurso) await ajusteEmCurso;
      return enviarFila();
    })().finally(() => { envioEmCurso = null; atualizarContadorPendentes(); });
  }
  return envioEmCurso;
}
// Espera um envio da fila que já esteja em andamento (sem começar um novo)
export const esperarEnvio = () => (envioEmCurso ? envioEmCurso.catch(() => {}) : Promise.resolve());

async function enviarFila() {
  const fila = await lerFila();
  // Itens do formato antigo ({chave, dados}) não têm o corpo da alteração e são
  // impossíveis de reenviar — descarta para a fila não crescer para sempre.
  const antigos = fila.filter(i => !i.url);
  for (const i of antigos) await removerDaFila(i.id);

  const pendentes = fila.filter(i => i.url).sort((a, b) => a.ts - b.ts);
  if (!pendentes.length) return;

  setSyncStatus('syncing');
  rotuloSync(` Enviando ${pendentes.length} pendente${pendentes.length > 1 ? 's' : ''}…`);

  let enviados = 0, recusados = 0, falhou = false, enviouNotas = false;
  for (const item of pendentes) {
    try {
      const res = await fetch(comIdReal(item.url), {
        method: item.method,
        headers: { 'Content-Type': 'application/json' },
        body: item.body != null ? JSON.stringify(item.body) : undefined,
      });
      if (res.ok) {
        if (item.method === 'POST') {
          const criado = await res.clone().json().catch(() => null);
          if (criado?.id != null) idsReais.set(idProvisorio(item), String(criado.id));
        }
        if (caminhoDa(item.url) === '/api/notas') enviouNotas = true;
        await removerDaFila(item.id); enviados++; continue;
      }
      // 409 é conflito de escrita simultânea e 429 é excesso de chamadas:
      // nos dois casos vale tentar de novo depois
      if (res.status === 409 || res.status === 408 || res.status === 429) { falhou = true; break; }
      // demais 4xx não adianta repetir (ex.: PUT num id que só existia aqui)
      if (res.status >= 400 && res.status < 500) { await removerDaFila(item.id); recusados++; continue; }
      falhou = true; break;   // servidor fora do ar: guarda o resto para depois
    } catch(e) { falhou = true; break; }
  }

  // o servidor recusou de vez (ex.: editar algo que já foi excluído em outro
  // aparelho): sai da fila, mas sem fingir que deu certo
  if (recusados) { recusadasNaoVistas += recusados; mostrarRecusadas(); }
  // as notas compartilhadas não estão no carregarTudo: recarrega para pegar o id do servidor
  // ...depois das gravações em voo (uma nota nova pode estar saindo agora)
  if (enviouNotas) import('./notas.js').then(async m => { await esperarGravacoes(); m.carregarNotasCompartilhadas(); }).catch(() => {});
  if (falhou) { setSyncStatus('erro'); return 0; }
  atualizarUltimaSinc();
  setSyncStatus('ok');
  return enviados;   // quem chamou recarrega, para pegar os ids definitivos
}

abrirDB().catch(() => {});
if (!MODO_CONVITE) document.addEventListener('DOMContentLoaded', () => atualizarContadorPendentes());

// ── PWA — Service Worker externo + detecção de nova versão ──
export let swRegistration = null;
export let isOnline = navigator.onLine;

// Na tela do convite (MODO_CONVITE) nada daqui roda além do isOnline: o membro
// só responde. Antes, voltar do WhatsApp para a aba disparava a carga completa
// do painel — agenda, membros, atas, acompanhamentos — no celular dele.
window.addEventListener('online',  async () => {
  isOnline = true;
  if (MODO_CONVITE) return;
  setSyncStatus('ok');
  await enviarFilaPendente();
  carregarDados();   // recarrega já com o que a fila enviou
});
window.addEventListener('offline', () => {
  isOnline = false;
  if (MODO_CONVITE) return;
  setSyncStatus('erro');
  rotuloSync(' Sem conexão');
});

// sem service worker no convite: não há por que guardar o app inteiro no
// celular de quem só veio responder
if ('serviceWorker' in navigator && !MODO_CONVITE) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => {
        swRegistration = reg;

        // Se já há versão nova esperando → aplica imediatamente
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }

        // Quando nova versão terminar de instalar → aplica na hora
        reg.addEventListener('updatefound', () => {
          const novaSW = reg.installing;
          if (!novaSW) return;
          novaSW.addEventListener('statechange', () => {
            if (novaSW.state === 'installed') {
              // Força ativação imediata — nova versão ativa SEM precisar
              // de uma segunda abertura do app
              novaSW.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });

        // Verificar atualização silenciosa ao abrir — aguarda instalação
        verificarAtualizacaoSilenciosa(reg);
      })
      .catch(() => {});

    // Quando SW troca (nova versão ativada) → recarrega a página imediatamente
    let reloading = false;
    // Só recarrega quando uma versão nova substitui uma que já controlava a
    // página. Na primeira visita não há versão antiga: o service worker só
    // assume a página (clients.claim), e recarregar ali reabria o app sozinho
    // segundos depois de aberto.
    const tinhaVersaoAnterior = !!navigator.serviceWorker.controller;
    // com um formulário aberto, espera ele fechar: recarregar perdia o digitado
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading || !tinhaVersaoAnterior) return;
      reloading = true;
      quandoSemModal(recarregarParaAtualizar);
    });

    // Confirmação do SW que o cache foi limpo e renovado
    navigator.serviceWorker.addEventListener('message', e => {
      if (e.data?.type === 'CACHE_REFRESHED') {
        console.log('[PWA] Cache do app renovado com sucesso');
      }
    });
  });
}

export async function verificarAtualizacaoSilenciosa(reg) {
  if (!isOnline) return;
  try {
    await reg.update();
    // Se já há uma versão instalada esperando, força skip agora
    if (reg.waiting) {
      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  } catch(e) {}
}

// Envia mensagem ao SW para limpar e regenerar cache do app
export function limparCacheApp() {
  if (!swRegistration || !swRegistration.active) return;
  swRegistration.active.postMessage({ type: 'CLEAR_AND_REFRESH_CACHE' });
}

// Ouve confirmação do SW que o cache foi renovado
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', e => {
    if (e.data?.type === 'CACHE_REFRESHED') {
      console.log('[SW] Cache do app renovado com sucesso.');
    }
  });
}

// Quando usuário volta ao app: verifica nova versão E recarrega dados
document.addEventListener('visibilitychange', () => {
  if (MODO_CONVITE) return;
  if (document.visibilityState === 'visible') {
    if (swRegistration && isOnline) {
      verificarAtualizacaoSilenciosa(swRegistration);
      limparCacheApp(); // renova cache ao retornar ao app
    }
    // instalado, voltar para o app conta como abrir: confere a versao publicada
    verificarVersaoServidor();
    if (isOnline) carregarDados();
  }
});

// =============================================
// ATUALIZACAO DO APP INSTALADO
// No navegador a pessoa recarrega e pronto. Instalado (PWA) a tela fica aberta
// por dias e pode ficar presa numa versao antiga se o service worker nao
// atualizar. Entao, ao abrir e ao voltar para o app, comparamos a versao que
// esta rodando com a publicada em /version.json e buscamos a nova se for o caso.
// =============================================

// Rodando como app instalado? (Android/desktop usam display-mode; iOS usa navigator.standalone)
export function estaInstalado() {
  return window.matchMedia?.('(display-mode: standalone)')?.matches === true
      || window.navigator.standalone === true;
}

// Compara "5.9.0" com "5.13.0" por NUMERO, nao por texto: como texto, "5.9.0"
// seria "maior" que "5.13.0" e o app nunca atualizaria.
export function compararVersoes(a, b) {
  const pa = String(a).split('.').map(n => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

const CHAVE_TENTATIVA = 'atualizacao-tentada';

export async function verificarVersaoServidor() {
  if (!estaInstalado() || !isOnline) return;
  let publicada;
  try {
    const res = await fetch('/version.json', { cache: 'no-store' });
    if (!res.ok) return;
    publicada = (await res.json())?.versao;
  } catch (e) { return; }
  if (!publicada || compararVersoes(publicada, VERSAO) <= 0) return;

  // Trava anti-loop: se recarregar nao trouxer a versao nova (cache de CDN, por
  // exemplo), sem isso o app ficaria recarregando para sempre.
  try {
    if (sessionStorage.getItem(CHAVE_TENTATIVA) === publicada) return;
    sessionStorage.setItem(CHAVE_TENTATIVA, publicada);
  } catch (e) { /* sem sessionStorage: segue sem a trava */ }

  toast(`Atualizando para a versão ${publicada}…`);
  await aplicarAtualizacao();
}

// Busca a versao nova: limpa o cache do app, pede ao service worker que assuma
// e recarrega. O reload fica mesmo sem service worker (navegador sem suporte).
export async function aplicarAtualizacao() {
  try {
    if (window.caches) {
      for (const k of await caches.keys()) await caches.delete(k);
    }
  } catch (e) {}
  try {
    const reg = swRegistration || await navigator.serviceWorker?.getRegistration();
    await reg?.update();
    (reg?.waiting || reg?.installing)?.postMessage({ type: 'SKIP_WAITING' });
  } catch (e) {}
  setTimeout(() => quandoSemModal(recarregarParaAtualizar), 600);
}

// Recarrega para a versão nova sem atropelar nada: espera o formulário fechar
// (quandoSemModal) e as gravações em andamento terminarem — inclusive a da
// fila. Recarregar no meio de um "Salvar" perdia a alteração sem aviso.
async function recarregarParaAtualizar() {
  // em laço: durante a espera a pessoa pode ter aberto outro formulário ou
  // começado outra gravação (cada fetch tem prazo de 15 s, ver api.js)
  for (let i = 0; i < 20; i++) {
    if (haModalAberto()) return quandoSemModal(recarregarParaAtualizar);
    if (!haGravacoes() && !envioEmCurso) return window.location.reload();
    await esperarGravacoes();
    if (envioEmCurso) await envioEmCurso.catch(() => {});
  }
  window.location.reload();
}

// Na abertura do app instalado
window.addEventListener('load', () => { if (!MODO_CONVITE) verificarVersaoServidor(); });

export let dp=null;
export const banner=document.createElement('div');
banner.innerHTML=`<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap"><span style="font-size:22px">📱</span><div style="flex:1;min-width:160px"><div style="font-weight:700;font-size:14px">Instalar como App</div><div style="font-size:12px;color:var(--text2);margin-top:2px">Acesse offline, sem precisar do link</div></div><button id="pwa-install" style="background:#c9a84c;color:#0d1b2a;border:none;padding:8px 18px;border-radius:20px;font-weight:700;cursor:pointer;font-size:13px">Instalar</button><button id="pwa-dismiss" style="background:transparent;color:var(--text2);border:none;padding:8px;cursor:pointer;font-size:18px">✕</button></div>`;
Object.assign(banner.style,{display:'none',position:'fixed',bottom:'0',left:'0',right:'0',background:'var(--bg3)',color:'var(--text1)',borderTop:'2px solid #c9a84c',padding:'14px 18px',zIndex:'9999',boxShadow:'0 -4px 20px rgba(0,0,0,.5)'});
document.body.appendChild(banner);
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  if (MODO_CONVITE) return;   // o convite não oferece instalar o painel
  dp = e;
  banner.style.display = 'block';
  const btnH = document.getElementById('btn-instalar-header');
  if (btnH) btnH.classList.add('visivel');
});
// Dispara o instalador nativo. Usada pelo banner e pelo botão do cabeçalho.
export async function installPWA() {
  if (!dp) { toast('Use o menu do navegador para instalar (Adicionar à tela inicial).'); return; }
  dp.prompt();
  await dp.userChoice;
  dp = null;
  banner.style.display = 'none';
  const btnH = document.getElementById('btn-instalar-header');
  if (btnH) btnH.classList.remove('visivel');
}
document.getElementById('pwa-install').addEventListener('click', installPWA);
document.getElementById('pwa-dismiss').addEventListener('click',()=>{banner.style.display='none';});
window.addEventListener('appinstalled', () => {
  banner.style.display = 'none';
  const btnH = document.getElementById('btn-instalar-header');
  if (btnH) btnH.classList.remove('visivel');
});

(function(){
  const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
  const isSafari=/safari/i.test(navigator.userAgent)&&!/chrome/i.test(navigator.userAgent);
  const isStandalone=window.matchMedia('(display-mode: standalone)').matches;
  if(isIOS&&isSafari&&!isStandalone&&!sessionStorage.getItem('ios-dismissed')){
    const tip=document.createElement('div');
    tip.innerHTML=`<div style="display:flex;align-items:flex-start;gap:10px"><span style="font-size:20px">📲</span><div style="flex:1"><div style="font-weight:700;font-size:13px;margin-bottom:4px">Instalar no iPhone/iPad</div><div style="font-size:12px;color:var(--text2);line-height:1.6">Toque em <strong style="--c:#c9a84c">Compartilhar</strong> (□↑) → <strong style="--c:#c9a84c">"Adicionar à Tela de Início"</strong></div></div><button id="ios-dismiss" style="background:transparent;color:var(--text2);border:none;padding:4px;cursor:pointer;font-size:16px">✕</button></div>`;
    Object.assign(tip.style,{position:'fixed',bottom:'0',left:'0',right:'0',background:'var(--bg3)',color:'var(--text1)',borderTop:'2px solid #5b9bd5',padding:'14px 18px',zIndex:'9999',boxShadow:'0 -4px 20px rgba(0,0,0,.5)'});
    document.body.appendChild(tip);
    document.getElementById('ios-dismiss').addEventListener('click',()=>{tip.remove();sessionStorage.setItem('ios-dismissed','1');});
  }
})();
