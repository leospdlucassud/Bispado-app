// =============================================
// GRÁFICOS — SVG feito à mão, sem biblioteca (sem DOM)
// Cada função devolve o TEXTO de um SVG (ou de um pedaço de HTML) pronto para
// o innerHTML: a aba "Vamos crescer a Ala" (crescimento.js) monta as seções com
// eles, e tests/graficos.test.mjs confere a geometria no Node. Nenhuma
// biblioteca: a CSP do netlify.toml só deixa entrar script do próprio site e
// do cdnjs, e um gráfico de 12 colunas não justifica 200 KB.
//
// As regras de desenho (as mesmas em todos):
//  - marcas finas: coluna e barra de no máximo 24 de espessura, com a ponta de
//    DADO arredondada (4) e a base reta; linha de 2; ponto de 8 de diâmetro com
//    um anel de 2 na cor do fundo; 2 de vão (na cor do fundo) entre as partes de
//    uma barra empilhada;
//  - grade e eixo em fio de 1, sólido e apagado; número só onde ajuda a ler
//    (a ponta da coluna, o último ponto da linha) — o resto vai na dica e na tabela;
//  - a cor vem do PAPEL (classes cg-f-* / cg-t-*, com os tokens --cg-* do
//    style.css, que têm a versão do tema claro); o texto nunca leva a cor da série;
//  - todo gráfico tem role="img", aria-label e <title>, e a tabela ("Ver os
//    números") é o equivalente para quem não enxerga a cor ou não usa o mouse;
//  - a dica (data-tip) é texto puro: crescimento.js põe com textContent.
// As cores, conferidas com o validador da skill de gráficos contra o fundo dos
// cartões (--bg2: #152233 no escuro, #fffdf7 no claro), cada tema com os seus
// tons: s1/s2/s3 (azul, laranja, verde-água) se separam em TODOS os pares,
// também para daltonismo (pior ΔE 9,4 no escuro e 9,2 no claro; ≥ 8 é a meta).
// O verde-água do tema claro fica em 2,8:1 contra o fundo — mais um motivo
// para a tabela de todo gráfico. O acento (o lima da aba) é a cor da série
// única. Bom / atenção / crítico são SITUAÇÃO, não série: o verde e o vermelho
// se confundem para o daltônico, e por isso vão sempre com ícone e rótulo.
// =============================================
import { esc } from './utils.js';

// ---------- números e geometria ----------
const r2 = v => Math.round(v * 100) / 100;
export const limitar = (v, a, b) => Math.min(b, Math.max(a, v));
const finito = v => typeof v === 'number' && Number.isFinite(v);

// 1234 → "1.234"; null → "—"
export const fmt = v => (finito(v) ? Math.round(v).toLocaleString('pt-BR') : '—');
export const fmtPct = v => (finito(v) ? `${Math.round(v)}%` : '—');

// Escala linear [d0, d1] → [r0, r1] (domínio de largura zero vai ao meio)
export function escala([d0, d1], [r0, r1]) {
  const dd = d1 - d0;
  return v => (dd ? r0 + ((v - d0) / dd) * (r1 - r0) : (r0 + r1) / 2);
}

// Marcas redondas para o eixo: 0, passo, 2·passo… até cobrir `max` (passo de 1,
// 2 ou 5 × 10^k — números de gente são inteiros, nada de 2,5)
export function ticksLimpos(max, alvo = 4) {
  const m = finito(max) && max > 0 ? max : 1;
  const bruto = m / Math.max(1, alvo);
  const pot = 10 ** Math.floor(Math.log10(bruto));
  const passo = Math.max(1, [1, 2, 5, 10].map(k => k * pot).find(p => p >= bruto - 1e-9));
  const out = [];
  for (let v = 0; v < m - 1e-9; v += passo) out.push(r2(v));
  out.push(r2(out.length * passo));
  return out;
}

// Largura estimada de um texto (sem DOM para medir): ~0,56 do corpo por letra
export const larguraTexto = (texto, corpo = 11) => String(texto ?? '').length * corpo * 0.56;

// As partes de uma barra empilhada numa largura, com `vao` entre as que têm
// valor (as de valor 0 não ocupam nada, nem vão) → [{ x, w }] na ordem recebida
export function segmentos(valores, largura, vao = 2) {
  const v = (valores || []).map(x => (finito(x) && x > 0 ? x : 0));
  const total = v.reduce((a, b) => a + b, 0);
  const vivos = v.filter(Boolean).length;
  const util = Math.max(0, largura - vao * Math.max(0, vivos - 1));
  let x = 0;
  return v.map(val => {
    if (!val || !total) return { x: r2(x), w: 0 };
    const w = (util * val) / total;
    const s = { x: r2(x), w: r2(w) };
    x += w + vao;
    return s;
  });
}

// O arco de um anel, do meio-dia no sentido horário, para a fração `frac`
// (0–1; 1 ou mais = o círculo inteiro, em dois arcos — um arco só de 360° não desenha)
export function arcoDoAnel(frac, cx, cy, r) {
  const f = limitar(finito(frac) ? frac : 0, 0, 1);
  if (f <= 0) return '';
  if (f >= 0.9999) return `M${cx},${r2(cy - r)}A${r},${r} 0 1 1 ${cx},${r2(cy + r)}A${r},${r} 0 1 1 ${cx},${r2(cy - r)}`;
  const a = f * 2 * Math.PI;
  return `M${cx},${r2(cy - r)}A${r},${r} 0 ${f > 0.5 ? 1 : 0} 1 ${r2(cx + r * Math.sin(a))},${r2(cy - r * Math.cos(a))}`;
}

// Barra deitada que cresce da esquerda: base reta, ponta de dado arredondada.
// `paraEsquerda`: cresce de x para a esquerda (o lado dos homens na pirâmide).
export function barraDeitada(x, y, w, h, raio = 4, paraEsquerda = false) {
  if (!(w > 0) || !(h > 0)) return '';
  const r = r2(Math.min(raio, h / 2, w));
  if (paraEsquerda) {
    const x0 = x - w;
    return `M${r2(x)},${r2(y)}H${r2(x0 + r)}A${r},${r} 0 0 0 ${r2(x0)},${r2(y + r)}V${r2(y + h - r)}A${r},${r} 0 0 0 ${r2(x0 + r)},${r2(y + h)}H${r2(x)}Z`;
  }
  return `M${r2(x)},${r2(y)}H${r2(x + w - r)}A${r},${r} 0 0 1 ${r2(x + w)},${r2(y + r)}V${r2(y + h - r)}A${r},${r} 0 0 1 ${r2(x + w - r)},${r2(y + h)}H${r2(x)}Z`;
}

// Coluna em pé: base reta embaixo (y + h), topo arredondado (`redondo`: só a
// parte de cima de uma pilha leva a ponta redonda)
export function colunaEmPe(x, y, w, h, raio = 4, redondo = true) {
  if (!(w > 0) || !(h > 0)) return '';
  if (!redondo) return `M${r2(x)},${r2(y)}H${r2(x + w)}V${r2(y + h)}H${r2(x)}Z`;
  const r = r2(Math.min(raio, w / 2, h));
  return `M${r2(x)},${r2(y + h)}V${r2(y + r)}A${r},${r} 0 0 1 ${r2(x + r)},${r2(y)}H${r2(x + w - r)}A${r},${r} 0 0 1 ${r2(x + w)},${r2(y + r)}V${r2(y + h)}Z`;
}

// ---------- cores (os papéis; o valor mora no style.css) ----------
export const CORES = ['acento', 's1', 's2', 's3', 'bom', 'atencao', 'critico', 'neutro', 'media', 'trilho'];
export const cor = c => (CORES.includes(c) ? c : 'acento');
// O número escrito DENTRO da marca: tinta escura ou branca conforme a cor da
// marca NAQUELE tema (o lima do escuro é claro; o do tema claro, escuro) —
// por isso a classe é do papel, e o style.css escolhe a tinta (.cg-sobre-*)
const textoDentro = c => `cg-sobre cg-sobre-${cor(c)}`;

// ---------- moldura ----------
const tip = t => (t ? ` data-tip="${esc(t)}"` : '');
// `alvo`: a marca que responde ao toque e ao foco (a dica de crescimento.js)
// (dentro do <svg role="img"> os filhos não falam ao leitor de tela: quem lê
// por ele tem a tabela; o foco é para quem usa o teclado e enxerga a dica)
const alvo = (t, foco = true) => `class="cg-alvo"${foco ? ' tabindex="0"' : ''}${tip(t)}`;
const svg = (w, h, rotulo, corpo, classe = '') =>
  `<svg class="cg${classe ? ' ' + classe : ''}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(rotulo)}" preserveAspectRatio="xMidYMid meet"><title>${esc(rotulo)}</title>${corpo}</svg>`;
const texto = (x, y, t, { classe = 'cg-txt', corpo = 10.5, ancora = 'start', peso = '' } = {}) =>
  `<text x="${r2(x)}" y="${r2(y)}" class="${classe}" font-size="${corpo}" text-anchor="${ancora}"${peso ? ` font-weight="${peso}"` : ''}>${esc(t)}</text>`;

// ---------- anel (um % contra 100) ----------
// O % da frequência do mês (a média ÷ membros), como na página do LCR.
// `centro`: o texto do meio (por padrão, o próprio %).
export function anel({ pct = null, tamanho = 72, espessura = 7, rotulo = '', classe = 'acento', centro } = {}) {
  const c = tamanho / 2, r = r2(c - espessura / 2 - 1);
  const frac = finito(pct) ? pct / 100 : 0;
  const meio = centro ?? (finito(pct) ? `${Math.round(pct)}%` : '—');
  const arco = arcoDoAnel(frac, c, c, r);
  return svg(tamanho, tamanho, rotulo || `${meio}`,
    `<circle cx="${c}" cy="${c}" r="${r}" class="cg-t-trilho" fill="none" stroke-width="${espessura}"/>`
    + (arco ? `<path d="${arco}" class="cg-t-${cor(classe)}" fill="none" stroke-width="${espessura}" stroke-linecap="round"/>` : '')
    + texto(c, c + tamanho * 0.085, meio, { classe: 'cg-txt-forte', corpo: r2(tamanho * 0.24), ancora: 'middle', peso: '700' }),
    'cg-anel');
}

// ---------- barra até a meta (a de uma ala e a de duas) ----------
// atual: o número de hoje (null = não se sabe); metas: [{ valor, rotulo }] — as
// marcas no trilho ("1 ala · 250", "2 alas · 500"). `dica: false`: sem a dica
// nem o foco — onde não há quem mostre a dica (o cartão do Início), a barra é
// só desenho: o número já está escrito na ponta e no texto ao lado.
export function barraDeMeta({ atual = null, metas = [], rotulo = '', unidade = '', largura = 320, dica: comDica = true } = {}) {
  const W = largura, H = 52, y = 17, h = 12, x0 = 2, x1 = W - 2;
  const vals = metas.map(m => m.valor).filter(finito);
  const max = Math.max(...vals, finito(atual) ? atual : 0, 1) * 1.08;
  const sx = escala([0, max], [x0, x1]);
  // o trilho tem a forma da barra (base reta, ponta redonda): ela cresce de dentro dele
  let corpo = `<path d="${barraDeitada(x0, y, x1 - x0, h)}" class="cg-f-trilho"/>`;
  if (finito(atual) && atual > 0) {
    const w = sx(atual) - x0;
    const dica = `Hoje: ${fmt(atual)}${unidade ? ' ' + unidade : ''}`;
    corpo += comDica
      ? `<g ${alvo(dica)}><path d="${barraDeitada(x0, y, w, h)}" class="cg-f-acento"/><rect x="${x0}" y="${y - 6}" width="${r2(Math.max(w, 24))}" height="${h + 12}" fill="transparent"/></g>`
      : `<path d="${barraDeitada(x0, y, w, h)}" class="cg-f-acento"/>`;
    const xt = x0 + w;
    const ancora = xt < 24 ? 'start' : 'end';
    corpo += texto(ancora === 'start' ? xt + 2 : xt, y - 5, fmt(atual), { classe: 'cg-txt-forte', corpo: 11, ancora, peso: '700' });
  }
  for (const m of metas) {
    if (!finito(m.valor)) continue;
    const x = r2(sx(m.valor));
    const ancora = x > W - 46 ? 'end' : x < 46 ? 'start' : 'middle';
    corpo += `<line x1="${x}" x2="${x}" y1="${y - 3}" y2="${y + h + 3}" class="cg-t-marca" stroke-width="2"/>`
      + texto(ancora === 'end' ? x + 1 : ancora === 'start' ? x - 1 : x, y + h + 15, m.rotulo || fmt(m.valor), { classe: 'cg-txt', corpo: 10, ancora });
  }
  return svg(W, H, rotulo, corpo, 'cg-meta');
}

// ---------- barra empilhada (100%) ----------
// segs: [{ rotulo, valor, classe }]. O número entra dentro da parte só quando
// cabe com folga; senão fica para a legenda, a dica e a tabela.
export function barraEmpilhada({ segs = [], rotulo = '', largura = 320, altura = 24 } = {}) {
  const total = segs.reduce((t, s) => t + (finito(s.valor) && s.valor > 0 ? s.valor : 0), 0);
  if (!total) return svg(largura, altura, rotulo, `<rect x="0" y="0" width="${largura}" height="${altura}" rx="4" class="cg-f-trilho"/>`, 'cg-pilha');
  const pos = segmentos(segs.map(s => s.valor), largura);
  const ultimo = pos.map(p => p.w > 0).lastIndexOf(true);
  const corpo = segs.map((s, i) => {
    const { x, w } = pos[i];
    if (!(w > 0)) return '';
    const c = cor(s.classe);
    const forma = i === ultimo ? barraDeitada(x, 0, w, altura) : `M${x},0H${r2(x + w)}V${altura}H${x}Z`;
    const num = fmt(s.valor);
    const dentro = larguraTexto(num, 11) + 10 <= w
      ? texto(x + w / 2, altura / 2 + 4, num, { classe: textoDentro(c), corpo: 11, ancora: 'middle', peso: '700' }) : '';
    const dica = `${s.rotulo}: ${num} (${Math.round((s.valor / total) * 100)}%)`;
    return `<g ${alvo(dica)}><path d="${forma}" class="cg-f-${c}"/>${dentro}</g>`;
  }).join('');
  return svg(largura, altura, rotulo, corpo, 'cg-pilha');
}

// ---------- colunas (uma série ou empilhadas) ----------
// categorias: ['jan', …]; series: [{ nome, classe, valores: [] }] (de baixo para
// cima). O total vai no topo de cada coluna (são poucas — até 12); sem grade.
// `destaque`: o índice da categoria em negrito (o mês corrente); `formato`: o
// número do topo e da dica (fmtPct numa série de %).
export function colunas({ categorias = [], series = [], rotulo = '', largura = 340, altura = 150, destaque = -1, dicas = [], formato = fmt } = {}) {
  const n = categorias.length;
  if (!n || !series.length) return svg(largura, 40, rotulo, texto(largura / 2, 24, 'Sem dados', { ancora: 'middle' }));
  const top = 16, base = altura - 22, x0 = 4, x1 = largura - 4;
  const banda = (x1 - x0) / n, bw = r2(Math.min(24, banda * 0.62));
  const totais = categorias.map((_, i) => series.reduce((t, s) => t + (finito(s.valores?.[i]) ? Math.max(0, s.valores[i]) : 0), 0));
  const sy = escala([0, Math.max(...totais, 1)], [0, base - top]);
  const passoRotulo = n > 12 ? Math.ceil(n / 12) : 1;
  let corpo = `<line x1="${x0}" x2="${x1}" y1="${base + 0.5}" y2="${base + 0.5}" class="cg-t-eixo" stroke-width="1"/>`;
  categorias.forEach((cat, i) => {
    const cx = x0 + banda * i + banda / 2, x = r2(cx - bw / 2);
    let y = base;
    const vivos = series.map((s, k) => (finito(s.valores?.[i]) && s.valores[i] > 0 ? k : -1)).filter(k => k >= 0);
    const topo = vivos.at(-1);
    let partes = '';
    for (const k of vivos) {
      const h = sy(series[k].valores[i]);
      const g = k === topo ? 0 : Math.min(2, h / 2);   // o vão de 2 entre as partes da pilha
      // o vão fica no alto da parte de baixo: entre ela e a de cima, nunca na base
      partes += `<path d="${colunaEmPe(x, y - h + g, bw, h - g, 4, k === topo)}" class="cg-f-${cor(series[k].classe)}"/>`;
      y -= h;
    }
    if (totais[i] > 0) partes += texto(cx, y - 4, formato(totais[i]), { classe: 'cg-txt-forte', corpo: 10, ancora: 'middle', peso: '600' });
    if (i % passoRotulo === 0) partes += texto(cx, base + 14, cat, { classe: i === destaque ? 'cg-txt-forte' : 'cg-txt', corpo: 9.5, ancora: 'middle', peso: i === destaque ? '700' : '' });
    const dica = dicas[i] || [cat, ...series.map(s => `${s.nome}: ${formato(finito(s.valores?.[i]) ? s.valores[i] : 0)}`)].join('\n');
    corpo += `<g ${alvo(dica)}><rect x="${r2(x0 + banda * i)}" y="${top - 12}" width="${r2(banda)}" height="${r2(base - top + 12)}" fill="transparent"/>${partes}</g>`;
  });
  return svg(largura, altura, rotulo, corpo, 'cg-colunas');
}

// ---------- linha no tempo ----------
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const diaUtc = d => { const [a, m, dd] = String(d).split('-').map(Number); return Date.UTC(a, m - 1, dd); };
const ddmm = d => `${String(d).slice(8, 10)}/${String(d).slice(5, 7)}`;

// pontos: [{ data: 'AAAA-MM-DD', valor }] em ordem; medias: [{ de, ate, valor,
// rotulo }] — os traços cinza da média do mês, por baixo da linha. A mira
// (fio vertical) acompanha o ponto mais perto: cada ponto tem a sua faixa de toque.
export function linhaTempo({ pontos = [], medias = [], rotulo = '', largura = 340, altura = 180, unidade = '', dicaExtra = () => '' } = {}) {
  const ps = pontos.filter(p => p && finito(p.valor) && /^\d{4}-\d{2}-\d{2}$/.test(p.data || ''));
  if (!ps.length) return svg(largura, 40, rotulo, texto(largura / 2, 24, 'Sem dados', { ancora: 'middle' }));
  const l = 30, r = largura - 28, t = 12, b = altura - 30;   // embaixo: o mês e, no janeiro, o ano
  let d0 = diaUtc(ps[0].data), d1 = diaUtc(ps.at(-1).data);
  if (d0 === d1) { d0 -= 3 * 864e5; d1 += 3 * 864e5; }
  for (const m of medias) { if (/^\d{4}-\d{2}-\d{2}$/.test(m.de || '')) d0 = Math.min(d0, diaUtc(m.de)); if (/^\d{4}-\d{2}-\d{2}$/.test(m.ate || '')) d1 = Math.max(d1, diaUtc(m.ate)); }
  const sx = escala([d0, d1], [l, r]);
  const ticks = ticksLimpos(Math.max(...ps.map(p => p.valor), ...medias.map(m => (finito(m.valor) ? m.valor : 0))));
  const sy = escala([0, ticks.at(-1)], [b, t]);
  let corpo = ticks.map(v => `<line x1="${l}" x2="${r}" y1="${r2(sy(v)) + 0.5}" y2="${r2(sy(v)) + 0.5}" class="${v ? 'cg-t-grade' : 'cg-t-eixo'}" stroke-width="1"/>`
    + texto(l - 5, sy(v) + 3.5, fmt(v), { classe: 'cg-txt-mudo', corpo: 9.5, ancora: 'end' })).join('');
  // o 1º de cada mês dentro do intervalo. O ano vai numa 2ª linha, sob o
  // janeiro ("jan 26" ao lado do "fev" se encostavam); com os meses apertados
  // (mais de ~15 no eixo), um rótulo a cada dois — o janeiro sempre
  const ini = new Date(d0);
  const larguraMes = ((r - l) * 30.4 * 864e5) / Math.max(1, d1 - d0);
  const cada = larguraMes < 18 ? 2 : 1;
  let a = ini.getUTCFullYear(), m = ini.getUTCMonth(), k = 0;
  while (Date.UTC(a, m, 1) <= d1) {
    const x = sx(Date.UTC(a, m, 1));
    if (x >= l - 0.5) {
      corpo += `<line x1="${r2(x)}" x2="${r2(x)}" y1="${b}" y2="${b + 3}" class="cg-t-eixo" stroke-width="1"/>`;
      if (m === 0 || k % cada === 0) corpo += texto(x + 2, b + 13, MESES_CURTOS[m], { classe: 'cg-txt-mudo', corpo: 9 });
      if (m === 0) corpo += texto(x + 2, b + 23, String(a), { classe: 'cg-txt-mudo', corpo: 8.5 });
      k++;
    }
    if (++m > 11) { m = 0; a++; }
  }
  for (const m of medias) {
    if (!finito(m.valor) || !m.de || !m.ate) continue;
    const y = r2(sy(m.valor));
    corpo += `<line x1="${r2(sx(diaUtc(m.de)))}" x2="${r2(sx(diaUtc(m.ate)))}" y1="${y}" y2="${y}" class="cg-t-media" stroke-width="2" stroke-linecap="round"/>`;
  }
  const xy = ps.map(p => [r2(sx(diaUtc(p.data))), r2(sy(p.valor))]);
  corpo += `<path d="${xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join('')}" class="cg-t-acento" fill="none" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  const [ux, uy] = xy.at(-1);
  corpo += `<circle cx="${ux}" cy="${uy}" r="4" class="cg-f-acento cg-anel-fundo" stroke-width="2"/>`
    + texto(ux + 6, uy + 3.5, fmt(ps.at(-1).valor), { classe: 'cg-txt-forte', corpo: 10.5, peso: '700' });
  // faixas de toque: do meio entre um ponto e o anterior até o meio com o seguinte
  xy.forEach(([x, y], i) => {
    const xa = i ? (xy[i - 1][0] + x) / 2 : l, xd = i < xy.length - 1 ? (x + xy[i + 1][0]) / 2 : r + 4;
    const p = ps[i];
    const extra = dicaExtra(p);
    const dica = `${ddmm(p.data)}: ${fmt(p.valor)}${unidade ? ' ' + unidade : ''}${extra ? '\n' + extra : ''}`;
    corpo += `<g ${alvo(dica, false)}><rect x="${r2(xa)}" y="${t}" width="${r2(Math.max(1, xd - xa))}" height="${r2(b - t)}" fill="transparent"/>`
      + `<line x1="${x}" x2="${x}" y1="${t}" y2="${b}" class="cg-mira" stroke-width="1"/><circle cx="${x}" cy="${y}" r="4" class="cg-f-acento cg-anel-fundo cg-mira-ponto" stroke-width="2"/></g>`;
  });
  return svg(largura, altura, rotulo, corpo, 'cg-linha');
}

// ---------- pequenos múltiplos (uma taxa 0–100% por grupo) ----------
// serie: [{ data, taxa (0–1), dica }]; datas: o domínio comum a todos os quadros
// (o mesmo eixo em todos — senão a comparação engana).
export function mini({ serie = [], datas = [], rotulo = '', largura = 170, altura = 70 } = {}) {
  const ps = serie.filter(p => p && finito(p.taxa) && /^\d{4}-\d{2}-\d{2}$/.test(p.data || ''));
  const dom = (datas.length ? datas : ps.map(p => p.data)).filter(Boolean);
  const l = 4, r = largura - 34, t = 6, b = altura - 6;
  if (!ps.length || !dom.length) return svg(largura, altura, rotulo, texto(largura / 2, altura / 2 + 4, 'Sem registros', { classe: 'cg-txt-mudo', ancora: 'middle', corpo: 10 }), 'cg-mini');
  let d0 = diaUtc(dom[0]), d1 = diaUtc(dom.at(-1));
  if (d0 === d1) { d0 -= 3 * 864e5; d1 += 3 * 864e5; }
  const sx = escala([d0, d1], [l, r]), sy = escala([0, 1], [b, t]);
  let corpo = [0, 0.5, 1].map(v => `<line x1="${l}" x2="${r}" y1="${r2(sy(v)) + 0.5}" y2="${r2(sy(v)) + 0.5}" class="${v ? 'cg-t-grade' : 'cg-t-eixo'}" stroke-width="1"/>`).join('')
    + texto(r + 4, sy(1) + 4, '100%', { classe: 'cg-txt-mudo', corpo: 8.5 }) + texto(r + 4, sy(0.5) + 3, '50%', { classe: 'cg-txt-mudo', corpo: 8.5 });
  const xy = ps.map(p => [r2(sx(diaUtc(p.data))), r2(sy(limitar(p.taxa, 0, 1)))]);
  corpo += `<path d="${xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join('')}" class="cg-t-acento" fill="none" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  const [ux, uy] = xy.at(-1);
  corpo += `<circle cx="${ux}" cy="${uy}" r="4" class="cg-f-acento cg-anel-fundo" stroke-width="2"/>`;
  xy.forEach(([x, y], i) => {
    const xa = i ? (xy[i - 1][0] + x) / 2 : l, xd = i < xy.length - 1 ? (x + xy[i + 1][0]) / 2 : r;
    const p = ps[i];
    corpo += `<g ${alvo(p.dica || `${ddmm(p.data)}: ${Math.round(p.taxa * 100)}%`, false)}><rect x="${r2(xa)}" y="${t}" width="${r2(Math.max(1, xd - xa))}" height="${b - t}" fill="transparent"/>`
      + `<line x1="${x}" x2="${x}" y1="${t}" y2="${b}" class="cg-mira" stroke-width="1"/><circle cx="${x}" cy="${y}" r="3.5" class="cg-f-acento cg-anel-fundo cg-mira-ponto" stroke-width="2"/></g>`;
  });
  return svg(largura, altura, rotulo, corpo, 'cg-mini');
}

// ---------- linha curtinha (o histórico de um indicador) ----------
export function faisca(valores = [], { largura = 72, altura = 22, rotulo = '' } = {}) {
  const vs = valores.map(v => (finito(v) ? v : null));
  const idx = vs.map((v, i) => (v == null ? -1 : i)).filter(i => i >= 0);
  if (idx.length < 2) return '';
  const max = Math.max(...idx.map(i => vs[i]), 1);
  const sx = escala([0, vs.length - 1], [3, largura - 5]), sy = escala([0, max], [altura - 3, 3]);
  const xy = idx.map(i => [r2(sx(i)), r2(sy(vs[i]))]);
  const [ux, uy] = xy.at(-1);
  return svg(largura, altura, rotulo,
    `<path d="${xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join('')}" class="cg-t-media" fill="none" stroke-width="1.5" stroke-linejoin="round"/>`
    + `<circle cx="${ux}" cy="${uy}" r="3" class="cg-f-acento"/>`, 'cg-faisca');
}

// ---------- pirâmide (homens à esquerda, mulheres à direita) ----------
// faixas: [{ faixa, m, f }], da mais velha (no alto) para a mais nova
export function piramide({ faixas = [], rotulo = '', largura = 340 } = {}) {
  const linha = 20, vao = 5, topo = 18, meio = largura / 2, col = 26;
  const H = topo + faixas.length * (linha + vao) + 2;
  const max = Math.max(1, ...faixas.flatMap(f => [f.m, f.f].filter(finito)));
  const larg = meio - col - 28;
  const sw = v => (finito(v) && v > 0 ? (v / max) * larg : 0);
  let corpo = texto(meio - col, 11, '♂ Homens', { classe: 'cg-txt', corpo: 10, ancora: 'end' })
    + texto(meio + col, 11, 'Mulheres ♀', { classe: 'cg-txt', corpo: 10 });
  faixas.forEach((f, i) => {
    const y = topo + i * (linha + vao), h = linha - 6, yb = y + 3;
    const wm = sw(f.m), wf = sw(f.f);
    corpo += texto(meio, y + linha / 2 + 3.5, f.faixa, { classe: 'cg-txt-forte', corpo: 10, ancora: 'middle', peso: '600' });
    corpo += `<g ${alvo(`${f.faixa} anos — homens: ${fmt(f.m || 0)}`)}><rect x="${r2(meio - col - larg - 26)}" y="${y}" width="${r2(larg + 26)}" height="${linha}" fill="transparent"/>`
      + (wm ? `<path d="${barraDeitada(meio - col, yb, wm, h, 4, true)}" class="cg-f-s1"/>` : '')
      + texto(meio - col - wm - 4, y + linha / 2 + 3.5, fmt(f.m || 0), { classe: 'cg-txt', corpo: 10, ancora: 'end' }) + '</g>';
    corpo += `<g ${alvo(`${f.faixa} anos — mulheres: ${fmt(f.f || 0)}`)}><rect x="${r2(meio + col)}" y="${y}" width="${r2(larg + 26)}" height="${linha}" fill="transparent"/>`
      + (wf ? `<path d="${barraDeitada(meio + col, yb, wf, h)}" class="cg-f-s2"/>` : '')
      + texto(meio + col + wf + 4, y + linha / 2 + 3.5, fmt(f.f || 0), { classe: 'cg-txt', corpo: 10 }) + '</g>';
  });
  return svg(largura, H, rotulo, corpo, 'cg-piramide');
}

// ---------- pedaços em HTML ----------
// Medidor de uma linha (chamados preenchidos de uma organização, recomendações de
// uma faixa de idade): o rótulo quebra à vontade, o trilho ocupa a largura toda.
export function medidor({ rotulo = '', valor = 0, total = 0, nota = '', classe = 'acento' } = {}) {
  const v = finito(valor) ? Math.max(0, valor) : 0, t = finito(total) ? Math.max(0, total) : 0;
  const pct = t ? limitar((v / t) * 100, 0, 100) : 0;
  const leitura = `${rotulo}: ${fmt(v)} de ${fmt(t)}${nota ? ` — ${nota}` : ''}`;
  return `<div class="cg-medidor">
    <div class="cg-medidor-cab"><span class="cg-medidor-rot">${esc(rotulo)}</span><span class="cg-medidor-num">${fmt(v)} de ${fmt(t)}</span></div>
    <div class="cg-medidor-trilho cg-alvo" role="img" tabindex="0" aria-label="${esc(leitura)}"${tip(leitura)}><div class="cg-medidor-barra cg-bg-${cor(classe)}" style="width:${r2(pct)}%"></div></div>
    ${nota ? `<div class="cg-medidor-nota">${esc(nota)}</div>` : ''}
  </div>`;
}

// Legenda: a chave tem a forma da marca (retângulo para barra, traço para linha);
// o texto fica na cor do texto, nunca na da série
export function legenda(itens = []) {
  if (!itens.length) return '';
  return `<ul class="cg-legenda">${itens.map(i => {
    const c = cor(i.classe);
    const chave = i.forma === 'linha'
      ? `<svg class="cg-chave" viewBox="0 0 16 10" aria-hidden="true"><line x1="1" x2="15" y1="5" y2="5" class="cg-t-${c}" stroke-width="2" stroke-linecap="round"/></svg>`
      : `<svg class="cg-chave" viewBox="0 0 12 12" aria-hidden="true"><rect x="1" y="1" width="10" height="10" rx="2" class="cg-f-${c}"/></svg>`;
    return `<li>${chave}<span>${esc(i.rotulo)}</span>${i.valor != null ? ` <strong>${esc(i.valor)}</strong>` : ''}</li>`;
  }).join('')}</ul>`;
}

// A tabela que acompanha o gráfico: o mesmo dado sem depender de cor nem de mouse
export function tabela({ cab = [], linhas = [], resumo = 'Ver os números' } = {}) {
  if (!linhas.length) return '';
  return `<details class="cg-tabela"><summary>${esc(resumo)}</summary><div class="cg-tabela-rolagem"><table>
    <thead><tr>${cab.map((c, i) => `<th scope="col"${i ? ' class="num"' : ''}>${esc(c)}</th>`).join('')}</tr></thead>
    <tbody>${linhas.map(l => `<tr>${l.map((c, i) => (i ? `<td class="num">${esc(c)}</td>` : `<th scope="row">${esc(c)}</th>`)).join('')}</tr>`).join('')}</tbody>
  </table></div></details>`;
}

// A moldura de um gráfico: título, subtítulo, o desenho, a legenda e a tabela.
// conteudo, legendaHtml e tabelaHtml já vêm prontos (escapados) destas funções.
export function figura({ titulo = '', sub = '', conteudo = '', legendaHtml = '', tabelaHtml = '', nota = '', classe = '' } = {}) {
  return `<figure class="cg-figura${classe ? ' ' + classe : ''}">
    ${titulo ? `<figcaption><span class="cg-fig-titulo">${esc(titulo)}</span>${sub ? `<span class="cg-fig-sub">${esc(sub)}</span>` : ''}</figcaption>` : ''}
    ${legendaHtml}
    <div class="cg-desenho">${conteudo}</div>
    ${nota ? `<p class="cg-fig-nota">${esc(nota)}</p>` : ''}
    ${tabelaHtml}
  </figure>`;
}
