// =============================================
// STATUS / SYNC UI
// =============================================
import { loadAcompanhamentos, renderAcompanhamentos } from './acompanhamento.js';
import { renderAgenda } from './agenda.js';
import { renderCalendario } from './calendario.js';
import { carregarChamados } from './chamados.js';
import { API_AGENDA, API_DESIG, API_EVENTOS, API_REUNIOES, API_SAC, DADOS } from './config.js';
import { renderDesignacoes } from './designacoes.js';
import { inicioAposCarga } from './inicio.js';
import { carregarMovimentacoes } from './membros.js';
import { ajustarCriacaoNaFila, comIdReal, enviarFilaPendente, esperarEnvio, isOnline, lerFila, limparCacheApp, salvarNaFila } from './offline-pwa.js';
import { aplicarPendentes } from './pendentes.js';
import { renderReunioes } from './reunioes.js';
import { renderSacramentais, sacCarregado, setSacCarregado } from './sacramental.js';
import { haModalAberto } from './ui.js';
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
// Gravações em andamento: a recarga que aplica uma versão nova do app espera
// por elas (ver esperarGravacoes) — recarregar no meio de um "Salvar" perdia a
// alteração sem aviso.
const gravacoes = new Set();
export const esperarGravacoes = () => Promise.allSettled([...gravacoes]);
export const haGravacoes = () => gravacoes.size > 0;

// O id que o módulo deve pôr na tela para o que foi criado sem sinal: o mesmo
// que a fila guarda (local_<ts>). Com um id diferente do da fila, editar ou
// excluir o item antes de ele sair não achava nada, e ele aparecia duplicado.
export const idProvisorioDo = erro => erro?.idLocal || ('local_' + Date.now());

// Põe na fila e devolve o erro já com o id provisório (para POST)
async function enfileirar(url, method, body, erro) {
  const ts = await salvarNaFila(url, method, body);
  if (method === 'POST') erro.idLocal = 'local_' + ts;
  return erro;
}

export function apiFetch(url, method = 'GET', body = null) {
  if (method === 'GET') return enviar(url, method, body);
  const p = enviar(url, method, body);   // registrada já no início, de forma síncrona
  gravacoes.add(p);
  p.finally(() => gravacoes.delete(p)).catch(() => {});
  return p;
}

async function enviar(url, method, body) {
  const escrita = method !== 'GET';
  // Criado sem sinal e já enviado: a tela ainda tem o id provisório. Espera um
  // envio que esteja saindo AGORA — ele pode estar criando justamente este item.
  if (escrita) { await esperarEnvio(); url = comIdReal(url); }
  // criado sem sinal e ainda na fila: ajusta a própria criação (offline-pwa.js)
  if (escrita && method !== 'POST') {
    const ajuste = await ajustarCriacaoNaFila(url, method, body);
    if (ajuste === 'removido') return null;            // só existia neste aparelho
    if (ajuste === 'mesclado') throw new Error('pendente');
  }
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  if (!isOnline) {
    const erro = new Error('offline');
    throw escrita ? await enfileirar(url, method, body, erro) : erro;
  }
  // Com alterações esperando na fila, a nova não passa na frente delas: uma
  // edição chegaria antes da criação que ela edita, ou seria desfeita por uma
  // alteração mais antiga que saísse depois.
  if (escrita && (await lerFila()).some(i => i.url)) {
    await enviarFilaPendente();
    if ((await lerFila()).some(i => i.url)) throw await enfileirar(url, method, body, new Error('pendente'));
  }
  // Prazo: sem ele, uma rede que não responde deixava o "Sincronizando…" e a
  // atualização do app esperando para sempre. A gravação que estoura vai para a fila.
  if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) opts.signal = AbortSignal.timeout(15000);
  try {
    const res = await fetch(url, opts);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.status === 204 ? null : await res.json();
  } catch(e) {
    throw escrita ? await enfileirar(url, method, body, e) : e;
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
  // Nomes dos chamados e quadro de membros vem ANTES: as listas abaixo ja
  // renderizam com eles (responsavel com nome, telefone do membro no convite).
  // O quadro antes vinha embutido no app; agora so existe no servidor, entao
  // esperar a aba Membros ser aberta deixaria a agenda sem membros.
  //
  // Um load que estoura (um registro torto vindo do servidor quebrando o render
  // da aba) conta como "não carregou". Sem isto o Promise.all rejeitava inteiro
  // e o Início nunca saía de "Carregando…".
  const semRejeitar = p => Promise.resolve(p).catch(() => false);
  const [okChamados, okMembros] = await Promise.all([carregarChamados(), carregarMovimentacoes()].map(semRejeitar));
  const r = await Promise.all([
    loadAgenda(), loadReunioes(), loadDesignacoes(),
    loadEventos(), loadSacramentais(), loadAcompanhamentos(),
  ].map(semRejeitar));
  // O Início junta várias coleções: redesenha uma vez, depois que todas
  // voltaram, sabendo quais vieram do servidor. Não usa o `ok` geral abaixo —
  // ele cai se só os chamados ou o quadro de membros falharem, e o Início
  // diria "sem conexão" com a agenda carregada.
  // O que ainda está na fila (salvo sem sinal) volta por cima do que o servidor
  // mandou — senão sumia da tela até ser enviado. Ver pendentes.js.
  const colecoes = ['agenda', 'reunioes', 'designacoes', 'eventos_extras', 'sacramentais', 'acompanhamentos'];
  const recarregadas = new Set(colecoes.filter((c, i) => r[i]));
  const fila = recarregadas.size ? await lerFila() : [];
  if (fila.length && aplicarPendentes(DADOS, fila, recarregadas)) {
    renderAgenda(); renderReunioes(); renderDesignacoes(); renderCalendario(); renderAcompanhamentos();
    if (sacCarregado) renderSacramentais();
  }
  const [agenda, , designacoes, eventos, sacramentais, acomp] = r;
  inicioAposCarga({ agenda, designacoes, eventos, sacramentais, acomp });
  return okChamados && okMembros && r.every(Boolean);
}

export async function carregarDados() {
  setSyncStatus('syncing');
  try {
    // o que ficou na fila de uma sessão anterior vai antes de buscar
    if (isOnline) await enviarFilaPendente();
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
  if (haModalAberto()) return;
  try {
    // a fila sai primeiro; o que não sair continua aparecendo (aplicarPendentes)
    await enviarFilaPendente();
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
