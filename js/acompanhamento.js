// =============================================
// ACOMPANHAMENTO
// A lista junta duas origens: entrevistas marcadas para acompanhar (aba Agenda)
// e acompanhamentos avulsos criados aqui. Itens sigilosos só aparecem ao bispo.
// =============================================
import { renderAgenda } from './agenda.js';
import { apiFetch, setSyncStatus } from './api.js';
import { API_AGENDA, CARGOS, DADOS } from './config.js';
import { MEMBROS } from './dados-membros.js';
import { confirmar, pedirTexto } from './dialogo.js';
import { abrirModal, fecharModal } from './ui.js';
import { USUARIO, podeVer, toast } from './usuario.js';
import { esc, formatarData } from './utils.js';

export const API_ACOMP = '/api/acompanhamentos';
export let filAcomp = 'abertos';

export function setFilAcomp(val, btn) {
  filAcomp = val;
  document.querySelectorAll('#filtros-acomp .filtro-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderAcompanhamentos();
}

export async function loadAcompanhamentos() {
  try {
    const data = await apiFetch(API_ACOMP);
    if (Array.isArray(data)) DADOS.acompanhamentos = data;
  } catch {}
  renderAcompanhamentos();
}

// Unifica entrevistas marcadas e itens avulsos num formato só
export function listaAcompanhamentos() {
  const daAgenda = (DADOS.agenda || [])
    .filter(e => e.acompanhar)
    .map(e => ({
      id: e.id, origem: 'entrevista', titulo: e.membro, assunto: e.tipo,
      responsavel: { bispo:'Bispo', c1:'1º Conselheiro', c2:'2º Conselheiro', sec:'Secretário' }[e.responsavel] || e.responsavel,
      sigiloso: !!e.sigiloso, situacao: e.situacaoAcomp || 'aberto',
      registros: e.registros || [], data: e.data || '', ref: e,
    }));
  const avulsos = (DADOS.acompanhamentos || []).map(a => ({
    id: a.id, origem: 'avulso', titulo: a.titulo, assunto: a.assunto || '',
    responsavel: a.responsavel || '', sigiloso: !!a.sigiloso,
    situacao: a.situacao || 'aberto', registros: a.registros || [], data: a.data || '', ref: a,
  }));
  return [...daAgenda, ...avulsos].filter(podeVer);
}

export function renderAcompanhamentos() {
  const el = document.getElementById('lista-acomp');
  if (!el) return;
  const busca = (document.getElementById('busca-acomp')?.value || '').toLowerCase();
  const todos = listaAcompanhamentos();

  const stats = document.getElementById('acomp-stats');
  if (stats) {
    const abertos = todos.filter(a => a.situacao !== 'concluido').length;
    const meus = todos.filter(a => a.situacao !== 'concluido' && a.responsavel === USUARIO).length;
    const sig = todos.filter(a => a.sigiloso && a.situacao !== 'concluido').length;
    stats.innerHTML = `
      <div class="membros-stat"><div class="stat-num" style="color:#fbbf24">${abertos}</div><div class="stat-label">Em aberto</div></div>
      <div class="membros-stat"><div class="stat-num" style="color:#60a5fa">${meus}</div><div class="stat-label">Sob minha responsabilidade</div></div>
      <div class="membros-stat"><div class="stat-num" style="color:${sig?'#e05555':'#34d399'}">${sig}</div><div class="stat-label">Sigilosos</div></div>`;
  }

  let lista = todos.filter(a => {
    if (filAcomp === 'abertos')    return a.situacao !== 'concluido';
    if (filAcomp === 'meus')       return a.situacao !== 'concluido' && a.responsavel === USUARIO;
    if (filAcomp === 'sigilosos')  return a.sigiloso;
    if (filAcomp === 'concluidos') return a.situacao === 'concluido';
    return true;
  }).filter(a => !busca || [a.titulo, a.assunto, a.responsavel, a.registros.map(r=>r.texto).join(' ')].join(' ').toLowerCase().includes(busca))
    .sort((a,b) => (b.data||'').localeCompare(a.data||''));

  if (!lista.length) {
    el.innerHTML = todos.length
      ? `<div class="vazia">🔍 Nenhum acompanhamento com esse filtro</div>`
      : `<div class="vazia">🧭 Nenhum acompanhamento em aberto<br><span style="font-size:12px;opacity:.7">Marque uma entrevista como "precisa de acompanhamento" ou toque no + para criar um avulso</span></div>`;
    return;
  }


  el.innerHTML = lista.map(a => {
    const cor = a.situacao === 'concluido' ? '#34d399' : a.sigiloso ? '#e05555' : '#fbbf24';
    const ultimos = [...a.registros].sort((x,y)=>(y.data||'').localeCompare(x.data||'')).slice(0,3);
    return `
    <div class="acomp-card" style="border-left-color:${cor};${a.situacao==='concluido'?'opacity:.7':''}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:6px">
        <div style="min-width:0">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <span style="color:#c8d8e8;font-weight:700;font-size:14px">${esc(a.titulo)}</span>
            ${a.sigiloso ? '<span class="selo-sigilo">🔒 Sigiloso</span>' : ''}
            ${a.origem === 'entrevista' ? '<span style="font-size:10px;color:#34d399">via entrevista</span>' : ''}
            ${a.situacao === 'concluido' ? '<span style="font-size:10px;color:#34d399">✔ concluído</span>' : ''}
          </div>
          <div style="font-size:11.5px;color:#8eacc8;margin-top:3px">
            ${a.assunto ? esc(a.assunto) : ''}${a.responsavel ? ` · 👤 ${esc(a.responsavel)}` : ''}${a.data ? ` · 📅 ${formatarData(a.data)}` : ''}
          </div>
        </div>
        <div style="display:flex;gap:5px;flex-shrink:0">
          <button class="btn-secondary" style="font-size:11px;padding:4px 9px" data-act="registro" data-origem="${a.origem}" data-id="${a.id}">✚ Registro</button>
          <button class="btn-secondary" style="font-size:11px;padding:4px 9px" data-act="situacao" data-origem="${a.origem}" data-id="${a.id}">${a.situacao==='concluido'?'↩':'✓'}</button>
          <button class="btn-secondary" title="Assunto sigiloso" style="font-size:11px;padding:4px 9px${a.sigiloso?';color:#e05555;border-color:#e05555':''}" data-act="sigilo" data-origem="${a.origem}" data-id="${a.id}">${a.sigiloso?'🔒':'🔓'}</button>
          ${a.origem === 'avulso' ? `<button class="btn-danger" data-act="excluir" data-id="${a.id}">🗑</button>` : ''}
        </div>
      </div>
      ${ultimos.length ? ultimos.map(reg => `
        <div class="acomp-registro">
          <strong style="color:#8eacc8">${reg.data ? formatarData(reg.data) : ''}${reg.autor ? ' · ' + esc(reg.autor) : ''}</strong><br>${esc(reg.texto)}
        </div>`).join('') : '<div style="font-size:11px;color:#4a6a8a;margin-top:4px">Sem registros ainda</div>'}
      ${a.registros.length > 3 ? `<div style="font-size:10px;color:#4a6a8a;margin-top:4px">…e mais ${a.registros.length-3} registro(s)</div>` : ''}
    </div>`;
  }).join('');
}

export function acharAcomp(origem, id) {
  return origem === 'entrevista'
    ? (DADOS.agenda || []).find(e => e.id === id)
    : (DADOS.acompanhamentos || []).find(a => a.id === id);
}

export async function salvarAcomp(origem, item) {
  const url = origem === 'entrevista' ? `${API_AGENDA}?id=${item.id}` : `${API_ACOMP}?id=${item.id}`;
  try { await apiFetch(url, 'PUT', item); setSyncStatus('ok'); } catch {}
  renderAcompanhamentos();
  if (origem === 'entrevista') renderAgenda();
}

export async function abrirRegistroAcomp(origem, id) {
  const item = acharAcomp(origem, id);
  if (!item) return;
  const r = await pedirTexto('Novo registro', [
    { id: 'texto', label: 'O que foi conversado ou combinado', tipo: 'textarea', obrigatorio: true },
  ], { okLabel: 'Adicionar' });
  if (r === null) return;
  const texto = r.texto;
  item.registros = [...(item.registros || []), {
    data: new Date().toISOString().slice(0,10),
    autor: USUARIO || 'Não identificado',
    texto: texto.trim(),
  }];
  salvarAcomp(origem, item);
  toast('Registro adicionado');
}

export function alternarSituacaoAcomp(origem, id) {
  const item = acharAcomp(origem, id);
  if (!item) return;
  const campo = origem === 'entrevista' ? 'situacaoAcomp' : 'situacao';
  item[campo] = (item[campo] || 'aberto') === 'concluido' ? 'aberto' : 'concluido';
  salvarAcomp(origem, item);
}

// Liga/desliga o sigilo depois de criado. Em item vindo de entrevista, atualiza
// a própria entrevista (a fonte do campo sigiloso).
export function toggleSigiloAcomp(origem, id) {
  const item = acharAcomp(origem, id);
  if (!item) return;
  item.sigiloso = !item.sigiloso;
  salvarAcomp(origem, item);
  toast(item.sigiloso ? '🔒 Marcado como sigiloso' : 'Sigilo removido');
}

export async function excluirAcomp(id) {
  if (!await confirmar('Excluir este acompanhamento e seus registros?', { perigo: true, okLabel: 'Excluir' })) return;
  try { await apiFetch(`${API_ACOMP}?id=${id}`, 'DELETE'); } catch {}
  DADOS.acompanhamentos = (DADOS.acompanhamentos || []).filter(a => a.id !== id);
  renderAcompanhamentos();
}

export function abrirModalAcomp() {
  document.getElementById('modal-acomp-content').innerHTML = `
    <h3>🧭 Novo Acompanhamento <button class="modal-close" data-act="fechar">✕</button></h3>
    <div class="form-group">
      <label>Pessoa ou situação</label>
      <input list="lista-membros-dl2" class="form-input" id="ac-titulo" placeholder="Nome do membro ou descrição…">
      <datalist id="lista-membros-dl2">${MEMBROS.map(m=>`<option value="${m.name}">`).join('')}</datalist>
    </div>
    <div class="form-group">
      <label>Assunto</label>
      <input type="text" class="form-input" id="ac-assunto" placeholder="Ex.: apoio de bem-estar, reativação…">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Responsável</label>
        <select class="form-select" id="ac-resp">${CARGOS.map(c=>`<option value="${c}" ${c===USUARIO?'selected':''}>${c}</option>`).join('')}</select>
      </div>
      <div class="form-group">
        <label>Data</label>
        <input type="date" class="form-input" id="ac-data" value="${new Date().toISOString().slice(0,10)}">
      </div>
    </div>
    <div class="form-group">
      <label>Primeiro registro (opcional)</label>
      <textarea class="form-input" id="ac-registro" rows="2" placeholder="O que foi conversado ou combinado…" style="resize:vertical"></textarea>
    </div>
    <div class="form-group" style="background:rgba(255,255,255,.03);border-radius:10px;padding:10px 12px">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;color:#c8d8e8">
        <input type="checkbox" id="ac-sigiloso" style="width:16px;height:16px;accent-color:#e05555">
        🔒 Assunto sigiloso — somente o bispo visualiza
      </label>
    </div>
    <button class="btn-primary" data-act="salvar">💾 Salvar</button>`;
  abrirModal('modal-acomp');
}

export async function salvarNovoAcomp() {
  const titulo = document.getElementById('ac-titulo').value.trim();
  if (!titulo) return toast('Informe a pessoa ou a situação');
  const primeiro = document.getElementById('ac-registro').value.trim();
  const item = {
    titulo,
    assunto: document.getElementById('ac-assunto').value.trim(),
    responsavel: document.getElementById('ac-resp').value,
    data: document.getElementById('ac-data').value,
    sigiloso: document.getElementById('ac-sigiloso').checked,
    situacao: 'aberto',
    registros: primeiro ? [{ data: new Date().toISOString().slice(0,10), autor: USUARIO || 'Não identificado', texto: primeiro }] : [],
  };
  fecharModal('modal-acomp');
  if (!DADOS.acompanhamentos) DADOS.acompanhamentos = [];
  try {
    DADOS.acompanhamentos.push(await apiFetch(API_ACOMP, 'POST', item));
    setSyncStatus('ok');
  } catch {
    DADOS.acompanhamentos.push({ ...item, id: 'local_' + Date.now() });
  }
  renderAcompanhamentos();
  toast('Acompanhamento criado');
}

// Fase 4 da migração ESM: liga a aba Acompanhamento por delegação,
// no lugar dos onclick/oninput inline (busca, filtros, cards e modal).
function ligarAcompanhamento() {
  document.getElementById('busca-acomp')?.addEventListener('input', renderAcompanhamentos);

  document.getElementById('filtros-acomp')?.addEventListener('click', e => {
    const btn = e.target.closest('.filtro-btn');
    if (btn?.dataset.fil) setFilAcomp(btn.dataset.fil, btn);
  });

  document.getElementById('lista-acomp')?.addEventListener('click', e => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const { act, origem, id } = btn.dataset;
    switch (act) {
      case 'registro': abrirRegistroAcomp(origem, id); break;
      case 'situacao': alternarSituacaoAcomp(origem, id); break;
      case 'sigilo':   toggleSigiloAcomp(origem, id); break;
      case 'excluir':  excluirAcomp(id); break;
    }
  });

  document.getElementById('modal-acomp')?.addEventListener('click', e => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    if (btn.dataset.act === 'fechar') fecharModal('modal-acomp');
    else if (btn.dataset.act === 'salvar') salvarNovoAcomp();
  });
}
ligarAcompanhamento();
