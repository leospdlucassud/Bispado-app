// =============================================
// SESSÃO DE BISPO / ADM — a senha é conferida aqui, no servidor
//
// As senhas NÃO ficam no código (o repositório é público): vêm das variáveis
// de ambiente do Netlify — SENHA_BISPO, SENHA_ADM e SEGREDO_SESSAO (um texto
// aleatório e longo, que assina os tokens). Sem elas, ninguém entra como Bispo
// e os itens sigilosos não são entregues a ninguém (falha fechada).
//
// O token é "dados.assinatura" (HMAC-SHA256), vale 30 dias e carrega uma
// impressão da senha: trocar a senha no Netlify derruba as sessões abertas com
// a antiga; trocar o SEGREDO_SESSAO derruba todas. A impressão é um HMAC com o
// SEGREDO_SESSAO — um SHA-256 simples deixava, a quem visse o token (fica 30
// dias no aparelho), testar chutes fora do servidor: 8 números caíam em minutos.
// (Sem DOM e sem Blobs: os testes de tests/ rodam isto direto no Node.)
// =============================================
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const PAPEIS = ["bispo", "adm"];
export const DURACAO_MS = 30 * 24 * 60 * 60 * 1000;
const VAR_SENHA = { bispo: "SENHA_BISPO", adm: "SENHA_ADM" };

const sha = s => createHash("sha256").update(String(s)).digest();
const b64 = buf => Buffer.from(buf).toString("base64url");
const impressao = (papel, env) =>
  b64(createHmac("sha256", env.SEGREDO_SESSAO).update("pv|" + papel + "|" + senhaDe(papel, env)).digest()).slice(0, 16);

export const senhaDe = (papel, env) => (VAR_SENHA[papel] ? env[VAR_SENHA[papel]] || "" : "");
export const configurado = (papel, env) => !!(env.SEGREDO_SESSAO && senhaDe(papel, env));

// compara pelo hash, em tempo constante (não revela onde a senha diverge)
export function senhaConfere(digitada, certa) {
  if (typeof digitada !== "string" || !digitada || !certa) return false;
  return timingSafeEqual(sha(digitada), sha(certa));
}

// O ADM não aparece na tela: quem é ADM escolhe "Bispo" e digita a senha do
// ADM. Por isso o pedido de "bispo" aceita as duas senhas (a do Bispo primeiro).
const ENTRADAS = { bispo: ["bispo", "adm"], adm: ["adm"] };
export const podeEntrar = (pedido, env) => (ENTRADAS[pedido] || []).some(p => configurado(p, env));

// Quais variáveis do Netlify faltam para este pedido entrar — só os NOMES, nunca
// valores. Sem isto o app dizia "a senha não foi cadastrada" também quando só o
// SEGREDO_SESSAO faltava, e quem cadastrou as duas senhas não sabia o que faltava.
// (O pedido de 'bispo' fala só da SENHA_BISPO: o ADM não aparece na tela.)
export function variaveisFaltando(pedido, env) {
  const falta = [];
  if (!env.SEGREDO_SESSAO) falta.push("SEGREDO_SESSAO");
  if (!(ENTRADAS[pedido] || []).some(p => senhaDe(p, env))) falta.push(VAR_SENHA[pedido]);
  return falta.filter(Boolean);
}

// O papel da senha digitada, ou null. Confere todas (sem atalho) — o tempo da
// resposta não diz qual senha existe.
export function papelQueConfere(pedido, digitada, env) {
  const certos = (ENTRADAS[pedido] || []).filter(p => configurado(p, env) && senhaConfere(digitada, senhaDe(p, env)));
  return certos[0] || null;
}

export function assinar(papel, env, agora = Date.now()) {
  const dados = b64(JSON.stringify({ papel, exp: agora + DURACAO_MS, pv: impressao(papel, env) }));
  const mac = b64(createHmac("sha256", env.SEGREDO_SESSAO).update(dados).digest());
  return { token: `${dados}.${mac}`, exp: agora + DURACAO_MS };
}

// O papel do token, ou null (adulterado, vencido, de outro segredo, de senha trocada)
export function verificar(token, env, agora = Date.now()) {
  if (typeof token !== "string" || !env.SEGREDO_SESSAO) return null;
  const partes = token.split(".");
  if (partes.length !== 2 || !partes[0] || !partes[1]) return null;
  const [dados, mac] = partes;
  const esperado = createHmac("sha256", env.SEGREDO_SESSAO).update(dados).digest();
  const recebido = Buffer.from(mac, "base64url");
  if (recebido.length !== esperado.length || !timingSafeEqual(recebido, esperado)) return null;
  let p;
  try { p = JSON.parse(Buffer.from(dados, "base64url").toString("utf8")); } catch { return null; }
  if (!p || !PAPEIS.includes(p.papel) || !(Number(p.exp) > agora)) return null;
  if (!configurado(p.papel, env) || p.pv !== impressao(p.papel, env)) return null;
  return { papel: p.papel, exp: Number(p.exp) };
}

// A sessão de uma requisição (cabeçalho Authorization: Bearer <token>).
// `invalida`: veio um token que não vale mais — o app esquece a sessão.
export function sessaoDa(req, env = process.env) {
  const m = /^Bearer\s+(\S+)$/i.exec(req.headers.get("authorization") || "");
  if (!m) return { papel: null, invalida: false };
  const s = verificar(m[1], env);
  return s ? { papel: s.papel, invalida: false } : { papel: null, invalida: true };
}

// ---------- freio contra adivinhar a senha ----------
// Por endereço: 5 erros em 15 min bloqueiam aquele endereço. No total: 30 erros
// numa hora bloqueiam todos — uma senha de 8 números cairia em poucas horas
// de tentativas espalhadas por vários endereços.
export const LIMITE = { porIp: 5, janelaIp: 15 * 60 * 1000, total: 30, janelaTotal: 60 * 60 * 1000 };

const vivo = (c, janela, agora) => (c && agora - c.desde < janela ? c : { n: 0, desde: agora });

export function bloqueado(estado, ip, agora = Date.now()) {
  const e = estado || {};
  const doIp = vivo(e.ips?.[ip], LIMITE.janelaIp, agora);
  const total = vivo(e.total, LIMITE.janelaTotal, agora);
  if (doIp.n >= LIMITE.porIp) return Math.ceil((doIp.desde + LIMITE.janelaIp - agora) / 60000);
  if (total.n >= LIMITE.total) return Math.ceil((total.desde + LIMITE.janelaTotal - agora) / 60000);
  return 0;   // minutos de espera
}

export function comFalha(estado, ip, agora = Date.now()) {
  const e = estado || {};
  const ips = {};
  // descarta os endereços cuja janela já passou (o registro não cresce sem fim)
  for (const [k, c] of Object.entries(e.ips || {})) if (agora - c.desde < LIMITE.janelaIp) ips[k] = c;
  const doIp = vivo(ips[ip], LIMITE.janelaIp, agora);
  ips[ip] = { n: doIp.n + 1, desde: doIp.desde };
  const total = vivo(e.total, LIMITE.janelaTotal, agora);
  return { ips, total: { n: total.n + 1, desde: total.desde } };
}

// Acertou: a tentativa (contada antes de conferir) sai do endereço e do total
export function semFalhasDo(estado, ip) {
  const e = estado || {};
  const ips = { ...(e.ips || {}) };
  delete ips[ip];
  const total = e.total ? { ...e.total, n: Math.max(0, (e.total.n || 0) - 1) } : e.total;
  return { ...e, ips, total };
}
