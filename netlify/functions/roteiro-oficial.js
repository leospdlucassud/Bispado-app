import { FONTES_ROTEIRO, lerRoteiroOficial } from "./_roteiros.js";

// O texto oficial de um roteiro de entrevista (aba Ordenanças):
// GET /api/roteiro-oficial?id=recom-renovacao. Lê a seção do Manual Geral (ou
// de Pregar Meu Evangelho) na Biblioteca do Evangelho — a API de conteúdo da
// Igreja não tem CORS, daí o servidor. Só leitura de conteúdo público: não
// grava nada e não recebe dado de ninguém da ala.

const H = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Content-Type": "application/json",
};

// o Manual muda poucas vezes por ano
const CACHE = new Map();
const VALIDADE = 24 * 3600e3;

async function buscarJson(url) {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (compatible; BispadoApp)" },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}

export default async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: H });
  if (req.method !== "GET") return new Response(JSON.stringify({ error: "Método não permitido" }), { status: 405, headers: H });

  const id = new URL(req.url).searchParams.get("id") || "";
  if (!Object.hasOwn(FONTES_ROTEIRO, id)) return new Response(JSON.stringify({ error: "id" }), { status: 400, headers: H });

  const guardado = CACHE.get(id);
  if (guardado && Date.now() - guardado.em < VALIDADE) return new Response(guardado.json, { status: 200, headers: H });

  let r;
  try {
    r = await lerRoteiroOficial(id, buscarJson);
  } catch {
    return new Response(JSON.stringify({ error: "leitura" }), { status: 502, headers: H });
  }
  const json = JSON.stringify(r);
  CACHE.set(id, { em: Date.now(), json });
  return new Response(json, { status: 200, headers: H });
};

export const config = { path: "/api/roteiro-oficial" };
