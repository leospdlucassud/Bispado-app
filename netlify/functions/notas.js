import { getStore } from "@netlify/blobs";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

const STORE_NAME = "notas";
const KEY = "all";

// Lê as notas com o ETag. Erro de leitura sobe: tratar falha como "lista vazia"
// e gravar em seguida apagaria todas as notas do bispado.
async function lerNotas(store) {
  const res = await store.getWithMetadata(KEY, { type: "json" });
  if (!res || res.data == null) return { data: [], etag: null };
  if (!Array.isArray(res.data)) throw new Error("Conteúdo inesperado em notas");
  return { data: res.data, etag: res.etag ?? null };
}

// Grava só se ninguém alterou desde a leitura; repete quando perde a corrida.
async function alterarNotas(store, mutar, tentativas = 4) {
  for (let i = 0; i < tentativas; i++) {
    const { data, etag } = await lerNotas(store);
    const novo = mutar(data);
    const r = await store.setJSON(KEY, novo, etag ? { onlyIfMatch: etag } : { onlyIfNew: true });
    if (r?.modified !== false) return true; // SDK antiga não devolve { modified }
  }
  return false;
}

export default async (req) => {
  if (req.method === "OPTIONS") return new Response("", { headers: CORS });

  const store = getStore(STORE_NAME);
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const conflito = () => new Response(
    JSON.stringify({ error: "Conflito de escrita — tente de novo" }), { status: 409, headers: CORS });

  try {
    // GET — return all
    if (req.method === "GET") {
      const { data } = await lerNotas(store);
      return new Response(JSON.stringify(data), { headers: CORS });
    }

    // POST — add
    if (req.method === "POST") {
      const body = await req.json();
      body.id = "n_" + Date.now(); // id é do servidor, não do cliente
      body.criadaEm = body.criadaEm || new Date().toISOString();
      if (!await alterarNotas(store, data => [...data, body])) return conflito();
      return new Response(JSON.stringify(body), { headers: CORS });
    }

    // PUT — update
    if (req.method === "PUT" && id) {
      const body = await req.json();
      if (!await alterarNotas(store, data => data.map(n => (n.id === id ? { ...n, ...body, id } : n)))) return conflito();
      return new Response(JSON.stringify(body), { headers: CORS });
    }

    // DELETE
    if (req.method === "DELETE" && id) {
      if (!await alterarNotas(store, data => data.filter(n => n.id !== id))) return conflito();
      return new Response(JSON.stringify({ ok: true }), { headers: CORS });
    }

    return new Response("Method not allowed", { status: 405, headers: CORS });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: CORS });
  }
};

export const config = { path: "/api/notas" };
