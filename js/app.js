// =============================================
// APP — botão flutuante e inicialização
// Carregado por último: depende de todos os demais módulos.
// =============================================
import { abrirModalAcomp } from './acompanhamento.js';
import { abrirModalAgenda, abrirTelaConfirmacao } from './agenda.js';
import { carregarDados, iniciarAtualizacaoAutomatica, sincronizarManual } from './api.js';
import { clearSearch, doSearch } from './busca.js';
import { abrirModalEvento, renderCalendario } from './calendario.js';
import { aplicarNomeAla } from './config.js';
import { abrirModalDesig } from './designacoes.js';
import { renderManual, renderRoteiros } from './manual.js';
import { carregarMovimentacoes } from './membros.js';
import { carregarNotasCompartilhadas } from './notas.js';
import { installPWA } from './offline-pwa.js';
import { abrirModalReuniao } from './reunioes.js';
import { abrirModalSac, carregarSacramentais, formatDateKey, sacCarregado } from './sacramental.js';
import { changeFontSize, toggleTheme } from './tema.js';
import { ativarAba } from './ui.js';
import { abrirEscolhaCargo, initUsuario } from './usuario.js';

export let fabTab = '';

export function onTabChange(tab) {
  fabTab = tab;
  const fab = document.getElementById('main-fab');
  const comBotao = ['agenda', 'reuniao', 'designacoes', 'calendario', 'sacramental', 'acompanhamento'];
  if (fab) fab.classList.toggle('visible', comBotao.includes(tab));
}

export function reativarAbaAtual() {
  if (fabTab) switchTab(fabTab);
}

document.getElementById('main-fab')?.addEventListener('click', () => {
  if (fabTab === 'agenda') abrirModalAgenda('');
  else if (fabTab === 'reuniao') abrirModalReuniao('');
  else if (fabTab === 'designacoes') abrirModalDesig('');
  else if (fabTab === 'calendario') abrirModalEvento();
  else if (fabTab === 'sacramental') abrirModalSac(formatDateKey(new Date()));
  else if (fabTab === 'acompanhamento') abrirModalAcomp();
});

// Casca do app: navegação de abas, tema, fonte, sincronização e busca.
// (Fase 2 da migração ESM: antes eram onclick/oninput inline no index.html.)
function ligarCasca() {
  // abas — delegação: um listener na barra cobre os 11 botões
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

  // busca
  const busca = document.getElementById('search-input');
  busca?.addEventListener('input', () => doSearch(busca.value));
  document.getElementById('search-clear')?.addEventListener('click', () => clearSearch());
}
ligarCasca();

// switchTab completo: troca a aba (ativarAba, do ui.js), avisa o FAB, sincroniza
// o select das telas estreitas e faz o lazy-load de abas que carregam sob demanda.
export function switchTab(t) {
  ativarAba(t);
  onTabChange(t);
  const sel = document.getElementById('tabs-select');
  if (sel) sel.value = t;
  if (t === 'notas') carregarNotasCompartilhadas();
  if (t === 'membros') carregarMovimentacoes();
  if (t === 'sacramental' && !sacCarregado) carregarSacramentais();
}

document.addEventListener('DOMContentLoaded', () => {
  // Link do convite de entrevista: mostra só a tela de resposta
  const convite = new URLSearchParams(location.search).get('confirmar');
  if (convite) { abrirTelaConfirmacao(convite); return; }

  aplicarNomeAla();
  initUsuario();
  renderCalendario();
  renderManual();
  renderRoteiros();
  onTabChange('agenda');
  carregarDados();
  iniciarAtualizacaoAutomatica();
});
