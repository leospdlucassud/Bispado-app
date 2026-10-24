// =============================================
// SESSÃO DE BISPO / ADM neste aparelho
// A senha é conferida no servidor (/api/sessao — netlify/functions/sessao.js),
// que devolve um token assinado, válido por 30 dias. O token vai em toda
// chamada à API (api.js e a fila offline): é ele que faz o servidor entregar
// os itens sigilosos. A senha nunca fica guardada no aparelho.
// =============================================
import { API_SESSAO } from './config.js';
import { chaveNoArmazenamento } from './demo.js';

const CHAVE = 'sessao_bispado';
const valida = s => (s && typeof s.token === 'string' && s.token && Number(s.exp) > Date.now() ? s : null);
const lerGuardada = () => { try { return valida(JSON.parse(localStorage.getItem(CHAVE) || 'null')); } catch (e) { return null; } };
let sessao = lerGuardada();
const ouvintes = new Set();

// Venceu com o app aberto: termina de verdade (o ouvinte tira os sigilosos,
// o cargo e reabre a janela com o aviso) — sem isto o crachá seguia "Bispo" e
// os sigilosos sumiam sem explicação. Fora da chamada que percebeu, para não
// redesenhar a tela no meio de um envio.
function conferirVencimento() {
  if (sessao && !valida(sessao)) queueMicrotask(() => { if (sessao && !valida(sessao)) sair('recusada'); });
}

export const sessaoAtual = () => { conferirVencimento(); return valida(sessao); };
export const papelDaSessao = () => sessaoAtual()?.papel || '';
export const cabecalhoSessao = () => {
  const s = sessaoAtual();
  return s ? { Authorization: 'Bearer ' + s.token } : {};
};
// usuario.js reage ao fim da sessão (os sigilosos saem da tela)
export const aoTerminarSessao = fn => { ouvintes.add(fn); };

// { ok: true, papel } ou { erro: 'senha' | 'nao-configurado' | 'muitas-tentativas' | 'indisponivel' | 'rede', minutos? }
// Direto pelo fetch, não pelo apiFetch: sem sinal, entrar não vai para a fila.
export async function entrar(papel, senha) {
  let res;
  try {
    res = await fetch(API_SESSAO, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ papel, senha }),
      // rede que aceita e não responde (Wi-Fi fraco, portal da capela): sem
      // prazo, o botão Entrar ficava desligado por minutos, sem aviso
      ...(typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? { signal: AbortSignal.timeout(15000) } : {}),
    });
  } catch (e) { return { erro: 'rede' }; }
  let corpo = null;
  try { corpo = await res.json(); } catch (e) { /* corpo vazio */ }
  if (!res.ok) return { erro: corpo?.error || 'rede', minutos: corpo?.minutos, falta: Array.isArray(corpo?.falta) ? corpo.falta : [] };
  const nova = valida({ papel: corpo?.papel, token: corpo?.token, exp: Number(corpo?.exp) });
  if (!nova) return { erro: 'rede' };
  sessao = nova;
  try { localStorage.setItem(CHAVE, JSON.stringify(sessao)); } catch (e) { /* vale até fechar o app */ }
  return { ok: true, papel: sessao.papel };
}

// `motivo`: 'saiu' (tocou em Sair ou trocou de cargo) ou 'recusada' (venceu,
// ou o servidor disse que o token não vale mais: a senha mudou)
export function sair(motivo = 'saiu') {
  const tinha = !!sessao;
  sessao = null;
  try { localStorage.removeItem(CHAVE); } catch (e) { /* segue */ }
  if (tinha) for (const fn of ouvintes) fn(motivo);
}

// Outra aba (ou o app instalado aberto junto do navegador) saiu ou entrou:
// esta acompanha. Antes, Sair numa aba deixava as outras como Bispo, recebendo
// os sigilosos a cada 30 s até alguém recarregar.
addEventListener('storage', e => {
  if (e.key !== chaveNoArmazenamento(CHAVE) && e.key !== null) return;   // null: limparam tudo
  const guardada = lerGuardada();
  if (!guardada) {
    if (sessao) { sessao = null; for (const fn of ouvintes) fn('saiu'); }
  } else {
    sessao = guardada;
  }
});
// e o vencimento percebido mesmo sem nenhuma chamada à API
setInterval(conferirVencimento, 60 * 1000);
