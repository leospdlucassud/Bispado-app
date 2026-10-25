// Aba "Vamos crescer a Ala": as contas que a tela desenha (js/crescimento-lcr.js)
// e o /api/crescimento — a regra do POST da function — `npm test`. Gente e números INVENTADOS: os relatórios
// de verdade do LCR são "Somente para uso da Igreja".
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MAX_CORPO_CRESCIMENTO, TIPO_RENOVACAO, aplicarPostCrescimento, destaqueDoRumo, docCrescimentoVazio,
  domingosSemFrequencia, fundirCrescimento, gradeFrequencia, gruposSemMarcacao, historicoDigitado,
  limparCorpoCrescimento, mesCurto, mudancasDaGrade, participantesSemNomes, piramideEtaria, progressoQualificacao,
  proximosPassos, renovacaoNaAgenda, renovacoesAgendar, renovacoesResumo, resumoQualificacao,
  resumoRecomendacoes, resumoRenovacoes, tendenciaPorGrupo, vencimentosPorMes,
} from '../js/crescimento-lcr.js';

const HOJE = '2026-10-18';   // um domingo

// ---------- recomendações sem os nomes ----------
const PESSOAS = [
  { nome: 'Exemplo, Ana', sexo: 'F', idade: 30, situacao: 'ativa', validade: '2026-11' },
  { nome: 'Exemplo, Bruno', sexo: 'M', idade: 45, situacao: 'para-vencer', validade: '2026-10' },
  { nome: 'Modelo, Carla', sexo: 'F', idade: 60, situacao: 'ativa', validade: '2027-06' },
  { nome: 'Modelo, Davi', sexo: 'M', idade: 17, situacao: 'ativa', validade: '2027-01' },   // 17 na lista de adultos
  { nome: 'Teste, Eva', sexo: 'F', idade: 52, situacao: 'vencida', validade: '2026-02' },
  { nome: 'Teste, Fábio', sexo: 'M', idade: 70, situacao: 'cancelada', validade: '' },
];
const RESUMO = resumoRecomendacoes(PESSOAS, { tipo: 'adultos', data: HOJE, contagem: 6 });

test('renovações sem os nomes: a mesma conta da lista por pessoa', () => {
  const r = renovacoesResumo(RESUMO, { hoje: HOJE });
  const lista = renovacoesAgendar(PESSOAS, { hoje: HOJE });
  assert.equal(r.ate, '2026-12');
  assert.equal(r.vencem, lista.filter(p => p.motivo === 'vence').length);
  assert.equal(r.vencidas, lista.filter(p => p.motivo === 'vencida').length);
  assert.deepEqual([r.vencem, r.vencidas], [2, 1]);
  // a "Para vencer" sem validade ainda conta (vale a maior das duas contas)
  const so = resumoRecomendacoes([{ nome: 'A', situacao: 'para-vencer', validade: '' }], { tipo: 'adultos' });
  assert.equal(renovacoesResumo(so, { hoje: HOJE }).vencem, 1);
  assert.deepEqual(renovacoesResumo(null, { hoje: HOJE }), { vencem: 0, vencidas: 0, ate: '2026-12' });
});

test('vencimentos por mês: 12 meses a partir do mês pedido, e as que já passaram', () => {
  const v = vencimentosPorMes(RESUMO, { desde: '2026-10' });
  assert.equal(v.meses.length, 12);
  assert.deepEqual(v.meses.slice(0, 4).map(m => [m.mes, m.n]), [['2026-10', 1], ['2026-11', 1], ['2026-12', 0], ['2027-01', 1]]);
  assert.equal(v.meses.at(-1).mes, '2027-09');
  assert.equal(v.antes, 0);
  // relatório antigo olhado mais tarde: as válidas de antes do mês "já venceram"
  const depois = vencimentosPorMes(RESUMO, { desde: '2027-01' });
  assert.equal(depois.antes, 2);
  assert.equal(vencimentosPorMes(null, { desde: '2026-10' }).meses.every(m => m.n === 0), true);
});

test('participantes sem os nomes: o maior dos dois grupos, só na faixa de idade', () => {
  assert.equal(RESUMO.validasNaFaixa, 3);   // o de 17 não é adulto para o Manual
  const membros = [
    { name: 'Exemplo, Ana', age: 30 }, { name: 'Outra, Gil', age: 40 }, { name: 'Outra, Hugo', age: 33 },
    { name: 'Outra, Iara', age: 50 }, { name: 'Jovem, Juca', age: 15 },
  ];
  const chamados = [
    { nome: 'Exemplo, Ana', chamado: 'x' }, { nome: 'Outra, Gil', chamado: 'y' }, { nome: 'Outra, Hugo', chamado: 'z' },
    { nome: 'Outra, Iara', chamado: 'w' }, { nome: 'Jovem, Juca', chamado: 'v' },
  ];
  const p = participantesSemNomes({ membros, chamados, resumo: RESUMO }, 'adultos');
  assert.deepEqual(p, { total: 4, chamado: 4, recomendacao: 3 });
  assert.equal(participantesSemNomes({ membros, chamados, resumo: null }, 'jovens').total, 1);
  // resumo guardado antes de validasNaFaixa existir: conta as válidas da lista
  const { validasNaFaixa, ...antigo } = RESUMO;
  assert.equal(validasNaFaixa, 3);
  assert.equal(participantesSemNomes({ resumo: antigo }, 'adultos').recomendacao, 4);
  // e o campo passa pela limpeza do servidor
  const limpo = limparCorpoCrescimento({ publico: { recomendacoes: { adultos: RESUMO } } });
  assert.equal(limpo.parcial.publico.recomendacoes.adultos.validasNaFaixa, 3);
  assert.ok(limparCorpoCrescimento({ publico: { recomendacoes: { adultos: { ...RESUMO, validasNaFaixa: -1 } } } }).erro);
});

test('qualificação: o que se sabe cumprido, para uma e duas alas; os jovens à parte (recomendado)', () => {
  const p = progressoQualificacao({ membros: 520, portadoresSM: null, adultosParticipantes: 120, jovensParticipantes: 15 });
  // 3 mínimos exigidos (membros, portadores, adultos); os jovens são recomendados, não exigidos
  assert.deepEqual(resumoQualificacao(p), {
    total: 3, conhecidos: 2, umaAla: 2, duasAlas: 1,
    recomendados: [{ chave: 'jovensParticipantes', atual: 15, meta: 20, metaDuas: 40, umaAla: false, duasAlas: false }],
  });
  // os três exigidos cumpridos e os jovens abaixo: a ala cumpre os mínimos
  const r = resumoQualificacao(progressoQualificacao({ membros: 300, portadoresSM: 22, adultosParticipantes: 110, jovensParticipantes: 8 }));
  assert.deepEqual([r.total, r.umaAla, r.recomendados[0].umaAla], [3, 3, false]);
  assert.equal(progressoQualificacao().find(c => c.chave === 'jovensParticipantes').recomendado, true);
  assert.deepEqual(resumoQualificacao([]), { total: 0, conhecidos: 0, umaAla: 0, duasAlas: 0, recomendados: [] });
});

test('o cartão do Início: os mínimos cumpridos e a barra dos membros (nunca a de uma estimativa)', () => {
  const p = progressoQualificacao({ membros: 300, portadoresSM: null, adultosParticipantes: 60, jovensParticipantes: 25 });
  const d = destaqueDoRumo(p);
  assert.deepEqual([d.total, d.conhecidos, d.umaAla, d.duasAlas], [3, 2, 1, 0]);
  assert.deepEqual([d.recomendados[0].atual, d.recomendados[0].umaAla], [25, true]);
  assert.equal(d.barra.chave, 'membros');
  assert.deepEqual([d.barra.atual, d.barra.meta, d.barra.metaDuas, d.barra.faltaDuas], [300, 250, 500, 200]);
  // sem o total de membros, nenhuma barra: nem a dos participantes (um mínimo),
  // nem o número do bispo (fica na aba, não na tela que fica aberta) — mas ele conta
  const semMembros = destaqueDoRumo(progressoQualificacao({ portadoresSM: 22, adultosParticipantes: 60 }));
  assert.equal(semMembros.barra, null);
  assert.deepEqual([semMembros.conhecidos, semMembros.umaAla], [2, 1]);
  assert.equal(destaqueDoRumo(progressoQualificacao({ adultosParticipantes: 60 })).barra, null);
  assert.deepEqual(destaqueDoRumo(progressoQualificacao({})), {
    total: 3, conhecidos: 0, umaAla: 0, duasAlas: 0, barra: null,
    recomendados: [{ chave: 'jovensParticipantes', atual: null, meta: 20, metaDuas: 40, umaAla: null, duasAlas: null }],
  });
});

// ---------- a renovação na Agenda ----------
const ent = (membro, tipo, extra = {}) => ({ membro, tipo, status: 'pendente', data: '', hora: '', ...extra });

test('renovação na Agenda: marcada, feita depois do relatório, ou nada', () => {
  const ana = PESSOAS[0];   // "Exemplo, Ana"
  // a Agenda escreve o nome na ordem do quadro ou na natural: a chave casa os dois
  const marcadas = [
    ent('Ana Exemplo', TIPO_RENOVACAO.adultos, { status: 'agendada', data: '2026-10-25', hora: '19:00' }),
    ent('Exemplo, Ana', TIPO_RENOVACAO.adultos, { status: 'pendente', data: '' }),
  ];
  const m = renovacaoNaAgenda(marcadas, ana, 'adultos');
  assert.equal(m.estado, 'marcada');
  assert.equal(m.e.data, '2026-10-25');   // a com data vem antes da sem data
  // outro tipo, outra pessoa ou a entrevista encerrada sem acontecer: não conta
  assert.equal(renovacaoNaAgenda([ent('Ana Exemplo', 'Orientação Espiritual'), ent('Bruno Exemplo', TIPO_RENOVACAO.adultos),
    ent('Ana Exemplo', TIPO_RENOVACAO.adultos, { status: 'nao-realizada' })], ana, 'adultos'), null);
  // realizada: só vale se for depois do relatório (a lista ainda é de antes)
  const feita = [ent('Ana Exemplo', TIPO_RENOVACAO.adultos, { status: 'realizada', data: '2026-10-17' })];
  assert.equal(renovacaoNaAgenda(feita, ana, 'adultos', { desde: '2026-10-16' }).estado, 'feita');
  assert.equal(renovacaoNaAgenda(feita, ana, 'adultos', { desde: '2026-10-18' }), null);
  assert.equal(renovacaoNaAgenda(feita, ana, 'adultos'), null);   // sem a data do relatório, não se sabe
  // sem data, vale o dia em que foi marcada como realizada
  const semData = [ent('Ana Exemplo', TIPO_RENOVACAO.adultos, { status: 'realizada', realizadaEm: '2026-10-17T22:00:00.000Z' })];
  assert.equal(renovacaoNaAgenda(semData, ana, 'adultos', { desde: '2026-10-16' }).estado, 'feita');
  // a do jovem: uso limitado, ou marcada como batismos vicários; a de adulto não
  const caio = { nome: 'Jovem, Caio', situacao: 'vencida', validade: '2026-09' };
  assert.equal(renovacaoNaAgenda([ent('Caio Jovem', TIPO_RENOVACAO.jovens)], caio, 'jovens').estado, 'marcada');
  assert.equal(renovacaoNaAgenda([ent('Caio Jovem', 'Recomendação para o Templo (Batismos Vicários)')], caio, 'jovens').estado, 'marcada');
  assert.equal(renovacaoNaAgenda([ent('Caio Jovem', TIPO_RENOVACAO.adultos)], caio, 'jovens'), null);
  assert.equal(renovacaoNaAgenda(marcadas, { nome: '' }, 'adultos'), null);
  assert.equal(renovacaoNaAgenda(null, ana, 'adultos'), null);
});

test('renovações para o Início: só os números, sem as já feitas, com as marcadas', () => {
  const agenda = [
    ent('Bruno Exemplo', TIPO_RENOVACAO.adultos, { status: 'agendada', data: '2026-10-22' }),          // vence: marcada
    ent('Eva Teste', TIPO_RENOVACAO.adultos, { status: 'realizada', data: '2026-10-17' }),              // vencida: feita
  ];
  const r = resumoRenovacoes({ adultos: PESSOAS, jovens: [] }, agenda, { hoje: HOJE, datas: { adultos: '2026-10-16' } });
  // a lista tem 3 a renovar (2 vencem, 1 vencida); a da Eva já foi renovada
  assert.equal(renovacoesAgendar(PESSOAS, { hoje: HOJE }).length, 3);
  assert.deepEqual(r, { total: 2, vencem: 2, vencidas: 0, marcadas: 1, feitas: 1, ate: '2026-12' });
  assert.ok(!JSON.stringify(r).includes('Exemplo'));
  // sem a Agenda (ainda não veio): todas a fazer, nenhuma marcada
  assert.deepEqual(resumoRenovacoes({ adultos: PESSOAS }, [], { hoje: HOJE }), { total: 3, vencem: 2, vencidas: 1, marcadas: 0, feitas: 0, ate: '2026-12' });
  assert.equal(resumoRenovacoes(null, null, { hoje: HOJE }).total, 0);
});

test('pirâmide: homens e mulheres por faixa, da mais velha para a mais nova', () => {
  const p = piramideEtaria([
    { gender: 'M', age: 0 }, { gender: 'F', age: 2 }, { gender: 'F', age: '12' }, { gender: 'M', age: 80 },
    { gender: 'F', age: 200 }, { gender: '', age: 30 }, { gender: 'M', age: '' }, { gender: 'M' },
  ]);
  assert.equal(p.faixas[0].faixa, '76+');
  assert.equal(p.faixas.at(-1).faixa, '0–2');
  assert.deepEqual([p.faixas.at(-1).m, p.faixas.at(-1).f], [1, 1]);
  assert.equal(p.faixas.find(f => f.faixa === '12–17').f, 1);
  assert.deepEqual([p.faixas[0].m, p.faixas[0].f], [1, 1]);
  assert.equal(p.semIdade, 3);
});

// ---------- a grade da sacramental ----------
const ATAS = [
  { data: '2026-10-04', frequencia: '98', orador1: 'Exemplo, Ana' },
  { data: '2026-10-11', tipo: 'conf-geral' },
  { data: '2026-09-27', frequencia: 'cento e dez' },   // texto que não é número: não conta
  { data: '2026-09-20', frequencia: 0 },
];

test('grade: os domingos do mês, a conferência sem campo e o domingo que ainda vem', () => {
  const g = gradeFrequencia(ATAS, '2026-10', HOJE);
  assert.deepEqual(g.map(d => d.data), ['2026-10-04', '2026-10-11', '2026-10-18', '2026-10-25']);
  assert.deepEqual(g.map(d => [d.frequencia, d.tem, d.semReuniao, d.futuro]), [
    ['98', true, false, false], ['', false, true, false], ['', false, false, false], ['', false, false, true]]);
  assert.equal(gradeFrequencia(ATAS, '2026-02', HOJE).length, 4);   // fevereiro acaba no dia 28
  assert.deepEqual(gradeFrequencia(ATAS, '2026-13', HOJE), []);
  assert.deepEqual(gradeFrequencia(ATAS, 'outubro', HOJE), []);
});

test('grade: grava só o que mudou, número inteiro ou vazio (apaga)', () => {
  const g = gradeFrequencia(ATAS, '2026-10', HOJE);
  const r = mudancasDaGrade(g, { '2026-10-04': ' 98 ', '2026-10-18': '0105', '2026-10-25': '50', '2026-10-11': '40' });
  // o domingo que ainda vem (25/10) também se lança: a grade vai até dezembro
  assert.deepEqual(r, { mudancas: [{ data: '2026-10-18', frequencia: '105' }, { data: '2026-10-25', frequencia: '50' }], invalidos: [], zeros: [], acima: [], conflitos: [] });
  assert.deepEqual(mudancasDaGrade(g, { '2026-10-04': '' }).mudancas, [{ data: '2026-10-04', frequencia: '' }]);
  assert.deepEqual(mudancasDaGrade(g, { '2026-10-04': '9a', '2026-10-18': '-3' }).invalidos, ['2026-10-04', '2026-10-18']);
  assert.deepEqual(mudancasDaGrade(g, {}), { mudancas: [], invalidos: [], zeros: [], acima: [], conflitos: [] });
  // o "0" não é contagem (o domingo continuaria "sem contagem"): recusado à parte
  const z = mudancasDaGrade(g, { '2026-10-18': '0', '2026-10-04': '00' });
  assert.deepEqual([z.mudancas, z.zeros], [[], ['2026-10-04', '2026-10-18']]);
  // acima do total de membros: grava, mas a tela pergunta antes ("1500" em vez de "150")
  const a = mudancasDaGrade(g, { '2026-10-18': '1500', '2026-10-04': '120' }, { teto: 380 });
  assert.deepEqual([a.mudancas.length, a.acima], [2, ['2026-10-18']]);
});

// A grade congela enquanto alguém digita. Desenhada sem a contagem de 11/10 (que
// chegou depois, gravada em outra tela ou aparelho), só o 18/10 foi digitado: o
// 11/10 não pode ir com o vazio da tela — apagaria a contagem.
test('grade: compara com o que foi DESENHADO, não com as atas de agora', () => {
  const desenhadas = [{ data: '2026-10-04', frequencia: '98' }];
  const agora = [...desenhadas, { data: '2026-10-11', frequencia: '120' }, { data: '2026-10-18', frequencia: '90' }];
  const g = gradeFrequencia(agora, '2026-10', HOJE);
  const desenhado = Object.fromEntries(gradeFrequencia(desenhadas, '2026-10', HOJE).filter(d => !d.semReuniao && !d.futuro).map(d => [d.data, d.frequencia]));
  const digitado = { ...desenhado, '2026-10-18': '95' };
  const r = mudancasDaGrade(g, digitado, { desenhado });
  assert.deepEqual(r.mudancas, [{ data: '2026-10-18', frequencia: '95' }]);   // o 11/10 (120) fica
  // o 18/10 também mudou lá (90): vai, mas como conflito, para a tela confirmar
  assert.deepEqual(r.conflitos, [{ data: '2026-10-18', atual: '90', novo: '95' }]);
  // sem `desenhado` (o jeito antigo), o 11/10 seria apagado
  assert.ok(mudancasDaGrade(g, digitado).mudancas.some(m => m.data === '2026-10-11' && m.frequencia === ''));
});

test('domingos sem contagem: os que já passaram, sem o de hoje e sem as conferências', () => {
  assert.deepEqual(domingosSemFrequencia(ATAS, { hoje: HOJE, semanas: 4 }), ['2026-09-20', '2026-09-27']);
  // numa quarta, o domingo que passou entra
  assert.deepEqual(domingosSemFrequencia(ATAS, { hoje: '2026-10-21', semanas: 1 }), ['2026-10-18']);
  assert.deepEqual(domingosSemFrequencia([{ data: '2026-10-18', frequencia: '90' }], { hoje: '2026-10-21', semanas: 1 }), []);
});

test('histórico digitado: % de 0 a 100, com vírgula ou %, e o vazio que apaga', () => {
  assert.deepEqual(historicoDigitado({ 2022: '41', 2023: '36,5%', 2024: ' ', 2025: '120', 1890: '3', abc: '1' }),
    { valores: { 2022: 41, 2023: 36.5, 2024: null }, invalidos: ['2025'] });
  assert.deepEqual(historicoDigitado({ 2022: '-1', 2023: '1e2' }).invalidos, ['2022', '2023']);
});

// ---------- classes sem marcação ----------
const semanasClasses = (taxaEq, n = 8) => Array.from({ length: n }, (_, i) => ({
  data: `2026-0${8 + Math.floor(i / 4)}-${String(2 + 7 * (i % 4)).padStart(2, '0')}`, registrada: true,
  porGrupo: { quorumElderes: { presentes: taxaEq, matriculados: 40 }, primaria: { presentes: 10, matriculados: 12 }, mocas: { presentes: 1, matriculados: 5 } },
}));

test('grupo grande com quase ninguém marcado: provavelmente não está sendo registrado', () => {
  const t = tendenciaPorGrupo(semanasClasses(0));
  assert.deepEqual(gruposSemMarcacao(t), ['quorumElderes']);   // as Moças são poucas: não acusa
  assert.deepEqual(gruposSemMarcacao(tendenciaPorGrupo(semanasClasses(12))), []);
  assert.deepEqual(gruposSemMarcacao([]), []);
});

// ---------- próximos passos ----------
test('próximos passos: o que fazer agora, em ordem, sem nome nenhum', () => {
  let pub = docCrescimentoVazio().publico;
  // nada importado: só o convite para importar
  assert.deepEqual(proximosPassos({ hoje: HOJE, publico: pub }).map(p => p.id), ['importar']);

  const parcial = limparCorpoCrescimento({ publico: {
    recomendacoes: { adultos: RESUMO },
    estatisticas: { valores: { elderesPerspectiva: 12, totalMembros: 300 } },
    trimestral: { trimestre: 3, ano: 2026, data: '2026-06-01', linhas: [
      { n: 1, real: 5, potencial: 10, pct: 50, pctAnoAnterior: 70, pct5Anos: 40 },
      { n: 2, real: 5, potencial: 10, pct: 50, pctAnoAnterior: 55, pct5Anos: 40 },
      { n: 3, real: 5, potencial: 10, pct: 50, pctAnoAnterior: 52, pct5Anos: 40 },
      { n: 4, real: 5, potencial: 10, pct: 50, pctAnoAnterior: 40, pct5Anos: 40 },
      { n: 12, real: 1, potencial: 10, pct: 10, pctAnoAnterior: 90, pct5Anos: 40 },
    ] },
    frequenciaClasses: { semanas: semanasClasses(0) },
  } }).parcial;
  pub = fundirCrescimento(null, parcial, '2026-10-18T10:00:00.000Z').publico;
  const chamados = [
    { org: 'Bispado', chamado: 'Bispo', nome: 'Exemplo, Bruno', designado: true },
    { org: 'Primária', chamado: 'Presidente da Primária', nome: 'Exemplo, Ana', designado: false },
  ];
  const passos = proximosPassos({
    hoje: HOJE, publico: pub, privado: { portadoresAtivosDizimistas: null }, sessao: true,
    chamados, chamadosCarregados: true, domingosSemContagem: ['2026-10-11'],
  });
  const ids = passos.map(p => p.id);
  assert.deepEqual(ids.slice(0, 2), ['renovar-adultos', 'designar']);   // prioridade 1 primeiro
  for (const id of ['vencidas-adultos', 'presidencias', 'portadores', 'sacramental', 'marcar-quorumElderes', 'perspectiva', 'atualizar']) {
    assert.ok(ids.includes(id), id);
  }
  assert.ok(!ids.includes('importar'), 'os quatro relatórios já vieram');
  assert.match(passos.find(p => p.id === 'atualizar').texto, /Relatório Trimestral/);   // o de junho envelheceu
  // os dois indicadores (1 a 9) que mais caíram em relação a 1 ano antes; a linha 12 não entra
  assert.deepEqual(ids.filter(i => i.startsWith('indicador-')), ['indicador-1', 'indicador-2']);
  assert.ok(passos.every((p, i) => i === 0 || passos[i - 1].prioridade <= p.prioridade));
  assert.match(passos[0].texto, /^2 recomendações de adultos vencem até dez\/2026$/);
  assert.equal(passos.find(p => p.id === 'designar').filtro, 'a-designar');
  // contagens, nunca nomes (o Início também mostra esta lista)
  const texto = JSON.stringify(passos);
  for (const nome of ['Exemplo', 'Modelo', 'Teste', 'Ana', 'Bruno']) assert.ok(!texto.includes(nome), nome);
  // sem a sessão, não pede o número do bispo; chamados não carregados não viram "nada a designar"
  const semSessao = proximosPassos({ hoje: HOJE, publico: pub, chamados: [], chamadosCarregados: false });
  assert.ok(!semSessao.some(p => p.id === 'portadores' || p.id === 'designar' || p.id === 'presidencias'));
  assert.equal(mesCurto('2026-10'), 'out/2026');
  assert.equal(mesCurto('2026-13'), '');
});

// ---------- o POST do servidor ----------
test('POST: junta por seção; vazio é 400; guardado estranho é 500 (não grava por cima)', () => {
  const agora = '2026-10-18T12:00:00.000Z';
  const a = aplicarPostCrescimento(null, { publico: { historicoSacramental: { 2022: 41 } } }, agora);
  assert.equal(a.status, 200);
  assert.equal(a.doc.publico.historicoSacramental[2022], 41);
  const b = aplicarPostCrescimento(a.doc, { privado: { portadoresAtivosDizimistas: 21 } }, agora);
  assert.equal(b.doc.publico.historicoSacramental[2022], 41);   // o resto ficou
  assert.equal(b.doc.privado.portadoresAtivosDizimistas, 21);
  assert.deepEqual(aplicarPostCrescimento(b.doc, {}, agora), { status: 400, erro: 'nenhuma seção para gravar' });
  assert.deepEqual(aplicarPostCrescimento(b.doc, { inventado: 1 }, agora).status, 400);
  assert.equal(aplicarPostCrescimento(b.doc, { privado: { portadoresAtivosDizimistas: -2 } }, agora).status, 400);
  assert.equal(aplicarPostCrescimento('estragado', { publico: { historicoSacramental: { 2022: 41 } } }, agora).status, 500);
  assert.ok(MAX_CORPO_CRESCIMENTO > JSON.stringify({ privado: { recomendacoesPessoas: { adultos: Array.from({ length: 2000 }, () => ({ nome: 'X'.repeat(150), sexo: 'F', idade: 99, situacao: 'para-vencer', validade: '2027-01' })) } } }).length);
});

test('grade: vai até dezembro do ano de hoje', async () => {
  const { ultimoMesDaGrade } = await import('../js/crescimento-lcr.js');
  assert.equal(ultimoMesDaGrade('2026-10-25'), '2026-12');
  assert.equal(ultimoMesDaGrade('2027-01-03'), '2027-12');
  const dez = gradeFrequencia([], '2026-12', '2026-10-25');
  assert.deepEqual(dez.map(d => d.data.slice(8)), ['06', '13', '20', '27']);
  assert.ok(dez.every(d => d.futuro));
  assert.deepEqual(mudancasDaGrade(dez, { '2026-12-20': '120' }).mudancas, [{ data: '2026-12-20', frequencia: '120' }]);
});
