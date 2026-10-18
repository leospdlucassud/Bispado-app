// Regras do convite — rodar com `npm test` (node:test, sem dependências).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  TIPO_DESIGNACAO, camposDaResposta, comoNoConvite, conviteJaRespondido, conviteParaMembro, primeiroNome, tipoNoConvite,
} from '../js/convite-regras.js';

const AGORA = '2026-10-08T22:00:00.000Z';

test('o convite só diz o assunto nos tipos de rotina', () => {
  assert.equal(tipoNoConvite({ tipo: 'Renovação de Recomendação para o Templo' }), 'Renovação de Recomendação para o Templo');
  assert.equal(tipoNoConvite({ tipo: 'Assuntos de Condição de Membro (Dignidade)' }), '');
  assert.equal(tipoNoConvite({ tipo: 'Orientação Espiritual' }), '');
  assert.equal(tipoNoConvite({ tipo: 'Outro' }), '');
  assert.equal(tipoNoConvite({ tipo: 'Tipo que alguém digitou' }), '');
});

test('entrevista sigilosa nunca diz o assunto, nem os de rotina', () => {
  assert.equal(tipoNoConvite({ tipo: 'Preparação para Missão', sigiloso: true }), '');
});

test('designação: o chamado já foi apoiado em público, o assunto pode ir; o apoio, não', () => {
  assert.equal(tipoNoConvite({ tipo: TIPO_DESIGNACAO }), TIPO_DESIGNACAO);
  assert.equal(tipoNoConvite({ tipo: 'Apoio de Chamado' }), '');
  assert.equal(tipoNoConvite({ tipo: TIPO_DESIGNACAO, sigiloso: true }), '');
});

test('como o convite fala: conversa, entrevista ou designação — sem "entrevista" na designação', () => {
  const frase = tipo => `Gostaríamos de marcar ${comoNoConvite(tipo).frase} para domingo, 18/10/2026, às 12:30.`;
  assert.equal(frase(''), 'Gostaríamos de marcar uma conversa com você para domingo, 18/10/2026, às 12:30.');
  assert.equal(frase('Renovação de Recomendação para o Templo'),
    'Gostaríamos de marcar uma entrevista com você — Renovação de Recomendação para o Templo — para domingo, 18/10/2026, às 12:30.');
  assert.equal(frase(TIPO_DESIGNACAO),
    'Gostaríamos de marcar a sua designação no chamado, por imposição de mãos, para domingo, 18/10/2026, às 12:30.');
  const d = comoNoConvite(TIPO_DESIGNACAO);
  assert.equal(d.titulo, 'Convite para a designação');
  for (const t of [d.frase, d.assunto, d.titulo]) assert.doesNotMatch(t, /entrevista/i);
  assert.equal(comoNoConvite('').titulo, 'Convite do bispado');
  assert.equal(comoNoConvite('').assunto, 'Convite do bispado');
  assert.equal(comoNoConvite('Preparação para Missão').titulo, 'Convite para entrevista');
  assert.equal(comoNoConvite('Preparação para Missão').assunto, 'Entrevista com o bispado — Preparação para Missão');
});

test('a tela do membro recebe o tipo da designação (e o título sai dele)', () => {
  const p = conviteParaMembro({ id: 'a2', membro: 'Exemplo, Bruno', tipo: TIPO_DESIGNACAO, obs: 'Secretário do Quórum de Élderes', data: '2026-10-18' });
  assert.equal(p.tipo, TIPO_DESIGNACAO);
  assert.equal(comoNoConvite(p.tipo).titulo, 'Convite para a designação');
  assert.ok(!('obs' in p));
});

test('primeiro nome a partir de "Sobrenome, Nome" ou do nome direto', () => {
  assert.equal(primeiroNome('Silva, Maria Aparecida'), 'Maria');
  assert.equal(primeiroNome('João Pedro Souza'), 'João');
  assert.equal(primeiroNome(''), '');
});

test('o membro recebe só os campos da tela, sem observações nem registros', () => {
  const e = { id: 'a1', membro: 'Silva, Maria', tipo: 'Orientação Espiritual', obs: 'segredo',
    registros: [{ texto: 'anotação do bispo' }], sigiloso: true, data: '2026-10-12', hora: '19:00', status: 'agendada' };
  const p = conviteParaMembro(e);
  assert.equal(p.nome, 'Maria');
  assert.equal(p.tipo, '');
  for (const campo of ['obs', 'registros', 'sigiloso', 'membro', 'telefone', 'responsavel']) {
    assert.ok(!(campo in p), `não deveria ter ${campo}`);
  }
});

test('confirmar move para Agendada; pedir outra data volta para Pendente', () => {
  assert.deepEqual(camposDaResposta({ status: 'pendente' }, 'confirmado', null, AGORA),
    { confirmacao: 'confirmado', confirmadoEm: AGORA, status: 'agendada' });
  assert.deepEqual(camposDaResposta({ status: 'agendada' }, 'reagendar', { data: '2026-10-15', hora: '20:00' }, AGORA),
    { confirmacao: 'reagendar', confirmadoEm: AGORA, status: 'pendente', sugestaoData: '2026-10-15', sugestaoHora: '20:00' });
});

test('resposta a entrevista encerrada não mexe no status', () => {
  const c = camposDaResposta({ status: 'realizada' }, 'confirmado', null, AGORA);
  assert.equal(c.status, undefined);
});

test('resposta ou sugestão inválida é recusada', () => {
  assert.equal(camposDaResposta({ status: 'pendente' }, 'status', null, AGORA), null);
  assert.equal(camposDaResposta({ status: 'pendente' }, 'reagendar', null, AGORA), null);
  assert.equal(camposDaResposta({ status: 'pendente' }, 'reagendar', { data: 'amanhã' }, AGORA), null);
  assert.equal(camposDaResposta({ status: 'pendente' }, 'reagendar', { data: '2026-10-15', hora: '8h' }, AGORA), null);
});

test('já respondeu = resposta depois do último convite', () => {
  assert.equal(conviteJaRespondido({}), false);
  assert.equal(conviteJaRespondido({ confirmadoEm: '2026-10-08T10:00:00Z', convidadoEm: '2026-10-07T10:00:00Z' }), true);
  assert.equal(conviteJaRespondido({ confirmadoEm: '2026-10-06T10:00:00Z', convidadoEm: '2026-10-07T10:00:00Z' }), false);
  assert.equal(conviteJaRespondido({ confirmadoEm: '2026-10-06T10:00:00Z' }), true);
});
