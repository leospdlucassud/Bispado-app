// Modo demonstração: dados fictícios e o servidor que roda no navegador — `npm test`.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gerar } from '../js/demo-dados.js';
import { criarServidor } from '../js/demo-servidor.js';
import {
  TIPOS_DOMINGO, chavePessoa, ehDomingo, estadoDaVaga, grupoAuto, indiceDoQuadro, membroDaChave, nomeNatural,
} from '../js/discursos-regras.js';

const HOJE = '2026-10-12';
const DATAS = ['2026-10-12', '2026-10-11', '2026-12-28', '2027-01-01', '2026-03-31', '2026-07-05'];

test('a carga é a mesma para o mesmo dia (dá para ensaiar)', () => {
  assert.deepEqual(gerar(HOJE), gerar(HOJE));
  for (const d of DATAS) assert.doesNotThrow(() => gerar(d), d);
});

test('contatos só fictícios: telefone 90000 e e-mail example.com', () => {
  for (const d of DATAS) {
    const { roster } = gerar(d).membros;
    for (const m of roster) {
      assert.ok(m.telefone === '' || /^\(63\) 90000-\d{4}$/.test(m.telefone) || m.telefone === '9000-0012', m.telefone);
      assert.ok(m.email === '' || m.email.endsWith('@example.com'), m.email);
    }
  }
  const textos = JSON.stringify(gerar(HOJE));
  for (const tel of textos.match(/\(\d\d\) \d{4,5}-\d{4}/g) || []) assert.ok(tel.includes('90000'), tel);
});

test('a história é uma só: quem tem entrevista, discurso ou ajuste está no quadro', () => {
  for (const d of DATAS) {
    const { colecoes, membros } = gerar(d);
    const nomes = new Set(membros.roster.map(m => m.name));
    for (const e of colecoes.agenda) assert.ok(nomes.has(e.membro), e.membro);
    const indice = indiceDoQuadro(membros.roster, []);
    for (const s of colecoes.sacramentais) {
      for (const n of [1, 2, 3]) {
        const nome = s['orador' + n];
        if (!nome || s['orador' + n + 'Fora']) continue;
        assert.ok(membroDaChave(chavePessoa(nome), indice), `${s.data} ${n}º: ${nome}`);
        assert.equal(s['orador' + n + 'Chave'], chavePessoa(nome));
      }
    }
    for (const o of colecoes.oradores) assert.ok(membroDaChave(o.chave, indice), o.nome);
    for (const id of membros.saidos) assert.ok(membros.roster.some(m => m.id === id));
  }
});

test('cada domingo é domingo, uma vez só, com tipo válido', () => {
  for (const d of DATAS) {
    const sac = gerar(d).colecoes.sacramentais;
    const datas = sac.map(s => s.data);
    assert.equal(new Set(datas).size, datas.length, 'domingo repetido');
    for (const s of sac) {
      assert.ok(ehDomingo(s.data), s.data);
      assert.ok(!s.tipo || Object.prototype.hasOwnProperty.call(TIPOS_DOMINGO, s.tipo), s.tipo);
    }
    assert.ok(sac.some(s => s.tipo === 'jejum'), 'nenhum domingo de jejum');
  }
});

test('os próximos domingos mostram todos os estados de vaga', () => {
  const sac = gerar(HOJE).colecoes.sacramentais.filter(s => s.data >= HOJE);
  const estados = new Set(sac.flatMap(s => [1, 2, 3].map(n => estadoDaVaga(s, n, HOJE))));
  for (const e of ['aceito', 'convidado', 'recusou', 'a-convidar', 'fora', 'dispensada', 'vazia']) assert.ok(estados.has(e), e);
});

test('o quadro tem gente de todos os grupos do rodízio', () => {
  const grupos = new Set(gerar(HOJE).membros.roster.map(m => grupoAuto(m, HOJE)));
  for (const g of ['primaria', 'rapazes', 'mocas', 'ss', 'quorum']) assert.ok(grupos.has(g), g);
});

test('a agenda cobre os estados da entrevista e do convite', () => {
  const ag = gerar(HOJE).colecoes.agenda;
  for (const st of ['pendente', 'agendada', 'realizada', 'nao-realizada']) assert.ok(ag.some(e => e.status === st), st);
  assert.ok(ag.some(e => e.confirmacao === 'confirmado'));
  assert.ok(ag.some(e => e.confirmacao === 'reagendar' && e.sugestaoData));
  assert.ok(ag.some(e => e.convidadoEm && !e.confirmacao), 'convite sem resposta');
  assert.ok(ag.some(e => e.sigiloso) && ag.some(e => e.acompanhar));
  assert.ok(ag.some(e => e.data === HOJE), 'entrevista hoje');
});

// ---------- o servidor ----------
const armazem = (inicial = {}) => {
  const m = new Map(Object.entries(inicial).map(([k, v]) => [k, structuredClone(v)]));
  return { ler: k => (m.has(k) ? structuredClone(m.get(k)) : null), gravar: (k, v) => m.set(k, structuredClone(v)) };
};
const pedir = (srv, metodo, caminho, corpo) => srv.atender(new Request('http://local' + caminho, {
  method: metodo, headers: { 'Content-Type': 'application/json' }, body: corpo === undefined ? undefined : JSON.stringify(corpo),
}));

test('CRUD comum: cria, lê, altera sem trocar o id, exclui', async () => {
  const srv = criarServidor(armazem());
  const c = await (await pedir(srv, 'POST', '/api/designacoes', { tarefa: 'x', id: 'falso' })).json();
  assert.ok(c.id && c.id !== 'falso' && c.criadoEm);
  const r = await pedir(srv, 'PUT', '/api/designacoes?id=' + c.id, { status: 'concluido', id: 'outro' });
  assert.equal((await r.json()).id, c.id);
  assert.equal((await (await pedir(srv, 'PUT', '/api/designacoes?id=nao-existe', { a: 1 })).status), 404);
  await pedir(srv, 'DELETE', '/api/designacoes?id=' + c.id);
  assert.deepEqual(await (await pedir(srv, 'GET', '/api/designacoes')).json(), []);
});

test('domingo: o POST junta pela data e a trava protege a vaga de outra pessoa', async () => {
  const srv = criarServidor(armazem({ sacramentais: [
    { id: 's1', data: '2026-10-18', orador1: 'Ana Souza', orador1Chave: 'ana souza', orador1Status: 'convidado' }] }));
  const junta = await (await pedir(srv, 'POST', '/api/sacramentais', { data: '2026-10-18', orador1: 'Bruno Lima', primeiroHino: '3' })).json();
  assert.equal(junta.id, 's1');
  assert.equal(junta.orador1, 'Ana Souza');
  assert.deepEqual(junta._descartados, [1]);
  assert.equal(junta.primeiroHino, '3');
  const velho = await (await pedir(srv, 'PUT', '/api/sacramentais?id=s1', { orador1Status: 'aceito', _vaga1: 'gil teste' })).json();
  assert.deepEqual(velho._descartados, [1]);
  const lista = await (await pedir(srv, 'GET', '/api/sacramentais')).json();
  assert.equal(lista.length, 1);
  assert.equal(lista[0].orador1Status, 'convidado');
});

test('membros, notas e erros', async () => {
  const srv = criarServidor(armazem());
  assert.deepEqual(await (await pedir(srv, 'GET', '/api/membros')).json(),
    { movimentacoes: [], saidos: [], adicionados: [], roster: null, rosterAtualizadoEm: null });
  await pedir(srv, 'POST', '/api/membros', { saidos: [3] });
  assert.deepEqual((await (await pedir(srv, 'GET', '/api/membros')).json()).saidos, [3]);
  const n = await (await pedir(srv, 'POST', '/api/notas', { texto: 'oi' })).json();
  assert.ok(n.id.startsWith('n_') && n.criadaEm);
  assert.equal((await pedir(srv, 'GET', '/api/nada')).status, 404);
  const torto = await srv.atender(new Request('http://local/api/agenda', { method: 'POST', body: '{' }));
  assert.equal(torto.status, 400);
});

test('convite: a tela do membro vê só o primeiro nome e responde pela regra do servidor', async () => {
  const { colecoes } = gerar(HOJE);
  const agenda = colecoes.agenda.map((e, i) => ({ id: 'a' + i, ...e }));
  const srv = criarServidor(armazem({ agenda }));
  const i = agenda.findIndex(e => e.status === 'agendada' && !e.confirmacao && !e.sigiloso);
  const visto = await (await pedir(srv, 'GET', '/api/convite?id=a' + i)).json();
  assert.equal(visto.nome, nomeNatural(agenda[i].membro).split(' ')[0]);
  assert.ok(!('obs' in visto) && !('membro' in visto));
  const r = await (await pedir(srv, 'PUT', '/api/convite?id=a' + i, { resposta: 'confirmado' })).json();
  assert.equal(r.confirmacao, 'confirmado');
  const salvo = (await (await pedir(srv, 'GET', '/api/agenda')).json())[i];
  assert.equal(salvo.status, 'agendada');
  const feita = agenda.findIndex(e => e.status === 'realizada');
  assert.equal((await pedir(srv, 'PUT', '/api/convite?id=a' + feita, { resposta: 'confirmado' })).status, 409);
});

// ---------- achados da revisão ----------
import { partesDoNascimento } from '../js/utils.js';

test('domingo de conferência geral sem ata (não há reunião na ala)', () => {
  for (const d of DATAS) {
    for (const s of gerar(d).colecoes.sacramentais.filter(x => x.tipo === 'conf-geral')) {
      assert.deepEqual(Object.keys(s).sort(), ['data', 'tipo'], s.data);
    }
  }
});

test('eventos do calendário fictício nunca no domingo', () => {
  for (const d of DATAS) for (const e of gerar(d).colecoes.eventos_extras) assert.ok(!ehDomingo(e.data), e.data + ' ' + e.txt);
});

test('nascimento sempre uma data que existe (nada de 29/02 em ano comum)', () => {
  for (let i = 0; i < 366 * 3; i += 1) {
    const d = new Date(2027, 0, 1 + i);
    const dk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    for (const m of gerar(dk).membros.roster) {
      const p = partesDoNascimento(m.nascimento);
      assert.ok(p, m.nascimento);
      const t = new Date(p.a, p.m - 1, p.d);
      assert.equal(t.getDate(), p.d, `${dk}: ${m.nascimento}`);
    }
  }
});

test('convite: resposta sempre no passado e depois do envio', () => {
  for (const d of DATAS) {
    for (const e of gerar(d).colecoes.agenda.filter(x => x.confirmadoEm)) {
      assert.ok(e.confirmadoEm.slice(0, 10) < d, `${d} ${e.membro}: ${e.confirmadoEm}`);
      assert.ok(!e.convidadoEm || e.convidadoEm < e.confirmadoEm, e.membro);
    }
  }
});
