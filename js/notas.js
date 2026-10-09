// =============================================
// ABA NOTAS — Privadas (localStorage) + Compartilhadas (Blobs)
// =============================================
import { apiFetch, atualizarUltimaSinc, avisarPendente, idProvisorioDo, setSyncStatus } from './api.js';
import { confirmar, pedirTexto } from './dialogo.js';
import { lerFila } from './offline-pwa.js';
import { aplicarPendentes } from './pendentes.js';
import { USUARIO, toast } from './usuario.js';
import { esc } from './utils.js';

export const API_NOTAS = '/api/notas';
export const NOTAS_PRIV_KEY = 'notas_privadas';

// Migração única: versões antigas guardavam sob "notas_privadas_anon"
(function migrarNotasAntigas() {
  try {
    const legado = localStorage.getItem('notas_privadas_anon');
    if (legado && !localStorage.getItem(NOTAS_PRIV_KEY)) {
      localStorage.setItem(NOTAS_PRIV_KEY, legado);
      localStorage.removeItem('notas_privadas_anon');
    }
  } catch (e) {}
})();

// Isto roda no carregamento do módulo: um JSON corrompido aqui derrubava o app
// inteiro (nenhuma aba abria, sem erro visível). Na dúvida, começa vazio e
// preserva o conteúdo suspeito numa chave à parte, para não perder nada.
function lerNotasPrivadas() {
  let bruto = null;
  try { bruto = localStorage.getItem(NOTAS_PRIV_KEY); } catch (e) { return []; }
  if (!bruto) return [];
  try {
    const v = JSON.parse(bruto);
    if (Array.isArray(v)) return v;
  } catch (e) {}
  try {
    localStorage.setItem(NOTAS_PRIV_KEY + '_corrompido', bruto);
    localStorage.removeItem(NOTAS_PRIV_KEY);
  } catch (e) {}
  return [];
}

export let NOTAS_PRIVADAS = lerNotasPrivadas();
export let NOTAS_COMPARTILHADAS = [];
export let filNotas = 'todas';

export function salvarNotasPrivadas() {
  localStorage.setItem(NOTAS_PRIV_KEY, JSON.stringify(NOTAS_PRIVADAS));
}

export function setFilNotas(val, btn) {
  filNotas = val;
  document.querySelectorAll('#filtros-notas .filtro-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderNotas();
}

export async function carregarNotasCompartilhadas() {
  try {
    const res = await fetch(API_NOTAS);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        // o que foi salvo sem sinal continua aparecendo até sair (pendentes.js)
        const d = { notas: data };
        aplicarPendentes(d, await lerFila(), new Set(['notas']));
        NOTAS_COMPARTILHADAS = d.notas;
      }
    }
  } catch (e) {}
  renderNotas();
}

export function renderNotas() {
  const el = document.getElementById('lista-notas');
  if (!el) return;

  let lista = [];
  if (filNotas === 'todas' || filNotas === 'privada') {
    lista = lista.concat(NOTAS_PRIVADAS.map(n => ({ ...n, scope: 'privada' })));
  }
  if (filNotas === 'todas' || filNotas === 'compartilhada') {
    lista = lista.concat(NOTAS_COMPARTILHADAS.map(n => ({ ...n, scope: 'compartilhada' })));
  }
  lista.sort((a, b) => (b.criadaEm || '').localeCompare(a.criadaEm || ''));

  if (!lista.length) { el.innerHTML = '<div class="vazia">📭 Nenhuma nota</div>'; return; }

  el.innerHTML = lista.map(n => `
    <div class="nota-card ${n.scope}">
      <div class="nota-header">
        <span class="nota-tipo ${n.scope}">${n.scope === 'privada' ? '🔒 Privada' : '🌐 Compartilhada'}</span>
        <div style="display:flex;gap:6px">
          <button class="btn-secondary" style="font-size:11px;padding:4px 10px" data-act="editar" data-id="${n.id}" data-scope="${n.scope}">✏️</button>
          <button class="btn-danger" data-act="excluir" data-id="${n.id}" data-scope="${n.scope}">🗑</button>
        </div>
      </div>
      ${n.titulo ? `<div style="font-weight:700;color:var(--text1);margin-bottom:4px">${esc(n.titulo)}</div>` : ''}
      <div class="nota-texto">${esc(n.texto)}</div>
      <div class="nota-meta">
        ${n.autor ? `👤 ${esc(n.autor)} · ` : ''}${n.criadaEm ? new Date(n.criadaEm).toLocaleDateString('pt-BR') : ''}
      </div>
    </div>
  `).join('');
}

export async function novaNota(scope) {
  const r = await pedirTexto(scope === 'privada' ? '🔒 Nova nota privada' : '🌐 Nova nota compartilhada', [
    { id: 'titulo', label: 'Título (opcional)' },
    { id: 'texto', label: 'Texto', tipo: 'textarea', obrigatorio: true },
  ]);
  if (r === null) return;
  const nota = {
    id: 'n_' + Date.now(),
    titulo: r.titulo,
    texto: r.texto,
    autor: USUARIO || 'Não identificado',
    criadaEm: new Date().toISOString(),
  };

  if (scope === 'privada') {
    NOTAS_PRIVADAS.push(nota);
    salvarNotasPrivadas();
  } else {
    // Pela fila do apiFetch: sem sinal, sai ao sincronizar (antes, um fetch
    // solto — a nota se perdia). E fica com o id que o servidor deu: com o id
    // daqui, editar ou excluir a nota recém-criada não achava nada lá.
    NOTAS_COMPARTILHADAS.push(nota);
    renderNotas();
    try {
      const criada = await apiFetch(API_NOTAS, 'POST', nota);
      if (criada?.id) {
        // a lista pode ter sido recarregada enquanto a nota saía
        if (NOTAS_COMPARTILHADAS.includes(nota)) NOTAS_COMPARTILHADAS = NOTAS_COMPARTILHADAS.map(n => n === nota ? criada : n);
        else if (!NOTAS_COMPARTILHADAS.some(n => n.id === criada.id)) NOTAS_COMPARTILHADAS.push(criada);
      }
      atualizarUltimaSinc(); setSyncStatus('ok');
      toast('Nota adicionada');
    } catch (e) {
      nota.id = idProvisorioDo(e);   // o mesmo id da fila (pendentes.js)
      if (!NOTAS_COMPARTILHADAS.some(n => n.id === nota.id)) NOTAS_COMPARTILHADAS.push(nota);
      avisarPendente('nota');
    }
  }
  renderNotas();
  if (scope === 'privada') toast('Nota adicionada');
}

export async function editarNota(id, scope) {
  const arr = scope === 'privada' ? NOTAS_PRIVADAS : NOTAS_COMPARTILHADAS;
  const nota = arr.find(n => n.id === id);
  if (!nota) return;
  const r = await pedirTexto('Editar nota', [
    { id: 'titulo', label: 'Título (opcional)', valor: nota.titulo || '' },
    { id: 'texto', label: 'Texto', tipo: 'textarea', valor: nota.texto || '', obrigatorio: true },
  ]);
  if (r === null) return;
  nota.titulo = r.titulo;
  nota.texto = r.texto;
  if (scope === 'privada') {
    salvarNotasPrivadas();
  } else {
    renderNotas();
    try {
      await apiFetch(API_NOTAS + '?id=' + encodeURIComponent(id), 'PUT', { titulo: nota.titulo, texto: nota.texto });
      atualizarUltimaSinc(); setSyncStatus('ok');
    } catch (e) { avisarPendente('alteração da nota'); }
  }
  renderNotas();
}

export async function excluirNota(id, scope) {
  if (!await confirmar('Excluir esta nota?', { perigo: true, okLabel: 'Excluir' })) return;
  if (scope === 'privada') {
    NOTAS_PRIVADAS = NOTAS_PRIVADAS.filter(n => n.id !== id);
    salvarNotasPrivadas();
  } else {
    NOTAS_COMPARTILHADAS = NOTAS_COMPARTILHADAS.filter(n => n.id !== id);
    renderNotas();
    try { await apiFetch(API_NOTAS + '?id=' + encodeURIComponent(id), 'DELETE'); atualizarUltimaSinc(); setSyncStatus('ok'); }
    catch (e) { avisarPendente('exclusão da nota'); }
  }
  renderNotas();
}

function ligarNotas() {
  document.getElementById('filtros-notas')?.addEventListener('click', e => {
    const btn = e.target.closest('.filtro-btn');
    if (btn) setFilNotas(btn.dataset.fil, btn);
  });

  document.getElementById('notas-acoes')?.addEventListener('click', e => {
    const btn = e.target.closest('button[data-scope]');
    if (btn) novaNota(btn.dataset.scope);
  });

  document.getElementById('lista-notas')?.addEventListener('click', e => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    if (btn.dataset.act === 'editar') editarNota(btn.dataset.id, btn.dataset.scope);
    else if (btn.dataset.act === 'excluir') excluirNota(btn.dataset.id, btn.dataset.scope);
  });
}
ligarNotas();

// (o gancho de troca de aba vive em app.js)
