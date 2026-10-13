// Login do Bispo / ADM (netlify/functions/_sessao.js) e o filtro de sigilo — `npm test`.
// Só senhas de TESTE aqui: as de verdade ficam nas variáveis do Netlify.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DURACAO_MS, LIMITE, assinar, bloqueado, comFalha, configurado, semFalhasDo, senhaConfere, sessaoDa, verificar,
} from '../netlify/functions/_sessao.js';
import { escondidoPorSigilo, semSigilosos } from '../js/crud-regras.js';
import { criarServidor } from '../js/demo-servidor.js';

const ENV = { SENHA_BISPO: 'senha-de-teste-bispo', SENHA_ADM: 'senha-de-teste-adm', SEGREDO_SESSAO: 'segredo-de-teste-com-muitos-caracteres' };
const AGORA = 1_800_000_000_000;
const req = token => new Request('http://local/api/agenda', { headers: token ? { Authorization: 'Bearer ' + token } : {} });

test('o token assinado vale para o papel, por 30 dias', () => {
  for (const papel of ['bispo', 'adm']) {
    const { token, exp } = assinar(papel, ENV, AGORA);
    assert.equal(exp, AGORA + DURACAO_MS);
    assert.deepEqual(verificar(token, ENV, AGORA + 1000), { papel, exp });
    assert.equal(verificar(token, ENV, AGORA + DURACAO_MS + 1), null, 'vencido');
  }
});

test('token adulterado, de outro segredo ou de senha trocada não vale', () => {
  const { token } = assinar('bispo', ENV, AGORA);
  const [dados, mac] = token.split('.');
  // trocar o papel nos dados quebra a assinatura
  const outro = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(dados, 'base64url')), papel: 'adm' })).toString('base64url');
  assert.equal(verificar(`${outro}.${mac}`, ENV, AGORA), null);
  assert.equal(verificar(token + 'x', ENV, AGORA), null);
  assert.equal(verificar('lixo', ENV, AGORA), null);
  assert.equal(verificar(token, { ...ENV, SEGREDO_SESSAO: 'outro-segredo' }, AGORA), null);
  assert.equal(verificar(token, { ...ENV, SENHA_BISPO: 'senha-nova-de-teste' }, AGORA), null, 'trocar a senha derruba a sessão');
  assert.equal(verificar(token, { ...ENV, SEGREDO_SESSAO: '' }, AGORA), null);
});

test('senha confere só exata, e sem variável ninguém entra', () => {
  assert.ok(senhaConfere('senha-de-teste-bispo', ENV.SENHA_BISPO));
  assert.ok(!senhaConfere('senha-de-teste-bisp', ENV.SENHA_BISPO));
  assert.ok(!senhaConfere('', ENV.SENHA_BISPO));
  assert.ok(!senhaConfere('qualquer', ''));
  assert.ok(!senhaConfere(undefined, ENV.SENHA_BISPO));
  assert.ok(configurado('adm', ENV));
  assert.ok(!configurado('adm', { ...ENV, SENHA_ADM: '' }));
  assert.ok(!configurado('bispo', { SENHA_BISPO: 'x' }), 'sem segredo não há sessão');
  assert.ok(!configurado('secretario', ENV));
});

test('a requisição: sem token, com token válido e com token que não vale mais', () => {
  assert.deepEqual(sessaoDa(req(), ENV), { papel: null, invalida: false });
  assert.deepEqual(sessaoDa(req(assinar('adm', ENV).token), ENV), { papel: 'adm', invalida: false });
  assert.deepEqual(sessaoDa(req('abc.def'), ENV), { papel: null, invalida: true });
});

test('freio: 5 erros no mesmo endereço, ou 30 no total, bloqueiam por um tempo', () => {
  let e = {};
  for (let i = 0; i < LIMITE.porIp; i++) e = comFalha(e, '1.1.1.1', AGORA + i);
  assert.ok(bloqueado(e, '1.1.1.1', AGORA + 10) > 0);
  assert.equal(bloqueado(e, '2.2.2.2', AGORA + 10), 0, 'outro endereço segue');
  assert.equal(bloqueado(e, '1.1.1.1', AGORA + LIMITE.janelaIp + 10), 0, 'a janela passa');
  assert.equal(bloqueado(semFalhasDo(e, '1.1.1.1'), '1.1.1.1', AGORA + 10), 0, 'acertar limpa o endereço');
  let g = {};
  for (let i = 0; i < LIMITE.total; i++) g = comFalha(g, 'ip-' + i, AGORA + i);
  assert.ok(bloqueado(g, 'ip-novo', AGORA + 100) > 0, 'tentativas espalhadas também param');
});

test('sigilo: o item sigiloso não sai nem é alterado sem a sessão', () => {
  const lista = [{ id: '1' }, { id: '2', sigiloso: true }];
  assert.deepEqual(semSigilosos(lista, false).map(i => i.id), ['1']);
  assert.equal(semSigilosos(lista, true).length, 2);
  assert.ok(escondidoPorSigilo(lista[1], false));
  assert.ok(!escondidoPorSigilo(lista[1], true));
  assert.ok(!escondidoPorSigilo(lista[0], false));
  assert.ok(!escondidoPorSigilo(undefined, false));
});

test('demonstração: entrar com a senha "demo" e só então ver os sigilosos', async () => {
  const m = new Map([['agenda', [{ id: 'a', membro: 'X' }, { id: 'b', membro: 'Y', sigiloso: true }]]]);
  const srv = criarServidor({ ler: k => structuredClone(m.get(k) ?? null), gravar: (k, v) => m.set(k, structuredClone(v)) });
  const pedir = (metodo, caminho, corpo, token) => srv.atender(new Request('http://local' + caminho, {
    method: metodo, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  }));
  assert.equal((await pedir('POST', '/api/sessao', { papel: 'bispo', senha: 'errada' })).status, 401);
  const { token } = await (await pedir('POST', '/api/sessao', { papel: 'adm', senha: 'demo' })).json();
  assert.equal((await (await pedir('GET', '/api/agenda')).json()).length, 1);
  assert.equal((await (await pedir('GET', '/api/agenda', null, token)).json()).length, 2);
  assert.equal((await pedir('PUT', '/api/agenda?id=b', { obs: 'x' })).status, 404);
  assert.equal((await pedir('DELETE', '/api/agenda?id=b')).status, 404);
  assert.equal((await pedir('PUT', '/api/agenda?id=b', { obs: 'x' }, token)).status, 200);
});

test('a impressão da senha no token depende do segredo do servidor (não dá para testar chutes fora dele)', () => {
  const pv = env => JSON.parse(Buffer.from(assinar('adm', env, AGORA).token.split('.')[0], 'base64url')).pv;
  assert.notEqual(pv(ENV), pv({ ...ENV, SEGREDO_SESSAO: 'outro-segredo-de-teste-bem-comprido' }));
  assert.equal(pv(ENV), pv(ENV));
});

test('o acerto devolve a tentativa contada ao total e limpa o endereço', () => {
  let e = comFalha(comFalha({}, '1.1.1.1', AGORA), '1.1.1.1', AGORA);
  assert.equal(e.total.n, 2);
  e = semFalhasDo(e, '1.1.1.1');
  assert.equal(e.total.n, 1);
  assert.ok(!e.ips['1.1.1.1']);
});
