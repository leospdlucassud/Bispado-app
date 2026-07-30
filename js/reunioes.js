// =============================================
// REUNIÕES
// =============================================
// Tipos de reunião administrados pelo bispado — fonte única para filtros e formulário
export const TIPOS_REUNIAO = [
  { k:'conselho',   r:'Conselho da Ala',              c:'#a78bfa' },
  { k:'bispado',    r:'Reunião do Bispado',           c:'#c9a84c' },
  { k:'jovens',     r:'Conselho de Jovens',           c:'#f472b6' },
  { k:'lideranca',  r:'Liderança do Sacerdócio',      c:'#5b9bd5' },
  { k:'correlacao', r:'Correlação Missionária',       c:'#34d399' },
  { k:'bemestar',   r:'Bem-Estar e Autossuficiência', c:'#2dd4bf' },
  { k:'outro',      r:'Outro',                        c:'#94a3b8' },
];
export const tipoReuniao = k => TIPOS_REUNIAO.find(t => t.k === k) || { r: k || 'Reunião', c: '#94a3b8' };

export let filReuniao = '';

export function setFilReuniao(val) {
  filReuniao = val;
  renderReunioes();
}

export function renderReunioes() {
  const el = document.getElementById('lista-reunioes');
  if (!el) return;

  const todas = DADOS.reunioes || [];
  const busca = (document.getElementById('busca-reuniao')?.value || '').toLowerCase();

  // Painel de resumo
  const stats = document.getElementById('reuniao-stats');
  if (stats) {
    const mes = new Date().toISOString().slice(0,7);
    const noMes = todas.filter(r => (r.data||'').startsWith(mes)).length;
    const pendentes = todas.reduce((n,r) => n + (r.itens||[]).filter(i => !i.feito).length, 0);
    stats.innerHTML = `
      <div class="membros-stat"><div class="stat-num" style="color:#a78bfa">${todas.length}</div><div class="stat-label">Registradas</div></div>
      <div class="membros-stat"><div class="stat-num" style="color:#34d399">${noMes}</div><div class="stat-label">Neste mês</div></div>
      <div class="membros-stat"><div class="stat-num" style="color:${pendentes ? '#e8b040' : '#34d399'}">${pendentes}</div><div class="stat-label">Itens em aberto</div></div>`;
  }

  // Filtros por tipo, com contagem — só aparecem os tipos que existem
  const filtros = document.getElementById('filtros-reuniao');
  if (filtros) {
    const usados = TIPOS_REUNIAO.filter(t => todas.some(r => r.tipo === t.k));
    filtros.innerHTML = [
      `<button class="filtro-btn ${filReuniao===''?'active':''}" onclick="setFilReuniao('')">Todas (${todas.length})</button>`,
      ...usados.map(t => {
        const n = todas.filter(r => r.tipo === t.k).length;
        return `<button class="filtro-btn ${filReuniao===t.k?'active':''}" style="${filReuniao===t.k?'':`border-color:${t.c};color:${t.c}`}" onclick="setFilReuniao('${t.k}')">${t.r} (${n})</button>`;
      }),
    ].join('');
  }

  let lista = todas
    .filter(r => !filReuniao || r.tipo === filReuniao)
    .filter(r => !busca || [r.pauta, tipoReuniao(r.tipo).r, (r.participantes||[]).join(' '), (r.itens||[]).map(i=>i.texto).join(' ')].join(' ').toLowerCase().includes(busca))
    .sort((a,b) => (b.data||'').localeCompare(a.data||''));

  if (!lista.length) {
    el.innerHTML = todas.length
      ? `<div class="vazia">🔍 Nenhuma reunião com esse filtro</div>`
      : `<div class="vazia">📭 Nenhuma reunião registrada<br><span style="font-size:12px;opacity:.7">Toque no + para registrar a primeira</span></div>`;
    return;
  }

  el.innerHTML = lista.map(r=>{
    const t = tipoReuniao(r.tipo);
    const abertos = (r.itens||[]).filter(i => !i.feito).length;
    return `
    <div class="reuniao-card" style="border-left:3px solid ${t.c}">
      <div class="reuniao-header">
        <div>
          <span class="reuniao-data">📅 ${formatarData(r.data)}</span>
          <span class="reuniao-tipo" style="margin-left:8px;color:${t.c}">${t.r}</span>
          ${abertos ? `<span style="margin-left:8px;font-size:11px;color:#e8b040">• ${abertos} em aberto</span>` : ''}
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn-secondary" style="font-size:11px;padding:4px 10px" onclick="imprimirAtaPDF('${r.id}')">📄 PDF</button>
          <button class="btn-secondary" style="font-size:11px;padding:4px 10px" onclick="editarReuniao('${r.id}')">✏️</button>
          <button class="btn-danger" onclick="excluirReuniao('${r.id}')">🗑</button>
        </div>
      </div>
      ${r.pauta?`<div class="reuniao-pauta">${r.pauta}</div>`:''}
      ${r.participantes?.length?`<div style="font-size:11px;color:#8eacc8;margin-top:4px">👥 ${r.participantes.join(', ')}</div>`:''}
      ${r.itens?.length?`
        <div class="reuniao-itens">
          ${r.itens.map((it,i)=>`
            <div class="reuniao-item">
              <div class="item-check ${it.feito?'checked':''}" onclick="toggleItem('${r.id}',${i})"></div>
              <span style="${it.feito?'text-decoration:line-through;opacity:.5':''}">${it.texto}</span>
            </div>
          `).join('')}
        </div>
      `:''}
    </div>`;
  }).join('');
}

export async function toggleItem(reuniaoId, itemIdx) {
  const reuniao = DADOS.reunioes.find(r => r.id === reuniaoId);
  if (!reuniao) return;
  const itens = [...(reuniao.itens||[])];
  itens[itemIdx] = { ...itens[itemIdx], feito: !itens[itemIdx].feito };
  try {
    const atualizado = await apiFetch(`${API_REUNIOES}?id=${reuniaoId}`, 'PUT', { itens });
    DADOS.reunioes = DADOS.reunioes.map(r => r.id===reuniaoId ? atualizado : r);
    setSyncStatus('ok');
  } catch(e) {
    DADOS.reunioes = DADOS.reunioes.map(r => r.id===reuniaoId ? { ...r, itens } : r);
  }
  renderReunioes();
}

export function abrirModalReuniao(id) {
  const r = id ? DADOS.reunioes.find(x=>x.id===id) : null;
  const itensVal = r?.itens?.map(i=>i.texto).join('\n') || '';
  const partsVal = r?.participantes?.join(', ') || '';
  document.getElementById('modal-reuniao-content').innerHTML = `
    <h3>${r?'✏️ Editar':'➕ Nova'} Reunião <button class="modal-close" onclick="fecharModal('modal-reuniao')">✕</button></h3>
    <div class="form-row">
      <div class="form-group">
        <label>Data</label>
        <input type="date" class="form-input" id="re-data" value="${r?.data||new Date().toISOString().slice(0,10)}">
      </div>
      <div class="form-group">
        <label>Tipo</label>
        <select class="form-select" id="re-tipo">
          ${TIPOS_REUNIAO.map(t=>`<option value="${t.k}" ${r?.tipo===t.k?'selected':''}>${t.r}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-group">
      <label>Participantes (separados por vírgula)</label>
      <input type="text" class="form-input" id="re-partic" value="${partsVal}" placeholder="Bispo, 1º Conselheiro, 2º Conselheiro…">
    </div>
    <div class="form-group">
      <label>Pauta / Anotações</label>
      <textarea class="form-textarea" id="re-pauta" placeholder="Registre os assuntos discutidos…">${r?.pauta||''}</textarea>
    </div>
    <div class="form-group">
      <label>Itens de ação (um por linha)</label>
      <textarea class="form-textarea" id="re-itens" placeholder="Verificar relatório trimestral&#10;Marcar entrevistas de jovens…">${itensVal}</textarea>
    </div>
    <button class="btn-primary" onclick="salvarReuniao('${id||''}')">💾 Salvar</button>
  `;
  abrirModal('modal-reuniao');
}

export async function salvarReuniao(id) {
  const data = document.getElementById('re-data').value;
  if (!data) return toast('Informe a data');
  const itensTexto = document.getElementById('re-itens').value.split('\n').map(s=>s.trim()).filter(Boolean);
  const itensAntigos = id ? (DADOS.reunioes.find(x=>x.id===id)?.itens||[]) : [];
  const payload = {
    data,
    tipo: document.getElementById('re-tipo').value,
    participantes: document.getElementById('re-partic').value.split(',').map(s=>s.trim()).filter(Boolean),
    pauta: document.getElementById('re-pauta').value,
    itens: itensTexto.map((texto,i) => ({ texto, feito: itensAntigos[i]?.feito||false }))
  };
  fecharModal('modal-reuniao');
  try {
    if (id) {
      const atualizado = await apiFetch(`${API_REUNIOES}?id=${id}`, 'PUT', payload);
      DADOS.reunioes = DADOS.reunioes.map(x => x.id===id ? atualizado : x);
    } else {
      const criado = await apiFetch(API_REUNIOES, 'POST', payload);
      DADOS.reunioes.push(criado);
    }
    atualizarUltimaSinc(); setSyncStatus('ok');
  } catch(e) {
    if (id) DADOS.reunioes = DADOS.reunioes.map(x => x.id===id ? { ...x, ...payload } : x);
    else DADOS.reunioes.push({ ...payload, id: 'local_' + Date.now() });
  }
  renderReunioes();
}

export async function excluirReuniao(id) {
  if (!await confirmar('Excluir esta reunião?', { perigo: true, okLabel: 'Excluir' })) return;
  try { await apiFetch(`${API_REUNIOES}?id=${id}`, 'DELETE'); atualizarUltimaSinc(); setSyncStatus('ok'); } catch(e) {}
  DADOS.reunioes = DADOS.reunioes.filter(r => r.id !== id);
  renderReunioes();
}

export function editarReuniao(id) { abrirModalReuniao(id); }
