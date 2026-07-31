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
    } catch (e) {
      // Falha de leitura não pode virar "não há nada": o cliente trataria como
      // quadro vazio e o próximo POST apagaria o que está gravado.
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: CORS });
    }
  }

  // POST — save data. Sem "roster" no corpo, preserva o quadro já gravado.
  if (req.method === "POST") {
    const body = await req.json();

    let atual = VAZIO;
    try {
      const raw = await store.get(KEY);
      if (raw) atual = { ...VAZIO, ...JSON.parse(raw) };
    } catch (e) {
      // Sem saber o que já está gravado, gravar por cima destruiria dados
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: CORS });
    }

    // Só substitui o que veio no corpo. Antes, um POST sem (ou com) campos
    // vazios apagava o histórico e a lista de saídas já gravados.
    const data = {
      movimentacoes: body.movimentacoes !== undefined ? body.movimentacoes : atual.movimentacoes,
      saidos: body.saidos !== undefined ? body.saidos : atual.saidos,
      adicionados: body.adicionados !== undefined ? body.adicionados : atual.adicionados,
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

export const config = { path: "/api/membros" };
