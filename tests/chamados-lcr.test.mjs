// Relatório "Organizações e Chamados" do LCR (js/chamados-lcr.js) — `npm test`.
// O PDF de verdade tem nomes, telefones e e-mails de membros: aqui só entra um
// relatório SINTÉTICO, montado com a mesma geometria (corpo, margens, colunas,
// quebras) e com pessoas inventadas.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  CARGOS_DO_LCR, DOC_CHAMADOS_VAZIO, FILTROS_CHAMADOS, MAX_CHAMADOS, MAX_TEXTO_CHAMADO, aDesignar, agruparPorOrganizacao,
  chamadosDoMembro, compararBispado, compararChamados, dataLcr, designacaoNaAgenda, filtrarChamados, indicePorPessoa,
  limparDocumentoChamados, membroDoQuadro, membrosSemChamado, nomeCurto, nomesAposImportar, nomesDoBispado,
  obsDaDesignacao, ordemNatural, parsearPdfChamados, resumoChamados, resumoDesignacoes, tipoDePdf, tiposDePdf,
} from '../js/chamados-lcr.js';
import { TIPO_DESIGNACAO } from '../js/convite-regras.js';

// CARGOS de js/config.js, lidos do texto (config.js lê location e não abre no Node)
const CARGOS = [...readFileSync(new URL('../js/config.js', import.meta.url), 'utf8')
  .match(/CARGOS_INFO = \[([\s\S]*?)\];/)[1].matchAll(/nome: '([^']+)'/g)].map(m => m[1]);

// ---------- gerador do relatório sintético ----------
// Medidas do relatório de 2026 (pdf.js, A4, y cresce para cima): moldura em
// corpo 9, organização 12, grupo 9,36, tabelas 8. Colunas: rótulos do
// cabeçalho em 35,1 / 216,7 / 342,1 / 415,5; o texto das células 1,5 pt à
// direita; títulos na margem 34,3. Célula quebrada desce 9 pt por linha e as
// demais ficam no meio; de um registro ao outro, 13,5 pt.
const COL = { chamado: 36.6, nome: 218.2, apoiado: 343.6, designado: 417 };
const COL_MEMBROS = [55.6, 157.9, 260.3, 344.6, 428.9];

function relatorio({ ala = 'Ala Exemplo 9 (000009)', estaca = 'Estaca Exemplo Brasil (000001)', data = '14 out. 2026' } = {}) {
  const paginas = [];
  let pg, y;
  const item = (str, x, yy, f = 8) => pg.push({ str, transform: [f, 0, 0, f, x, yy], width: str.length * f * 0.5, hasEOL: false });
  const pagina = () => {
    pg = [];
    paginas.push(pg);
    item(ala, 487.1, 779.7, 9);
    item('Organizações e Chamados', 28.3, 774.7, 9);
    item(estaca, 460.1, 769.7, 9);
    item(data, 28.3, 11.1, 9);
    item('Somente para Uso da Igreja ©2026', 125.2, 11.1, 9);
    item(String(paginas.length), 578.6, 11.1, 9);
    // o pdf.js devolve os espaços entre palavras como itens em branco
    pg.push({ str: ' ', transform: [8, 0, 0, 8, 300, 400], width: 2.2, hasEOL: false });
    y = 769.7;
  };
  pagina();
  const linhas = v => (Array.isArray(v) ? v : [v]).filter(s => s !== '' && s != null);
  // um registro: cada célula é um texto ou as linhas de um texto quebrado
  const registro = (celulas, xs, gap) => {
    const cels = celulas.map(linhas);
    const n = Math.max(1, ...cels.map(c => c.length));
    const topo = y - gap, meio = topo - 4.5 * (n - 1);
    cels.forEach((c, k) => c.forEach((s, i) => item(s, xs[k], meio + 4.5 * (c.length - 1) - 9 * i + (s === '✓' ? 0.1 : 0))));
    y = topo - 9 * (n - 1);
  };
  let aposCabecalho = false;
  const r = {
    paginas,
    pagina() { pagina(); return r; },
    org(t) { y -= 23.5; item(t, 34.3, y, 12); return r; },
    grupo(t) { y -= 27.5; for (const s of linhas(t)) { item(s, 34.3, y, 9.36); y -= 11.2; } y += 11.2; return r; },
    titulo3(t) { y -= 27.5; for (const s of linhas(t)) { item(s, 34.3, y); y -= 9; } y += 9; return r; },
    cabecalho() {
      y -= y > 760 ? 14 : 19.5;
      item('Chamado', 35.1, y); item('Nome', 216.7, y); item('Apoiado', 342.1, y);
      item('Designado por Imposição de Mãos', 415.5, y);
      aposCabecalho = true;
      return r;
    },
    linha(chamado, nome, apoiado = '', designado = false) {
      registro([chamado, nome, apoiado, designado ? '✓' : ''], [COL.chamado, COL.nome, COL.apoiado, COL.designado], aposCabecalho ? 18.7 : 13.5);
      aposCabecalho = false;
      return r;
    },
    vago(chamado) { return r.linha(chamado, 'Chamado em Aberto'); },
    nota() { y -= 17; item('* chamado personalizado', 34.3, y); return r; },
    contagem(n) { y -= 19.3; item(`Contagem: ${n}`, 34.3, y); return r; },
    // a lista de membros de uma organização (o parser tem de pular inteira);
    // titulo/cabecalho = false tiram uma das duas marcas, para testar a outra
    membros(titulo, pessoas, nivel = 9.36, { antes = 27.5, cabecalho = true, contagem = true } = {}) {
      y -= antes;
      if (titulo) item(titulo, 34.3, y, nivel);
      y -= 19.3;
      if (cabecalho) ['Nome', 'Idade', 'Data de Nascimento', 'Número de Telefone', 'E-mail'].forEach((t, k) => item(t, COL_MEMBROS[k] - 1.5, y));
      aposCabecalho = true;
      for (const p of pessoas) {
        registro(p, COL_MEMBROS, aposCabecalho ? 18.7 : 13.5);
        aposCabecalho = false;
      }
      return contagem ? r.contagem(pessoas.length) : r;
    },
  };
  return r;
}

// Uma ala inteira de mentira, com todas as armadilhas do PDF real
function alaDeExemplo() {
  return relatorio()
    .org('Bispado').cabecalho()
    .linha('Bispo', 'Exemplo, Bruno Henrique', '13 set 2026', true)
    .linha('Primeiro Conselheiro no Bispado', 'Fictício, Carlos Eduardo Da', '7 set 1998', true)
    .vago('Segundo Conselheiro no Bispado')
    .linha('Secretário Executivo da Ala', ['Modelo Teste, Daniel Augusto', 'Do Ensaio'], '2 fev 2025')
    .linha(['Secretário Adjunto Financeiro da', 'Ala'], 'Chamado em Aberto')
    .linha('Secretário da Ala', 'Amostra, Eduardo', '30 jun 2024', true)
    .contagem(6)
    .org('Quórum de Élderes')
    .membros('Quórum de Élderes Membros', [
      [['Exemplo, Bruno Henrique'], '41', '3 mar 1985', '(63) 90000-0001', 'bruno@example.com'],
      [['Novo, Hélio Fictício Da', 'Hipotético'], '33', '15 jul 1993', '', 'helio@example.com'],
      [['Jovem, Igor'], '19', '1 jan 2007', '(63) 90000-0003', ''],
    ], 12)
    .grupo('Presidência do Quórum de Élderes').cabecalho()
    .linha('Presidente do Quórum de Élderes', 'Exemplar, Fábio', '1 jan 2026', true)
    .vago(['Primeiro Conselheiro na Presidência do', 'Quórum de Élderes'])
    .pagina().cabecalho()   // a tabela continua na página 2, só com o cabeçalho repetido
    .vago(['Segundo Conselheiro na Presidência do', 'Quórum de Élderes'])
    .linha('Secretário do Quórum de Élderes', 'Amostra, Gilberto', '20 abr 2026')
    .contagem(4)
    .grupo('Atividades').cabecalho()
    .linha('* Coordenador de Atividades do Quórum', 'Simulado, Gustavo', '5 mai 2026', true)
    .linha('* Auxiliar de Atividades', 'Chamado em Aberto')
    .linha('Especialista em Atividades', 'Chamado em Aberto')
    .nota()
    .contagem(3)
    .org('Quóruns do Sacerdócio Aarônico')
    // grupo que só aparece pelo título da lista de membros — e títulos de 3º nível
    .membros('Quórum de Exemplo Membros', [[['Menor, Kauã'], '13', '4 nov 2012', '', '']])
    .titulo3('Presidência do Quórum de Exemplo').cabecalho()
    .vago('Presidente do Quórum de Exemplo')
    .contagem(1)
    .titulo3('Líderes adultos do quórum de exemplo e da classe de exemplo')
    .pagina().cabecalho()   // título no pé de uma página, a tabela no alto da outra
    .linha('Consultor do Quórum de Exemplo', 'Exemplar, Fábio', '1 jan 2026', true)
    .contagem(1)
    .org('Primária')
    .grupo(['Atividades da Primária — Meninas, Atividade da', 'Primária — Meninos']).cabecalho()
    .linha('Líder de Atividades da Primária', 'Simulado, Ana Clara', '11 ago 2026')
    .contagem(1)
    .grupo('Professores').cabecalho()
    .linha('Professor da Primária', 'Simulado, Ana Clara', '11 ago 2026', true)
    .linha('Professor da Primária', 'Teste, Lúcia', '4 out 2026', true)
    .vago('Professor da Primária')
    .contagem(3);
}

const LIDO = parsearPdfChamados(alaDeExemplo().paginas);

// ---------- parsearPdfChamados ----------
test('lê ala, unidade, estaca e a data do relatório na moldura da página', () => {
  assert.deepEqual(LIDO.relatorio, { ala: 'Ala Exemplo 9', unidade: '000009', estaca: 'Estaca Exemplo Brasil', data: '2026-10-14' });
});

test('cada tabela confere com a sua "Contagem", inclusive a que passa de página', () => {
  assert.deepEqual(LIDO.tabelas.map(t => [t.org, t.grupo, t.pagina, t.lidos, t.contagem]), [
    ['Bispado', '', 1, 6, 6],
    ['Quórum de Élderes', 'Presidência do Quórum de Élderes', 1, 4, 4],
    ['Quórum de Élderes', 'Atividades', 2, 3, 3],
    ['Quóruns do Sacerdócio Aarônico', 'Presidência do Quórum de Exemplo', 2, 1, 1],
    ['Quóruns do Sacerdócio Aarônico', 'Líderes adultos do quórum de exemplo e da classe de exemplo', 3, 1, 1],
    ['Primária', 'Atividades da Primária — Meninas, Atividade da Primária — Meninos', 3, 1, 1],
    ['Primária', 'Professores', 3, 3, 3],
  ]);
  assert.equal(LIDO.chamados.length, 19);
});

test('o bispado: nome do LCR, data de um ou dois dígitos, vago e não designado', () => {
  const bispado = LIDO.chamados.filter(c => c.org === 'Bispado');
  assert.deepEqual(bispado, [
    { org: 'Bispado', grupo: '', chamado: 'Bispo', nome: 'Exemplo, Bruno Henrique', apoiado: '2026-09-13', designado: true, personalizado: false },
    { org: 'Bispado', grupo: '', chamado: 'Primeiro Conselheiro no Bispado', nome: 'Fictício, Carlos Eduardo Da', apoiado: '1998-09-07', designado: true, personalizado: false },
    { org: 'Bispado', grupo: '', chamado: 'Segundo Conselheiro no Bispado', nome: '', apoiado: '', designado: false, personalizado: false },
    { org: 'Bispado', grupo: '', chamado: 'Secretário Executivo da Ala', nome: 'Modelo Teste, Daniel Augusto Do Ensaio', apoiado: '2025-02-02', designado: false, personalizado: false },
    { org: 'Bispado', grupo: '', chamado: 'Secretário Adjunto Financeiro da Ala', nome: '', apoiado: '', designado: false, personalizado: false },
    { org: 'Bispado', grupo: '', chamado: 'Secretário da Ala', nome: 'Amostra, Eduardo', apoiado: '2024-06-30', designado: true, personalizado: false },
  ]);
});

test('título de chamado quebrado em duas linhas vira um só', () => {
  const titulos = LIDO.chamados.map(c => c.chamado);
  assert.ok(titulos.includes('Primeiro Conselheiro na Presidência do Quórum de Élderes'));
  assert.ok(titulos.includes('Secretário Adjunto Financeiro da Ala'));
  assert.ok(!titulos.some(t => t === 'Ala' || t === 'Élderes'));
});

test('chamado personalizado: sem o asterisco, e a nota de rodapé não vira linha', () => {
  const ativ = LIDO.chamados.filter(c => c.grupo === 'Atividades');
  assert.deepEqual(ativ.map(c => [c.chamado, c.personalizado]), [
    ['Coordenador de Atividades do Quórum', true], ['Auxiliar de Atividades', true], ['Especialista em Atividades', false],
  ]);
  assert.ok(!LIDO.chamados.some(c => /chamado personalizado/i.test(c.chamado)));
});

test('a lista de membros de cada organização é pulada inteira (nada de telefone, e-mail ou nascimento)', () => {
  const tudo = JSON.stringify(LIDO);
  for (const dado of ['90000', 'example.com', 'Novo, Hélio', 'Hipotético', 'Menor, Kauã', 'Jovem, Igor', '1985', '2012', 'Idade', 'Membros'])
    assert.ok(!tudo.includes(dado), dado);
});

test('o título da lista de membros dá o grupo; o 3º nível (corpo do texto) vira o grupo da tabela', () => {
  const aaronico = LIDO.chamados.filter(c => c.org === 'Quóruns do Sacerdócio Aarônico');
  assert.deepEqual(aaronico.map(c => [c.grupo, c.chamado, c.nome]), [
    ['Presidência do Quórum de Exemplo', 'Presidente do Quórum de Exemplo', ''],
    ['Líderes adultos do quórum de exemplo e da classe de exemplo', 'Consultor do Quórum de Exemplo', 'Exemplar, Fábio'],
  ]);
});

test('título de grupo quebrado em duas linhas vira um só', () => {
  assert.ok(LIDO.chamados.some(c => c.grupo === 'Atividades da Primária — Meninas, Atividade da Primária — Meninos'));
});

test('lista de membros é pulada pelo título "… Membros" OU pelo cabeçalho Nome/Idade, mesmo sem "Contagem"', () => {
  const pessoas = [[['Novo, Hélio Fictício Da', 'Hipotético'], '33', '15 jul 1993', '(63) 90000-0002', 'helio@example.com']];
  const r = relatorio().org('Quórum de Élderes')
    // só o título: sem cabeçalho e sem a "Contagem" que fecharia a lista
    .membros('Quórum de Élderes Membros', pessoas, 12, { cabecalho: false, contagem: false })
    .titulo3('Presidência de Exemplo').cabecalho().linha('Líder de Serviço', 'Amostra, Gilberto', '1 jan 2026', true)
    // só o cabeçalho, logo depois de uma tabela que veio sem a sua "Contagem"
    .membros(null, pessoas)
    .titulo3('Outra Presidência').cabecalho().vago('Presidente de Exemplo').contagem(1);
  const lido = parsearPdfChamados(r.paginas);
  assert.deepEqual(lido.chamados.map(c => [c.grupo, c.chamado, c.nome]), [
    ['Presidência de Exemplo', 'Líder de Serviço', 'Amostra, Gilberto'], ['Outra Presidência', 'Presidente de Exemplo', ''],
  ]);
  assert.deepEqual(lido.tabelas.map(t => [t.lidos, t.contagem]), [[1, null], [1, 1]]);
  assert.ok(!/90000|example\.com|Hélio|Hipotético|1993/.test(JSON.stringify(lido)));
  // lista sem "Contagem" e logo o cabeçalho de uma tabela sem título: a última
  // linha da lista NÃO é título de 3º nível (o grupo é o da lista)
  for (const ultima of [pessoas, [[['Teste, Otávio'], '52', '9 nov 1974', '(63) 90000-0009', 'otavio@example.com']]]) {
    const r2 = relatorio().org('Quóruns do Sacerdócio Aarônico')
      .membros('Quórum de Gama Membros', ultima, 9.36, { contagem: false })
      .cabecalho().vago('Consultor do Quórum de Gama').contagem(1);
    const lido2 = parsearPdfChamados(r2.paginas);
    assert.deepEqual(lido2.chamados.map(c => [c.grupo, c.chamado]), [['Quórum de Gama', 'Consultor do Quórum de Gama']]);
    assert.ok(!/90000|example\.com|Hélio|Hipotético|Otávio/.test(JSON.stringify(lido2)));
  }
});

test('texto solto entre tabelas não vaza para o nome do grupo', () => {
  // uma "lista" sem título, sem cabeçalho e sem contagem: só as linhas de uma
  // célula, na margem, chegam a candidatas a título — e no máximo 3
  const solto = [[['Teste, Otávio'], '52', '9 nov 1974', '(63) 90000-0009', 'otavio@example.com']];
  const r = relatorio().org('Outros Chamados')
    .membros(null, solto, 9.36, { cabecalho: false, contagem: false })
    .titulo3(['Coro da Ala', 'de Exemplo']).cabecalho().vago('Regente do Coro').contagem(1);
  assert.deepEqual(parsearPdfChamados(r.paginas).chamados.map(c => c.grupo), ['Coro da Ala de Exemplo']);
  const longo = relatorio().org('Outros Chamados').titulo3(['Coro', 'da', 'Ala', 'de Exemplo']).cabecalho().vago('Regente do Coro').contagem(1);
  assert.deepEqual(parsearPdfChamados(longo.paginas).chamados.map(c => c.grupo), ['da Ala de Exemplo']);
  // a mesma linha solta começando na margem dos títulos, logo acima de um
  // cabeçalho: o vão entre as colunas mostra que não é título
  const naMargem = relatorio().org('Outros Chamados').membros(null, solto, 9.36, { cabecalho: false, contagem: false })
    .cabecalho().vago('Regente do Coro').contagem(1).paginas
    .map(pg => pg.map(i => (Math.abs(i.transform[4] - 55.6) < 0.1 ? { ...i, transform: [...i.transform.slice(0, 4), 34.3, i.transform[5]] } : i)));
  const lidoMargem = parsearPdfChamados(naMargem);
  assert.deepEqual(lidoMargem.chamados.map(c => [c.grupo, c.chamado]), [['', 'Regente do Coro']]);
  assert.ok(!/90000|example\.com|Otávio/.test(JSON.stringify(lidoMargem)));
});

test('chamado vago nunca tem data nem designação', () => {
  const r = relatorio().org('Bispado').cabecalho().linha('Secretário da Ala', 'Chamado em Aberto', '1 jan 2020', true).contagem(1);
  assert.deepEqual(parsearPdfChamados(r.paginas).chamados[0], {
    org: 'Bispado', grupo: '', chamado: 'Secretário da Ala', nome: '', apoiado: '', designado: false, personalizado: false,
  });
});

test('lista de membros logo abaixo do título da organização não é "título quebrado"', () => {
  // num relatório mais apertado, "Moças" e "Moças Membros" quase se encostam
  const r = relatorio().org('Moças').membros('Moças Membros', [[['Teste, Mariana'], '15', '', '', '']], 12, { antes: 14 })
    .grupo('Presidência das Moças').cabecalho().linha('Presidente das Moças', 'Teste, Lúcia', '4 out 2026', true).contagem(1);
  assert.deepEqual(parsearPdfChamados(r.paginas).chamados.map(c => [c.org, c.grupo]), [['Moças', 'Presidência das Moças']]);
});

test('tabela logo depois de uma lista de membros, sem título: o grupo é o da lista', () => {
  const r = relatorio().org('Quóruns do Sacerdócio Aarônico')
    .grupo('Quórum de Alfa').cabecalho().vago('Consultor do Quórum de Alfa').contagem(1)
    .membros('Quórum de Beta Membros', [[['Menor, Kauã'], '13', '', '', '']])
    .cabecalho().vago('Consultor do Quórum de Beta').contagem(1);
  assert.deepEqual(parsearPdfChamados(r.paginas).chamados.map(c => c.grupo), ['Quórum de Alfa', 'Quórum de Beta']);
});

test('tabela sem "Contagem" seguida de outra: a última linha não vira título, e a conferência fica em aberto', () => {
  const r = relatorio().org('Outros Chamados').grupo('Música').cabecalho()
    .linha('Regente do Coro', 'Teste, Lúcia', '4 out 2026', true)
    .vago('Pianista do Coro')
    .titulo3('Coro da Ala').cabecalho()
    .vago('Presidente do Coro')
    .contagem(1);
  const lido = parsearPdfChamados(r.paginas);
  assert.deepEqual(lido.chamados.map(c => [c.grupo, c.chamado]), [
    ['Música', 'Regente do Coro'], ['Música', 'Pianista do Coro'], ['Coro da Ala', 'Presidente do Coro'],
  ]);
  assert.deepEqual(lido.tabelas.map(t => [t.grupo, t.lidos, t.contagem]), [['Música', 2, null], ['Coro da Ala', 1, 1]]);
  // cabeçalho repetido no meio da página, sem título: a linha acima dele é linha, e a tabela continua
  // …mesmo quando a última linha física do registro é só o fim do título quebrado
  const repetido = relatorio().org('Outros Chamados').grupo('Música').cabecalho()
    .vago('Pianista do Coro').vago(['Secretário Adjunto Financeiro da', 'Ala']).cabecalho().vago('Organista da Ala').contagem(3);
  const lidoRep = parsearPdfChamados(repetido.paginas);
  assert.deepEqual(lidoRep.tabelas.map(t => [t.grupo, t.lidos, t.contagem]), [['Música', 3, 3]]);
  assert.equal(lidoRep.chamados[1].chamado, 'Secretário Adjunto Financeiro da Ala');
});

test('tabela que passa de página sem repetir o cabeçalho', () => {
  const r = relatorio().org('Primária').grupo('Professores').cabecalho()
    .linha('Professor da Primária', 'Simulado, Ana Clara', '11 ago 2026', true)
    .linha('Professor da Primária', ['Modelo Teste, Daniel Augusto', 'Do Ensaio'], '2 fev 2025')
    .pagina()
    .linha('Professor da Primária', 'Teste, Lúcia', '4 out 2026', true)
    .vago('Professor da Primária')
    .contagem(4);
  const lido = parsearPdfChamados(r.paginas);
  assert.deepEqual(lido.chamados.map(c => c.nome), ['Simulado, Ana Clara', 'Modelo Teste, Daniel Augusto Do Ensaio', 'Teste, Lúcia', '']);
  assert.deepEqual(lido.tabelas.map(t => [t.lidos, t.contagem]), [[4, 4]]);
});

test('tabela com menos linhas que a "Contagem" aparece na conferência', () => {
  const r = relatorio().org('Bispado').cabecalho()
    .linha('Bispo', 'Exemplo, Bruno', '1 jan 2026', true)
    .vago('Secretário da Ala')
    .contagem(3);
  assert.deepEqual(parsearPdfChamados(r.paginas).tabelas, [{ org: 'Bispado', grupo: '', pagina: 1, lidos: 2, contagem: 3 }]);
});

test('relatório de outra ala com medidas um pouco diferentes lê igual', () => {
  // 4% maior, deslocado, e cada trecho até 0,4 pt fora da linha (sempre o mesmo "ruído")
  const mexido = alaDeExemplo().paginas.map(pg => pg.map(i => {
    const [f, , , , x, y] = i.transform;
    const ruido = ((x * 7.3) % 1) * 0.4 - 0.2;
    return { ...i, transform: [f * 1.04, 0, 0, f * 1.04, x * 1.04 + 1.5, y * 1.04 - 6 + ruido], width: i.width * 1.04 };
  }));
  const r = parsearPdfChamados(mexido);
  assert.deepEqual(r.chamados, LIDO.chamados);
  assert.deepEqual(r.tabelas, LIDO.tabelas);
});

test('trechos partidos (palavra a palavra, acento solto, sem width) leem igual', () => {
  // palavra a palavra, com o espaço entre elas; acento num trecho encostado
  const partir = i => {
    if (i.str.length < 2) return [i];
    const [f, , , , x, y] = i.transform, cw = i.width / i.str.length;
    const out = [];
    let ini = 0;
    const corta = fim => { if (fim > ini && i.str.slice(ini, fim).trim()) out.push({ ...i, str: i.str.slice(ini, fim).trim(), transform: [f, 0, 0, f, x + ini * cw, y], width: i.str.slice(ini, fim).trim().length * cw }); };
    [...i.str].forEach((ch, k) => {
      if (ch === ' ') { corta(k); ini = k + 1; }
      else if (/[áéíóúâêôãõçÁÉÍÓÚ]/.test(ch)) { corta(k); ini = k; corta(k + 1); ini = k + 1; }
    });
    corta(i.str.length);
    return out;
  };
  const partidos = alaDeExemplo().paginas.map(pg => pg.flatMap(partir));
  assert.ok(partidos[0].length > alaDeExemplo().paginas[0].length + 20);
  assert.deepEqual(parsearPdfChamados(partidos).chamados, LIDO.chamados);
  const semLargura = alaDeExemplo().paginas.map(pg => pg.map(i => ({ ...i, width: 0 })));
  assert.deepEqual(parsearPdfChamados(semLargura).chamados, LIDO.chamados);
});

test('trechos fora de ordem na página leem igual', () => {
  const embaralhado = alaDeExemplo().paginas.map(pg => [...pg].reverse());
  assert.deepEqual(parsearPdfChamados(embaralhado).chamados, LIDO.chamados);
});

test('PDF vazio, sem texto ou sem tabela não quebra', () => {
  const vazio = { relatorio: null, chamados: [], tabelas: [] };
  assert.deepEqual(parsearPdfChamados([]), vazio);
  assert.deepEqual(parsearPdfChamados(undefined), vazio);
  assert.deepEqual(parsearPdfChamados([[], [{ str: ' ', transform: [8, 0, 0, 8, 1, 1] }], [null, {}]]), vazio);
  const soMoldura = relatorio().org('Bispado').paginas;
  assert.deepEqual(parsearPdfChamados(soMoldura).chamados, []);
  assert.equal(parsearPdfChamados(soMoldura).relatorio.ala, 'Ala Exemplo 9');
});

// ---------- tipoDePdf ----------
const it = (str, x = 30, y = 700, f = 8) => ({ str, transform: [f, 0, 0, f, x, y], width: str.length * f * 0.5 });

test('tipo do PDF: sem texto, chamados, lista de membros ou outro', () => {
  assert.equal(tipoDePdf([]), 'sem-texto');
  assert.equal(tipoDePdf([[], []]), 'sem-texto');                       // "Microsoft Print to PDF": só desenho
  assert.equal(tipoDePdf([[{ str: '  ', transform: [8, 0, 0, 8, 1, 1] }]]), 'sem-texto');
  assert.equal(tipoDePdf(alaDeExemplo().paginas), 'chamados');
  assert.equal(tipoDePdf([[it('Chamado', 35), it('Nome', 216), it('Apoiado', 342)]]), 'chamados');   // sem a moldura
  assert.equal(tipoDePdf([[it('Lista de Membros Ala Exemplo 9 (000009)', 30, 780, 9), it('Nome', 50, 700)]]), 'membros');
  assert.equal(tipoDePdf([[it('Nome', 50), it('Sexo', 200), it('Idade', 250)]]), 'membros');
  assert.equal(tipoDePdf([[it('Programa da reunião sacramental')]]), 'outro');
  assert.equal(tiposDePdf, tipoDePdf);
});

// ---------- dataLcr e nomeCurto ----------
test('data do LCR para AAAA-MM-DD', () => {
  assert.equal(dataLcr('13 set 2026'), '2026-09-13');
  assert.equal(dataLcr('14 out. 2026'), '2026-10-14');
  assert.equal(dataLcr('7 set 1998'), '1998-09-07');
  assert.equal(dataLcr(' 1 JAN 2027 '), '2027-01-01');
  assert.equal(dataLcr('31 fev 2026'), '');      // dia que não existe
  assert.equal(dataLcr('13 sep 2026'), '');      // mês que não é do português
  assert.equal(dataLcr('2026-09-13'), '');
  assert.equal(dataLcr('Chamado em Aberto'), '');
  assert.equal(dataLcr(''), '');
  assert.equal(dataLcr(undefined), '');
});

test('nome curto: 1º prenome + sobrenome (o que vem antes da vírgula)', () => {
  assert.equal(nomeCurto('Simulado, Ana Clara Da'), 'Ana Simulado');
  assert.equal(nomeCurto('Exemplo Modelo, Bruno'), 'Bruno Exemplo Modelo');
  assert.equal(nomeCurto('  Fictício ,   Carlos   Eduardo '), 'Carlos Fictício');
  assert.equal(nomeCurto('Simulado,'), 'Simulado');
  assert.equal(nomeCurto('  Ana   Simulado '), 'Ana Simulado');
  assert.equal(nomeCurto(''), '');
  assert.equal(nomeCurto(null), '');
});

// ---------- bispado ----------
test('nomes do bispado: só os preenchidos, com as chaves de CARGOS', () => {
  assert.deepEqual(nomesDoBispado(LIDO.chamados), {
    'Bispo': 'Bruno Exemplo',
    '1º Conselheiro': 'Carlos Fictício',
    'Secretário Executivo': 'Daniel Modelo Teste',
    'Secretário': 'Eduardo Amostra',
  });
  assert.deepEqual(nomesDoBispado([]), {});
  assert.deepEqual(nomesDoBispado(undefined), {});
  // título com caixa/acento diferentes ainda casa
  assert.deepEqual(nomesDoBispado([{ chamado: 'segundo conselheiro NO bispado', nome: 'Simulado, Ana' }]), { '2º Conselheiro': 'Ana Simulado' });
});

test('os cargos do LCR são exatamente os CARGOS do config.js, na mesma ordem', () => {
  assert.equal(CARGOS.length, 5);
  assert.deepEqual(Object.values(CARGOS_DO_LCR), CARGOS);
});

// ---------- resumo, filtros, grupos ----------
test('resumo: total, preenchidos, vagos e a designar', () => {
  assert.deepEqual(resumoChamados(LIDO.chamados), { total: 19, preenchidos: 11, vagos: 8, aDesignar: 3 });
  assert.deepEqual(resumoChamados([]), { total: 0, preenchidos: 0, vagos: 0, aDesignar: 0 });
  assert.equal(aDesignar({ nome: 'Simulado, Ana', designado: false }), true);
  assert.equal(aDesignar({ nome: '', designado: false }), false);
  assert.equal(aDesignar({ nome: 'Simulado, Ana', designado: true }), false);
});

test('filtros: todos, vagos, a designar, preenchidos e sem chamado', () => {
  const ch = LIDO.chamados;
  assert.deepEqual(FILTROS_CHAMADOS.map(f => f.id), ['todos', 'vagos', 'a-designar', 'sem-chamado']);
  assert.equal(filtrarChamados(ch).length, 19);
  assert.equal(filtrarChamados(ch, { filtro: 'todos' }).length, 19);
  assert.ok(filtrarChamados(ch, { filtro: 'vagos' }).every(c => c.nome === ''));
  assert.equal(filtrarChamados(ch, { filtro: 'vagos' }).length, 8);
  assert.deepEqual(filtrarChamados(ch, { filtro: 'a-designar' }).map(c => c.chamado),
    ['Secretário Executivo da Ala', 'Secretário do Quórum de Élderes', 'Líder de Atividades da Primária']);
  assert.equal(filtrarChamados(ch, { filtro: 'preenchidos' }).length, 11);
  assert.deepEqual(filtrarChamados(ch, { filtro: 'sem-chamado' }), []);   // essa lista é de membros
  assert.equal(filtrarChamados(ch, { filtro: 'qualquer' }).length, 19);
  assert.deepEqual(filtrarChamados(undefined), []);
});

test('busca: chamado, nome (em qualquer ordem, sem acento) e organização', () => {
  const ch = LIDO.chamados;
  const busca = (b, filtro) => filtrarChamados(ch, { busca: b, filtro }).map(c => c.chamado);
  assert.deepEqual(busca('carlos ficticio'), ['Primeiro Conselheiro no Bispado']);
  assert.deepEqual(busca('FICTÍCIO, Carlos'), ['Primeiro Conselheiro no Bispado']);
  assert.equal(busca('conselheiro').length, 4);
  assert.equal(busca('bispado').length, 6);                 // a organização
  assert.equal(busca('professores').length, 3);             // o grupo
  assert.deepEqual(busca('ana simulado'), ['Líder de Atividades da Primária', 'Professor da Primária']);
  assert.equal(busca('vago').length, 8);
  assert.deepEqual(busca('professor', 'vagos'), ['Professor da Primária']);
  assert.deepEqual(busca('ninguém com este nome'), []);
  assert.equal(busca('   ').length, 19);
});

test('agrupado por organização e grupo, na ordem do PDF', () => {
  const g = agruparPorOrganizacao(LIDO.chamados);
  assert.deepEqual(g.map(o => [o.org, o.total, o.vagos, o.grupos.map(x => [x.grupo, x.chamados.length])]), [
    ['Bispado', 6, 2, [['', 6]]],
    ['Quórum de Élderes', 7, 4, [['Presidência do Quórum de Élderes', 4], ['Atividades', 3]]],
    ['Quóruns do Sacerdócio Aarônico', 2, 1, [['Presidência do Quórum de Exemplo', 1], ['Líderes adultos do quórum de exemplo e da classe de exemplo', 1]]],
    ['Primária', 4, 1, [['Atividades da Primária — Meninas, Atividade da Primária — Meninos', 1], ['Professores', 3]]],
  ]);
  // o mesmo grupo espalhado volta a um só, no lugar da 1ª aparição
  const soltos = [
    { org: 'A', grupo: 'x', nome: '' }, { org: 'B', grupo: 'y', nome: 'Simulado, Ana' }, { org: 'A', grupo: 'z', nome: '' }, { org: 'A', grupo: 'x', nome: 'Teste, Lúcia' },
  ];
  assert.deepEqual(agruparPorOrganizacao(soltos).map(o => [o.org, o.grupos.map(x => [x.grupo, x.chamados.length])]),
    [['A', [['x', 2], ['z', 1]]], ['B', [['y', 1]]]]);
  assert.deepEqual(agruparPorOrganizacao([]), []);
});

// ---------- membros ----------
test('chamados de um membro: sem acento, caixa ou espaço sobrando, com ou sem a vírgula', () => {
  const de = n => chamadosDoMembro(LIDO.chamados, n).map(c => c.chamado);
  assert.deepEqual(de('Exemplar, Fábio'), ['Presidente do Quórum de Élderes', 'Consultor do Quórum de Exemplo']);
  assert.deepEqual(de('  exemplar ,  FABIO '), ['Presidente do Quórum de Élderes', 'Consultor do Quórum de Exemplo']);
  assert.deepEqual(de('Bruno Henrique Exemplo'), ['Bispo']);               // cadastrado à mão, na ordem natural
  assert.deepEqual(de('Exemplo, Bruno'), []);                              // outra pessoa
  assert.deepEqual(de(''), []);
  assert.deepEqual(chamadosDoMembro(undefined, 'Exemplo, Bruno'), []);
});

test('membros sem chamado: adultos do quadro que não ocupam nenhum', () => {
  const quadro = [
    { name: 'Exemplo, Bruno Henrique', age: 41 },
    { name: 'Novo, Hélio Fictício Da Hipotético', age: 33 },
    { name: 'Jovem, Igor', age: 16 },
    { name: 'Sem Idade, Joana', age: 0 },
    { name: 'Simulado, Ana Clara', age: 30 },
    { name: 'Teste, Mariana', age: 18 },
    { name: 'Teste, Otávio', age: '52' },
  ];
  const nomes = l => l.map(m => m.name);
  assert.deepEqual(nomes(membrosSemChamado(quadro, LIDO.chamados)), ['Novo, Hélio Fictício Da Hipotético', 'Teste, Mariana', 'Teste, Otávio']);
  assert.deepEqual(nomes(membrosSemChamado(quadro, LIDO.chamados, { idadeMin: 12 })),
    ['Novo, Hélio Fictício Da Hipotético', 'Jovem, Igor', 'Teste, Mariana', 'Teste, Otávio']);
  assert.deepEqual(nomes(membrosSemChamado(quadro, LIDO.chamados, { busca: 'helio' })), ['Novo, Hélio Fictício Da Hipotético']);
  assert.equal(membrosSemChamado(quadro, []).length, 5);
  assert.deepEqual(membrosSemChamado(undefined, LIDO.chamados), []);
});

test('índice por pessoa (cartão do membro): o mesmo que chamadosDoMembro, para cada um', () => {
  const de = indicePorPessoa(LIDO.chamados);
  for (const n of ['Exemplar, Fábio', '  exemplar ,  FABIO ', 'Bruno Henrique Exemplo', 'Simulado, Ana Clara', 'Exemplo, Bruno', '']) {
    assert.deepEqual(de(n), chamadosDoMembro(LIDO.chamados, n), n);
  }
  assert.deepEqual(de('Simulado, Ana Clara').map(c => c.chamado), ['Líder de Atividades da Primária', 'Professor da Primária']);
  assert.deepEqual(indicePorPessoa(undefined)('Exemplar, Fábio'), []);
  // o vago ("Chamado em Aberto") não é de ninguém
  assert.deepEqual(de('Chamado em Aberto'), []);
});

test('membro do quadro: o mesmo nome em qualquer forma, ou null', () => {
  const quadro = [{ id: 1, name: 'Exemplo, Bruno Henrique' }, { id: 2, name: 'Simulado, Ana Clara' }, { id: 3 }];
  assert.equal(membroDoQuadro(quadro, 'Simulado, Ana Clara').id, 2);
  assert.equal(membroDoQuadro(quadro, 'ana clara SIMULADO').id, 2);
  assert.equal(membroDoQuadro(quadro, 'Exemplo, Bruno'), null);
  assert.equal(membroDoQuadro(quadro, ''), null);
  assert.equal(membroDoQuadro(undefined, 'Simulado, Ana Clara'), null);
});

// ---------- a designação na Agenda ----------
const lider = LIDO.chamados.find(c => c.chamado === 'Líder de Atividades da Primária');   // Simulado, Ana Clara, apoiada em 11/08/2026
const entrevista = (extra = {}) => ({ membro: 'Simulado, Ana Clara', tipo: TIPO_DESIGNACAO, status: 'agendada', data: '2026-10-18', hora: '12:30', ...extra });

test('designação na Agenda: marcada, feita depois do apoio ou nada', () => {
  assert.equal(designacaoNaAgenda([], lider), null);
  assert.equal(designacaoNaAgenda(undefined, lider), null);
  // outro tipo, outra pessoa: não conta
  assert.equal(designacaoNaAgenda([entrevista({ tipo: 'Apoio de Chamado' }), entrevista({ membro: 'Teste, Lúcia' })], lider), null);
  // em aberto (pendente ou agendada), com o nome em qualquer forma
  const marcada = entrevista({ membro: 'Ana Clara Simulado' });
  assert.deepEqual(designacaoNaAgenda([marcada], lider), { estado: 'marcada', e: marcada });
  assert.equal(designacaoNaAgenda([entrevista({ status: 'pendente', data: '' })], lider).estado, 'marcada');
  // a em aberto vale mais que a feita; das abertas, a de data mais próxima (sem data por último)
  const semData = entrevista({ status: 'pendente', data: '' }), cedo = entrevista({ data: '2026-10-11' });
  assert.equal(designacaoNaAgenda([entrevista({ status: 'realizada' }), semData, entrevista(), cedo], lider).e, cedo);
  // feita no dia do apoio ou depois: falta marcar no LCR
  const feita = entrevista({ status: 'realizada', data: '2026-08-11' });
  assert.deepEqual(designacaoNaAgenda([feita], lider), { estado: 'feita', e: feita });
  // sem data, vale o dia em que foi registrada como realizada
  assert.equal(designacaoNaAgenda([entrevista({ status: 'realizada', data: '', realizadaEm: '2026-09-01T15:00:00.000Z' })], lider).estado, 'feita');
  // feita antes do apoio era de outro chamado; não realizada não conta
  assert.equal(designacaoNaAgenda([entrevista({ status: 'realizada', data: '2026-03-01' })], lider), null);
  assert.equal(designacaoNaAgenda([entrevista({ status: 'nao-realizada' })], lider), null);
  // vago não tem de quem marcar
  assert.equal(designacaoNaAgenda([entrevista()], { chamado: 'Professor da Primária', nome: '' }), null);
});

test('resumo das designações (Início): a conta do "A designar", com o que a Agenda já tem', () => {
  const r = resumoDesignacoes(LIDO.chamados, [
    entrevista(),                                                                    // a Ana Clara: marcada
    { membro: 'Amostra, Gilberto', tipo: TIPO_DESIGNACAO, status: 'realizada', data: '2026-05-03' },   // feita
    { membro: 'Exemplo, Bruno Henrique', tipo: TIPO_DESIGNACAO, status: 'agendada', data: '2026-10-18' }, // já designado: não conta
  ]);
  assert.equal(r.total, resumoChamados(LIDO.chamados).aDesignar);
  assert.deepEqual([r.total, r.marcadas, r.feitas], [3, 1, 1]);
  assert.deepEqual(r.pendentes.map(p => [p.c.chamado, p.agenda?.estado ?? null]), [
    ['Secretário Executivo da Ala', null],
    ['Secretário do Quórum de Élderes', 'feita'],
    ['Líder de Atividades da Primária', 'marcada'],
  ]);
  assert.deepEqual(resumoDesignacoes([], []), { total: 0, marcadas: 0, feitas: 0, pendentes: [] });
  assert.equal(resumoDesignacoes(LIDO.chamados, undefined).marcadas, 0);
});

test('observação da designação: o chamado e onde fica, em até 100 caracteres', () => {
  // o grupo comprido (110 caracteres com ele) sai; a organização fica
  assert.equal(obsDaDesignacao(lider), 'Líder de Atividades da Primária (Primária)');
  assert.equal(obsDaDesignacao({ org: 'Bispado', grupo: '', chamado: 'Bispo' }), 'Bispo (Bispado)');
  assert.equal(obsDaDesignacao({ org: 'Primária', grupo: 'Professores', chamado: 'Professor da Primária' }), 'Professor da Primária (Primária › Professores)');
  assert.equal(obsDaDesignacao({ chamado: 'Recepcionista' }), 'Recepcionista');
  // o grupo sai antes da organização; o título só é cortado em último caso
  assert.equal(obsDaDesignacao({ org: 'Org', grupo: 'G'.repeat(90), chamado: 'Chamado' }), 'Chamado (Org)');
  const longo = obsDaDesignacao({ org: 'Org', chamado: 'C'.repeat(150) });
  assert.equal(longo.length, 100);
  assert.ok(longo.endsWith('…'));
  for (const c of LIDO.chamados) assert.ok(obsDaDesignacao(c).length <= 100, c.chamado);
});

test('o tipo da designação está na lista de tipos da Agenda, no grupo "Chamados"', () => {
  // agenda.js tem DOM: lido como texto, como o CARGOS do config.js
  const agenda = readFileSync(new URL('../js/agenda.js', import.meta.url), 'utf8');
  const lista = agenda.match(/TIPOS_ENTREVISTA = \[([\s\S]*?)\];/)[1];
  const chamados = lista.slice(lista.indexOf('// Chamados'), lista.indexOf('// Liderança'));
  assert.match(chamados, /\bTIPO_DESIGNACAO,/);
  assert.match(TIPO_DESIGNACAO, /Designação de Chamado \(Imposição de Mãos\)/);
});

// ---------- prévia da importação ----------
test('comparar dois relatórios: quem entrou, quem saiu e quem trocou', () => {
  const antes = LIDO.chamados;
  const depois = antes.map(c => {
    if (c.chamado === 'Bispo') return { ...c, nome: 'Teste, Otávio' };                         // trocou
    if (c.chamado === 'Segundo Conselheiro no Bispado') return { ...c, nome: 'Novo, Hélio' };    // era vago
    if (c.chamado === 'Secretário da Ala') return { ...c, nome: '', apoiado: '', designado: false };  // ficou vago
    if (c.nome === 'Simulado, Ana Clara' && c.grupo === 'Professores') return { ...c, nome: 'Teste, Mariana' };
    return c;
  });
  // a ordem dos chamados no relatório não conta como mudança
  depois.reverse();
  const r = compararChamados(antes, depois);
  assert.deepEqual(r.trocados, [
    { org: 'Primária', grupo: 'Professores', chamado: 'Professor da Primária', antes: 'Simulado, Ana Clara', depois: 'Teste, Mariana' },
    { org: 'Bispado', grupo: '', chamado: 'Bispo', antes: 'Exemplo, Bruno Henrique', depois: 'Teste, Otávio' },
  ]);
  assert.deepEqual(r.novos, [{ org: 'Bispado', grupo: '', chamado: 'Segundo Conselheiro no Bispado', nome: 'Novo, Hélio' }]);
  assert.deepEqual(r.saidos, [{ org: 'Bispado', grupo: '', chamado: 'Secretário da Ala', nome: 'Amostra, Eduardo' }]);
});

test('comparar: mesmo relatório não muda nada; do zero, todos os preenchidos são novos', () => {
  assert.deepEqual(compararChamados(LIDO.chamados, LIDO.chamados), { novos: [], saidos: [], trocados: [] });
  // o nome escrito com outra caixa/acento é a mesma pessoa
  const recaixa = LIDO.chamados.map(c => ({ ...c, nome: c.nome.toUpperCase() }));
  assert.deepEqual(compararChamados(LIDO.chamados, recaixa), { novos: [], saidos: [], trocados: [] });
  assert.equal(compararChamados([], LIDO.chamados).novos.length, 11);
  assert.equal(compararChamados(LIDO.chamados, undefined).saidos.length, 11);
  // dois ocupantes do mesmo título: sai um, entra outro → um par só
  const prof = n => ({ org: 'Primária', grupo: 'Professores', chamado: 'Professor da Primária', nome: n });
  assert.deepEqual(compararChamados([prof('Simulado, Ana'), prof('Teste, Lúcia')], [prof('Teste, Lúcia'), prof('Teste, Mariana'), prof('')]), {
    novos: [], saidos: [],
    trocados: [{ org: 'Primária', grupo: 'Professores', chamado: 'Professor da Primária', antes: 'Simulado, Ana', depois: 'Teste, Mariana' }],
  });
});

// ---------- nomes do bispado na prévia da importação ----------
test('ordem natural: "Sobrenome, Prenomes" vira "Prenomes Sobrenome"', () => {
  assert.equal(ordemNatural('Simulado, Ana Clara'), 'Ana Clara Simulado');
  assert.equal(ordemNatural('  Fictício,   Carlos  Eduardo Da '), 'Carlos Eduardo Da Fictício');
  assert.equal(ordemNatural('Ana Simulado'), 'Ana Simulado');
  assert.equal(ordemNatural(''), '');
});

test('comparar o bispado: igual, troca, vago e ausente', () => {
  const atuais = {
    'Bispo': 'Exemplo',                      // só o sobrenome, escrito à mão: a mesma pessoa
    '1º Conselheiro': 'Carlos Fictício',     // prenome + sobrenome: a mesma pessoa
    '2º Conselheiro': 'Rui Hipotético',      // o LCR diz vago: o nome sai
    'Secretário': 'Outro Nome',              // outra pessoa no chamado
  };
  const r = compararBispado(LIDO.chamados, atuais);
  assert.deepEqual(r.map(b => b.cargo), CARGOS);
  assert.deepEqual(r.map(b => [b.cargo, b.estado, b.novo]), [
    ['Bispo', 'igual', 'Exemplo'],
    ['1º Conselheiro', 'igual', 'Carlos Fictício'],
    ['2º Conselheiro', 'vago', ''],
    ['Secretário', 'troca', 'Eduardo Amostra'],
    ['Secretário Executivo', 'troca', 'Daniel Modelo Teste'],   // não tinha nome
  ]);
  assert.equal(r[0].lcr, 'Exemplo, Bruno Henrique');
  // vago no LCR e sem nome aqui: nada muda
  assert.equal(compararBispado(LIDO.chamados, {})[2].estado, 'igual');
  // PDF sem o Bispado (cortado, outro relatório): os nomes ficam
  const semBispado = LIDO.chamados.filter(c => c.org !== 'Bispado');
  assert.ok(compararBispado(semBispado, atuais).every(b => b.estado === 'ausente' && b.novo === b.atual));
  assert.ok(compararBispado(undefined, undefined).every(b => b.estado === 'ausente'));
});

test('nomes depois de importar: troca entra, vago sai, o resto fica', () => {
  const atuais = { 'Bispo': 'Exemplo', '2º Conselheiro': 'Rui Hipotético', 'Secretário': 'Outro Nome', 'Cargo antigo': 'Fica' };
  assert.deepEqual(nomesAposImportar(atuais, compararBispado(LIDO.chamados, atuais)), {
    'Bispo': 'Exemplo',
    '1º Conselheiro': 'Carlos Fictício',
    'Secretário': 'Eduardo Amostra',
    'Secretário Executivo': 'Daniel Modelo Teste',
    'Cargo antigo': 'Fica',
  });
  assert.deepEqual(atuais['2º Conselheiro'], 'Rui Hipotético', 'não altera o mapa recebido');
  assert.deepEqual(nomesAposImportar(undefined, undefined), {});
});

// ---------- o documento do servidor ----------
test('documento: a leitura do PDF passa inteira pela limpeza do servidor', () => {
  const r = limparDocumentoChamados({ chamados: LIDO.chamados, relatorio: LIDO.relatorio });
  assert.equal(r.erro, undefined);
  assert.deepEqual(r.doc, { chamados: LIDO.chamados, relatorio: LIDO.relatorio });
  assert.deepEqual(limparDocumentoChamados({ chamados: [] }).doc, { chamados: [], relatorio: null });
  assert.deepEqual(DOC_CHAMADOS_VAZIO, { chamados: [], relatorio: null, atualizadoEm: null });
  assert.ok(Object.isFrozen(DOC_CHAMADOS_VAZIO) && Object.isFrozen(DOC_CHAMADOS_VAZIO.chamados), 'o padrão é compartilhado');
});

test('documento: chave desconhecida não grava (nada de telefone ou e-mail)', () => {
  const r = limparDocumentoChamados({
    chamados: [{ org: 'Bispado', grupo: '', chamado: 'Bispo', nome: 'Exemplo, Bruno', apoiado: '2026-09-13', designado: true,
      personalizado: false, telefone: '(63) 90000-0001', email: 'bruno@example.com', nascimento: '3 mar 1985' }],
    relatorio: { ala: 'Ala Exemplo 9', unidade: '000009', estaca: 'Estaca Exemplo Brasil', data: '2026-10-14', extra: 'x' },
    atualizadoEm: '1999-01-01T00:00:00.000Z', outra: 1,
  });
  assert.deepEqual(r.doc, {
    chamados: [{ org: 'Bispado', grupo: '', chamado: 'Bispo', nome: 'Exemplo, Bruno', apoiado: '2026-09-13', designado: true, personalizado: false }],
    relatorio: { ala: 'Ala Exemplo 9', unidade: '000009', estaca: 'Estaca Exemplo Brasil', data: '2026-10-14' },
  });
  assert.doesNotMatch(JSON.stringify(r.doc), /90000|example\.com|1985|1999|outra|extra/);
});

test('documento: campos ausentes viram vazio, espaços somem e o vago não tem data nem designação', () => {
  const r = limparDocumentoChamados({ chamados: [
    { chamado: '  Professor   da Primária ' },
    { org: 'Primária', chamado: 'Professor', nome: '  ', apoiado: '2026-08-11', designado: true },
  ] });
  assert.deepEqual(r.doc.chamados, [
    { org: '', grupo: '', chamado: 'Professor da Primária', nome: '', apoiado: '', designado: false, personalizado: false },
    { org: 'Primária', grupo: '', chamado: 'Professor', nome: '', apoiado: '', designado: false, personalizado: false },
  ]);
});

test('documento: forma errada recusa o corpo inteiro', () => {
  const ok = { org: 'Bispado', chamado: 'Bispo', nome: 'Exemplo, Bruno', apoiado: '2026-09-13', designado: true };
  const recusa = (corpo, campo) => {
    const r = limparDocumentoChamados(corpo);
    assert.equal(r.doc, undefined, String(JSON.stringify(corpo)).slice(0, 80));
    assert.match(r.erro, campo);
  };
  for (const corpo of [null, undefined, 'texto', 42, [], [ok]]) recusa(corpo, /corpo/);
  recusa({}, /chamados/);
  recusa({ chamados: 'x' }, /chamados/);
  recusa({ chamados: { 0: ok } }, /chamados/);
  recusa({ chamados: Array.from({ length: MAX_CHAMADOS + 1 }, () => ok) }, /no máximo/);
  recusa({ chamados: [ok, null] }, /chamados\[1\]/);
  recusa({ chamados: [ok, [ok]] }, /chamados\[1\]/);
  recusa({ chamados: [{ ...ok, chamado: '' }] }, /chamado: vazio/);
  recusa({ chamados: [{ ...ok, chamado: '   ' }] }, /chamado: vazio/);
  recusa({ chamados: [{ ...ok, nome: 12 }] }, /\.nome/);
  recusa({ chamados: [{ ...ok, org: { a: 1 } }] }, /\.org/);
  recusa({ chamados: [{ ...ok, grupo: 'x'.repeat(MAX_TEXTO_CHAMADO + 1) }] }, /\.grupo/);
  recusa({ chamados: [{ ...ok, apoiado: '13 set 2026' }] }, /\.apoiado/);
  recusa({ chamados: [{ ...ok, apoiado: '2026-13-01' }] }, /\.apoiado/);
  recusa({ chamados: [{ ...ok, apoiado: '2026-09-32' }] }, /\.apoiado/);
  recusa({ chamados: [{ ...ok, designado: 'sim' }] }, /\.designado/);
  recusa({ chamados: [{ ...ok, personalizado: 1 }] }, /\.personalizado/);
  recusa({ chamados: [ok], relatorio: 'Ala Exemplo' }, /relatorio/);
  recusa({ chamados: [ok], relatorio: [] }, /relatorio/);
  recusa({ chamados: [ok], relatorio: { ala: 9 } }, /relatorio\.ala/);
  recusa({ chamados: [ok], relatorio: { data: '14 out. 2026' } }, /relatorio\.data/);
  // no limite ainda passa
  assert.equal(limparDocumentoChamados({ chamados: Array.from({ length: MAX_CHAMADOS }, () => ok) }).doc.chamados.length, MAX_CHAMADOS);
  assert.ok(limparDocumentoChamados({ chamados: [{ ...ok, nome: 'x'.repeat(MAX_TEXTO_CHAMADO) }] }).doc);
  assert.equal(limparDocumentoChamados({ chamados: [ok], relatorio: null }).doc.relatorio, null);
});
