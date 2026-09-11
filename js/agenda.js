// =============================================
// AGENDA DE ENTREVISTAS
// =============================================
import { renderAcompanhamentos } from './acompanhamento.js';
import { apiFetch, atualizarUltimaSinc, avisarPendente, setSyncStatus } from './api.js';
import { comNome } from './chamados.js';
import { reativarAbaAtual } from './app.js';
import { ALA, API_AGENDA, DADOS } from './config.js';
import { MEMBROS } from './dados-membros.js';
import { confirmar, pedirTexto } from './dialogo.js';
import { norm } from './membros-import.js';
import { abrirModal, fecharModal } from './ui.js';
import { podeVer, toast } from './usuario.js';
import { esc, formatarData } from './utils.js';

// 'todas' para bater com o botão marcado como active no index.html — antes
// iniciava em 'ativas' e as realizadas sumiam com "Todas" aceso.
export let filAgenda = 'todas';

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

export function renderAgenda() {
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
    // "Sem confirmação" é quem ainda não confirmou presença — inclui quem pediu
    // outra data. Antes o teste era `!e.confirmacao`, e um pedido de remarcação
    // (confirmacao='reagendar') zerava o contador justamente no caso que precisa
    // de ação do bispado.
    const aguardando = ativas.filter(e => e.data && e.confirmacao !== 'confirmado').length;
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

  // a borda do card acompanha o selo (ver .status-agendada no css)
  const statusCor = { pendente:'#f87171', agendada:'#3b82f6', realizada:'#34d399', 'nao-realizada':'#94a3b8' };
  const prioEmoji = { alta:'🔴', media:'🟡', normal:'🟢' };
  const respCor = { bispo:'#c9a84c', c1:'#5b9bd5', c2:'#6dbf8c', sec:'#e8b040' };
  const respNome = { bispo:'Bispo', c1:'1º Conselheiro', c2:'2º Conselheiro', sec:'Secretário' };

  el.innerHTML = lista.map(e => `
    <div class="entrevista-card" style="border-color:${statusCor[e.status]||'#445566'}">
      <div class="ent-header">
        <span class="ent-prioridade">${prioEmoji[e.prioridade]||'🟢'}</span>
        <span class="ent-nome">${esc(e.membro)}</span>
        ${e.sigiloso?'<span class="selo-sigilo">🔒 Sigiloso</span>':''}
        ${e.acompanhar?'<span style="font-size:10px;color:#fbbf24">🧭</span>':''}
        ${precisaReenviarConvite(e)?'<span class="selo-reenviar" title="A data mudou depois do último convite">📨 Reenviar convite</span>':''}
        ${aguardandoNovaData(e)?'<span class="selo-reenviar" title="O membro pediu outra data: use Reagendar para fechar a nova">⏳ Defina a nova data</span>':''}
        <span class="status-badge status-${e.status || ''}">${rotuloStatus(e.status)}</span>
      </div>
      <div class="ent-info">
        <span>📋 ${esc(e.tipo)}</span>
        <span style="color:${respCor[e.responsavel]||'#8eacc8'}">👤 ${esc(comNome(respNome[e.responsavel]||e.responsavel))}</span>
        ${e.data?`<span>📅 ${formatarData(e.data)}${e.hora?` às ${e.hora}`:''}</span>`:''}
        ${e.reagendamentos?.length?`<span>🔄 Reagendado ${e.reagendamentos.length}x</span>`:''}
        ${selosConfirmacao(e)}
      </div>
      ${e.obs?`<div class="ent-obs">${esc(e.obs)}</div>`:''}
      ${e.obs_conclusao?`<div class="ent-obs" style="border-left:3px solid #34d399;padding-left:8px;margin-top:4px;color:#34d399">✔ ${esc(e.obs_conclusao)}</div>`:''}
      <div class="ent-actions">
        ${e.status==='pendente'||e.status==='agendada'?`
          ${aguardandoNovaData(e) ? '' : botaoConvite(e)}
          <button class="btn-secondary" data-act="realizada" data-id="${e.id}">✓ Realizada</button>
          <button class="btn-secondary" data-act="reagendar" data-id="${e.id}">🔄 Reagendar</button>
          <button class="btn-secondary" data-act="naorealizada" data-id="${e.id}">✗ Não Realizada</button>
        `:''}
        <button class="btn-secondary" title="Precisa de acompanhamento" data-act="toggle" data-id="${e.id}" data-campo="acompanhar" style="${e.acompanhar?'color:#fbbf24;border-color:#fbbf24':''}">🧭 ${e.acompanhar?'Acompanhando':'Acompanhar'}</button>
        <button class="btn-secondary" title="Assunto sigiloso" data-act="toggle" data-id="${e.id}" data-campo="sigiloso" style="${e.sigiloso?'color:#e05555;border-color:#e05555':''}">${e.sigiloso?'🔒 Sigiloso':'🔓 Sigilo'}</button>
        <button class="btn-danger" data-act="excluir" data-id="${e.id}">🗑</button>
      </div>
    </div>
  `).join('');
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
      <div style="color:#c8d8e8;font-size:13px;font-weight:700">${esc(e.membro)}</div>
      <div style="color:#8eacc8;font-size:12px;margin-top:2px">📋 ${esc(e.tipo)} · 📅 ${esc(quando)}</div>
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
         style="text-align:center;text-decoration:none;background:rgba(37,211,102,.15);color:#25d366;border:1px solid #25d366;border-radius:12px;padding:12px;font-size:14px;font-weight:600;cursor:pointer">💬 Enviar pelo WhatsApp</a>
      <a id="conv-ir-email" data-act="conv-enviar" data-via="email" data-id="${esc(e.id)}"
         style="text-align:center;text-decoration:none;background:rgba(91,155,213,.15);color:#5b9bd5;border:1px solid #5b9bd5;border-radius:12px;padding:12px;font-size:14px;font-weight:600;cursor:pointer">✉️ Enviar por e-mail</a>
      <button data-act="conv-copiar" data-id="${esc(e.id)}"
         style="background:rgba(201,168,76,.12);color:var(--gold);border:1px solid rgba(201,168,76,.45);border-radius:12px;padding:12px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit">🔗 Copiar link do convite</button>
    </div>
    <div class="form-group" style="margin-top:14px">
      <label>Link do convite</label>
      <input type="text" class="form-input" id="conv-link" readonly value="${esc(linkConfirmacao(e.id))}"
             style="font-size:12px">
    </div>
    <p style="color:#4a6a8a;font-size:11px;margin-top:12px;line-height:1.5">
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

// "Sobrenome, Nome" → primeiro nome
export function primeiroNome(nome) {
  const dep = (nome || '').split(',')[1];
  return ((dep || nome || '').trim().split(/\s+/)[0]) || nome || '';
}

export function linkConfirmacao(id) {
  return location.origin + location.pathname + '?confirmar=' + encodeURIComponent(id);
}

// Texto do convite — o mesmo no WhatsApp, no e-mail e no link copiado.
export function mensagemConvite(e) {
  const quando = e.data
    ? formatarData(e.data) + (e.hora ? `, às ${e.hora}` : '')
    : 'em data a combinar';
  return `Olá, ${primeiroNome(e.membro)}! Aqui é o bispado da ${ALA}.\n\n` +
    `Gostaríamos de marcar uma entrevista com você — ${e.tipo} — para ${quando}.\n\n` +
    `Por favor, responda por este link:\n${linkConfirmacao(e.id)}\n\n` +
    `Obrigado!`;
}

export const assuntoConvite = e => `Entrevista com o bispado — ${e.tipo}`;

// Com telefone, o convite continua a um toque: link direto do WhatsApp.
// "Outro meio" abre o diálogo (e-mail, copiar link, outro número) — e é o
// único caminho de quem não tem telefone cadastrado, que antes ficava sem botão.
export function botaoConvite(e) {
  const tel = digitosTelefone(e.telefone || telefoneDoMembro(e.membro));
  const rotulo = precisaReenviarConvite(e) ? '📨 Reenviar convite' : '💬 Convidar';
  const outroMeio = `<button class="btn-secondary" data-act="convite" data-id="${e.id}"
      title="Enviar por e-mail, copiar o link ou usar outro número"
      style="font-size:11px;padding:4px 10px">✉️ Outro meio</button>`;

  if (!tel) {
    return `<button class="btn-secondary" data-act="convite" data-id="${e.id}"
              style="color:#25d366;border-color:#25d366">${rotulo}</button>`;
  }
  const url = `https://wa.me/${tel}?text=${encodeURIComponent(mensagemConvite(e))}`;
  return `<a class="btn-secondary" href="${url}" target="_blank" rel="noopener"
            data-act="convidar" data-id="${e.id}"
            style="text-decoration:none;color:#25d366;border-color:#25d366">${rotulo}</a>` + outroMeio;
}

export function selosConfirmacao(e) {
  if (!e.confirmacao) return '';
  const sel = {
    confirmado: ['#34d399', '✅ Confirmou'],
    recusado:   ['#e05555', '❌ Não poderá'],
    reagendar:  ['#e8b040', '🔄 Pediu outra data'],
  }[e.confirmacao];
  if (!sel) return '';
  const qdo = e.confirmadoEm ? new Date(e.confirmadoEm).toLocaleDateString('pt-BR') : '';
  // Quando o membro sugeriu data/hora, mostra o que ele pediu — é o que o
  // bispado precisa ver para reagendar (o botão Reagendar já abre com isso).
  const pedido = e.confirmacao === 'reagendar' && e.sugestaoData
    ? ` para ${formatarData(e.sugestaoData)}${e.sugestaoHora ? ` às ${e.sugestaoHora}` : ''}`
    : '';
  return `<span style="color:${sel[0]}" title="${esc(qdo)}">${sel[1]}${esc(pedido)}</span>`;
}

// --- Tela que o membro vê ao abrir o link do WhatsApp ---
export async function abrirTelaConfirmacao(id) {
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

  // Entrevista já encerrada pelo bispado: o link antigo não pode mais responder,
  // senão um pedido de remarcação ressuscitaria algo que já aconteceu.
  if (e.status === 'realizada' || e.status === 'nao-realizada') {
    return telaEncerrada(caixa, '✅', 'Entrevista encerrada',
      'O bispado já registrou o resultado desta entrevista. Se precisar de outra, fale com o bispado.');
  }

  // Uso único por convite: já respondeu o convite atual, então só vê o que respondeu.
  if (conviteJaRespondido(e)) {
    const { base, quando: respondidoEm, sugerido } = resumoDaResposta(e);
    const detalhe = e.confirmacao === 'reagendar'
      ? (sugerido ? ` sugerindo <strong style="color:#c8d8e8">${esc(sugerido)}</strong>.` : '.') +
        ' O bispado vai enviar um novo convite com a data confirmada.'
      : '.';
    // A saída de emergência existe porque o `convidadoEm` pode estar velho no
    // servidor (o clique em "Convidar" pode nao ter subido, ex.: sem sinal na
    // capela) e o membro apareceria aqui logo depois de receber um convite novo.
    // Trancar sem alternativa deixaria a pessoa sem saída nenhuma dentro do app.
    return telaEncerrada(caixa, '✉️', 'Você já respondeu',
      `${base}${respondidoEm ? ` em ${esc(respondidoEm)}` : ''}${detalhe}` +
      ' Precisa mudar alguma coisa? Fale com o bispado — eles reenviam o convite.',
      '#e8d080',
      { rotulo: 'Recebi um convite novo e quero responder', acao: () => telaConvite(caixa, e) });
  }

  return telaConvite(caixa, e);
}

// O formulário de resposta. Fica separado porque a tela "você já respondeu"
// precisa poder reabri-lo (ver a saída de emergência em telaJaRespondeu).
function telaConvite(caixa, e) {
  const quando = e.data
    ? formatarData(e.data) + (e.hora ? `, às ${e.hora}` : '')
    : 'data a combinar';

  // Só duas opções: quem não pode vir deve pedir outra data, não apenas recusar.
  // ('recusado' segue reconhecido em selosConfirmacao, por causa dos registros antigos.)
  const opcoes = [
    ['confirmado', '✅ Confirmo minha presença', '#34d399'],
    ['reagendar',  '🔄 Preciso de outra data',   '#e8b040'],
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
        <button data-resp="${v}"
          style="background:transparent;border:1px solid ${c};color:${c};border-radius:12px;padding:12px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit">${r}</button>`).join('')}
    </div>
    <!-- aparece só ao pedir outra data: o membro sugere quando pode -->
    <div id="conf-sugestao" style="display:none;text-align:left;margin-top:14px;background:rgba(232,176,64,.08);border:1px solid rgba(232,176,64,.3);border-radius:12px;padding:14px">
      <p style="color:#e8b040;font-size:13px;font-weight:600;margin-bottom:10px">Quando ficaria bom para você?</p>
      <label style="color:#8eacc8;font-size:11px;display:block;margin-bottom:3px">Data</label>
      <input type="date" id="conf-data" value="${esc(e.data || '')}"
        style="width:100%;background:#0d1b2a;border:1px solid #2a4060;color:#c8d8e8;border-radius:10px;padding:10px;font-size:14px;font-family:inherit;margin-bottom:10px">
      <label style="color:#8eacc8;font-size:11px;display:block;margin-bottom:3px">Horário</label>
      <input type="time" id="conf-hora" value="${esc(e.hora || '')}"
        style="width:100%;background:#0d1b2a;border:1px solid #2a4060;color:#c8d8e8;border-radius:10px;padding:10px;font-size:14px;font-family:inherit;margin-bottom:12px">
      <button id="conf-enviar-sugestao"
        style="width:100%;background:#e8b040;color:#0d1b2a;border:none;border-radius:12px;padding:12px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit">Enviar pedido</button>
    </div>
    ${e.confirmacao ? `<p style="color:#4a6a8a;font-size:11px;margin-top:14px">O bispado enviou um convite novo. Sua resposta anterior não vale mais para esta data.</p>` : ''}`;

  const sugestao = caixa.querySelector('#conf-sugestao');
  caixa.querySelectorAll('button[data-resp]').forEach(btn =>
    btn.addEventListener('click', () => {
      // "Preciso de outra data" abre o formulário em vez de responder na hora
      if (btn.dataset.resp === 'reagendar') { sugestao.style.display = 'block'; sugestao.scrollIntoView({ behavior:'smooth', block:'center' }); return; }
      responderConvite(e.id, btn.dataset.resp);
    }));

  caixa.querySelector('#conf-enviar-sugestao').addEventListener('click', () => {
    const data = caixa.querySelector('#conf-data').value;
    const hora = caixa.querySelector('#conf-hora').value;
    if (!data) { caixa.querySelector('#conf-data').focus(); return; }
    responderConvite(e.id, 'reagendar', { data, hora });
  });
}


// `sugestao` ({data, hora}) só vem quando o membro pede outra data.
// Fica em campos próprios: é um pedido, não muda a entrevista por conta própria —
// quem reagenda é o bispado (o formulário de lá já abre com esta sugestão).
export async function responderConvite(id, resposta, sugestao = null) {
  const caixa = document.querySelector('#conf-wrap > div');
  caixa.innerHTML = '<div class="loading">Enviando…</div>';
  let ok = true;
  try {
    const lista = await (await fetch(API_AGENDA)).json();
    const atual = (Array.isArray(lista) ? lista : []).find(x => String(x.id) === String(id)) || {};
    // Só os campos que mudaram: a function faz merge do que chega. Mandar o
    // registro inteiro (`...atual`) devolvia valores lidos no GET e podia desfazer
    // o que o bispado tivesse alterado no intervalo — inclusive um reagendamento.
    const campos = { confirmacao: resposta, confirmadoEm: new Date().toISOString() };
    // A resposta do membro move o status do card. Só mexe em entrevista ainda
    // aberta: um link antigo não pode ressuscitar uma já realizada.
    const aberta = atual.status === 'pendente' || atual.status === 'agendada';
    if (aberta && resposta === 'confirmado') campos.status = 'agendada';
    // Pedir outra data desmarca: o horário combinado deixou de valer, e quem
    // fecha a nova data é o bispado. Sem isso o card seguia "Agendada".
    if (aberta && resposta === 'reagendar') campos.status = 'pendente';
    if (sugestao) { campos.sugestaoData = sugestao.data; campos.sugestaoHora = sugestao.hora; }
    const r = await fetch(`${API_AGENDA}?id=${encodeURIComponent(id)}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(campos),
    });
    ok = r.ok;
  } catch { ok = false; }

  const quandoPedido = sugestao?.data
    ? formatarData(sugestao.data) + (sugestao.hora ? ` às ${sugestao.hora}` : '')
    : '';
  // O horário que o membro sugere é um pedido, não um agendamento: quem fecha a
  // agenda é o bispado, que reenvia o convite. A mensagem precisa deixar isso
  // claro, senão a pessoa sai achando que já está marcado.
  const txt = {
    confirmado: ['✅', 'Presença confirmada', 'Obrigado! O bispado já foi avisado.'],
    reagendar:  ['🔄', 'Pedido registrado',
                 (quandoPedido
                   ? `Anotamos sua sugestão de <strong style="color:#c8d8e8">${esc(quandoPedido)}</strong>. `
                   : '') +
                 'O bispado vai conferir a disponibilidade e enviar um novo convite com a data e o horário confirmados.'],
  }[resposta] || ['✅', 'Resposta registrada', 'Obrigado! O bispado foi informado.'];

  // na falha o membro precisa da tela aberta para tentar de novo — sem timer
  if (!ok) {
    caixa.innerHTML = `
      <div style="font-size:36px;margin-bottom:10px">⚠️</div>
      <h2 style="color:#e05555;font-size:16px;margin-bottom:8px">Não deu para enviar</h2>
      <p style="color:#8eacc8;font-size:13px;line-height:1.6">Verifique sua conexão e tente de novo, ou responda direto ao bispado pelo WhatsApp.</p>`;
    return;
  }
  telaEncerrada(caixa, txt[0], txt[1], txt[2]);
}

// Fecha a aba do convite: aos 20s ou no botão.
// `window.close()` só encerra janelas abertas por script — abrindo o link pelo
// WhatsApp o navegador quase sempre recusa. Por isso a tentativa é verificada:
// se a aba continuar de pé, o aviso vira "pode fechar", em vez de deixar uma
// contagem que não cumpre o que promete.
export function agendarFechamento(caixa, segundos = 20) {
  const aviso = caixa.querySelector('#conf-contagem');
  const botao = caixa.querySelector('#conf-fechar');
  let restam = segundos;

  const tentarFechar = () => {
    clearInterval(cronometro);
    if (aviso) aviso.textContent = 'Fechando…';
    window.close();
    // se em 400ms ainda estamos aqui, o navegador bloqueou o fechamento
    setTimeout(() => {
      if (botao) botao.style.display = 'none';
      if (aviso) aviso.textContent = 'Sua resposta foi registrada. Pode fechar esta aba.';
    }, 400);
  };

  const cronometro = setInterval(() => {
    restam--;
    if (restam <= 0) return tentarFechar();
    if (aviso) aviso.innerHTML = `Esta janela fecha sozinha em <strong>${restam}</strong>s`;
  }, 1000);

  botao?.addEventListener('click', tentarFechar);
  return () => clearInterval(cronometro);   // quem reabre a tela cancela a contagem
}

// Moldura unica das telas que encerram o convite (resposta enviada, convite ja
// respondido, entrevista concluida). Todas fecham sozinhas em 20s.
function telaEncerrada(caixa, icone, titulo, mensagemHtml, cor = '#e8d080', extra = null) {
  caixa.innerHTML = `
    <div style="font-size:40px;margin-bottom:10px">${icone}</div>
    <h2 style="color:${cor};font-size:17px;margin-bottom:8px">${titulo}</h2>
    <p style="color:#8eacc8;font-size:13px;line-height:1.6">${mensagemHtml}</p>
    <div style="margin-top:20px;border-top:1px solid rgba(255,255,255,.08);padding-top:16px">
      <button id="conf-fechar"
        style="background:rgba(232,208,128,.15);color:#e8d080;border:1px solid rgba(232,208,128,.35);border-radius:12px;padding:11px 22px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit">Fechar agora</button>
      <p id="conf-contagem" style="color:#4a6a8a;font-size:11px;margin-top:10px">Esta janela fecha sozinha em <strong>20</strong>s</p>
      ${extra ? `<button id="conf-extra" style="display:block;margin:12px auto 0;background:none;border:none;color:#5b7a99;font-size:12px;text-decoration:underline;cursor:pointer;font-family:inherit">${extra.rotulo}</button>` : ''}
    </div>`;
  const cancelar = agendarFechamento(caixa);
  if (extra) caixa.querySelector('#conf-extra')?.addEventListener('click', () => { cancelar(); extra.acao(); });
}

// O link do convite e sempre o mesmo (?confirmar=<id>), entao ele nao pode ser
// "de uso unico" para sempre — precisa voltar a valer quando o bispado convida
// de novo. A resposta vale para o convite ATUAL: ja respondeu se ha resposta
// posterior ao ultimo envio. Reagendar limpa a resposta, o que tambem libera.
// Sem `convidadoEm` (registro antigo), qualquer resposta ja conta como dada.
export function conviteJaRespondido(e) {
  if (!e.confirmadoEm) return false;
  return !e.convidadoEm || e.confirmadoEm > e.convidadoEm;
}

// Texto do que a pessoa respondeu, para ela reconhecer a propria resposta.
function resumoDaResposta(e) {
  const quando = e.confirmadoEm ? new Date(e.confirmadoEm).toLocaleDateString('pt-BR') : '';
  const sugerido = e.sugestaoData
    ? formatarData(e.sugestaoData) + (e.sugestaoHora ? ` às ${e.sugestaoHora}` : '')
    : '';
  const base = {
    confirmado: 'Você confirmou presença',
    reagendar:  'Você pediu outra data',
    recusado:   'Você respondeu que não poderia ir',
  }[e.confirmacao] || 'Sua resposta foi registrada';
  return { base, quando, sugerido };
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
               value="${esc(e?.telefone || telefoneDoMembro(e?.membro || ''))}">
      </div>
    </div>
    <div class="form-group">
      <label>Observações (máx. 100 caracteres)</label>
      <input type="text" class="form-input" id="ag-obs" maxlength="100" placeholder="Observações livres…" value="${esc(e?.obs||'')}">
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
  } catch(e) {
    if (id) DADOS.agenda = DADOS.agenda.map(x => x.id === id ? { ...x, ...payload } : x);
    else DADOS.agenda.push({ ...payload, id: 'local_' + Date.now(), status: 'pendente', reagendamentos: [] });
  }
  renderAgenda();
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

  const hist = [...(atual.reagendamentos || []), {
    dataAnterior: atual.data, horaAnterior: atual.hora, reagendadoEm: new Date().toISOString(),
  }];
  // O pedido do membro foi atendido e a data mudou: a resposta anterior não vale
  // mais para o novo horário, então volta a "sem confirmação" — o membro recebe
  // o convite de novo e confirma a data nova.
  const campos = {
    data: r.data, hora: r.hora, status: 'agendada', reagendamentos: hist,
    sugestaoData: '', sugestaoHora: '', confirmacao: '', confirmadoEm: '',
  };
  try {
    const atualizado = await apiFetch(`${API_AGENDA}?id=${id}`, 'PUT', campos);
    DADOS.agenda = DADOS.agenda.map(e => e.id===id ? atualizado : e);
    atualizarUltimaSinc(); setSyncStatus('ok');
  } catch(e) {
    DADOS.agenda = DADOS.agenda.map(e => e.id===id ? {...e, ...campos} : e);
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

  // `[data-act]` e não `button[data-act]`: o "Convidar" é um link para o WhatsApp
  document.getElementById('lista-agenda')?.addEventListener('click', e => {
    const alvo = e.target.closest('[data-act]');
    if (!alvo) return;
    const id = alvo.dataset.id;
    switch (alvo.dataset.act) {
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

  // enquanto digita o contato, os links do dialogo acompanham
  document.getElementById('modal-agenda')?.addEventListener('input', ev => {
    if (ev.target.id !== 'conv-tel' && ev.target.id !== 'conv-email') return;
    const id = document.getElementById('conv-ir-whats')?.dataset.id;
    const entrevista = DADOS.agenda.find(x => String(x.id) === String(id));
    if (entrevista) atualizarLinksConvite(entrevista);
  });
}
ligarAgenda();
