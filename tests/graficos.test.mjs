// Gráficos em SVG feito à mão (js/graficos.js) — `npm test`.
// A geometria (escalas, marcas do eixo, partes da pilha, arcos, barras de base
// reta e ponta redonda) e o que todo desenho precisa ter: role="img", o rótulo
// e o <title> para o leitor de tela, o texto escapado (os rótulos vêm do PDF do
// LCR) e a dica em data-tip. Sem DOM: as funções devolvem texto.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CORES, anel, arcoDoAnel, barraDeMeta, barraDeitada, barraEmpilhada, colunaEmPe, colunas, cor, escala, faisca, figura,
  fmt, fmtPct, larguraTexto, legenda, limitar, linhaTempo, medidor, mini, piramide, segmentos, tabela, ticksLimpos,
} from '../js/graficos.js';

const contar = (s, re) => (s.match(re) || []).length;
// todo SVG: um só, com role, rótulo e título iguais
function acessivel(s, rotulo) {
  assert.equal(contar(s, /<svg\b/g), 1);
  assert.match(s, /^<svg class="cg[^"]*" viewBox="0 0 [\d.]+ [\d.]+" role="img" aria-label="/);
  if (rotulo !== undefined) {
    assert.ok(s.includes(`aria-label="${rotulo}"`), 'aria-label');
    assert.ok(s.includes(`<title>${rotulo}</title>`), 'title');
  }
}

test('números: formato brasileiro, % e o "—" de quem não tem valor', () => {
  assert.equal(fmt(1234), '1.234');
  assert.equal(fmt(12.6), '13');
  assert.equal(fmt(null), '—');
  assert.equal(fmt(NaN), '—');
  assert.equal(fmtPct(63.6), '64%');
  assert.equal(fmtPct(undefined), '—');
  assert.equal(limitar(5, 0, 3), 3);
  assert.equal(limitar(-1, 0, 3), 0);
  assert.ok(Math.abs(larguraTexto('abcd', 10) - 22.4) < 1e-9);
  assert.equal(cor('inventada'), 'acento');
  assert.ok(CORES.includes('s3'));
});

test('escala linear e marcas redondas do eixo', () => {
  const s = escala([0, 100], [10, 210]);
  assert.equal(s(0), 10);
  assert.equal(s(50), 110);
  assert.equal(s(100), 210);
  assert.equal(escala([5, 5], [0, 100])(5), 50);   // domínio de largura zero: o meio
  assert.deepEqual(ticksLimpos(37), [0, 10, 20, 30, 40]);
  assert.deepEqual(ticksLimpos(100), [0, 50, 100]);
  assert.deepEqual(ticksLimpos(3), [0, 1, 2, 3]);
  assert.deepEqual(ticksLimpos(0), [0, 1]);
  assert.deepEqual(ticksLimpos(null), [0, 1]);
  assert.deepEqual(ticksLimpos(470), [0, 200, 400, 600]);
  // passo sempre inteiro (gente não vem em 2,5)
  for (const m of [1, 2, 7, 13, 99, 999]) assert.ok(ticksLimpos(m).every(Number.isInteger), String(m));
});

test('pilha: as partes ocupam a largura toda, com 2 de vão só entre as que têm valor', () => {
  const p = segmentos([1, 0, 3], 102);
  assert.equal(p[1].w, 0);
  assert.equal(p[0].x, 0);
  assert.equal(p[0].w, 25);
  assert.equal(p[2].x, 27);
  assert.equal(p[2].w, 75);
  assert.equal(p[2].x + p[2].w, 102);
  assert.deepEqual(segmentos([0, 0], 100), [{ x: 0, w: 0 }, { x: 0, w: 0 }]);
  assert.deepEqual(segmentos([-5, 'x', 4], 50).map(s => s.w), [0, 0, 50]);
});

test('anel: do meio-dia, no sentido horário; cheio vira dois arcos; vazio não desenha', () => {
  assert.equal(arcoDoAnel(0, 50, 50, 40), '');
  assert.equal(arcoDoAnel(null, 50, 50, 40), '');
  assert.equal(arcoDoAnel(0.25, 50, 50, 40), 'M50,10A40,40 0 0 1 90,50');
  assert.match(arcoDoAnel(0.75, 50, 50, 40), /A40,40 0 1 1 10,50$/);   // arco grande depois da metade
  assert.equal(contar(arcoDoAnel(1, 50, 50, 40), /A/g), 2);
  assert.equal(arcoDoAnel(1.5, 50, 50, 40), arcoDoAnel(1, 50, 50, 40));
  const a = anel({ pct: 25, rotulo: 'out/2026: 25%' });
  acessivel(a, 'out/2026: 25%');
  assert.ok(a.includes('>25%</text>'));
  assert.ok(a.includes('cg-t-trilho') && a.includes('cg-t-acento'));
  const vazio = anel({ pct: null, rotulo: 'sem contagem' });
  assert.ok(vazio.includes('>—</text>') && !vazio.includes('<path'));
});

test('barras: base reta, ponta redonda de raio 4 (nunca maior que a metade da espessura)', () => {
  const d = barraDeitada(0, 0, 100, 12);
  assert.equal(d, 'M0,0H96A4,4 0 0 1 100,4V8A4,4 0 0 1 96,12H0Z');
  assert.equal(barraDeitada(0, 0, 0, 12), '');
  assert.ok(barraDeitada(0, 0, 3, 12).includes('A3,3'));   // mais curta que o raio
  const esq = barraDeitada(100, 0, 40, 10, 4, true);
  assert.ok(esq.startsWith('M100,0H64'));                  // cresce para a esquerda
  assert.equal(colunaEmPe(10, 20, 20, 50), 'M10,70V24A4,4 0 0 1 14,20H26A4,4 0 0 1 30,24V70Z');
  assert.equal(colunaEmPe(10, 20, 20, 50, 4, false), 'M10,20H30V70H10Z');
  assert.ok(colunaEmPe(0, 0, 4, 50).includes('A2,2'));
});

test('barra até a meta: as duas marcas (1 e 2 alas), o número de hoje e a dica', () => {
  const s = barraDeMeta({ atual: 300, metas: [{ valor: 250, rotulo: '1 ala · 250' }, { valor: 500, rotulo: '2 alas · 500' }], rotulo: 'Membros: 300' });
  acessivel(s, 'Membros: 300');
  assert.equal(contar(s, /class="cg-t-marca"/g), 2);
  assert.ok(s.includes('>1 ala · 250</text>') && s.includes('>2 alas · 500</text>'));
  assert.ok(s.includes('>300</text>'));
  assert.ok(s.includes('data-tip="Hoje: 300"'));
  // a marca de 500 fica à direita da de 250, e a barra termina antes da de 500
  const xs = [...s.matchAll(/<line x1="([\d.]+)"/g)].map(m => +m[1]);
  assert.ok(xs[0] < xs[1]);
  const fim = +s.match(/<path d="M[^"]*A[\d.]+,[\d.]+ 0 0 1 ([\d.]+),[^"]*" class="cg-f-acento"/)[1];
  assert.ok(fim > xs[0] && fim < xs[1], `${xs[0]} < ${fim} < ${xs[1]}`);
  // sem número (o sigiloso sem a sessão): só o trilho e as marcas
  const sem = barraDeMeta({ atual: null, metas: [{ valor: 20 }, { valor: 40 }], rotulo: 'sem número' });
  assert.ok(!sem.includes('cg-f-acento') && !sem.includes('data-tip'));
  assert.ok(sem.includes('>20</text>') && sem.includes('>40</text>'));
  // sem a dica (o cartão do Início, onde ninguém a mostra): o mesmo desenho, sem
  // alvo de toque nem parada do Tab — o número continua escrito na ponta
  const estatica = barraDeMeta({ atual: 300, metas: [{ valor: 250 }, { valor: 500 }], rotulo: 'Membros: 300', dica: false });
  acessivel(estatica, 'Membros: 300');
  assert.ok(!estatica.includes('data-tip') && !estatica.includes('tabindex') && !estatica.includes('cg-alvo'));
  assert.ok(estatica.includes('class="cg-f-acento"') && estatica.includes('>300</text>'));
});

test('pilha: o número dentro da parte só quando cabe; a tinta é do papel da cor', () => {
  const s = barraEmpilhada({ rotulo: 'Recomendações', largura: 300, segs: [
    { rotulo: '✓ Ativa', valor: 48, classe: 'bom' }, { rotulo: '⏳ Para vencer', valor: 1, classe: 'atencao' },
    { rotulo: '✕ Vencida', valor: 14, classe: 'critico' }, { rotulo: 'zero', valor: 0, classe: 'neutro' },
  ] });
  acessivel(s, 'Recomendações');
  assert.equal(contar(s, /class="cg-alvo"/g), 3);   // a de valor 0 não entra
  assert.ok(s.includes('class="cg-sobre cg-sobre-bom"'));
  assert.ok(!s.includes('>1</text>'));               // 1 de 63 em 300 não cabe o número
  assert.ok(s.includes('data-tip="✓ Ativa: 48 (76%)"'));
  // só a última parte tem a ponta redonda
  assert.equal(contar(s, /A4,4/g), 2);
  const vazia = barraEmpilhada({ segs: [], rotulo: 'nada' });
  assert.ok(vazia.includes('cg-f-trilho') && !vazia.includes('cg-alvo'));
});

test('colunas: total no topo, empilhadas sem vão na base, formato e destaque', () => {
  const s = colunas({ categorias: ['out', 'nov', 'dez'], destaque: 0, rotulo: 'Vencem por mês', series: [
    { nome: 'Adultos', classe: 's1', valores: [2, 0, 1] }, { nome: 'Jovens', classe: 's2', valores: [3, 0, null] },
  ] });
  acessivel(s, 'Vencem por mês');
  assert.equal(contar(s, /class="cg-alvo"/g), 3);           // uma faixa de toque por categoria
  assert.ok(s.includes('>5</text>') && s.includes('>1</text>'));
  assert.ok(!s.includes('>0</text>'));                      // coluna vazia sem número
  assert.ok(s.includes('font-weight="700">out</text>'));     // o destaque
  assert.ok(s.includes('data-tip="out\nAdultos: 2\nJovens: 3"'));
  assert.equal(contar(s, /class="cg-f-s1"/g), 2);
  const pct = colunas({ categorias: ['2022'], series: [{ nome: 'F', classe: 'acento', valores: [37] }], formato: fmtPct, rotulo: 'x' });
  assert.ok(pct.includes('>37%</text>'));
  assert.ok(colunas({ categorias: [], series: [], rotulo: 'vazio' }).includes('Sem dados'));
  // marca fina: no máximo 24 de largura, mesmo com poucas categorias
  const larga = colunas({ categorias: ['a'], series: [{ nome: 'x', valores: [10] }], rotulo: 'a' });
  const [, x0, x1] = larga.match(/<path d="M([\d.]+),.*A[\d.]+,[\d.]+ 0 0 1 ([\d.]+),[\d.]+V[\d.]+Z"/);
  assert.ok(x1 - x0 > 0 && x1 - x0 <= 24, `${x1} − ${x0}`);
});

test('linha no tempo: uma faixa de toque por ponto, a média por baixo, o último rotulado', () => {
  const pontos = [{ data: '2026-09-06', valor: 98 }, { data: '2026-09-13', valor: 110 }, { data: '2026-10-04', valor: 104 }];
  const s = linhaTempo({ pontos, medias: [{ de: '2026-09-01', ate: '2026-09-30', valor: 104 }], rotulo: 'Sacramental', unidade: 'pessoas', dicaExtra: () => 'extra' });
  acessivel(s, 'Sacramental');
  assert.equal(contar(s, /class="cg-alvo"/g), 3);
  assert.equal(contar(s, /class="cg-t-media"/g), 1);
  assert.ok(s.includes('data-tip="04/10: 104 pessoas\nextra"'));
  assert.ok(s.includes('>set</text>') && s.includes('>out</text>'));   // o 1º de cada mês no eixo
  assert.ok(s.includes('font-weight="700">104</text>'));               // o último ponto
  // sem pontos (ou datas tortas): aviso, não um gráfico vazio
  assert.ok(linhaTempo({ pontos: [{ data: 'ontem', valor: 3 }], rotulo: 'x' }).includes('Sem dados'));
  // um ponto só não divide por zero
  assert.doesNotMatch(linhaTempo({ pontos: [pontos[0]], rotulo: 'um' }), /NaN|Infinity/);
});

test('pequenos múltiplos: o mesmo domínio de datas e a escala de 0 a 100%', () => {
  const datas = ['2026-09-06', '2026-09-13', '2026-09-20'];
  const a = mini({ serie: [{ data: '2026-09-13', taxa: 0.5 }], datas, rotulo: 'A' });
  const b = mini({ serie: [{ data: '2026-09-13', taxa: 0.5 }], datas: ['2026-09-13'], rotulo: 'B' });
  acessivel(a, 'A');
  // no domínio comum, o mesmo ponto fica no meio; sozinho, também no meio (sem dividir por zero)
  const cx = s => +s.match(/<circle cx="([\d.]+)"/)[1];
  assert.equal(cx(a), cx(b));
  assert.ok(a.includes('>100%</text>') && a.includes('>50%</text>'));
  assert.ok(mini({ serie: [], datas, rotulo: 'C' }).includes('Sem registros'));
  assert.ok(mini({ serie: [{ data: '2026-09-13', taxa: 3 }], datas, rotulo: 'D' }));   // taxa fora de 0–1 não estoura
});

test('faísca, pirâmide, medidor, legenda, tabela e figura', () => {
  assert.equal(faisca([5]), '');                     // um ponto não é linha
  acessivel(faisca([5, null, 7], { rotulo: 'hist' }), 'hist');
  const p = piramide({ faixas: [{ faixa: '18–30', m: 10, f: 20 }, { faixa: '0–2', m: 0, f: 3 }], rotulo: 'Pirâmide' });
  acessivel(p, 'Pirâmide');
  assert.equal(contar(p, /class="cg-f-s1"/g), 1);     // a faixa de 0 homens não tem barra
  assert.equal(contar(p, /class="cg-f-s2"/g), 2);
  assert.ok(p.includes('data-tip="18–30 anos — mulheres: 20"'));
  const m = medidor({ rotulo: 'Bispado', valor: 7, total: 5, nota: 'Falta: <ninguém>' });
  assert.ok(m.includes('width:100%'));               // não passa do trilho
  assert.ok(m.includes('7 de 5'));
  assert.ok(m.includes('Falta: &lt;ninguém&gt;'));
  assert.ok(m.includes('role="img"') && m.includes('aria-label="Bispado: 7 de 5 — Falta: &lt;ninguém&gt;"'));
  assert.ok(medidor({ rotulo: 'x', valor: 3, total: 0 }).includes('width:0%'));
  const l = legenda([{ rotulo: 'Domingo', classe: 'acento', forma: 'linha' }, { rotulo: 'Ativa', classe: 'bom', valor: 3 }]);
  assert.equal(contar(l, /<line /g), 1);
  assert.equal(contar(l, /<rect /g), 1);
  assert.ok(l.includes('<strong>3</strong>'));
  assert.equal(legenda([]), '');
  const t = tabela({ cab: ['Mês', 'N'], linhas: [['out', '3']] });
  assert.ok(t.startsWith('<details class="cg-tabela">'));
  assert.ok(t.includes('<th scope="row">out</th>') && t.includes('<td class="num">3</td>'));
  assert.equal(tabela({ cab: ['a'], linhas: [] }), '');
  const f = figura({ titulo: 'T <b>', sub: 'S', conteudo: '<svg></svg>', nota: 'n' });
  assert.ok(f.includes('T &lt;b&gt;') && f.includes('<svg></svg>') && f.includes('cg-fig-nota'));
});

test('o texto que vem do PDF é sempre escapado (rótulo, dica, categoria)', () => {
  const mau = '<img src=x onerror=alert(1)>"\'';
  const saidas = [
    anel({ pct: 10, rotulo: mau, centro: mau }),
    barraDeMeta({ atual: 1, metas: [{ valor: 2, rotulo: mau }], rotulo: mau }),
    barraEmpilhada({ segs: [{ rotulo: mau, valor: 1, classe: 'bom' }], rotulo: mau }),
    colunas({ categorias: [mau], series: [{ nome: mau, valores: [1] }], rotulo: mau }),
    linhaTempo({ pontos: [{ data: '2026-10-04', valor: 1 }], unidade: mau, rotulo: mau }),
    mini({ serie: [{ data: '2026-10-04', taxa: 0.5, dica: mau }], rotulo: mau }),
    piramide({ faixas: [{ faixa: mau, m: 1, f: 1 }], rotulo: mau }),
    medidor({ rotulo: mau, valor: 1, total: 2, nota: mau }),
    legenda([{ rotulo: mau, valor: mau }]),
    tabela({ cab: [mau], linhas: [[mau, mau]], resumo: mau }),
  ];
  for (const s of saidas) {
    assert.ok(!s.includes('<img'), s.slice(0, 80));
    assert.ok(!/="[^"]*"'/.test(s.replace(/&#39;/g, '')), 'aspas soltas');
  }
});
