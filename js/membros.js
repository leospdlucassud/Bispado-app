// =============================================
// ABA MEMBROS — Entrada/Saída + Histórico
// =============================================
const API_MEMBROS = '/api/membros';
const MOTIVOS_ENTRADA = [
  'Batismo e Confirmação',
  'Criança Abençoada (Registro de Nascimento)',
  'Transferência Recebida (Mudança para a Ala)',
  'Membro Encontrado',
  'Readmissão por Batismo'
];
const MOTIVOS_SAIDA = [
  'Transferência Enviada (Mudança de Ala)',
  'Membro Não Encontrado (Endereço Desconhecido)',
  'Falecimento',
  'Remoção de Nome a Pedido',
  'Retirada de Condição de Membro (Conselho)'
];

let MOVIMENTACOES = [];
let MEMBROS_SAIDOS = []; // IDs dos membros que saíram
let filMembros = 'ativos';
let ROSTER_ATUALIZADO = null; // quando o quadro veio de um PDF importado

async function carregarMovimentacoes() {
  try {
    const res = await fetch(API_MEMBROS);
    if (res.ok) {
      const data = await res.json();
      if (data.movimentacoes) MOVIMENTACOES = data.movimentacoes;
      if (data.saidos) MEMBROS_SAIDOS = data.saidos;
      // Quadro importado de PDF tem prioridade sobre a lista embutida
      if (Array.isArray(data.roster) && data.roster.length) {
        MEMBROS = data.roster;
        ROSTER_ATUALIZADO = data.rosterAtualizadoEm || null;
      }
      if (data.adicionados) {
        // Merge adicionados into MEMBROS if not already there
        data.adicionados.forEach(m => {
          if (!MEMBROS.find(x => x.id === m.id)) MEMBROS.push(m);
        });
      }
    }
  } catch(e) {}
  renderMembros();
}

async function salvarDadosMembros() {
  const adicionados = MEMBROS.filter(m => m.id > 900000);
  // sem 'roster' no corpo, o servidor mantém o quadro já gravado
  const payload = { movimentacoes: MOVIMENTACOES, saidos: MEMBROS_SAIDOS, adicionados };
  try {
    await fetch(API_MEMBROS, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
  } catch(e) {}
}

function setFilMembros(val, btn) {
  filMembros = val;
  document.querySelectorAll('#filtros-membros .filtro-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderMembros();
}

function renderMembros() {
  const el = document.getElementById('lista-membros-tab');
  if (!el) return;
  const busca = (document.getElementById('busca-membros')?.value || '').toLowerCase();

  const info = document.getElementById('roster-info');
  if (info) {
    const comTel = MEMBROS.filter(m => m.telefone).length;
    info.innerHTML = ROSTER_ATUALIZADO
      ? `📄 Quadro importado do LCR em ${new Date(ROSTER_ATUALIZADO).toLocaleDateString('pt-BR')} · ${comTel} com telefone`
      : 'Lista embutida no app. Importe o PDF do LCR para atualizar e trazer telefones e e-mails.';
  }

  // Stats
  const totalAtivos = MEMBROS.filter(m => !MEMBROS_SAIDOS.includes(m.id)).length;
  const totalSaidos = MEMBROS_SAIDOS.length;
  const homens = MEMBROS.filter(m => !MEMBROS_SAIDOS.includes(m.id) && m.gender === 'M').length;
  const mulheres = MEMBROS.filter(m => !MEMBROS_SAIDOS.includes(m.id) && m.gender === 'F').length;

  document.getElementById('membros-stats').innerHTML = `
    <div class="membros-stat"><div class="stat-num">${totalAtivos}</div><div class="stat-label">Ativos</div></div>
    <div class="membros-stat"><div class="stat-num" style="color:#5b9bd5">${homens}</div><div class="stat-label">Homens</div></div>
    <div class="membros-stat"><div class="stat-num" style="color:#f472b6">${mulheres}</div><div class="stat-label">Mulheres</div></div>
    <div class="membros-stat"><div class="stat-num" style="color:#94a3b8">${totalSaidos}</div><div class="stat-label">Saídas</div></div>
    <div class="membros-stat"><div class="stat-num" style="color:#a78bfa">${MOVIMENTACOES.length}</div><div class="stat-label">Movimentações</div></div>
  `;

  if (filMembros === 'historico') {
    renderHistorico(el, busca);
    return;
  }

  let lista = MEMBROS.filter(m => {
    const matchBusca = !busca || m.name.toLowerCase().includes(busca);
    if (filMembros === 'ativos') return matchBusca && !MEMBROS_SAIDOS.includes(m.id);
    return matchBusca; // todos
  }).sort((a, b) => a.name.localeCompare(b.name));

  if (!lista.length) { el.innerHTML = '<div class="vazia">📭 Nenhum membro encontrado</div>'; return; }

  el.innerHTML = `<div style="font-size:11px;color:#445566;margin-bottom:8px">${lista.length} membro${lista.length>1?'s':''}</div>` +
    lista.map(m => {
      const saiu = MEMBROS_SAIDOS.includes(m.id);
      const mov = MOVIMENTACOES.filter(x => x.membroId === m.id).sort((a,b) => (b.data||'').localeCompare(a.data||''));
      const ultimaMov = mov[0];
      return `<div class="membro-card ${saiu?'saiu':''}">
        <div>
          <div class="membro-nome">${m.name}</div>
          <div class="membro-info">${m.gender==='M'?'♂':'♀'} · ${m.age||'?'} anos${ultimaMov?' · '+ultimaMov.motivo:''}</div>
        </div>
        ${saiu?`<span class="membro-badge saida">Saiu</span>`:`<span class="membro-badge entrada">Ativo</span>`}
      </div>`;
    }).join('');
}

function renderHistorico(el, busca) {
  let movs = [...MOVIMENTACOES].sort((a,b) => (b.data||'').localeCompare(a.data||''));
  if (busca) movs = movs.filter(m => (m.nome||'').toLowerCase().includes(busca) || (m.motivo||'').toLowerCase().includes(busca));

  if (!movs.length) { el.innerHTML = '<div class="vazia">📭 Nenhuma movimentação registrada</div>'; return; }

  el.innerHTML = movs.map(m => {
    const isEntrada = MOTIVOS_ENTRADA.includes(m.motivo);
    const isFalecimento = m.motivo === 'Falecimento';
    return `<div class="mov-card ${isEntrada?'entrada':'saida'}">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
        <span style="font-weight:700;color:#e8edf2">${m.nome||'—'}</span>
        <span class="membro-badge ${isEntrada?'entrada':isFalecimento?'falecimento':'saida'}">${isEntrada?'↓ Entrada':isFalecimento?'✝ Falecimento':'↑ Saída'}</span>
      </div>
      <div style="font-size:12px;color:#8eacc8">📋 ${m.motivo}</div>
      ${m.obs?`<div style="font-size:11px;color:#6a8fa8;margin-top:4px">📝 ${m.obs}</div>`:''}
      <div style="font-size:10px;color:#445566;margin-top:4px">📅 ${m.data?new Date(m.data).toLocaleDateString('pt-BR'):''} · 👤 ${m.registradoPor||'—'}</div>
    </div>`;
  }).join('');
}

function abrirModalEntrada() {
  const motivosOpts = MOTIVOS_ENTRADA.map(m => `<option value="${m}">${m}</option>`).join('');
  document.getElementById('modal-agenda-content').innerHTML = `
    <h3>➕ Registrar Entrada de Membro <button class="modal-close" onclick="fecharModal('modal-agenda')">✕</button></h3>
    <div class="form-group"><label>Nome completo</label><input type="text" class="form-input" id="me-nome" placeholder="Nome do membro…"></div>
    <div class="form-row">
      <div class="form-group"><label>Sexo</label>
        <select class="form-select" id="me-sexo"><option value="M">Masculino</option><option value="F">Feminino</option></select>
      </div>
      <div class="form-group"><label>Idade</label><input type="number" class="form-input" id="me-idade" min="0" max="120" placeholder="Idade"></div>
    </div>
    <div class="form-group"><label>Motivo da Entrada</label><select class="form-select" id="me-motivo">${motivosOpts}</select></div>
    <div class="form-group"><label>Data</label><input type="date" class="form-input" id="me-data" value="${new Date().toISOString().slice(0,10)}"></div>
    <div class="form-group"><label>Observações</label><input type="text" class="form-input" id="me-obs" maxlength="200" placeholder="Detalhes adicionais…"></div>
    <button class="btn-primary" onclick="salvarEntrada()">💾 Registrar Entrada</button>
  `;
  abrirModal('modal-agenda');
}

async function salvarEntrada() {
  const nome = document.getElementById('me-nome').value.trim();
  if (!nome) return toast('Informe o nome do membro');
  const novoId = 900000 + Date.now() % 100000;
  const novoMembro = { id: novoId, name: nome, gender: document.getElementById('me-sexo').value, age: parseInt(document.getElementById('me-idade').value)||0 };
  MEMBROS.push(novoMembro);

  const mov = {
    id: 'mov_' + Date.now(),
    tipo: 'entrada',
    membroId: novoId,
    nome: nome,
    motivo: document.getElementById('me-motivo').value,
    data: document.getElementById('me-data').value || new Date().toISOString(),
    obs: document.getElementById('me-obs').value,
    registradoPor: USUARIO || 'Não identificado'
  };
  MOVIMENTACOES.push(mov);

  fecharModal('modal-agenda');
  reativarAbaAtual();
  await salvarDadosMembros();
  renderMembros();
}

function abrirModalSaida() {
  const motivosOpts = MOTIVOS_SAIDA.map(m => `<option value="${m}">${m}</option>`).join('');
  const membrosAtivos = MEMBROS.filter(m => !MEMBROS_SAIDOS.includes(m.id)).sort((a,b) => a.name.localeCompare(b.name));
  const membrosOpts = membrosAtivos.map(m => `<option value="${m.id}">${m.name}</option>`).join('');

  document.getElementById('modal-agenda-content').innerHTML = `
    <h3>📤 Registrar Saída de Membro <button class="modal-close" onclick="fecharModal('modal-agenda')">✕</button></h3>
    <div class="form-group"><label>Membro</label>
      <input list="dl-saida-membros" class="form-input" id="ms-membro-nome" placeholder="Digite o nome do membro…" oninput="buscarMembroSaida(this.value)">
      <datalist id="dl-saida-membros">${membrosAtivos.map(m=>`<option value="${m.name}">`).join('')}</datalist>
      <input type="hidden" id="ms-membro-id">
    </div>
    <div class="form-group"><label>Motivo da Saída</label><select class="form-select" id="ms-motivo">${motivosOpts}</select></div>
    <div class="form-group"><label>Data</label><input type="date" class="form-input" id="ms-data" value="${new Date().toISOString().slice(0,10)}"></div>
    <div class="form-group"><label>Observações</label><input type="text" class="form-input" id="ms-obs" maxlength="200" placeholder="Detalhes adicionais…"></div>
    <button class="btn-primary" style="background:#e07070" onclick="salvarSaida()">📤 Registrar Saída</button>
  `;
  abrirModal('modal-agenda');
}

function buscarMembroSaida(nome) {
  const m = MEMBROS.find(x => x.name === nome);
  document.getElementById('ms-membro-id').value = m ? m.id : '';
}

async function salvarSaida() {
  const nome = document.getElementById('ms-membro-nome').value.trim();
  const membro = MEMBROS.find(x => x.name === nome);
  if (!membro) return toast('Membro não encontrado. Selecione da lista.');

  if (!await confirmar('Confirma a saída de ' + nome + '?', { okLabel: 'Confirmar saída' })) return;

  MEMBROS_SAIDOS.push(membro.id);

  const mov = {
    id: 'mov_' + Date.now(),
    tipo: 'saida',
    membroId: membro.id,
    nome: nome,
    motivo: document.getElementById('ms-motivo').value,
    data: document.getElementById('ms-data').value || new Date().toISOString(),
    obs: document.getElementById('ms-obs').value,
    registradoPor: USUARIO || 'Não identificado'
  };
  MOVIMENTACOES.push(mov);

  fecharModal('modal-agenda');
  reativarAbaAtual();
  await salvarDadosMembros();
  renderMembros();
}

// (o gancho de troca de aba vive em app.js)
