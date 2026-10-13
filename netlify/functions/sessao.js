import { getStore } from "@netlify/blobs";
import { ALA_ID } from "./_ala.js";
import { H } from "./_crud.js";
import { assinar, bloqueado, comFalha, configurado, PAPEIS, senhaConfere, senhaDe, semFalhasDo, sessaoDa } from "./_sessao.js";

// POST { papel: 'bispo' | 'adm', senha } → { papel, token, exp }
// GET  (com Authorization: Bearer <token>) → { papel } ou 401
// As senhas vêm das variáveis de ambiente do Netlify (ver _sessao.js).

const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: H });
const CHAVE = "falhas";
const espera = ms => new Promise(r => setTimeout(r, ms));

// O freio de tentativas mora num store próprio, de consistência FORTE: com a
// eventual (a do resto do app), uma leitura atrasada deixava passar tentativas.
const abrirFreio = () => getStore({ name: "sessao-" + ALA_ID, consistency: "strong" });

// Muda o estado do freio por compare-and-swap (como o alterar() do _crud.js):
// sem isso, 300 tentativas simultâneas liam o mesmo estado e contavam como 1.
// Devolve o resultado de `mudar` ou null se não conseguiu gravar.
async function alterarFreio(store, mudar, tentativas = 6) {
  for (let i = 0; i < tentativas; i++) {
    const r = await store.getWithMetadata(CHAVE, { type: "json" });
    const estado = r?.data || {};
    const { novo, resultado } = mudar(estado);
    if (!novo) return resultado;
    const g = await store.setJSON(CHAVE, novo, r?.etag ? { onlyIfMatch: r.etag } : { onlyIfNew: true });
    if (g?.modified !== false) return resultado;
  }
  return null;
}

export default async (req, context) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: H });
  const env = process.env;

  if (req.method === "GET") {
    const s = sessaoDa(req, env);
    return s.papel ? json({ papel: s.papel }) : json({ error: "sessao" }, 401);
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ error: "Corpo inválido" }, 400); }
  const papel = body?.papel;
  if (!PAPEIS.includes(papel)) return json({ error: "papel" }, 400);
  if (!configurado(papel, env)) return json({ error: "nao-configurado" }, 503);

  const ip = context?.ip || "desconhecido";
  // A tentativa é CONTADA antes de a senha ser conferida: quem passa do limite
  // nem chega a ser conferido, mesmo em rajada. Sem o freio (o store fora do
  // ar, disputa demais), ninguém entra — falha fechada.
  let reserva;
  try {
    const store = abrirFreio();
    reserva = await alterarFreio(store, estado => {
      const minutos = bloqueado(estado, ip);
      return minutos ? { resultado: { minutos } } : { novo: comFalha(estado, ip), resultado: { ok: true } };
    });
    if (reserva?.ok && senhaConfere(body?.senha, senhaDe(papel, env))) {
      await alterarFreio(store, estado => ({ novo: semFalhasDo(estado, ip), resultado: true }));
      const { token, exp } = assinar(papel, env);
      return json({ papel, token, exp });
    }
  } catch {
    return json({ error: "indisponivel" }, 503);
  }
  if (!reserva) return json({ error: "indisponivel" }, 503);
  if (reserva.minutos) return json({ error: "muitas-tentativas", minutos: reserva.minutos }, 429);
  await espera(700);   // cada tentativa errada custa tempo
  return json({ error: "senha" }, 401);
};

export const config = { path: "/api/sessao" };
