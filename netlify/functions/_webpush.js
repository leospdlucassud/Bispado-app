// =============================================
// WEB PUSH — manda uma notificação para um aparelho, sem biblioteca
// A mensagem vai cifrada para o aparelho (RFC 8291, "aes128gcm") e assinada com
// a chave do servidor (VAPID, RFC 8292). O serviço do navegador (Google, Apple,
// Mozilla, Microsoft) só repassa: não consegue ler o texto.
//
// As chaves NÃO ficam no código: vêm das variáveis de ambiente do Netlify
// VAPID_PUBLICA e VAPID_PRIVADA (gerar com `node scripts/gerar-chaves-push.mjs`).
// (Sem Blobs: os testes de tests/ rodam isto direto no Node.)
// =============================================
import { createCipheriv, createECDH, createHmac, createPrivateKey, createSign, randomBytes } from "node:crypto";

const b64 = buf => Buffer.from(buf).toString("base64url");
const deB64 = s => Buffer.from(String(s || ""), "base64url");
const hmac = (chave, dados) => createHmac("sha256", chave).update(dados).digest();
// HKDF de uma rodada só (os tamanhos aqui nunca passam de 32 bytes)
const hkdf = (sal, ikm, info, tamanho) => hmac(hmac(sal, ikm), Buffer.concat([info, Buffer.from([1])])).subarray(0, tamanho);

export const configurado = env => !!(env.VAPID_PUBLICA && env.VAPID_PRIVADA);

// Cifra o texto para o aparelho. `sub` = { endpoint, keys: { p256dh, auth } }.
// `efemera`/`sal` só nos testes (para reproduzir); em uso, sorteados.
export function cifrar(texto, sub, { efemera, sal } = {}) {
  const uaPublica = deB64(sub.keys.p256dh);
  const segredo = deB64(sub.keys.auth);
  const ecdh = createECDH("prime256v1");
  if (efemera) ecdh.setPrivateKey(efemera); else ecdh.generateKeys();
  const asPublica = ecdh.getPublicKey();
  const compartilhado = ecdh.computeSecret(uaPublica);
  const info = Buffer.concat([Buffer.from("WebPush: info\0"), uaPublica, asPublica]);
  const ikm = hkdf(segredo, compartilhado, info, 32);
  const s = sal || randomBytes(16);
  const cek = hkdf(s, ikm, Buffer.from("Content-Encoding: aes128gcm\0"), 16);
  const nonce = hkdf(s, ikm, Buffer.from("Content-Encoding: nonce\0"), 12);
  const cifra = createCipheriv("aes-128-gcm", cek, nonce);
  // um registro só; 0x02 = último registro
  const corpo = Buffer.concat([cifra.update(Buffer.concat([Buffer.from(texto, "utf8"), Buffer.from([2])])), cifra.final(), cifra.getAuthTag()]);
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  return Buffer.concat([s, rs, Buffer.from([asPublica.length]), asPublica, corpo]);
}

// O token VAPID (JWT ES256) para o serviço de push daquele endpoint
export function tokenVapid(endpoint, env, agora = Date.now()) {
  const pub = deB64(env.VAPID_PUBLICA);
  const chave = createPrivateKey({ key: {
    kty: "EC", crv: "P-256", d: env.VAPID_PRIVADA, x: b64(pub.subarray(1, 33)), y: b64(pub.subarray(33, 65)),
  }, format: "jwk" });
  const cab = b64(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  // `sub`: o contato do servidor; a Apple exige mailto: ou https: — o endereço do app
  const corpo = b64(JSON.stringify({
    aud: new URL(endpoint).origin,
    exp: Math.floor(agora / 1000) + 12 * 3600,
    sub: env.URL && /^https:\/\//.test(env.URL) ? env.URL : "https://bispado.netlify.app",
  }));
  const assinatura = createSign("SHA256").update(`${cab}.${corpo}`).sign({ key: chave, dsaEncoding: "ieee-p1363" });
  return `${cab}.${corpo}.${b64(assinatura)}`;
}

// Manda. Devolve 'ok' | 'expirada' (o aparelho desligou: apagar a inscrição) | 'erro'
export async function enviarPush(sub, dados, env = process.env, buscar = fetch) {
  if (!configurado(env)) return "erro";
  try {
    const res = await buscar(sub.endpoint, {
      method: "POST",
      headers: {
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        TTL: "86400",
        Urgency: "high",
        Authorization: `vapid t=${tokenVapid(sub.endpoint, env)}, k=${env.VAPID_PUBLICA}`,
      },
      body: cifrar(JSON.stringify(dados), sub),
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 404 || res.status === 410) return "expirada";
    return res.ok ? "ok" : "erro";
  } catch {
    return "erro";
  }
}
