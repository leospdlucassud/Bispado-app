// =============================================
// UI — navegação entre abas e modais
// =============================================
import { confirmar } from './dialogo.js';

// Troca a aba visível (base). O comportamento completo (FAB, select, lazy-load)
// vive em switchTab(), no app.js, que chama esta função.
export function ativarAba(t) {
  document.querySelectorAll('.tab-btn').forEach(b => { b.classList.remove('active'); b.removeAttribute('aria-current'); });
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  const btn = document.querySelector('[data-tab="' + t + '"]');
  btn.classList.add('active');
  btn.setAttribute('aria-current', 'page');
  document.getElementById('panel-' + t).classList.add('active');
}

export function toggleOrd(id) {
  const card = document.getElementById(id);
  if (!card) return;
  card.classList.toggle('open');
}

// As 14 ordenanças são marcação estática; os roteiros do Manual são recriados no
// render e ligados em manual.js. Nos dois casos o cabeçalho abre o próprio cartão.
function ligarOrdenancas() {
  document.getElementById('lista-ordenancas')?.addEventListener('click', e => {
    const card = e.target.closest('.ord-header')?.closest('.ord-card');
    if (card) toggleOrd(card.id);
  });
}
ligarOrdenancas();

// =============================================
// MODAIS
// Uma pilha só para todos (formulários, diálogos, "Quem está usando?"):
//  - Esc, o ✕, tocar fora e o Voltar do Android fecham o de cima. Antes, o
//    Voltar saía do app e levava junto o que estava digitado.
//  - Se algo foi digitado, pergunta antes de descartar.
//  - Ao fechar, o foco volta para o botão que abriu.
//  - Cada modal aberto ganha uma entrada no histórico — é ela que o Voltar
//    consome. Fechar pelo app (salvar, ✕) devolve essa entrada.
// Opções de abrirModal: obrigatorio (não fecha por Esc/Voltar/fora),
// semConfirmacao (fecha sem perguntar), travarSeSujo (com semConfirmacao: se
// algo foi digitado, tocar fora e o Voltar não fecham — só ✕, Esc ou Cancelar),
// aoFechar (chamado ao fechar).
// =============================================
const pilha = [];
let aoVoltarAba = null;      // app.js: o que fazer com um Voltar sem modal aberto
const aoFicarSemModal = [];

export const haModalAberto = () => pilha.length > 0;
export function definirVoltarAba(fn) { aoVoltarAba = fn; }

// Roda agora, ou quando o último modal fechar (ex.: recarregar para atualizar
// o app — fazer isso com um formulário aberto perdia o que estava digitado).
export function quandoSemModal(fn) {
  if (!pilha.length) fn(); else aoFicarSemModal.push(fn);
}

const camposDe = el => [...el.querySelectorAll('input, select, textarea')]
  .filter(c => c.type !== 'hidden' && !c.readOnly && !c.disabled);
const retratoDe = el => JSON.stringify(camposDe(el).map(c =>
  (c.type === 'checkbox' || c.type === 'radio') ? c.checked : c.value));
const focaveis = el => [...el.querySelectorAll('button, [href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])')]
  .filter(x => !x.disabled && x.getClientRects().length);

// =============================================
// HISTÓRICO
// Cada modal aberto tem uma entrada no histórico (m.temEntrada) — é ela que o
// Voltar do Android consome. Duas regras evitam que pilha e histórico se
// desencontrem (o history.back() é assíncrono):
//  1. Fechar pelo app não devolve a entrada na hora: anota uma "sobra" e
//     devolve no fim do tique. Se um modal abrir antes disso (fechar um e
//     abrir outro no mesmo toque), ele HERDA a entrada (replaceState).
//  2. Enquanto um voltar nosso não termina (o popstate dele não chegou),
//     nenhuma entrada nova é empilhada: fica adiada até ele terminar.
// =============================================
let sobra = 0;               // entradas de modais fechados pelo app, a devolver
let devolucaoAgendada = false;
let travessias = 0;          // history.go() nossos cujo popstate ainda não veio
const adiados = [];          // entradas esperando a travessia terminar

function empurrar(estado, url) {
  try { url === undefined ? history.pushState(estado, '') : history.pushState(estado, '', url); } catch (e) {}
}

// Empilha uma entrada que não é de modal (a troca de aba, no app.js), sem
// atropelar uma travessia em andamento.
export function registrarNoHistorico(estado, url) {
  if (travessias) adiados.push({ estado, url });
  else empurrar(estado, url);
}

function empilharEntrada(m) {
  m.temEntrada = true;
  if (sobra > 0) {                                   // herda a de quem acabou de fechar
    sobra--;
    try { history.replaceState({ ...(history.state || {}), modal: m.id }, ''); } catch (e) {}
    return;
  }
  if (travessias) adiados.push({ modal: m });
  else empurrar({ ...(history.state || {}), modal: m.id });
}

function devolverEntrada() {
  sobra++;
  if (devolucaoAgendada) return;
  devolucaoAgendada = true;
  queueMicrotask(() => {
    devolucaoAgendada = false;
    if (!sobra) return;                              // herdada por um modal novo
    const n = sobra; sobra = 0;
    travessias++;
    try { history.go(-n); } catch (e) { travessias--; return; }
    // segurança: se o popstate não vier (nada para voltar), não trava o resto
    setTimeout(() => { if (travessias) { travessias = 0; aplicarAdiados(); } }, 800);
  });
}

function aplicarAdiados() {
  while (!travessias && adiados.length) {
    const a = adiados.shift();
    if (a.modal) { if (pilha.includes(a.modal) && a.modal.temEntrada) empurrar({ ...(history.state || {}), modal: a.modal.id }); }
    else empurrar(a.estado, a.url);
  }
}

export function abrirModal(id, opcoes = {}) {
  const el = document.getElementById(id);
  if (!el) return;
  const caixa = el.querySelector('.modal-box, .quem-box') || el;
  const ja = pilha.find(m => m.id === id);
  if (ja) {
    // o mesmo modal com conteúdo novo (ex.: diálogo de convite dentro do da
    // Agenda): só renova o retrato do que está digitado
    Object.assign(ja, opcoes, { retrato: retratoDe(el) });
  } else {
    el.classList.add('open');
    const m = { id, voltarPara: document.activeElement, retrato: retratoDe(el), ...opcoes };
    pilha.push(m);
    empilharEntrada(m);
  }
  caixa.setAttribute('role', 'dialog');
  caixa.setAttribute('aria-modal', 'true');
  const titulo = caixa.querySelector('h2, h3');
  if (titulo) { titulo.id = titulo.id || id + '-titulo'; caixa.setAttribute('aria-labelledby', titulo.id); }
  // No celular, focar um campo abre o teclado por cima do formulário: lá o
  // foco vai para a própria caixa (o leitor de tela começa pelo título).
  if (!caixa.contains(document.activeElement)) {
    const toque = window.matchMedia?.('(pointer: coarse)').matches;
    const campo = toque ? null : camposDe(caixa)[0];
    if (campo) campo.focus();
    else { caixa.setAttribute('tabindex', '-1'); caixa.focus({ preventScroll: true }); }
  }
}

export function fecharModal(id, { porVoltar = false } = {}) {
  const el = document.getElementById(id);
  el?.classList.remove('open');
  const i = pilha.findIndex(m => m.id === id);
  if (i < 0) return;
  const [m] = pilha.splice(i, 1);
  // Fechou pelo app (salvar, ✕, Esc): devolve a entrada que este modal criou.
  // Pelo Voltar, o próprio navegador já a consumiu. Ainda adiada (nunca entrou
  // no histórico): só sai da lista de adiados.
  const adiado = adiados.findIndex(a => a.modal === m);
  if (adiado >= 0) adiados.splice(adiado, 1);
  else if (m.temEntrada && !porVoltar) devolverEntrada();
  m.temEntrada = false;
  if (m.voltarPara?.isConnected) m.voltarPara.focus?.({ preventScroll: true });
  m.aoFechar?.();
  // Fora deste tique: quem fechou o modal costuma gravar logo em seguida
  // (salvar, "Excluir?"), e a recarga da atualização não pode atropelar isso.
  if (!pilha.length && aoFicarSemModal.length) setTimeout(rodarSemModal, 0);
}

function rodarSemModal() {
  if (pilha.length) return;   // reabriu um modal no meio-tempo: espera de novo
  aoFicarSemModal.splice(0).forEach(fn => fn());
}

// Fechar por gesto do usuário. gesto: 'voltar', 'fora', 'esc' ou 'x'.
// Respeita obrigatorio e pergunta antes de jogar fora o que foi digitado.
async function pedirFechar(m, gesto) {
  const porVoltar = gesto === 'voltar';
  if (porVoltar) m.temEntrada = false;               // o Voltar consumiu a entrada
  const el = document.getElementById(m.id);
  const mudou = !!el && retratoDe(el) !== m.retrato;
  // Diálogo curto com texto digitado (nota nova, registro de acompanhamento):
  // perguntar "Descartar?" apagaria o próprio diálogo (é o mesmo elemento), então
  // um toque fora ou um Voltar sem querer simplesmente não fecham.
  const travado = m.obrigatorio || (m.travarSeSujo && mudou && (porVoltar || gesto === 'fora'));
  if (travado) {
    if (porVoltar) {
      empilharEntrada(m);
      if (!m.obrigatorio) import('./usuario.js').then(u => u.toast('Para descartar o que foi digitado, toque em ✕')).catch(() => {});
    }
    return;
  }
  if (m.semConfirmacao || !mudou) return fecharModal(m.id, { porVoltar });
  // o Voltar já consumiu a entrada: devolve antes de perguntar
  if (porVoltar) empilharEntrada(m);
  if (await confirmar('Descartar o que foi digitado?', { perigo: true, okLabel: 'Descartar' })) fecharModal(m.id);
}

function ligarModais() {
  window.addEventListener('popstate', e => {
    if (travessias) { travessias--; aplicarAdiados(); return; }   // um voltar nosso terminou
    const topo = pilha.at(-1);
    if (topo) pedirFechar(topo, 'voltar');
    else aoVoltarAba?.(e.state);
  });

  document.addEventListener('keydown', e => {
    const topo = pilha.at(-1);
    if (!topo) return;
    if (e.key === 'Escape') { e.preventDefault(); pedirFechar(topo, 'esc'); return; }
    // Tab não sai do modal para a página que está atrás dele
    if (e.key === 'Tab') {
      const lista = focaveis(document.getElementById(topo.id));
      if (!lista.length) return;
      const [primeiro, ultimo] = [lista[0], lista.at(-1)];
      if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
    }
  });

  // O ✕ de todos os modais passa por aqui (fase de captura, antes do listener
  // de cada aba): assim todos perguntam antes de descartar.
  document.addEventListener('click', e => {
    const topo = pilha.at(-1);
    if (!topo) return;
    const el = document.getElementById(topo.id);
    const fechar = e.target.closest('.modal-close, [data-act="fechar"]');
    if (fechar && el.contains(fechar)) {
      e.preventDefault(); e.stopPropagation();
      pedirFechar(topo, 'x');
    } else if (e.target === el) {
      pedirFechar(topo, 'fora');   // tocou no fundo escuro, fora da caixa
    }
  }, true);
}
ligarModais();
