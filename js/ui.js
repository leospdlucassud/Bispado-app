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

export function abrirModal(id) {
  document.getElementById(id).classList.add('open');
}

export function fecharModal(id) {
  document.getElementById(id).classList.remove('open');
}
