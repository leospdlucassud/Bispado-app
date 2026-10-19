// Cada PDF do LCR entra por UM importador — `npm test`. São três botões
// "📄 Importar PDF do LCR" (Membros, Chamados e Vamos crescer a Ala) e sete
// relatórios; o que for de outra aba recebe o aviso "importe lá". O risco que
// isto guarda: as recomendações e a frequência às classes têm "Nome | Sexo" no
// cabeçalho, como a Lista de Membros, e o tipoDePdf antigo (chamados-lcr.js) as
// tomava por ela — a aba Membros trocaria o quadro inteiro por quem tem
// recomendação. PDFs SINTÉTICOS, com a geometria do LCR e gente inventada.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { tipoDePdf } from '../js/chamados-lcr.js';
import { ABA_DO_PDF, NOMES_DOS_PDFS, abaDoPdf, tipoDePdfLcr } from '../js/crescimento-lcr.js';
import { lerPdfMembros } from '../js/membros-lcr.js';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const ler = arq => readFileSync(join(RAIZ, arq), 'utf8');

// um trecho do pdf.js; `partes`: o acento que vem solto ("Situa"+"çã"+"o")
const trecho = (pg, str, x, y, f = 8) => pg.push({ str, transform: [f, 0, 0, f, x, y], width: str.length * f * 0.5, hasEOL: false });
function colados(pg, partes, x, y, f = 9) {
  for (const p of partes) {
    if (p.startsWith(' ')) x += f * 0.3;
    const s = p.trim();
    trecho(pg, s, x, y, f);
    x += s.length * f * 0.5;
  }
}
const linha = (pg, celulas, y, f = 7) => celulas.forEach(([s, x]) => trecho(pg, s, x, y, f));
const rodape = pg => trecho(pg, '18 out. 2026 Somente para Uso da Igreja', 28, 11, 7);
const ALA = 'Ala Exemplo 9 (000009)';

// A 1ª página de cada relatório, como o "Salvar como PDF" do Chrome a grava
const PDFS = {
  membros() {
    const pg = [];
    trecho(pg, 'Lista de Membros', 28, 810, 12); trecho(pg, ALA, 28, 795, 9);
    linha(pg, [['Nome', 34], ['Sexo', 180], ['Idade', 215], ['Data de nascimento', 250], ['Telefone', 340], ['E-mail', 440]], 770);
    linha(pg, [['Exemplo, Ana', 34], ['F', 180], ['30', 215], ['1 jan. 1996', 250], ['(00) 90000-0001', 340], ['ana@example.com', 440]], 755);
    rodape(pg);
    return [pg];
  },
  chamados() {
    const pg = [];
    trecho(pg, ALA, 28, 815, 9); trecho(pg, 'Organizações e Chamados', 28, 800, 12); trecho(pg, 'Estaca Exemplo Brasil (000001)', 28, 785, 9);
    trecho(pg, 'Bispado', 35, 760, 10);
    linha(pg, [['Chamado', 35], ['Nome', 216], ['Apoiado', 342], ['Designado', 420]], 745);
    linha(pg, [['Bispo', 35], ['Exemplo, Bruno', 216], ['13 set. 2026', 342], ['✓', 420]], 730);
    rodape(pg);
    return [pg];
  },
  trimestral() {
    const pg = [];
    trecho(pg, 'Relatório Trimestral', 28.3, 824.6, 9); trecho(pg, ALA, 249.4, 824.6, 9); trecho(pg, 'Trimestre 3 - 2026', 493.7, 824.6, 9);
    linha(pg, [['Real', 431], ['Potencial', 452], ['2026', 493], ['2025', 516], ['2021', 540]], 780.9, 7.5);
    trecho(pg, 'Indicadores de conversão e de crescimento da Igreja', 37.7, 765, 7.5);
    linha(pg, [['1', 38.5], ['Pessoas que são seladas ao cônjuge no templo', 48.6], ['30', 434], ['60', 465], ['50%', 495], ['45%', 518], ['40%', 541]], 748, 7.5);
    rodape(pg);
    return [pg];
  },
  estatisticas() {
    const pg = [];
    colados(pg, ['Estat', 'í', 'sticas da Unidade'], 34.5, 810, 12); trecho(pg, ALA, 34.5, 795, 9);
    linha(pg, [['Total de Membros', 34.5], ['300', 548]], 770, 8);
    colados(pg, ['Fam', 'í', 'lias'], 34.5, 755, 8); trecho(pg, '120', 548, 755, 8);
    rodape(pg);
    return [pg];
  },
  'recomendacoes-adultos'() {
    const pg = [];
    trecho(pg, ALA, 47, 815, 6.6);
    colados(pg, ['Situa', 'çã', 'o de Recomenda', 'çã', 'o para o Templo'], 47, 800, 11);
    trecho(pg, 'Estaca Exemplo Brasil (000001)', 47, 785, 6.6);
    linha(pg, [['Nome', 46.5], ['Sexo', 264.9], ['Idade', 292.7], ['Tipo de Recomendação', 322.7], ['Situação', 461.4], ['Validade', 520.8]], 760, 6.6);
    linha(pg, [['Exemplo, Ana', 46.5], ['F', 264.9], ['30', 292.7], ['Investidura', 322.7], ['Ativa', 461.4], ['mai. 2027', 520.8]], 748, 6.6);
    linha(pg, [['Modelo, Bruno', 46.5], ['M', 264.9], ['45', 292.7], ['Investidura', 322.7], ['Vencida', 461.4], ['fev. 2026', 520.8]], 738, 6.6);
    trecho(pg, 'Contagem: 2', 47, 720, 6.6);
    trecho(pg, '18 Oct 2026 Somente para Uso da Igreja', 28, 11, 7);
    return [pg];
  },
  'recomendacoes-jovens'() {
    const pg = [];
    trecho(pg, ALA, 47, 815, 6.6);
    colados(pg, ['Situa', 'çã', 'o da Recomenda', 'çã', 'o do Jovem'], 47, 800, 11);
    linha(pg, [['Nome', 46.5], ['Sexo', 335.5], ['Idade', 373.6], ['Situação', 414.7], ['Validade', 502.7]], 760, 6.6);
    linha(pg, [['Jovem, Caio', 46.5], ['M', 335.5], ['14', 373.6], ['Ativa', 414.7], ['jan. 2027', 502.7]], 748, 6.6);
    linha(pg, [['Jovem, Duda', 46.5], ['F', 335.5], ['12', 373.6]], 738, 6.6);   // sem recomendação: sem situação
    trecho(pg, 'Contagem: 2', 47, 720, 6.6);
    return [pg];
  },
  'frequencia-classes'() {
    const pg = [];
    trecho(pg, ALA, 34, 815, 9);
    colados(pg, ['Frequ', 'ê', 'ncia ', 'à', ' classe e ao qu', 'ó', 'rum'], 34, 800, 12);
    linha(pg, [['Nome', 34], ['Sexo', 100], ['4 Out', 160], ['11 Out', 260], ['18 Out', 360], ['25 Out', 460]], 770, 8.8);
    linha(pg, [['Exemplo, Ana', 34], ['F', 100], ['Sociedade de', 175], ['Sociedade de', 275]], 750, 8.8);
    rodape(pg);
    return [pg];
  },
};
const IMPORTADORES = ['membros', 'chamados', 'crescimento'];
const ESPERADO = {
  membros: 'membros', chamados: 'chamados', trimestral: 'crescimento', estatisticas: 'crescimento',
  'recomendacoes-adultos': 'crescimento', 'recomendacoes-jovens': 'crescimento', 'frequencia-classes': 'crescimento',
};

test('cada relatório do LCR é reconhecido pelo título', () => {
  for (const [tipo, pdf] of Object.entries(PDFS)) assert.equal(tipoDePdfLcr(pdf()), tipo, tipo);
  // os dois que não são de aba nenhuma
  assert.equal(tipoDePdfLcr([[]]), 'sem-texto');
  const qualquer = []; trecho(qualquer, 'Programa da reunião sacramental', 30, 800, 12);
  assert.equal(tipoDePdfLcr([qualquer]), 'outro');
});

test('a armadilha: o tipoDePdf antigo toma as listas com "Nome | Sexo" pela Lista de Membros', () => {
  for (const tipo of ['recomendacoes-adultos', 'recomendacoes-jovens', 'frequencia-classes']) {
    assert.equal(tipoDePdf(PDFS[tipo]()), 'membros', tipo);
  }
  // e o leitor da Lista de Membros as leria: a aba Membros trocaria o quadro por esta lista
  assert.ok(lerPdfMembros(PDFS['recomendacoes-adultos']()).membros.length > 0);
});

test('cada relatório vai para exatamente um importador', () => {
  for (const [tipo, pdf] of Object.entries(PDFS)) {
    const t = tipoDePdfLcr(pdf());
    const aceitam = IMPORTADORES.filter(aba => abaDoPdf(t) === aba);
    assert.deepEqual(aceitam, [ESPERADO[tipo]], tipo);
  }
  // a tabela cobre os sete, e a aba Vamos crescer a Ala fica com os seus cinco
  assert.deepEqual(Object.keys(ABA_DO_PDF).sort(), Object.keys(ESPERADO).sort());
  assert.deepEqual(Object.keys(ABA_DO_PDF).filter(t => ABA_DO_PDF[t] === 'crescimento').sort(), Object.keys(NOMES_DOS_PDFS).sort());
  // o que não é relatório não é de aba nenhuma (nem uma chave herdada do Object)
  for (const t of ['sem-texto', 'outro', '', undefined, 'toString', '__proto__']) assert.equal(abaDoPdf(t), '', String(t));
});

test('os três importadores perguntam ao abaDoPdf e mandam o resto para a aba certa', () => {
  const IMPORTADOR = { membros: 'js/membros-import.js', chamados: 'js/chamados-ala.js', crescimento: 'js/crescimento.js' };
  // o botão do aviso leva à aba do PDF (cada módulo tem o seu jeito de escrever)
  const IR = {
    membros: [/data-act="ir-chamados"/, /data-act="ir-crescimento"/],
    chamados: [/data-act="ir-membros"/, /data-act="ir-crescimento"/],
    crescimento: [/data-aba="membros"/, /data-aba="chamados"/],
  };
  for (const [aba, arq] of Object.entries(IMPORTADOR)) {
    const fonte = ler(arq).replace(/\/\/.*$/gm, '');
    assert.match(fonte, /tipoDePdfLcr\(/, `${arq}: o tipo vem do tipoDePdfLcr`);
    assert.match(fonte, /abaDoPdf\(/, `${arq}: a aba vem do abaDoPdf`);
    assert.doesNotMatch(fonte, /\btipoDePdf\(/, `${arq}: o tipoDePdf antigo não distingue as recomendações da Lista de Membros`);
    for (const re of IR[aba]) assert.match(fonte, re, `${arq}: falta o botão ${re}`);
  }
});
