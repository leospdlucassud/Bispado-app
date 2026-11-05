// =============================================
// LEMBRETES DO ACOMPANHAMENTO (sem DOM)
// O "despertador" de um card do Acompanhamento: quem cria escolhe quando o
// lembrete toca, se ele se repete e em quais cargos. O servidor
// (netlify/functions/lembretes.js, de 15 em 15 minutos) manda a notificação
// para os aparelhos desses cargos que ligaram os lembretes.
// Usado pelo app (acompanhamento.js, lembretes.js) e pelo servidor — sem DOM.
//
// Campos no card (avulso ou entrevista marcada para acompanhar):
//   lembreteEm        ISO (UTC) do próximo toque; '' = sem lembrete
//   lembreteRepetir   '' | 'diario' | 'semanal' | 'quinzenal' | 'mensal'
//   lembreteCargos    os cargos (nomes) que recebem; vazio = todo o bispado
//   lembreteDisparadoEm  quando tocou pela última vez
// =============================================

export const REPETICOES = {
  '': 'Não repetir',
  diario: 'Todo dia',
  semanal: 'Toda semana',
  quinzenal: 'A cada 15 dias',
  mensal: 'Todo mês',
};
export const repeticaoValida = r => (Object.hasOwn(REPETICOES, r) ? r : '');

const DIA_MS = 24 * 3600e3;
const PASSO = { diario: DIA_MS, semanal: 7 * DIA_MS, quinzenal: 14 * DIA_MS };
// Palmas (TO) é UTC−3 o ano todo (o Brasil não tem horário de verão desde
// 2019): o "todo mês às 19h" é contado no relógio de lá.
const FUSO_MS = -3 * 3600e3;

// Um mês depois, no mesmo dia e hora do relógio local — dia 31 cai no último
// dia do mês seguinte
function maisUmMes(ms) {
  const d = new Date(ms + FUSO_MS);
  const dia = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + 1);
  const ultimo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(dia, ultimo));
  return d.getTime() - FUSO_MS;
}

// O próximo toque DEPOIS de agora, ou '' quando não repete. Se o app ficou dias
// sem rodar (ou o servidor), pula os toques perdidos em vez de tocar vários.
export function proximoToque(emISO, repetir, agoraMs) {
  const r = repeticaoValida(repetir);
  let t = Date.parse(emISO);
  if (!r || !Number.isFinite(t)) return '';
  for (let i = 0; i < 5000 && t <= agoraMs; i++) t = r === 'mensal' ? maisUmMes(t) : t + PASSO[r];
  return t > agoraMs ? new Date(t).toISOString() : '';
}

// O card ainda está em aberto no Acompanhamento
export const acompAberto = (item, origem) => (origem === 'entrevista'
  ? !!item.acompanhar && (item.situacaoAcomp || 'aberto') !== 'concluido'
  : (item.situacao || 'aberto') !== 'concluido');

export function lembreteVencido(item, origem, agoraMs) {
  const t = Date.parse(item?.lembreteEm || '');
  return Number.isFinite(t) && t <= agoraMs && acompAberto(item, origem);
}

// O que o toque grava no card: o próximo (ou nenhum) e quando tocou
export function camposAposToque(item, agoraMs) {
  return {
    lembreteEm: proximoToque(item.lembreteEm, item.lembreteRepetir, agoraMs),
    lembreteDisparadoEm: new Date(agoraMs).toISOString(),
  };
}

// O texto aparece na tela bloqueada. Sigiloso não diz nem o nome.
export function textoDoLembrete(item, origem) {
  if (item.sigiloso) return { titulo: '🔒 Acompanhamento sigiloso', corpo: 'Hora de dar atenção a um acompanhamento. Abra o app.' };
  const quem = String(origem === 'entrevista' ? item.membro : item.titulo || '').trim();
  const assunto = String(origem === 'entrevista' ? '' : item.assunto || '').trim();
  return { titulo: '🧭 Lembrete de acompanhamento', corpo: (quem || 'Um acompanhamento') + (assunto ? ` — ${assunto}` : '') };
}

// Os aparelhos que recebem: os dos cargos escolhidos (todos, se nenhum foi
// escolhido). Sigiloso, só os que entraram como Bispo/ADM e a sessão ainda vale.
export function destinatarios(item, inscricoes, agoraMs) {
  const cargos = Array.isArray(item.lembreteCargos) ? item.lembreteCargos.filter(Boolean) : [];
  return (inscricoes || []).filter(i => i && i.endpoint
    && (!cargos.length || cargos.includes(i.cargo))
    && (!item.sigiloso || Number(i.sigiloAte) > agoraMs));
}

// ---------- inscrições (os aparelhos que ligaram os lembretes) ----------
// Só os serviços de push dos navegadores: o servidor faz POST para este
// endereço, e um endereço qualquer o faria chamar outros sites.
const SERVICOS_PUSH = ['fcm.googleapis.com', 'push.apple.com', 'push.services.mozilla.com', 'notify.windows.com'];
const B64URL = /^[A-Za-z0-9_-]+$/;
const tamanhoB64 = s => Math.floor(s.length * 3 / 4);

export function endpointValido(u) {
  try {
    const url = new URL(String(u || ''));
    if (url.protocol !== 'https:' || String(u).length > 1000) return false;
    return SERVICOS_PUSH.some(h => url.hostname === h || url.hostname.endsWith('.' + h));
  } catch { return false; }
}

// A inscrição que o navegador devolve (PushSubscription.toJSON()), conferida;
// ou null
export function inscricaoValida(sub) {
  const p256dh = String(sub?.keys?.p256dh || ''), auth = String(sub?.keys?.auth || '');
  if (!endpointValido(sub?.endpoint)) return null;
  if (!B64URL.test(p256dh) || tamanhoB64(p256dh) !== 65) return null;
  if (!B64URL.test(auth) || tamanhoB64(auth) !== 16) return null;
  return { endpoint: String(sub.endpoint), keys: { p256dh, auth } };
}

export const MAX_INSCRICOES = 60;

// Os aparelhos de um cargo (o responsável pela entrevista). Sigiloso, só os que
// entraram como Bispo/ADM e a sessão ainda vale. Sem cargo, ninguém.
export function inscricoesDoCargo(inscricoes, cargo, sigiloso, agoraMs) {
  if (!cargo) return [];
  return destinatarios({ lembreteCargos: [cargo], sigiloso: !!sigiloso }, inscricoes, agoraMs);
}
