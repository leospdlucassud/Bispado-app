// Lembretes do Acompanhamento (js/lembretes-regras.js) e o envio Web Push
// (netlify/functions/_webpush.js) — `npm test`. Chaves geradas aqui, na hora:
// nenhuma chave de verdade no repositório.
import assert from 'node:assert/strict';
import { createDecipheriv, createECDH, createHmac, createPublicKey, createVerify, generateKeyPairSync, randomBytes } from 'node:crypto';
import { test } from 'node:test';
import {
  camposAposToque, destinatarios, endpointValido, inscricaoValida, lembreteVencido, proximoToque, textoDoLembrete,
} from '../js/lembretes-regras.js';
import { cifrar, enviarPush, tokenVapid } from '../netlify/functions/_webpush.js';

const b64 = buf => Buffer.from(buf).toString('base64url');
const AGORA = Date.parse('2026-11-03T15:00:00.000Z');   // 12h em Palmas

test('próximo toque: repete pulando os perdidos; sem repetir, acaba', () => {
  assert.equal(proximoToque('2026-11-03T12:00:00.000Z', 'diario', AGORA), '2026-11-04T12:00:00.000Z');
  assert.equal(proximoToque('2026-10-20T22:00:00.000Z', 'semanal', AGORA), '2026-11-03T22:00:00.000Z', 'hoje à noite ainda vem');
  assert.equal(proximoToque('2026-10-27T15:00:00.000Z', 'semanal', AGORA), '2026-11-10T15:00:00.000Z', 'exatamente agora já tocou');
  assert.equal(proximoToque('2026-11-01T12:00:00.000Z', 'quinzenal', AGORA), '2026-11-15T12:00:00.000Z');
  assert.equal(proximoToque('2026-11-01T12:00:00.000Z', '', AGORA), '');
  assert.equal(proximoToque('nada', 'diario', AGORA), '');
});

test('todo mês: mesmo dia e hora em Palmas; o dia 31 cai no último dia do mês', () => {
  // 31/10 às 21h em Palmas = 01/11 00:00 UTC — o mês é o de lá, não o do UTC
  assert.equal(proximoToque('2026-11-01T00:00:00.000Z', 'mensal', AGORA), '2026-12-01T00:00:00.000Z');
  assert.equal(proximoToque('2027-01-31T12:00:00.000Z', 'mensal', Date.parse('2027-02-01T00:00:00Z')), '2027-02-28T12:00:00.000Z');
});

test('vence só o card em aberto; o toque grava o próximo', () => {
  const card = { lembreteEm: '2026-11-03T12:00:00.000Z', lembreteRepetir: 'semanal', situacao: 'aberto' };
  assert.equal(lembreteVencido(card, 'avulso', AGORA), true);
  assert.equal(lembreteVencido({ ...card, situacao: 'concluido' }, 'avulso', AGORA), false);
  assert.equal(lembreteVencido({ ...card, lembreteEm: '2026-11-03T18:00:00.000Z' }, 'avulso', AGORA), false);
  assert.equal(lembreteVencido({ ...card, acompanhar: true }, 'entrevista', AGORA), true);
  assert.equal(lembreteVencido({ ...card, acompanhar: false }, 'entrevista', AGORA), false, 'tirada do acompanhamento');
  assert.equal(lembreteVencido({ ...card, acompanhar: true, situacaoAcomp: 'concluido' }, 'entrevista', AGORA), false);
  assert.deepEqual(camposAposToque(card, AGORA), { lembreteEm: '2026-11-10T12:00:00.000Z', lembreteDisparadoEm: '2026-11-03T15:00:00.000Z' });
  assert.equal(camposAposToque({ ...card, lembreteRepetir: '' }, AGORA).lembreteEm, '');
});

test('o texto da notificação: sigiloso não diz o nome', () => {
  assert.deepEqual(textoDoLembrete({ titulo: 'Exemplo, Ana', assunto: 'bem-estar' }, 'avulso'),
    { titulo: '🧭 Lembrete de acompanhamento', corpo: 'Exemplo, Ana — bem-estar' });
  assert.equal(textoDoLembrete({ membro: 'Exemplo, Bruno', tipo: 'Orientação' }, 'entrevista').corpo, 'Exemplo, Bruno');
  const sig = textoDoLembrete({ titulo: 'Exemplo, Ana', assunto: 'dignidade', sigiloso: true }, 'avulso');
  assert.ok(!JSON.stringify(sig).includes('Ana') && !JSON.stringify(sig).includes('dignidade'));
});

test('quem recebe: os cargos escolhidos; sigiloso só com a sessão de Bispo valendo', () => {
  const i = (cargo, sigiloAte = 0) => ({ endpoint: 'https://fcm.googleapis.com/x/' + cargo, cargo, sigiloAte });
  const aparelhos = [i('Bispo', AGORA + 1000), i('1º Conselheiro'), i('Secretário'), i('Bispo', AGORA - 1)];
  assert.equal(destinatarios({ lembreteCargos: ['1º Conselheiro'] }, aparelhos, AGORA).length, 1);
  assert.equal(destinatarios({ lembreteCargos: [] }, aparelhos, AGORA).length, 4, 'nenhum escolhido: todos');
  assert.equal(destinatarios({ sigiloso: true, lembreteCargos: [] }, aparelhos, AGORA).length, 1, 'só o Bispo com sessão');
  assert.equal(destinatarios({ sigiloso: true, lembreteCargos: ['1º Conselheiro'] }, aparelhos, AGORA).length, 0);
});

test('inscrição: só os serviços de push dos navegadores e chaves do tamanho certo', () => {
  for (const ok of ['https://fcm.googleapis.com/fcm/send/abc', 'https://web.push.apple.com/abc', 'https://updates.push.services.mozilla.com/wpush/v2/abc', 'https://wns2-par02p.notify.windows.com/w/?token=abc']) {
    assert.equal(endpointValido(ok), true, ok);
  }
  for (const ruim of ['http://fcm.googleapis.com/x', 'https://exemplo.com/x', 'https://fcm.googleapis.com.exemplo.com/x', 'https://notify.windows.com.evil.com/', 'nada']) {
    assert.equal(endpointValido(ruim), false, ruim);
  }
  const ecdh = createECDH('prime256v1'); ecdh.generateKeys();
  const boa = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: b64(ecdh.getPublicKey()), auth: b64(randomBytes(16)) } };
  assert.deepEqual(inscricaoValida(boa), boa);
  assert.equal(inscricaoValida({ ...boa, keys: { ...boa.keys, auth: b64(randomBytes(8)) } }), null);
  assert.equal(inscricaoValida({ ...boa, keys: { ...boa.keys, p256dh: 'não é base64!' } }), null);
  assert.equal(inscricaoValida({ ...boa, endpoint: 'https://exemplo.com/x' }), null);
});

// ---------- Web Push ----------
// O lado do aparelho (RFC 8291), para conferir o que o servidor cifra
function decifrar(corpo, uaEcdh, auth) {
  const sal = corpo.subarray(0, 16);
  const idlen = corpo[20];
  const asPublica = corpo.subarray(21, 21 + idlen);
  const cifrado = corpo.subarray(21 + idlen);
  const hmac = (k, d) => createHmac('sha256', k).update(d).digest();
  const hkdf = (s, ikm, info, n) => hmac(hmac(s, ikm), Buffer.concat([info, Buffer.from([1])])).subarray(0, n);
  const compartilhado = uaEcdh.computeSecret(asPublica);
  const info = Buffer.concat([Buffer.from('WebPush: info\0'), uaEcdh.getPublicKey(), asPublica]);
  const ikm = hkdf(auth, compartilhado, info, 32);
  const cek = hkdf(sal, ikm, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
  const nonce = hkdf(sal, ikm, Buffer.from('Content-Encoding: nonce\0'), 12);
  const d = createDecipheriv('aes-128-gcm', cek, nonce);
  d.setAuthTag(cifrado.subarray(cifrado.length - 16));
  const claro = Buffer.concat([d.update(cifrado.subarray(0, cifrado.length - 16)), d.final()]);
  assert.equal(claro[claro.length - 1], 2, 'delimitador do último registro');
  return claro.subarray(0, -1).toString('utf8');
}

function chavesVapid() {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const pub = publicKey.export({ format: 'jwk' });
  return {
    VAPID_PUBLICA: b64(Buffer.concat([Buffer.from([4]), Buffer.from(pub.x, 'base64url'), Buffer.from(pub.y, 'base64url')])),
    VAPID_PRIVADA: privateKey.export({ format: 'jwk' }).d,
    URL: 'https://exemplo.netlify.app',
    publicKey,
  };
}

test('o texto cifrado para o aparelho só ele abre, e volta igual', () => {
  const ua = createECDH('prime256v1'); ua.generateKeys();
  const auth = randomBytes(16);
  const sub = { endpoint: 'https://fcm.googleapis.com/x', keys: { p256dh: b64(ua.getPublicKey()), auth: b64(auth) } };
  const texto = JSON.stringify({ titulo: '🧭 Lembrete de acompanhamento', corpo: 'Exemplo, Ana — ação' });
  const corpo = cifrar(texto, sub);
  assert.equal(corpo.readUInt32BE(16), 4096);
  assert.equal(decifrar(corpo, ua, auth), texto);
  // outro aparelho não abre
  const outro = createECDH('prime256v1'); outro.generateKeys();
  assert.throws(() => decifrar(corpo, outro, auth));
});

test('o token VAPID é um JWT ES256 válido para o serviço do endpoint', () => {
  const env = chavesVapid();
  const agora = Date.parse('2026-11-03T15:00:00Z');
  const [cab, corpo, sig] = tokenVapid('https://web.push.apple.com/abc/def', env, agora).split('.');
  assert.deepEqual(JSON.parse(Buffer.from(cab, 'base64url')), { typ: 'JWT', alg: 'ES256' });
  const c = JSON.parse(Buffer.from(corpo, 'base64url'));
  assert.equal(c.aud, 'https://web.push.apple.com');
  assert.equal(c.sub, 'https://exemplo.netlify.app');
  assert.equal(c.exp, Math.floor(agora / 1000) + 12 * 3600);
  const ok = createVerify('SHA256').update(`${cab}.${corpo}`).verify({ key: env.publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(sig, 'base64url'));
  assert.equal(ok, true);
});

test('enviarPush: cabeçalhos do protocolo; 410 = aparelho desligou', async () => {
  const env = chavesVapid();
  const ua = createECDH('prime256v1'); ua.generateKeys();
  const sub = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: b64(ua.getPublicKey()), auth: b64(randomBytes(16)) } };
  let pedido;
  const r = await enviarPush(sub, { titulo: 't' }, env, async (url, opts) => { pedido = { url, opts }; return new Response(null, { status: 201 }); });
  assert.equal(r, 'ok');
  assert.equal(pedido.url, sub.endpoint);
  assert.equal(pedido.opts.headers['Content-Encoding'], 'aes128gcm');
  assert.match(pedido.opts.headers.Authorization, new RegExp(`^vapid t=[^.]+\\.[^.]+\\.[^.]+, k=${env.VAPID_PUBLICA}$`));
  assert.equal(await enviarPush(sub, {}, env, async () => new Response(null, { status: 410 })), 'expirada');
  assert.equal(await enviarPush(sub, {}, env, async () => new Response(null, { status: 500 })), 'erro');
  assert.equal(await enviarPush(sub, {}, { URL: 'x' }, async () => new Response(null, { status: 201 })), 'erro', 'sem as chaves não envia');
});

test('a chave pública do aparelho certa é a que o servidor usa (createPublicKey aceita a VAPID)', () => {
  const env = chavesVapid();
  const raw = Buffer.from(env.VAPID_PUBLICA, 'base64url');
  assert.equal(raw.length, 65);
  assert.ok(createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: b64(raw.subarray(1, 33)), y: b64(raw.subarray(33)) }, format: 'jwk' }));
});
