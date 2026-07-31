// =============================================
// UI — navegação entre abas e modais
// =============================================
// Troca a aba visível (base). O comportamento completo (FAB, select, lazy-load)
// vive em switchTab(), no app.js, que chama esta função.
export function ativarAba(t) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelector('[data-tab="' + t + '"]').classList.add('active');
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

export function abrirModal(id) {
  document.getElementById(id).classList.add('open');
}

export function fecharModal(id) {
  document.getElementById(id).classList.remove('open');
}
