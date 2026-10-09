// =============================================
// AGENDA DE ENTREVISTAS
// =============================================
import { renderAcompanhamentos } from './acompanhamento.js';
import { apiFetch, atualizarUltimaSinc, avisarPendente, idProvisorioDo, setSyncStatus } from './api.js';
import { comNome } from './chamados.js';
import { reativarAbaAtual } from './app.js';
import { ALA, API_AGENDA, CARGOS_INFO, COR_STATUS, DADOS, corDoCargo, nomeDoResponsavel } from './config.js';
import { primeiroNome, tipoNoConvite } from './convite-regras.js';
import { MEMBROS } from './dados-membros.js';
import { confirmar, pedirTexto } from './dialogo.js';
import { norm } from './membros-import.js';
import { abrirModal, fecharModal } from './ui.js';
import { podeVer, toast } from './usuario.js';
import { esc, formatarData, ico } from './utils.js';

// Começa em "Em aberto" (pendentes e agendadas), o botão marcado como active no
// index.html. Em "Todas", as realizadas se acumulavam para sempre na frente.
export let filAgenda = 'abertas';

export const TIPOS_ENTREVISTA = [
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

// Um registro sem status (vindo torto do servidor) não pode derrubar a lista
// inteira — antes, `e.status.charAt(0)` estourava e nada renderizava.
function rotuloStatus(status) {
  if (!status) return '—';
  if (status === 'nao-realizada') return 'Não Realizada';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

// Contas do resumo da agenda. A aba Agenda e o Início usam esta mesma função
// para nunca mostrarem números diferentes. Sigilosos ficam fora da conta de
// quem não é o bispo.
export function resumoAgenda() {
  const todas = (DADOS.agenda || []).filter(podeVer);
  const ativas = todas.filter(e => e.status === 'pendente' || e.status === 'agendada');
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const limite = new Date(hoje); limite.setDate(limite.getDate() + 7);
  const proximas = ativas.filter(e => {
    if (!e.data) return false;
    const d = new Date(e.data + 'T12:00:00');
    return d >= hoje && d < limite;
  });
  // "Sem confirmação" é quem ainda não confirmou presença — inclui quem pediu
  // outra data. Antes o teste era `!e.confirmacao`, e um pedido de remarcação
  // (confirmacao='reagendar') zerava o contador justamente no caso que precisa
  // de ação do bispado.
  const aguardando = ativas.filter(e => e.data && e.confirmacao !== 'confirmado');
  return { todas, ativas, proximas, aguardando };
}

export function renderAgenda() {
  const el = document.getElementById('lista-agenda');
  if (!el) return;
  const busca = (document.getElementById('busca-membro')?.value || '').toLowerCase();

  // Painel de resumo
  const stats = document.getElementById('agenda-stats');
  if (stats) {
    const { ativas, proximas, aguardando } = resumoAgenda();
    stats.innerHTML = `
      <div class="membros-stat"><div class="stat-num" style="--c:#34d399">${ativas.length}</div><div class="stat-label">Em aberto</div></div>
      <div class="membros-stat"><div class="stat-num" style="--c:#60a5fa">${proximas.length}</div><div class="stat-label">Próximos 7 dias</div></div>
      <div class="membros-stat"><div class="stat-num" style="--c:${aguardando.length ? '#e8b040' : '#34d399'}">${aguardando.length}</div><div class="stat-label">Sem confirmação</div></div>`;
  }
  let lista = DADOS.agenda.filter(podeVer).filter(e => {
    const matchBusca = !busca || e.membro.toLowerCase().includes(busca);
    let matchFil;
    if (filAgenda === 'todas') matchFil = true;
    else if (filAgenda === 'abertas') matchFil = e.status === 'pendente' || e.status === 'agendada';
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

  const prioEmoji = { alta:'🔴', media:'🟡', normal:'🟢' };

  const maisAbertos = new Set([...el.querySelectorAll('details.mais-acoes[open]')].map(d => d.dataset.id));
  el.innerHTML = lista.map(e => `
    <div class="entrevista-card" style="border-color:${COR_STATUS[e.status] || 'var(--border)'}">
      <div class="ent-header">
        <span class="ent-prioridade">${prioEmoji[e.prioridade]||'🟢'}</span>
        <span class="ent-nome">${esc(e.membro)}</span>
        ${e.sigiloso?'<span class="selo-sigilo">🔒 Sigiloso</span>':''}
        ${e.acompanhar?'<span style="font-size:10px;--c:#fbbf24">🧭</span>':''}
        ${precisaReenviarConvite(e)?'<span class="selo-reenviar" title="A data mudou depois do último convite">📨 Reenviar convite</span>':''}
        ${aguardandoNovaData(e)?'<span class="selo-reenviar" title="O membro pediu outra data: use Reagendar para fechar a nova">⏳ Defina a nova data</span>':''}
        <span class="status-badge status-${e.status || ''}">${rotuloStatus(e.status)}</span>
      </div>
      <div class="ent-info">
        <span>📋 ${esc(e.tipo)}</span>
        <span style="--c:${corDoCargo(e.responsavel)}">👤 ${esc(comNome(nomeDoResponsavel(e.responsavel)))}</span>
        ${e.data?`<span>📅 ${formatarData(e.data)}${e.hora?` às ${e.hora}`:''}</span>`:''}
        ${e.reagendamentos?.length?`<span>🔄 Reagendado ${e.reagendamentos.length}x</span>`:''}
        ${selosConfirmacao(e)}
      </div>
      ${e.obs?`<div class="ent-obs">${esc(e.obs)}</div>`:''}
      ${e.obs_conclusao?`<div class="ent-obs" style="border-left:3px solid #34d399;padding-left:8px;margin-top:4px;--c:#34d399">✔ ${esc(e.obs_conclusao)}</div>`:''}
      ${acoesDoCard(e)}
    </div>
  `).join('');
  for (const d of el.querySelectorAll('details.mais-acoes')) if (maisAbertos.has(d.dataset.id)) d.open = true;
}

// O membro pediu outra data e o bispado ainda não fechou nenhuma. Enquanto isso,
// `data`/`hora` continuam sendo as que ele recusou — convidar de novo mandaria
// exatamente a data recusada. O próximo passo aqui é Reagendar, não Convidar.
export function aguardandoNovaData(e) {
  if (e.confirmacao !== 'reagendar' || !e.confirmadoEm) return false;
  if (e.status === 'realizada' || e.status === 'nao-realizada') return false;
  const hist = e.reagendamentos || [];
  const ultimo = hist[hist.length - 1]?.reagendadoEm;
  return !ultimo || ultimo < e.confirmadoEm;
}

// Entrevista reagendada cujo convite mais recente é ANTERIOR ao reagendamento:
// o membro ainda não foi avisado da data nova e está esperando um aviso que não
// saiu. Comparação de ISO por string funciona (mesmo fuso, mesmo formato).
export function precisaReenviarConvite(e) {
  const hist = e.reagendamentos || [];
  const ultimoReagendamento = hist[hist.length - 1]?.reagendadoEm;
  if (!ultimoReagendamento) return false;                       // nunca foi reagendada
  if (e.status === 'realizada' || e.status === 'nao-realizada') return false;
  return !e.convidadoEm || e.convidadoEm < ultimoReagendamento;
}


// =============================================
// DIÁLOGO DE CONVITE
// WhatsApp, e-mail ou link copiado. O telefone e o e-mail são editáveis: o
// quadro do LCR nem sempre tem, e o número pode ter mudado. O que for digitado
// fica salvo na entrevista, e qualquer um dos três caminhos registra o convite.
// =============================================
export function abrirModalConvite(id) {
  const e = DADOS.agenda.find(x => x.id === id);
  if (!e) return;
  const tel = e.telefone || telefoneDoMembro(e.membro);
  const email = e.email || emailDoMembro(e.membro);
  const quando = e.data
    ? formatarData(e.data) + (e.hora ? ` às ${e.hora}` : '')
    : 'data a combinar';

  document.getElementById('modal-agenda-content').innerHTML = `
    <h3>📨 Enviar convite <button class="modal-close" data-act="fechar">✕</button></h3>
    <div style="background:rgba(255,255,255,.04);border-radius:10px;padding:10px 12px;margin-bottom:14px">
      <div style="color:var(--text-corpo);font-size:13px;font-weight:700">${esc(e.membro)}</div>
      <div style="color:var(--text2);font-size:12px;margin-top:2px">📋 ${esc(e.tipo)} · 📅 ${esc(quando)}</div>
      <div style="color:var(--text2);font-size:12px;margin-top:6px">✉️ O membro lê: <strong>${esc(tipoNoConvite(e) || 'uma conversa com o bispado')}</strong>${tipoNoConvite(e) ? '' : ' — o tipo não aparece no convite'}</div>
    </div>
    <div class="form-group">
      <label>WhatsApp</label>
      <input type="tel" class="form-input" id="conv-tel" value="${esc(tel)}" placeholder="(21) 90000-0000">
    </div>
    <div class="form-group">
      <label>E-mail</label>
      <input type="email" class="form-input" id="conv-email" value="${esc(email)}" placeholder="nome@exemplo.com">
    </div>
    <div style="display:flex;flex-direction:column;gap:8px;margin-top:16px">
      <a id="conv-ir-whats" data-act="conv-enviar" data-via="whatsapp" data-id="${esc(e.id)}" target="_blank" rel="noopener"
         style="text-align:center;text-decoration:none;background:rgba(37,211,102,.15);--c:#25d366;border:1px solid #25d366;border-radius:12px;padding:12px;font-size:14px;font-weight:600;cursor:pointer">💬 Enviar pelo WhatsApp</a>
      <a id="conv-ir-email" data-act="conv-enviar" data-via="email" data-id="${esc(e.id)}"
         style="text-align:center;text-decoration:none;background:rgba(91,155,213,.15);--c:#5b9bd5;border:1px solid #5b9bd5;border-radius:12px;padding:12px;font-size:14px;font-weight:600;cursor:pointer">✉️ Enviar por e-mail</a>
      <button data-act="conv-copiar" data-id="${esc(e.id)}"
         style="background:rgba(201,168,76,.12);color:var(--gold);border:1px solid rgba(201,168,76,.45);border-radius:12px;padding:12px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit">🔗 Copiar link do convite</button>
    </div>
    <div class="form-group" style="margin-top:14px">
      <label>Link do convite</label>
      <input type="text" class="form-input" id="conv-link" readonly value="${esc(linkConfirmacao(e.id))}"
             style="font-size:12px">
    </div>
    <p style="color:var(--text3);font-size:11px;margin-top:12px;line-height:1.5">
      O telefone e o e-mail digitados ficam salvos nesta entrevista. Qualquer uma
      das três opções marca o convite como enviado.
    </p>`;

  atualizarLinksConvite(e);
  abrirModal('modal-agenda');
}

// Mantém os href em dia enquanto o bispado digita: assim o clique é uma navegação
// normal do navegador. Abrir por script depois de um await seria bloqueado.
function atualizarLinksConvite(e) {
  const tel = digitosTelefone(document.getElementById('conv-tel')?.value || '');
  const email = (document.getElementById('conv-email')?.value || '').trim();
  const msg = mensagemConvite(e);

  const aW = document.getElementById('conv-ir-whats');
  const aE = document.getElementById('conv-ir-email');
  const desligar = (a, motivo) => {
    if (!a) return;
    a.removeAttribute('href');
    a.style.opacity = '.45';
    a.style.cursor = 'not-allowed';
    a.title = motivo;
  };
  const ligar = (a, href) => {
    if (!a) return;
    a.href = href;
    a.style.opacity = '';
    a.style.cursor = 'pointer';
    a.title = '';
  };

  if (tel) ligar(aW, `https://wa.me/${tel}?text=${encodeURIComponent(msg)}`);
  else desligar(aW, 'Informe um número de WhatsApp');

  if (/.+@.+\..+/.test(email)) {
    ligar(aE, `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(assuntoConvite(e))}&body=${encodeURIComponent(msg)}`);
  } else {
    desligar(aE, 'Informe um e-mail válido');
  }
}

// Copiar o link é o caminho de quem vai mandar por outro canal. A API moderna
// de clipboard REJEITA quando o documento não está em foco, então o resultado
// tem de ser esperado — senão o app diz "copiado" sem ter copiado. O
// execCommand vem primeiro por ser síncrono e não pedir permissão.
async function copiarLinkConvite(id) {
  const campo = document.getElementById('conv-link');
  let copiou = false;
  try { campo?.select(); copiou = document.execCommand('copy'); } catch (err) {}
  if (!copiou) {
    try { await navigator.clipboard.writeText(campo?.value || ''); copiou = true; } catch (err) {}
  }
  registrarEnvioConvite(id, copiou ? 'copiar' : 'copiar-manual');
}

// Guarda o contato digitado junto com o registro do convite: da próxima vez o
// número certo já vem preenchido.
export async function registrarEnvioConvite(id, via) {
  const e = DADOS.agenda.find(x => x.id === id);
  if (!e) return;
  // Pelo link direto do card não há diálogo aberto: gravar os campos como ''
  // apagaria o telefone que estava salvo.
  const campos = { convidadoEm: new Date().toISOString() };
  const campoTel = document.getElementById('conv-tel');
  const campoEmail = document.getElementById('conv-email');
  if (campoTel) campos.telefone = campoTel.value.trim();
  if (campoEmail) campos.email = campoEmail.value.trim();

  Object.assign(e, campos);   // otimista: o selo some na hora
  // se a cópia falhou, o diálogo continua aberto com o link à mostra
  if (via !== 'copiar-manual') fecharModal('modal-agenda');
  renderAgenda();
  try {
    const atualizado = await apiFetch(`${API_AGENDA}?id=${id}`, 'PUT', campos);
    DADOS.agenda = DADOS.agenda.map(x => x.id === id ? atualizado : x);
    atualizarUltimaSinc(); setSyncStatus('ok');
  } catch (err) {
    avisarPendente('confirmação do convite');
  }
  renderAgenda();
  if (via === 'copiar') toast('Link copiado — convite marcado como enviado');
  if (via === 'copiar-manual') toast('Copie o link do campo acima — convite marcado como enviado');
}

// Liga/desliga acompanhar ou sigiloso direto no card, depois de criada a entrevista
export async function toggleFlagEntrevista(id, campo) {
  const e = DADOS.agenda.find(x => x.id === id);
  if (!e) return;
  const novo = !e[campo];
  e[campo] = novo; // otimista
  renderAgenda();
  if (typeof renderAcompanhamentos === 'function') renderAcompanhamentos();
  let salvou = true;
  try {
    const atualizado = await apiFetch(`${API_AGENDA}?id=${id}`, 'PUT', { [campo]: novo });
    DADOS.agenda = DADOS.agenda.map(x => x.id === id ? atualizado : x);
    atualizarUltimaSinc(); setSyncStatus('ok');
  } catch (e2) { salvou = false; avisarPendente('alteração'); }
  renderAgenda();
  if (typeof renderAcompanhamentos === 'function') renderAcompanhamentos();
  // na falha fica o aviso de pendência: a mensagem de sucesso o cobriria
  if (!salvou) return;
  const msg = {
    acompanhar: novo ? '🧭 Marcada para acompanhamento' : 'Acompanhamento removido',
    sigiloso:   novo ? '🔒 Marcada como sigilosa' : 'Sigilo removido',
  };
  toast(msg[campo]);
}

// =============================================
// CONVITE POR WHATSAPP + CONFIRMAÇÃO DO MEMBRO
// =============================================
export function telefoneDoMembro(nome) {
  if (!nome) return '';
  const m = MEMBROS.find(x => norm(x.name) === norm(nome));
  return m ? (m.telefone || '') : '';
}

// O quadro embutido não tem e-mail; ele só aparece depois de importar o PDF do
// LCR. Sem e-mail, o campo do diálogo entra vazio para ser preenchido à mão.
export function emailDoMembro(nome) {
  if (!nome) return '';
  const m = MEMBROS.find(x => norm(x.name) === norm(nome));
  return m ? (m.email || '') : '';
}

// wa.me exige só dígitos com código do país
export function digitosTelefone(t) {
  let d = (t || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.length <= 11) d = '55' + d;
  return d;
}

export function linkConfirmacao(id) {
  // página própria e leve (convite.html). Os links antigos, ?confirmar=<id>,
  // continuam valendo: js/redirecionar-convite.js manda para cá.
  return location.origin + '/convite.html?id=' + encodeURIComponent(id);
}

// Texto do convite — o mesmo no WhatsApp, no e-mail e no link copiado.
// O assunto só aparece nos tipos de rotina (ver tipoNoConvite): a mensagem
// aparece na prévia da tela bloqueada, muitas vezes no celular da família.
export function mensagemConvite(e) {
  const quando = e.data
    ? formatarData(e.data) + (e.hora ? `, às ${e.hora}` : '')
    : 'em data a combinar';
  const tipo = tipoNoConvite(e);
  return `Olá, ${primeiroNome(e.membro)}! Aqui é o bispado da ${ALA}.\n\n` +
    (tipo
      ? `Gostaríamos de marcar uma entrevista com você — ${tipo} — para ${quando}.\n\n`
      : `Gostaríamos de marcar uma conversa com você para ${quando}.\n\n`) +
    `Por favor, responda por este link:\n${linkConfirmacao(e.id)}\n\n` +
    `Obrigado!`;
}

export const assuntoConvite = e => {
  const tipo = tipoNoConvite(e);
  return tipo ? `Entrevista com o bispado — ${tipo}` : 'Convite do bispado';
};

// Com telefone, o convite continua a um toque: link direto do WhatsApp.
// "Outro meio" abre o diálogo (e-mail, copiar link, outro número) — e é o
// único caminho de quem não tem telefone cadastrado, que antes ficava sem botão.
export function botaoConvite(e) {
  const tel = digitosTelefone(e.telefone || telefoneDoMembro(e.membro));
  const rotulo = precisaReenviarConvite(e) ? `${ico('send')} Reenviar convite` : `${ico('message-circle')} Convidar`;
  if (!tel) {
    return `<button class="btn-secondary" data-act="convite" data-id="${e.id}"
              style="--c:#25d366;border-color:#25d366">${rotulo}</button>`;
  }
  const url = `https://wa.me/${tel}?text=${encodeURIComponent(mensagemConvite(e))}`;
  return `<a class="btn-secondary" href="${url}" target="_blank" rel="noopener"
            data-act="convidar" data-id="${e.id}"
            style="text-decoration:none;--c:#25d366;border-color:#25d366">${rotulo}</a>`;
}

// Ações do card. Antes eram 7 botões do mesmo peso (3 linhas no celular), e o
// próximo passo se perdia entre eles. Agora: na frente, só o que se faz em
// seguida — convidar (ou definir a nova data, se o membro pediu outra), marcar
// como realizada, reagendar — e o resto num "⋯ Mais" (<details>, sem JS).
function acoesDoCard(e) {
  const aberta = e.status === 'pendente' || e.status === 'agendada';
  const id = esc(e.id);
  const pediuOutra = aberta && aguardandoNovaData(e);
  const temTelefone = !!digitosTelefone(e.telefone || telefoneDoMembro(e.membro));
  const frente = !aberta ? '' : pediuOutra
    ? `<button class="btn-secondary btn-destaque" data-act="reagendar" data-id="${id}">${ico('refresh-cw')} Definir a nova data</button>
       <button class="btn-secondary" data-act="realizada" data-id="${id}">${ico('check')} Realizada</button>`
    : `${botaoConvite(e)}
       <button class="btn-secondary" data-act="realizada" data-id="${id}">${ico('check')} Realizada</button>
       <button class="btn-secondary" data-act="reagendar" data-id="${id}">${ico('refresh-cw')} Reagendar</button>`;
  const item = (act, rotulo, extra = '') => `<button class="btn-secondary" data-act="${act}" data-id="${id}" ${extra}>${rotulo}</button>`;
  const mais = [
    item('editar', `${ico('pencil')} Editar`, 'title="Corrigir membro, tipo, responsável, data ou contato"'),
    aberta && temTelefone && !pediuOutra ? item('convite', `${ico('mail')} Outro meio de convite`, 'title="E-mail, copiar o link ou outro número"') : '',
    aberta ? item('naorealizada', `${ico('x')} Não realizada`) : '',
    item('toggle', `${ico('compass')} ${e.acompanhar ? 'Parar de acompanhar' : 'Acompanhar'}`, 'data-campo="acompanhar"'),
    item('toggle', e.sigiloso ? `${ico('lock-open')} Tirar o sigilo` : `${ico('lock')} Marcar como sigilosa`, 'data-campo="sigiloso"'),
    `<button class="btn-danger" data-act="excluir" data-id="${id}">${ico('trash-2')} Excluir</button>`,
  ].filter(Boolean).join('');
  return `<div class="ent-actions">${frente}
      <details class="mais-acoes" data-id="${id}">
        <summary class="btn-secondary">${ico('ellipsis')} Mais</summary>
        <div class="mais-acoes-lista">${mais}</div>
      </details>
    </div>`;
}

// A cor de cada resposta vem do css (.selo-conf-*), que tem variante para o
// tema claro — inline, o verde e o âmbar ficavam ilegíveis sobre o creme.
const SELO_CONF = { confirmado: '✅ Confirmou', recusado: '❌ Não poderá', reagendar: '🔄 Pediu outra data' };

export function selosConfirmacao(e) {
  // hasOwnProperty: um valor como 'constructor' vindo da API não vira selo
  if (!Object.prototype.hasOwnProperty.call(SELO_CONF, e.confirmacao)) return '';
  const qdo = e.confirmadoEm ? new Date(e.confirmadoEm).toLocaleDateString('pt-BR') : '';
  // Quando o membro sugeriu data/hora, mostra o que ele pediu — é o que o
  // bispado precisa ver para reagendar (o botão Reagendar já abre com isso).
  const pedido = e.confirmacao === 'reagendar' && e.sugestaoData
    ? ` para ${formatarData(e.sugestaoData)}${e.sugestaoHora ? ` às ${e.sugestaoHora}` : ''}`
    : '';
  return `<span class="selo-conf-${e.confirmacao}" title="${esc(qdo)}">${SELO_CONF[e.confirmacao]}${esc(pedido)}</span>`;
}

export function setFilAgenda(val, btn) {
  filAgenda = val;
  document.querySelectorAll('#filtros-agenda .filtro-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderAgenda();
}

export function abrirModalAgenda(id) {
  const e = id ? DADOS.agenda.find(x=>x.id===id) : null;
  const membrosOptions = MEMBROS.map(m=>`<option value="${esc(m.name)}" ${e?.membro===m.name?'selected':''}>${esc(m.name)}</option>`).join('');
  const tiposOptions = TIPOS_ENTREVISTA.map(t=>`<option value="${esc(t)}" ${e?.tipo===t?'selected':''}>${esc(t)}</option>`).join('');

  document.getElementById('modal-agenda-content').innerHTML = `
    <h3>${e?'✏️ Editar':'➕ Nova'} Entrevista <button class="modal-close" data-act="fechar">✕</button></h3>
    <div class="form-group">
      <label>Membro</label>
      <input list="lista-membros-dl" class="form-input" id="ag-membro" placeholder="Digite o nome…" value="${esc(e?.membro||'')}">
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
          ${CARGOS_INFO.filter(c => c.entrevista).map(c => `<option value="${c.cod}" ${e?.responsavel === c.cod ? 'selected' : ''}>${c.nome}</option>`).join('')}
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
               value="${esc(e?.telefone || telefoneDoMembro(e?.membro || ''))}"
               data-auto="${esc(e?.telefone || telefoneDoMembro(e?.membro || ''))}">
      </div>
    </div>
    <div class="form-group">
      <label>Observações (máx. 100 caracteres)</label>
      <input type="text" class="form-input" id="ag-obs" maxlength="100" placeholder="Observações livres…" value="${esc(e?.obs||'')}">
    </div>
    <div class="form-group" style="background:rgba(255,255,255,.03);border-radius:10px;padding:10px 12px">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;color:var(--text-corpo);margin-bottom:8px">
        <input type="checkbox" id="ag-acompanhar" ${e?.acompanhar?'checked':''} style="width:16px;height:16px;accent-color:#fbbf24">
        🧭 Vai precisar de acompanhamento
      </label>
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;color:var(--text-corpo)">
        <input type="checkbox" id="ag-sigiloso" ${e?.sigiloso?'checked':''} style="width:16px;height:16px;accent-color:#e05555">
        🔒 Assunto sigiloso — somente o bispo visualiza
      </label>
    </div>
    <button class="btn-primary" data-act="salvar" data-id="${id||''}">💾 Salvar</button>
  `;
  abrirModal('modal-agenda');
}

export async function salvarEntrevista(id) {
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
  const atual = id ? DADOS.agenda.find(x => x.id === id) : null;
  if (atual) Object.assign(payload, efeitosDaEdicao(atual, payload));
  fecharModal('modal-agenda');
  reativarAbaAtual();
  try {
    if (id) {
      // idem: só o que o formulário mudou. O `...atual` vinha do DADOS local, que
      // pode estar até 30s atrasado, e reescrevia por cima da resposta do membro.
      const atualizado = await apiFetch(`${API_AGENDA}?id=${id}`, 'PUT', payload);
      DADOS.agenda = DADOS.agenda.map(x => x.id === id ? atualizado : x);
    } else {
      const criado = await apiFetch(API_AGENDA, 'POST', { ...payload, status: 'pendente', reagendamentos: [] });
      DADOS.agenda.push(criado);
    }
    atualizarUltimaSinc(); setSyncStatus('ok');
    toast(id ? 'Entrevista atualizada' : 'Entrevista criada');
  } catch(e) {
    if (id) DADOS.agenda = DADOS.agenda.map(x => x.id === id ? { ...x, ...payload } : x);
    else DADOS.agenda.push({ ...payload, id: idProvisorioDo(e), status: 'pendente', reagendamentos: [] });
    avisarPendente('entrevista');
  }
  renderAgenda();
}

// O que o Editar invalida numa entrevista em aberto. Corrigir uma encerrada não
// mexe no resultado; corrigir antes de convidar só grava o que mudou.
//  - Outro membro: o convite e a resposta eram de outra pessoa — nada vale.
//  - Data ou horário mudaram depois de convite ou resposta: é um reagendamento
//    (o mesmo do botão Reagendar); sem isto o card seguia "✅ Confirmou" para
//    uma data que o membro nem conhece. Sem nova data, volta a "sem data".
function efeitosDaEdicao(atual, payload) {
  if (atual.status !== 'pendente' && atual.status !== 'agendada') return {};
  const respostaZerada = { confirmacao: '', confirmadoEm: '', sugestaoData: '', sugestaoHora: '' };
  if (payload.membro !== atual.membro) {
    return { ...respostaZerada, convidadoEm: '', email: '', status: 'pendente' };
  }
  const mudouQuando = payload.data !== (atual.data || '') || payload.hora !== (atual.hora || '');
  const haviaConvite = !!(atual.convidadoEm || atual.confirmacao);
  if (!mudouQuando || !haviaConvite) return {};
  if (!payload.data) return { ...respostaZerada, status: 'pendente' };
  // primeira data depois de um convite "a combinar" também invalida a resposta
  return camposDeReagendamento({ ...atual, data: atual.data || '', hora: atual.hora || '' }, payload.data, payload.hora);
}

// O que muda numa entrevista quando a data muda — pelo Reagendar ou pelo Editar.
// O pedido do membro foi atendido e a data mudou: a resposta anterior não vale
// mais para o novo horário, então volta a "sem confirmação" — o membro recebe o
// convite de novo e confirma a data nova.
function camposDeReagendamento(atual, data, hora) {
  const hist = [...(atual.reagendamentos || []), {
    dataAnterior: atual.data, horaAnterior: atual.hora, reagendadoEm: new Date().toISOString(),
  }];
  return {
    data, hora, status: 'agendada', reagendamentos: hist,
    sugestaoData: '', sugestaoHora: '', confirmacao: '', confirmadoEm: '',
  };
}

export async function marcarRealizada(id) {
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
    avisarPendente('conclusão');
  }
  renderAgenda();
}

export async function naoRealizada(id) {
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
    avisarPendente('alteração');
  }
  renderAgenda();
}

export async function reagendarEntrevista(id) {
  const atual = DADOS.agenda.find(e => e.id === id) || {};
  // Se o membro pediu outra data pelo link do convite, o formulário já abre com
  // a sugestão dele — é só confirmar.
  const r = await pedirTexto('Reagendar entrevista', [
    { id: 'data', label: 'Nova data',    tipo: 'date', valor: atual.sugestaoData || atual.data || '', obrigatorio: true },
    { id: 'hora', label: 'Novo horário', tipo: 'time', valor: atual.sugestaoHora || atual.hora || '' },
  ], { okLabel: 'Reagendar' });
  if (r === null) return;

  const campos = camposDeReagendamento(atual, r.data, r.hora);
  try {
    const atualizado = await apiFetch(`${API_AGENDA}?id=${id}`, 'PUT', campos);
    DADOS.agenda = DADOS.agenda.map(e => e.id===id ? atualizado : e);
    atualizarUltimaSinc(); setSyncStatus('ok');
  } catch(e) {
    DADOS.agenda = DADOS.agenda.map(e => e.id===id ? {...e, ...campos} : e);
    avisarPendente('remarcação');
  }
  renderAgenda();
}

export async function excluirEntrevista(id) {
  if (!await confirmar('Excluir esta entrevista?', { perigo: true, okLabel: 'Excluir' })) return;
  try {
    await apiFetch(`${API_AGENDA}?id=${id}`, 'DELETE');
    atualizarUltimaSinc(); setSyncStatus('ok');
  } catch(e) { avisarPendente(); }
  DADOS.agenda = DADOS.agenda.filter(e => e.id !== id);
  renderAgenda();
}

// Fase 3 da migração ESM: liga os handlers da aba Agenda por delegação,
// no lugar dos onclick/oninput inline (busca, filtros, cards e modal).
function ligarAgenda() {
  document.getElementById('busca-membro')?.addEventListener('input', renderAgenda);

  document.getElementById('filtros-agenda')?.addEventListener('click', e => {
    const btn = e.target.closest('.filtro-btn');
    if (btn?.dataset.fil) setFilAgenda(btn.dataset.fil, btn);
  });

  // tocar fora fecha o "⋯ Mais" que estiver aberto
  document.addEventListener('click', e => {
    for (const d of document.querySelectorAll('#lista-agenda details.mais-acoes[open]')) if (!d.contains(e.target)) d.removeAttribute('open');
  });

  // `[data-act]` e não `button[data-act]`: o "Convidar" é um link para o WhatsApp
  document.getElementById('lista-agenda')?.addEventListener('click', e => {
    const alvo = e.target.closest('[data-act]');
    if (!alvo) return;
    // Escolheu uma ação do "⋯ Mais": o menu fecha, e o foco vai para o "⋯ Mais"
    // ANTES da ação — é para ele que o modal da ação devolve o foco ao fechar
    // (o botão da ação some dentro do menu fechado).
    const menu = alvo.closest('details.mais-acoes');
    if (menu) { menu.removeAttribute('open'); menu.querySelector('summary')?.focus({ preventScroll: true }); }
    const id = alvo.dataset.id;
    switch (alvo.dataset.act) {
      case 'editar':        abrirModalAgenda(id); break;
      case 'realizada':     marcarRealizada(id); break;
      case 'reagendar':     reagendarEntrevista(id); break;
      case 'naorealizada':  naoRealizada(id); break;
      case 'excluir':       excluirEntrevista(id); break;
      case 'toggle':        toggleFlagEntrevista(id, alvo.dataset.campo); break;
      case 'convite':       abrirModalConvite(id); break;
      // link direto do WhatsApp: sem preventDefault, so registra o envio
      case 'convidar':      registrarEnvioConvite(id, 'whatsapp'); break;
    }
  });

  // `[data-act]` e nao `button[...]`: os envios do convite sao <a> (WhatsApp e
  // mailto precisam ser navegacao de verdade, senao o navegador bloqueia).
  document.getElementById('modal-agenda')?.addEventListener('click', ev => {
    const alvo = ev.target.closest('[data-act]');
    if (!alvo) return;
    const { act, id } = alvo.dataset;
    if (act === 'fechar') fecharModal('modal-agenda');
    else if (act === 'salvar') salvarEntrevista(id);
    else if (act === 'conv-enviar') {
      if (!alvo.getAttribute('href')) return;      // desligado: falta contato
      registrarEnvioConvite(id, alvo.dataset.via); // sem preventDefault
    } else if (act === 'conv-copiar') {
      copiarLinkConvite(id);
    }
  });

  // tocar no campo do link ja seleciona tudo, para copiar na mao
  document.getElementById('modal-agenda')?.addEventListener('focusin', ev => {
    if (ev.target.id === 'conv-link') ev.target.select();
  });

  // Trocar o membro no formulário traz o WhatsApp do novo membro — mas só se o
  // campo ainda tiver o número que veio preenchido (digitado à mão, fica).
  document.getElementById('modal-agenda')?.addEventListener('change', ev => {
    if (ev.target.id !== 'ag-membro') return;
    const tel = document.getElementById('ag-telefone');
    if (!tel || tel.value.trim() !== (tel.dataset.auto || '')) return;
    tel.value = tel.dataset.auto = telefoneDoMembro(ev.target.value.trim());
  });

  // enquanto digita o contato, os links do dialogo acompanham
  document.getElementById('modal-agenda')?.addEventListener('input', ev => {
    if (ev.target.id !== 'conv-tel' && ev.target.id !== 'conv-email') return;
    const id = document.getElementById('conv-ir-whats')?.dataset.id;
    const entrevista = DADOS.agenda.find(x => String(x.id) === String(id));
    if (entrevista) atualizarLinksConvite(entrevista);
  });
}
ligarAgenda();
