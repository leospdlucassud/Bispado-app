import { H, abrirStore, alterar } from "./_crud.js";
import { enviarAvisos, lerInscricoes } from "./_avisos.js";
import { configurado } from "./_webpush.js";
import { CARGOS, nomeDoResponsavel } from "../../js/cargos.js";
import { avisoDoReagendamento, reagendamentoParaAvisar } from "../../js/convite-regras.js";
import { inscricoesDoCargo } from "../../js/lembretes-regras.js";

// POST /api/avisos { id, por } — alguém do bispado acabou de reagendar a
// entrevista `id` no app (agenda.js): avisa no celular quem é responsável por
// ela. Só vale logo depois de um reagendamento de verdade, e uma vez por
// reagendamento (reagendamentoParaAvisar), para ninguém poder disparar avisos
// à vontade. Não devolve nada da entrevista.

const COLECAO = "agenda";
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: H });

export default async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: H });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const env = { ...process.env, URL: process.env.URL || new URL(req.url).origin };
  if (!configurado(env)) return json({ ok: false, motivo: "nao-configurado" });

  let body;
  try { body = await req.json(); } catch { return json({ error: "Corpo inválido" }, 400); }
  const id = String(body?.id || "");
  const por = CARGOS.includes(body?.por) ? body.por : "";
  if (!id) return json({ error: "Informe a entrevista" }, 400);

  let store;
  try { store = abrirStore(); } catch (e) { return json({ error: "Blobs: " + e.message }, 500); }

  // marca o reagendamento como avisado ANTES de avisar: dois pedidos juntos não avisam duas vezes
  let entrevista = null;
  const resp = await alterar(store, COLECAO, data => {
    entrevista = null;
    const idx = data.findIndex(x => String(x.id) === id);
    const marca = idx === -1 ? "" : reagendamentoParaAvisar(data[idx], Date.now());
    if (!marca) return { erro: json({ ok: false, motivo: "nada-a-avisar" }) };
    const novo = [...data];
    novo[idx] = { ...data[idx], avisoReagendado: marca };
    entrevista = novo[idx];
    return { data: novo, resposta: () => json({ ok: true }) };
  });
  if (!resp.ok || !entrevista) return resp;

  const responsavel = nomeDoResponsavel(entrevista.responsavel);
  // quem reagendou não precisa ser avisado do que acabou de fazer
  if (responsavel === por) return json({ ok: true, enviados: 0 });
  const subs = inscricoesDoCargo(await lerInscricoes(store), responsavel, entrevista.sigiloso, Date.now());
  const dados = avisoDoReagendamento(entrevista, por);
  const enviados = await enviarAvisos(store, subs.map(sub => ({ sub, dados })), env);
  return json({ ok: true, enviados });
};

export const config = { path: "/api/avisos" };
