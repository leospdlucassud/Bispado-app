// =============================================
// /api/convite — o que a tela do membro (link ?confirmar=) pode ler e gravar.
// Antes a tela pública baixava /api/agenda inteira, com as entrevistas
// sigilosas e as anotações do bispado, para mostrar uma só. Aqui:
//   GET ?id=  → só os campos de conviteParaMembro, daquela entrevista
//   PUT ?id=  → só a resposta { resposta, sugestao }; o status é decidido aqui
// Também separa a tela do membro do resto da API: quando /api/agenda tiver
// autenticação, o convite continua funcionando por este caminho.
// =============================================
import { H, abrirStore, alterar, lerColecao } from "./_crud.js";
import { camposDaResposta, conviteParaMembro, encerrada } from "../../js/convite-regras.js";

const COLECAO = "agenda";   // a mesma chave de /api/agenda (crudHandler("agenda"))

const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: H });

export default async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: H });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return json({ error: "Informe o convite" }, 400);

  let store;
  try { store = abrirStore(); }
  catch (e) { return json({ error: "Blobs: " + e.message }, 500); }

  try {
    if (req.method === "GET") {
      const { data } = await lerColecao(store, COLECAO);
      const e = data.find(x => String(x.id) === id);
      return e ? json(conviteParaMembro(e)) : json({ error: "Convite não encontrado" }, 404);
    }

    if (req.method === "PUT") {
      let body;
      try { body = await req.json(); } catch { return json({ error: "Corpo inválido" }, 400); }
      return await alterar(store, COLECAO, data => {
        const idx = data.findIndex(x => String(x.id) === id);
        if (idx === -1) return { erro: json({ error: "Convite não encontrado" }, 404) };
        const atual = data[idx];
        // o bispado já registrou o resultado: o link antigo não responde mais
        if (encerrada(atual)) return { erro: json({ error: "encerrada" }, 409) };
        const agora = new Date().toISOString();
        const campos = camposDaResposta(atual, body?.resposta, body?.sugestao, agora);
        if (!campos) return { erro: json({ error: "Resposta inválida" }, 400) };
        const atualizado = { ...atual, ...campos, atualizadoEm: agora };
        const novo = [...data];
        novo[idx] = atualizado;
        return { data: novo, resposta: () => json(conviteParaMembro(atualizado)) };
      });
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
};

export const config = { path: "/api/convite" };
