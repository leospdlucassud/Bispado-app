// Aba "Vamos crescer a Ala" (js/crescimento-lcr.js e js/pdf-icones.js) — `npm test`.
// Os PDFs de verdade do LCR têm nomes, idades, recomendações e frequência de
// membros — e até os totais da ala são "Somente para uso da Igreja". Aqui só
// entram relatórios SINTÉTICOS, montados com a mesma geometria (corpo, colunas,
// quebras, acentos soltos, ícones desenhados) e com gente e números inventados.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CHAVES_ESTATISTICAS, CHAVES_GRUPO, CRITERIOS, METAS_ALA, METAS_ESTACA, MAX_PESSOAS, MIN_SEMANAS_ANO, NOMES_DOS_PDFS, SECOES_TRIMESTRAL,
  anoDasSemanas, chaveTrimestre, comparacaoIndicador, dataDoLcr, docCrescimentoVazio, formaDoIcone, frequenciaSacramental,
  fundirCrescimento, grupoDaClasse, historicoDoIndicador, historicoSacramental, lerEstatisticas, lerFrequenciaClasses,
  lerRecomendacoes, lerTrimestral, liderancaChave, limparCorpoCrescimento, mesDoLcr, normalizarDocCrescimento,
  participantesAdultos, participantesJovens, progressoQualificacao, recomendacaoValida, renovacoesAgendar,
  gruposSemMarcacao, respostaCrescimento, resumoRecomendacoes, situacaoChave, tendenciaPorGrupo, tipoDePdfLcr, totalDeMembros,
} from '../js/crescimento-lcr.js';
import { MAX_LADO_ICONE, OPS_PDFJS_3, caixasDaPagina, caixasDoOperatorList, lerPaginas } from '../js/pdf-icones.js';

const HOJE = '2026-10-18';
// um trecho do pdf.js; sem `w`, a largura que o pdf.js daria a uma fonte média
const trecho = (pg, str, x, y, f = 8, w) => pg.push({ str, transform: [f, 0, 0, f, x, y], width: w ?? str.length * f * 0.5, hasEOL: false });
// pedaços colados (o acento solto): cada um começa onde o anterior acaba; um
// pedaço que começa com espaço deixa um vão de palavra antes
function colados(pg, partes, x, y, f) {
  for (const p of partes) {
    if (p.startsWith(' ')) x += f * 0.3;
    const s = p.trim();
    trecho(pg, s, x, y, f);
    x += s.length * f * 0.5;
  }
}

// ---------- 1) Relatório Trimestral sintético ----------
// Medidas de out/2026: corpo 7,5; número em 38,5; rótulo em 48,6; valores
// centralizados em Real 438 | Potencial 469 | ano 501 | ano−1 524,6 | ano−5 548;
// linhas a 16,5 pt; rótulo quebrado a ±7,5 pt da linha do número.
const CENTROS = [438, 469, 501, 524.6, 548];
function trimestral({ ala = 'Ala Exemplo 9 (000009)', trimestre = 3, ano = 2026, data = '18 out. 2026', semLargura = false } = {}) {
  const paginas = [[]];
  let pg = paginas[0], y;
  const t = (s, x, yy, f = 7.5) => trecho(pg, s, x, yy, f, semLargura ? 0 : undefined);
  const cabecalho = () => {
    t('Relatório Trimestral', 28.3, 824.6, 9); t(ala, 249.4, 824.6, 9); t(`Trimestre ${trimestre} - ${ano}`, 493.7, 824.6, 9);
    t(data, 28.3, 11.1, 9);
    t('Somente para Uso da Igreja © ((0)) Intellectual Reserve, Inc. Todos os direitos reservados.', 116.8, 11.1, 9);
    t(String(paginas.length), 561.9, 11.1, 9);
  };
  cabecalho();
  t(`Trimestre ${trimestre}`, 505.4, 796.7);
  ['Real', 'Potencial', String(ano), String(ano - 1), String(ano - 5)].forEach((s, k) => t(s, CENTROS[k] - s.length * 3.75 / 2, 780.9));
  y = 780.9;
  const r = {
    paginas,
    secao(titulo) { y -= 15.7; t(titulo, 37.7, y); return r; },
    // rotulo: 1, 2 (acima e abaixo) ou 3 linhas; valores: 5 textos, ou 4 com o
    // último "100% 100%" (o trecho que junta as duas colunas de comparação)
    linha(n, rotulo, valores) {
      const linhas = Array.isArray(rotulo) ? rotulo : [rotulo];
      const quebrado = linhas.length > 1;
      y -= 16.5 + (quebrado ? 7.5 : 0);
      t(String(n) + (n === 14 ? ' ' : ''), 38.5, y);
      if (linhas.length === 1) t(linhas[0], 48.6, y);
      if (linhas.length === 2) { t(linhas[0], 48.6, y + 7.5); t(linhas[1], 48.6, y - 7.5); }
      if (linhas.length === 3) { t(linhas[0], 48.6, y + 7.5); t(linhas[1], 48.6, y); t(linhas[2], 48.6, y - 7.5); }
      valores.forEach((v, k) => {
        if (k === 3 && valores.length === 4) { t(v, CENTROS[3] - 7.5, y); return; }   // "100% 100%"
        t(v, CENTROS[k] - v.length * 3.75 / 2, y);
      });
      if (quebrado) y -= 7.5;
      return r;
    },
    // a 2ª página: "Detalhes sobre o Converso", com nomes — tem de ser pulada
    // (semTitulo: o LCR mudou o título; o cabeçalho da tabela de pessoas ainda corta)
    detalhes({ semTitulo = false, n = '1' } = {}) {
      pg = []; paginas.push(pg); cabecalho();
      if (!semTitulo) t('Detalhes sobre o Converso', 34.3, 802.7, 12);
      t('Nome', 76.9, 763.9); t('Sexo', 150.6, 763.9); t('Idade', 189.2, 763.9);
      // uma linha que, sem o corte, passaria por indicador: número na margem e valores nas colunas
      t(n, 38.5, 748.7); t('Convertida, Iolanda Fictícia', 76.9, 748.7); t('F', 150.6, 748.7); t('34', 434.7, 748.7); t('12', 466, 748.7);
      return r;
    },
  };
  return r;
}

function trimestralDeExemplo(opcoes) {
  return trimestral(opcoes)
    .secao('Indicadores de conversão e de crescimento da Igreja')
    .linha(1, 'Pessoas que são seladas ao cônjuge no templo', ['30', '60', '50%', '45%', '40%'])
    .linha(2, ['Membros com investidura que possuem recomendação', 'válida para o templo'], ['20', '40', '50%', '55%', '60%'])
    .linha(3, ['Pessoas do sexo masculino com idade entre 18–25 anos', 'que estão servindo ou que serviram missão de', 'tempo integral'], ['2', '20', '10%', '5%', '10%'])
    .linha(7, 'Média de frequência na reunião sacramental', ['90', '300', '30%', '26%', '31%'])
    .linha(8, 'Conversos batizados e confirmados nos últimos 12 meses', ['4', '--', '--', '--', '--'])
    .secao('Membros / Famílias')
    .linha(10, 'Total de membros', ['300', '--', '--', '--', '--'])
    .linha(12, 'Duplas de irmãos ministradores entrevistados', ['2', '8', '25%', '100% 100%'])
    .secao('Adultos')
    .linha(14, ['Portadores do Sacerdócio de Melquisedeque que frequentam', 'ou da Primária'], ['6', '40', '15%', '30%', '35%'])
    .secao('Crianças')
    .linha(22, 'Crianças de 3 anos ou mais que frequentam a Primária', ['18', '16', '113%', '95%', '60%']);
}

test('trimestral: cabeçalho, seções, rótulos quebrados, "--" e "100% 100%"', () => {
  const t = lerTrimestral(trimestralDeExemplo().paginas);
  assert.equal(t.ala, 'Ala Exemplo 9');
  assert.equal(t.unidade, '000009');
  assert.equal(t.trimestre, 3);
  assert.equal(t.ano, 2026);
  assert.equal(t.data, '2026-10-18');
  assert.deepEqual(t.linhas.map(l => l.n), [1, 2, 3, 7, 8, 10, 12, 14, 22]);
  const l = n => t.linhas.find(x => x.n === n);
  assert.deepEqual(l(1), { n: 1, secao: 'conversao', rotulo: 'Pessoas que são seladas ao cônjuge no templo', real: 30, potencial: 60, pct: 50, pctAnoAnterior: 45, pct5Anos: 40 });
  assert.equal(l(2).rotulo, 'Membros com investidura que possuem recomendação válida para o templo');
  assert.equal(l(3).rotulo, 'Pessoas do sexo masculino com idade entre 18–25 anos que estão servindo ou que serviram missão de tempo integral');
  assert.deepEqual([l(8).real, l(8).potencial, l(8).pct, l(8).pctAnoAnterior, l(8).pct5Anos], [4, null, null, null, null]);
  assert.deepEqual([l(10).secao, l(10).real, l(10).potencial], ['membros', 300, null]);
  assert.deepEqual([l(12).real, l(12).potencial, l(12).pct, l(12).pctAnoAnterior, l(12).pct5Anos], [2, 8, 25, 100, 100]);
  assert.deepEqual([l(14).secao, l(14).rotulo, l(14).real], ['adultos', 'Portadores do Sacerdócio de Melquisedeque que frequentam ou da Primária', 6]);
  assert.deepEqual([l(22).secao, l(22).pct], ['criancas', 113]);   // passa de 100%: a matrícula da Primária é real/potencial
  assert.deepEqual(t.faltando, [4, 5, 6, 9, 11, 13, 15, 16, 17, 18, 19, 20, 21, 23, 24, 25, 26]);
  assert.deepEqual(t.avisos, []);
});

test('trimestral: a página dos conversos (com nomes) não entra em nada', () => {
  const t = lerTrimestral(trimestralDeExemplo().detalhes().paginas);
  assert.equal(t.linhas.length, 9);
  assert.equal(t.linhas.find(l => l.n === 1).real, 30);   // o "1" da página 2 não troca a linha 1
  for (const parte of ['Convertida', 'Iolanda', 'Fictícia']) assert.ok(!JSON.stringify(t).includes(parte), 'nome da página 2 vazou');
  const sem = lerTrimestral(trimestralDeExemplo().detalhes({ semTitulo: true, n: '27' }).paginas);
  assert.deepEqual(sem.linhas.map(l => l.n), [1, 2, 3, 7, 8, 10, 12, 14, 22]);
  assert.ok(!JSON.stringify(sem).includes('Iolanda'), 'sem o título, o nome vazou');
});

test('trimestral: sem a largura dos trechos, com milhar e com % que não confere', () => {
  const sem = lerTrimestral(trimestralDeExemplo({ semLargura: true }).paginas);
  assert.equal(sem.linhas.length, 9);
  assert.equal(sem.linhas.find(l => l.n === 12).pct5Anos, 100);
  const r = trimestral({ trimestre: 4, ano: 2025 }).secao('Membros / Famílias')
    .linha(10, 'Total de membros', ['1.234', '--', '--', '--', '--'])
    .linha(13, 'Duplas de irmãs ministradoras entrevistadas', ['1', '14', '50%', '20%', '10%']);
  const t = lerTrimestral(r.paginas);
  assert.equal(t.trimestre, 4);
  assert.equal(t.ano, 2025);
  assert.equal(t.linhas[0].real, 1234);
  assert.equal(t.linhas[0].secao, 'membros');
  assert.equal(t.avisos.length, 1);   // 1 de 14 não é 50%
  assert.match(t.avisos[0], /Linha 13/);
});

test('trimestral: sem cabeçalho de colunas, avisa e não inventa', () => {
  const pg = [];
  trecho(pg, 'Relatório Trimestral', 28.3, 824.6, 9);
  trecho(pg, '1', 38.5, 700, 7.5); trecho(pg, 'Algo', 48.6, 700, 7.5);
  const t = lerTrimestral([pg]);
  assert.equal(t.linhas.length, 0);
  assert.equal(t.avisos.length, 1);
});

test('comparação com 1 e 5 anos, chave e histórico do trimestre', () => {
  assert.deepEqual(comparacaoIndicador({ pct: 50, pctAnoAnterior: 45, pct5Anos: 50 }), { anoAnterior: 'melhor', cincoAnos: 'igual' });
  assert.deepEqual(comparacaoIndicador({ pct: 30, pctAnoAnterior: 40, pct5Anos: null }), { anoAnterior: 'pior', cincoAnos: null });
  assert.deepEqual(comparacaoIndicador({ pct: null }), { anoAnterior: null, cincoAnos: null });
  assert.equal(chaveTrimestre({ ano: 2026, trimestre: 3 }), '2026-T3');
  assert.equal(chaveTrimestre({}), '');
  const hist = historicoDoIndicador({
    '2026-T3': { linhas: [{ n: 7, real: 90, potencial: 300, pct: 30 }] },
    '2026-T2': { linhas: [{ n: 7, real: 80, potencial: 300, pct: 27 }] },
    '2026-T1': { linhas: [{ n: 1, real: 1 }] },
  }, 7);
  assert.deepEqual(hist.map(h => h.chave), ['2026-T2', '2026-T3']);
  assert.deepEqual(SECOES_TRIMESTRAL.map(s => [s.de, s.ate]), [[1, 9], [10, 13], [14, 17], [18, 20], [21, 22], [23, 26]]);
});

// ---------- 2) Estatísticas da Unidade sintéticas ----------
// rótulo em 34,5 (corpo 11 nos totais, 10,5 nos detalhes), o acento em trecho
// separado; o valor à direita (549,7 com 2 dígitos, 543,5 com 3)
function estatisticas(linhas, { ala = 'Ala Exemplo 9 (000009)', pagina2 = [] } = {}) {
  const paginas = [];
  for (const [k, lista] of [linhas, pagina2].entries()) {
    if (!lista.length) continue;
    const pg = [];
    paginas.push(pg);
    let y = 760;
    if (k === 0) {
      colados(pg, ['Estat', 'í', 'sticas da Unidade'], 34.5, 796.2, 18);
      trecho(pg, ala, 34.5, 777.4, 10.5);
      y = 746.7;
    }
    for (const [partes, valor, f = 10.5] of lista) {
      colados(pg, partes, 34.5, y, f);
      const v = String(valor);
      trecho(pg, v, 555.7 - (v.length - 1) * 6, y, f === 11 ? 8.9 : 10.5);
      y -= 22;
    }
    trecho(pg, 'Somente para Uso da Igreja', 133, 10.9, 8);
  }
  return paginas;
}

test('estatísticas: rótulos com acento solto viram chaves estáveis', () => {
  const paginas = estatisticas([
    [['Total de Membros'], 312, 11],
    [['Homens'], 140, 11],
    [['Sumos Sacerdotes'], 12],
    [['É', 'lderes'], 25],
    [['É', 'lderes em Perspectiva'], 90],
    [['Mo', 'ç', 'as'], 30, 11],
    [['Guardi', 'ã', 's da Luz (completando 16 anos de idade ou mais)'], 11],
    [['Edificadoras da F', 'é', ' (completando 12 ou 13 anos de idade)'], 9],
    [['Sacerdotes (completando 16 anos de idade ou mais)'], 18],
    [['Fam', 'í', 'lias'], 200, 11],
    [['Fam', 'í', 'lias sem um Portador do Sacerd', 'ó', 'cio de Melquisedeque'], 150],
    [['Fam', 'í', 'lias com apenas um dos Pais e Filhos Jovens ou Crian', 'ç', 'as'], 8],
    [['Jovens adultos solteiros (18-35)'], 100],
    [['Rec', 'é', 'm-Conversos (', 'ú', 'ltimos doze meses)'], 4, 11],
    [['Rapazes conversos'], 1],
    [['Uma linha nova do LCR'], 7],
  ], { pagina2: [
    [['Situa', 'çã', 'o das Ordena', 'çõ', 'es de Rec', 'é', 'm-Conversos'], 3, 11],
    [['N', 'ã', 'o ordenados'], 1],
    [['Adultos com Investidura'], 50, 11],
    [['Com Investidura e com Recomenda', 'çã', 'o para o templo'], 40],
    [['Membros Registrados com Nove Anos ou Mais'], 5],
  ] });
  assert.equal(tipoDePdfLcr(paginas), 'estatisticas');
  const e = lerEstatisticas(paginas);
  assert.equal(e.ala, 'Ala Exemplo 9');
  assert.equal(e.unidade, '000009');
  assert.deepEqual(e.valores, {
    totalMembros: 312, homens: 140, sumosSacerdotes: 12, elderes: 25, elderesPerspectiva: 90, mocas: 30, guardias: 11,
    edificadoras: 9, sacerdotes: 18, familias: 200, familiasSemPortadorSM: 150, familiasMonoparentais: 8, jas: 100,
    recemConversos: 4, conversosRapazes: 1, ordenacoesRecemConversos: 3, recemConversosNaoOrdenados: 1,
    adultosInvestidos: 50, investidosComRecomendacao: 40, registradosNoveAnosOuMais: 5,
  });
  assert.deepEqual(e.outros, [{ rotulo: 'Uma linha nova do LCR', valor: 7 }]);
  assert.ok(CHAVES_ESTATISTICAS.includes('familiasSemPortadorSM'));
});

// ---------- 3) Situação das recomendações sintética ----------
// corpo 6,6; linhas a 11,25 pt; colunas no x do rótulo; cabeçalho 714,8 na 1ª
// página e 720 nas outras; o nome que quebra sobe e desce 4 pt
const COLS_ADULTOS = { nome: 46.5, sexo: 264.9, idade: 292.7, tipo: 322.7, situacao: 461.4, validade: 520.8 };
const COLS_JOVENS = { nome: 46.5, sexo: 335.5, idade: 373.6, situacao: 414.7, validade: 502.7 };
function recomendacoes(tipo, pessoas, { porPagina = 50, contagem = pessoas.length } = {}) {
  const C = tipo === 'adultos' ? COLS_ADULTOS : COLS_JOVENS;
  const titulo = tipo === 'adultos' ? 'Situação de Recomendação para o Templo' : 'Situação da Recomendação do Jovem';
  const paginas = [];
  let pg, y;
  const pagina = () => {
    pg = []; paginas.push(pg);
    trecho(pg, 'Ala Exemplo 9 (000009)', 475.5, 763.5, 10);
    trecho(pg, titulo, 39.7, 757.5, 10);
    trecho(pg, 'Estaca Exemplo (000001)', 450, 751.5, 10);
    y = paginas.length === 1 ? 714.8 : 720;
    trecho(pg, 'Nome', C.nome, y, 6.6); trecho(pg, 'Sexo', C.sexo, y, 6.6); trecho(pg, 'Idade', C.idade, y, 6.6);
    if (C.tipo) colados(pg, ['Tipo de Recomenda', 'çã', 'o'], C.tipo, y, 6.6);
    colados(pg, ['Situa', 'çã', 'o'], C.situacao, y, 6.6);
    trecho(pg, 'Validade', C.validade, y, 6.6);
    trecho(pg, String(paginas.length), 39.7, 14.3, 8);
    trecho(pg, 'Somente para Uso da Igreja © ((0)) Intellectual Reserve, Inc', 161.4, 14.3, 8);
    trecho(pg, '18 Oct 2026', 533.5, 14.3, 8);
  };
  pagina();
  pessoas.forEach((p, i) => {
    if (i && i % porPagina === 0) pagina();
    const nome = p.nome;
    y -= nome.length > 1 ? 15.25 : 11.25;
    if (nome.length > 1) { colados(pg, nome[0], C.nome, y + 4, 6.6); colados(pg, nome[1], C.nome, y - 4, 6.6); y -= 4; }
    else colados(pg, nome[0], C.nome, y, 6.6);
    const yy = nome.length > 1 ? y + 4 : y;
    trecho(pg, p.sexo, C.sexo, yy, 6.6);
    trecho(pg, String(p.idade), C.idade, yy, 6.6);
    if (C.tipo) trecho(pg, 'Recomendação para o Templo', C.tipo, yy, 6.6);
    if (p.situacao) trecho(pg, p.situacao, C.situacao, yy, 6.6);
    if (p.validade) trecho(pg, p.validade, C.validade, yy, 6.6);
  });
  trecho(pg, `Contagem: ${contagem}`, 44.7, y - 18, 7.4);
  return paginas;
}

// nome: as linhas do nome, cada uma em pedaços (o acento solto é um pedaço)
const ADULTOS = [
  { nome: [['Exemplo, Ana']], sexo: 'F', idade: 25, situacao: 'Ativa', validade: 'mai. 2027' },
  { nome: [['Exemplo, Bruno']], sexo: 'M', idade: 52, situacao: 'Ativa', validade: 'nov. 2026' },
  { nome: [['Fict', 'í', 'cio, Carlos']], sexo: 'M', idade: 44, situacao: 'Vencida', validade: 'ago. 2025' },
  { nome: [['Modelo, Dora']], sexo: 'F', idade: 68, situacao: 'Para Vencer', validade: 'dez. 2026' },
  { nome: [['Amostra Comprida Demais,'], ['Eduarda Cristina']], sexo: 'F', idade: 35, situacao: 'Vencida', validade: 'mar. 2022' },
  { nome: [['Teste, Fábio']], sexo: 'M', idade: 29, situacao: 'Cancelada', validade: 'fev. 2027' },
  { nome: [['Ensaio, Gabriela']], sexo: 'F', idade: 63, situacao: 'Ativa', validade: 'ago. 2028' },
];

test('recomendações (adultos): colunas, nome quebrado, página nova, Contagem e data em inglês', () => {
  const paginas = recomendacoes('adultos', ADULTOS, { porPagina: 4 });
  assert.equal(paginas.length, 2);
  assert.equal(tipoDePdfLcr(paginas), 'recomendacoes-adultos');
  const r = lerRecomendacoes(paginas);
  assert.equal(r.tipo, 'adultos');
  assert.deepEqual([r.ala, r.unidade, r.estaca, r.data, r.contagem], ['Ala Exemplo 9', '000009', 'Estaca Exemplo', '2026-10-18', 7]);
  assert.equal(r.pessoas.length, 7);
  assert.deepEqual(r.pessoas[0], { nome: 'Exemplo, Ana', sexo: 'F', idade: 25, situacao: 'ativa', validade: '2027-05' });
  assert.equal(r.pessoas[2].nome, 'Fictício, Carlos');
  assert.equal(r.pessoas[4].nome, 'Amostra Comprida Demais, Eduarda Cristina');
  assert.deepEqual(r.pessoas.map(p => p.situacao), ['ativa', 'ativa', 'vencida', 'para-vencer', 'vencida', 'cancelada', 'ativa']);
  const s = r.resumo;
  assert.deepEqual(s.porSituacao, { ativa: 3, vencida: 2, 'para-vencer': 1, cancelada: 1 });
  assert.equal(s.semSituacao, 0);
  assert.deepEqual(s.porMesValidade, { '2027-05': 1, '2026-11': 1, '2026-12': 1, '2028-08': 1 });   // só as que ainda valem
  assert.deepEqual(s.vencidasPorAno, { 2025: 1, 2022: 1 });
  assert.deepEqual(s.porSexo, { F: { total: 4, ativas: 3 }, M: { total: 3, ativas: 1 } });
  assert.deepEqual(s.porFaixa.map(f => [f.faixa, f.total, f.ativas]), [['até 30', 2, 1], ['31–50', 2, 0], ['51+', 3, 3]]);
  // a parte pública não leva nome nenhum
  const pub = JSON.stringify(s);
  for (const p of r.pessoas) assert.ok(!pub.includes(p.nome.split(',')[0]), 'nome no resumo');
});

test('recomendações (jovens): sem situação, "Não Batizado" e Contagem que não bate', () => {
  const jovens = [
    { nome: [['Jovem, Hugo']], sexo: 'M', idade: 13, situacao: 'Ativa', validade: 'mai. 2027' },
    { nome: [['Jovem, Iara']], sexo: 'F', idade: 15 },
    { nome: [['Jovem, Joana']], sexo: 'F', idade: 13, situacao: 'Não Batizado' },
    { nome: [['Jovem, Kai']], sexo: 'M', idade: 17, situacao: 'Vencida', validade: 'fev. 2026' },
    { nome: [['Jovem, Lia']], sexo: 'F', idade: 16, situacao: 'Ativa', validade: 'jan. 2027' },
  ];
  const paginas = recomendacoes('jovens', jovens, { contagem: 6 });
  assert.equal(tipoDePdfLcr(paginas), 'recomendacoes-jovens');
  const r = lerRecomendacoes(paginas);
  assert.equal(r.tipo, 'jovens');
  assert.equal(r.contagem, 6);
  assert.equal(r.pessoas.length, 5);   // a prévia avisa: 5 lidos de 6
  assert.deepEqual(r.pessoas[1], { nome: 'Jovem, Iara', sexo: 'F', idade: 15, situacao: '', validade: '' });
  assert.equal(r.pessoas[2].situacao, 'nao-batizado');
  assert.deepEqual(r.resumo.porSituacao, { ativa: 2, 'nao-batizado': 1, vencida: 1 });
  assert.equal(r.resumo.semSituacao, 1);
  assert.deepEqual(r.resumo.porFaixa.map(f => [f.faixa, f.total, f.ativas]), [['até 13', 2, 1], ['14–15', 1, 0], ['16+', 2, 1]]);
});

test('situação, validade e datas do LCR', () => {
  assert.equal(situacaoChave('Para Vencer'), 'para-vencer');
  assert.equal(situacaoChave('Não Batizado'), 'nao-batizado');
  assert.equal(situacaoChave(''), '');
  assert.ok(recomendacaoValida('ativa') && recomendacaoValida('para-vencer'));
  assert.ok(!recomendacaoValida('vencida') && !recomendacaoValida('cancelada') && !recomendacaoValida(''));
  assert.equal(mesDoLcr('mai. 2027'), '2027-05');
  assert.equal(mesDoLcr('Dec 2026'), '2026-12');
  assert.equal(mesDoLcr('xyz 2026'), '');
  assert.equal(dataDoLcr('18 out. 2026'), '2026-10-18');
  assert.equal(dataDoLcr('rodapé 1 de 2 · 18 Oct 2026'), '2026-10-18');
  assert.equal(dataDoLcr('3 Sep 2025'), '2025-09-03');
  assert.equal(dataDoLcr('31 fev 2026'), '');
  assert.equal(dataDoLcr(''), '');
});

test('renovações a agendar: as que vencem primeiro, depois as vencidas mais recentes', () => {
  const pessoas = [
    { nome: 'A, Um', situacao: 'ativa', validade: '2027-05' },
    { nome: 'B, Dois', situacao: 'ativa', validade: '2026-12' },
    { nome: 'C, Três', situacao: 'para-vencer', validade: '2026-11' },
    { nome: 'D, Quatro', situacao: 'vencida', validade: '2021-10' },
    { nome: 'E, Cinco', situacao: 'vencida', validade: '2026-03' },
    { nome: 'F, Seis', situacao: 'cancelada', validade: '2027-01' },
    { nome: 'G, Sete', situacao: '', validade: '' },
  ];
  const r = renovacoesAgendar(pessoas, { hoje: HOJE, meses: 2 });
  assert.deepEqual(r.map(p => p.nome), ['C, Três', 'B, Dois', 'E, Cinco', 'D, Quatro']);
  assert.deepEqual(r.map(p => p.motivo), ['vence', 'vence', 'vencida', 'vencida']);
  assert.equal(renovacoesAgendar(pessoas, { hoje: HOJE, meses: 8 }).length, 5);
  assert.deepEqual(renovacoesAgendar(null), []);
});

// ---------- 4) Frequência à classe e ao quórum sintética ----------
// Dois desenhos medidos: o de 4 domingos (corpo 8,8, ícone 12,5, colunas de 100
// pt a partir de 147,7) e o de 5 domingos, todo em escala menor (corpo 7,4,
// ícone 10,5, colunas de 84,4 a partir de 129,1). Por classe: o ícone 1,4 pt
// depois do x da coluna e o rótulo 20 pt depois, centralizado no ícone, a 12,5
// pt por linha. No fim de cada linha de pessoa, o glifo de tendência (10,6 ×
// 11,3, curvas e retas — parece um ícone e não é).
const DESENHOS = {
  4: { f: 8.8, fc: 10, lado: 12.5, xNome: 33.5, xSexo: 99.7, col0: 147.7, colW: 100, dIcone: 1.4, dRotulo: 20, entreLinhas: 12.5, entreClasses: 29.4, entrePessoas: 35, topo: 684.7 },
  5: { f: 7.4, fc: 8.4, lado: 10.5, xNome: 32.7, xSexo: 88.6, col0: 129.1, colW: 84.4, dIcone: 1.1, dRotulo: 16.8, entreLinhas: 10.6, entreClasses: 24.7, entrePessoas: 29.4, topo: 704.8 },
};
const ICONE_PRESENTE = { curvas: 15, retas: 8, subcaminhos: 2, pintura: 'eoFill' };
const ICONE_AUSENTE = { curvas: 36, retas: 0, subcaminhos: 2, pintura: 'fill' };
const ICONE_AUSENTE_1 = { curvas: 36, retas: 0, subcaminhos: 1, pintura: 'fill' };   // alguns anéis vêm num subcaminho só

// pessoas: [{ nome, sexo, classes: [{ rotulo: [linhas], presencas: [bool por domingo], partir?: 'depois'|'antes' }] }]
function frequencia(domingos, pessoas, { ala = 'Ala Exemplo 9 (000009)' } = {}) {
  const D = DESENHOS[domingos.length] || DESENHOS[4];
  const paginas = [[]], icones = [[]];
  let p = 0, y = D.topo - 30;
  const pg = () => paginas[p], ic = () => icones[p];
  const novaPagina = () => {
    paginas.push([]); icones.push([]); p++;
    trecho(pg(), ala, 460.1, 823.9, 10);
    trecho(pg(), 'Somente para Uso da Igreja', 127.7, 10.2, 8.2);
    y = 790;
  };
  // 1ª página: título, a fileira de botões com as datas, o filtro e o cabeçalho
  trecho(pg(), ala, 460.1, 823.9, 10);
  colados(pg(), ['Frequ', 'ê', 'ncia', ' à', ' classe e ao qu', 'ó', 'rum'], 28.5, 799, 15);
  [...domingos, 'Todos'].forEach((d, k) => trecho(pg(), d, 43.5 + 55 * k, 759, D.fc));
  colados(pg(), ['Todas as Organiza', 'çõ', 'es'], 28.5, 723.4, 12.5);
  trecho(pg(), 'Nome', D.xNome, D.topo, D.fc); trecho(pg(), 'Sexo', D.xSexo, D.topo, D.fc);
  domingos.forEach((d, k) => trecho(pg(), d, D.col0 + D.colW * k, D.topo, D.fc));
  trecho(pg(), 'Somente para Uso da Igreja', 127.7, 10.2, 8.2);
  // um círculo contornado no filtro, acima do cabeçalho: tem forma de ícone e não é presença
  ic().push({ x: 200, y: 720, w: 9, h: 9, curvas: 4, retas: 0, subcaminhos: 1, pintura: 'stroke' });

  const icone = (k, yc, presente, variante) => ic().push({
    x: D.col0 + D.colW * k + D.dIcone, y: yc - D.lado / 2, w: D.lado, h: D.lado,
    ...(presente ? ICONE_PRESENTE : variante ? ICONE_AUSENTE_1 : ICONE_AUSENTE),
  });
  const rotulo = (k, linha, yBase) => trecho(pg(), linha, D.col0 + D.colW * k + D.dRotulo, yBase, D.f);
  const base = (yc, i, n) => yc + ((n - 1) / 2 - i) * D.entreLinhas - D.f * 0.3;

  let variante = 0;
  for (const pessoa of pessoas) {
    y -= D.entrePessoas;
    if (y < 60) novaPagina();
    const inicio = { p, y };
    pessoa.classes.forEach((c, ci) => {
      if (ci) y -= D.entreClasses;
      if (y < 50) novaPagina();
      const n = c.rotulo.length;
      domingos.forEach((_, k) => {
        if (c.partir === 'depois') {        // ícone e 1ª linha no pé desta página; a 2ª no alto da seguinte
          icone(k, 40, c.presencas[k], ++variante % 9 === 0);
          rotulo(k, c.rotulo[0], 40 + D.entreLinhas / 2 - D.f * 0.3);
        } else if (c.partir === 'antes') {  // 1ª linha no pé desta página; ícone e 2ª no alto da seguinte
          rotulo(k, c.rotulo[0], 36);
        } else {
          icone(k, y, c.presencas[k], ++variante % 9 === 0);
          c.rotulo.forEach((l, i) => rotulo(k, l, base(y, i, n)));
        }
      });
      if (c.partir) {
        novaPagina();
        domingos.forEach((_, k) => {
          if (c.partir === 'depois') rotulo(k, c.rotulo[1], 800);
          else { icone(k, 790, c.presencas[k], false); rotulo(k, c.rotulo[1], 790 - D.entreLinhas / 2 - D.f * 0.3); }
        });
        y = 790;
      }
    });
    // nome e sexo no meio do bloco (na página em que ele começou, se partiu)
    const meio = inicio.p === p ? (inicio.y + y) / 2 : inicio.y;
    colados(paginas[inicio.p], [pessoa.nome], D.xNome, meio, D.f);
    trecho(paginas[inicio.p], pessoa.sexo, D.xSexo, meio - D.f * 0.3, D.f);
    icones[inicio.p].push({ x: D.col0 + D.colW * domingos.length + 2.4, y: meio - 5.6, w: D.lado * 0.848, h: D.lado * 0.904, curvas: 8, retas: 12, subcaminhos: 3, pintura: 'fill' });
  }
  return { paginas, icones };
}

const ED_ADULTOS = ['Escola Dominical', 'para adultos'];
const SOCORRO = ['Sociedade de', 'Socorro'];
const ELDERES = ['Quórum de', 'Élderes'];
const pessoasDeExemplo = () => [
  { nome: 'Exemplo, Ana', sexo: 'F', classes: [{ rotulo: ED_ADULTOS, presencas: [true, false, true, false] }, { rotulo: SOCORRO, presencas: [false, true, false, false] }] },
  { nome: 'Exemplo, Bruno', sexo: 'M', classes: [{ rotulo: ED_ADULTOS, presencas: [true, false, false, false] }, { rotulo: ELDERES, presencas: [false, true, false, false] }] },
  { nome: 'Jovem, Caio', sexo: 'M', classes: [{ rotulo: ['Escola Dominical', 'Curso 11'], presencas: [true, false, true, false] }, { rotulo: ['Quórum de', 'Diáconos'], presencas: [false, true, false, false] }] },
  { nome: 'Jovem, Duda', sexo: 'F', classes: [{ rotulo: ['Curso 15'], presencas: [false, false, true, false] }, { rotulo: ['Mensageiras da', 'esperança'], presencas: [false, true, true, false] }] },
  { nome: 'Criança, Eli', sexo: 'M', classes: [{ rotulo: ['Valorosos 8'], presencas: [true, true, true, false] }] },
  { nome: 'Criança, Fê', sexo: 'F', classes: [{ rotulo: ['Berçário'], presencas: [false, false, false, false] }] },
  { nome: 'Sem Classe, Gil', sexo: 'M', classes: [] },
];

function esperado(pessoas, nDomingos) {
  return Array.from({ length: nDomingos }, (_, k) => {
    const porGrupo = {};
    for (const p of pessoas) for (const c of p.classes) {
      const g = grupoDaClasse(c.rotulo.join(' '));
      porGrupo[g] ||= { presentes: 0, matriculados: 0 };
      porGrupo[g].matriculados++;
      if (c.presencas[k]) porGrupo[g].presentes++;
    }
    return porGrupo;
  });
}

test('frequência às classes: 4 domingos, conta por grupo pelos ícones, sem nomes', () => {
  const pessoas = pessoasDeExemplo();
  const { paginas, icones } = frequencia(['4 Out', '11 Out', '18 Out', '25 Out'], pessoas);
  assert.equal(tipoDePdfLcr(paginas), 'frequencia-classes');
  const f = lerFrequenciaClasses(paginas, icones, { hoje: HOJE });
  assert.deepEqual([f.ala, f.unidade, f.mes, f.pessoas], ['Ala Exemplo 9', '000009', '2026-10', 7]);
  assert.deepEqual(f.semanas.map(s => s.data), ['2026-10-04', '2026-10-11', '2026-10-18', '2026-10-25']);
  assert.deepEqual(f.semanas.map(s => s.porGrupo), esperado(pessoas, 4));
  assert.deepEqual(f.semanas.map(s => s.registrada), [true, true, true, false]);   // 25/10 ainda não chegou
  assert.deepEqual(f.semanas[0].total, { presentes: 4, matriculados: 10 });
  assert.equal(f.icones.presentes + f.icones.ausentes, 40);
  assert.equal(f.icones.presentes, 14);
  assert.equal(f.icones.ignorados, 1);   // o botão do filtro (os 7 glifos de tendência nem têm forma de ícone)
  assert.equal(f.icones.semRotulo, 0);
  assert.deepEqual(f.rotulosOutros, {});
  assert.deepEqual(f.avisos, []);
  assert.deepEqual(f.classes.find(c => c.rotulo === 'Escola Dominical Curso 11'), { rotulo: 'Escola Dominical Curso 11', grupo: 'escolaDominicalJovens', matriculados: 1 });
  assert.equal(f.classes.find(c => c.rotulo === 'Escola Dominical para adultos').matriculados, 2);
  const tudo = JSON.stringify(f);
  for (const p of pessoas) assert.ok(!tudo.includes(p.nome.split(',')[1].trim()), 'nome na leitura da frequência');
});

test('frequência às classes: mês de 5 domingos em escala menor, várias páginas', () => {
  const muitas = [];
  for (let i = 0; i < 30; i++) {
    muitas.push({ nome: `Exemplo, Pessoa ${i}`, sexo: i % 2 ? 'M' : 'F', classes: [
      { rotulo: ED_ADULTOS, presencas: [i % 3 === 0, false, i % 4 === 0, false, i % 5 === 0] },
      { rotulo: i % 2 ? ELDERES : SOCORRO, presencas: [false, i % 2 === 0, false, i % 3 === 0, false] },
    ] });
  }
  const { paginas, icones } = frequencia(['2 Ago', '9 Ago', '16 Ago', '23 Ago', '30 Ago'], muitas);
  assert.ok(paginas.length >= 3, 'o exemplo deveria ocupar várias páginas');
  const f = lerFrequenciaClasses(paginas, icones, { hoje: HOJE });
  assert.equal(f.mes, '2026-08');
  assert.equal(f.pessoas, 30);
  assert.deepEqual(f.semanas.map(s => s.data), ['2026-08-02', '2026-08-09', '2026-08-16', '2026-08-23', '2026-08-30']);
  assert.deepEqual(f.semanas.map(s => s.porGrupo), esperado(muitas, 5));
  assert.equal(f.icones.semRotulo, 0);
  assert.deepEqual(f.avisos, []);
});

test('frequência às classes: rótulo partido pela quebra de página (para os dois lados)', () => {
  const enche = Array.from({ length: 9 }, (_, i) => ({ nome: `Exemplo, Enche ${i}`, sexo: 'F', classes: [{ rotulo: SOCORRO, presencas: [true, false, false, false] }] }));
  for (const partir of ['depois', 'antes']) {
    const pessoas = [...enche, { nome: 'Exemplo, Partida', sexo: 'M', classes: [
      { rotulo: ED_ADULTOS, presencas: [false, true, false, false], partir },
      { rotulo: ELDERES, presencas: [true, true, false, false] },
    ] }];
    const { paginas, icones } = frequencia(['5 Jul', '12 Jul', '19 Jul', '26 Jul'], pessoas);
    assert.equal(paginas.length, 2, partir);
    const f = lerFrequenciaClasses(paginas, icones, { hoje: HOJE });
    assert.deepEqual(f.rotulosOutros, {}, partir);
    assert.deepEqual(f.semanas.map(s => s.porGrupo), esperado(pessoas, 4), partir);
    assert.ok(f.classes.some(c => c.rotulo === 'Escola Dominical para adultos'), partir);
    assert.deepEqual(f.avisos, [], partir);
  }
});

test('frequência às classes: sem cabeçalho ou sem ícones, avisa', () => {
  const pg = [];
  trecho(pg, 'Frequência à classe e ao quórum', 28.5, 799, 15);
  assert.equal(lerFrequenciaClasses([pg], [[]]).avisos.length, 1);
  const { paginas } = frequencia(['4 Out', '11 Out'], pessoasDeExemplo().slice(0, 2));
  const f = lerFrequenciaClasses(paginas, [], { hoje: HOJE });
  assert.ok(f.avisos.some(a => /ícone/.test(a)));
  assert.deepEqual(f.semanas, []);   // nada a gravar: a prévia recusa
});

// O anel que mudou de desenho (aqui, com uma reta): sem nenhum anel reconhecido
// não há a medida dos ícones. Antes, a medida vinha de "todas as formas" — a do
// glifo de tendência, um por pessoa —, e os glifos viravam presenças (100% num
// domingo) que, gravadas, trocavam os domingos já guardados.
test('frequência às classes: sem nenhum anel reconhecido, não conta nada (nem o glifo)', () => {
  const pessoas = pessoasDeExemplo();
  const { paginas, icones } = frequencia(['4 Out', '11 Out', '18 Out', '25 Out'], pessoas);
  const torto = icones.map(l => l.map(c => (c.retas === 0 && c.curvas >= 8 ? { ...c, retas: 1 } : c)));
  // sobra o círculo do filtro (9 × 9): a medida vira a dele, e nenhum ícone de
  // verdade passa — nada contado, nenhum domingo registrado, nenhuma classe (a prévia recusa)
  const f = lerFrequenciaClasses(paginas, torto, { hoje: HOJE });
  assert.equal(f.icones.presentes + f.icones.ausentes, 0);
  assert.ok(f.semanas.every(s => !s.registrada));
  assert.deepEqual(f.classes, []);
  // sem o filtro: nenhum anel — o aviso, e nenhuma semana
  const semFiltro = torto.map(l => l.filter(c => c.pintura !== 'stroke'));
  const g = lerFrequenciaClasses(paginas, semFiltro, { hoje: HOJE });
  assert.deepEqual(g.semanas, []);
  assert.ok(g.avisos.some(a => /ausência/.test(a)), g.avisos.join(' '));
  // o glifo (10,6 × 11,3, curvas e retas) não passa mais pela forma, nem sozinho
  assert.equal(formaDoIcone({ w: 10.6, h: 11.3, curvas: 8, retas: 12, subcaminhos: 3, pintura: 'fill' }), null);
  assert.equal(formaDoIcone({ w: 9.0, h: 9.5, curvas: 8, retas: 12, subcaminhos: 3, pintura: 'fill' }), null);
  assert.equal(formaDoIcone({ w: 10.5, h: 10.5, ...ICONE_PRESENTE }), 'presente');
});

test('forma do ícone: ✓, anel, anel de um subcaminho, contorno e o que não é', () => {
  const q = { w: 12.5, h: 12.5 };
  assert.equal(formaDoIcone({ ...q, ...ICONE_PRESENTE }), 'presente');
  assert.equal(formaDoIcone({ ...q, ...ICONE_AUSENTE }), 'ausente');
  assert.equal(formaDoIcone({ ...q, ...ICONE_AUSENTE_1 }), 'ausente');
  assert.equal(formaDoIcone({ ...q, curvas: 4, retas: 0, subcaminhos: 1, pintura: 'stroke' }), 'ausente');
  assert.equal(formaDoIcone({ ...q, curvas: 4, retas: 0, subcaminhos: 1, pintura: 'fill' }), null);   // disco cheio: ambíguo
  assert.equal(formaDoIcone({ w: 10.6, h: 12.5, curvas: 8, retas: 12, subcaminhos: 3, pintura: 'fill' }), null);   // não é quadrado
  assert.equal(formaDoIcone(null), null);
  assert.equal(formaDoIcone({ w: 0, h: 0 }), null);
});

test('grupo de cada classe', () => {
  const casos = {
    'Escola Dominical para adultos': 'escolaDominicalAdultos', 'Sociedade de Socorro': 'sociedadeSocorro',
    'Quórum de Élderes': 'quorumElderes', 'Quórum de Sacerdotes': 'rapazes', 'Quórum de Mestres': 'rapazes',
    'Quórum de Diáconos': 'rapazes', 'Guardiãs da luz': 'mocas', 'Mensageiras da esperança': 'mocas',
    'Edificadoras da fé': 'mocas', 'Escola Dominical Curso 11': 'escolaDominicalJovens', 'Curso 17': 'escolaDominicalJovens',
    'Curso 12': 'escolaDominicalJovens', 'Valorosos 9': 'primaria', 'CTR 4': 'primaria', 'Raios de Sol': 'primaria',
    'Berçário': 'primaria', 'Curso 7': 'primaria', 'Atividades da Primária': 'primaria', 'Coral da ala': 'outros',
  };
  for (const [rotulo, g] of Object.entries(casos)) assert.equal(grupoDaClasse(rotulo), g, rotulo);
  assert.ok(CHAVES_GRUPO.includes('outros'));
});

test('ano dos domingos sem ano: o que faz de todos um domingo', () => {
  const dm = l => l.map(([dia, mes]) => ({ dia, mes }));
  assert.deepEqual(anoDasSemanas(dm([[4, 10], [11, 10], [18, 10], [25, 10]]), HOJE), ['2026-10-04', '2026-10-11', '2026-10-18', '2026-10-25']);
  assert.deepEqual(anoDasSemanas(dm([[5, 7], [12, 7]]), HOJE), ['2026-07-05', '2026-07-12']);
  // dezembro → janeiro: o janeiro é do ano seguinte
  assert.deepEqual(anoDasSemanas(dm([[27, 12], [3, 1]]), '2027-01-10'), ['2026-12-27', '2027-01-03']);
  // um mês de anos atrás: o ano mais recente em que caiu no domingo
  assert.deepEqual(anoDasSemanas(dm([[1, 10]]), HOJE), ['2023-10-01']);
  // nenhum ano serve (só com uma data que não existe, como 30/02): fica o ano de hoje
  assert.deepEqual(anoDasSemanas(dm([[30, 2]]), HOJE), ['2026-02-30']);
});

// ---------- que PDF é este ----------
test('tipo de PDF: os desta aba pelo título, os outros pelo chamados-lcr', () => {
  const com = (texto, f = 10) => { const pg = []; trecho(pg, texto, 30, 800, f); return [pg]; };
  assert.equal(tipoDePdfLcr(trimestralDeExemplo().paginas), 'trimestral');
  assert.equal(tipoDePdfLcr(com('Organizações e Chamados')), 'chamados');
  assert.equal(tipoDePdfLcr(com('Lista de Membros')), 'membros');
  assert.equal(tipoDePdfLcr(com('Um PDF qualquer')), 'outro');
  assert.equal(tipoDePdfLcr([[]]), 'sem-texto');
  assert.equal(tipoDePdfLcr([]), 'sem-texto');
  assert.deepEqual(Object.keys(NOMES_DOS_PDFS).sort(), ['estatisticas', 'frequencia-classes', 'recomendacoes-adultos', 'recomendacoes-jovens', 'trimestral']);
});

// ---------- o adaptador do pdf.js (js/pdf-icones.js) ----------
// Um círculo de raio 10 em 4 curvas (a aproximação de Bézier), centrado na origem
const K = 5.5228;
const circulo = (cx = 0, cy = 0, r = 10) => [
  [OPS_PDFJS_3.moveTo, OPS_PDFJS_3.curveTo, OPS_PDFJS_3.curveTo, OPS_PDFJS_3.curveTo, OPS_PDFJS_3.curveTo, OPS_PDFJS_3.closePath],
  [cx + r, cy, cx + r, cy + K, cx + K, cy + r, cx, cy + r, cx - K, cy + r, cx - r, cy + K, cx - r, cy,
    cx - r, cy - K, cx - K, cy - r, cx, cy - r, cx + K, cy - r, cx + r, cy - K, cx + r, cy],
  [cx + r, cx + r, cy, cy],   // o minMax do pdf.js: só o moveTo (por isso não serve)
];

test('adaptador: caixa pela matriz corrente (save/restore/transform), recorte e moldura fora', () => {
  const O = OPS_PDFJS_3;
  const [ops, co, mm] = circulo();
  const ol = {
    fnArray: [O.save, O.transform, O.constructPath, O.eoFill, O.restore,
      O.constructPath, O.fill,                     // moldura grande (retângulo, sem curva)
      O.constructPath, O.endPath,                  // recorte
      O.save, O.transform, O.constructPath, O.fill, O.restore,
      O.paintFormXObjectBegin, O.constructPath, O.stroke, O.paintFormXObjectEnd,
      O.constructPath, O.fill],                    // depois do restore: sem a escala
    argsArray: [null, [0.625, 0, 0, -0.625, 147.886, 665.281], [[...ops, O.lineTo, O.lineTo], [...co, 2, 2, 3, 3], mm], null, null,
      [[O.rectangle], [0, 0, 500, 700], [0, 500, 0, 700]], null,
      [ops, co, mm], null,
      null, [3, 0, 0, 3, 0, 0], [ops, co, mm], null, null,
      [[1, 0, 0, 1, 300, 300], [0, 0, 50, 50]], [ops, co, mm], null, null,
      [ops, co, mm], null],
  };
  const c = caixasDoOperatorList(ol);
  assert.equal(c.length, 3);   // o círculo na escala 3 (60 pt) passa de 40 e fica fora
  const [a, b, d] = c;
  assert.ok(Math.abs(a.x - 141.636) < 0.01 && Math.abs(a.w - 12.5) < 0.01 && Math.abs(a.h - 12.5) < 0.01, JSON.stringify(a));
  assert.ok(Math.abs(a.y - 659.031) < 0.01);
  assert.deepEqual([a.curvas, a.retas, a.subcaminhos, a.pintura], [4, 2, 1, 'eoFill']);
  assert.deepEqual([b.x, b.y, b.w, b.pintura], [290, 290, 20, 'stroke']);   // dentro do form XObject
  assert.deepEqual([d.x, d.y, d.w, d.h, d.pintura], [-10, -10, 20, 20, 'fill']);
  assert.equal(MAX_LADO_ICONE, 40);
  assert.deepEqual(caixasDoOperatorList(null), []);
  assert.deepEqual(caixasDoOperatorList({ fnArray: [O.restore, O.fill, O.paintFormXObjectEnd], argsArray: [] }), []);
});

test('adaptador: lerPaginas junta texto e caixas por página', async () => {
  const O = OPS_PDFJS_3;
  const [ops, co, mm] = circulo(50, 50, 6);
  const pagina = n => ({
    getTextContent: async () => ({ items: [{ str: 'pág ' + n, transform: [8, 0, 0, 8, 10, 10], width: 20 }] }),
    getOperatorList: async () => ({ fnArray: [O.constructPath, O.fill], argsArray: [[ops, co, mm], null] }),
  });
  const doc = { numPages: 2, getPage: async n => pagina(n) };
  const so = await lerPaginas(doc);
  assert.equal(so.paginas.length, 2);
  assert.deepEqual(so.icones, []);
  const com = await lerPaginas(doc, { icones: true });
  assert.equal(com.icones.length, 2);
  assert.equal(com.icones[1][0].w, 12);
  assert.equal((await caixasDaPagina(pagina(1)))[0].x, 44);
});

// ---------- as metas e os participantes ----------
test('progresso até 1 e 2 alas (36.2)', () => {
  assert.deepEqual(METAS_ALA, { membros: 250, portadoresSM: 20, adultosParticipantes: 100, jovensParticipantes: 20 });
  assert.equal(METAS_ESTACA.alas, 5);
  const p = progressoQualificacao({ membros: 300, portadoresSM: null, adultosParticipantes: 80, jovensParticipantes: 25 });
  assert.deepEqual(p.map(c => c.chave), CRITERIOS.map(c => c.chave));
  const m = p.find(c => c.chave === 'membros');
  assert.deepEqual([m.atual, m.meta, m.metaDuas, m.pct, m.pctDuas, m.falta, m.faltaDuas], [300, 250, 500, 120, 60, 0, 200]);
  const s = p.find(c => c.chave === 'portadoresSM');
  assert.deepEqual([s.atual, s.pct, s.falta, s.sigiloso], [null, null, null, true]);
  const a = p.find(c => c.chave === 'adultosParticipantes');
  assert.deepEqual([a.falta, a.faltaDuas, a.estimativa], [20, 120, true]);
  assert.equal(progressoQualificacao().length, 4);
});

test('total de membros: Estatísticas, depois Trimestral, depois o quadro', () => {
  assert.deepEqual(totalDeMembros({ estatisticas: { valores: { totalMembros: 310 } }, trimestres: { '2026-T3': { linhas: [{ n: 10, real: 300 }] } } }), { valor: 310, fonte: 'estatisticas' });
  assert.deepEqual(totalDeMembros({ trimestres: { '2026-T2': { linhas: [{ n: 10, real: 290 }] }, '2026-T3': { linhas: [{ n: 10, real: 300 }] } } }), { valor: 300, fonte: 'trimestral' });
  assert.deepEqual(totalDeMembros({ quadro: [{}, {}, {}] }), { valor: 3, fonte: 'quadro' });
  assert.deepEqual(totalDeMembros(), { valor: null, fonte: '' });
});

const QUADRO = [
  { name: 'Exemplo, Ana', age: 40 }, { name: 'Exemplo, Bruno', age: 45 }, { name: 'Modelo, Carla', age: 16 },
  { name: 'Teste, Davi', age: 30 }, { name: 'Amostra, Eva', age: 70 }, { name: 'Jovem, Gil', age: 13 },
];

test('adultos participantes: chamado ∪ recomendação válida ∪ converso, uma vez por pessoa', () => {
  const r = participantesAdultos({
    membros: QUADRO,
    chamados: [
      { nome: 'EXEMPLO, ana', chamado: 'Presidente da Sociedade de Socorro' },
      { nome: 'Exemplo, Ana', chamado: 'Professora' },        // dois chamados, uma pessoa
      { nome: 'Modelo, Carla', chamado: 'Presidente da Classe' },   // jovem: não conta aqui
      { nome: 'Fora do Quadro, Fulano', chamado: 'Professor' },
      { nome: '', chamado: 'Vago' },
    ],
    recomendacoes: [
      { nome: 'Exémplo, Ana', idade: 40, situacao: 'ativa' },
      { nome: 'Teste, Davi', idade: 30, situacao: 'para-vencer' },
      { nome: 'Amostra, Eva', idade: 70, situacao: 'vencida' },
    ],
    conversos: ['Davi Teste'],
  });
  assert.equal(r.total, 2);
  assert.deepEqual(r.porMotivo, { chamado: 1, recomendacao: 2, converso: 1 });
  assert.deepEqual(r.combinacoes, { 'chamado+recomendacao': 1, 'recomendacao+converso': 1 });
  assert.equal(r.naoEncontrados, 1);
});

test('jovens participantes: recomendação de uso limitado ∪ chamado de jovem', () => {
  const r = participantesJovens({
    membros: QUADRO,
    chamados: [{ nome: 'Modelo, Carla', chamado: 'Presidente da Classe' }, { nome: 'Exemplo, Ana', chamado: 'Professora' }],
    recomendacoes: [
      { nome: 'Modelo, Carla', idade: 16, situacao: 'ativa' },
      { nome: 'Jovem, Gil', idade: 13, situacao: 'ativa' },
      { nome: 'Jovem, Hugo', idade: 12, situacao: '' },
      { nome: 'Jovem, Ivo', idade: 18, situacao: 'ativa' },   // 18: já é adulto
    ],
  });
  assert.equal(r.total, 2);
  assert.deepEqual(r.combinacoes, { 'chamado+recomendacao': 1, recomendacao: 1 });
  assert.equal(participantesAdultos({ membros: [], recomendacoes: [{ nome: 'Jovem, Ivo', idade: 18, situacao: 'ativa' }] }).total, 1);
  assert.equal(participantesJovens({}).total, 0);
});

test('liderança: as presidências da ala, com o que falta', () => {
  const l = liderancaChave([
    { chamado: 'Bispo', nome: 'Exemplo, Bruno' },
    { chamado: 'Primeiro Conselheiro no Bispado', nome: '' },
    { chamado: 'Segundo Conselheiro no Bispado', nome: 'Teste, Davi' },
    { chamado: 'Secretário da Ala', nome: 'Amostra, Ele' },
    { chamado: 'Presidente da Sociedade de Socorro', nome: 'Exemplo, Ana' },
    { chamado: 'Primeira Conselheira na Presidência da Sociedade de Socorro', nome: 'Amostra, Eva' },
    { chamado: 'Secretária da Sociedade de Socorro', nome: 'Modelo, Lu' },
    { chamado: 'Presidente do Quórum de Élderes', nome: 'Teste, Ian' },
    { chamado: 'Presidente da Classe das Moças', nome: 'Modelo, Carla' },   // é de jovem: não é a presidência das Moças
  ]);
  const de = c => l.find(x => x.chave === c);
  assert.deepEqual(l.map(x => x.chave), ['bispado', 'elderes', 'socorro', 'mocas', 'primaria', 'escolaDominical']);
  assert.deepEqual([de('bispado').preenchidos, de('bispado').total, de('bispado').vagos], [3, 5, ['Primeiro Conselheiro no Bispado', 'Secretário Executivo da Ala']]);
  assert.deepEqual([de('socorro').preenchidos, de('socorro').vagos], [3, ['Segunda conselheira']]);
  assert.deepEqual([de('elderes').preenchidos, de('mocas').preenchidos], [1, 0]);
});

// ---------- sacramental e tendência ----------
test('frequência sacramental: média e % por mês e por ano, meses vazios incluídos', () => {
  const atas = [
    { data: '2026-09-06', frequencia: '100' }, { data: '2026-09-13', frequencia: '110' },
    { data: '2026-10-04', frequencia: 90 }, { data: '2026-10-11', frequencia: '' }, { data: '2026-10-11', frequencia: '95' },
    { data: '2026-10-18', frequencia: 'cento' }, { data: '2026-10-25', frequencia: '0' }, { data: 'ontem', frequencia: '50' },
    { data: '2025-10-05', frequencia: '120' },
  ];
  const f = frequenciaSacramental(atas, { membros: 380, hoje: HOJE, meses: 3 });
  assert.deepEqual(f.porMes.map(m => m.mes), ['2026-08', '2026-09', '2026-10']);
  assert.deepEqual(f.porMes.map(m => [m.semanas.length, m.media, m.pct]), [[0, null, null], [2, 105, 28], [2, 93, 24]]);
  assert.deepEqual(f.porAno, { 2025: { media: 120, pct: 32, semanas: 1 }, 2026: { media: 99, pct: 26, semanas: 4 } });
  assert.equal(frequenciaSacramental(atas, { hoje: HOJE }).porMes.length, 12);
  assert.equal(frequenciaSacramental(atas, { hoje: HOJE }).porAno['2026'].pct, null);   // sem total de membros, sem %
});

test('histórico da sacramental: informado nos anos passados, calculado no corrente', () => {
  const h = historicoSacramental({ 2022: 41, 2023: 36, 2026: 20 }, {
    2024: { pct: 35, semanas: MIN_SEMANAS_ANO }, 2025: { pct: 31, semanas: 2 }, 2026: { pct: 22, semanas: 5 },
  }, 2026);
  assert.deepEqual(h, [
    { ano: 2022, pct: 41, fonte: 'informado' }, { ano: 2023, pct: 36, fonte: 'informado' },
    { ano: 2024, pct: 35, fonte: 'calculado', semanas: MIN_SEMANAS_ANO },   // meio ano de atas: vale
    // 2025: 2 domingos de dezembro e nenhum % do LCR — não é o ano, e fica sem coluna
    { ano: 2026, pct: 22, fonte: 'calculado', semanas: 5 },                 // o corrente sai das atas
  ]);
  // ano passado com o % do LCR: vale o informado, mesmo com o ano inteiro nas atas
  assert.deepEqual(historicoSacramental({ 2025: 31 }, { 2025: { pct: 28, semanas: 50 } }, 2026), [{ ano: 2025, pct: 31, fonte: 'informado' }]);
  assert.deepEqual(historicoSacramental({ 2024: 34 }, {}, 2026), [{ ano: 2024, pct: 34, fonte: 'informado' }]);
});

test('tendência por grupo: as 4 semanas mais recentes contra as 4 anteriores', () => {
  const semanas = [];
  for (let i = 0; i < 8; i++) {
    const d = new Date(2026, 6, 5 + 7 * i);
    semanas.push({
      data: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      registrada: true,
      porGrupo: { sociedadeSocorro: { presentes: i < 4 ? 30 : 20, matriculados: 100 }, primaria: { presentes: 10, matriculados: 20 } },
    });
  }
  semanas.push({ data: '2026-08-30', registrada: false, porGrupo: { sociedadeSocorro: { presentes: 0, matriculados: 100 } } });
  const t = tendenciaPorGrupo(semanas);
  const ss = t.find(g => g.grupo === 'sociedadeSocorro'), pr = t.find(g => g.grupo === 'primaria');
  assert.equal(ss.serie.length, 8);   // a semana sem registro fica de fora
  assert.deepEqual([ss.taxaRecente, ss.taxaAnterior, ss.variacao, ss.direcao], [0.2, 0.3, -10, 'desce']);
  assert.deepEqual([pr.variacao, pr.direcao], [0, 'estavel']);
  assert.equal(t.length, 2);
  const curta = tendenciaPorGrupo(semanas.slice(0, 3));
  assert.deepEqual([curta[0].variacao, curta[0].direcao], [null, null]);
});

// No horário de duas horas, as Moças se reúnem num domingo e a Escola Dominical
// no outro — e o LCR desenha o anel de ausente de todas em todos os domingos
test('tendência por grupo: o domingo sem reunião do grupo (0 presenças) fica fora', () => {
  const semanas = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(2026, 6, 5 + 7 * i);
    return {
      data: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      registrada: true,
      porGrupo: {
        mocas: { presentes: i % 2 ? 0 : 10, matriculados: 40 },
        escolaDominicalAdultos: { presentes: i % 2 ? 30 : 0, matriculados: 100 },
        quorumElderes: { presentes: 0, matriculados: 30 },   // nunca marcado
      },
    };
  });
  const t = tendenciaPorGrupo(semanas);
  const m = t.find(g => g.grupo === 'mocas'), ed = t.find(g => g.grupo === 'escolaDominicalAdultos'), q = t.find(g => g.grupo === 'quorumElderes');
  assert.deepEqual([m.serie.length, m.semReuniao, m.taxaRecente, m.matriculados], [4, 3, 0.25, 40]);   // 25%, não 13%
  assert.deepEqual([m.variacao, m.direcao], [null, null]);   // 4 domingos com reunião: nada antes para comparar
  assert.deepEqual([ed.serie.length, ed.taxaRecente], [3, 0.3]);
  // o grupo sem presença nenhuma continua na lista — é o "quase ninguém marcado"
  assert.deepEqual([q.serie, q.taxaRecente, q.matriculados, q.direcao], [[], 0, 30, null]);
  assert.deepEqual(gruposSemMarcacao(t), ['quorumElderes']);
});

// ---------- o documento do servidor ----------
const resumoAdultos = () => resumoRecomendacoes(
  [{ sexo: 'F', idade: 30, situacao: 'ativa', validade: '2027-01' }, { sexo: 'M', idade: 50, situacao: 'vencida', validade: '2025-02' }],
  { tipo: 'adultos', data: '2026-10-18', contagem: 2 });

test('corpo do POST: só as seções e chaves conhecidas, do tipo certo', () => {
  const t = lerTrimestral(trimestralDeExemplo().paginas);
  const r = limparCorpoCrescimento({
    publico: {
      trimestral: { ...t, extra: 'x' },
      recomendacoes: { adultos: resumoAdultos() },
      frequenciaClasses: { semanas: [{ data: '2026-10-04', porGrupo: { sociedadeSocorro: { presentes: 3, matriculados: 10 } }, total: {}, nome: 'x' }] },
      historicoSacramental: { 2022: 41, 2023: null },
      inventado: { a: 1 },
    },
    privado: {
      recomendacoesPessoas: { adultos: [{ nome: 'Exemplo, Ana', sexo: 'F', idade: 30, situacao: 'ativa', validade: '2027-01', telefone: '9' }] },
      portadoresAtivosDizimistas: 18,
      participantes: { adultos: 70 },
    },
  });
  assert.equal(r.erro, undefined, r.erro);
  const p = r.parcial;
  assert.deepEqual(Object.keys(p.publico).sort(), ['frequenciaClasses', 'historicoSacramental', 'recomendacoes', 'trimestral']);
  assert.equal(p.publico.trimestral.extra, undefined);
  assert.equal(p.publico.trimestral.linhas.length, 9);
  assert.deepEqual(p.publico.frequenciaClasses.semanas[0], { data: '2026-10-04', porGrupo: { sociedadeSocorro: { presentes: 3, matriculados: 10 } }, registrada: true });
  assert.deepEqual(p.publico.historicoSacramental, { 2022: 41, 2023: null });
  assert.deepEqual(p.privado.recomendacoesPessoas.adultos[0], { nome: 'Exemplo, Ana', sexo: 'F', idade: 30, situacao: 'ativa', validade: '2027-01' });
  assert.equal(p.privado.portadoresAtivosDizimistas, 18);
  assert.deepEqual(p.privado.participantes, { adultos: 70 });
  assert.equal(p.publico.recomendacoes.adultos.porMesValidade['2027-01'], 1);
});

test('corpo do POST: o que está errado recusa tudo', () => {
  const ruins = [
    null, [], { publico: [] }, { privado: 'x' },
    { publico: { trimestral: { trimestre: 5, ano: 2026, linhas: [] } } },
    { publico: { trimestral: { trimestre: 3, ano: 2026, linhas: [{ n: 1, real: -1 }] } } },
    { publico: { trimestral: { trimestre: 3, ano: 2026, linhas: [{ n: 1, secao: 'nenhuma' }] } } },
    { publico: { estatisticas: { valores: { totalMembros: '312' } } } },
    { publico: { recomendacoes: { adultos: { tipo: 'jovens' } } } },
    { publico: { recomendacoes: { adultos: { porMesValidade: { '2027-13': 1 } } } } },
    { publico: { frequenciaClasses: { semanas: [{ data: '2026-10-04', porGrupo: { inventado: { presentes: 1, matriculados: 1 } } }] } } },
    { publico: { frequenciaClasses: { semanas: [{ data: '2026-10-04', porGrupo: { primaria: { presentes: 5, matriculados: 1 } } }] } } },
    { publico: { historicoSacramental: { 2022: 140 } } },
    { privado: { recomendacoesPessoas: { adultos: [{ nome: '' }] } } },
    { privado: { recomendacoesPessoas: { adultos: Array.from({ length: MAX_PESSOAS + 1 }, () => ({ nome: 'A' })) } } },
    { privado: { recomendacoesPessoas: { jovens: [{ nome: 'A', validade: 'mai. 2027' }] } } },
    { privado: { portadoresAtivosDizimistas: 2.5 } },
    { privado: { participantes: { adultos: 'muitos' } } },
  ];
  for (const corpo of ruins) assert.ok(limparCorpoCrescimento(corpo).erro, JSON.stringify(corpo)?.slice(0, 80));
  assert.deepEqual(limparCorpoCrescimento({}).parcial, { publico: {}, privado: {} });
});

test('fundir: cada seção troca só a si mesma', () => {
  const agora = '2026-10-18T12:00:00.000Z', depois = '2026-10-19T12:00:00.000Z';
  const t3 = limparCorpoCrescimento({ publico: { trimestral: lerTrimestral(trimestralDeExemplo().paginas) } }).parcial;
  let doc = fundirCrescimento(null, t3, agora);
  const p2 = limparCorpoCrescimento({
    publico: {
      trimestral: { trimestre: 2, ano: 2026, linhas: [] },
      recomendacoes: { adultos: resumoAdultos() },
      frequenciaClasses: { semanas: [
        { data: '2026-10-11', porGrupo: { primaria: { presentes: 5, matriculados: 10 } } },
        { data: '2026-10-25', porGrupo: { primaria: { presentes: 0, matriculados: 10 } } },
      ] },
      historicoSacramental: { 2022: 41, 2023: 36 },
    },
    privado: { recomendacoesPessoas: { adultos: [{ nome: 'Exemplo, Ana', situacao: 'ativa' }] }, portadoresAtivosDizimistas: 18 },
  }).parcial;
  doc = fundirCrescimento(doc, p2, depois);
  assert.deepEqual(Object.keys(doc.publico.trimestral), ['2026-T2', '2026-T3']);
  assert.equal(doc.publico.trimestral['2026-T3'].linhas.length, 9);
  assert.equal(doc.publico.importadoEm.trimestral, depois);
  assert.equal(doc.publico.recomendacoes.jovens, null);
  // o mês seguinte: a semana sem registro não apaga a registrada, e a nova entra
  const p3 = limparCorpoCrescimento({
    publico: { frequenciaClasses: { semanas: [
      { data: '2026-10-11', porGrupo: { primaria: { presentes: 0, matriculados: 10 } }, registrada: false },
      { data: '2026-10-25', porGrupo: { primaria: { presentes: 7, matriculados: 10 } } },
    ] }, historicoSacramental: { 2023: null, 2024: 34 } },
    privado: { participantes: { jovens: 12 } },
  }).parcial;
  doc = fundirCrescimento(doc, p3, depois);
  assert.deepEqual(doc.publico.frequenciaClasses.semanas.map(s => [s.data, s.porGrupo.primaria.presentes]), [['2026-10-11', 5], ['2026-10-25', 7]]);
  assert.deepEqual(doc.publico.historicoSacramental, { 2022: 41, 2024: 34 });
  assert.equal(doc.publico.recomendacoes.adultos.lidos, 2);   // importar outra coisa não apagou
  assert.equal(doc.privado.recomendacoesPessoas.adultos.length, 1);
  assert.equal(doc.privado.portadoresAtivosDizimistas, 18);
  assert.deepEqual(doc.privado.participantes, { adultos: null, jovens: 12 });
  // um POST só com o privado não mexe no atualizadoEm do público
  const so = fundirCrescimento(doc, limparCorpoCrescimento({ privado: { portadoresAtivosDizimistas: null } }).parcial, '2026-10-20T00:00:00.000Z');
  assert.equal(so.publico.atualizadoEm, depois);
  assert.equal(so.privado.atualizadoEm, '2026-10-20T00:00:00.000Z');
  assert.equal(so.privado.portadoresAtivosDizimistas, null);
});

test('resposta do GET: o privado só com a sessão; documento estranho é erro, não "vazio"', () => {
  const doc = fundirCrescimento(null, limparCorpoCrescimento({
    publico: { historicoSacramental: { 2022: 41 } },
    privado: { recomendacoesPessoas: { adultos: [{ nome: 'Exemplo, Ana', situacao: 'ativa' }] } },
  }).parcial);
  const semSessao = respostaCrescimento(doc, false);
  assert.deepEqual(Object.keys(semSessao), ['publico']);
  assert.ok(!JSON.stringify(semSessao).includes('Exemplo'));
  assert.equal(respostaCrescimento(doc, true).privado.recomendacoesPessoas.adultos[0].nome, 'Exemplo, Ana');
  assert.deepEqual(normalizarDocCrescimento(null), docCrescimentoVazio());
  assert.equal(normalizarDocCrescimento('texto'), null);
  assert.equal(normalizarDocCrescimento({ publico: [] }), null);
  const velho = normalizarDocCrescimento({ publico: { historicoSacramental: { 2022: 41 } } });
  assert.deepEqual(velho.publico.frequenciaClasses, { semanas: [] });
  assert.deepEqual(velho.privado.participantes, { adultos: null, jovens: null });
  assert.deepEqual(respostaCrescimento(undefined, false), { publico: docCrescimentoVazio().publico });
  assert.equal(respostaCrescimento('texto', true), null);
});
