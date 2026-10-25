import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FONTES, autorDoConteudo, buscarDiscursosBase, lerResultado, limparTema, ordenarItens, rotuloDaFonte,
  sugerirTemas, TEMAS_SUGERIDOS, textoBase, textoLimpo, urlDaBusca, urlSegura,
} from '../js/discursos-base-regras.js';
import { camposVagaVazia, mensagemDiscurso } from '../js/discursos-regras.js';

// Um resultado no formato da busca da Biblioteca do Evangelho (títulos fictícios)
const res = (link, titulo, data = '', trecho = '') => ({
  document: {
    derivedStructData: { fields: {
      link: { stringValue: link }, title: { stringValue: titulo },
      extractive_answers: { listValue: { values: [{ structValue: { fields: { content: { stringValue: trecho } } } }] } },
    } },
    structData: { fields: data ? { published_date: { listValue: { values: [{ stringValue: data + 'T00:00:00Z' }] } } } : {} },
  },
});
const GC = 'https://www.churchofjesuschrist.org/study/general-conference';
const LI = 'https://www.churchofjesuschrist.org/study/liahona';

test('lerResultado: discurso da conferência vira link em português', () => {
  const it = lerResultado(res(GC + '/2021/10/36exemplo?lang=eng', 'Um Título &amp; <b>Outro</b>', '2021-10-01', 'Trecho &#39;curto&#39;'), 'conferencia');
  assert.equal(it.url, GC + '/2021/10/36exemplo?lang=por');
  assert.equal(it.titulo, 'Um Título & Outro');
  assert.equal(it.trecho, "Trecho 'curto'");
  assert.equal(it.ano, '2021'); assert.equal(it.mes, '10');
  assert.equal(it.caminho, '/general-conference/2021/10/36exemplo');
});

test('lerResultado: página de tópico, sessão da Liahona e outro site ficam de fora', () => {
  assert.equal(lerResultado(res(GC + '/topics/sacrifice?lang=por', 'sacrifício'), 'conferencia'), null);
  assert.equal(lerResultado(res(LI + '/2018/05/saturday-afternoon-session/one-more-day?lang=por', 'Mais um dia'), 'liahona'), null);
  assert.equal(lerResultado(res('https://exemplo.com/study/general-conference/2021/10/x', 'X'), 'conferencia'), null);
  assert.ok(lerResultado(res(LI + '/2022/07/digital-only-young-adults/um-artigo?lang=por', 'Artigo'), 'liahona'));
});

test('lerResultado: BYU tira o "| BYU Speeches" do título e tira o autor do endereço', () => {
  const it = lerResultado(res('https://speeches.byu.edu/por/talks/l-tom-exemplo/um-discurso/', 'Um discurso | BYU Speeches Português'), 'byu');
  assert.equal(it.titulo, 'Um discurso');
  assert.equal(it.autor, 'L. Tom Exemplo');
  assert.equal(it.url, 'https://speeches.byu.edu/por/talks/l-tom-exemplo/um-discurso/');
  assert.equal(lerResultado(res('https://speeches.byu.edu/talks/x/y/', 'Inglês'), 'byu'), null);
});

test('ordenarItens: conferência das mais recentes para as mais antigas, sem repetir', () => {
  const its = [
    lerResultado(res(GC + '/2005/10/a?lang=eng', 'A', '2005-10-02'), 'conferencia'),
    lerResultado(res(GC + '/2023/04/b?lang=eng', 'B', '2023-04-01'), 'conferencia'),
    lerResultado(res(GC + '/2023/04/b?lang=fra', 'B', '2023-04-01'), 'conferencia'),
    lerResultado(res(GC + '/2012/04/c?lang=por', 'C', '2012-04-01'), 'conferencia'),
  ];
  assert.deepEqual(ordenarItens(its, 'conferencia').map(i => i.titulo), ['B', 'C', 'A']);
});

test('rotuloDaFonte e textoBase dizem a fonte', () => {
  const it = { titulo: '“Já entre aspas”', autor: 'Élder Exemplo', ano: '2018', mes: '04' };
  it.rotulo = rotuloDaFonte(it, 'conferencia');
  assert.equal(it.rotulo, 'Conferência Geral de abril de 2018');
  assert.equal(textoBase(it), '“Já entre aspas”, Élder Exemplo (Conferência Geral de abril de 2018)');
  assert.equal(rotuloDaFonte({ ano: '2022', mes: '02' }, 'liahona'), 'Liahona, fevereiro de 2022');
  assert.equal(textoBase({ titulo: 'Sem autor', rotulo: 'BYU Speeches' }), '“Sem autor” (BYU Speeches)');
});

test('autorDoConteudo: página nova (author-name) e antiga (byline)', () => {
  assert.equal(autorDoConteudo({ content: { body: '<p class="author-name" id="a1">Élder Exemplo</p><p class="author-role">Dos Setenta</p>' } }), 'Élder Exemplo');
  assert.equal(autorDoConteudo({ content: { body: '<div class="byline">\n<p id="p1">Presidente Exemplo</p>\n<p id="p2">Do Quórum</p></div>' } }), 'Presidente Exemplo');
  assert.equal(autorDoConteudo({ content: { body: '<p>nada</p>' } }), '');
  assert.equal(autorDoConteudo(null), '');
});

test('urlSegura: só páginas da Biblioteca do Evangelho e do BYU Speeches', () => {
  assert.ok(urlSegura(GC + '/2021/10/x?lang=por'));
  assert.ok(urlSegura('https://speeches.byu.edu/por/talks/a/b/'));
  assert.equal(urlSegura('javascript:alert(1)'), '');
  assert.equal(urlSegura('http://www.churchofjesuschrist.org/study/x'), '');
  assert.equal(urlSegura('https://www.churchofjesuschrist.org/search?q=x'), '');
  assert.equal(urlSegura('https://exemplo.com/study/x'), '');
});

test('urlDaBusca: português, a fonte certa e o ano na Liahona', () => {
  const u = new URL(urlDaBusca('  Sacrifício  ', 'liahona'));
  assert.equal(u.searchParams.get('query'), 'Sacrifício');
  assert.equal(u.searchParams.get('lang'), 'por');
  assert.equal(u.searchParams.get('facet'), 'liahona');
  assert.equal(u.searchParams.get('year'), 'any-date');
  assert.equal(new URL(urlDaBusca('x', 'general-conference')).searchParams.get('year'), null);
  assert.equal(limparTema('a'.repeat(200)).length, 80);
});

test('buscarDiscursosBase: as 3 fontes na ordem, Liahona sem a reimpressão, autor da página', async () => {
  const pedidos = [];
  const buscarJson = async url => {
    pedidos.push(url);
    const u = new URL(url);
    if (u.pathname.includes('/language-pages/')) {
      if (u.searchParams.get('uri').includes('quebra')) throw new Error('HTTP 500');
      return { content: { body: `<p class="author-name">Autor de ${u.searchParams.get('uri').split('/').pop()}</p>` } };
    }
    const facet = u.searchParams.get('facet'), page = u.searchParams.get('page');
    if (facet === 'general-conference') {
      return { results: page === '1'
        ? [res(GC + '/2001/04/antigo?lang=eng', 'Antigo', '2001-04-02'), res(GC + '/topics/x?lang=por', 'tópico')]
        : [res(GC + '/2024/10/recente?lang=por', 'Recente', '2024-10-05'), res(GC + '/2015/04/quebra?lang=por', 'Sem autor', '2015-04-04')] };
    }
    if (facet === 'liahona') {
      return { results: [res(LI + '/2001/05/recente?lang=por', 'Reimpressão', '2001-05-01'), res(LI + '/2022/02/artigo?lang=por', 'Artigo', '2022-02-01')] };
    }
    if (facet === 'byu-speeches') throw new Error('HTTP 500');
    return { results: [] };
  };
  const r = await buscarDiscursosBase('Sacrifício', { buscarJson, comAutor: true });
  assert.deepEqual(r.fontes.map(f => f.id), FONTES.map(f => f.id));
  const [gc, li, byu] = r.fontes;
  assert.deepEqual(gc.itens.map(i => i.titulo), ['Recente', 'Sem autor', 'Antigo']);
  assert.equal(gc.itens[0].autor, 'Autor de recente');
  assert.equal(gc.itens[1].autor, '');
  assert.equal(gc.itens[0].rotulo, 'Conferência Geral de outubro de 2024');
  assert.deepEqual(li.itens.map(i => i.titulo), ['Artigo'], 'o mesmo endereço final da conferência sai da Liahona');
  assert.equal(byu.erro, true);
  assert.deepEqual(byu.itens, []);
  assert.ok(byu.mais.includes('facet=byu-speeches'));
  assert.ok(!('caminho' in gc.itens[0]) && !('slug' in gc.itens[0]));
  assert.equal(pedidos.filter(p => p.includes('facet=general-conference')).length, 2);
});

test('buscarDiscursosBase sem autor (o navegador) não lê as páginas', async () => {
  const pedidos = [];
  const r = await buscarDiscursosBase('Fé', { buscarJson: async u => { pedidos.push(u); return { results: [res(GC + '/2020/04/a?lang=por', 'A', '2020-04-04')] }; } });
  assert.ok(pedidos.every(p => !p.includes('/language-pages/')));
  assert.equal(r.fontes[0].itens[0].autor, '');
});

test('sugerirTemas: primeiro o que a ala nunca ouviu, depois o mais antigo', () => {
  const sac = TEMAS_SUGERIDOS.map((t, i) => ({ data: `2026-0${1 + (i % 9)}-0${1 + (i % 7)}`, tema1: t }));
  // todos usados; "Oração" é o mais antigo; "Jejum" fica sem uso; um futuro não conta
  sac.find(s => s.tema1 === 'Oração').data = '2020-01-05';
  sac.find(s => s.tema1 === 'Jejum').tema1 = '';
  sac.push({ data: '2099-01-04', tema2: 'Jejum' });
  const r = sugerirTemas(sac, '2026-10-25', 3);
  assert.equal(r.length, 3);
  assert.deepEqual(r.slice(0, 2).map(x => x.tema), ['Jejum', 'Oração']);
  assert.equal(r[0].ultimo, '');
  assert.equal(r[1].ultimo, '2020-01-05');
});

test('sugerirTemas: o tema gravado conta quando contém o sugerido', () => {
  const r = sugerirTemas([{ data: '2026-10-18', tema1: 'A oração em família' }], '2026-10-25', TEMAS_SUGERIDOS.length);
  assert.equal(r.at(-1).tema, 'Oração');
  assert.equal(r.at(-1).ultimo, '2026-10-18');
  // sem atas, a lista gira com a semana
  const a = sugerirTemas([], '2026-10-25', 6).map(x => x.tema), b = sugerirTemas([], '2026-11-01', 6).map(x => x.tema);
  assert.notDeepEqual(a, b);
});

test('textoLimpo decodifica entidades e tira tags', () => {
  assert.equal(textoLimpo('a&nbsp;<i>b</i> &quot;c&quot; &#x2014; d'), 'a b "c" — d');
});

test('convite com discurso base: o parágrafo antes do pedido de resposta, link só se seguro', () => {
  const base = '“Um discurso”, Élder Exemplo (Conferência Geral de abril de 2018)';
  const url = GC + '/2018/04/um?lang=por';
  const m = mensagemDiscurso({ nome: 'Exemplo, Ana', genero: 'F', n: 2, dk: '2026-11-01', minutos: 10, tema: 'Fé',
    base, baseUrl: url, assinatura: 'o bispado', hojeKey: '2026-10-25' });
  const partes = m.split('\n\n');
  assert.equal(partes.at(-2), `Para inspirar a preparação, sugerimos o discurso ${base}: ${url}`);
  assert.ok(partes.at(-1).startsWith('Pode nos responder'));
  const l = mensagemDiscurso({ tipo: 'lembrete', nome: 'Ana', n: 2, dk: '2026-11-01', base, baseUrl: 'javascript:alert(1)', assinatura: 'o bispado', hojeKey: '2026-10-25' });
  assert.ok(l.endsWith(`O discurso base sugerido: ${base}`));
  const sem = mensagemDiscurso({ nome: 'Ana', n: 2, dk: '2026-11-01', assinatura: 'o bispado', hojeKey: '2026-10-25' });
  assert.ok(!sem.includes('discurso base') && !sem.includes('inspirar'));
});

test('vaga vazia também limpa o discurso base', () => {
  const c = camposVagaVazia(3);
  assert.equal(c.base3, '');
  assert.equal(c.base3Url, '');
});
