import { getStore } from "@netlify/blobs";
import { ALA_ID } from "./_ala.js";
import { sessaoDa } from "./_sessao.js";
import { MAX_CORPO_CRESCIMENTO, aplicarPostCrescimento, respostaCrescimento } from "../../js/crescimento-lcr.js";

// A aba "Vamos crescer a Ala" (js/crescimento.js): os relatórios do LCR que ela
// importa e o que só o bispo informa. Um documento só, em duas partes:
//   publico — contagens (Trimestral, Estatísticas, o resumo das recomendações,
//             a frequência às classes por grupo, o % da sacramental de cada ano);
//   privado — a lista das recomendações por pessoa (para as renovações), o número
//             de portadores do SM ativos e dizimistas e os participantes contados
//             a partir dela.
// O GET entrega o privado só com a sessão de Bispo ou ADM (como os sigilosos
// de _crud.js). O POST PEDE a sessão: tudo aqui vem do LCR ou do bispo, e quem
// não entrou não importa relatório nem muda o número dos dizimistas. Ele manda
// só as seções que mudaram e o servidor JUNTA (fundirCrescimento, em
// js/crescimento-lcr.js): importar o Trimestral
// não apaga as recomendações, e um mês de frequência não apaga os outros.

const H = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};

// Por ala, como os demais stores (ver _ala.js)
const STORE_NAME = "crescimento-" + ALA_ID;
const KEY = "dados";

export default async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: H });

  const sessao = sessaoDa(req);
  // token que não vale mais (vencido, senha trocada): o app esquece a sessão
  const cab = sessao.invalida ? { ...H, "X-Sessao": "invalida" } : H;
  const resposta = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: cab });

  let store;
  try { store = getStore({ name: STORE_NAME, consistency: "strong" }); }   // ler→juntar→gravar (ver _crud.js)
  catch (e) { return resposta({ error: "Blobs: " + e.message }, 500); }

  if (req.method === "GET") {
    try {
      const data = await store.get(KEY, { type: "json" });
      const doc = respostaCrescimento(data, !!sessao.papel);
      // Documento sem a forma esperada é erro, não "nada importado": a tela
      // diria que a ala não tem relatório nenhum.
      if (!doc) return resposta({ error: "Conteúdo inesperado em crescimento" }, 500);
      return resposta(doc);
    } catch (e) {
      return resposta({ error: e.message }, 500);
    }
  }

  if (req.method === "POST") {
    if (!sessao.papel) return resposta({ error: "sessao" }, 401);
    let texto;
    try { texto = await req.text(); } catch { return resposta({ error: "Corpo inválido" }, 400); }
    if (texto.length > MAX_CORPO_CRESCIMENTO) return resposta({ error: "Corpo grande demais" }, 413);
    let body;
    try { body = JSON.parse(texto); } catch { return resposta({ error: "Corpo inválido" }, 400); }

    // ler → juntar → gravar só se ninguém gravou no meio (compare-and-swap, como
    // o alterar() de _crud.js): duas importações ao mesmo tempo não se apagam
    try {
      for (let i = 0; i < 4; i++) {
        const atual = await store.getWithMetadata(KEY, { type: "json" });
        const r = aplicarPostCrescimento(atual?.data ?? null, body, new Date().toISOString());
        if (r.erro) return resposta({ error: r.erro }, r.status);
        const etag = atual?.etag;
        const g = await store.setJSON(KEY, r.doc, etag && atual?.data != null ? { onlyIfMatch: etag } : { onlyIfNew: true });
        // SDK antiga não devolve { modified }: nesse caso grava como sempre
        if (g?.modified !== false) return resposta(respostaCrescimento(r.doc, true));
      }
      return resposta({ error: "Conflito de escrita — tente de novo" }, 409);
    } catch (e) {
      return resposta({ error: e.message }, 500);
    }
  }

  return resposta({ error: "Method not allowed" }, 405);
};

export const config = { path: "/api/crescimento" };
