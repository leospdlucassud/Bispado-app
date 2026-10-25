import { getStore } from "@netlify/blobs";
import { ALA_ID } from "./_ala.js";
import { DOC_CHAMADOS_VAZIO, limparDocumentoChamados } from "../../js/chamados-lcr.js";

// Os chamados da ala, do relatório "Organizações e Chamados" do LCR importado
// na aba Chamados (js/chamados-ala.js). Um documento só, trocado INTEIRO a cada
// importação: o relatório é a fotografia do LCR num dia, e juntar dois deixaria
// o mesmo chamado vago e preenchido. Telefones, e-mails e nascimentos que o PDF
// traz nas listas de membros nunca chegam aqui: o parser pula essas seções e
// limparDocumentoChamados só deixa passar as chaves conhecidas.
// (Os NOMES do bispado — os da entrada e dos convites — continuam em
// /api/bispado; a importação só os atualiza por lá.)

const H = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};
const resposta = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: H });

// Por ala, como os demais stores (ver _ala.js)
const STORE_NAME = "chamados-" + ALA_ID;
const KEY = "dados";

export default async (req) => {
  if (req.method === "OPTIONS") return new Response("", { headers: H });

  // forte: ler→mudar→gravar precisa ver a gravação anterior (ver _crud.js)
  const store = getStore({ name: STORE_NAME, consistency: "strong" });

  if (req.method === "GET") {
    try {
      const data = await store.get(KEY, { type: "json" });
      if (data == null) return resposta(DOC_CHAMADOS_VAZIO);   // nada importado ainda
      if (typeof data !== "object" || !Array.isArray(data.chamados)) throw new Error("Conteúdo inesperado em chamados");
      return resposta({ ...DOC_CHAMADOS_VAZIO, ...data });
    } catch (e) {
      // Falha de leitura não pode virar "não há nada": a tela diria que a ala
      // não tem chamados, e o Início contaria zero a designar.
      return resposta({ error: e.message }, 500);
    }
  }

  // POST — troca o documento inteiro pelo relatório novo, depois de limpo
  if (req.method === "POST") {
    let body;
    try { body = await req.json(); } catch { return resposta({ error: "Corpo inválido" }, 400); }
    const r = limparDocumentoChamados(body);
    if (r.erro) return resposta({ error: r.erro }, 400);
    const doc = { ...r.doc, atualizadoEm: new Date().toISOString() };
    try {
      await store.setJSON(KEY, doc);
    } catch (e) {
      return resposta({ error: e.message }, 500);
    }
    return resposta({ ok: true, total: doc.chamados.length, atualizadoEm: doc.atualizadoEm });
  }

  return new Response("Method not allowed", { status: 405, headers: H });
};

export const config = { path: "/api/chamados" };
