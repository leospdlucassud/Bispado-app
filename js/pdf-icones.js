// =============================================
// ÍCONES DESENHADOS NO PDF — a ponte com o pdf.js (sem DOM)
// A "Frequência à classe e ao quórum" do LCR não ESCREVE a presença: desenha, à
// esquerda de cada classe, um círculo com um ✓ (veio) ou um anel (não veio). São
// caminhos (curvas e retas), não texto — o getTextContent nem os vê. Daqui sai,
// de cada página, a caixa de cada caminho pequeno e curvo que foi pintado, no
// MESMO espaço dos trechos de texto (o do PDF, y para cima), com o que diz a
// forma dele: quantas curvas, retas e subcaminhos, e como foi pintado. Quem
// decide o que é presença é crescimento-lcr.js (formaDoIcone), que não sabe de
// pdf.js — e os testes montam operator lists sintéticas para cá.
//
// Feito para o pdf.js 3.11.174 (o do cdnjs que o app carrega, e o do Node na
// validação): ali o constructPath leva [ops, coords, minMax] e a pintura (fill,
// eoFill, stroke…) vem no operador seguinte. O minMax NÃO serve: ele só conta os
// pontos de moveTo/lineTo/rectangle, e as curvas de um círculo ficam de fora.
// Por isso a caixa é feita aqui, ponto a ponto (pontos de controle incluídos: no
// círculo eles ficam dentro do quadrado que o contém), com a matriz corrente
// seguida por save/restore/transform e pelos form XObjects. Na 4.x o
// constructPath mudou de forma: trocar a versão do pdf.js pede rever isto.
// Medido em out/2026 (pdf.js): presente = 12,5 × 12,5, 2 subcaminhos, 15 curvas
// e 8 retas, eoFill; ausente = mesmo tamanho, 2 subcaminhos, 36 curvas, fill; o
// glifo de tendência no fim da linha = 10,6 × 11,3, 8 curvas e 12 retas.
// =============================================

// Os números do pdfjsLib.OPS da 3.11 — o navegador passa o OPS de verdade; estes
// valem para quem chama sem ele (os testes)
export const OPS_PDFJS_3 = Object.freeze({
  save: 10, restore: 11, transform: 12, moveTo: 13, lineTo: 14, curveTo: 15, curveTo2: 16, curveTo3: 17,
  closePath: 18, rectangle: 19, stroke: 20, closeStroke: 21, fill: 22, eoFill: 23, fillStroke: 24,
  eoFillStroke: 25, closeFillStroke: 26, closeEOFillStroke: 27, endPath: 28,
  paintFormXObjectBegin: 74, paintFormXObjectEnd: 75, constructPath: 91,
});

// pt: o ícone é pequeno. Moldura, fundo de linha e separadores (retângulos de
// 100 × 0,6, aos milhares) ficam fora — e a lista de cada página não incha.
export const MAX_LADO_ICONE = 40;

const multiplicar = (m, n) => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];
const ehMatriz = m => !!m && m.length === 6 && Array.prototype.every.call(m, v => Number.isFinite(v));

// Quantos números cada operação de caminho consome em coords
function argumentosDe(op, OPS) {
  if (op === OPS.moveTo || op === OPS.lineTo) return 2;
  if (op === OPS.curveTo) return 6;
  if (op === OPS.curveTo2 || op === OPS.curveTo3) return 4;
  if (op === OPS.rectangle) return 4;
  return 0;   // closePath
}

// Um constructPath → { x0, y0, x1, y1, curvas, retas, subcaminhos } no espaço da página
function medirCaminho(args, ctm, OPS) {
  const ops = args?.[0] || [], co = args?.[1] || [];
  let k = 0, curvas = 0, retas = 0, subcaminhos = 0;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const ponto = (x, y) => {
    const px = ctm[0] * x + ctm[2] * y + ctm[4], py = ctm[1] * x + ctm[3] * y + ctm[5];
    if (px < x0) x0 = px;
    if (px > x1) x1 = px;
    if (py < y0) y0 = py;
    if (py > y1) y1 = py;
  };
  for (const op of ops) {
    const n = argumentosDe(op, OPS);
    const c = Array.prototype.slice.call(co, k, k + n);
    k += n;
    if (op === OPS.moveTo) subcaminhos++;
    else if (op === OPS.lineTo) retas++;
    else if (op === OPS.curveTo || op === OPS.curveTo2 || op === OPS.curveTo3) curvas++;
    else if (op === OPS.rectangle) {
      subcaminhos++;
      retas += 4;
      ponto(c[0], c[1]); ponto(c[0] + c[2], c[1] + c[3]);
      continue;
    }
    for (let j = 0; j + 1 < c.length; j += 2) ponto(c[j], c[j + 1]);
  }
  return x0 === Infinity ? null : { x0, y0, x1, y1, curvas, retas, subcaminhos };
}

// O operator list de UMA página ({ fnArray, argsArray }) → as caixas dos caminhos
// pequenos, com ao menos uma curva, que foram pintados:
//   [{ x, y, w, h, curvas, retas, subcaminhos, pintura: 'fill'|'eoFill'|'stroke' }]
// (x, y = canto de baixo à esquerda). Caminho de recorte (terminado em endPath)
// não é desenho e não entra.
export function caixasDoOperatorList(ol, OPS = OPS_PDFJS_3) {
  const fns = ol?.fnArray || [], args = ol?.argsArray || [];
  const PINTURA = {
    [OPS.fill]: 'fill', [OPS.eoFill]: 'eoFill',
    [OPS.fillStroke]: 'fill', [OPS.closeFillStroke]: 'fill',
    [OPS.eoFillStroke]: 'eoFill', [OPS.closeEOFillStroke]: 'eoFill',
    [OPS.stroke]: 'stroke', [OPS.closeStroke]: 'stroke',
  };
  let ctm = [1, 0, 0, 1, 0, 0];
  const pilha = [];
  const out = [];
  let caminho = null;   // o último constructPath, à espera da pintura
  for (let i = 0; i < fns.length; i++) {
    const fn = fns[i], a = args[i];
    if (fn === OPS.save) pilha.push(ctm);
    else if (fn === OPS.restore) { if (pilha.length) ctm = pilha.pop(); }
    else if (fn === OPS.transform) { if (ehMatriz(a)) ctm = multiplicar(ctm, a); }
    else if (fn === OPS.paintFormXObjectBegin) {
      pilha.push(ctm);
      if (ehMatriz(a?.[0])) ctm = multiplicar(ctm, a[0]);
    } else if (fn === OPS.paintFormXObjectEnd) { if (pilha.length) ctm = pilha.pop(); }
    else if (fn === OPS.constructPath) caminho = medirCaminho(a, ctm, OPS);
    else if (fn === OPS.endPath) caminho = null;
    else if (PINTURA[fn]) {
      const c = caminho;
      caminho = null;
      if (!c || !c.curvas) continue;
      const w = c.x1 - c.x0, h = c.y1 - c.y0;
      if (w > MAX_LADO_ICONE || h > MAX_LADO_ICONE) continue;
      out.push({ x: c.x0, y: c.y0, w, h, curvas: c.curvas, retas: c.retas, subcaminhos: c.subcaminhos, pintura: PINTURA[fn] });
    }
  }
  return out;
}

// Uma página do pdf.js → as caixas (ver caixasDoOperatorList)
export async function caixasDaPagina(pagina, OPS = OPS_PDFJS_3) {
  return caixasDoOperatorList(await pagina.getOperatorList(), OPS);
}

// O documento inteiro: por página, os trechos de texto (o que os leitores de
// crescimento-lcr.js recebem) e, com `icones`, as caixas. O operator list custa
// mais que o texto: só a frequência às classes precisa dele.
export async function lerPaginas(doc, { icones = false, OPS = OPS_PDFJS_3 } = {}) {
  const paginas = [], caixas = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const pg = await doc.getPage(i);
    paginas.push((await pg.getTextContent()).items);
    if (icones) caixas.push(await caixasDaPagina(pg, OPS));
  }
  return { paginas, icones: caixas };
}
