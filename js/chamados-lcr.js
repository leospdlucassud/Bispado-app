// =============================================
// RELATÓRIO "ORGANIZAÇÕES E CHAMADOS" DO LCR — sem DOM
// Lê o PDF que o próprio LCR gera e devolve cada chamado da ala, preenchido ou
// vago, com a data em que foi apoiado e se já houve a designação (imposição de
// mãos). Daqui saem a aba Chamados (resumo, filtros, grupos, prévia da
// importação), os chamados no cartão do membro, o aviso do Início, a designação
// marcada na Agenda e os nomes do bispado — e a limpeza do que o servidor grava
// (limparDocumentoChamados, usada pela function). Nada de DOM
// nem de config.js (que lê location): tests/chamados-lcr.test.mjs importa direto
// no Node, com um relatório sintético da mesma geometria.
//
// O relatório traz também a lista de membros de cada organização, com idade,
// nascimento, telefone e e-mail. Essas seções são PULADAS inteiras, de
// propósito: o quadro de membros vem da "Lista de Membros" (membros-import.js),
// e um dado pessoal a mais guardado é um dado a mais para vazar.
//
// Geometria (pdf.js, A4 595×842, y cresce para cima), medida no relatório de 2026:
//   moldura da página, corpo 9 — no alto "Organizações e Chamados", "<Ala> (n)"
//     e "<Estaca> (n)"; embaixo a data do relatório, "Somente para Uso da Igreja"
//     e o número da página. Ignorada como conteúdo; dela saem ala, estaca e data.
//   organização, corpo 12; grupo, corpo 9,36; e o 3º nível em negrito no corpo 8
//     das tabelas, na margem dos títulos, logo acima do cabeçalho da tabela (o
//     pdf.js do navegador não diz com segurança o que é negrito, por isso vale
//     a posição). Título terminado em " Membros" abre a lista de membros (pulada)
//     e diz de que grupo são os títulos de 3º nível que vêm depois dela.
//   tabela: "Chamado | Nome | Apoiado | Designado por Imposição de Mãos"; o nome
//     vem como no LCR ("Sobrenome, Prenomes") ou "Chamado em Aberto" (vago); a
//     data como "13 set 2026"; "✓" quando designado. "* " no começo = chamado
//     personalizado, explicado pela nota "* chamado personalizado" (que não é
//     linha). "Contagem: N" fecha a tabela — e serve de conferência. Tabela que
//     passa de página repete o cabeçalho, sem título.
//   uma célula que quebra desce ~9 pt por linha e as outras ficam centralizadas
//     no meio dela; de um registro ao outro são ~13,5 pt.
// =============================================
import { TIPO_DESIGNACAO } from './convite-regras.js';
import { norm, partesDoNascimento } from './utils.js';

// ---------- tolerâncias ----------
// Relativas ao corpo das tabelas (8 pt em 2026), nunca por igualdade: o
// relatório de outra ala, ou de outra versão do LCR, muda um décimo aqui e ali.
const MESMA_LINHA = 0.25;     // × corpo do trecho: o ✓ vem 0,1 pt acima do resto da linha
const MESMO_REGISTRO = 1.4;   // × corpo: linhas mais próximas que isto são do mesmo registro (quebra ≈ 4,5; registro ≈ 13,5)
const TITULO_ORG = 1.3;       // × corpo: daqui para cima é organização (12 pt)
const TITULO_GRUPO = 1.08;    // × corpo: daqui até TITULO_ORG, grupo (9,36 pt)
const TITULO_QUEBRADO = 1.3;  // × corpo do título: a linha de baixo, assim colada, continua a de cima
const COLA = 0.15;            // × corpo: trechos mais perto que isto são a mesma palavra (o espaço tem ~0,27)
const FOLGA_COLUNA = 3;       // pt: o texto da célula começa 1,5 pt depois do rótulo do cabeçalho
const MARGEM_TITULO = 0.5;    // pt: título fica à esquerda do "Chamado" do cabeçalho; a linha, 1,5 pt à direita
const VAO_COLUNA = 1.5;       // × corpo: vão maior que isto dentro de uma linha é passagem de coluna, não espaço

const RE_TITULO_RELATORIO = /^organizacoes e chamados$/;   // já passado pelo norm
const RE_RODAPE = /somente para uso da igreja/i;
const RE_UNIDADE = /^(.*\S)\s*\((\d+)\)$/;
const RE_CONTAGEM = /^contagem:?\s*(\d+)$/i;
const RE_NOTA = /^\*\s*chamado personalizado$/i;
const RE_DATA_NO_TEXTO = /\d{1,2}\s+[a-zç]{3}\.?\s+\d{4}/i;
const RE_DESIGNADO = /[✓✔√]/;
const VAGO = 'chamado em aberto';

// ---------- datas e nomes ----------
const dois = n => String(n).padStart(2, '0');

// "13 set 2026" / "14 out. 2026" → "2026-09-13" / "2026-10-14"; '' se não for data
export function dataLcr(texto) {
  const p = partesDoNascimento(texto);
  return p ? `${p.a}-${dois(p.m)}-${dois(p.d)}` : '';
}

// "Simulado, Ana Clara Da" → "Ana Simulado": o 1º prenome e o sobrenome
// inteiro (o que vem antes da vírgula) — é assim que o bispado já escreve os
// nomes dos chamados. Não é o nomeCurto de discursos-regras.js, que fica com o
// último nome ("Exemplo Modelo, Bruno" lá vira "Bruno Modelo"; aqui, "Bruno Exemplo Modelo").
export function nomeCurto(nomeLcr) {
  const s = String(nomeLcr || '').replace(/\s+/g, ' ').trim();
  const i = s.indexOf(',');
  if (i < 0) return s;
  const sobrenome = s.slice(0, i).trim();
  const prenome = s.slice(i + 1).trim().split(' ')[0] || '';
  return [prenome, sobrenome].filter(Boolean).join(' ');
}

// "Simulado, Ana Clara" → "Ana Clara Simulado". Sem o nomeNatural de
// discursos-regras.js: lá, prenome em minúscula depois da vírgula ("Modelo, da
// Estaca Exemplo") não é invertido — e aqui o nome sempre é de pessoa.
// (A aba Chamados mostra o ocupante e o membro sem chamado assim.)
export const ordemNatural = nome => {
  const s = String(nome || '').replace(/\s+/g, ' ').trim();
  const i = s.indexOf(',');
  return i < 0 ? s : `${s.slice(i + 1).trim()} ${s.slice(0, i).trim()}`.trim();
};

// Mesma pessoa com ou sem a vírgula do LCR, acento, caixa ou espaço sobrando
// ("Simulado, Ana" = "ana  SIMULADO"). O membro cadastrado à mão vem na ordem natural.
const chavePessoa = nome => norm(ordemNatural(nome));

// ---------- trechos e linhas do PDF ----------
// Corpo da fonte: a escala da matriz (sem rotação, transform[0] = transform[3]).
const corpoDe = t => Math.hypot(t[0], t[1]) || Math.hypot(t[2], t[3]) || 0;

function trechosDaPagina(itens) {
  const out = [];
  for (const i of itens || []) {
    if (!i || typeof i.str !== 'string' || !i.str.trim() || !Array.isArray(i.transform)) continue;
    const f = corpoDe(i.transform) || 8;
    // sem width (há PDF em que o pdf.js não preenche), estima pelo corpo
    const w = i.width > 0 ? i.width : i.str.length * f * 0.5;
    out.push({ s: i.str, x: i.transform[4], y: i.transform[5], f, w });
  }
  return out;
}

// Junta os trechos de UMA linha física, da esquerda para a direita: com espaço,
// a não ser que a largura diga que um encosta no outro (acento solto, palavra
// que o PDF partiu em dois pedaços).
function juntarTrechos(trechos) {
  let out = '';
  trechos.forEach((t, k) => {
    const a = trechos[k - 1];
    if (a && t.x - (a.x + a.w) > Math.min(a.f, t.f) * COLA) out += ' ';
    out += t.s;
  });
  return out.replace(/\s+/g, ' ').trim();
}

// Linhas físicas, de cima para baixo. Cada uma: { y, f (maior corpo), x, itens, texto }.
function linhasDaPagina(itens) {
  const trechos = trechosDaPagina(itens).sort((a, b) => b.y - a.y || a.x - b.x);
  const linhas = [];
  for (const t of trechos) {
    const l = linhas.at(-1);
    if (l && l.y - t.y <= Math.min(l.f, t.f) * MESMA_LINHA) { l.itens.push(t); l.f = Math.max(l.f, t.f); }
    else linhas.push({ y: t.y, f: t.f, itens: [t] });
  }
  for (const l of linhas) {
    l.itens.sort((a, b) => a.x - b.x);
    l.x = l.itens[0].x;
    l.texto = juntarTrechos(l.itens);
  }
  return linhas;
}

const rotulo = (l, inicio) => l.itens.find(i => norm(i.s).startsWith(inicio));
const ehCabecalhoChamados = l => !!l && l.itens.length >= 3 && norm(l.itens[0].s) === 'chamado'
  && l.itens.some(i => norm(i.s) === 'nome') && !!rotulo(l, 'apoiado');
// a lista de membros de cada organização (pulada); "sexo" é o da Lista de Membros
const ehCabecalhoMembros = l => !!l && l.itens.some(i => norm(i.s) === 'nome')
  && l.itens.some(i => ['idade', 'sexo'].includes(norm(i.s)));

// ---------- moldura da página ----------
// O alto e o pé de cada página não são conteúdo. O alto é achado pela linha
// "Organizações e Chamados" (com ala e estaca logo acima e abaixo dela); o pé,
// pelo "Somente para Uso da Igreja". O corte vale para as páginas seguintes
// também, caso alguma venha sem a moldura inteira.
function tirarMoldura(linhas, molde) {
  const titulo = linhas.find(l => RE_TITULO_RELATORIO.test(norm(l.texto)));
  if (titulo) {
    const alto = linhas.filter(l => l === titulo || (Math.abs(l.y - titulo.y) <= titulo.f * 1.5 && RE_UNIDADE.test(l.texto)));
    molde.topo = Math.min(...alto.map(l => l.y));
    if (!molde.relatorio) {
      // a unidade de cima é a ala; a de baixo, a estaca
      const [ala, estaca] = alto.filter(l => l !== titulo).map(l => RE_UNIDADE.exec(l.texto));
      molde.relatorio = { ala: ala ? ala[1].trim() : '', unidade: ala ? ala[2] : '', estaca: estaca ? estaca[1].trim() : '', data: '' };
    }
  }
  const pe = linhas.filter(l => RE_RODAPE.test(l.texto));
  if (pe.length) {
    molde.rodape = Math.max(...pe.map(l => l.y));
    if (molde.relatorio && !molde.relatorio.data) {
      const d = pe.map(l => RE_DATA_NO_TEXTO.exec(l.texto)).find(Boolean);
      if (d) molde.relatorio.data = dataLcr(d[0].replace(/\s+/g, ' '));
    }
  }
  return linhas.filter(l => !(molde.topo != null && l.y >= molde.topo - 1) && !(molde.rodape != null && l.y <= molde.rodape + 1));
}

// ---------- o relatório ----------
// paginas: por página, os itens do pdf.js ({ str, transform, width, hasEOL }).
// Devolve { relatorio: { ala, unidade, estaca, data } | null,
//           chamados: [{ org, grupo, chamado, nome ('' = vago), apoiado (AAAA-MM-DD ou ''), designado, personalizado }],
//           tabelas:  [{ org, grupo, pagina, lidos, contagem (null se o PDF não trouxe) }] }
// Tabela com lidos ≠ contagem leu errado (ou o PDF veio cortado): a prévia avisa.
export function parsearPdfChamados(paginas) {
  const todas = (paginas || []).map(linhasDaPagina);
  const molde = { topo: null, rodape: null, relatorio: null };
  const conteudo = todas.map(linhas => tirarMoldura(linhas, molde));

  const chamados = [], tabelas = [];
  // o corpo das tabelas é o do rótulo "Chamado" do 1º cabeçalho; sem cabeçalho, não há chamado
  const cab = conteudo.flat().find(ehCabecalhoChamados);
  if (!cab) return { relatorio: molde.relatorio, chamados, tabelas };
  const corpo = cab.itens[0].f;
  const nivel = l => (l.f >= corpo * TITULO_ORG ? 1 : l.f >= corpo * TITULO_GRUPO ? 2 : 0);

  const colunasDe = l => {
    const x = r => rotulo(l, r)?.x;
    return { chamado: l.itens[0].x, nome: x('nome'), apoiado: x('apoiado'), designado: x('designado') ?? Infinity };
  };

  let org = '', sub = '', terc = '';
  let modo = null;          // 'chamados' | 'membros' | null (entre uma tabela e outra)
  let cols = colunasDe(cab);  // x dos rótulos do último cabeçalho (antes do 1º, os dele mesmo)
  let tabela = null;        // a tabela aberta (continua na página seguinte até a "Contagem")
  let registro = null;      // linhas físicas do registro sendo lido
  let pendente = [];        // linhas de um título de 3º nível que ainda não achou o cabeçalho

  const coluna = x => (x < cols.nome - FOLGA_COLUNA ? 'chamado'
    : x < cols.apoiado - FOLGA_COLUNA ? 'nome'
    : x < cols.designado - FOLGA_COLUNA ? 'apoiado' : 'designado');
  // Título de 3º nível tem forma de título: começa na margem, à esquerda do
  // rótulo "Chamado" (a linha da tabela começa 1,5 pt à direita dele; o nome na
  // lista de membros, 20 pt), e é um texto corrido, sem o vão de uma coluna para
  // outra. Não dá para exigir que caiba na coluna Chamado: o título não é célula
  // e pode passar por cima da coluna Nome. Sem isso, a última linha de uma lista
  // de membros que viesse sem a "Contagem" viraria o nome do grupo — com telefone e tudo.
  const formaDeTitulo = l => l.x <= cols.chamado + MARGEM_TITULO
    && l.itens.every((i, k) => !k || i.x - (l.itens[k - 1].x + l.itens[k - 1].w) < corpo * VAO_COLUNA);

  const fechar = () => {
    const linhas = registro;
    registro = null;
    if (!linhas || !tabela) return;
    const cel = { chamado: [], nome: [], apoiado: [], designado: [] };
    for (const l of linhas) {
      const porColuna = {};
      for (const i of l.itens) (porColuna[coluna(i.x)] ||= []).push(i);
      for (const [c, itens] of Object.entries(porColuna)) cel[c].push(juntarTrechos(itens));
    }
    const texto = c => cel[c].join(' ').replace(/\s+/g, ' ').trim();
    const titulo = texto('chamado'), nome = texto('nome');
    if (!titulo && !nome) return;
    const vago = norm(nome) === VAGO;
    chamados.push({
      org: tabela.org, grupo: tabela.grupo,
      chamado: titulo.replace(/^\*\s*/, ''),
      nome: vago ? '' : nome,
      apoiado: vago ? '' : dataLcr(texto('apoiado')),
      designado: !vago && RE_DESIGNADO.test(texto('designado')),
      personalizado: titulo.startsWith('*'),
    });
    tabela.lidos++;
  };

  conteudo.forEach((linhas, p) => {
    for (let k = 0; k < linhas.length; k++) {
      const l = linhas[k], prox = linhas[k + 1];
      const n = nivel(l);

      if (n) {
        fechar();
        // título comprido quebra em duas linhas do mesmo corpo, coladas — mas a
        // lista de membros logo abaixo do título ("Moças" / "Moças Membros") não é quebra
        let texto = l.texto, ult = l;
        while (linhas[k + 1] && nivel(linhas[k + 1]) === n && ult.y - linhas[k + 1].y < ult.f * TITULO_QUEBRADO
          && !norm(linhas[k + 1].texto).startsWith(norm(texto))) {
          ult = linhas[++k];
          texto += ' ' + ult.texto;
        }
        const lista = /\s+membros$/i.exec(texto);
        const nome = lista ? texto.slice(0, lista.index).trim() : texto;
        // "Quórum de Mestres Membros" vem sem um título "Quórum de Mestres" antes:
        // é ele que diz de que grupo são os títulos de 3º nível que seguem
        if (n === 1) { org = nome; sub = ''; } else sub = nome;
        terc = '';
        tabela = null;
        modo = lista ? 'membros' : null;
        pendente = [];
        continue;
      }

      if (ehCabecalhoChamados(l)) {
        fechar();
        cols = colunasDe(l);
        if (!tabela) {
          if (pendente.length) terc = pendente.join(' ');
          tabela = { org, grupo: terc || sub, pagina: p + 1, lidos: 0, contagem: null };
          tabelas.push(tabela);
        }
        modo = 'chamados';
        pendente = [];
        continue;
      }
      if (ehCabecalhoMembros(l)) { fechar(); tabela = null; modo = 'membros'; pendente = []; continue; }

      const contagem = RE_CONTAGEM.exec(l.texto);
      if (contagem) {
        fechar();
        if (tabela) tabela.contagem = +contagem[1];   // só há tabela aberta no modo 'chamados'
        tabela = null; modo = null; pendente = [];
        continue;
      }
      if (RE_NOTA.test(l.texto)) { fechar(); continue; }

      // título de 3º nível: logo acima de um cabeçalho de tabela
      if (ehCabecalhoChamados(prox) && formaDeTitulo(l)) {
        fechar();
        terc = [...pendente, l.texto].slice(-3).join(' ');
        tabela = null; modo = null; pendente = [];
        continue;
      }

      if (modo === 'chamados') {
        if (registro && registro.at(-1).y - l.y < corpo * MESMO_REGISTRO) registro.push(l);
        else { fechar(); registro = [l]; }
      } else if (modo === null) {
        // fora de tabela, texto do corpo só pode ser título de 3º nível (talvez
        // quebrado, talvez com o cabeçalho na página seguinte): só entra o que
        // tem forma de título, e ficam no máximo as 3 últimas linhas
        if (formaDeTitulo(l)) pendente = [...pendente, l.texto].slice(-3);
      }
      // modo 'membros': lista de membros, pulada
    }
    fechar();   // registro não atravessa página; a tabela, sim
  });

  return { relatorio: molde.relatorio, chamados, tabelas };
}

// Que PDF é este? 'sem-texto' (impresso como imagem, p. ex. pelo "Microsoft
// Print to PDF": não há o que ler sem OCR) | 'chamados' (Organizações e
// Chamados) | 'membros' (Lista de Membros) | 'outro'.
export function tipoDePdf(paginas) {
  const linhas = (paginas || []).flatMap(linhasDaPagina);
  if (!linhas.length) return 'sem-texto';
  if (linhas.some(l => RE_TITULO_RELATORIO.test(norm(l.texto)) || ehCabecalhoChamados(l))) return 'chamados';
  if (linhas.some(l => /lista de membros/.test(norm(l.texto)))
    || linhas.some(l => ehCabecalhoMembros(l) && l.itens.some(i => norm(i.s) === 'sexo'))) return 'membros';
  return 'outro';
}
export const tiposDePdf = tipoDePdf;   // o mesmo, com o nome do plano da aba Chamados

// ---------- bispado ----------
// O título do chamado no LCR → o cargo em CARGOS (js/config.js; a ordem é a de lá).
export const CARGOS_DO_LCR = {
  'Bispo': 'Bispo',
  'Primeiro Conselheiro no Bispado': '1º Conselheiro',
  'Segundo Conselheiro no Bispado': '2º Conselheiro',
  'Secretário da Ala': 'Secretário',
  'Secretário Executivo da Ala': 'Secretário Executivo',
};

// { 'Bispo': 'Bruno Exemplo', … } — só os preenchidos, no nome curto
export function nomesDoBispado(chamados) {
  const nomes = {};
  for (const [titulo, cargo] of Object.entries(CARGOS_DO_LCR)) {
    const c = (chamados || []).find(c => c && c.nome && norm(c.chamado) === norm(titulo));
    if (c) nomes[cargo] = nomeCurto(c.nome);
  }
  return nomes;
}

// A prévia da importação, cargo a cargo: o nome que o app tem (NOMES_CARGOS, de
// js/chamados.js — o da entrada, dos convites e da presença das atas) e o que o
// relatório diz. estado:
//   'igual'   nada muda;
//   'troca'   outra pessoa no chamado: entra o nome curto do LCR;
//   'vago'    o LCR diz que o chamado está em aberto: o nome sai;
//   'ausente' o relatório nem traz o chamado (PDF sem o Bispado): o nome fica —
//             apagar os cinco por um PDF incompleto seria o pior engano.
// O nome escrito à mão costuma ser mais curto que o do LCR ("Exemplo", "Bruno
// Exemplo" para "Exemplo Modelo, Bruno Teste"): todas as palavras dele no nome do
// LCR = a mesma pessoa, e fica como o bispado escreveu — sem isso, cada
// importação "trocaria" os cinco nomes por eles mesmos, por extenso.
export function compararBispado(chamados, nomesAtuais = {}) {
  return Object.entries(CARGOS_DO_LCR).map(([titulo, cargo]) => {
    const atual = String(nomesAtuais?.[cargo] || '').trim();
    const doTitulo = (chamados || []).filter(c => c && norm(c.chamado) === norm(titulo));
    if (!doTitulo.length) return { cargo, atual, novo: atual, lcr: '', estado: 'ausente' };
    const ocupado = doTitulo.find(c => c.nome);
    if (!ocupado) return { cargo, atual, novo: '', lcr: '', estado: atual ? 'vago' : 'igual' };
    const doLcr = new Set(norm(ordemNatural(ocupado.nome)).split(' '));
    const mesma = !!atual && norm(atual).split(' ').every(p => doLcr.has(p));
    return mesma
      ? { cargo, atual, novo: atual, lcr: ocupado.nome, estado: 'igual' }
      : { cargo, atual, novo: nomeCurto(ocupado.nome), lcr: ocupado.nome, estado: 'troca' };
  });
}

// O mapa de nomes depois de aplicar a comparação (o que não é cargo do LCR fica)
export function nomesAposImportar(nomesAtuais, comparacao) {
  const nomes = { ...(nomesAtuais || {}) };
  for (const { cargo, novo, estado } of comparacao || []) {
    if (estado === 'troca') nomes[cargo] = novo;
    else if (estado === 'vago') delete nomes[cargo];
  }
  return nomes;
}

// ---------- contas, filtros e grupos (aba Chamados) ----------
// Apoiado e ainda sem a imposição de mãos: falta marcar a designação
export const aDesignar = c => !!(c && c.nome && !c.designado);

export function resumoChamados(chamados) {
  const lista = chamados || [];
  const preenchidos = lista.filter(c => c.nome).length;
  return { total: lista.length, preenchidos, vagos: lista.length - preenchidos, aDesignar: lista.filter(aDesignar).length };
}

// 'sem-chamado' é a lista dos MEMBROS sem chamado (membrosSemChamado), não de chamados
export const FILTROS_CHAMADOS = [
  { id: 'todos', rotulo: 'Todos' },
  { id: 'vagos', rotulo: 'Vagos' },
  { id: 'a-designar', rotulo: 'A designar' },
  { id: 'sem-chamado', rotulo: 'Sem chamado' },
];
const FILTRO = {
  todos: () => true,
  preenchidos: c => !!c.nome,
  vagos: c => !c.nome,
  'a-designar': aDesignar,
  'sem-chamado': () => false,
};

// Todas as palavras buscadas precisam aparecer (em qualquer ordem): "ana
// simulado" acha "Simulado, Ana Clara Da"; "vago" acha os chamados em aberto.
const termosDe = busca => norm(busca).split(' ').filter(Boolean);
const casa = (texto, termos) => { const t = norm(texto); return termos.every(x => t.includes(x)); };

export function filtrarChamados(chamados, { filtro = 'todos', busca = '' } = {}) {
  const passa = FILTRO[filtro] || FILTRO.todos;
  const termos = termosDe(busca);
  return (chamados || []).filter(c => passa(c) && (!termos.length
    || casa([c.chamado, c.nome, ordemNatural(c.nome), c.nome ? '' : 'vago', c.org, c.grupo].join(' '), termos)));
}

// Na ordem do PDF: [{ org, total, vagos, grupos: [{ grupo, chamados }] }]
export function agruparPorOrganizacao(chamados) {
  const orgs = new Map();
  for (const c of chamados || []) {
    let o = orgs.get(c.org);
    if (!o) { o = { org: c.org, total: 0, vagos: 0, grupos: [], porGrupo: new Map() }; orgs.set(c.org, o); }
    let g = o.porGrupo.get(c.grupo);
    if (!g) { g = { grupo: c.grupo, chamados: [] }; o.porGrupo.set(c.grupo, g); o.grupos.push(g); }
    g.chamados.push(c);
    o.total++;
    if (!c.nome) o.vagos++;
  }
  return [...orgs.values()].map(({ porGrupo, ...o }) => o);
}

// Os chamados de um membro do quadro (nome como o LCR escreve, ou na ordem natural)
export function chamadosDoMembro(chamados, nomeLcr) {
  const k = chavePessoa(nomeLcr);
  if (!k) return [];
  return (chamados || []).filter(c => c && c.nome && chavePessoa(c.nome) === k);
}

// O mesmo, para o quadro inteiro de uma vez (o cartão de cada membro na aba
// Membros): a chave de cada ocupante é feita uma vez só, e não ~200 vezes por membro.
export function indicePorPessoa(chamados) {
  const porChave = new Map();
  for (const c of chamados || []) {
    if (!c || !c.nome) continue;
    const k = chavePessoa(c.nome);
    if (!porChave.has(k)) porChave.set(k, []);
    porChave.get(k).push(c);
  }
  return nome => porChave.get(chavePessoa(nome)) || [];
}

// O membro do quadro que é aquela pessoa, ou null. A Agenda escreve o nome como
// o quadro escreve: é por ele que vêm o telefone e o e-mail do convite.
export function membroDoQuadro(membros, nome) {
  const k = chavePessoa(nome);
  if (!k) return null;
  return (membros || []).find(m => m && m.name && chavePessoa(m.name) === k) || null;
}

// Membros ativos do quadro ({ name, age }) com idade ≥ idadeMin e nenhum chamado.
// Sem idade (0 ou vazia) não entra: não dá para saber se é adulto.
export function membrosSemChamado(membros, chamados, { idadeMin = 18, busca = '' } = {}) {
  const ocupados = new Set((chamados || []).filter(c => c && c.nome).map(c => chavePessoa(c.nome)));
  const termos = termosDe(busca);
  return (membros || []).filter(m => m && m.name && (+m.age || 0) >= idadeMin
    && !ocupados.has(chavePessoa(m.name))
    && (!termos.length || casa(`${m.name} ${ordemNatural(m.name)}`, termos)));
}

// ---------- a designação na Agenda ----------
// O "📅 Agendar designação" da aba Chamados cria na Agenda uma entrevista do
// tipo TIPO_DESIGNACAO (convite-regras.js). Para um ocupante "a designar", o que
// a Agenda diz dele:
//   { estado: 'marcada', e }  há uma em aberto (a de data mais próxima): não agendar de novo;
//   { estado: 'feita', e }    realizada no dia do apoio ou depois: falta só marcar
//                             no LCR — o relatório segue "a designar" até a
//                             próxima importação, e o app não muda o que o LCR diz;
//   null                      nada na Agenda.
// A identidade é a da pessoa (chavePessoa), não a do chamado: uma ida ao bispado
// designa nos dois chamados de quem foi apoiado em dois. `entrevistas` vem já
// filtrada por podeVer, como toda lista de entrevistas.
const diaDaEntrevista = e => (/^\d{4}-\d{2}-\d{2}$/.test(e.data || '') ? e.data : String(e.realizadaEm || '').slice(0, 10));

export function designacaoNaAgenda(entrevistas, c) {
  const k = c && c.nome ? chavePessoa(c.nome) : '';
  if (!k) return null;
  const dela = (entrevistas || []).filter(e => e && e.tipo === TIPO_DESIGNACAO && chavePessoa(e.membro) === k);
  const aberta = dela.filter(e => e.status === 'pendente' || e.status === 'agendada')
    .sort((a, b) => (a.data || '9999').localeCompare(b.data || '9999'))[0];
  if (aberta) return { estado: 'marcada', e: aberta };
  // uma designação de antes do apoio era de outro chamado
  const feita = dela.filter(e => e.status === 'realizada' && (!c.apoiado || diaDaEntrevista(e) >= c.apoiado))
    .sort((a, b) => diaDaEntrevista(b).localeCompare(diaDaEntrevista(a)))[0];
  return feita ? { estado: 'feita', e: feita } : null;
}

// O item do Início: os ocupantes "a designar" do relatório e quantos deles a
// Agenda já tem marcados ou feitos (a conta é a mesma do "A designar" da aba)
export function resumoDesignacoes(chamados, entrevistas) {
  const pendentes = (chamados || []).filter(aDesignar).map(c => ({ c, agenda: designacaoNaAgenda(entrevistas, c) }));
  const em = estado => pendentes.filter(p => p.agenda?.estado === estado).length;
  return { total: pendentes.length, marcadas: em('marcada'), feitas: em('feita'), pendentes };
}

// A observação da entrevista de designação — o chamado e onde ele fica. O campo
// da Agenda aceita 100 caracteres: o que não couber sai do fim para o começo
// (o grupo, depois a organização), e só em último caso o título é cortado.
export function obsDaDesignacao(c, max = 100) {
  const chamado = String(c?.chamado || '').trim();
  const org = String(c?.org || '').trim(), grupo = String(c?.grupo || '').trim();
  const opcoes = [
    org && grupo && `${chamado} (${org} › ${grupo})`,
    org && `${chamado} (${org})`,
    chamado,
  ].filter(Boolean);
  return opcoes.find(o => o.length <= max) || chamado.slice(0, max - 1).trimEnd() + '…';
}

// ---------- prévia da importação ----------
// O que muda de um relatório para o outro, chamado a chamado (organização +
// grupo + título). Um título pode ter vários ocupantes (professores de um curso):
// quem saiu e quem entrou no MESMO título viram pares em `trocados`; quem entrou
// sem ninguém sair (era vago) vai para `novos`; quem saiu sem substituto, `saidos`.
export function compararChamados(antes, depois) {
  const chave = c => [c.org, c.grupo, c.chamado].map(norm).join('|');
  const porChave = new Map();
  const juntar = (lista, lado) => {
    for (const c of lista || []) {
      if (!c) continue;
      const k = chave(c);
      if (!porChave.has(k)) porChave.set(k, { org: c.org, grupo: c.grupo, chamado: c.chamado, antes: [], depois: [] });
      if (c.nome) porChave.get(k)[lado].push(c.nome);
    }
  };
  juntar(depois, 'depois');
  juntar(antes, 'antes');

  const novos = [], saidos = [], trocados = [];
  // nomes de `a` que não estão em `b`, contando repetidos
  const menos = (a, b) => {
    const resto = b.map(chavePessoa);
    return a.filter(n => { const i = resto.indexOf(chavePessoa(n)); if (i < 0) return true; resto.splice(i, 1); return false; });
  };
  for (const { org, grupo, chamado, antes: a, depois: d } of porChave.values()) {
    const saem = menos(a, d), entram = menos(d, a);
    const pares = Math.min(saem.length, entram.length);
    for (let i = 0; i < pares; i++) trocados.push({ org, grupo, chamado, antes: saem[i], depois: entram[i] });
    for (const nome of entram.slice(pares)) novos.push({ org, grupo, chamado, nome });
    for (const nome of saem.slice(pares)) saidos.push({ org, grupo, chamado, nome });
  }
  return { novos, saidos, trocados };
}

// ---------- o documento do servidor (/api/chamados) ----------
// A function (netlify/functions/chamados.js) passa o corpo do POST por aqui, e
// nada mais é gravado:
// só as chaves conhecidas, do tipo certo. O que viesse a mais — um telefone ou
// um e-mail da lista de membros do relatório, de um cliente antigo ou torto —
// ficaria guardado sem ninguém ver. Um campo do tipo errado recusa o corpo
// inteiro (400) em vez de gravar meio relatório.
export const MAX_CHAMADOS = 2000;
export const MAX_TEXTO_CHAMADO = 300;
// a resposta do GET antes da 1ª importação (congelado: é compartilhado)
export const DOC_CHAMADOS_VAZIO = Object.freeze({ chamados: Object.freeze([]), relatorio: null, atualizadoEm: null });

const RE_DIA = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const ehObjeto = v => !!v && typeof v === 'object' && !Array.isArray(v);
// ausente vale como vazio / falso
const textoOk = v => v === undefined || (typeof v === 'string' && v.length <= MAX_TEXTO_CHAMADO);
const diaOk = v => v === undefined || v === '' || (typeof v === 'string' && RE_DIA.test(v));
const simNaoOk = v => v === undefined || typeof v === 'boolean';
const limpo = v => (v || '').replace(/\s+/g, ' ').trim();

// corpo { chamados, relatorio } → { doc: { chamados, relatorio } } ou { erro }.
// O atualizadoEm é de quem grava (o servidor), não do corpo.
export function limparDocumentoChamados(corpo) {
  if (!ehObjeto(corpo)) return { erro: 'corpo: objeto esperado' };
  if (!Array.isArray(corpo.chamados)) return { erro: 'chamados: lista esperada' };
  if (corpo.chamados.length > MAX_CHAMADOS) return { erro: `chamados: no máximo ${MAX_CHAMADOS}` };

  const chamados = [];
  for (const [i, c] of corpo.chamados.entries()) {
    const onde = `chamados[${i}]`;
    if (!ehObjeto(c)) return { erro: `${onde}: objeto esperado` };
    for (const k of ['org', 'grupo', 'chamado', 'nome']) {
      if (!textoOk(c[k])) return { erro: `${onde}.${k}: texto de até ${MAX_TEXTO_CHAMADO} caracteres` };
    }
    if (!diaOk(c.apoiado)) return { erro: `${onde}.apoiado: AAAA-MM-DD ou vazio` };
    for (const k of ['designado', 'personalizado']) {
      if (!simNaoOk(c[k])) return { erro: `${onde}.${k}: verdadeiro ou falso` };
    }
    const chamado = limpo(c.chamado);
    if (!chamado) return { erro: `${onde}.chamado: vazio` };
    const nome = limpo(c.nome);
    // vago não tem data nem designação (o parser já entrega assim; aqui vale
    // para qualquer cliente — senão o vago contaria como "a designar")
    chamados.push({
      org: limpo(c.org), grupo: limpo(c.grupo), chamado, nome,
      apoiado: nome ? c.apoiado || '' : '',
      designado: !!nome && c.designado === true,
      personalizado: c.personalizado === true,
    });
  }

  let relatorio = null;
  if (corpo.relatorio != null) {
    const r = corpo.relatorio;
    if (!ehObjeto(r)) return { erro: 'relatorio: objeto ou null' };
    for (const k of ['ala', 'unidade', 'estaca']) {
      if (!textoOk(r[k])) return { erro: `relatorio.${k}: texto de até ${MAX_TEXTO_CHAMADO} caracteres` };
    }
    if (!diaOk(r.data)) return { erro: 'relatorio.data: AAAA-MM-DD ou vazio' };
    relatorio = { ala: limpo(r.ala), unidade: limpo(r.unidade), estaca: limpo(r.estaca), data: r.data || '' };
  }
  return { doc: { chamados, relatorio } };
}
