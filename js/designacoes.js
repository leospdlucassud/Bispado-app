// =============================================
// DESIGNAÇÕES
// =============================================
import { apiFetch, atualizarUltimaSinc, avisarPendente, idProvisorioDo, setSyncStatus } from './api.js';
import { comNome } from './chamados.js';
import { reativarAbaAtual } from './app.js';
import { API_DESIG, CARGOS, DADOS, corDoCargo } from './config.js';
import { confirmar, pedirTexto } from './dialogo.js';
import { abrirModal, fecharModal } from './ui.js';
import { toast } from './usuario.js';
import { esc, formatarData } from './utils.js';

export let filDesig = 'ativas';

export function renderDesignacoes() {
  const el = document.getElementById('lista-designacoes');
  if (!el) return;
  const resp = document.getElementById('fil-desig-resp')?.value||'';
  let lista = DADOS.designacoes.filter(d=>{
    const resps = Array.isArray(d.responsaveis) ? d.responsaveis : [d.responsavel||''];
    const mR = !resp || resps.includes(resp);
    const isPerm = d.tipo === 'permanente';
    let mS;
    if (filDesig === 'todos') mS = true;
    else if (filDesig === 'ativas') mS = isPerm ? d.status !== 'inativa' : d.status !== 'concluido';
    else if (filDesig === 'permanentes') mS = isPerm;
    else mS = d.status === filDesig;
    return mR && mS;
  }).sort((a,b)=>(a.prazo||'9999').localeCompare(b.prazo||'9999'));
  if (!lista.length){el.innerHTML=`<div class="vazia">📭 Nenhuma designação</div>`;return;}
  const pct = {pendente:0,andamento:50,concluido:100,ativa:100,inativa:0};
  el.innerHTML = lista.map(d=>{
    const isPerm = d.tipo === 'permanente';
    const resps = Array.isArray(d.responsaveis) ? d.responsaveis : [d.responsavel||''];
    const respsHtml = resps.map(r => `<span style="--c:${corDoCargo(r)}">👤 ${esc(comNome(r))}</span>`).join(' ');
    const statusLabel = isPerm
      ? (d.status==='inativa'?'⏸ Inativa':'📌 Ativa')
      : (d.status==='andamento'?'Em Andamento':d.status.charAt(0).toUpperCase()+d.status.slice(1));
    const statusClass = isPerm ? (d.status==='inativa'?'nao-realizada':'realizada') : d.status;
    return `<div class="desig-card" style="${isPerm?'border-left:3px solid #a78bfa;':''}${d.status==='inativa'?'opacity:.55':''}">
      <div class="desig-header">
        <span class="desig-tarefa">${esc(d.tarefa)}</span>
        <div style="display:flex;gap:4px;align-items:center">
          ${isPerm?'<span style="font-size:10px;padding:2px 7px;border-radius:8px;background:rgba(167,139,250,.15);--c:#a78bfa;font-weight:600">Permanente</span>':''}
          <span class="status-badge status-${statusClass}">${statusLabel}</span>
        </div>
      </div>
      <div style="display:flex;gap:12px;font-size:12px;color:var(--text2);margin-bottom:8px;flex-wrap:wrap">
        ${respsHtml}
        ${d.prazo?`<span>📅 ${formatarData(d.prazo)}</span>`:''}
      </div>
      ${d.obs?`<div class="ent-obs">${esc(d.obs)}</div>`:''}
      ${d.obs_conclusao?`<div class="ent-obs" style="border-left:3px solid #34d399;padding-left:8px;margin-top:4px;--c:#34d399">✔ ${esc(d.obs_conclusao)}</div>`:''}
      <div class="desig-status">
        ${!isPerm?`<div class="progress-bar"><div class="progress-fill" style="width:${pct[d.status]||0}%"></div></div>`:''}
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${isPerm ? `
            <button class="btn-secondary" style="font-size:11px;padding:4px 10px" data-act="perm" data-id="${d.id}">${d.status==='inativa'?'▶ Ativar':'⏸ Desativar'}</button>
          ` : d.status!=='concluido' ? `<button class="btn-secondary" style="font-size:11px;padding:4px 10px" data-act="avancar" data-id="${d.id}">▶</button>` : ''}
          <button class="btn-secondary" style="font-size:11px;padding:4px 10px" data-act="editar" data-id="${d.id}">✏️</button>
          <button class="btn-danger" data-act="excluir" data-id="${d.id}">🗑</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

export function setFilDesig(val,btn){
  filDesig=val;
  // restrito ao próprio painel: '.filtros' global apagava o estado das outras abas
  document.querySelectorAll('#filtros-desig .filtro-btn').forEach(b=>b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderDesignacoes();
}

export function abrirModalDesig(id){
  const d = id?DADOS.designacoes.find(x=>x.id===id):null;
  const resps = d ? (Array.isArray(d.responsaveis) ? d.responsaveis : [d.responsavel||'']) : [];
  const isPerm = d?.tipo === 'permanente';
  document.getElementById('modal-desig-content').innerHTML=`
    <h3>${d?'✏️ Editar':'➕ Nova'} Designação <button class="modal-close" data-act="fechar">✕</button></h3>
    <div class="form-group"><label>Tarefa</label><input type="text" class="form-input" id="de-tarefa" value="${esc(d?.tarefa||'')}" placeholder="Descrição da designação…"></div>
    <div class="form-group"><label>Tipo</label>
      <select class="form-select" id="de-tipo">
        <option value="pontual" ${!isPerm?'selected':''}>📋 Pontual</option>
        <option value="permanente" ${isPerm?'selected':''}>📌 Permanente</option>
      </select>
    </div>
    <div class="form-group"><label>Responsáveis</label>
      <div id="de-resps" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px">
        ${CARGOS.map(r=>`<label style="display:flex;align-items:center;gap:4px;font-size:13px;color:var(--text-corpo);cursor:pointer"><input type="checkbox" class="de-resp-check" value="${r}" ${resps.includes(r)?'checked':''}> ${r}</label>`).join('')}
      </div>
    </div>
    <div id="de-prazo-wrap" class="form-group" style="${isPerm?'display:none':''}"><label>Prazo</label><input type="date" class="form-input" id="de-prazo" value="${d?.prazo||''}"></div>
    <div id="de-status-wrap" class="form-group" style="${isPerm?'display:none':''}"><label>Status</label>
      <select class="form-select" id="de-status">
        ${isPerm
          ? ['ativa','inativa'].map(s=>`<option value="${s}" ${d?.status===s?'selected':''}>${s==='ativa'?'📌 Ativa':'⏸ Inativa'}</option>`).join('')
          : ['pendente','andamento','concluido'].map(s=>`<option value="${s}" ${d?.status===s||(!d&&s==='pendente')?'selected':''}>${s==='andamento'?'Em Andamento':s.charAt(0).toUpperCase()+s.slice(1)}</option>`).join('')
        }
      </select>
    </div>
    <div class="form-group"><label>Observações</label><textarea class="form-textarea" id="de-obs" style="min-height:60px" placeholder="Detalhes adicionais…">${esc(d?.obs||'')}</textarea></div>
    <button class="btn-primary" data-act="salvar" data-id="${id||''}">💾 Salvar</button>
  `;
  abrirModal('modal-desig');
}

export function toggleDesigTipo() {
  const isPerm = document.getElementById('de-tipo').value === 'permanente';
  document.getElementById('de-prazo-wrap').style.display = isPerm ? 'none' : '';
  document.getElementById('de-status-wrap').style.display = isPerm ? 'none' : '';
}

export async function salvarDesig(id) {
  const tarefa = document.getElementById('de-tarefa').value.trim();
  if (!tarefa) return toast('Informe a tarefa');
  const resps = [...document.querySelectorAll('.de-resp-check:checked')].map(c=>c.value);
  if (!resps.length) return toast('Selecione pelo menos um responsável');
  const tipo = document.getElementById('de-tipo').value;
  const isPerm = tipo === 'permanente';
  const payload = {
    tarefa, tipo, responsaveis: resps, responsavel: resps[0],
    prazo: isPerm ? '' : document.getElementById('de-prazo').value,
    status: isPerm ? 'ativa' : document.getElementById('de-status').value,
    obs: document.getElementById('de-obs').value,
  };
  fecharModal('modal-desig');
  reativarAbaAtual();
  try {
    if (id) {
      const atualizado = await apiFetch(`${API_DESIG}?id=${id}`, 'PUT', payload);
      DADOS.designacoes = DADOS.designacoes.map(x => x.id===id ? atualizado : x);
    } else {
      const criado = await apiFetch(API_DESIG, 'POST', payload);
      DADOS.designacoes.push(criado);
    }
    atualizarUltimaSinc(); setSyncStatus('ok');
    toast('Designação salva');
  } catch(e) {
    if (id) DADOS.designacoes = DADOS.designacoes.map(x => x.id===id ? { ...x, ...payload } : x);
    else DADOS.designacoes.push({ ...payload, id: idProvisorioDo(e) });
    avisarPendente('designação');
  }
  renderDesignacoes();
}

export async function avancarDesig(id) {
  const prox = { pendente:'andamento', andamento:'concluido' };
  const atual = DADOS.designacoes.find(d => d.id===id);
  if (!atual) return;
  const novoStatus = prox[atual.status] || atual.status;
  let obs_conclusao = '';
  if (novoStatus === 'concluido') {
    const r = await pedirTexto('Concluir designação', [
      { id: 'obs', label: 'Observação ao concluir (opcional)', tipo: 'textarea' },
    ], { okLabel: 'Concluir' });
    if (r === null) return;
    obs_conclusao = r.obs;
  }
  try {
    const payload = { status: novoStatus };
    if (obs_conclusao) payload.obs_conclusao = obs_conclusao;
    const atualizado = await apiFetch(`${API_DESIG}?id=${id}`, 'PUT', payload);
    DADOS.designacoes = DADOS.designacoes.map(d => d.id===id ? atualizado : d);
    atualizarUltimaSinc(); setSyncStatus('ok');
  } catch(e) {
    DADOS.designacoes = DADOS.designacoes.map(d => d.id===id ? { ...d, status: novoStatus, obs_conclusao } : d);
    avisarPendente('alteração');
  }
  renderDesignacoes();
}

export async function excluirDesig(id) {
  if (!await confirmar('Excluir esta designação?', { perigo: true, okLabel: 'Excluir' })) return;
  try { await apiFetch(`${API_DESIG}?id=${id}`, 'DELETE'); atualizarUltimaSinc(); setSyncStatus('ok'); } catch(e) { avisarPendente('exclusão'); }
  DADOS.designacoes = DADOS.designacoes.filter(d => d.id !== id);
  renderDesignacoes();
}
export function editarDesig(id){abrirModalDesig(id);}
export async function togglePermDesig(id) {
  const atual = DADOS.designacoes.find(d => d.id===id);
  if (!atual) return;
  const novoStatus = atual.status === 'inativa' ? 'ativa' : 'inativa';
  try {
    const atualizado = await apiFetch(`${API_DESIG}?id=${id}`, 'PUT', { status: novoStatus });
    DADOS.designacoes = DADOS.designacoes.map(d => d.id===id ? atualizado : d);
    atualizarUltimaSinc(); setSyncStatus('ok');
  } catch(e) {
    DADOS.designacoes = DADOS.designacoes.map(d => d.id===id ? { ...d, status: novoStatus } : d);
    avisarPendente('alteração');
  }
  renderDesignacoes();
}

// Não há alarme de designação: o que existia nunca disparava (rodava antes de
// os dados chegarem, e `new Notification` não funciona no Android) e pedia
// permissão de notificação ao abrir o app. Os prazos de hoje e de amanhã
// aparecem em "Precisa de atenção", no Início. Aviso com o app fechado
// exigiria Web Push e uma função agendada no servidor.

// Fase 6 da migração ESM: liga a aba Designações por delegação,
// no lugar dos onclick/onchange inline (filtros, cards e modal).
function ligarDesignacoes() {
  document.getElementById('fil-desig-resp')?.addEventListener('change', renderDesignacoes);

  document.getElementById('filtros-desig')?.addEventListener('click', e => {
    const btn = e.target.closest('.filtro-btn');
    if (btn?.dataset.fil) setFilDesig(btn.dataset.fil, btn);
  });

  document.getElementById('lista-designacoes')?.addEventListener('click', e => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const id = btn.dataset.id;
    switch (btn.dataset.act) {
      case 'perm':    togglePermDesig(id); break;
      case 'avancar': avancarDesig(id); break;
      case 'editar':  editarDesig(id); break;
      case 'excluir': excluirDesig(id); break;
    }
  });

  const modal = document.getElementById('modal-desig');
  modal?.addEventListener('click', e => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    if (btn.dataset.act === 'fechar') fecharModal('modal-desig');
    else if (btn.dataset.act === 'salvar') salvarDesig(btn.dataset.id);
  });
  // campos do modal são recriados a cada abertura — daí a delegação
  modal?.addEventListener('change', e => {
    if (e.target.id === 'de-tipo') toggleDesigTipo();
  });
}
ligarDesignacoes();
