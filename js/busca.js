// ===== BUSCADOR =====
function highlight(text, query){
  if(!query) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return text.replace(new RegExp('('+escaped+')', 'gi'), '<mark>$1</mark>');
}

function doSearch(val){
  const q = val.trim().toLowerCase();
  const clearBtn = document.getElementById('search-clear');
  const resultsDiv = document.getElementById('search-results');
  const mainContent = document.getElementById('main-content');
  const hitsDiv = document.getElementById('search-hits');
  const countDiv = document.getElementById('search-count');

  clearBtn.classList.toggle('visible', q.length > 0);

  if(q.length < 2){
    resultsDiv.classList.remove('active');
    mainContent.style.display = '';
    return;
  }

  mainContent.style.display = 'none';
  resultsDiv.classList.add('active');

  // === 1. Busca dinâmica: Sacramentais ===
  const sacMatches = (DADOS.sacramentais||[]).filter(s => {
    const txt = [
      s.data, s.presidida, s.dirigida, s.regente, s.pianista,
      s.reconhecimentos, s.anuncios, s.apoios,
      s.oracaoAbertura, s.oracaoEncerramento,
      s.primeiroHino, s.hinoSacramental, s.hinoIntermediario || s.hinoEspecial, s.hinoFinal,
      s.orador1, s.tema1, s.orador2, s.tema2, s.orador3, s.tema3,
      s.observacoes,
    ].filter(Boolean).join(' ').toLowerCase();
    return txt.includes(q);
  });

  // === 2. Busca dinâmica: Entrevistas/Agenda ===
  const respNome = { bispo:'Bispo', c1:'1º Conselheiro', c2:'2º Conselheiro', sec:'Secretário' };
  const agendaMatches = (DADOS.agenda||[]).filter(podeVer).filter(e => {
    const txt = [e.membro, e.tipo, e.obs, e.obs_conclusao, respNome[e.responsavel]||''].join(' ').toLowerCase();
    return txt.includes(q);
  });

  // === 2b. Busca dinâmica: Acompanhamentos ===
  const acompMatches = (typeof listaAcompanhamentos === 'function' ? listaAcompanhamentos() : []).filter(a =>
    [a.titulo, a.assunto, a.responsavel, a.registros.map(r=>r.texto).join(' ')].join(' ').toLowerCase().includes(q));

  // === 3. Busca dinâmica: Designações ===
  const desigMatches = (DADOS.designacoes||[]).filter(d => {
    const txt = [d.tarefa, d.responsavel, d.obs, d.obs_conclusao||''].join(' ').toLowerCase();
    return txt.includes(q);
  });

  // === 4. Busca dinâmica: Reuniões/Atas ===
  const reuniaoMatches = (DADOS.reunioes||[]).filter(r => {
    const txt = [r.pauta, r.tipo, (r.participantes||[]).join(' '), (r.itens||[]).map(i=>i.texto).join(' ')].join(' ').toLowerCase();
    return txt.includes(q);
  });

  // === 5. Busca dinâmica: Notas ===
  const allNotas = [...(NOTAS_PRIVADAS||[]).map(n=>({...n,scope:'privada'})), ...(NOTAS_COMPARTILHADAS||[]).map(n=>({...n,scope:'compartilhada'}))];
  const notasMatches = allNotas.filter(n => {
    const txt = [n.titulo, n.texto, n.autor||''].join(' ').toLowerCase();
    return txt.includes(q);
  });

  // === 6. Busca estática: Ordenanças ===
  const ordCards = document.querySelectorAll('.ord-card');
  const ordMatches = [];
  ordCards.forEach(card => {
    const txt = card.textContent.toLowerCase();
    if (txt.includes(q)) {
      const titulo = card.querySelector('.ord-titulo')?.textContent || 'Ordenança';
      ordMatches.push({ titulo, card });
    }
  });

  const totalCount = acompMatches.length + sacMatches.length + agendaMatches.length + desigMatches.length + reuniaoMatches.length + notasMatches.length + ordMatches.length;

  countDiv.textContent = totalCount === 0
    ? '' : totalCount === 1
    ? '1 resultado encontrado' : `${totalCount} resultados encontrados`;

  if(totalCount === 0){
    hitsDiv.innerHTML = `<div class="search-no-results">😕 Nenhum resultado para "<strong>${val}</strong>"<br><small style="color:#3a5068;margin-top:6px;display:block">Tente um nome de membro, tema de discurso, tarefa, hino ou ordenança…</small></div>`;
    return;
  }

  let html = '';

  // Resultados de Sacramentais
  html += sacMatches.map(s => {
    const d = new Date(s.data + 'T12:00:00');
    const quem = [s.orador1, s.orador2, s.orador3].filter(Boolean).join(', ');
    const temas = [s.tema1, s.tema2, s.tema3].filter(Boolean).join(' · ');
    const snippet = highlight([quem, temas].filter(Boolean).join(' — ').substring(0,120), val);
    return `<div class="search-result-card" style="border-color:#e8d080">
      <div class="search-result-head"><span style="font-size:16px">🕊️</span><div style="flex:1">
        <div class="search-result-who" style="color:#e8d080">Sacramental</div>
        <div class="search-result-title">${formatDateSac(d)} de ${d.getFullYear()}</div>
      </div><button onclick="clearSearch();switchTab('sacramental')" style="background:#e8d080;color:#0d1b2a;border:none;padding:5px 12px;border-radius:20px;font-size:11px;font-weight:700;cursor:pointer">Ver →</button></div>
      <div class="search-result-body"><div class="search-result-snippet">${snippet}</div></div>
    </div>`;
  }).join('');

  // Resultados de Entrevistas
  html += agendaMatches.map(e => {
    const snippet = highlight([e.membro, e.tipo, e.obs||''].join(' — ').substring(0,120), val);
    return `<div class="search-result-card" style="border-color:#34d399">
      <div class="search-result-head"><span style="font-size:16px">🗓️</span><div style="flex:1">
        <div class="search-result-who" style="color:#34d399">Agenda</div>
        <div class="search-result-title">${highlight(e.membro, val)} — ${highlight(e.tipo, val)}</div>
      </div><button onclick="clearSearch();switchTab('agenda')" style="background:#34d399;color:#0d1b2a;border:none;padding:5px 12px;border-radius:20px;font-size:11px;font-weight:700;cursor:pointer">Ver →</button></div>
      <div class="search-result-body"><div class="search-result-snippet">${snippet}</div></div>
    </div>`;
  }).join('');

  // Resultados de Acompanhamento
  html += acompMatches.map(a => {
    const ult = a.registros[a.registros.length-1];
    return `<div class="search-result-card" style="border-color:#fbbf24">
      <div class="search-result-head"><span style="font-size:16px">🧭</span><div style="flex:1">
        <div class="search-result-who" style="color:#fbbf24">Acompanhamento${a.sigiloso?' 🔒':''}</div>
        <div class="search-result-title">${highlight(esc(a.titulo), val)}</div>
      </div><button onclick="clearSearch();switchTab('acompanhamento')" style="background:#fbbf24;color:#0d1b2a;border:none;padding:5px 12px;border-radius:20px;font-size:11px;font-weight:700;cursor:pointer">Ver →</button></div>
      <div class="search-result-body"><div class="search-result-snippet">${highlight(esc(a.assunto || (ult && ult.texto) || '').slice(0,120), val)}</div></div>
    </div>`;
  }).join('');

  // Resultados de Designações
  html += desigMatches.map(d => {
    const snippet = highlight([d.tarefa, d.responsavel||'', d.obs||''].join(' — ').substring(0,120), val);
    return `<div class="search-result-card" style="border-color:#f472b6">
      <div class="search-result-head"><span style="font-size:16px">✅</span><div style="flex:1">
        <div class="search-result-who" style="color:#f472b6">Designação</div>
        <div class="search-result-title">${highlight(d.tarefa, val)}</div>
      </div><button onclick="clearSearch();switchTab('designacoes')" style="background:#f472b6;color:#0d1b2a;border:none;padding:5px 12px;border-radius:20px;font-size:11px;font-weight:700;cursor:pointer">Ver →</button></div>
      <div class="search-result-body"><div class="search-result-snippet">${snippet}</div></div>
    </div>`;
  }).join('');

  // Resultados de Reuniões
  html += reuniaoMatches.map(r => {
    const snippet = highlight([(r.pauta||'').substring(0,100), (r.itens||[]).map(i=>i.texto).join(', ').substring(0,60)].join(' · '), val);
    return `<div class="search-result-card" style="border-color:#a78bfa">
      <div class="search-result-head"><span style="font-size:16px">📋</span><div style="flex:1">
        <div class="search-result-who" style="color:#a78bfa">Reunião</div>
        <div class="search-result-title">${tipoReuniao(r.tipo).r} — ${formatarData(r.data)}</div>
      </div><button onclick="clearSearch();switchTab('reuniao')" style="background:#a78bfa;color:#0d1b2a;border:none;padding:5px 12px;border-radius:20px;font-size:11px;font-weight:700;cursor:pointer">Ver →</button></div>
      <div class="search-result-body"><div class="search-result-snippet">${snippet}</div></div>
    </div>`;
  }).join('');

  // Resultados de Notas
  html += notasMatches.map(n => {
    const snippet = highlight((n.texto||'').substring(0,120), val);
    const cor = n.scope==='privada' ? '#f59e0b' : '#60a5fa';
    return `<div class="search-result-card" style="border-color:${cor}">
      <div class="search-result-head"><span style="font-size:16px">📝</span><div style="flex:1">
        <div class="search-result-who" style="color:${cor}">Nota ${n.scope==='privada'?'Privada':'Compartilhada'}</div>
        <div class="search-result-title">${highlight(n.titulo||'Nota', val)}</div>
      </div><button onclick="clearSearch();switchTab('notas')" style="background:${cor};color:#0d1b2a;border:none;padding:5px 12px;border-radius:20px;font-size:11px;font-weight:700;cursor:pointer">Ver →</button></div>
      <div class="search-result-body"><div class="search-result-snippet">${snippet}</div></div>
    </div>`;
  }).join('');

  // Resultados de Ordenanças
  html += ordMatches.map(o => {
    return `<div class="search-result-card" style="border-color:#a78bfa">
      <div class="search-result-head"><span style="font-size:16px">🕊️</span><div style="flex:1">
        <div class="search-result-who" style="color:#a78bfa">Ordenança</div>
        <div class="search-result-title">${highlight(o.titulo, val)}</div>
      </div><button onclick="clearSearch();switchTab('ordenancas');setTimeout(()=>{const c=document.getElementById('${o.card.id}');if(c){c.classList.add('open');c.scrollIntoView({behavior:'smooth',block:'center'})}},100)" style="background:#a78bfa;color:#0d1b2a;border:none;padding:5px 12px;border-radius:20px;font-size:11px;font-weight:700;cursor:pointer">Ver →</button></div>
    </div>`;
  }).join('');

  hitsDiv.innerHTML = html;
}

function clearSearch(){
  const input = document.getElementById('search-input');
  input.value = '';
  doSearch('');
}
