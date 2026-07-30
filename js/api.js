// =============================================
// STATUS / SYNC UI
// =============================================
export function showSync(msg) {}  // mantido por compatibilidade

export function setSyncStatus(status) {
  const btn  = document.getElementById('sync-btn');
  const icon = document.getElementById('sync-icone');
  if (!btn || !icon) return;
  btn.className = 'sync-btn ' + status;
  btn.disabled = status === 'syncing';
  if (status === 'syncing') {
    icon.textContent = '⟳';
    icon.style.display = 'inline-block';
    icon.style.animation = 'spin-sync .8s linear infinite';
    btn.querySelector('.sync-label').textContent = ' Sincronizando…';
  } else if (status === 'ok') {
    icon.textContent = '✓';
    icon.style.animation = '';
    btn.querySelector('.sync-label').textContent = ' Sincronizado';
    setTimeout(() => {
      if (btn.className.includes('ok')) {
        icon.textContent = '⟳';
        btn.querySelector('.sync-label').textContent = ' Sincronizar';
        btn.className = 'sync-btn';
      }
    }, 3000);
  } else if (status === 'erro') {
    icon.textContent = '⚠';
    icon.style.animation = '';
    btn.querySelector('.sync-label').textContent = ' Sem conexão';
    setTimeout(() => {
      if (btn.className.includes('erro')) {
        icon.textContent = '⟳';
        btn.querySelector('.sync-label').textContent = ' Sincronizar';
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
export async function loadAgenda() {
  try {
    const data = await apiFetch(API_AGENDA);
    if (Array.isArray(data)) { DADOS.agenda = data; renderAgenda(); }
  } catch(e) { renderAgenda(); }
}

export async function loadReunioes() {
  try {
    const data = await apiFetch(API_REUNIOES);
    if (Array.isArray(data)) { DADOS.reunioes = data; renderReunioes(); }
  } catch(e) { renderReunioes(); }
}

export async function loadDesignacoes() {
  try {
    const data = await apiFetch(API_DESIG);
    if (Array.isArray(data)) { DADOS.designacoes = data; renderDesignacoes(); }
  } catch(e) { renderDesignacoes(); }
}

export async function loadEventos() {
  try {
    const data = await apiFetch(API_EVENTOS);
    if (Array.isArray(data)) { DADOS.eventos_extras = data; renderCalendario(); }
  } catch(e) { renderCalendario(); }
}

export async function loadSacramentais() {
  try {
    const data = await apiFetch(API_SAC);
    if (Array.isArray(data)) { DADOS.sacramentais = data; sacCarregado = true; renderSacramentais(); }
  } catch(e) { if (sacCarregado) renderSacramentais(); }
}

export async function carregarDados() {
  setSyncStatus('syncing');
  try {
    await Promise.all([loadAgenda(), loadReunioes(), loadDesignacoes(), loadEventos(), loadSacramentais(), loadAcompanhamentos()]);
    atualizarUltimaSinc();
    setSyncStatus('ok');
  } catch(e) {
    setSyncStatus('erro');
  }
}

export async function sincronizarManual() {
  setSyncStatus('syncing');
  limparCacheApp(); // limpa cache do app durante sync manual
  try {
    await enviarFilaPendente();
    await Promise.all([loadAgenda(), loadReunioes(), loadDesignacoes(), loadEventos(), loadSacramentais(), loadAcompanhamentos()]);
    atualizarUltimaSinc();
    setSyncStatus('ok');
  } catch(e) {
    setSyncStatus('erro');
  }
}
