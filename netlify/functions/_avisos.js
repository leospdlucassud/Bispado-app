// Mandar uma notificação para vários aparelhos (Web Push) — os lembretes do
// Acompanhamento (lembretes.js) e o aviso ao responsável pela entrevista quando
// o membro responde ao convite (convite.js). Aparelho que desligou os avisos
// (o serviço responde 404/410) sai da lista de inscrições.
import { alterar, lerColecao } from "./_crud.js";
import { configurado, enviarPush } from "./_webpush.js";

export const INSCRICOES = "push-inscricoes";

export const lerInscricoes = async store => (await lerColecao(store, INSCRICOES)).data;

// `envios`: [{ sub, dados }]. Devolve quantas notificações saíram.
export async function enviarAvisos(store, envios, env = process.env) {
  if (!configurado(env) || !envios.length) return 0;
  const expiradas = new Set();
  let enviados = 0;
  for (const { sub, dados } of envios) {
    if (expiradas.has(sub.endpoint)) continue;
    const r = await enviarPush(sub, dados, env);
    if (r === "expirada") expiradas.add(sub.endpoint);
    if (r === "ok") enviados++;
  }
  if (expiradas.size) {
    await alterar(store, INSCRICOES, data => ({ data: data.filter(i => !expiradas.has(i.endpoint)), resposta: () => null }));
  }
  return enviados;
}
