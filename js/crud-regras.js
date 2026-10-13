// =============================================
// REGRAS DO CRUD (sem DOM)
// Usadas pelo servidor (netlify/functions/_crud.js) e pela fila offline
// (pendentes.js): as duas pontas precisam juntar um POST repetido do mesmo
// jeito, senão a tela mostraria uma coisa e o servidor gravaria outra.
// =============================================

// Campos que o corpo de um POST/PUT nunca troca: o id e as datas são do
// servidor, e _descartados é só aviso da resposta.
const PROTEGIDOS = ['id', 'criadoEm', 'atualizadoEm', '_descartados'];

export function limparCorpo(body, extra = []) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return {};
  const fora = new Set([...PROTEGIDOS, ...extra]);
  return Object.fromEntries(Object.entries(body).filter(([k]) => !fora.has(k)));
}

export const fundirSimples = (existente, corpo) => ({ registro: { ...existente, ...corpo }, descartados: [] });

// Sigilo (agenda e acompanhamentos): o item sigiloso só sai do servidor para
// quem entrou com a senha de Bispo ou ADM (netlify/functions/_sessao.js). Os
// outros cargos nem o recebem — e não alteram nem excluem o que não veem.
export const semSigilosos = (lista, veSigilo) =>
  (veSigilo ? lista : (Array.isArray(lista) ? lista : []).filter(i => !(i && i.sigiloso)));
export const escondidoPorSigilo = (registro, veSigilo) => !!(registro && registro.sigiloso && !veSigilo);

// `travar(existente, corpo)` tira do corpo o que dependia de um estado que já
// mudou no servidor (ver travarVagas, em discursos-regras.js) e diz o quê
export const semTrava = (existente, corpo) => ({ corpo, descartados: [] });
const unir = (a, b) => [...new Set([...a, ...b])].sort((x, y) => x - y);

// PUT: merge raso, depois da trava
export function aplicarPut(existente, body, { agora, travar = semTrava }) {
  const t = travar(existente, limparCorpo(body));
  return { item: { ...existente, ...t.corpo, atualizadoEm: agora }, descartados: t.descartados };
}

// Índice do PRIMEIRO item com o mesmo valor — o critério da tela também
export function acharPorUnico(lista, campo, valor) {
  if (typeof valor !== 'string' || !valor) return -1;
  return (Array.isArray(lista) ? lista : []).findIndex(i => i && i[campo] === valor);
}

// POST com campo único (a data do domingo, a chave do orador): se já existe,
// junta no existente em vez de criar um duplicado. Antes, salvar um domingo
// com a programação sem carregar criava um segundo registro, escondido pelo
// primeiro — e o que foi digitado parecia perdido.
export function inserirOuMesclar(lista, body, { campo, agora, novoId, fundir = fundirSimples, travar = semTrava }) {
  const base = Array.isArray(lista) ? lista : [];
  const limpo = limparCorpo(body);
  const idx = acharPorUnico(base, campo, limpo[campo]);
  const existente = idx < 0 ? undefined : base[idx];
  const t = travar(existente, limpo);
  if (idx < 0) {
    const item = { ...t.corpo, id: novoId, criadoEm: agora };
    return { lista: [...base, item], item, criado: true, descartados: t.descartados };
  }
  const { registro, descartados } = fundir(existente, t.corpo);
  const item = { ...registro, id: existente.id, criadoEm: existente.criadoEm, atualizadoEm: agora };
  const nova = [...base];
  nova[idx] = item;
  return { lista: nova, item, criado: false, descartados: unir(t.descartados, descartados) };
}
