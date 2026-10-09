// Fila de alterações pendentes reaplicada sobre o que veio do servidor.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aplicarPendentes, idProvisorio } from '../js/pendentes.js';

const servidor = () => ({
  agenda: [{ id: '1', membro: 'Ana', obs: '' }, { id: '2', membro: 'Bruno' }],
  reunioes: [],
});
const todas = new Set(['agenda', 'reunioes']);

test('criação sem sinal continua na tela depois da atualização', () => {
  const d = servidor();
  const fila = [{ url: '/api/agenda', method: 'POST', body: { membro: 'Carla' }, ts: 100 }];
  assert.equal(aplicarPendentes(d, fila, todas), 1);
  assert.deepEqual(d.agenda.at(-1), { membro: 'Carla', id: idProvisorio(fila[0]) });
});

test('reaplicar duas vezes não duplica a criação', () => {
  const d = servidor();
  const fila = [{ url: '/api/agenda', method: 'POST', body: { membro: 'Carla' }, ts: 100 }];
  aplicarPendentes(d, fila, todas);
  aplicarPendentes(d, fila, todas);
  assert.equal(d.agenda.filter(e => e.membro === 'Carla').length, 1);
});

test('edição e exclusão pendentes valem por cima do servidor, na ordem', () => {
  const d = servidor();
  const fila = [
    { url: '/api/agenda?id=1', method: 'PUT', body: { obs: 'segunda' }, ts: 200 },
    { url: '/api/agenda?id=1', method: 'PUT', body: { obs: 'primeira' }, ts: 100 },
    { url: '/api/agenda?id=2', method: 'DELETE', body: null, ts: 150 },
  ];
  aplicarPendentes(d, fila, todas);
  assert.equal(d.agenda.find(e => e.id === '1').obs, 'segunda');
  assert.equal(d.agenda.find(e => e.id === '2'), undefined);
});

test('coleção que não veio do servidor não é tocada', () => {
  const d = servidor();
  const fila = [{ url: '/api/agenda', method: 'POST', body: { membro: 'Carla' }, ts: 100 }];
  assert.equal(aplicarPendentes(d, fila, new Set(['reunioes'])), 0);
  assert.equal(d.agenda.length, 2);
});

test('itens estranhos na fila são ignorados', () => {
  const d = servidor();
  const fila = [null, { url: '/api/membros', method: 'POST', body: {}, ts: 1 }, { method: 'PUT', ts: 2 }, { url: '::', method: 'PUT', ts: 3 }];
  assert.equal(aplicarPendentes(d, fila, todas), 0);
});
