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

  const VAZIO = { movimentacoes: [], saidos: [], adicionados: [], roster: null, rosterAtualizadoEm: null };

  // GET — return all data
  if (req.method === "GET") {
    try {
      const raw = await store.get(KEY);
      const data = raw ? { ...VAZIO, ...JSON.parse(raw) } : VAZIO;
      return new Response(JSON.stringify(data), { headers: CORS });
    } catch {
      return new Response(JSON.stringify(VAZIO), { headers: CORS });
    }
  }

  // POST — save data. Sem "roster" no corpo, preserva o quadro já gravado.
  if (req.method === "POST") {
    const body = await req.json();

    let atual = VAZIO;
    try {
      const raw = await store.get(KEY);
      if (raw) atual = { ...VAZIO, ...JSON.parse(raw) };
    } catch { /* mantém o padrão vazio */ }

    const data = {
      movimentacoes: body.movimentacoes || [],
      saidos: body.saidos || [],
      adicionados: body.adicionados || [],
      roster: body.roster !== undefined ? body.roster : atual.roster,
      rosterAtualizadoEm: body.roster !== undefined
        ? new Date().toISOString()
        : atual.rosterAtualizadoEm,
    };
    await store.set(KEY, JSON.stringify(data));
    return new Response(JSON.stringify({ ok: true, total: data.roster ? data.roster.length : 0 }), { headers: CORS });
  }

  return new Response("Method not allowed", { status: 405, headers: CORS });
};
