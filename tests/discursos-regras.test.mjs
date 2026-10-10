// Regras do rodízio de discursos — rodar com `npm test`. Só nomes fictícios.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assinaturaConvite, camposAoTrocarOrador, chavePessoa, diffCampos, docOrador, ehDomingo, estadoDaVaga,
  fundirDomingo, grupoAuto, grupoDe, grupoDoBancoAntigo, hashEstavel, historicoDiscursos, indiceDoQuadro,
  membroDaChave, mensagemDiscurso, mesesEntre, minutosDaVaga, montarPessoas, nomeCurto, nomeNatural,
  parecidos, pendenciasDiscurso, primeiroNomeDe, proximoDomingo, proximosDomingos, quandoPorExtenso,
  resumoDomingo, somaMinutos, sugerirParaVaga, tipoProvavel,
} from '../js/discursos-regras.js';

const ANA = 'Fictícia Souza, Ana Beatriz';
const BRUNO = 'Exemplo Lima, Bruno';

test('nome em ordem natural, curto e primeiro nome', () => {
  assert.equal(nomeNatural(ANA), 'Ana Beatriz Fictícia Souza');
  assert.equal(nomeNatural('Ana Souza'), 'Ana Souza');
  assert.equal(nomeCurto(ANA), 'Ana Souza');
  assert.equal(primeiroNomeDe('Irmã Ana Souza'), 'Ana');
});

test('a chave da pessoa ignora formato, acento, tratamento e partículas', () => {
  const k = chavePessoa(ANA);
  assert.equal(chavePessoa('Irmã Ana Beatriz Ficticia Souza'), k);
  assert.equal(chavePessoa('ana  beatriz fictícia souza'), k);
  assert.equal(chavePessoa('Exemplo da Lima, Bruno'), chavePessoa('Bruno Exemplo Lima'));
  assert.notEqual(chavePessoa('Ana Souza'), chavePessoa('Ana Beatriz Souza'));
  assert.equal(chavePessoa(''), '');
});

test('telefone só de um membro único; parecido é só sugestão', () => {
  const quadro = [{ id: 1, name: ANA }, { id: 2, name: BRUNO }, { id: 3, name: BRUNO }];
  const ind = indiceDoQuadro(quadro);
  assert.equal(membroDaChave(chavePessoa(ANA), ind).id, 1);
  assert.equal(membroDaChave(chavePessoa(BRUNO), ind), null);       // homônimos
  assert.equal(membroDaChave('ninguem aqui', ind), null);
  assert.ok(parecidos('Ana Souza', ind).some(m => m.name === ANA));
  assert.deepEqual(parecidos('Bia Souza', ind), []);
});

test('datas por partes, sem cair no dia anterior', () => {
  assert.equal(ehDomingo('2026-10-11'), true);
  assert.equal(ehDomingo('2026-10-14'), false);
  assert.equal(ehDomingo('2026-02-30'), false);
  assert.equal(ehDomingo('lixo'), false);
  assert.equal(proximoDomingo('2026-10-14'), '2026-10-18');
  assert.equal(proximoDomingo('2026-10-18'), '2026-10-18');
  assert.equal(proximoDomingo('2026-12-28'), '2027-01-03');
  assert.deepEqual(proximosDomingos('2026-10-17', 3), ['2026-10-18', '2026-10-25', '2026-11-01']);
  assert.equal(mesesEntre('2026-05-12', '2026-10-11'), 4);
});

test('o tipo provável só pergunta no 1º domingo', () => {
  assert.equal(tipoProvavel('2026-11-01'), 'jejum');
  assert.equal(tipoProvavel('2026-10-04'), 'conf-geral');
  assert.equal(tipoProvavel('2026-04-05'), 'conf-geral');
  assert.equal(tipoProvavel('2026-10-11'), '');
});

test('data por extenso para a mensagem', () => {
  assert.equal(quandoPorExtenso('2026-10-18', '', '2026-10-09'), 'domingo, 18 de outubro');
  assert.equal(quandoPorExtenso('2027-01-03', '09:00', '2026-12-20'), 'domingo, 3 de janeiro de 2027, às 9h');
  assert.ok(quandoPorExtenso('2026-10-18', '19:30', '2026-10-09').endsWith(', às 19h30'));
});

test('grupo automático pelo sexo e pelo ano de nascimento', () => {
  assert.equal(grupoAuto({ gender: 'F', nascimento: '15 mar 2015' }, '2026-10-18'), 'primaria');
  assert.equal(grupoAuto({ gender: 'F', nascimento: '20 dez 2014' }, '2026-01-11'), 'mocas');   // janeiro do ano em que faz 12
  assert.equal(grupoAuto({ gender: 'M', nascimento: '01 jan 2008' }, '2026-10-18'), 'quorum');
  assert.equal(grupoAuto({ gender: 'M', age: 0 }, '2026-10-18'), 'outros');
  assert.equal(grupoAuto({ gender: 'M', age: 15 }, '2026-10-18'), 'rapazes');
});

test('grupo manual vence; "membros novos" vale 12 meses', () => {
  const m = { gender: 'F', nascimento: '01 jan 1990' };
  assert.equal(grupoDe(m, { grupo: 'novos', grupoEm: '2025-09-01' }, '2026-10-18'), 'ss');
  assert.equal(grupoDe(m, { grupo: 'novos', grupoEm: '2025-11-30' }, '2026-10-18'), 'novos');
  assert.equal(grupoDe(m, { grupo: 'jas' }, '2026-10-18'), 'jas');
});

const vaga = (extra = {}) => ({ data: '2026-10-18', orador1: 'Ana Souza', orador1Chave: chavePessoa('Ana Souza'), ...extra });
const HOJE = '2026-10-09';

test('estado da vaga', () => {
  assert.equal(estadoDaVaga({ data: '2026-10-18' }, 1, HOJE), 'vazia');
  assert.equal(estadoDaVaga({ data: '2026-10-18', orador1Status: 'dispensada' }, 1, HOJE), 'dispensada');
  assert.equal(estadoDaVaga(vaga({ orador1Status: 'planejado' }), 1, HOJE), 'a-convidar');
  assert.equal(estadoDaVaga({ data: '2026-10-18', orador1: 'Ana Souza' }, 1, HOJE), 'a-convidar');
  assert.equal(estadoDaVaga(vaga({ orador1Status: 'convidado' }), 1, HOJE), 'convidado');
  assert.equal(estadoDaVaga(vaga({ orador1Status: 'aceito' }), 1, HOJE), 'aceito');
  assert.equal(estadoDaVaga(vaga({ orador1Status: 'recusou' }), 1, HOJE), 'recusou');
  assert.equal(estadoDaVaga(vaga({ orador1Fora: true }), 1, HOJE), 'fora');
  for (const st of ['aceito', 'convidado', 'planejado']) assert.equal(estadoDaVaga(vaga({ orador1Status: st }), 1, '2026-10-19'), 'realizado');
  assert.equal(estadoDaVaga(vaga({ orador1Status: 'recusou' }), 1, '2026-10-19'), 'recusou');
});

test('trava: o "Aceitou" de outra pessoa não passa para quem entrou no lugar', () => {
  const sac = { data: '2026-10-18', orador1: 'Bruno Lima', orador1Status: 'aceito', orador1Chave: chavePessoa('Ana Souza') };
  assert.equal(estadoDaVaga(sac, 1, HOJE), 'a-convidar');
});

test('trocar o orador zera o convite e não mexe em tema nem tempo', () => {
  const c = camposAoTrocarOrador(2, 'Ana Souza', { passado: false });
  assert.equal(c.orador2Status, 'planejado');
  assert.equal(c.orador2ConvidadoEm, '');
  assert.equal(c.orador2RespostaEm, '');
  assert.equal(c.orador2Por, '');
  assert.equal(c.orador2Chave, chavePessoa('Ana Souza'));
  assert.equal(camposAoTrocarOrador(2, 'Ana Souza', { passado: true }).orador2Status, '');
  const vazio = camposAoTrocarOrador(2, '');
  assert.equal(vazio.orador2, '');
  assert.equal(vazio.orador2Status, '');
  assert.equal(vazio.orador2Fora, false);
  assert.ok(!('tema2' in c) && !('orador2Min' in c));
});

test('diff só com o que mudou', () => {
  assert.deepEqual(diffCampos({ a: '1', b: '10', c: '' }, { a: '1', b: 10, c: undefined }), {});
  assert.deepEqual(diffCampos({ a: 'x' }, { a: 'y' }), { a: 'y' });
  assert.deepEqual(diffCampos({ f: false }, { f: true }), { f: true });
});

test('upsert do domingo não troca a vaga que outro aparelho preencheu', () => {
  const existente = { id: '1', data: '2026-10-18', orador1: 'Ana Souza', orador1Status: 'aceito', primeiroHino: '' };
  const r = fundirDomingo(existente, { data: '2026-10-18', orador1: 'Bruno Lima', orador1Status: 'planejado', primeiroHino: '3' });
  assert.deepEqual(r.descartados, [1]);
  assert.equal(r.registro.orador1, 'Ana Souza');
  assert.equal(r.registro.orador1Status, 'aceito');
  assert.equal(r.registro.primeiroHino, '3');
  assert.equal(fundirDomingo(existente, { orador1: 'Irmã Ana Souza', tema1: 'Fé' }).registro.tema1, 'Fé');
  assert.equal(fundirDomingo({ data: 'x' }, { orador1: 'Bruno Lima' }).registro.orador1, 'Bruno Lima');
});

test('histórico vem dos domingos válidos, sem recusas nem domingos sem rodízio', () => {
  const lista = [
    { data: '2026-09-06', orador1: 'Ana Souza', tipo: 'jejum' },
    { data: '2026-09-13', orador1: 'Ana Souza', orador2: 'Bruno Lima', orador2Chave: chavePessoa('Bruno Lima'), orador2Status: 'recusou' },
    { data: '2026-09-13', orador1: 'Carla Teste' },                 // duplicata: vale a primeira
    { data: '2026-09-16', orador1: 'Carla Teste' },                 // quarta-feira
    { data: '2026-09-20', orador3: 'Visitante Exemplo', orador3Fora: true },
    { data: '2026-09-27', orador1: 'Dora Teste', orador1Status: 'dispensada' },
    { data: '2026-10-18', orador2: 'Ana Souza', orador2Chave: chavePessoa('Ana Souza'), orador2Status: 'aceito' },
    { data: 'lixo', orador1: 'Ana Souza' },
  ];
  const h = historicoDiscursos(lista, HOJE);
  const ana = h.get(chavePessoa('Ana Souza'));
  assert.deepEqual(ana.discursos.map(d => d.data), ['2026-09-13']);
  assert.deepEqual(ana.planejadas.map(p => [p.data, p.n, p.estado]), [['2026-10-18', 2, 'aceito']]);
  assert.equal(h.has(chavePessoa('Bruno Lima')), false);
  assert.equal(h.has(chavePessoa('Carla Teste')), false);
  assert.equal(h.has(chavePessoa('Visitante Exemplo')), false);
});

test('pool do rodízio com e sem quadro', () => {
  const historico = historicoDiscursos([{ data: '2026-09-13', orador1: 'Bruno Lima' }], HOJE);
  const semQuadro = montarPessoas({ oradores: [{ chave: chavePessoa('Carla Teste'), nome: 'Carla Teste' }], historico, hojeKey: HOJE });
  assert.ok(semQuadro.has(chavePessoa('Bruno Lima')) && semQuadro.has(chavePessoa('Carla Teste')));

  const membros = [
    { id: 1, name: ANA, gender: 'F', nascimento: '03 fev 1990' },
    { id: 2, name: 'Lima, Bruno', gender: 'M', nascimento: '03 fev 1990' },
    { id: 3, name: 'Criança, Pequena', gender: 'F', nascimento: '03 fev 2021' },
    { id: 4, name: 'Repetido, Nome', gender: 'M' }, { id: 5, name: 'Repetido, Nome', gender: 'M' },
  ];
  const p = montarPessoas({ membros, saidos: [2], oradores: [{ chave: chavePessoa(ANA), ultimoManual: '2026-10-01' }], historico, hojeKey: HOJE });
  assert.equal(p.has(chavePessoa('Bruno Lima')), false);           // saiu da ala, nem pelo histórico
  assert.equal(p.has(chavePessoa('Pequena Criança')), false);      // menos de 8 anos
  assert.equal(p.get(chavePessoa(ANA)).ultimo.data, '2026-10-01');
  const rep = p.get(chavePessoa('Nome Repetido'));
  assert.equal(rep.membro, null);
  assert.equal(rep.homonimos, 2);
});

test('sugestões para a vaga', () => {
  const hoje = '2026-10-09', dk = '2026-10-18';
  const mk = (nome, grupo, extra = {}) => ({ chave: chavePessoa(nome), nome, grupo, ultimo: null, planejadas: [], ajuste: null, ...extra });
  const pessoas = [
    mk('Ana Jovem', 'mocas'),
    mk('Bruno Adulto', 'quorum'),
    mk('Carla Recente', 'ss', { ultimo: { data: '2026-07-12', n: 2 } }),
    mk('Dora Pausada', 'ss', { ajuste: { pausaAte: '2027-01-01' } }),
    mk('Eva Primaria', 'primaria'),
    mk('Fabio Prefere', 'quorum', { ajuste: { posicao: '1' } }),
    mk('Gil Ocupado', 'quorum'),
  ];
  const ocupadas = new Map([[chavePessoa('Gil Ocupado'), [{ data: '2026-10-25', n: 2 }]]]);
  const s1 = sugerirParaVaga({ pessoas, dk, n: 1, ocupadas, filtro: 'sugeridos' });
  const nomes1 = s1.lista.map(i => i.pessoa.nome);
  assert.ok(!nomes1.includes('Dora Pausada') && !nomes1.includes('Eva Primaria') && !nomes1.includes('Gil Ocupado'));
  assert.deepEqual(s1.recentes.map(i => i.pessoa.nome), ['Carla Recente']);
  assert.ok(['Ana Jovem', 'Fabio Prefere'].includes(nomes1[0]));
  const s2 = sugerirParaVaga({ pessoas, dk, n: 2, ocupadas, filtro: 'sugeridos' });
  assert.equal(s2.lista[0].pessoa.nome, 'Bruno Adulto');
  const todos = sugerirParaVaga({ pessoas, dk, n: 2, ocupadas, filtro: 'todos' });
  assert.ok(todos.lista.find(i => i.pessoa.nome === 'Gil Ocupado').ocupada);
  assert.deepEqual(sugerirParaVaga({ pessoas, dk, n: 2, filtro: 'primaria' }).lista.map(i => i.pessoa.nome), ['Eva Primaria']);
  // a organização que já tem vaga no domingo desce
  const doisAdultos = [mk('Ivo Quorum', 'quorum'), mk('Hana Socorro', 'ss')];
  for (const g of ['quorum', 'ss']) {
    const r = sugerirParaVaga({ pessoas: doisAdultos, dk, n: 2, gruposNoDomingo: new Set([g]), filtro: 'adultos' });
    assert.notEqual(r.lista[0].pessoa.grupo, g);
  }
  assert.deepEqual(sugerirParaVaga({ pessoas, dk, n: 3 }).lista.map(i => i.pessoa.nome),
    sugerirParaVaga({ pessoas, dk, n: 3 }).lista.map(i => i.pessoa.nome));
  assert.notEqual(hashEstavel('a'), hashEstavel('b'));
  void hoje;
});

const MSG = { n: 2, dk: '2026-10-18', minutos: 10, assinatura: 'o bispado da Ala Exemplo', hojeKey: '2026-10-09' };

test('mensagem do convite: concordância, menor, tema e privacidade', () => {
  const f = mensagemDiscurso({ ...MSG, nome: ANA, genero: 'F' });
  assert.ok(f.startsWith('Olá, irmã Ana!'));
  assert.ok(f.includes('convidá-la') && f.includes('a 2ª oradora') && f.includes('cerca de 10 minutos'));
  const m = mensagemDiscurso({ ...MSG, nome: BRUNO, genero: 'M' });
  assert.ok(m.includes('irmão') && m.includes('convidá-lo') && m.includes('o 2º orador'));
  assert.ok(mensagemDiscurso({ ...MSG, nome: 'Carla' }).includes('convidar você para fazer o 2º discurso'));
  const menor = mensagemDiscurso({ ...MSG, nome: ANA, genero: 'F', menor: true });
  assert.ok(menor.startsWith('Olá!') && menor.includes('convidar a Ana') && menor.includes('Ela teria'));
  assert.ok(f.includes('Sobre o tema, conversamos'));
  assert.ok(mensagemDiscurso({ ...MSG, nome: ANA, genero: 'F', tema: 'A oração' }).includes('Tema: "A oração".'));
  assert.ok(!f.includes(' às '));
  const lembrete = mensagemDiscurso({ ...MSG, tipo: 'lembrete', nome: ANA, genero: 'F' });
  assert.ok(lembrete.includes('lembrar') && lembrete.includes('a 2ª oradora'));
  assert.ok(mensagemDiscurso({ ...MSG, tipo: 'lembrete', nome: ANA, genero: 'F', menor: true }).includes('da Ana'));
  for (const t of [f, m, menor, lembrete]) {
    assert.ok(!/\d{8,}/.test(t));
    assert.ok(!t.includes('Souza') && !t.includes('Fictícia'));
  }
});

test('assinatura do convite', () => {
  assert.equal(assinaturaConvite('', '', 'Ala X'), 'o bispado da Ala X');
  assert.equal(assinaturaConvite('bispo', 'Exemplo', 'Ala X'), 'o Bispo Exemplo, da Ala X');
  assert.equal(assinaturaConvite('bispo', '', 'Ala X'), 'o bispo da Ala X');
  assert.equal(assinaturaConvite('c1', 'Teste', 'Ala X'), 'o irmão Teste, 1º conselheiro do bispado da Ala X');
  assert.equal(assinaturaConvite('sec', '', 'Ala X'), 'o secretário da Ala X');
  assert.equal(assinaturaConvite('se', 'Teste', 'Ala X'), 'o irmão Teste, secretário executivo da Ala X');
});

test('tempo da vaga e soma', () => {
  assert.deepEqual([1, 2, 3].map(n => minutosDaVaga({}, n)), [5, 10, 15]);
  assert.equal(minutosDaVaga({ orador1Min: '12' }, 1), 12);
  for (const v of [0, 99, 'abc']) assert.equal(minutosDaVaga({ orador1Min: v }, 1), 5);
  assert.equal(somaMinutos({ orador3Status: 'dispensada' }), 15);
  assert.equal(somaMinutos({ tipo: 'jejum' }), 0);
});

test('resumo do domingo no Início', () => {
  assert.equal(resumoDomingo({ tipo: 'jejum' }, '2026-10-18', HOJE), 'Jejum e testemunhos — sem oradores designados');
  assert.ok(resumoDomingo({ tipo: 'conf-estaca' }, '2026-10-18', HOJE).endsWith('sem reunião na ala'));
  const k = n => chavePessoa(n);
  const misto = { orador1: 'Ana Souza', orador1Chave: k('Ana Souza'), orador1Status: 'aceito',
    orador2: 'Bruno Lima', orador2Chave: k('Bruno Lima'), orador2Status: 'convidado' };
  assert.equal(resumoDomingo(misto, '2026-10-18', HOJE), '✅ 1 confirmado · ⏳ 1 aguardando resposta · ⚠️ 1 vaga aberta');
  assert.equal(resumoDomingo({ ...misto, orador2Status: 'aceito', orador3Status: 'dispensada' }, '2026-10-18', HOJE), '✅ os 2 oradores confirmados');
  const todos = { ...misto, orador2Status: 'aceito', orador3: 'Carla Teste', orador3Chave: k('Carla Teste'), orador3Status: 'aceito' };
  assert.equal(resumoDomingo(todos, '2026-10-18', HOJE), '✅ os 3 oradores confirmados');
});

test('pendências de discurso para o Início', () => {
  const hoje = '2026-10-09';
  const agora = Date.parse('2026-10-09T15:00:00Z');
  const k = n => chavePessoa(n);
  const lista = [
    { data: '2026-10-11', orador1: 'Ana Souza', orador1Chave: k('Ana Souza'), orador1Status: 'recusou',
      orador2: 'Bruno Lima', orador2Chave: k('Bruno Lima'), orador2Status: 'convidado', orador2ConvidadoEm: '2026-10-08T12:00:00Z',
      orador3Status: 'dispensada' },
    { data: '2026-10-18', orador1: 'Carla Teste', orador1Chave: k('Carla Teste'), orador1Status: 'convidado', orador1ConvidadoEm: '2026-10-08T12:00:00Z' },
    { data: '2026-10-25', orador1: 'Dora Teste', orador1Chave: k('Dora Teste'), orador1Status: 'convidado', orador1ConvidadoEm: '2026-10-05T12:00:00Z' },
    { data: '2026-11-01', tipo: '' },
    { data: '2026-11-08', tipo: 'jejum' },
  ];
  const p = pendenciasDiscurso(lista, hoje, agora);
  const de = dk => p.filter(x => x.dk === dk).map(x => x.tipo);
  assert.deepEqual(de('2026-10-11'), ['recusou', 'sem-resposta']);   // domingo a 2 dias: cobra mesmo com 1 dia
  assert.deepEqual(de('2026-10-18'), ['vagas']);                    // convite de 1 dia, domingo a 9 dias: ainda não
  assert.deepEqual(de('2026-10-25'), ['sem-resposta', 'vagas']);
  assert.deepEqual(de('2026-11-01'), []);                           // a 23 dias: além da janela de 21
  assert.deepEqual(p.map(x => x.dk), [...p.map(x => x.dk)].sort());
  // perto, o 1º domingo sem tipo gera só a pergunta; jejum não cobra nada
  const perto = pendenciasDiscurso(lista, '2026-10-20', agora);
  assert.deepEqual(perto.filter(x => x.dk === '2026-11-01').map(x => x.tipo), ['tipo']);
  assert.deepEqual(perto.filter(x => x.dk === '2026-11-08').map(x => x.tipo), []);
});

test('documento do rodízio só com a lista branca', () => {
  const hoje = '2026-10-09';
  const r = docOrador({ nome: ANA, grupo: 'novos', posicao: '2', ultimo: '2026-05-10', pausa: '3', telefone: '63999990000', motivo: 'x', obs: 'y' }, null, hoje);
  assert.deepEqual(Object.keys(r.campos).sort(), ['chave', 'grupo', 'grupoEm', 'nome', 'pausaAte', 'posicao', 'ultimoManual']);
  assert.equal(r.campos.pausaAte, '2027-01-09');
  assert.equal(r.campos.grupoEm, hoje);
  assert.equal(r.campos.nome, 'Ana Beatriz Fictícia Souza');
  assert.equal(r.padrao, false);
  assert.equal(docOrador({ nome: ANA }, null, hoje).padrao, true);
  assert.equal(docOrador({ nome: ANA, ultimo: '2030-01-01' }, null, hoje).campos.ultimoManual, '');
});

test('grupos do antigo banco de oradores', () => {
  assert.equal(grupoDoBancoAntigo('quorum'), 'quorum');
  assert.equal(grupoDoBancoAntigo('socsoc'), 'ss');
  assert.equal(grupoDoBancoAntigo('jovens'), '');
  assert.equal(grupoDoBancoAntigo('outros'), '');
});

// ---------- correções da revisão ----------
import { chaveEstrita, haMeses } from '../js/discursos-regras.js';

test('Elder e Irma são prenomes: não saem do nome do LCR (nem sem acento, digitados)', () => {
  assert.equal(primeiroNomeDe('Exemplo, Elder'), 'Elder');
  assert.equal(primeiroNomeDe('Teste, Irma'), 'Irma');
  assert.equal(chavePessoa('Exemplo, Elder'), 'elder exemplo');
  assert.equal(chavePessoa('Irma Teste'), 'irma teste');
  assert.equal(chavePessoa('Élder Exemplo'), 'exemplo');           // com acento é tratamento
  assert.equal(chavePessoa('Irmã Ana Souza'), chavePessoa('Souza, Ana'));
  const m = mensagemDiscurso({ n: 2, dk: '2026-10-18', minutos: 10, assinatura: 'o bispado', hojeKey: '2026-10-09', nome: 'Exemplo, Elder', genero: 'M' });
  assert.ok(m.startsWith('Olá, irmão Elder!') && !m.includes('Exemplo'));
});

test('chave estrita separa "Maria de Souza" de "Maria Souza"', () => {
  assert.equal(chavePessoa('Maria de Souza'), chavePessoa('Maria Souza'));
  assert.notEqual(chaveEstrita('Maria de Souza'), chaveEstrita('Maria Souza'));
  assert.equal(chaveEstrita('Irmã Maria de Souza'), chaveEstrita('Souza, Maria de'));
});

test('upsert com a mesma pessoa não rebaixa o convite nem apaga o tema', () => {
  const k = chavePessoa('Ana Souza');
  const existente = { id: '1', data: '2026-11-15', orador1: 'Ana Souza', orador1Chave: k, orador1Status: 'convidado',
    orador1ConvidadoEm: '2026-10-09T10:00:00Z', orador1Por: 'bispo', tema1: 'A oração', orador1Min: 5 };
  const corpo = { data: '2026-11-15', ...camposAoTrocarOrador(1, 'Ana Souza'), tema1: '', orador1Min: 5 };
  const r = fundirDomingo(existente, corpo).registro;
  assert.equal(r.orador1Status, 'convidado');
  assert.equal(r.orador1ConvidadoEm, '2026-10-09T10:00:00Z');
  assert.equal(r.orador1Por, 'bispo');
  assert.equal(r.tema1, 'A oração');
  assert.equal(estadoDaVaga(r, 1, '2026-10-09'), 'convidado');
  // um estado "maior" vindo do outro aparelho entra
  const aceito = fundirDomingo(existente, { orador1: 'Ana Souza', orador1Chave: k, orador1Status: 'aceito', orador1RespostaEm: 'x' }).registro;
  assert.equal(aceito.orador1Status, 'aceito');
});

test('POST com campos vazios (fila de versão antiga) não apaga a ata preenchida', () => {
  const existente = { id: '9', data: '2026-10-18', presidida: 'Bispo Exemplo', primeiroHino: '85', anuncios: 'x' };
  const r = fundirDomingo(existente, { data: '2026-10-18', presidida: '', primeiroHino: '', anuncios: '', frequencia: '120' }).registro;
  assert.equal(r.presidida, 'Bispo Exemplo');
  assert.equal(r.primeiroHino, '85');
  assert.equal(r.frequencia, '120');
});

test('textos no singular', () => {
  const k = chavePessoa('Ana Souza');
  const um = { orador1Status: 'dispensada', orador2Status: 'dispensada', orador3: 'Ana Souza', orador3Chave: k, orador3Status: 'aceito' };
  assert.equal(resumoDomingo(um, '2026-10-18', HOJE), '✅ o orador confirmado');
  assert.deepEqual([0, 1, 2, 7].map(haMeses), ['este mês', 'há 1 mês', 'há 2 meses', 'há 7 meses']);
});
