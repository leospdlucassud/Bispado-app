// =============================================
// STATUS / SYNC UI
// =============================================
import { loadAcompanhamentos } from './acompanhamento.js';
import { renderAgenda } from './agenda.js';
import { renderCalendario } from './calendario.js';
import { API_AGENDA, API_DESIG, API_EVENTOS, API_REUNIOES, API_SAC, DADOS } from './config.js';
import { renderDesignacoes } from './designacoes.js';
import { enviarFilaPendente, isOnline, limparCacheApp, salvarNaFila } from './offline-pwa.js';
import { renderReunioes } from './reunioes.js';
import { renderSacramentais, sacCarregado, setSacCarregado } from './sacramental.js';
import { toast } from './usuario.js';

export function showSync(msg) {}  // mantido por compatibilidade

// A alteração foi aceita na tela mas o servidor não confirmou: ela está na fila
// e sai na próxima sincronização. Sem este aviso o usuário acha que salvou —
// foi assim que uma exclusão sumiu de um aparelho e continuou existindo no outro.
export function avisarPendente(acao = 'alteração') {
  setSyncStatus('erro');
  toast(`Sem conexão com o servidor — a ${acao} será enviada ao sincronizar`);
}

// Devolve o botão de sincronizar sempre com a estrutura interna esperada.
// Antes, quem escrevia innerHTML no botão apagava #sync-icone e .sync-label —
// e a partir daí setSyncStatus caía no guard e virava um no-op silencioso.
function elementosSync() {
  const btn = document.getElementById('sync-btn');
  if (!btn) return null;
  let icon = btn.querySelector('.sync-icone');
  let label = btn.querySelector('.sync-label');
  if (!icon || !label) {
    btn.innerHTML = '<span class="sync-icone" id="sync-icone">⟳</span><span class="sync-label"> Sincronizar</span>';
    icon = btn.querySelector('.sync-icone');
    label = btn.querySelector('.sync-label');
  }
  if (!icon.id) icon.id = 'sync-icone';
  return { btn, icon, label };
}

// Troca só o texto do botão, preservando ícone e estrutura.
export function rotuloSync(texto) {
  const el = elementosSync();
  if (el) el.label.textContent = texto;
}

export function setSyncStatus(status) {
  const el = elementosSync();
  if (!el) return;
  const { btn, icon, label } = el;
  btn.className = 'sync-btn ' + status;
  btn.disabled = status === 'syncing';
  if (status === 'syncing') {
    icon.textContent = '⟳';
    icon.style.display = 'inline-block';
    icon.style.animation = 'spin-sync .8s linear infinite';
    label.textContent = ' Sincronizando…';
  } else if (status === 'ok') {
    icon.textContent = '✓';
    icon.style.animation = '';
    label.textContent = ' Sincronizado';
    setTimeout(() => {
      if (btn.className.includes('ok')) {
        icon.textContent = '⟳';
        label.textContent = ' Sincronizar';
        btn.className = 'sync-btn';
      }
    }, 3000);
  } else if (status === 'erro') {
    icon.textContent = '⚠';
    icon.style.animation = '';
    label.textContent = ' Sem conexão';
    setTimeout(() => {
      if (btn.className.includes('erro')) {
        icon.textContent = '⟳';
        label.textContent = ' Sincronizar';
        btn.className = 'sync-btn';
      }
    }, 4000);
  }
}

export function atualizarUltimaSinc() {
  const el = document.getElementById('sync-ultima');
  if (!el) return;
  const n = new Date();
  el.textContent = 'Última sincronização: ' +
    String(n.getHours()).padStart(2,'0') + ':' +
    String(n.getMinutes()).padStart(2,'0') + ':' +
    String(n.getSeconds()).padStart(2,'0');
}

// =============================================
// API — fetch com fallback para fila offline
// =============================================
export async function apiFetch(url, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  if (!isOnline) {
    if (method !== 'GET') await salvarNaFila(url, method, body);
    throw new Error('offline');
  }
  try {
    const res = await fetch(url, opts);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.status === 204 ? null : await res.json();
  } catch(e) {
    if (method !== 'GET') await salvarNaFila(url, method, body);
    throw e;
  }
}

// =============================================
// LOAD / SAVE por recurso
// =============================================
// Cada load* devolve true se conseguiu trazer dados do servidor. Sem isso o
// Promise.all de carregarDados nunca rejeitava e o app dizia "Sincronizado"
// mesmo sem rede.
export async function loadAgenda() {
  try {
    const data = await apiFetch(API_AGENDA);
    if (Array.isArray(data)) { DADOS.agenda = data; renderAgenda(); return true; }
    return false;
  } catch(e) { renderAgenda(); return false; }
}

export async function loadReunioes() {
  try {
    const data = await apiFetch(API_REUNIOES);
    if (Array.isArray(data)) { DADOS.reunioes = data; renderReunioes(); return true; }
    return false;
  } catch(e) { renderReunioes(); return false; }
}

export async function loadDesignacoes() {
  try {
    const data = await apiFetch(API_DESIG);
    if (Array.isArray(data)) { DADOS.designacoes = data; renderDesignacoes(); return true; }
    return false;
  } catch(e) { renderDesignacoes(); return false; }
}

export async function loadEventos() {
  try {
    const data = await apiFetch(API_EVENTOS);
    if (Array.isArray(data)) { DADOS.eventos_extras = data; renderCalendario(); return true; }
    return false;
  } catch(e) { renderCalendario(); return false; }
}

export async function loadSacramentais() {
  try {
    const data = await apiFetch(API_SAC);
    if (Array.isArray(data)) { DADOS.sacramentais = data; setSacCarregado(true); renderSacramentais(); return true; }
    return false;
  } catch(e) { if (sacCarregado) renderSacramentais(); return false; }
}

async function carregarTudo() {
  const r = await Promise.all([
    loadAgenda(), loadReunioes(), loadDesignacoes(),
    loadEventos(), loadSacramentais(), loadAcompanhamentos(),
  ]);
  return r.every(Boolean);
}

export async function carregarDados() {
  setSyncStatus('syncing');
  try {
    if (await carregarTudo()) { atualizarUltimaSinc(); setSyncStatus('ok'); }
    else setSyncStatus('erro');
  } catch(e) {
    setSyncStatus('erro');
  }
}

// =============================================
// ATUALIZAÇÃO AUTOMÁTICA
// Sem isso, uma alteração feita no computador só aparecia no celular quando
// alguém apertava sincronizar. Roda apenas com o app em primeiro plano — em
// segundo plano não adianta gastar rede e bateria de ninguém.
// =============================================
export const INTERVALO_ATUALIZACAO = 30000;

export async function atualizarEmSegundoPlano() {
  if (document.visibilityState !== 'visible' || !isOnline) return;
  // não troca os dados debaixo de um formulário aberto
  if (document.querySelector('.modal-overlay.open')) return;
  try {
    if (await carregarTudo()) atualizarUltimaSinc();
  } catch (e) { /* silencioso: o botão de sincronizar continua sendo o caminho manual */ }
}

export function iniciarAtualizacaoAutomatica() {
  setInterval(atualizarEmSegundoPlano, INTERVALO_ATUALIZACAO);
}

export async function sincronizarManual() {
  setSyncStatus('syncing');
  limparCacheApp(); // limpa cache do app durante sync manual
  try {
    await enviarFilaPendente();
    if (await carregarTudo()) { atualizarUltimaSinc(); setSyncStatus('ok'); }
    else setSyncStatus('erro');
  } catch(e) {
    setSyncStatus('erro');
  }
}
