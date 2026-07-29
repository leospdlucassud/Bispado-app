// =============================================
// AGENDA DE ENTREVISTAS
// =============================================
const TIPOS_ENTREVISTA = [
  // Recomendações
  'Recomendação para o Templo (Batismos Vicários)',
  'Recomendação para o Templo (Investidura)',
  'Renovação de Recomendação para o Templo',
  'Recomendação para Ordenanças Próprias (Investidura)',
  'Recomendação para Ordenanças Próprias (Selamento)',
  'Recomendação de Uso Limitado (Jovens)',
  'Recomendação para Bênção Patriarcal',
  // Sacerdócio
  'Ordenação ao Ofício de Diácono',
  'Ordenação ao Ofício de Mestre',
  'Ordenação ao Ofício de Sacerdote',
  'Ordenação ao Ofício de Élder',
  'Ordenação ao Ofício de Sumo Sacerdote',
  // Jovens e jovens adultos
  'Entrevista Anual (Jovem de 12–15 Anos)',
  'Entrevista Semestral (Jovem de 16–17 Anos)',
  'Entrevista Anual (Jovem Adulto Solteiro)',
  // Missão
  'Preparação para Missão',
  'Retorno de Missão',
  'Recomendação para Missionário de Serviço da Igreja',
  // Chamados
  'Apoio de Chamado',
  'Desobrigação de Chamado',
  // Liderança e membros
  'Ministração da Liderança',
  'Novo Membro (Pós-Batismo)',
  'Batismo e Confirmação de Criança de Registro (8 anos)',
  'Reativação / Retorno à Atividade',
  'Orientação Espiritual',
  'Bem-Estar e Autossuficiência',
  'Declaração de Dízimo',
  'Assuntos de Condição de Membro (Dignidade)',
  'Outro',
];

function renderAgenda() {
  const el = document.getElementById('lista-agenda');
  if (!el) return;
  const busca = (document.getElementById('busca-membro')?.value || '').toLowerCase();

  // Painel de resumo — sigilosos ficam fora da conta de quem não é o bispo
  const stats = document.getElementById('agenda-stats');
  if (stats) {
    const todas = (DADOS.agenda || []).filter(podeVer);
    const ativas = todas.filter(e => e.status === 'pendente' || e.status === 'agendada');
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const limite = new Date(hoje); limite.setDate(limite.getDate() + 7);
    const proximas = ativas.filter(e => {
      if (!e.data) return false;
      const d = new Date(e.data + 'T12:00:00');
      return d >= hoje && d < limite;
    }).length;
    const aguardando = ativas.filter(e => e.data && !e.confirmacao).length;
    stats.innerHTML = `
      <div class="membros-stat"><div class="stat-num" style="color:#34d399">${ativas.length}</div><div class="stat-label">Em aberto</div></div>
      <div class="membros-stat"><div class="stat-num" style="color:#60a5fa">${proximas}</div><div class="stat-label">Próximos 7 dias</div></div>
      <div class="membros-stat"><div class="stat-num" style="color:${aguardando ? '#e8b040' : '#34d399'}">${aguardando}</div><div class="stat-label">Sem confirmação</div></div>`;
  }
  let lista = DADOS.agenda.filter(podeVer).filter(e => {
    const matchBusca = !busca || e.membro.toLowerCase().includes(busca);
    let matchFil;
    if (filAgenda === 'todas') matchFil = true;
    else if (filAgenda === 'ativas') matchFil = e.status !== 'realizada';
    else matchFil = e.status === filAgenda;
    return matchBusca && matchFil;
  }).sort((a,b) => {
    // Prioridade: Alta > Média > Normal, depois por data
    const p = {alta:0, media:1, normal:2};
    if (p[a.prioridade] !== p[b.prioridade]) return p[a.prioridade] - p[b.prioridade];
    return (a.data||'').localeCompare(b.data||'');
  });

  if (!lista.length) { el.innerHTML = `<div class="vazia">📭 Nenhuma entrevista encontrada</div>`; return; }

  const statusCor = { pendente:'#f87171', agendada:'#fbbf24', realizada:'#34d399', 'nao-realizada':'#94a3b8' };
  const prioEmoji = { alta:'🔴', media:'🟡', normal:'🟢' };
  const respCor = { bispo:'#c9a84c', c1:'#5b9bd5', c2:'#6dbf8c', sec:'#e8b040' };
  const respNome = { bispo:'Bispo', c1:'1º Conselheiro', c2:'2º Conselheiro', sec:'Secretário' };

  el.innerHTML = lista.map(e => `
    <div class="entrevista-card" style="border-color:${statusCor[e.status]||'#445566'}">
      <div class="ent-header">
        <span class="ent-prioridade">${prioEmoji[e.prioridade]||'🟢'}</span>
        <span class="ent-nome">${e.membro}</span>
        ${e.sigiloso?'<span class="selo-sigilo">🔒 Sigiloso</span>':''}
        ${e.acompanhar?'<span style="font-size:10px;color:#fbbf24">🧭</span>':''}
        <span class="status-badge status-${e.status}">${e.status==='nao-realizada'?'Não Realizada':e.status.charAt(0).toUpperCase()+e.status.slice(1)}</span>
      </div>
      <div class="ent-info">
        <span>📋 ${e.tipo}</span>
        <span style="color:${respCor[e.responsavel]||'#8eacc8'}">👤 ${respNome[e.responsavel]||e.responsavel}</span>
        ${e.data?`<span>📅 ${formatarData(e.data)}${e.hora?` às ${e.hora}`:''}</span>`:''}
        ${e.reagendamentos?.length?`<span>🔄 Reagendado ${e.reagendamentos.length}x</span>`:''}
        ${selosConfirmacao(e)}
      </div>
      ${e.obs?`<div class="ent-obs">${e.obs}</div>`:''}
      ${e.obs_conclusao?`<div class="ent-obs" style="border-left:3px solid #34d399;padding-left:8px;margin-top:4px;color:#34d399">✔ ${e.obs_conclusao}</div>`:''}
      <div class="ent-actions">
        ${e.status==='pendente'||e.status==='agendada'?`
          ${botaoWhatsApp(e)}
          <button class="btn-secondary" onclick="marcarRealizada('${e.id}')">✓ Realizada</button>
          <button class="btn-secondary" onclick="reagendarEntrevista('${e.id}')">🔄 Reagendar</button>
          <button class="btn-secondary" onclick="naoRealizada('${e.id}')">✗ Não Realizada</button>
        `:''}
        <button class="btn-secondary" title="Precisa de acompanhamento" onclick="toggleFlagEntrevista('${e.id}','acompanhar')" style="${e.acompanhar?'color:#fbbf24;border-color:#fbbf24':''}">🧭 ${e.acompanhar?'Acompanhando':'Acompanhar'}</button>
        <button class="btn-secondary" title="Assunto sigiloso" onclick="toggleFlagEntrevista('${e.id}','sigiloso')" style="${e.sigiloso?'color:#e05555;border-color:#e05555':''}">${e.sigiloso?'🔒 Sigiloso':'🔓 Sigilo'}</button>
        <button class="btn-danger" onclick="excluirEntrevista('${e.id}')">🗑</button>
      </div>
    </div>
  `).join('');
}

// Liga/desliga acompanhar ou sigiloso direto no card, depois de criada a entrevista
async function toggleFlagEntrevista(id, campo) {
  const e = DADOS.agenda.find(x => x.id === id);
  if (!e) return;
  const novo = !e[campo];
  e[campo] = novo; // otimista
  renderAgenda();
  if (typeof renderAcompanhamentos === 'function') renderAcompanhamentos();
  try {
    const atualizado = await apiFetch(`${API_AGENDA}?id=${id}`, 'PUT', { [campo]: novo });
    DADOS.agenda = DADOS.agenda.map(x => x.id === id ? atualizado : x);
    atualizarUltimaSinc(); setSyncStatus('ok');
  } catch (e2) {}
  renderAgenda();
  if (typeof renderAcompanhamentos === 'function') renderAcompanhamentos();
  const msg = {
    acompanhar: novo ? '🧭 Marcada para acompanhamento' : 'Acompanhamento removido',
    sigiloso:   novo ? '🔒 Marcada como sigilosa' : 'Sigilo removido',
  };
  toast(msg[campo]);
}

// =============================================
// CONVITE POR WHATSAPP + CONFIRMAÇÃO DO MEMBRO
// =============================================
function telefoneDoMembro(nome) {
  if (!nome) return '';
  const m = MEMBROS.find(x => norm(x.name) === norm(nome));
  return m ? (m.telefone || '') : '';
}

// wa.me exige só dígitos com código do país
function digitosTelefone(t) {
  let d = (t || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.length <= 11) d = '55' + d;
  return d;
}

// "Sobrenome, Nome" → primeiro nome
function primeiroNome(nome) {
  const dep = (nome || '').split(',')[1];
  return ((dep || nome || '').trim().split(/\s+/)[0]) || nome || '';
}

function linkConfirmacao(id) {
  return location.origin + location.pathname + '?confirmar=' + encodeURIComponent(id);
}

function botaoWhatsApp(e) {
  const tel = digitosTelefone(e.telefone || telefoneDoMembro(e.membro));
  if (!tel) return '';
  const quando = e.data
    ? formatarData(e.data) + (e.hora ? `, às ${e.hora}` : '')
    : 'em data a combinar';
  const msg =
    `Olá, ${primeiroNome(e.membro)}! Aqui é o bispado da ${ALA}.\n\n` +
    `Gostaríamos de marcar uma entrevista com você — ${e.tipo} — para ${quando}.\n\n` +
    `Por favor, responda por este link:\n${linkConfirmacao(e.id)}\n\n` +
    `Obrigado!`;
  const url = `https://wa.me/${tel}?text=${encodeURIComponent(msg)}`;
  return `<a class="btn-secondary" href="${url}" target="_blank" rel="noopener"
            style="text-decoration:none;color:#25d366;border-color:#25d366">💬 Convidar</a>`;
}

function selosConfirmacao(e) {
  if (!e.confirmacao) return '';
  const sel = {
    confirmado: ['#34d399', '✅ Confirmou'],
    recusado:   ['#e05555', '❌ Não poderá'],
    reagendar:  ['#e8b040', '🔄 Pediu outra data'],
  }[e.confirmacao];
  if (!sel) return '';
  const qdo = e.confirmadoEm ? new Date(e.confirmadoEm).toLocaleDateString('pt-BR') : '';
  return `<span style="color:${sel[0]}" title="${qdo}">${sel[1]}</span>`;
}

// --- Tela que o membro vê ao abrir o link do WhatsApp ---
async function abrirTelaConfirmacao(id) {
  document.body.innerHTML = `
    <div id="conf-wrap" style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px">
      <div style="max-width:420px;width:100%;background:#152233;border:1px solid #2a4060;border-radius:18px;padding:28px;text-align:center">
        <div class="loading">Carregando…</div>
      </div>
    </div>`;
  const caixa = document.querySelector('#conf-wrap > div');

  let e = null;
  try {
    const lista = await (await fetch(API_AGENDA)).json();
    e = Array.isArray(lista) ? lista.find(x => String(x.id) === String(id)) : null;
  } catch { /* tratado abaixo */ }

  if (!e) {
    caixa.innerHTML = `
      <div style="font-size:34px;margin-bottom:10px">🔎</div>
      <h2 style="color:#e8d080;font-size:17px;margin-bottom:8px">Convite não encontrado</h2>
      <p style="color:#8eacc8;font-size:13px;line-height:1.6">Este link pode ter expirado. Fale com o bispado para confirmar sua entrevista.</p>`;
    return;
  }

  const quando = e.data
    ? formatarData(e.data) + (e.hora ? `, às ${e.hora}` : '')
    : 'data a combinar';

  const opcoes = [
    ['confirmado', '✅ Confirmo minha presença', '#34d399'],
    ['reagendar',  '🔄 Preciso de outra data',   '#e8b040'],
    ['recusado',   '❌ Não poderei ir',          '#e05555'],
  ];

  caixa.innerHTML = `
    <div style="font-size:34px;margin-bottom:6px">🕊️</div>
    <h2 style="color:#e8d080;font-size:17px;margin-bottom:4px">Convite para entrevista</h2>
    <p style="color:#8eacc8;font-size:12px;margin-bottom:18px">${esc(ALA)}</p>
    <div style="background:rgba(255,255,255,.04);border-radius:12px;padding:14px;margin-bottom:18px;text-align:left">
      <div style="color:#c8d8e8;font-size:14px;font-weight:700;margin-bottom:6px">${esc(primeiroNome(e.membro))}</div>
      <div style="color:#8eacc8;font-size:12px;line-height:1.8">
        📋 ${esc(e.tipo)}<br>📅 ${esc(quando)}
      </div>
    </div>
    <p style="color:#8eacc8;font-size:13px;margin-bottom:14px">Você pode comparecer?</p>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${opcoes.map(([v, r, c]) => `
        <button onclick="responderConvite('${e.id}','${v}')"
          style="background:transparent;border:1px solid ${c};color:${c};border-radius:12px;padding:12px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit">${r}</button>`).join('')}
    </div>
    ${e.confirmacao ? `<p style="color:#4a6a8a;font-size:11px;margin-top:14px">Você já respondeu antes. Pode alterar se precisar.</p>` : ''}`;
}

async function responderConvite(id, resposta) {
  const caixa = document.querySelector('#conf-wrap > div');
  caixa.innerHTML = '<div class="loading">Enviando…</div>';
  let ok = true;
  try {
    const lista = await (await fetch(API_AGENDA)).json();
    const atual = (Array.isArray(lista) ? lista : []).find(x => String(x.id) === String(id)) || {};
    const r = await fetch(`${API_AGENDA}?id=${encodeURIComponent(id)}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...atual, confirmacao: resposta, confirmadoEm: new Date().toISOString() }),
    });
    ok = r.ok;
  } catch { ok = false; }

  const txt = {
    confirmado: ['✅', 'Presença confirmada', 'Obrigado! O bispado já foi avisado.'],
    reagendar:  ['🔄', 'Pedido registrado',   'O bispado entrará em contato para combinar outra data.'],
    recusado:   ['❌', 'Resposta registrada', 'Obrigado por avisar. O bispado foi informado.'],
  }[resposta];

  caixa.innerHTML = ok
    ? `<div style="font-size:40px;margin-bottom:10px">${txt[0]}</div>
       <h2 style="color:#e8d080;font-size:17px;margin-bottom:8px">${txt[1]}</h2>
       <p style="color:#8eacc8;font-size:13px;line-height:1.6">${txt[2]}</p>`
    : `<div style="font-size:36px;margin-bottom:10px">⚠️</div>
       <h2 style="color:#e05555;font-size:16px;margin-bottom:8px">Não deu para enviar</h2>
       <p style="color:#8eacc8;font-size:13px;line-height:1.6">Verifique sua conexão e tente de novo, ou responda direto ao bispado pelo WhatsApp.</p>`;
}

function setFilAgenda(val, btn) {
  filAgenda = val;
  document.querySelectorAll('#filtros-agenda .filtro-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderAgenda();
}

function abrirModalAgenda(id) {
  const e = id ? DADOS.agenda.find(x=>x.id===id) : null;
  const membrosOptions = MEMBROS.map(m=>`<option value="${m.name}" ${e?.membro===m.name?'selected':''}>${m.name}</option>`).join('');
  const tiposOptions = TIPOS_ENTREVISTA.map(t=>`<option value="${t}" ${e?.tipo===t?'selected':''}>${t}</option>`).join('');

  document.getElementById('modal-agenda-content').innerHTML = `
    <h3>${e?'✏️ Editar':'➕ Nova'} Entrevista <button class="modal-close" onclick="fecharModal('modal-agenda')">✕</button></h3>
    <div class="form-group">
      <label>Membro</label>
      <input list="lista-membros-dl" class="form-input" id="ag-membro" placeholder="Digite o nome…" value="${e?.membro||''}">
      <datalist id="lista-membros-dl">${membrosOptions}</datalist>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Tipo de Entrevista</label>
        <select class="form-select" id="ag-tipo">${tiposOptions}</select>
      </div>
      <div class="form-group">
        <label>Responsável</label>
        <select class="form-select" id="ag-resp">
          ${['bispo','c1','c2','sec'].map(r=>`<option value="${r}" ${e?.responsavel===r?'selected':''}>${{bispo:'Bispo',c1:'1º Conselheiro',c2:'2º Conselheiro',sec:'Secretário'}[r]}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Data</label>
        <input type="date" class="form-input" id="ag-data" value="${e?.data||''}">
      </div>
      <div class="form-group">
        <label>Horário</label>
        <input type="time" class="form-input" id="ag-hora" value="${e?.hora||''}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Prioridade</label>
        <select class="form-select" id="ag-prioridade">
          <option value="alta" ${e?.prioridade==='alta'?'selected':''}>🔴 Alta</option>
          <option value="media" ${e?.prioridade==='media'||!e?'selected':''}>🟡 Média</option>
          <option value="normal" ${e?.prioridade==='normal'?'selected':''}>🟢 Normal</option>
        </select>
      </div>
      <div class="form-group">
        <label>WhatsApp <span style="opacity:.6;font-weight:400">(do quadro de membros)</span></label>
        <input type="text" class="form-input" id="ag-telefone" placeholder="(21) 90000-0000"
               value="${e?.telefone || telefoneDoMembro(e?.membro || '')}">
      </div>
    </div>
    <div class="form-group">
      <label>Observações (máx. 100 caracteres)</label>
      <input type="text" class="form-input" id="ag-obs" maxlength="100" placeholder="Observações livres…" value="${e?.obs||''}">
    </div>
    <div class="form-group" style="background:rgba(255,255,255,.03);border-radius:10px;padding:10px 12px">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;color:#c8d8e8;margin-bottom:8px">
        <input type="checkbox" id="ag-acompanhar" ${e?.acompanhar?'checked':''} style="width:16px;height:16px;accent-color:#fbbf24">
        🧭 Vai precisar de acompanhamento
      </label>
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;color:#c8d8e8">
        <input type="checkbox" id="ag-sigiloso" ${e?.sigiloso?'checked':''} style="width:16px;height:16px;accent-color:#e05555">
        🔒 Assunto sigiloso — somente o bispo visualiza
      </label>
    </div>
    <button class="btn-primary" onclick="salvarEntrevista('${id||''}')">💾 Salvar</button>
  `;
  abrirModal('modal-agenda');
}

async function salvarEntrevista(id) {
  const membro = document.getElementById('ag-membro').value.trim();
  if (!membro) return toast('Selecione um membro');
  const payload = {
    membro,
    tipo: document.getElementById('ag-tipo').value,
    responsavel: document.getElementById('ag-resp').value,
    data: document.getElementById('ag-data').value,
    hora: document.getElementById('ag-hora').value,
    telefone: document.getElementById('ag-telefone').value.trim(),
    prioridade: document.getElementById('ag-prioridade').value,
    obs: document.getElementById('ag-obs').value,
    acompanhar: document.getElementById('ag-acompanhar').checked,
    sigiloso: document.getElementById('ag-sigiloso').checked,
  };
  fecharModal('modal-agenda');
  reativarAbaAtual();
  try {
    if (id) {
      const atual = DADOS.agenda.find(x => x.id === id) || {};
      const atualizado = await apiFetch(`${API_AGENDA}?id=${id}`, 'PUT', { ...atual, ...payload });
      DADOS.agenda = DADOS.agenda.map(x => x.id === id ? atualizado : x);
    } else {
      const criado = await apiFetch(API_AGENDA, 'POST', { ...payload, status: 'pendente', reagendamentos: [] });
      DADOS.agenda.push(criado);
    }
    atualizarUltimaSinc(); setSyncStatus('ok');
  } catch(e) {
    if (id) DADOS.agenda = DADOS.agenda.map(x => x.id === id ? { ...x, ...payload } : x);
    else DADOS.agenda.push({ ...payload, id: 'local_' + Date.now(), status: 'pendente', reagendamentos: [] });
  }
  renderAgenda();
}

async function marcarRealizada(id) {
  const r = await pedirTexto('Concluir entrevista', [
    { id: 'obs', label: 'Observação ao concluir (opcional)', tipo: 'textarea' },
  ], { okLabel: 'Concluir' });
  if (r === null) return;
  const obs_conclusao = r.obs;
  try {
    const atualizado = await apiFetch(`${API_AGENDA}?id=${id}`, 'PUT', { status:'realizada', realizadaEm:new Date().toISOString(), obs_conclusao });
    DADOS.agenda = DADOS.agenda.map(e => e.id===id ? atualizado : e);
    atualizarUltimaSinc(); setSyncStatus('ok');
  } catch(e) {
    DADOS.agenda = DADOS.agenda.map(e => e.id===id ? {...e, status:'realizada', obs_conclusao} : e);
  }
  renderAgenda();
}

async function naoRealizada(id) {
  const r = await pedirTexto('Não realizada', [
    { id: 'motivo', label: 'Motivo', tipo: 'textarea', obrigatorio: true },
  ], { okLabel: 'Registrar' });
  if (r === null) return;
  const motivo = r.motivo;
  try {
    const atualizado = await apiFetch(`${API_AGENDA}?id=${id}`, 'PUT', { status:'nao-realizada', motivo });
    DADOS.agenda = DADOS.agenda.map(e => e.id===id ? atualizado : e);
    atualizarUltimaSinc(); setSyncStatus('ok');
  } catch(e) {
    DADOS.agenda = DADOS.agenda.map(e => e.id===id ? {...e, status:'nao-realizada', motivo} : e);
  }
  renderAgenda();
}

async function reagendarEntrevista(id) {
  const atualEnt = DADOS.agenda.find(e => e.id === id) || {};
  const r = await pedirTexto('Reagendar entrevista', [
    { id: 'data', label: 'Nova data', tipo: 'date', valor: atualEnt.data || '', obrigatorio: true },
  ], { okLabel: 'Reagendar' });
  if (r === null) return;
  const novaData = r.data;
  const atual = atualEnt;
  const hist = [...(atual.reagendamentos || []), { dataAnterior: atual.data, reagendadoEm: new Date().toISOString() }];
  try {
    const atualizado = await apiFetch(`${API_AGENDA}?id=${id}`, 'PUT', { data: novaData, status:'agendada', reagendamentos: hist });
    DADOS.agenda = DADOS.agenda.map(e => e.id===id ? atualizado : e);
    atualizarUltimaSinc(); setSyncStatus('ok');
  } catch(e) {
    DADOS.agenda = DADOS.agenda.map(e => e.id===id ? {...e, data:novaData, status:'agendada', reagendamentos:hist} : e);
  }
  renderAgenda();
}

async function excluirEntrevista(id) {
  if (!await confirmar('Excluir esta entrevista?', { perigo: true, okLabel: 'Excluir' })) return;
  try {
    await apiFetch(`${API_AGENDA}?id=${id}`, 'DELETE');
    atualizarUltimaSinc(); setSyncStatus('ok');
  } catch(e) {}
  DADOS.agenda = DADOS.agenda.filter(e => e.id !== id);
  renderAgenda();
}
