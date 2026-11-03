import { abrirStore, alterar, lerColecao } from "./_crud.js";
import { enviarPush, configurado } from "./_webpush.js";
import { camposAposToque, destinatarios, lembreteVencido, textoDoLembrete } from "../../js/lembretes-regras.js";

// Os lembretes do Acompanhamento — roda sozinho a cada 15 minutos (função
// agendada do Netlify; só roda no site publicado). Para cada card em aberto
// cujo lembrete venceu: primeiro grava o próximo toque (ou nenhum) e depois
// notifica. Nessa ordem, uma gravação que falhar não faz o lembrete tocar duas
// vezes — no pior caso, ele toca na próxima rodada.

const COLECOES = [
  { chave: "acompanhamentos", origem: "avulso" },
  { chave: "agenda", origem: "entrevista" },
];
const INSCRICOES = "push-inscricoes";

export default async (req) => {
  const env = { ...process.env, URL: process.env.URL || (req?.url ? new URL(req.url).origin : "") };
  if (!configurado(env)) return new Response("sem chaves VAPID");
  const store = abrirStore();
  const agora = Date.now();
  const inscricoes = (await lerColecao(store, INSCRICOES)).data;
  if (!inscricoes.length) return new Response("nenhum aparelho");

  const tocar = [];
  for (const { chave, origem } of COLECOES) {
    const { data } = await lerColecao(store, chave);
    if (!data.some(i => lembreteVencido(i, origem, agora))) continue;
    const vencidos = [];
    // falhou a gravação (conflito até o fim das tentativas): não toca agora —
    // tocaria de novo na próxima rodada
    const falhou = await alterar(store, chave, lista => {
      vencidos.length = 0;
      const nova = lista.map(i => {
        if (!lembreteVencido(i, origem, agora)) return i;
        vencidos.push({ item: i, origem });
        return { ...i, ...camposAposToque(i, agora) };
      });
      return { data: nova, resposta: () => null };
    });
    if (!falhou) tocar.push(...vencidos);
  }

  const expiradas = new Set();
  let enviados = 0;
  for (const { item, origem } of tocar) {
    const { titulo, corpo } = textoDoLembrete(item, origem);
    for (const sub of destinatarios(item, inscricoes, agora)) {
      if (expiradas.has(sub.endpoint)) continue;
      const r = await enviarPush(sub, { titulo, corpo, url: "/#acompanhamento", tag: "acomp-" + item.id }, env);
      if (r === "expirada") expiradas.add(sub.endpoint);
      if (r === "ok") enviados++;
    }
  }
  if (expiradas.size) {
    await alterar(store, INSCRICOES, data => ({ data: data.filter(i => !expiradas.has(i.endpoint)), resposta: () => null }));
  }
  return new Response(`${tocar.length} lembrete(s), ${enviados} notificação(ões)`);
};

export const config = { schedule: "*/15 * * * *" };
