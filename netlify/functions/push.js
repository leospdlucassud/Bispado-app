import { H, abrirStore, alterar } from "./_crud.js";
import { verificar } from "./_sessao.js";
import { configurado, enviarPush } from "./_webpush.js";
import { MAX_INSCRICOES, inscricaoValida } from "../../js/lembretes-regras.js";

// Os aparelhos que ligaram os lembretes do Acompanhamento (js/lembretes.js):
//   GET               → { publica } — a chave pública VAPID ('' se não configurada)
//   POST              → { inscricao, cargo } grava (ou atualiza) este aparelho
//   POST ?teste=1     → grava e manda um lembrete de teste só para ele
//   DELETE            → { endpoint } tira o aparelho
// Quem entrou como Bispo/ADM fica marcado até a sessão vencer (`sigiloAte`):
// só esses recebem lembrete de card sigiloso (sem o nome, mesmo assim).

// a mesma chave que o lembretes.js (o agendado) lê
const COLECAO = "push-inscricoes";
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: H });

export default async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: H });
  const env = { ...process.env, URL: process.env.URL || new URL(req.url).origin };
  if (req.method === "GET") return json({ publica: configurado(env) ? env.VAPID_PUBLICA : "" });

  let body;
  try { body = await req.json(); } catch { return json({ error: "Corpo inválido" }, 400); }
  let store;
  try { store = abrirStore(); } catch (e) { return json({ error: "Blobs: " + e.message }, 500); }

  if (req.method === "DELETE") {
    const endpoint = String(body?.endpoint || "");
    return alterar(store, COLECAO, data => ({ data: data.filter(i => i.endpoint !== endpoint), resposta: () => json({ ok: true }) }));
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!configurado(env)) return json({ error: "nao-configurado" }, 503);

  const sub = inscricaoValida(body?.inscricao);
  if (!sub) return json({ error: "Inscrição inválida" }, 400);
  const cargo = String(body?.cargo || "").trim().slice(0, 40);
  const token = (/^Bearer\s+(\S+)$/i.exec(req.headers.get("authorization") || "") || [])[1];
  const sessao = token ? verificar(token, env) : null;
  const agora = new Date().toISOString();
  const registro = { ...sub, cargo, sigiloAte: sessao ? sessao.exp : 0, atualizadoEm: agora };

  const resp = await alterar(store, COLECAO, data => {
    const outros = data.filter(i => i.endpoint !== sub.endpoint);
    // o mais antigo sai quando passa do limite (aparelho trocado, navegador limpo)
    const lista = [...outros, registro].sort((a, b) => String(a.atualizadoEm).localeCompare(String(b.atualizadoEm))).slice(-MAX_INSCRICOES);
    return { data: lista, resposta: () => json({ ok: true, sigilo: !!sessao }) };
  });
  if (!resp.ok || !new URL(req.url).searchParams.has("teste")) return resp;

  const r = await enviarPush(sub, {
    titulo: "🔔 Lembretes ligados",
    corpo: "É assim que o lembrete do acompanhamento vai aparecer neste aparelho.",
    url: "/#acompanhamento",
  }, env);
  if (r === "expirada") await alterar(store, COLECAO, data => ({ data: data.filter(i => i.endpoint !== sub.endpoint), resposta: () => null }));
  return json({ ok: r === "ok", envio: r }, r === "ok" ? 200 : 502);
};

export const config = { path: "/api/push" };
