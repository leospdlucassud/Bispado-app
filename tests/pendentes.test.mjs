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

// ---------- coleções com campo único (domingo por data, orador por chave) ----------
const comSac = () => ({
  sacramentais: [{ id: '10', data: '2026-10-18', orador1: 'Ana Souza', orador1Status: 'aceito', primeiroHino: '' }],
  oradores: [{ id: '20', chave: 'ana souza', nome: 'Ana Souza', grupo: '' }],
});
const sacOrad = new Set(['sacramentais', 'oradores']);

test('POST de domingo que já existe junta no registro, sem trocar a vaga de outra pessoa', () => {
  const d = comSac();
  const fila = [{ url: '/api/sacramentais', method: 'POST', ts: 100,
    body: { data: '2026-10-18', orador1: 'Bruno Lima', orador1Status: 'planejado', primeiroHino: '3' } }];
  assert.equal(aplicarPendentes(d, fila, sacOrad), 1);
  assert.equal(d.sacramentais.length, 1);
  assert.equal(d.sacramentais[0].id, '10');
  assert.equal(d.sacramentais[0].orador1, 'Ana Souza');
  assert.equal(d.sacramentais[0].primeiroHino, '3');
  assert.ok(!d.sacramentais.some(s => String(s.id).startsWith('local_')));
});

test('POST de domingo novo entra com o id provisório', () => {
  const d = comSac();
  const item = { url: '/api/sacramentais', method: 'POST', ts: 101, body: { data: '2026-10-25', tipo: 'jejum' } };
  aplicarPendentes(d, [item], sacOrad);
  assert.equal(d.sacramentais.find(s => s.data === '2026-10-25').id, idProvisorio(item));
});

test('PUT para o id provisório vale para o registro em que a criação foi juntada', () => {
  const d = comSac();
  const post = { url: '/api/sacramentais', method: 'POST', ts: 100, body: { data: '2026-10-18', tema1: 'Fé' } };
  const put = { url: '/api/sacramentais?id=' + idProvisorio(post), method: 'PUT', ts: 110, body: { hinoFinal: '9' } };
  aplicarPendentes(d, [post, put], sacOrad);
  assert.equal(d.sacramentais[0].tema1, 'Fé');
  assert.equal(d.sacramentais[0].hinoFinal, '9');
});

test('ajuste do rodízio (oradores) é reaplicado', () => {
  const d = comSac();
  aplicarPendentes(d, [{ url: '/api/oradores?id=20', method: 'PUT', ts: 1, body: { grupo: 'jas' } }], sacOrad);
  assert.equal(d.oradores[0].grupo, 'jas');
});
