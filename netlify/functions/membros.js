import { getStore } from "@netlify/blobs";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

const STORE_NAME = "membros";
const KEY = "dados";

export default async (req) => {
  if (req.method === "OPTIONS") return new Response("", { headers: CORS });

  const store = getStore(STORE_NAME);

  // GET — return all data
  if (req.method === "GET") {
    try {
      const raw = await store.get(KEY);
      const data = raw ? JSON.parse(raw) : { movimentacoes: [], saidos: [], adicionados: [] };
      return new Response(JSON.stringify(data), { headers: CORS });
    } catch {
      return new Response(JSON.stringify({ movimentacoes: [], saidos: [], adicionados: [] }), { headers: CORS });
    }
  }

  // POST — save all data (replace)
  if (req.method === "POST") {
    const body = await req.json();
    const data = {
      movimentacoes: body.movimentacoes || [],
      saidos: body.saidos || [],
      adicionados: body.adicionados || [],
    };
    await store.set(KEY, JSON.stringify(data));
    return new Response(JSON.stringify({ ok: true }), { headers: CORS });
  }

  return new Response("Method not allowed", { status: 405, headers: CORS });
};
