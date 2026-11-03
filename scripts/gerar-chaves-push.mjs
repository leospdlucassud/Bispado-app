// Gera o par de chaves VAPID dos lembretes no celular (Web Push).
//   node scripts/gerar-chaves-push.mjs
// Copie as duas linhas para Netlify → Site configuration → Environment
// variables e publique de novo. A PRIVADA é segredo: não vai para o repositório,
// para o chat nem para mensagem nenhuma. Trocar as chaves desliga os lembretes
// de todos os aparelhos (cada um liga de novo na aba Acompanhamento).
import { generateKeyPairSync } from "node:crypto";

const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const pub = publicKey.export({ format: "jwk" });
const priv = privateKey.export({ format: "jwk" });
const publica = Buffer.concat([Buffer.from([4]), Buffer.from(pub.x, "base64url"), Buffer.from(pub.y, "base64url")]).toString("base64url");

console.log("VAPID_PUBLICA=" + publica);
console.log("VAPID_PRIVADA=" + priv.d);
