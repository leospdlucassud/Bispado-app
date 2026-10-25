import { MAX_TEMA, buscarDiscursosBase, limparTema } from "../../js/discursos-base-regras.js";

// Discursos para inspirar o orador (o "discurso base" da aba Sacramental):
// busca o tema na Biblioteca do Evangelho — Conferência Geral, Liahona e BYU
// Speeches, nessa ordem — e lê o autor na página de cada discurso. Só leitura
// de conteúdo público: não grava nada e não recebe dado de ninguém da ala.
// Se esta função falhar, o app busca direto do navegador (sem o autor).

const H = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Content-Type": "application/json",
};

// O mesmo tema pedido de novo (outro orador, outro aparelho) não refaz as
// ~14 buscas enquanto a instância estiver de pé
const CACHE = new Map();
const VALIDADE = 6 * 3600e3;
const MAX_CACHE = 200;

async function buscarJson(url) {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (compatible; BispadoApp)" },
    signal: AbortSignal.timeout(url.includes("/search/") ? 6000 : 3500),
  });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}

export default async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: H });
  if (req.method !== "GET") return new Response(JSON.stringify({ error: "Método não permitido" }), { status: 405, headers: H });

  const bruto = new URL(req.url).searchParams.get("tema") || "";
  const tema = limparTema(bruto);
  if (tema.length < 2 || bruto.length > MAX_TEMA * 2) {
    return new Response(JSON.stringify({ error: "tema" }), { status: 400, headers: H });
  }
  const chave = tema.toLowerCase();
  const guardado = CACHE.get(chave);
  if (guardado && Date.now() - guardado.em < VALIDADE) return new Response(guardado.json, { status: 200, headers: H });

  const r = await buscarDiscursosBase(tema, { buscarJson, comAutor: true });
  // todas as fontes falharam: o app tenta do navegador
  if (r.fontes.every(f => f.erro)) return new Response(JSON.stringify({ error: "busca" }), { status: 502, headers: H });
  const json = JSON.stringify(r);
  if (!r.fontes.some(f => f.erro)) {
    if (CACHE.size >= MAX_CACHE) CACHE.delete(CACHE.keys().next().value);
    CACHE.set(chave, { em: Date.now(), json });
  }
  return new Response(json, { status: 200, headers: H });
};

export const config = { path: "/api/discursos-base" };
