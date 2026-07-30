// =============================================
// APP — botão flutuante e inicialização
// Carregado por último: depende de todos os demais módulos.
// =============================================
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
});
