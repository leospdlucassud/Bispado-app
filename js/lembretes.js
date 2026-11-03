// =============================================
// LEMBRETES NO CELULAR (Web Push)
// Cada aparelho liga os lembretes uma vez (o navegador pede a permissão). A
// inscrição vai para /api/push com o cargo de quem usa; o servidor
// (netlify/functions/lembretes.js) manda os lembretes vencidos dos cards do
// Acompanhamento para os aparelhos dos cargos escolhidos no card.
// No iPhone, só funciona com o app instalado na tela de início (iOS 16.4+).
// =============================================
import { switchTab } from './app.js';
import { cabecalhoSessao } from './sessao.js';
import { USUARIO, toast } from './usuario.js';
import { esc } from './utils.js';

export const API_PUSH = '/api/push';

const suportado = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const ehIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const instalado = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;

// a chave pública vem do servidor (variável VAPID_PUBLICA do Netlify)
let chavePublica = null;
async function lerChave() {
  if (chavePublica !== null) return chavePublica;
  try {
    const r = await fetch(API_PUSH, { cache: 'no-store' });
    chavePublica = r.ok ? String((await r.json()).publica || '') : '';
  } catch { return ''; }   // sem rede: tenta de novo na próxima
  return chavePublica;
}

const paraBytes = b64 => {
  const s = atob((b64 + '='.repeat((4 - b64.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, c => c.charCodeAt(0));
};

async function inscricaoAtual() {
  if (!suportado()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

async function enviarInscricao(sub, { teste = false } = {}) {
  const r = await fetch(API_PUSH + (teste ? '?teste=1' : ''), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...cabecalhoSessao() },
    body: JSON.stringify({ inscricao: sub.toJSON(), cargo: USUARIO || '' }),
  });
  return r.ok;
}

// 'sem-suporte' | 'instalar' | 'sem-servidor' | 'bloqueado' | 'ligado' | 'desligado'
export async function estadoDoAparelho() {
  if (ehIos() && !instalado()) return 'instalar';
  if (!suportado()) return 'sem-suporte';
  if (window.Notification.permission === 'denied') return 'bloqueado';
  if (!(await lerChave())) return 'sem-servidor';
  return window.Notification.permission === 'granted' && (await inscricaoAtual()) ? 'ligado' : 'desligado';
}

// Precisa vir de um toque (o navegador só pede a permissão assim)
export async function ligarLembretes() {
  try {
    const chave = await lerChave();
    if (!chave) return toast('Os lembretes ainda não foram configurados no servidor');
    if (await window.Notification.requestPermission() !== 'granted') {
      await renderAvisoLembretes();
      return toast('Sem a permissão de notificações, o lembrete não chega');
    }
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription()
      || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: paraBytes(chave) });
    toast(await enviarInscricao(sub, { teste: true })
      ? '🔔 Lembretes ligados — mandamos um de teste'
      : 'Ligado neste aparelho, mas o servidor não respondeu. Tente "Testar" depois.');
  } catch {
    toast('Não deu para ligar os lembretes neste aparelho');
  }
  renderAvisoLembretes();
}

export async function testarLembretes() {
  const sub = await inscricaoAtual();
  if (!sub) return renderAvisoLembretes();
  try { toast(await enviarInscricao(sub, { teste: true }) ? 'Lembrete de teste enviado' : 'O servidor não conseguiu enviar o teste'); }
  catch { toast('Sem conexão com o servidor'); }
}

export async function desligarLembretes() {
  const sub = await inscricaoAtual();
  if (sub) {
    try {
      await fetch(API_PUSH, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) });
    } catch { /* o servidor tira sozinho quando o envio falhar */ }
    await sub.unsubscribe().catch(() => {});
  }
  toast('Lembretes desligados neste aparelho');
  renderAvisoLembretes();
}

// Ao abrir o app: o cargo e a sessão de Bispo podem ter mudado desde que este
// aparelho ligou os lembretes — a inscrição é regravada com os de agora.
export async function atualizarInscricao() {
  try {
    if (!suportado() || window.Notification.permission !== 'granted') return;
    const sub = await inscricaoAtual();
    if (sub && await lerChave()) await enviarInscricao(sub);
  } catch { /* sem rede: na próxima abertura */ }
}

const TEXTO = {
  'sem-suporte': ['🔕', 'Este navegador não recebe lembretes. No Android, use o Chrome; no iPhone, o app instalado na tela de início.'],
  instalar: ['📲', 'No iPhone, os lembretes só chegam com o app instalado: no Safari, toque em Compartilhar → "Adicionar à Tela de Início" e abra por lá.'],
  'sem-servidor': ['🔕', 'Os lembretes ainda não foram configurados no servidor (faltam as chaves VAPID no Netlify).'],
  bloqueado: ['🔕', 'As notificações deste app estão bloqueadas no aparelho. Libere nas configurações do navegador (ou do app) e volte aqui.'],
  desligado: ['🔔', 'Ligue os lembretes para o celular avisar na hora marcada em cada card.'],
  ligado: ['🔔', 'Lembretes ligados neste aparelho.'],
};

export async function renderAvisoLembretes() {
  const el = document.getElementById('acomp-lembretes');
  if (!el) return;
  const est = await estadoDoAparelho();
  const [ico, txt] = TEXTO[est];
  const botoes = est === 'desligado'
    ? '<button type="button" class="btn-secondary btn-destaque" data-act="lembretes-ligar">🔔 Ligar neste aparelho</button>'
    : est === 'ligado'
      ? `<button type="button" class="btn-secondary" data-act="lembretes-testar">Testar</button>
         <button type="button" class="btn-secondary" data-act="lembretes-desligar">Desligar</button>`
      : '';
  el.className = 'acomp-lembretes' + (est === 'ligado' ? ' ligado' : '');
  el.innerHTML = `<span class="acomp-lembretes-txt">${ico} ${esc(txt)}${est === 'ligado' && USUARIO ? ` Recebe os de <strong>${esc(USUARIO)}</strong>.` : ''}</span>
    ${botoes ? `<span class="acomp-lembretes-acoes">${botoes}</span>` : ''}`;
}

function ligarAvisoLembretes() {
  document.getElementById('acomp-lembretes')?.addEventListener('click', e => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'lembretes-ligar') ligarLembretes();
    else if (act === 'lembretes-testar') testarLembretes();
    else if (act === 'lembretes-desligar') desligarLembretes();
  });
  // tocou na notificação com o app já aberto: o service worker pede a aba
  navigator.serviceWorker?.addEventListener('message', e => {
    if (e.data?.type === 'ABRIR_ABA' && /^[a-z-]+$/.test(e.data.aba || '')) switchTab(e.data.aba);
  });
  renderAvisoLembretes();
  atualizarInscricao();
}
ligarAvisoLembretes();
