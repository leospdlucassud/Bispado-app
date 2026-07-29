// =============================================
// CALENDÁRIO
// =============================================
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

// Eventos do calendário da estaca 2026. O marcador {ALA} é trocado pelo nome
// informado no cabeçalho em tempo de renderização (ver comAla).
const EVENTOS_FIXOS = [
  // JANEIRO
  {data:'2026-01-01',txt:'Confraternização Universal',cor:'#60a5fa',tipo:'feriado'},
  {data:'2026-01-11',txt:'Encontro On-Line Primária 17h',cor:'#34d399',tipo:'ala'},
  {data:'2026-01-15',txt:'Limite Relatório Trimestral',cor:'#c9a84c',tipo:'bispado'},
  {data:'2026-01-25',txt:'Visita Oficial em {ALA}',cor:'#a78bfa',tipo:'estaca'},
  {data:'2026-01-25',txt:'Reunião Sumo Conselho 07h',cor:'#a78bfa',tipo:'estaca'},
  // FEVEREIRO
  {data:'2026-02-08',txt:'Reunião Conselho dos Bispos 16h',cor:'#c9a84c',tipo:'bispado'},
  {data:'2026-02-08',txt:'Auditoria Financeira {ALA}',cor:'#c9a84c',tipo:'bispado'},
  {data:'2026-02-08',txt:'Reunião de Conselho das Alas 17h',cor:'#a78bfa',tipo:'estaca'},
  {data:'2026-02-14',txt:'FSY — Conferências Força dos Jovens',cor:'#f472b6',tipo:'jovens'},
  {data:'2026-02-15',txt:'FSY — Conferências Força dos Jovens',cor:'#f472b6',tipo:'jovens'},
  {data:'2026-02-16',txt:'FSY — Conferências Força dos Jovens',cor:'#f472b6',tipo:'jovens'},
  {data:'2026-02-17',txt:'FSY — Conferências Força dos Jovens',cor:'#f472b6',tipo:'jovens'},
  {data:'2026-02-18',txt:'FSY — Conferências Força dos Jovens',cor:'#f472b6',tipo:'jovens'},
  // MARÇO
  {data:'2026-03-08',txt:'Devocional Mundial Soc. de Socorro',cor:'#34d399',tipo:'ala'},
  {data:'2026-03-15',txt:'Live Saúde Mental 20h',cor:'#34d399',tipo:'ala'},
  {data:'2026-03-28',txt:'Dia da Autossuficiência nas Alas 16h',cor:'#c9a84c',tipo:'bispado'},
  {data:'2026-03-29',txt:'Celebrar Época de Páscoa',cor:'#34d399',tipo:'ala'},
  // ABRIL
  {data:'2026-04-03',txt:'Sexta-feira Santa',cor:'#60a5fa',tipo:'feriado'},
  {data:'2026-04-04',txt:'Conferência Geral',cor:'#a78bfa',tipo:'estaca'},
  {data:'2026-04-05',txt:'Páscoa — Conferência Geral',cor:'#a78bfa',tipo:'estaca'},
  {data:'2026-04-12',txt:'Reunião de Testemunho',cor:'#34d399',tipo:'ala'},
  {data:'2026-04-12',txt:'Reunião Sumo Conselho 07h',cor:'#a78bfa',tipo:'estaca'},
  {data:'2026-04-15',txt:'Limite Relatório Trimestral',cor:'#c9a84c',tipo:'bispado'},
  {data:'2026-04-19',txt:'Reunião Geral Sacerdócio Estaca 18h',cor:'#a78bfa',tipo:'estaca'},
  {data:'2026-04-26',txt:'Visita Oficial a {ALA}',cor:'#a78bfa',tipo:'estaca'},
  {data:'2026-04-26',txt:'Dia D de Templo e Hist. Família',cor:'#50d0c0',tipo:'templo'},
  // MAIO
  {data:'2026-05-01',txt:'Dia do Trabalhador',cor:'#60a5fa',tipo:'feriado'},
  {data:'2026-05-01',txt:'DAYCAMP Primária / Mini FSY 09h',cor:'#f472b6',tipo:'jovens'},
  {data:'2026-05-10',txt:'Dia das Mães',cor:'#34d399',tipo:'ala'},
  {data:'2026-05-15',txt:'Limite Relatório Trimestral',cor:'#c9a84c',tipo:'bispado'},
  {data:'2026-05-15',txt:'Live Saúde Mental 20h',cor:'#34d399',tipo:'ala'},
  {data:'2026-05-17',txt:'Reunião Conselho dos Bispos 16h',cor:'#c9a84c',tipo:'bispado'},
  {data:'2026-05-17',txt:'Reunião de Conselho das Alas 17h',cor:'#a78bfa',tipo:'estaca'},
  {data:'2026-05-31',txt:'Encontro On-Line Primária 17h',cor:'#34d399',tipo:'ala'},
  {data:'2026-05-31',txt:'Reunião Sumo Conselho 07h',cor:'#a78bfa',tipo:'estaca'},
  // JUNHO
  {data:'2026-06-04',txt:'Corpus Christi',cor:'#60a5fa',tipo:'feriado'},
  {data:'2026-06-12',txt:'Dia dos Namorados',cor:'#34d399',tipo:'ala'},
  {data:'2026-06-13',txt:'Conferência da Estaca',cor:'#a78bfa',tipo:'estaca'},
  {data:'2026-06-14',txt:'Conferência da Estaca',cor:'#a78bfa',tipo:'estaca'},
  {data:'2026-06-28',txt:'Treinamento de Auditoria 18h',cor:'#c9a84c',tipo:'bispado'},
  // JULHO
  {data:'2026-07-11',txt:'Dia da Autossuficiência 16h',cor:'#c9a84c',tipo:'bispado'},
  {data:'2026-07-15',txt:'Limite Relatório Trimestral',cor:'#c9a84c',tipo:'bispado'},
  {data:'2026-07-19',txt:'Auditoria Financeira {ALA}',cor:'#c9a84c',tipo:'bispado'},
  {data:'2026-07-24',txt:'Evento Brasil de Indexação',cor:'#50d0c0',tipo:'templo'},
  {data:'2026-07-25',txt:'Evento Brasil de Indexação',cor:'#50d0c0',tipo:'templo'},
  {data:'2026-07-26',txt:'Visita Oficial em {ALA}',cor:'#a78bfa',tipo:'estaca'},
  {data:'2026-07-26',txt:'Reunião Sumo Conselho 07h',cor:'#a78bfa',tipo:'estaca'},
  {data:'2026-07-26',txt:'Evento Brasil de Indexação',cor:'#50d0c0',tipo:'templo'},
  {data:'2026-07-27',txt:'Evento Brasil de Indexação',cor:'#50d0c0',tipo:'templo'},
  // AGOSTO
  {data:'2026-08-08',txt:'Dia do Seminário',cor:'#f472b6',tipo:'jovens'},
  {data:'2026-08-09',txt:'Dia dos Pais',cor:'#34d399',tipo:'ala'},
  {data:'2026-08-13',txt:'Reunião Sumo Conselho 07h',cor:'#a78bfa',tipo:'estaca'},
  {data:'2026-08-15',txt:'Voluntariado Mãos que Ajudam',cor:'#34d399',tipo:'ala'},
  {data:'2026-08-29',txt:'Aniversário da Primária',cor:'#34d399',tipo:'ala'},
  // SETEMBRO
  {data:'2026-09-07',txt:'Independência do Brasil',cor:'#60a5fa',tipo:'feriado'},
  {data:'2026-09-12',txt:'Caravana ao Templo JAS/ORM',cor:'#50d0c0',tipo:'templo'},
  {data:'2026-09-13',txt:'Conferência da {ALA}',cor:'#c9a84c',tipo:'bispado'},
  {data:'2026-09-13',txt:'Reunião Sumo Conselho 07h',cor:'#a78bfa',tipo:'estaca'},
  {data:'2026-09-13',txt:'Reunião Conselho dos Bispos 16h',cor:'#c9a84c',tipo:'bispado'},
  {data:'2026-09-22',txt:'Live Saúde Mental 20h',cor:'#34d399',tipo:'ala'},
  {data:'2026-09-24',txt:'Live Saúde Mental 20h',cor:'#34d399',tipo:'ala'},
  {data:'2026-09-27',txt:'Conferência da {ALA}',cor:'#c9a84c',tipo:'bispado'},
  {data:'2026-09-27',txt:'Reunião Sumo Conselho 07h',cor:'#a78bfa',tipo:'estaca'},
  // OUTUBRO
  {data:'2026-10-03',txt:'Conferência Geral',cor:'#a78bfa',tipo:'estaca'},
  {data:'2026-10-04',txt:'Conferência Geral',cor:'#a78bfa',tipo:'estaca'},
  {data:'2026-10-12',txt:'Padroeira do Brasil',cor:'#60a5fa',tipo:'feriado'},
  {data:'2026-10-15',txt:'Limite Relatório Trimestral',cor:'#c9a84c',tipo:'bispado'},
  {data:'2026-10-17',txt:'Conferência da Estaca',cor:'#a78bfa',tipo:'estaca'},
  {data:'2026-10-18',txt:'Conferência da Estaca',cor:'#a78bfa',tipo:'estaca'},
  {data:'2026-10-24',txt:'Ministração (Quórum & SS)',cor:'#34d399',tipo:'ala'},
  {data:'2026-10-25',txt:'Treinamento Novos Líderes 18h',cor:'#c9a84c',tipo:'bispado'},
  // NOVEMBRO
  {data:'2026-11-02',txt:'Finados',cor:'#60a5fa',tipo:'feriado'},
  {data:'2026-11-15',txt:'Proclamação da República',cor:'#60a5fa',tipo:'feriado'},
  {data:'2026-11-15',txt:'Sacramental Especial Primária {ALA}',cor:'#34d399',tipo:'ala'},
  {data:'2026-11-20',txt:'Consciência Negra',cor:'#60a5fa',tipo:'feriado'},
  {data:'2026-11-20',txt:'Acampamento Anual',cor:'#f472b6',tipo:'jovens'},
  {data:'2026-11-21',txt:'Acampamento Anual',cor:'#f472b6',tipo:'jovens'},
  {data:'2026-11-21',txt:'Preparação para Sacerdócio e Templo 16:30h',cor:'#50d0c0',tipo:'templo'},
  {data:'2026-11-22',txt:'Encontro On-Line Primária 17h',cor:'#34d399',tipo:'ala'},
  // DEZEMBRO
  {data:'2026-12-06',txt:'Devocional de Natal da Pres. Presidência',cor:'#a78bfa',tipo:'estaca'},
  {data:'2026-12-06',txt:'Treinamento Auditoria Estaca',cor:'#c9a84c',tipo:'bispado'},
  {data:'2026-12-12',txt:'Confraternização Natalina da Estaca',cor:'#a78bfa',tipo:'estaca'},
  {data:'2026-12-20',txt:'Reunião Sacramental Especial',cor:'#34d399',tipo:'ala'},
  {data:'2026-12-25',txt:'Natal',cor:'#60a5fa',tipo:'feriado'},
  {data:'2026-12-31',txt:'Véspera de Ano Novo',cor:'#60a5fa',tipo:'feriado'},
];

function renderCalendario() {
  const grid = document.getElementById('cal-grid');
  if (!grid) return;
  document.getElementById('cal-titulo-mes').textContent = `${MESES[calMes]} ${calAno}`;

  const primeiroDia = new Date(calAno, calMes, 1).getDay();
  const diasNoMes = new Date(calAno, calMes+1, 0).getDate();
  const hoje = new Date();

  // Junta eventos fixos + extras
  const todosEventos = [
    ...EVENTOS_FIXOS,
    ...DADOS.eventos_extras.map(e=>({...e, extra:true}))
  ];

  let html = DIAS_SEMANA.map(d=>`<div class="cal-dia-nome">${d}</div>`).join('');

  // Dias vazios antes
  for (let i=0;i<primeiroDia;i++) html+=`<div class="cal-dia outro-mes"></div>`;

  for (let d=1;d<=diasNoMes;d++) {
    const dataStr = `${calAno}-${String(calMes+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const evsDia = todosEventos.filter(e=>e.data===dataStr);
    const eHoje = hoje.getDate()===d && hoje.getMonth()===calMes && hoje.getFullYear()===calAno;
    html += `<div class="cal-dia${eHoje?' hoje':''}${evsDia.length?' tem-evento':''}" onclick="verDia('${dataStr}')">
      <div class="cal-num" style="${eHoje?'color:#c9a84c;font-weight:800':''}">${d}</div>
      ${evsDia.slice(0,2).map(e=>`<div class="cal-evento-dot" style="color:${e.cor}">${comAla(e.txt)}</div>`).join('')}
      ${evsDia.length>2?`<div style="font-size:9px;color:#8eacc8">+${evsDia.length-2}</div>`:''}
    </div>`;
  }

  grid.innerHTML = html;
  document.getElementById('cal-detalhe')?.classList.remove('open');
}

function verDia(dataStr) {
  const todosEventos = [...EVENTOS_FIXOS, ...DADOS.eventos_extras.map(e=>({...e,extra:true}))];
  const evs = todosEventos.filter(e=>e.data===dataStr);
  const det = document.getElementById('cal-detalhe');
  const titulo = document.getElementById('cal-detalhe-titulo');
  const items = document.getElementById('cal-detalhe-items');
  if (!det||!titulo||!items) return;
  const [ano,mes,dia] = dataStr.split('-');
  titulo.textContent = `${parseInt(dia)} de ${MESES[parseInt(mes)-1]} de ${ano}`;
  if (!evs.length) {
    items.innerHTML = '<div style="font-size:13px;color:#8eacc8">Sem eventos cadastrados neste dia.</div>';
  } else {
    items.innerHTML = evs.map(e=>`
      <div class="cal-ev-item">
        <span style="color:${e.cor};margin-right:8px">●</span>${comAla(e.txt)}
        ${e.extra?`<button class="btn-danger" style="margin-left:8px;padding:2px 8px;font-size:10px" onclick="excluirEvento('${e.id}')">🗑</button>`:''}
      </div>
    `).join('');
  }
  det.classList.add('open');
}

function mudarMes(dir) {
  calMes += dir;
  if (calMes > 11) { calMes=0; calAno++; }
  if (calMes < 0)  { calMes=11; calAno--; }
  renderCalendario();
}

function abrirModalEvento() {
  document.getElementById('modal-evento-content').innerHTML = `
    <h3>➕ Novo Evento <button class="modal-close" onclick="fecharModal('modal-evento')">✕</button></h3>
    <div class="form-group"><label>Data</label><input type="date" class="form-input" id="ev-data" value="${calAno}-${String(calMes+1).padStart(2,'0')}-01"></div>
    <div class="form-group"><label>Descrição</label><input type="text" class="form-input" id="ev-txt" placeholder="Descreva o evento…"></div>
    <div class="form-group"><label>Categoria</label>
      <select class="form-select" id="ev-tipo">
        <option value="#c9a84c">⚜️ Bispado</option>
        <option value="#a78bfa">🟣 Estaca</option>
        <option value="#34d399">🟢 Ala</option>
        <option value="#f472b6">🩷 Jovens</option>
        <option value="#50d0c0">🔵 Templo</option>
      </select>
    </div>
    <button class="btn-primary" onclick="salvarEvento()">💾 Salvar</button>
  `;
  abrirModal('modal-evento');
}

async function salvarEvento() {
  const txt = document.getElementById('ev-txt').value.trim();
  const data = document.getElementById('ev-data').value;
  if (!txt||!data) return toast('Preencha todos os campos');
  const payload = { data, txt, cor: document.getElementById('ev-tipo').value };
  fecharModal('modal-evento');
  reativarAbaAtual();
  try {
    const criado = await apiFetch(API_EVENTOS, 'POST', payload);
    DADOS.eventos_extras.push(criado);
    atualizarUltimaSinc(); setSyncStatus('ok');
  } catch(e) {
    DADOS.eventos_extras.push({ ...payload, id: 'local_' + Date.now() });
  }
  renderCalendario();
}

async function excluirEvento(id) {
  if (!await confirmar('Excluir evento?', { perigo: true, okLabel: 'Excluir' })) return;
  try { await apiFetch(`${API_EVENTOS}?id=${id}`, 'DELETE'); atualizarUltimaSinc(); setSyncStatus('ok'); } catch(e) {}
  DADOS.eventos_extras = DADOS.eventos_extras.filter(e => e.id !== id);
  renderCalendario();
}
