// =============================================
// TEMA ESCURO/CLARO + TAMANHO DA FONTE
// =============================================
function toggleTheme() {
  const html = document.documentElement;
  const current = html.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  const btn = document.getElementById('btn-theme');
  btn.textContent = next === 'dark' ? '🌙 Escuro' : '☀️ Claro';
}

// Quase todo o app usa tamanhos fixos em px, então mexer só no font-size do body
// não teria efeito visível. A escala aplica zoom no conteúdo inteiro.
let escalaFonte = parseFloat(localStorage.getItem('escalaFonte')) || 1;

function aplicarEscalaFonte() {
  document.body.style.zoom = escalaFonte;
  // medidas em vh ignoram o zoom — a variável compensa
  document.documentElement.style.setProperty('--zoom', escalaFonte);
  const btnMenos = document.querySelector('.theme-controls button[title="Diminuir fonte"]');
  const btnMais  = document.querySelector('.theme-controls button[title="Aumentar fonte"]');
  if (btnMenos) btnMenos.disabled = escalaFonte <= 0.8;
  if (btnMais)  btnMais.disabled  = escalaFonte >= 1.5;
  [btnMenos, btnMais].forEach(b => { if (b) b.style.opacity = b.disabled ? '.4' : ''; });
}

function changeFontSize(delta) {
  const antes = escalaFonte;
  escalaFonte = Math.max(0.8, Math.min(1.5, +(escalaFonte + delta * 0.1).toFixed(2)));
  if (escalaFonte === antes) return;
  localStorage.setItem('escalaFonte', escalaFonte);
  aplicarEscalaFonte();
  toast('Tamanho: ' + Math.round(escalaFonte * 100) + '%');
}

(function initTheme() {
  const saved = localStorage.getItem('theme');
  if (saved) {
    document.documentElement.setAttribute('data-theme', saved);
    const btn = document.getElementById('btn-theme');
    if (btn) btn.textContent = saved === 'dark' ? '🌙 Escuro' : '☀️ Claro';
  }
  document.addEventListener('DOMContentLoaded', aplicarEscalaFonte);
})();
