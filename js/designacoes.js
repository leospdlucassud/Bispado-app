// =============================================
// DESIGNAÇÕES
// =============================================
import { apiFetch, atualizarUltimaSinc, setSyncStatus } from './api.js';
import { reativarAbaAtual } from './app.js';
import { API_DESIG, CARGOS, DADOS } from './config.js';
import { confirmar, pedirTexto } from './dialogo.js';
import { abrirModal, fecharModal } from './ui.js';
import { toast } from './usuario.js';
import { formatarData } from './utils.js';

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
  const respCor = {'Bispo':'#c9a84c','1º Conselheiro':'#5b9bd5','2º Conselheiro':'#6dbf8c','Secretário':'#e8b040','Secretário Executivo':'#e86848'};
  el.innerHTML = lista.map(d=>{
    const isPerm = d.tipo === 'permanente';
    const resps = Array.isArray(d.responsaveis) ? d.responsaveis : [d.responsavel||''];
    const respsHtml = resps.map(r => `<span style="color:${respCor[r]||'#8eacc8'}">👤 ${r}</span>`).join(' ');
    const statusLabel = isPerm
      ? (d.status==='inativa'?'⏸ Inativa':'📌 Ativa')
      : (d.status==='andamento'?'Em Andamento':d.status.charAt(0).toUpperCase()+d.status.slice(1));
    const statusClass = isPerm ? (d.status==='inativa'?'nao-realizada':'realizada') : d.status;
    return `<div class="desig-card" style="${isPerm?'border-left:3px solid #a78bfa;':''}${d.status==='inativa'?'opacity:.55':''}">
      <div class="desig-header">
        <span class="desig-tarefa">${d.tarefa}</span>
        <div style="display:flex;gap:4px;align-items:center">
          ${isPerm?'<span style="font-size:10px;padding:2px 7px;border-radius:8px;background:rgba(167,139,250,.15);color:#a78bfa;font-weight:600">Permanente</span>':''}
          ${d.alarme?'<span title="Alarme configurado" style="font-size:14px">🔔</span>':''}
          <span class="status-badge status-${statusClass}">${statusLabel}</span>
        </div>
      </div>
      <div style="display:flex;gap:12px;font-size:12px;color:#8eacc8;margin-bottom:8px;flex-wrap:wrap">
        ${respsHtml}
        ${d.prazo?`<span>📅 ${formatarData(d.prazo)}</span>`:''}
      </div>
      ${d.obs?`<div class="ent-obs">${d.obs}</div>`:''}
      ${d.obs_conclusao?`<div class="ent-obs" style="border-left:3px solid #34d399;padding-left:8px;margin-top:4px;color:#34d399">✔ ${d.obs_conclusao}</div>`:''}
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
    <div class="form-group"><label>Tarefa</label><input type="text" class="form-input" id="de-tarefa" value="${d?.tarefa||''}" placeholder="Descrição da designação…"></div>
    <div class="form-group"><label>Tipo</label>
      <select class="form-select" id="de-tipo">
        <option value="pontual" ${!isPerm?'selected':''}>📋 Pontual</option>
        <option value="permanente" ${isPerm?'selected':''}>📌 Permanente</option>
      </select>
    </div>
    <div class="form-group"><label>Responsáveis</label>
      <div id="de-resps" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px">
        ${CARGOS.map(r=>`<label style="display:flex;align-items:center;gap:4px;font-size:13px;color:#c8d8e8;cursor:pointer"><input type="checkbox" class="de-resp-check" value="${r}" ${resps.includes(r)?'checked':''}> ${r}</label>`).join('')}
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
    <div class="form-group" style="border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:10px">
      <label style="display:flex;align-items:center;gap:6px"><input type="checkbox" id="de-alarme" ${d?.alarme?'checked':''}> 🔔 Incluir alarme</label>
      <div id="de-alarme-wrap" style="margin-top:8px;${d?.alarme?'':'display:none'}">
        <select class="form-select" id="de-alarme-tempo">
          ${['15 min antes','30 min antes','1 hora antes','1 dia antes','No horário'].map(t=>`<option value="${t}" ${d?.alarmeTempo===t?'selected':''}>${t}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-group"><label>Observações</label><textarea class="form-textarea" id="de-obs" style="min-height:60px" placeholder="Detalhes adicionais…">${d?.obs||''}</textarea></div>
    <button class="btn-primary" data-act="salvar" data-id="${id||''}">💾 Salvar</button>
  `;
  abrirModal('modal-desig');
}

export function toggleDesigTipo() {
  const isPerm = document.getElementById('de-tipo').value === 'permanente';
  document.getElementById('de-prazo-wrap').style.display = isPerm ? 'none' : '';
  document.getElementById('de-status-wrap').style.display = isPerm ? 'none' : '';
}
export function toggleDesigAlarme() {
  document.getElementById('de-alarme-wrap').style.display = document.getElementById('de-alarme').checked ? '' : 'none';
}

export async function salvarDesig(id) {
  const tarefa = document.getElementById('de-tarefa').value.trim();
  if (!tarefa) return toast('Informe a tarefa');
  const resps = [...document.querySelectorAll('.de-resp-check:checked')].map(c=>c.value);
  if (!resps.length) return toast('Selecione pelo menos um responsável');
  const tipo = document.getElementById('de-tipo').value;
  const isPerm = tipo === 'permanente';
  const alarme = document.getElementById('de-alarme').checked;
  const alarmeTempo = alarme ? document.getElementById('de-alarme-tempo').value : '';
  const payload = {
    tarefa, tipo, responsaveis: resps, responsavel: resps[0],
    prazo: isPerm ? '' : document.getElementById('de-prazo').value,
    status: isPerm ? 'ativa' : document.getElementById('de-status').value,
    obs: document.getElementById('de-obs').value,
    alarme, alarmeTempo
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
  } catch(e) {
    if (id) DADOS.designacoes = DADOS.designacoes.map(x => x.id===id ? { ...x, ...payload } : x);
    else DADOS.designacoes.push({ ...payload, id: 'local_' + Date.now() });
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
  }
  renderDesignacoes();
}

export async function excluirDesig(id) {
  if (!await confirmar('Excluir esta designação?', { perigo: true, okLabel: 'Excluir' })) return;
  try { await apiFetch(`${API_DESIG}?id=${id}`, 'DELETE'); atualizarUltimaSinc(); setSyncStatus('ok'); } catch(e) {}
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
  }
  renderDesignacoes();
}

// === ALARMES DE DESIGNAÇÕES ===
export function verificarAlarmesDesig() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') Notification.requestPermission();
  const agora = new Date();
  (DADOS.designacoes||[]).forEach(d => {
    if (!d.alarme || !d.prazo) return;
    if (d.status === 'concluido' || d.status === 'inativa') return;
    const prazoDate = new Date(d.prazo + 'T09:00:00');
    const diffMs = prazoDate - agora;
    let offsetMs = 0;
    if (d.alarmeTempo === '15 min antes') offsetMs = 15*60*1000;
    else if (d.alarmeTempo === '30 min antes') offsetMs = 30*60*1000;
    else if (d.alarmeTempo === '1 hora antes') offsetMs = 60*60*1000;
    else if (d.alarmeTempo === '1 dia antes') offsetMs = 24*60*60*1000;
    const alarmeMs = diffMs - offsetMs;
    if (alarmeMs > 0 && alarmeMs < 24*60*60*1000) {
      setTimeout(() => {
        if (Notification.permission === 'granted') {
          const resps = Array.isArray(d.responsaveis) ? d.responsaveis.join(', ') : d.responsavel;
          new Notification('🔔 Designação: ' + d.tarefa, { body: '👤 ' + resps + '\n📅 ' + formatarData(d.prazo), icon: '/icon-192.png' });
        }
      }, alarmeMs);
    }
  });
}
// Verificar alarmes quando dados carregam
document.addEventListener('DOMContentLoaded', () => setTimeout(verificarAlarmesDesig, 3000));

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
    else if (e.target.id === 'de-alarme') toggleDesigAlarme();
  });
}
ligarDesignacoes();
