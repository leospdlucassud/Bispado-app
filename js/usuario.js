// =============================================
// QUEM ESTÁ USANDO O PAINEL
// Sem senha — vale a integridade de quem usa. Serve para atribuir registros
// e para esconder assuntos sigilosos de quem não é o bispo.
// =============================================
import { renderAcompanhamentos } from './acompanhamento.js';
import { renderAgenda } from './agenda.js';
import { CARGOS } from './config.js';

export const CARGO_KEY = 'cargo_atual';
export const ICONE_CARGO = { 'Bispo':'⚜️', '1º Conselheiro':'🔵', '2º Conselheiro':'🟢', 'Secretário':'📝', 'Secretário Executivo':'🗓️' };
export let USUARIO = localStorage.getItem(CARGO_KEY) || '';

export const ehBispo = () => USUARIO === 'Bispo';

// Um item sigiloso só aparece para o bispo
export const podeVer = item => !item.sigiloso || ehBispo();

export function renderQuemBadge() {
  const b = document.getElementById('quem-badge');
  if (!b) return;
  b.innerHTML = USUARIO ? `${ICONE_CARGO[USUARIO] || '👤'} ${USUARIO}` : '👤 Identificar-se';
}

export function abrirEscolhaCargo() {
  const cx = document.getElementById('quem-opcoes');
  cx.innerHTML = CARGOS.map(c => `
    <div class="quem-opt" data-cargo="${c}">
      <span class="qi">${ICONE_CARGO[c] || '👤'}</span>
      <span style="font-size:13.5px;font-weight:600">${c}</span>
      ${c === 'Bispo' ? '<span style="margin-left:auto;font-size:10px;color:#e05555">vê sigilosos</span>' : ''}
    </div>`).join('');
  document.getElementById('quem-modal').style.display = 'flex';
}

export function definirCargo(cargo) {
  USUARIO = cargo;
  localStorage.setItem(CARGO_KEY, cargo);
  document.getElementById('quem-modal').style.display = 'none';
  renderQuemBadge();
  // o que está na tela muda conforme o sigilo
  renderAgenda();
  if (typeof renderAcompanhamentos === 'function') renderAcompanhamentos();
}

export function initUsuario() {
  renderQuemBadge();
  if (!USUARIO) abrirEscolhaCargo();
}

// Aviso curto no rodapé da tela
export function toast(msg) {
  let t = document.getElementById('app-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'app-toast';
    t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#c9a84c;color:#0d1b2a;padding:10px 20px;border-radius:24px;font-size:13px;font-weight:700;z-index:9500;box-shadow:0 6px 20px rgba(0,0,0,.35);transition:opacity .3s';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.style.opacity = '0'; }, 2200);
}

function ligarUsuario() {
  // as opções são recriadas a cada abrirEscolhaCargo()
  document.getElementById('quem-opcoes')?.addEventListener('click', e => {
    const opt = e.target.closest('.quem-opt');
    if (opt) definirCargo(opt.dataset.cargo);
  });
}
ligarUsuario();
