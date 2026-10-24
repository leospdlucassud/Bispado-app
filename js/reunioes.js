// =============================================
// REUNIÕES
// =============================================
// Tipos de reunião administrados pelo bispado — fonte única para filtros e formulário
import { apiFetch, atualizarUltimaSinc, avisarPendente, idProvisorioDo, setSyncStatus } from './api.js';
import { nomeDoCargo } from './chamados.js';
import { API_REUNIOES, CARGOS, DADOS } from './config.js';
import { confirmar } from './dialogo.js';
import { imprimirAtaPDF } from './pdf.js';
import {
  ataResolvida, montarPresenca, paragrafos, presencaParaFormulario, presentes, rotuloPresenca, textoDeBusca,
} from './reunioes-regras.js';
import { abrirModal, fecharModal } from './ui.js';
import { toast } from './usuario.js';
import { dataLocal, esc, formatarData } from './utils.js';

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
    const mes = dataLocal().slice(0,7);
    const noMes = todas.filter(r => (r.data||'').startsWith(mes)).length;
    const pendentes = todas.reduce((n,r) => n + (r.itens||[]).filter(i => !i.feito).length, 0);
    stats.innerHTML = `
      <div class="membros-stat"><div class="stat-num" style="--c:#a78bfa">${todas.length}</div><div class="stat-label">Registradas</div></div>
      <div class="membros-stat"><div class="stat-num" style="--c:#34d399">${noMes}</div><div class="stat-label">Neste mês</div></div>
      <div class="membros-stat"><div class="stat-num" style="--c:${pendentes ? '#e8b040' : '#34d399'}">${pendentes}</div><div class="stat-label">Itens em aberto</div></div>`;
  }

  // A tela mostra o que ainda pede algo: a ata que já passou com todos os
  // itens resolvidos vira histórico (ataResolvida). Ela continua na busca — da
  // aba e a geral — e no filtro "Histórico"; nada é apagado.
  const hoje = dataLocal();
  const historico = todas.filter(r => ataResolvida(r, hoje));
  const ativas = todas.filter(r => !ataResolvida(r, hoje));
  // o filtro de um tipo que sumiu da tela (ou do histórico já vazio) volta para "Todas"
  if (filReuniao === 'historico' ? !historico.length : (filReuniao && !ativas.some(r => r.tipo === filReuniao))) filReuniao = '';
  const noHistorico = filReuniao === 'historico';

  // Filtros por tipo, com contagem das que estão na tela — só os tipos que existem
  const filtros = document.getElementById('filtros-reuniao');
  if (filtros) {
    const usados = TIPOS_REUNIAO.filter(t => ativas.some(r => r.tipo === t.k));
    filtros.innerHTML = [
      `<button class="filtro-btn ${filReuniao===''?'active':''}" data-fil="">Todas (${ativas.length})</button>`,
      ...usados.map(t => {
        const n = ativas.filter(r => r.tipo === t.k).length;
        return `<button class="filtro-btn ${filReuniao===t.k?'active':''}" style="${filReuniao===t.k?'':`border-color:${t.c};--c:${t.c}`}" data-fil="${t.k}">${t.r} (${n})</button>`;
      }),
      historico.length ? `<button class="filtro-btn ${noHistorico?'active':''}" data-fil="historico" title="Atas de reuniões que já passaram, com todos os itens resolvidos">📚 Histórico (${historico.length})</button>` : '',
    ].join('');
  }

  // com algo digitado na busca, procura em todas (histórico incluído)
  const base = busca ? todas : (noHistorico ? historico : ativas);
  let lista = base
    .filter(r => !filReuniao || noHistorico || r.tipo === filReuniao)
    .filter(r => !busca || textoDeBusca(r, tipoReuniao(r.tipo).r).includes(busca))
    .sort((a,b) => (b.data||'').localeCompare(a.data||''));

  if (!lista.length) {
    el.innerHTML = !todas.length
      ? `<div class="vazia">📭 Nenhuma reunião registrada<br><span style="font-size:12px;opacity:.7">Toque no + para registrar a primeira</span></div>`
      : !busca && !filReuniao && historico.length
        ? `<div class="vazia">✅ Tudo resolvido — nenhuma ata com item em aberto<br><span style="font-size:12px;opacity:.7">As ${historico.length} atas resolvidas estão no 📚 Histórico e na busca</span></div>`
        : `<div class="vazia">🔍 Nenhuma reunião com esse filtro</div>`;
    return;
  }

  el.innerHTML = lista.map(r => cardReuniao(r, { arquivada: busca && ataResolvida(r, hoje) })).join('');
}

const textoDe = v => (typeof v === 'string' ? v.trim() : '');
// rótulo e valor na mesma linha (participantes, orações): curtos, quebram juntos
const linhaCard = (rotulo, html) => `<div class="reuniao-linha"><span class="reuniao-rotulo">${rotulo}</span> ${html}</div>`;
const secaoCard = (rotulo, html) => `<div class="reuniao-secao"><div class="reuniao-rotulo">${rotulo}</div>${html}</div>`;

// Todos os chamados, na ordem gravada (a de CARGOS): quem faltou também consta,
// apagado e com "ausente" escrito — a cor sozinha o leitor de tela não lê.
// Ninguém marcado, ou ata antiga sem o campo: a seção não aparece (presentes()).
function presencaCard(presenca) {
  if (!presentes(presenca).length) return '';
  return secaoCard('Presença do bispado', `<ul class="reuniao-presenca">${presenca.filter(p => p && p.cargo).map(p => p.presente === true
    ? `<li class="pres-sim"><span aria-hidden="true">✓</span> ${esc(rotuloPresenca(p))}<span class="so-leitor">, presente</span></li>`
    : `<li class="pres-nao">${esc(rotuloPresenca(p))} <span class="pres-ausente">ausente</span></li>`).join('')}</ul>`);
}

// Card na MESMA ordem do formulário e do PDF: presença, participantes, oração
// inicial, pauta, itens de ação, oração de encerramento. Ata antiga, sem os
// campos novos, mostra só o que tem — nada a migrar.
// `arquivada`: achada pela busca entre as do histórico — o selo diz por que ela
// não aparece na tela normal
function cardReuniao(r, { arquivada = false } = {}) {
  const t = tipoReuniao(r.tipo);
  const id = esc(r.id);
  const itens = Array.isArray(r.itens) ? r.itens : [];
  const abertos = itens.filter(i => !i.feito).length;
  const partes = (Array.isArray(r.participantes) ? r.participantes : []).filter(Boolean);
  const oracaoIni = textoDe(r.oracaoInicial);
  const oracaoEnc = textoDe(r.oracaoEncerramento);
  // um <p> por assunto (linha em branco entre eles); dentro do assunto, a
  // quebra simples vira <br>. Cada linha passa pelo esc() antes de juntar.
  const pauta = paragrafos(r.pauta).map(p => `<p>${p.split('\n').map(esc).join('<br>')}</p>`).join('');
  return `
    <div class="reuniao-card" style="border-left:3px solid ${t.c}">
      <div class="reuniao-header">
        <div class="reuniao-titulo">
          <span class="reuniao-data">📅 ${esc(formatarData(r.data))}</span>
          <span class="reuniao-tipo" style="--c:${t.c}">${esc(t.r)}</span>
          ${abertos ? `<span class="reuniao-abertos" style="--c:#e8b040">• ${abertos} em aberto</span>` : ''}
          ${arquivada ? '<span class="reuniao-abertos" style="--c:var(--text3)">📚 histórico</span>' : ''}
        </div>
        <div class="reuniao-acoes">
          <button type="button" class="btn-secondary" data-act="pdf" data-id="${id}" aria-label="Baixar a ata em PDF">📄 PDF</button>
          <button type="button" class="btn-secondary" data-act="editar" data-id="${id}" aria-label="Editar reunião" title="Editar">✏️</button>
          <button type="button" class="btn-danger" data-act="excluir" data-id="${id}" aria-label="Excluir reunião" title="Excluir">🗑</button>
        </div>
      </div>
      ${presencaCard(r.presenca)}
      ${partes.length ? linhaCard('Participantes', esc(partes.join(', '))) : ''}
      ${oracaoIni ? linhaCard('Oração inicial', esc(oracaoIni)) : ''}
      ${pauta ? secaoCard('Pauta / Anotações', `<div class="reuniao-pauta">${pauta}</div>`) : ''}
      ${itens.length ? secaoCard('Itens de ação', `<div class="reuniao-itens">${itens.map((it, i) => `
          <div class="reuniao-item${it.feito ? ' feito' : ''}">
            <button type="button" class="item-check${it.feito ? ' checked' : ''}" role="checkbox" aria-checked="${it.feito ? 'true' : 'false'}" aria-label="${esc(it.texto)}" data-act="item" data-id="${id}" data-idx="${i}"></button>
            <span>${esc(it.texto)}</span>
          </div>`).join('')}
        </div>`) : ''}
      ${oracaoEnc ? linhaCard('Oração de encerramento', esc(oracaoEnc)) : ''}
    </div>`;
}

export async function toggleItem(reuniaoId, itemIdx) {
  const reuniao = DADOS.reunioes.find(r => r.id === reuniaoId);
  if (!reuniao) return;
  // O redesenho recria o card: sem isto o foco de quem marca pelo teclado ou
  // pelo leitor de tela caía no <body> (e a troca do aria-checked não era lida),
  // como já se cuida no rodizio.js. Só volta se o foco estava num item.
  const comFoco = !!document.activeElement?.matches?.('#lista-reunioes .item-check');
  const itens = [...(reuniao.itens||[])];
  itens[itemIdx] = { ...itens[itemIdx], feito: !itens[itemIdx].feito };
  try {
    const atualizado = await apiFetch(`${API_REUNIOES}?id=${reuniaoId}`, 'PUT', { itens });
    DADOS.reunioes = DADOS.reunioes.map(r => r.id===reuniaoId ? atualizado : r);
    atualizarUltimaSinc(); setSyncStatus('ok');
  } catch(e) {
    DADOS.reunioes = DADOS.reunioes.map(r => r.id===reuniaoId ? { ...r, itens } : r);
    avisarPendente('marcação do item');
  }
  renderReunioes();
  // durante a espera do servidor a pessoa pode ter ido para outro lugar: só
  // devolve o foco se ele caiu no <body> com o redesenho, para não roubá-lo
  const solto = !document.activeElement || document.activeElement === document.body;
  if (comFoco && solto) {
    document.querySelector(`#lista-reunioes .item-check[data-id="${CSS.escape(String(reuniaoId))}"][data-idx="${itemIdx}"]`)?.focus();
  }
}

export function abrirModalReuniao(id) {
  const r = id ? DADOS.reunioes.find(x=>x.id===id) : null;
  const itensVal = r?.itens?.map(i=>i.texto).join('\n') || '';
  const partsVal = r?.participantes?.join(', ') || '';
  // Um quadradinho por chamado, "Chamado Nome", com os nomes de "Editar os
  // nomes dos chamados" (janela "Quem está usando?"). Ao editar ata de reunião
  // que já passou, vale o nome que ela gravou: mostra quem ocupava o chamado
  // naquele dia. Até o dia da reunião, o nome atual (presencaParaFormulario).
  const presenca = presencaParaFormulario(CARGOS, nomeDoCargo, r?.presenca, { data: r?.data, hoje: dataLocal() });
  // Mesmo formulário para Nova e Editar, na ordem do card e do PDF
  document.getElementById('modal-reuniao-content').innerHTML = `
    <h3>${r?'✏️ Editar':'➕ Nova'} Reunião <button class="modal-close" data-act="fechar" aria-label="Fechar">✕</button></h3>
    <div class="form-row">
      <div class="form-group">
        <label for="re-data">Data</label>
        <input type="date" class="form-input" id="re-data" value="${esc(r?.data||dataLocal())}">
      </div>
      <div class="form-group">
        <label for="re-tipo">Tipo</label>
        <select class="form-select" id="re-tipo">
          ${TIPOS_REUNIAO.map(t=>`<option value="${t.k}" ${r?.tipo===t.k?'selected':''}>${t.r}</option>`).join('')}
        </select>
      </div>
    </div>
    <fieldset class="re-presenca">
      <legend>Presença do bispado</legend>
      <div class="re-presenca-lista">
        ${presenca.map(p => `
          <label class="re-presenca-op">
            <input type="checkbox" data-cargo="${esc(p.cargo)}" ${p.presente ? 'checked' : ''}>
            <span>${esc(rotuloPresenca(p))}</span>
          </label>`).join('')}
      </div>
    </fieldset>
    <div class="form-group">
      <label for="re-partic">Participantes (separados por vírgula)</label>
      <input type="text" class="form-input" id="re-partic" value="${esc(partsVal)}" placeholder="Outros participantes: presidentes das organizações, missionários…">
    </div>
    <div class="form-group">
      <label for="re-oracao-ini">Oração inicial</label>
      <input type="text" class="form-input" id="re-oracao-ini" value="${esc(r?.oracaoInicial||'')}" placeholder="Quem fez a oração inicial" autocomplete="off">
    </div>
    <div class="form-group">
      <label for="re-pauta">Pauta / Anotações</label>
      <textarea class="form-textarea" id="re-pauta" placeholder="Registre os assuntos discutidos…&#10;&#10;Uma linha em branco separa um assunto do outro.">${esc(r?.pauta||'')}</textarea>
    </div>
    <div class="form-group">
      <label for="re-itens">Itens de ação (um por linha)</label>
      <textarea class="form-textarea" id="re-itens" placeholder="Verificar relatório trimestral&#10;Marcar entrevistas de jovens…">${esc(itensVal)}</textarea>
    </div>
    <div class="form-group">
      <label for="re-oracao-enc">Oração de encerramento</label>
      <input type="text" class="form-input" id="re-oracao-enc" value="${esc(r?.oracaoEncerramento||'')}" placeholder="Quem fez a oração de encerramento" autocomplete="off">
    </div>
    <button class="btn-primary" data-act="salvar" data-id="${esc(id||'')}">💾 Salvar</button>
  `;
  abrirModal('modal-reuniao');
}

export async function salvarReuniao(id) {
  const data = document.getElementById('re-data').value;
  if (!data) return toast('Informe a data');
  const anterior = id ? DADOS.reunioes.find(x=>x.id===id) : null;
  const itensTexto = document.getElementById('re-itens').value.split('\n').map(s=>s.trim()).filter(Boolean);
  const itensAntigos = anterior?.itens || [];
  const marcados = [...document.querySelectorAll('#modal-reuniao-content input[data-cargo]:checked')].map(c => c.dataset.cargo);
  const payload = {
    data,
    tipo: document.getElementById('re-tipo').value,
    // todos os chamados, marcados ou não, com o nome gravado como fotografia
    // (montarPresenca): trocar quem ocupa o chamado depois da reunião não
    // reescreve a ata; antes dela, a ata acompanha o nome atual
    presenca: montarPresenca(CARGOS, nomeDoCargo, anterior?.presenca, marcados, { data, hoje: dataLocal() }),
    participantes: document.getElementById('re-partic').value.split(',').map(s=>s.trim()).filter(Boolean),
    oracaoInicial: document.getElementById('re-oracao-ini').value.trim(),
    pauta: document.getElementById('re-pauta').value,
    itens: itensTexto.map((texto,i) => ({ texto, feito: itensAntigos[i]?.feito||false })),
    oracaoEncerramento: document.getElementById('re-oracao-enc').value.trim(),
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
    toast('Reunião salva');
  } catch(e) {
    if (id) DADOS.reunioes = DADOS.reunioes.map(x => x.id===id ? { ...x, ...payload } : x);
    else DADOS.reunioes.push({ ...payload, id: idProvisorioDo(e) });
    avisarPendente('reunião');
  }
  renderReunioes();
}

export async function excluirReuniao(id) {
  if (!await confirmar('Excluir esta reunião?', { perigo: true, okLabel: 'Excluir' })) return;
  try { await apiFetch(`${API_REUNIOES}?id=${id}`, 'DELETE'); atualizarUltimaSinc(); setSyncStatus('ok'); } catch(e) { avisarPendente('exclusão'); }
  DADOS.reunioes = DADOS.reunioes.filter(r => r.id !== id);
  renderReunioes();
}

export function editarReuniao(id) { abrirModalReuniao(id); }

// Fase 5 da migração ESM: liga a aba Reuniões por delegação,
// no lugar dos onclick/oninput inline (busca, filtros, cards e modal).
function ligarReunioes() {
  document.getElementById('busca-reuniao')?.addEventListener('input', renderReunioes);

  // filtros são recriados a cada render — daí a delegação no container
  document.getElementById('filtros-reuniao')?.addEventListener('click', e => {
    const btn = e.target.closest('.filtro-btn');
    if (btn) setFilReuniao(btn.dataset.fil ?? '');
  });

  document.getElementById('lista-reunioes')?.addEventListener('click', e => {
    const alvo = e.target.closest('[data-act]');
    if (!alvo) return;
    const { act, id, idx } = alvo.dataset;
    switch (act) {
      case 'pdf':     imprimirAtaPDF(id); break;
      case 'editar':  editarReuniao(id); break;
      case 'excluir': excluirReuniao(id); break;
      case 'item':    toggleItem(id, Number(idx)); break;
    }
  });

  document.getElementById('modal-reuniao')?.addEventListener('click', e => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    if (btn.dataset.act === 'fechar') fecharModal('modal-reuniao');
    else if (btn.dataset.act === 'salvar') salvarReuniao(btn.dataset.id);
  });
}
ligarReunioes();
