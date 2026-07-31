// =============================================
// PLANEJADOR DE SACRAMENTAIS
// =============================================
export let sacCarregado = false;
export let sacMes = new Date().getMonth();
export let sacAno = new Date().getFullYear();

// Banco de oradores (localStorage)
export const SAC_BANCO_KEY = 'sac_banco_oradores';
export function getBancoOradores() {
  try { return JSON.parse(localStorage.getItem(SAC_BANCO_KEY)) || {quorum:[],socsoc:[],jovens:[],outros:[]}; }
  catch { return {quorum:[],socsoc:[],jovens:[],outros:[]}; }
}
export function saveBancoOradores(banco) { localStorage.setItem(SAC_BANCO_KEY, JSON.stringify(banco)); }

export function renderBancoOradores() {
  const banco = getBancoOradores();
  const groups = {quorum:'banco-quorum',socsoc:'banco-socsoc',jovens:'banco-jovens',outros:'banco-outros'};
  for (const [key, elId] of Object.entries(groups)) {
    const el = document.getElementById(elId);
    if (!el) continue;
    const nomes = banco[key] || [];
    el.innerHTML = nomes.length
      ? nomes.map((n,i) => `<div style="display:flex;align-items:center;gap:4px"><span>${n}</span><span data-act="remover" data-grupo="${key}" data-idx="${i}" style="cursor:pointer;color:#e05555;font-size:10px;opacity:.6" title="Remover">✕</span></div>`).join('')
      : '<span style="opacity:.4">—</span>';
  }
}

export function adicionarOrador() {
  const nome = document.getElementById('novo-orador-nome').value.trim();
  const grupo = document.getElementById('novo-orador-grupo').value;
  if (!nome) return;
  const banco = getBancoOradores();
  if (!banco[grupo]) banco[grupo] = [];
  banco[grupo].push(nome);
  saveBancoOradores(banco);
  document.getElementById('novo-orador-nome').value = '';
  renderBancoOradores();
}

export function removerOrador(grupo, idx) {
  const banco = getBancoOradores();
  if (banco[grupo]) banco[grupo].splice(idx, 1);
  saveBancoOradores(banco);
  renderBancoOradores();
}

// Gerar domingos do mês
export function getDomingosMes(mes, ano) {
  const domingos = [];
  const d = new Date(ano, mes, 1);
  while (d.getMonth() === mes) {
    if (d.getDay() === 0) domingos.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return domingos;
}

export function formatDateSac(d) {
  const dias = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
  const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  return `${d.getDate()} de ${meses[d.getMonth()]}`;
}

export function formatDateKey(d) {
  return d.toISOString().split('T')[0];
}

export const MESES_NOME = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

export function mudarMesSac(dir) {
  sacMes += dir;
  if (sacMes > 11) { sacMes = 0; sacAno++; }
  if (sacMes < 0) { sacMes = 11; sacAno--; }
  renderSacramentais();
}

export async function carregarSacramentais() {
  try {
    const data = await apiFetch(API_SAC);
    if (Array.isArray(data)) DADOS.sacramentais = data;
  } catch { }
  sacCarregado = true;
  renderBancoOradores();
  renderSacramentais();
}

export function getSacPorData(dataKey) {
  if (!DADOS.sacramentais) DADOS.sacramentais = [];
  return DADOS.sacramentais.find(s => s.data === dataKey);
}

// Campos da ata, na ordem em que a reunião acontece.
// 'hinoEspecial' era o nome antigo do hino intermediário — lido como reserva.
export const ATA_ORDEM = [
  { k:'presidida',        r:'Presidida por' },
  { k:'dirigida',         r:'Dirigida por' },
  { k:'regente',          r:'Regente' },
  { k:'pianista',         r:'Pianista' },
  { k:'reconhecimentos',  r:'Reconhecimentos',        area:true, ph:'Líderes e autoridades presentes' },
  { k:'anuncios',         r:'Anúncios',               area:true },
  { k:'primeiroHino',     r:'Hino inicial',           hino:true },
  { k:'oracaoAbertura',   r:'Oração de abertura' },
  { k:'apoios',           r:'Apoios e desobrigações', area:true },
  { k:'hinoSacramental',  r:'Hino Sacramental',       hino:true },
  { orador:1 },
  { orador:2 },
  { k:'hinoIntermediario',r:'Hino intermediário',     hino:true },
  { orador:3 },
  { k:'hinoFinal',        r:'Hino de encerramento',   hino:true },
  { k:'oracaoEncerramento', r:'Oração de encerramento' },
];

// Lê um campo aceitando os nomes antigos
export function campoAta(sac, k) {
  if (!sac) return '';
  if (k === 'hinoIntermediario') return sac.hinoIntermediario ?? sac.hinoEspecial ?? '';
  return sac[k] ?? '';
}

export function renderSacramentais() {
  const el = document.getElementById('lista-sacramentais');
  const tit = document.getElementById('sac-mes-titulo');
  if (tit) tit.textContent = `${MESES_NOME[sacMes]} ${sacAno}`;

  const domingos = getDomingosMes(sacMes, sacAno);
  if (!domingos.length) { el.innerHTML = '<div style="text-align:center;color:#4a6a8a;padding:40px">Nenhum domingo neste mês</div>'; return; }

  const hoje = formatDateKey(new Date());

  el.innerHTML = domingos.map(dom => {
    const dk = formatDateKey(dom);
    const sac = getSacPorData(dk) || {};
    const isHoje = dk === hoje;
    const isPast = dk < hoje;

    const borderColor = isHoje ? '#e8d080' : isPast ? 'rgba(74,106,138,.3)' : 'rgba(232,208,128,.2)';
    const opacity = isPast ? 'opacity:.7' : '';

    const g = k => campoAta(sac, k);
    const preenchido = ATA_ORDEM.some(c => c.k && g(c.k)) || sac.orador1 || sac.orador2 || sac.orador3;

    const statusDot = preenchido
      ? '<span style="width:6px;height:6px;border-radius:50%;background:#34d399;display:inline-block;margin-right:6px" title="Programado"></span>'
      : '<span style="width:6px;height:6px;border-radius:50%;background:#e05555;display:inline-block;margin-right:6px" title="Não programado"></span>';

    const freq = (sac.frequencia || sac.visitantes)
      ? `<span style="color:#8eacc8;font-size:11px">👥 ${esc(sac.frequencia||'—')}${sac.visitantes ? ` · ${esc(sac.visitantes)} visit.` : ''}</span>`
      : '';

    const linha = (rot, val, cor) => val
      ? `<div><span style="color:${cor};font-size:10px">${rot}</span><div style="color:#c8d8e8">${esc(val)}</div></div>` : '';

    const orador = (n, cor) => sac['orador'+n]
      ? `<div><span style="color:${cor};font-size:10px">${n}º Orador</span><div style="color:#c8d8e8">${esc(sac['orador'+n])}${sac['tema'+n] ? ` <span style="color:#4a6a8a">· ${esc(sac['tema'+n])}</span>` : ''}</div></div>` : '';

    return `
    <div class="card" style="border-color:${borderColor};${opacity};margin-bottom:12px;cursor:pointer" data-act="abrir" data-dk="${dk}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div style="display:flex;align-items:center">
          ${statusDot}
          <span style="color:#e8d080;font-weight:700;font-size:14px">${formatDateSac(dom)}</span>
          ${isHoje ? '<span style="background:#e8d080;color:#0d1b2a;font-size:9px;padding:1px 6px;border-radius:8px;margin-left:8px;font-weight:700">HOJE</span>' : ''}
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          ${freq}
          ${preenchido ? `<button class="btn-secondary" style="font-size:11px;padding:3px 9px" data-act="pdf" data-dk="${dk}">📄 PDF</button>` : ''}
        </div>
      </div>

      ${preenchido ? `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 16px;font-size:12px">
        ${linha('Presidida por', g('presidida'), '#c9a84c')}
        ${linha('Dirigida por',  g('dirigida'),  '#c9a84c')}
        ${linha('Hino inicial',  g('primeiroHino'), '#5b9bd5')}
        ${linha('Hino Sacramental', g('hinoSacramental'), '#5b9bd5')}
        ${orador(1, '#34d399')}
        ${orador(2, '#a78bfa')}
        ${linha('Hino intermediário', g('hinoIntermediario'), '#f472b6')}
        ${orador(3, '#e8b040')}
        ${linha('Hino de encerramento', g('hinoFinal'), '#5b9bd5')}
      </div>
      ${sac.observacoes ? `<div style="margin-top:6px;font-size:11px;color:#8eacc8;border-top:1px solid rgba(74,106,138,.2);padding-top:6px">📝 ${esc(sac.observacoes)}</div>` : ''}
      ` : `
      <div style="text-align:center;color:#4a6a8a;font-size:12px;padding:8px 0">Toque para montar a ata deste domingo</div>
      `}
    </div>`;
  }).join('');
}

export function abrirModalSac(dataKey) {
  const sac = getSacPorData(dataKey) || {};
  const d = new Date(dataKey + 'T12:00:00');
  const titulo = formatDateSac(d) + ' de ' + d.getFullYear();

  // sugestões: banco de oradores + quadro de membros
  const banco = getBancoOradores();
  const nomes = [...new Set([
    ...(banco.quorum||[]), ...(banco.socsoc||[]), ...(banco.jovens||[]), ...(banco.outros||[]),
    ...MEMBROS.map(m => m.name),
  ])].filter(Boolean);
  const datalist = `<datalist id="dl-nomes">${nomes.map(n=>`<option value="${esc(n)}">`).join('')}</datalist>`;

  const campo = (c) => {
    const v = esc(campoAta(sac, c.k));
    const ph = c.ph || (c.hino ? 'Nº e título do hino' : '');
    const lista = (!c.area && !c.hino) ? ' list="dl-nomes"' : '';
    return c.area
      ? `<div style="margin-bottom:10px">
           <label style="color:#8eacc8;font-size:10px">${c.r}</label>
           <textarea class="form-input" id="ata-${c.k}" rows="2" placeholder="${ph}"
             style="font-size:12px;padding:6px 10px;resize:vertical">${v}</textarea>
         </div>`
      : `<div style="margin-bottom:10px">
           <label style="color:#8eacc8;font-size:10px">${c.r}</label>
           <input type="text" class="form-input" id="ata-${c.k}" value="${v}" placeholder="${ph}"${lista}
             style="font-size:12px;padding:6px 10px">
         </div>`;
  };

  const blocoOrador = (n) => {
    const cor = { 1:'#34d399', 2:'#a78bfa', 3:'#e8b040' }[n];
    return `
    <div style="background:rgba(255,255,255,.03);border-left:3px solid ${cor};border-radius:8px;padding:10px;margin-bottom:10px">
      <div style="color:${cor};font-size:11px;font-weight:700;margin-bottom:8px">🎤 ${n}º ORADOR</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div>
          <label style="color:#8eacc8;font-size:10px">Nome</label>
          <input type="text" class="form-input" id="sac-orador${n}" value="${esc(sac['orador'+n])}" placeholder="Nome" list="dl-nomes" style="font-size:12px;padding:6px 10px">
        </div>
        <div>
          <label style="color:#8eacc8;font-size:10px">Tema</label>
          <input type="text" class="form-input" id="sac-tema${n}" value="${esc(sac['tema'+n])}" placeholder="Tema do discurso" style="font-size:12px;padding:6px 10px">
        </div>
      </div>
    </div>`;
  };

  document.getElementById('modal-sacramental-content').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <h3 style="color:#e8d080;font-size:16px">🕊️ ${titulo}</h3>
      <span data-act="fechar" style="cursor:pointer;color:#4a6a8a;font-size:20px">✕</span>
    </div>

    ${datalist}

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;background:rgba(232,208,128,.08);border:1px solid rgba(232,208,128,.2);border-radius:10px;padding:10px;margin-bottom:14px">
      <div>
        <label style="color:#8eacc8;font-size:10px">Frequência geral</label>
        <input type="number" min="0" class="form-input" id="ata-frequencia" value="${esc(sac.frequencia)}" placeholder="0" style="font-size:12px;padding:6px 10px">
      </div>
      <div>
        <label style="color:#8eacc8;font-size:10px">Visitantes</label>
        <input type="number" min="0" class="form-input" id="ata-visitantes" value="${esc(sac.visitantes)}" placeholder="0" style="font-size:12px;padding:6px 10px">
      </div>
    </div>

    ${ATA_ORDEM.map(c => c.orador ? blocoOrador(c.orador) : campo(c)).join('')}

    <div style="margin-bottom:10px">
      <label style="color:#8eacc8;font-size:10px">Observações</label>
      <textarea class="form-input" id="sac-obs" rows="2" placeholder="Ex.: reunião de jejum, conferência de estaca…" style="font-size:12px;padding:6px 10px;resize:vertical">${esc(sac.observacoes)}</textarea>
    </div>

    <div style="display:flex;gap:8px;margin-top:16px">
      <button data-act="salvar" data-dk="${dataKey}" style="flex:1;background:#e8d080;color:#0d1b2a;border:none;border-radius:10px;padding:11px;font-weight:700;cursor:pointer;font-size:13px">Salvar</button>
      ${sac.id ? `<button data-act="pdf" data-dk="${dataKey}" style="background:rgba(232,208,128,.15);color:#e8d080;border:1px solid rgba(232,208,128,.35);border-radius:10px;padding:11px 16px;cursor:pointer;font-size:13px">📄 PDF</button>` : ''}
      ${sac.id ? `<button data-act="excluir" data-id="${sac.id}" style="background:rgba(224,85,85,.15);color:#e05555;border:1px solid rgba(224,85,85,.3);border-radius:10px;padding:11px 16px;cursor:pointer;font-size:13px">Excluir</button>` : ''}
      <button data-act="fechar" style="background:rgba(74,106,138,.25);color:#8eacc8;border:none;border-radius:10px;padding:11px 16px;cursor:pointer;font-size:13px">Cancelar</button>
    </div>`;
  abrirModal('modal-sacramental');
}

export async function salvarSac(dataKey) {
  const v = id => (document.getElementById(id)?.value || '').trim();

  const obj = { data: dataKey, frequencia: v('ata-frequencia'), visitantes: v('ata-visitantes') };
  ATA_ORDEM.forEach(c => { if (c.k) obj[c.k] = v('ata-' + c.k); });
  [1,2,3].forEach(n => { obj['orador'+n] = v('sac-orador'+n); obj['tema'+n] = v('sac-tema'+n); });
  obj.observacoes = v('sac-obs');
  obj.hinoEspecial = obj.hinoIntermediario; // compatibilidade com registros antigos

  if (!DADOS.sacramentais) DADOS.sacramentais = [];
  const existente = DADOS.sacramentais.find(s => s.data === dataKey);

  try {
    if (existente) {
      const atualizado = await apiFetch(API_SAC + '?id=' + existente.id, 'PUT', obj);
      const i = DADOS.sacramentais.findIndex(s => s.id === existente.id);
      if (i !== -1) DADOS.sacramentais[i] = { ...existente, ...atualizado };
    } else {
      DADOS.sacramentais.push(await apiFetch(API_SAC, 'POST', obj));
    }
  } catch {
    // offline: mantém no aparelho
    if (existente) Object.assign(existente, obj);
    else { obj.id = Date.now().toString(); DADOS.sacramentais.push(obj); }
  }

  fecharModal('modal-sacramental');
  renderSacramentais();
}

export async function excluirSac(id) {
  if (!await confirmar('Excluir esta programação?', { perigo: true, okLabel: 'Excluir' })) return;
  try { await apiFetch(API_SAC + '?id=' + id, 'DELETE'); } catch {}
  if (DADOS.sacramentais) DADOS.sacramentais = DADOS.sacramentais.filter(s => s.id !== id);
  fecharModal('modal-sacramental');
  renderSacramentais();
}

function ligarSacramental() {
  document.getElementById('sac-nav')?.addEventListener('click', e => {
    const btn = e.target.closest('button[data-mes]');
    if (btn) mudarMesSac(Number(btn.dataset.mes));
  });

  document.getElementById('sac-add-orador')?.addEventListener('click', adicionarOrador);

  // o banco é recriado a cada renderBancoOradores — daí a delegação no container
  document.getElementById('banco-oradores')?.addEventListener('click', e => {
    const x = e.target.closest('[data-act="remover"]');
    if (x) removerOrador(x.dataset.grupo, Number(x.dataset.idx));
  });

  document.getElementById('lista-sacramentais')?.addEventListener('click', e => {
    // o PDF fica dentro do card: tratar antes para não abrir o modal junto
    const pdf = e.target.closest('button[data-act="pdf"]');
    if (pdf) { imprimirAtaSacramental(pdf.dataset.dk); return; }
    const card = e.target.closest('[data-act="abrir"]');
    if (card) abrirModalSac(card.dataset.dk);
  });

  document.getElementById('modal-sacramental')?.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    switch (el.dataset.act) {
      case 'fechar':  fecharModal('modal-sacramental'); break;
      case 'salvar':  salvarSac(el.dataset.dk); break;
      case 'pdf':     imprimirAtaSacramental(el.dataset.dk); break;
      case 'excluir': excluirSac(el.dataset.id); break;
    }
  });
}
ligarSacramental();
