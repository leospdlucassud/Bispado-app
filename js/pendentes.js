// =============================================
// ALTERAÇÕES PENDENTES (sem DOM)
// O que foi salvo sem sinal fica na fila do IndexedDB (offline-pwa.js) até o
// servidor aceitar. Sem isto, a atualização de 30 s trazia os dados do
// servidor — ainda sem a alteração — e ela sumia da tela, embora continuasse na
// fila: parecia perdida, e a pessoa cadastrava de novo (e duplicava).
// Agora, depois de cada carga, a fila é reaplicada por cima do que veio.
// =============================================

import { fundirSimples, limparCorpo } from './crud-regras.js';
import { fundirDomingo } from './discursos-regras.js';

// Coleção de DADOS de cada endpoint que passa pela fila
const COLECAO = {
  '/api/agenda': 'agenda',
  '/api/reunioes': 'reunioes',
  '/api/designacoes': 'designacoes',
  '/api/eventos_extras': 'eventos_extras',
  '/api/sacramentais': 'sacramentais',
  '/api/acompanhamentos': 'acompanhamentos',
  '/api/notas': 'notas',          // as compartilhadas (notas.js)
  '/api/oradores': 'oradores',    // ajustes do rodízio de discursos (rodizio.js)
};

// Coleções em que o POST não duplica: o servidor junta no registro que já tem
// o mesmo valor (crudHandler com unicoPor), e a fila faz igual, com a MESMA
// função de fusão — senão a tela mostraria uma coisa e o servidor gravaria outra.
const UNICO = {
  sacramentais: { campo: 'data', fundir: fundirDomingo },
  oradores: { campo: 'chave', fundir: fundirSimples },
};

// Id provisório do que foi criado sem sinal. Estável entre as cargas (vem do
// instante em que entrou na fila), para não aparecer duplicado.
export const idProvisorio = item => 'local_' + item.ts;

// Reaplica a fila sobre `dados`, só nas coleções de `recarregadas` (as que
// acabaram de vir do servidor — numa que não veio, o que está na tela já tem a
// alteração, e reaplicar duplicaria). Devolve quantas alterações aplicou.
export function aplicarPendentes(dados, fila, recarregadas) {
  let n = 0;
  // id provisório → id do registro em que a criação foi juntada
  const aliases = new Map();
  const ordem = [...fila].filter(i => i && i.url).sort((a, b) => a.ts - b.ts);
  for (const item of ordem) {
    let url;
    try { url = new URL(item.url, 'http://local'); } catch (e) { continue; }
    const col = COLECAO[url.pathname];
    if (!col || !recarregadas.has(col) || !Array.isArray(dados[col])) continue;
    const idUrl = url.searchParams.get('id');
    const id = idUrl && aliases.has(idUrl) ? aliases.get(idUrl) : idUrl;
    const corpo = item.body && typeof item.body === 'object' ? item.body : {};
    if (item.method === 'POST') {
      const local = idProvisorio(item);
      const u = UNICO[col];
      const valor = u ? corpo[u.campo] : '';
      const idx = u && typeof valor === 'string' && valor
        ? dados[col].findIndex(x => x && x[u.campo] === valor && x.id !== local) : -1;
      if (idx >= 0) {
        const existente = dados[col][idx];
        dados[col][idx] = { ...u.fundir(existente, limparCorpo(corpo)).registro, id: existente.id };
        aliases.set(local, String(existente.id));
        n++;
      } else if (!dados[col].some(x => x.id === local)) { dados[col].push({ ...corpo, id: local }); n++; }
    } else if (item.method === 'PUT' && id) {
      dados[col] = dados[col].map(x => String(x.id) === id ? { ...x, ...corpo } : x); n++;
    } else if (item.method === 'DELETE' && id) {
      dados[col] = dados[col].filter(x => String(x.id) !== id); n++;
    }
  }
  return n;
}
