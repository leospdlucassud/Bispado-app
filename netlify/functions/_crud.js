import { getStore } from "@netlify/blobs";
import { ALA_ID } from "./_ala.js";
import { aplicarPut, escondidoPorSigilo, inserirOuMesclar, limparCorpo, semSigilosos } from "../../js/crud-regras.js";
import { sessaoDa } from "./_sessao.js";

// Um store por ala (ver _ala.js).
const STORE = "bispado-" + ALA_ID;
export const abrirStore = () => getStore(STORE);

export const H = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Lê a coleção junto com o ETag, usado depois para gravar sem atropelar
// escrita de outra pessoa. NUNCA grava aqui: falha de leitura tem de virar erro,
// senão um problema momentâneo do Blobs apagaria a coleção inteira.
export async function lerColecao(store, key) {
  const res = await store.getWithMetadata(key, { type: "json" });
  if (!res || res.data == null) return { data: [], etag: null }; // ainda não existe
  if (!Array.isArray(res.data)) throw new Error(`Conteúdo inesperado em "${key}"`);
  return { data: res.data, etag: res.etag ?? null };
}

// Grava só se ninguém tiver alterado a chave desde a leitura (compare-and-swap).
// Devolve false quando outra escrita chegou primeiro, para o chamador tentar de novo.
async function gravarSeIntacto(store, key, data, etag) {
  const r = await store.setJSON(key, data, etag ? { onlyIfMatch: etag } : { onlyIfNew: true });
  // SDK antiga não devolve { modified }: nesse caso mantém o comportamento de sempre
  return r?.modified !== false;
}

// Repete ler→alterar→gravar enquanto outra escrita ganhar a corrida.
// `mutar` recebe a lista atual e devolve { data, resposta }.
// Várias escritas na MESMA coleção ao mesmo tempo (a grade da frequência gravava
// os 5 domingos do mês juntos; dois aparelhos salvando) disputam o mesmo etag:
// com 4 tentativas seguidas, sem pausa, as últimas desistiam com 409 e o número
// ficava preso na fila. Agora são 8, com uma pausa crescente e um pouco de
// sorteio entre elas — cada escritor volta num momento diferente.
const pausa = ms => new Promise(r => setTimeout(r, ms));
export async function alterar(store, key, mutar, tentativas = 8) {
  for (let i = 0; i < tentativas; i++) {
    if (i) await pausa(Math.min(400, 25 * 2 ** i) * (0.5 + Math.random()));
    const { data, etag } = await lerColecao(store, key);
    const r = mutar(data);
    if (r.erro) return r.erro;
    if (await gravarSeIntacto(store, key, r.data, etag)) return r.resposta();
  }
  return new Response(
    JSON.stringify({ error: "Conflito de escrita — tente de novo" }),
    { status: 409, headers: H }
  );
}

// Cria um handler CRUD completo para uma coleção guardada em Netlify Blobs.
// Todas as coleções (agenda, reuniões, designações, etc.) compartilham este
// comportamento — muda só a chave.
// `unicoPor`: campo que não se repete na coleção (a data do domingo, a chave do
// orador). O POST com um valor que já existe junta no registro existente (200),
// e `fundir` decide o que entra; o PUT não troca esse campo.
// `travar`: no POST e no PUT, tira do corpo o que dependia de um estado que já
// mudou (a vaga de orador que outro aparelho trocou); a resposta diz o quê em
// `_descartados`.
// `sigilo`: a coleção tem itens sigilosos (agenda, acompanhamentos) — só saem,
// e só são alterados ou excluídos, com a sessão de Bispo ou ADM.
export function crudHandler(key, { unicoPor = "", fundir, travar, sigilo = false } = {}) {
  return async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: H });
    const sessao = sigilo ? sessaoDa(req) : { papel: null, invalida: false };
    const veSigilo = !!sessao.papel;
    // token que não vale mais (vencido, senha trocada): o app esquece a sessão
    const cab = sessao.invalida ? { ...H, "X-Sessao": "invalida" } : H;
    const naoAchou = () => new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: cab });

    let store;
    try { store = abrirStore(); }
    catch (e) { return new Response(JSON.stringify({ error: "Blobs: " + e.message }), { status: 500, headers: H }); }

    const id = new URL(req.url).searchParams.get("id");

    try {
      if (req.method === "GET") {
        const { data } = await lerColecao(store, key);
        return new Response(JSON.stringify(sigilo ? semSigilosos(data, veSigilo) : data), { headers: cab });
      }
      if (req.method === "POST") {
        const body = await req.json();
        if (unicoPor) {
          return await alterar(store, key, data => {
            const r = inserirOuMesclar(data, body, {
              campo: unicoPor, agora: new Date().toISOString(), novoId: Date.now().toString(), fundir, travar,
            });
            const saida = r.descartados.length ? { ...r.item, _descartados: r.descartados } : r.item;
            return {
              data: r.lista,
              resposta: () => new Response(JSON.stringify(saida), { status: r.criado ? 201 : 200, headers: H }),
            };
          });
        }
        const item = { ...limparCorpo(body), id: Date.now().toString(), criadoEm: new Date().toISOString() };
        return await alterar(store, key, data => ({
          data: [...data, item],
          resposta: () => new Response(JSON.stringify(item), { status: 201, headers: cab }),
        }));
      }
      if (req.method === "PUT" && id) {
        // o merge raso não troca id, datas nem o campo único (a data do domingo)
        const body = limparCorpo(await req.json(), unicoPor ? [unicoPor] : []);
        return await alterar(store, key, data => {
          const idx = data.findIndex(i => i.id === id);
          // sigiloso, para quem não entrou como Bispo: como se não existisse
          if (idx === -1 || escondidoPorSigilo(data[idx], veSigilo)) return { erro: naoAchou() };
          const { item: atualizado, descartados } = aplicarPut(data[idx], body, { agora: new Date().toISOString(), travar });
          const novo = [...data];
          novo[idx] = atualizado;
          const saida = descartados.length ? { ...atualizado, _descartados: descartados } : atualizado;
          return {
            data: novo,
            resposta: () => new Response(JSON.stringify(saida), { headers: cab }),
          };
        });
      }
      if (req.method === "DELETE" && id) {
        return await alterar(store, key, data => {
          if (escondidoPorSigilo(data.find(i => i.id === id), veSigilo)) return { erro: naoAchou() };
          return {
            data: data.filter(i => i.id !== id),
            resposta: () => new Response(JSON.stringify({ ok: true }), { headers: cab }),
          };
        });
      }
      return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: H });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: H });
    }
  };
}
