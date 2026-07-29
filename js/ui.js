// =============================================
// UI — navegação entre abas e modais
// =============================================
function switchTab(t) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelector('[data-tab="' + t + '"]').classList.add('active');
  document.getElementById('panel-' + t).classList.add('active');
}

function toggleOrd(id) {
  const card = document.getElementById(id);
  if (!card) return;
  card.classList.toggle('open');
}

function abrirModal(id) {
  document.getElementById(id).classList.add('open');
}

function fecharModal(id) {
  document.getElementById(id).classList.remove('open');
}
