// Regras das atas de reunião (presença do bispado, pauta em parágrafos, busca e
// nome do PDF) — rodar com `npm test`. Só nomes fictícios.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gerar } from '../js/demo-dados.js';
import {
  ataResolvida,
  montarPresenca, nomeArquivoAta, paragrafos, presencaParaFormulario, presentes, rotuloPresenca, textoDeBusca,
  textoParaPdf, valorParaPdf,
} from '../js/reunioes-regras.js';

// a mesma lista e a mesma ordem de CARGOS (js/config.js), sem o ADM — config.js
// não é importado aqui porque carrega o demo.js, que precisa do navegador
const CARGOS = ['Bispo', '1º Conselheiro', '2º Conselheiro', 'Secretário', 'Secretário Executivo'];
const NOMES = { 'Bispo': 'Ana Ribeiro', '1º Conselheiro': 'Bruno Exemplo', 'Secretário Executivo': 'Carla Fictícia' };
const nomeAtual = cargo => NOMES[cargo] || '';

test('rótulo da presença: o chamado e depois o nome', () => {
  assert.equal(rotuloPresenca({ cargo: 'Secretário Executivo', nome: 'Carla Fictícia' }), 'Secretário Executivo Carla Fictícia');
  assert.equal(rotuloPresenca({ cargo: '2º Conselheiro', nome: '' }), '2º Conselheiro');
  assert.equal(rotuloPresenca({ cargo: 'Secretário' }), 'Secretário');
  assert.equal(rotuloPresenca({ cargo: ' Bispo ', nome: '  Ana Ribeiro ' }), 'Bispo Ana Ribeiro');
  assert.equal(rotuloPresenca(), '');
});

test('ata nova: um registro por chamado, na ordem de CARGOS, com os nomes atuais', () => {
  const p = montarPresenca(CARGOS, nomeAtual, undefined, ['Secretário Executivo', 'Bispo']);
  assert.deepEqual(p, [
    { cargo: 'Bispo', nome: 'Ana Ribeiro', presente: true },
    { cargo: '1º Conselheiro', nome: 'Bruno Exemplo', presente: false },
    { cargo: '2º Conselheiro', nome: '', presente: false },
    { cargo: 'Secretário', nome: '', presente: false },
    { cargo: 'Secretário Executivo', nome: 'Carla Fictícia', presente: true },
  ]);
  assert.deepEqual(p.map(rotuloPresenca), [
    'Bispo Ana Ribeiro', '1º Conselheiro Bruno Exemplo', '2º Conselheiro', 'Secretário', 'Secretário Executivo Carla Fictícia',
  ]);
});

test('o ADM e cargos fora da lista não entram na presença', () => {
  const p = montarPresenca(CARGOS, nomeAtual, undefined, ['ADM', 'Bispo', 'Presidente da Estaca']);
  assert.deepEqual(p.map(x => x.cargo), CARGOS);
  assert.ok(!p.some(x => x.cargo === 'ADM'));
  assert.deepEqual(presentes(p).map(x => x.cargo), ['Bispo']);
  // marcado também aceita Set
  assert.deepEqual(presentes(montarPresenca(CARGOS, nomeAtual, [], new Set(['Secretário']))).map(x => x.cargo), ['Secretário']);
});

test('ao editar, a ata guarda quem ocupava o chamado naquele dia (fotografia)', () => {
  const gravada = montarPresenca(CARGOS, nomeAtual, undefined, ['Bispo', '1º Conselheiro']);
  // o 1º Conselheiro mudou depois da reunião
  const depois = cargo => (cargo === '1º Conselheiro' ? 'Henrique Novato' : nomeAtual(cargo));
  const editada = montarPresenca(CARGOS, depois, gravada, ['Bispo', '1º Conselheiro']);
  assert.equal(editada[1].nome, 'Bruno Exemplo');
  assert.equal(presencaParaFormulario(CARGOS, depois, gravada)[1].nome, 'Bruno Exemplo');
  // a marcação nova vale; o nome continua o do dia
  const desmarcada = montarPresenca(CARGOS, depois, gravada, ['Bispo']);
  assert.deepEqual(desmarcada[1], { cargo: '1º Conselheiro', nome: 'Bruno Exemplo', presente: false });
});

test('a fotografia vale da reunião para trás, com a data de hoje recebida por parâmetro', () => {
  // ata da semana que vem, cadastrada sem ninguém marcado
  const gravada = montarPresenca(CARGOS, nomeAtual, undefined, [], { data: '2026-10-15', hoje: '2026-10-01' });
  assert.equal(gravada[1].nome, 'Bruno Exemplo');
  // o 1º Conselheiro mudou antes da reunião: no dia, a ata mostra e grava o atual
  const depois = cargo => (cargo === '1º Conselheiro' ? 'Henrique Novato' : nomeAtual(cargo));
  const noDia = { data: '2026-10-15', hoje: '2026-10-15' };
  assert.equal(presencaParaFormulario(CARGOS, depois, gravada, noDia)[1].nome, 'Henrique Novato');
  const marcada = montarPresenca(CARGOS, depois, gravada, ['1º Conselheiro'], noDia);
  assert.deepEqual(marcada[1], { cargo: '1º Conselheiro', nome: 'Henrique Novato', presente: true });
  // passada a reunião, o nome do dia fica, mesmo que o chamado troque de novo
  const maisTarde = cargo => (cargo === '1º Conselheiro' ? 'Igor Suposto' : nomeAtual(cargo));
  const passada = { data: '2026-10-15', hoje: '2026-10-20' };
  assert.equal(presencaParaFormulario(CARGOS, maisTarde, marcada, passada)[1].nome, 'Henrique Novato');
  assert.equal(montarPresenca(CARGOS, maisTarde, marcada, ['1º Conselheiro'], passada)[1].nome, 'Henrique Novato');
  // antes da reunião, chamado que ficou sem nome agora: fica o gravado
  const semNome = cargo => (cargo === 'Bispo' ? '' : nomeAtual(cargo));
  assert.equal(montarPresenca(CARGOS, semNome, gravada, [], { data: '2026-10-15', hoje: '2026-10-10' })[0].nome, 'Ana Ribeiro');
  // sem as datas (ou com uma vazia), conta como passada: não reescreve nome nenhum
  assert.equal(montarPresenca(CARGOS, depois, gravada, [])[1].nome, 'Bruno Exemplo');
  assert.equal(montarPresenca(CARGOS, depois, gravada, [], { data: '', hoje: '2026-10-01' })[1].nome, 'Bruno Exemplo');
  assert.equal(presencaParaFormulario(CARGOS, depois, gravada, { data: '2026-10-15' })[1].nome, 'Bruno Exemplo');
});

test('nome que a ata gravou vazio é preenchido com o nome atual', () => {
  const semNomes = montarPresenca(CARGOS, () => '', undefined, ['Secretário']);   // os nomes não tinham chegado
  assert.ok(semNomes.every(p => p.nome === ''));
  const agora = cargo => (cargo === 'Secretário' ? 'Dalva Exemplar' : nomeAtual(cargo));
  const editada = montarPresenca(CARGOS, agora, semNomes, ['Secretário']);
  assert.equal(editada[3].nome, 'Dalva Exemplar');
  assert.equal(editada[0].nome, 'Ana Ribeiro');
  assert.equal(presencaParaFormulario(CARGOS, agora, [{ cargo: 'Secretário', nome: '   ', presente: true }])[3].nome, 'Dalva Exemplar');
  // sem a função de nomes, fica só o chamado
  assert.deepEqual(montarPresenca(['Bispo'], undefined, undefined, []), [{ cargo: 'Bispo', nome: '', presente: false }]);
});

test('formulário: marca o que a ata gravou; ata antiga começa desmarcada', () => {
  const gravada = [
    { cargo: 'Secretário Executivo', nome: 'Carla Fictícia', presente: true },   // fora de ordem: a ordem é a de CARGOS
    { cargo: 'Bispo', nome: 'Ana Ribeiro', presente: false },
    { cargo: 'ADM', nome: 'Alguém', presente: true },
  ];
  const f = presencaParaFormulario(CARGOS, nomeAtual, gravada);
  assert.deepEqual(f.map(x => x.cargo), CARGOS);
  assert.deepEqual(f.filter(x => x.presente).map(x => x.cargo), ['Secretário Executivo']);
  const antiga = presencaParaFormulario(CARGOS, nomeAtual, undefined);
  assert.ok(antiga.every(x => x.presente === false));
  assert.equal(antiga[0].nome, 'Ana Ribeiro');
  assert.deepEqual(presencaParaFormulario(CARGOS, nomeAtual, 'lixo').map(x => x.presente), [false, false, false, false, false]);
});

test('presentes: só quem tem presente === true; entrada inválida vira lista vazia', () => {
  assert.deepEqual(presentes(undefined), []);
  assert.deepEqual(presentes(null), []);
  assert.deepEqual(presentes('Bispo'), []);
  assert.deepEqual(presentes([null, { cargo: 'Bispo', presente: 'sim' }, { cargo: 'Secretário', presente: true }]),
    [{ cargo: 'Secretário', presente: true }]);
  assert.deepEqual(presentes(montarPresenca(CARGOS, nomeAtual, undefined, [])), []);   // ninguém marcado: a seção some
});

test('pauta em parágrafos: linha em branco separa, quebra simples fica', () => {
  assert.deepEqual(paragrafos('Assunto um.\n\nAssunto dois.'), ['Assunto um.', 'Assunto dois.']);
  assert.deepEqual(paragrafos('Lista:\nitem a\nitem b\n\nOutro assunto'), ['Lista:\nitem a\nitem b', 'Outro assunto']);
  assert.deepEqual(paragrafos('Uma linha só'), ['Uma linha só']);
});

test('pauta: CRLF, linhas só com espaços e várias linhas em branco', () => {
  assert.deepEqual(paragrafos('Um\r\n\r\nDois\r\nainda dois'), ['Um', 'Dois\nainda dois']);
  assert.deepEqual(paragrafos('Um\r\rDois'), ['Um', 'Dois']);   // \r sozinho (Mac antigo)
  assert.deepEqual(paragrafos('Um\n   \nDois\n\t\n\n \nTrês'), ['Um', 'Dois', 'Três']);
  assert.deepEqual(paragrafos('\n\n  Começo com espaço  \n\n\n'), ['Começo com espaço']);
  assert.deepEqual(paragrafos(''), []);
  assert.deepEqual(paragrafos('   \n  \n'), []);
  assert.deepEqual(paragrafos(undefined), []);
  assert.deepEqual(paragrafos(null), []);
});

test('busca: acha pelos presentes e pelas orações, não pelos ausentes', () => {
  const r = {
    tipo: 'bispado', pauta: 'Planejamento', participantes: ['Líder da obra missionária'],
    presenca: montarPresenca(CARGOS, nomeAtual, undefined, ['Bispo']),
    oracaoInicial: 'Elias Inventado', oracaoEncerramento: 'Fábio Imaginário',
    itens: [{ texto: 'Conferir o rodízio', feito: false }],
  };
  const t = textoDeBusca(r, 'Reunião do Bispado');
  for (const termo of ['planejamento', 'reunião do bispado', 'líder da obra', 'bispo ana ribeiro', 'elias inventado', 'fábio imaginário', 'conferir o rodízio']) {
    assert.ok(t.includes(termo), termo);
  }
  assert.ok(!t.includes('bruno exemplo'), 'o 1º Conselheiro faltou');
  // ata antiga, sem os campos novos
  assert.equal(textoDeBusca({ pauta: 'Só a pauta' }), 'só a pauta');
  assert.equal(textoDeBusca(null), '');
});

// o que as fontes padrão do jsPDF escrevem em 1 byte: fora disso, a linha
// inteira saía em 2 bytes por letra
const SO_WINANSI = /^[\n\x20-\x7E\xA0-\xFF€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]*$/u;

test('texto do PDF: emoji e símbolos fora do WinAnsi não estragam a linha', () => {
  const linha = 'Visitas às famílias ✅ combinadas → relatório na próxima reunião 🙏';
  assert.equal(textoParaPdf(linha), 'Visitas às famílias (ok) combinadas -> relatório na próxima reunião');
  assert.equal(textoParaPdf('✔️ Feito ✗ cancelado ⬅️ volta'), '(ok) Feito (x) cancelado <- volta');
  assert.equal(textoParaPdf('👍🏽 Combinado com a família'), 'Combinado com a família');
  assert.equal(textoParaPdf('🙏'), '');
  assert.equal(textoParaPdf('Com\ttab'), 'Com tab');
  assert.equal(textoParaPdf('a​b\u0001c −1'), 'abc -1');
  for (const s of [linha, '🎉 Festa da ala 🎉', 'Привет Ana', '日本 e 한국', 'x y', '\u0080\u009F\u007F']) {
    assert.match(textoParaPdf(s), SO_WINANSI, s);
  }
});

test('texto do PDF: o que já é WinAnsi passa intacto, e aplicar duas vezes não muda', () => {
  const limpo = 'Acentuação — “aspas” ‘simples’ … € • ™ ½ ç Ÿ œ\n  recuo mantido  duplo';
  assert.equal(textoParaPdf(limpo), limpo);
  assert.equal(textoParaPdf('Um\r\nDois\rTrês'), 'Um\nDois\nTrês');
  // só a linha que perdeu algo tem os espaços acertados; as outras não
  assert.equal(textoParaPdf('  item  com  espaço\nfim 🙏  da  linha'), '  item  com  espaço\nfim da linha');
  for (const s of ['Visitas ✅ → 🙏', '✔️', 'a\t b', limpo, '']) assert.equal(textoParaPdf(textoParaPdf(s)), textoParaPdf(s), s);
  assert.equal(textoParaPdf(undefined), '');
  assert.equal(textoParaPdf(null), '');
  assert.equal(textoParaPdf(15), '15');
});

// Um domingo importado de planilha com o hino como número (primeiroHino: 123)
// fazia o .trim() do PDF estourar: a ata sacramental não saía e nada avisava
test('valor gravado → texto do PDF: número, lista, objeto e vazio nunca derrubam a ata', () => {
  assert.equal(valorParaPdf(123), '123');
  assert.equal(valorParaPdf(0), '0');
  assert.equal(valorParaPdf(-2.5), '-2.5');
  assert.equal(valorParaPdf(NaN), '');
  assert.equal(valorParaPdf(Infinity), '');
  assert.equal(valorParaPdf(true), 'true');
  assert.equal(valorParaPdf(false), 'false');
  for (const v of [null, undefined, {}, { nome: 'Ana Exemplo' }, new Date(2026, 9, 18), () => 'x', Symbol('s')]) {
    assert.equal(valorParaPdf(v), '', String(typeof v));
  }
  assert.equal(valorParaPdf(['Exemplo, Ana', 'Bruno Fictício']), 'Exemplo, Ana, Bruno Fictício');
  assert.equal(valorParaPdf([123, ' 85 ', '']), '123, 85');
  // lista dentro de lista, objeto e vazio no meio: só o que é texto, sem vírgula sobrando
  assert.equal(valorParaPdf(['Ana', ['Bruno', [3, null]], {}, [], '🙏', 'Carla ✅']), 'Ana, Bruno, 3, Carla (ok)');
  assert.equal(valorParaPdf([[[]]]), '');
  const ciclo = ['Ana'];
  ciclo.push(ciclo);
  assert.equal(valorParaPdf(ciclo).startsWith('Ana, Ana'), true);   // termina, sem estourar a pilha
});

test('valor gravado → texto do PDF: texto passa pelo textoParaPdf, sem cortar espaços', () => {
  assert.equal(valorParaPdf('Hino 2 — “Tu, Senhor” 🙏'), 'Hino 2 — “Tu, Senhor”');
  assert.equal(valorParaPdf('  Ana Exemplo  '), '  Ana Exemplo  ');
  assert.equal(valorParaPdf('Um\r\nDois'), 'Um\nDois');
  assert.equal(valorParaPdf('🎉🎉'), '');
  const longo = 'Aviso da ala ✅ '.repeat(400);
  assert.match(valorParaPdf(longo), SO_WINANSI);
  for (const v of ['texto', 42, ['a', ['b']], null, { x: 1 }, '✔️ ok']) {
    assert.match(valorParaPdf(v), SO_WINANSI);
    assert.equal(valorParaPdf(valorParaPdf(v)), valorParaPdf(v));
  }
});

test('nome do PDF: ata, o tipo sem acento e a data', () => {
  assert.equal(nomeArquivoAta('Reunião do Bispado', '2026-10-15'), 'ata-reuniao-do-bispado-2026-10-15.pdf');
  assert.equal(nomeArquivoAta('Bem-Estar e Autossuficiência', '2026-10-15'), 'ata-bem-estar-e-autossuficiencia-2026-10-15.pdf');
  assert.equal(nomeArquivoAta('Liderança do Sacerdócio', '2026-01-02'), 'ata-lideranca-do-sacerdocio-2026-01-02.pdf');
  assert.equal(nomeArquivoAta('Correlação Missionária', '2026-03-09'), 'ata-correlacao-missionaria-2026-03-09.pdf');
  assert.equal(nomeArquivoAta('  Conselho   da Ala! ', '2026-10-15'), 'ata-conselho-da-ala-2026-10-15.pdf');
});

test('nome do PDF: sem tipo ou sem data', () => {
  assert.equal(nomeArquivoAta('', '2026-10-15'), 'ata-reuniao-2026-10-15.pdf');
  assert.equal(nomeArquivoAta('✨', '2026-10-15'), 'ata-reuniao-2026-10-15.pdf');
  assert.equal(nomeArquivoAta(undefined, '2026-10-15'), 'ata-reuniao-2026-10-15.pdf');
  assert.equal(nomeArquivoAta('Reunião do Bispado', ''), 'ata-reuniao-do-bispado-sem-data.pdf');
  assert.equal(nomeArquivoAta('Reunião do Bispado', undefined), 'ata-reuniao-do-bispado-sem-data.pdf');
  assert.equal(nomeArquivoAta('Outro', '../2026/10'), 'ata-outro-2026-10.pdf');   // nada de barra no nome do arquivo
});

test('demonstração: a presença das atas usa os nomes do bispado fictício', () => {
  const { colecoes } = gerar('2026-10-12');
  const nomes = colecoes.bispado[0].nomes;
  const comPresenca = colecoes.reunioes.filter(r => r.presenca);
  assert.ok(comPresenca.some(r => presentes(r.presenca).length), 'nenhuma ata com presença marcada');
  assert.ok(colecoes.reunioes.some(r => !r.presenca && !r.oracaoInicial), 'falta uma ata no formato antigo');
  for (const r of comPresenca) {
    assert.deepEqual(r.presenca.map(p => p.cargo), CARGOS, r.data);
    for (const p of r.presenca) assert.equal(p.nome, nomes[p.cargo], `${r.data} ${p.cargo}`);
  }
  assert.ok(colecoes.reunioes.some(r => paragrafos(r.pauta).length > 1), 'nenhuma pauta com mais de um assunto');
});

test('ata resolvida: já passou e não tem item em aberto — vai para o histórico', () => {
  const hoje = '2026-10-24';
  assert.equal(ataResolvida({ data: '2026-10-10', itens: [{ texto: 'a', feito: true }, { texto: 'b', feito: true }] }, hoje), true);
  assert.equal(ataResolvida({ data: '2026-10-10', itens: [] }, hoje), true, 'sem itens e já passou');
  assert.equal(ataResolvida({ data: '2026-10-10' }, hoje), true, 'ata antiga, sem o campo itens');
  assert.equal(ataResolvida({ data: '2026-10-10', itens: [{ texto: 'a', feito: true }, { texto: 'b', feito: false }] }, hoje), false, 'item em aberto fica na tela');
  assert.equal(ataResolvida({ data: hoje, itens: [{ texto: 'a', feito: true }] }, hoje), false, 'a de hoje fica na tela');
  assert.equal(ataResolvida({ data: '2026-11-01', itens: [] }, hoje), false, 'a futura fica na tela');
  assert.equal(ataResolvida({ itens: [] }, hoje), false, 'sem data: não some');
  assert.equal(ataResolvida(null, hoje), false);
});
