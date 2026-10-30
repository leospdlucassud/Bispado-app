// Regras do convite — rodar com `npm test` (node:test, sem dependências).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ESTADOS, TIPO_DESIGNACAO, avisarAceite, avisarMudancaDeComo, fraseDoComo, linkOnlineSeguro, modalidadeDe, camposDaNovaData, camposDaResposta, camposDoEnvio, comoNoConvite,
  conviteJaRespondido, conviteParaMembro, estadoDaEntrevista, naoRealizadaPelaData, precisaReenviarConvite,
  primeiroNome, rotuloDoEstado, tipoNoConvite,
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

test('a resposta não grava status: confirmar encerra a negociação; pedir outra data a abre', () => {
  assert.deepEqual(camposDaResposta({ status: 'aberta' }, 'confirmado', null, AGORA),
    { confirmacao: 'confirmado', confirmadoEm: AGORA, negociando: false });
  assert.deepEqual(camposDaResposta({ status: 'agendada' }, 'reagendar', { data: '2026-10-15', hora: '20:00' }, AGORA),
    { confirmacao: 'reagendar', confirmadoEm: AGORA, negociando: true, sugestaoData: '2026-10-15', sugestaoHora: '20:00' });
});

test('resposta a entrevista encerrada não mexe no status nem na negociação', () => {
  const c = camposDaResposta({ status: 'realizada' }, 'confirmado', null, AGORA);
  assert.equal(c.status, undefined);
  assert.equal('negociando' in c, false);
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

// ---------- status do card ----------
const HOJE = '2026-10-30';
const est = e => estadoDaEntrevista(e, HOJE);
const t = n => `2026-10-30T1${n}:00:00.000Z`;

test('não existe mais "Pendente": os seis status', () => {
  assert.deepEqual(Object.keys(ESTADOS), ['criado', 'enviado', 'em-agendamento', 'agendada', 'nao-realizada', 'realizada']);
  assert.ok(!Object.values(ESTADOS).includes('Pendente'));
});

test('Criado → Enviado → Agendado, e os registros antigos (pendente/agendada)', () => {
  const nova = { status: 'aberta', data: '2026-11-05', hora: '19:00' };
  assert.equal(est(nova), 'criado');
  assert.equal(est({ ...nova, status: 'pendente' }), 'criado');
  assert.equal(est({ status: 'aberta', data: '' }), 'criado');
  const enviada = { ...nova, ...camposDoEnvio(nova, t(0)) };
  assert.equal(est(enviada), 'enviado');
  assert.equal(est({ ...enviada, status: 'agendada' }), 'enviado');
  const confirmada = { ...enviada, ...camposDaResposta(enviada, 'confirmado', null, t(1)) };
  assert.equal(est(confirmada), 'agendada');
  assert.equal(est({ ...confirmada, status: 'realizada' }), 'realizada');
  assert.equal(est({ ...confirmada, status: 'nao-realizada', motivo: 'viajou' }), 'nao-realizada');
});

test('a data passou sem reagendamento: Não Realizada (sozinha), menos se o membro pediu outra', () => {
  const ontem = { status: 'aberta', data: '2026-10-29', hora: '19:00' };
  assert.equal(est(ontem), 'nao-realizada');
  assert.equal(naoRealizadaPelaData(ontem, HOJE), true);
  assert.equal(est({ ...ontem, convidadoEm: '2026-10-20T10:00:00Z' }), 'nao-realizada');
  assert.equal(est({ ...ontem, confirmacao: 'confirmado', confirmadoEm: '2026-10-21T10:00:00Z' }), 'nao-realizada');
  assert.equal(est({ ...ontem, data: HOJE, confirmacao: 'confirmado', confirmadoEm: '2026-10-21T10:00:00Z' }), 'agendada', 'hoje ainda vale');
  // o membro pediu outra data: a vez é do bispado
  assert.equal(est({ ...ontem, confirmacao: 'reagendar', confirmadoEm: '2026-10-21T10:00:00Z', sugestaoData: '2026-11-03' }), 'em-agendamento');
  // a registrada pelo bispado não é "pela data"
  assert.equal(naoRealizadaPelaData({ ...ontem, status: 'nao-realizada' }, HOJE), false);
});

test('a negociação: Enviado → Em agendamento → (contraproposta) Em agendamento → Agendado', () => {
  let e = { status: 'aberta', membro: 'Exemplo, Ana', data: '2026-11-05', hora: '19:00', reagendamentos: [] };
  e = { ...e, ...camposDoEnvio(e, t(0)) };
  assert.equal(rotuloDoEstado(e, HOJE), 'Enviado');
  // o membro não pode e sugere outro horário
  e = { ...e, ...camposDaResposta(e, 'reagendar', { data: '2026-11-06', hora: '20:00' }, t(1)) };
  assert.equal(est(e), 'em-agendamento');
  // o bispado propõe um terceiro horário: o card pede o convite de novo
  e = { ...e, ...camposDaNovaData(e, '2026-11-07', '18:00', t(2)) };
  assert.equal(est(e), 'em-agendamento');
  assert.equal(precisaReenviarConvite(e), true);
  assert.equal(e.aceitoEm, '');
  e = { ...e, ...camposDoEnvio(e, t(3)) };
  assert.equal(e.tentativas, 2);
  assert.equal(rotuloDoEstado(e, HOJE), 'Em agendamento · 2ª tentativa', 'ainda esperando o membro');
  // o membro confirma o horário novo
  e = { ...e, ...camposDaResposta(e, 'confirmado', null, t(4)) };
  assert.equal(est(e), 'agendada');
  assert.equal(rotuloDoEstado(e, HOJE), 'Agendado');
});

test('o bispado aceita o horário que o membro sugeriu: Agendado, e falta avisar o membro', () => {
  let e = { status: 'aberta', membro: 'Exemplo, Ana', data: '2026-11-05', hora: '19:00', reagendamentos: [] };
  e = { ...e, ...camposDoEnvio(e, t(0)) };
  e = { ...e, ...camposDaResposta(e, 'reagendar', { data: '2026-11-06', hora: '20:00' }, t(1)) };
  const aceito = camposDaNovaData(e, '2026-11-06', '20:00', t(2));
  assert.equal(aceito.aceitoEm, t(2));
  e = { ...e, ...aceito };
  assert.equal(est(e), 'agendada');
  assert.equal(precisaReenviarConvite(e), false, 'não pede convite: pede a confirmação');
  assert.equal(avisarAceite(e), true);
  assert.equal(conviteJaRespondido(e), true, 'o link do convite mostra que já está combinado');
  e = { ...e, confirmacaoEnviadaEm: t(3) };
  assert.equal(avisarAceite(e), false);
  // horário diferente do sugerido não é aceite
  const outro = { ...e, confirmacao: 'reagendar', confirmadoEm: t(4), sugestaoData: '2026-11-08', sugestaoHora: '' };
  assert.equal(camposDaNovaData(outro, '2026-11-08', '09:00', t(5)).aceitoEm, '');
  assert.ok(camposDaNovaData(outro, '2026-11-08', '', t(5)).aceitoEm);
});

test('o bispado muda a data sem o membro pedir: Em agendamento até reenviar, depois Enviado · 2ª tentativa', () => {
  let e = { status: 'aberta', data: '2026-11-05', hora: '19:00', reagendamentos: [] };
  e = { ...e, ...camposDoEnvio(e, t(0)) };
  e = { ...e, ...camposDaResposta(e, 'confirmado', null, t(1)) };
  e = { ...e, ...camposDaNovaData(e, '2026-11-12', '19:00', t(2)) };
  assert.equal(est(e), 'em-agendamento');
  e = { ...e, ...camposDoEnvio(e, t(3)) };
  assert.equal(rotuloDoEstado(e, HOJE), 'Enviado · 2ª tentativa');
});

test('tentativas: reenviar o mesmo horário não conta; registro antigo conta 1', () => {
  const e = { data: '2026-11-05', hora: '19:00' };
  const um = { ...e, ...camposDoEnvio(e, t(0)) };
  assert.equal(um.tentativas, 1);
  assert.equal(camposDoEnvio(um, t(1)).tentativas, 1);
  assert.equal(camposDoEnvio({ ...um, hora: '20:00' }, t(1)).tentativas, 2);
  // antigo: convite sem convidadoPara nem contador
  const antigo = { data: '2026-11-05', convidadoEm: '2026-10-01T10:00:00Z' };
  assert.equal(camposDoEnvio(antigo, t(0)).tentativas, 1);
  const antigoReagendado = { ...antigo, reagendamentos: [{ reagendadoEm: '2026-10-02T10:00:00Z' }] };
  assert.equal(camposDoEnvio(antigoReagendado, t(0)).tentativas, 2);
});

// ---------- presencial ou online ----------
test('sem o campo é presencial; online com link https só', () => {
  assert.equal(modalidadeDe({}), 'presencial');
  assert.equal(modalidadeDe({ modalidade: 'qualquer' }), 'presencial');
  assert.equal(modalidadeDe({ modalidade: 'online' }), 'online');
  assert.equal(linkOnlineSeguro('https://meet.google.com/abc-defg-hij'), 'https://meet.google.com/abc-defg-hij');
  assert.equal(linkOnlineSeguro('  https://zoom.us/j/123  '), 'https://zoom.us/j/123');
  for (const ruim of ['javascript:alert(1)', 'http://meet.google.com/x', 'meet.google.com/x', 'https://localhost/x', 'https://' + 'a'.repeat(600) + '.com']) {
    assert.equal(linkOnlineSeguro(ruim), '', ruim);
  }
});

test('a frase do convite: presencial, online com link, online sem link', () => {
  assert.equal(fraseDoComo({}), 'Será presencial.');
  assert.equal(fraseDoComo({ modalidade: 'online', linkOnline: 'https://meet.google.com/x' }),
    'Será online, por chamada de vídeo. Link: https://meet.google.com/x');
  assert.equal(fraseDoComo({ modalidade: 'online', linkOnline: 'javascript:alert(1)' }),
    'Será online, por chamada de vídeo. O link vai antes do horário.');
});

test('a tela do membro recebe como vai ser; presencial não leva link', () => {
  const p = conviteParaMembro({ id: 'a1', membro: 'Exemplo, Ana', modalidade: 'online', linkOnline: 'https://meet.google.com/x' });
  assert.equal(p.modalidade, 'online');
  assert.equal(p.linkOnline, 'https://meet.google.com/x');
  const q = conviteParaMembro({ id: 'a2', membro: 'Exemplo, Ana', modalidade: 'presencial', linkOnline: 'https://meet.google.com/x' });
  assert.equal(q.linkOnline, '');
  assert.equal(conviteParaMembro({ id: 'a3', membro: 'Exemplo, Ana' }).modalidade, 'presencial');
});

test('mudou presencial/online depois do convite: avisar até o convite (ou a confirmação) sair de novo', () => {
  const e = { status: 'aberta', convidadoEm: '2026-10-30T10:00:00Z', comoMudouEm: '2026-10-30T11:00:00Z' };
  assert.equal(avisarMudancaDeComo(e), true);
  assert.equal(avisarMudancaDeComo({ ...e, convidadoEm: '2026-10-30T12:00:00Z' }), false);
  assert.equal(avisarMudancaDeComo({ ...e, confirmacaoEnviadaEm: '2026-10-30T12:00:00Z' }), false);
  assert.equal(avisarMudancaDeComo({ ...e, status: 'realizada' }), false);
  assert.equal(avisarMudancaDeComo({ status: 'aberta' }), false);
});
