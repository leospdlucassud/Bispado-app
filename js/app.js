// =============================================
// APP — botão flutuante e inicialização
// Carregado por último: depende de todos os demais módulos.
// =============================================
import { abrirModalAcomp } from './acompanhamento.js';
import { abrirModalAgenda } from './agenda.js';
import { carregarDados, iniciarAtualizacaoAutomatica, sincronizarManual } from './api.js';
import { clearSearch, doSearch } from './busca.js';
import { abrirModalEvento, renderCalendario } from './calendario.js';
import { aplicarNomeAla } from './config.js';
import { abrirModalDesig } from './designacoes.js';
import { renderInicio } from './inicio.js';
import { renderManual, renderRoteiros } from './manual.js';
import { carregarMovimentacoes } from './membros.js';
import { carregarNotasCompartilhadas } from './notas.js';
import { installPWA, verRecusadas } from './offline-pwa.js';
import { abrirModalReuniao } from './reunioes.js';
import { acaoMaisSacramental, carregarSacramentais, renderAbaSacramental, sacCarregado } from './sacramental.js';
import { changeFontSize, toggleTheme } from './tema.js';
import { ativarAba, definirVoltarAba, registrarNoHistorico } from './ui.js';
import { abrirEscolhaCargo, initUsuario } from './usuario.js';

export let fabTab = '';

export function onTabChange(tab) {
  fabTab = tab;
  const fab = document.getElementById('main-fab');
  const comBotao = ['inicio', 'agenda', 'reuniao', 'designacoes', 'calendario', 'sacramental', 'acompanhamento'];
  if (fab) fab.classList.toggle('visible', comBotao.includes(tab));
}

export function reativarAbaAtual() {
  if (fabTab) switchTab(fabTab);
}

document.getElementById('main-fab')?.addEventListener('click', () => {
  // No Início o + marca uma entrevista, como quando o app abria na Agenda. Troca
  // de aba ANTES de abrir o modal: o salvar volta para a aba atual
  // (reativarAbaAtual), e assim a entrevista nova aparece na Agenda.
  if (fabTab === 'inicio') { switchTab('agenda'); abrirModalAgenda(''); }
  else if (fabTab === 'agenda') abrirModalAgenda('');
  else if (fabTab === 'reuniao') abrirModalReuniao('');
  else if (fabTab === 'designacoes') abrirModalDesig('');
  else if (fabTab === 'calendario') abrirModalEvento();
  // depende da vista: escolher o orador da 1ª vaga aberta, a ata do próximo
  // domingo ou adicionar alguém ao rodízio — nunca a data de hoje
  else if (fabTab === 'sacramental') acaoMaisSacramental();
  else if (fabTab === 'acompanhamento') abrirModalAcomp();
});

// Casca do app: navegação de abas, tema, fonte, sincronização e busca.
// (Fase 2 da migração ESM: antes eram onclick/oninput inline no index.html.)
function ligarCasca() {
  // abas — delegação: um listener na barra cobre os 12 botões
  document.querySelector('.tabs')?.addEventListener('click', e => {
    const btn = e.target.closest('.tab-btn');
    if (btn?.dataset.tab) switchTab(btn.dataset.tab);
  });
  document.getElementById('tabs-select')?.addEventListener('change', e => switchTab(e.target.value));

  // cabeçalho
  document.getElementById('quem-badge')?.addEventListener('click', () => abrirEscolhaCargo());
  document.getElementById('btn-instalar-header')?.addEventListener('click', () => installPWA());
  document.querySelector('.theme-controls')?.addEventListener('click', e => {
    const acao = e.target.closest('button')?.dataset.action;
    if (acao === 'tema') toggleTheme();
    else if (acao === 'fonte-mais') changeFontSize(1);
    else if (acao === 'fonte-menos') changeFontSize(-1);
  });

  // sincronização
  document.getElementById('sync-btn')?.addEventListener('click', () => sincronizarManual());
  // o botão também avisa de alterações recusadas: tocar mostra o aviso; senão, envia
  // tocar no aviso mostra as recusadas E envia o que estiver pendente
  document.getElementById('sync-pendentes')?.addEventListener('click', () => { verRecusadas(); sincronizarManual(); });

  // busca
  const busca = document.getElementById('search-input');
  busca?.addEventListener('input', () => doSearch(busca.value));
  document.getElementById('search-clear')?.addEventListener('click', () => clearSearch());
}
ligarCasca();

const abaExiste = t => !!(t && document.getElementById('panel-' + t) && document.querySelector(`.tab-btn[data-tab="${t}"]`));

// switchTab completo: troca a aba (ativarAba, do ui.js), avisa o FAB, sincroniza
// o select das telas estreitas e faz o lazy-load de abas que carregam sob demanda.
// Cada troca de aba entra no histórico (#agenda, #notas…): o Voltar do Android
// volta para a aba anterior, em vez de sair do app. `historico: false` é para
// quem já veio do histórico (o próprio Voltar) ou só redesenha a mesma aba.
export function switchTab(t, { historico = true } = {}) {
  if (!abaExiste(t)) return;
  const mudou = fabTab !== t;
  ativarAba(t);
  onTabChange(t);
  const sel = document.getElementById('tabs-select');
  if (sel) sel.value = t;
  // o Início junta dados das outras abas: redesenha ao voltar para ele
  if (t === 'inicio') renderInicio();
  if (t === 'notas') carregarNotasCompartilhadas();
  if (t === 'membros') carregarMovimentacoes();
  // sempre redesenha: os dados podem ter chegado com a aba fechada
  if (t === 'sacramental') { if (sacCarregado) renderAbaSacramental(); else carregarSacramentais(); }
  if (mudou) {
    if (historico) registrarNoHistorico({ aba: t }, '#' + t);
    // com a barra de abas fixa no topo, a aba nova abre do começo
    window.scrollTo(0, 0);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Link de convite antigo (?confirmar=): vai para a página própria do convite
  const convite = new URLSearchParams(location.search).get('confirmar');
  // (o js/redirecionar-convite.js, no <head>, já faz isso antes; aqui é a reserva)
  if (convite) { location.replace('/convite.html?id=' + encodeURIComponent(convite)); return; }

  aplicarNomeAla();
  // A entrada de histórico da aba vem ANTES do "Quem está usando?": o modal
  // empilha a dele por cima. Na ordem inversa, o replaceState apagava a do
  // modal e o primeiro Voltar não fazia nada.
  onTabChange('inicio');
  const daUrl = decodeURIComponent(location.hash.slice(1));
  if (daUrl !== 'inicio' && abaExiste(daUrl)) switchTab(daUrl, { historico: false });
  try { history.replaceState({ ...(history.state || {}), aba: fabTab }, ''); } catch (e) {}
  initUsuario();
  renderCalendario();
  renderManual();
  renderRoteiros();
  // abre na tela de boas-vindas (o index.html já a traz marcada como ativa);
  // antes o app abria direto na Agenda
  renderInicio();
  // Voltar sem modal aberto: a aba da entrada anterior do histórico
  definirVoltarAba(estado => {
    const t = estado?.aba || decodeURIComponent(location.hash.slice(1)) || 'inicio';
    switchTab(abaExiste(t) ? t : 'inicio', { historico: false });
  });
  carregarDados();
  iniciarAtualizacaoAutomatica();
});
