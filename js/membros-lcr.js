// =============================================
// "LISTA DE MEMBROS" DO LCR — sem DOM
// Lê o PDF da Lista de Membros e devolve o quadro da ala: nome como no LCR
// ("Sobrenome, Prenomes"), sexo, idade, nascimento, telefone e e-mail. A tela
// (prévia, aplicar, avisos) fica em membros-import.js; aqui não há DOM nem
// config.js (que lê location): tests/membros-lcr.test.mjs importa direto no
// Node, com listas sintéticas da mesma geometria e pessoas inventadas.
//
// Há dois desenhos do PDF, e cada um tem o seu leitor:
//
// 1) Sem a coluna Endereço (o de jun/2026) — leitura pelo FORMATO de cada
//    trecho (lerPorFormato). O cabeçalho ocupa 3 linhas de Y diferentes ("Data
//    de"/"Nascimento", "Número de"/"Telefone"); o nome quebra em linhas acima E
//    abaixo da linha do sexo, porque as outras células ficam centralizadas; o
//    pdf.js não preenche a largura dos trechos e os acentos vêm soltos
//    ("Fl"+"á"+"via"). A âncora é o M/F; o resto se reconhece pelo formato
//    (data, telefone, e-mail, número). Medido: 347 membros, 0 nomes corrompidos.
//
// 2) Com a coluna Endereço (o que o próprio LCR imprime, out/2026) — leitura
//    pelas COLUNAS (lerPorColunas). O endereço tem números ("Qd 104", "Lote 9",
//    CEP), siglas e várias linhas: pelo formato, ele vazava para a idade, o
//    telefone e o e-mail (97 telefones e 7 e-mails de 437). Aqui só a posição
//    separa as células. Geometria (pdf.js, A4, y para cima, corpo 9):
//      página 1 com "Lista de Membros" (24) e "<Ala> (<unidade>)" (12); o
//      cabeçalho em y≈668,8 na 1ª página e ≈741 nas outras; rótulos em
//      Nome 41,8 | Sexo 139,8 | Idade 197 | Data de Nascimento 232,5 |
//      Endereço 289,7 | Número de Telefone 374,1 | E-mail 444,9 — a célula começa
//      no mesmo x do rótulo; os rótulos também quebram, centralizados (o "o" de
//      "Nascimento" cai uma linha abaixo) e com o acento solto ("Endere"+"ç"+"o").
//      Cada célula fica centralizada no registro, linhas a 12,3 pt; o endereço
//      ocupa 2 a 5 linhas; e-mail ("…@gmail.co" + "m") e data ("12 mar" +
//      "1990") também quebram. De um registro ao outro há ≥ 19 pt.
//      A quebra de página parte o registro: o M/F fica no pé de uma página e o
//      nome (com endereço e telefone) no alto da seguinte, ou o contrário.
//      No fim, "Contagem: N" — a conferência do que foi lido.
//    O endereço é lido só para não cair nas outras colunas, e descartado: o
//    quadro não o guarda (decidido em out/2026: a API de membros não tem senha).
//    Por isso, PDF com o Endereço cujo cabeçalho não se reconhece não é lido
//    (semCabecalho), em vez de ir para o leitor pelo formato.
// =============================================
import { MESES_PT, norm } from './utils.js';

// ---------- comum aos dois leitores ----------
// Agrupa os trechos do PDF em linhas (por Y). Guarda a largura para saber
// quando dois trechos vizinhos formam a mesma palavra (acentos vêm separados).
export function extrairLinhas(itens) {
  const linhas = [];
  itens.forEach(it => {
    if (!it.str || !it.str.trim()) return;
    const x = it.transform[4], y = Math.round(it.transform[5]);
    let ln = linhas.find(l => Math.abs(l.y - y) <= 3);
    if (!ln) { ln = { y, partes: [] }; linhas.push(ln); }
    // transform[0] ≈ corpo da fonte; o pdf.js nem sempre preenche width (0 = sem)
    ln.partes.push({ x, fs: Math.abs(it.transform[0]) || 10, w: it.width > 0 ? it.width : 0, txt: it.str });
  });
  linhas.forEach(l => l.partes.sort((a,b) => a.x - b.x));
  return linhas.sort((a,b) => b.y - a.y);
}

export const RE_LIXO   = /lista de membros|somente para uso da igreja|intellectual reserve|direitos reservados|^nome$|^sexo$|^idade$|^data de$|^nascimento$|^n[úu]mero de$|^telefone$|^e-?mail$|^contagem:?\s*\d+$/i;

// Acentos vêm como trechos separados. Sem width, estima-se a largura pelo corpo
// da fonte para decidir se dois trechos vizinhos têm um espaço entre eles.
export const RE_ACENTO = /^[áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ]$/;

// Com a largura (o PDF do LCR com Endereço traz), o vão decide sozinho — também
// para o acento que abre palavra ("Maria" + "Â" + "ngela" tem espaço antes do Â:
// colado sempre, virava "MariaÂngela" e o nome não batia com o dos chamados).
// Sem ela, vale o de antes: acento cola na letra anterior e a largura é estimada.
export function juntarNome(partes) {
  let out = '';
  partes.forEach((p, i) => {
    const a = partes[i-1];
    if (a && a.w > 0) {
      if (p.x - (a.x + a.w) > a.fs * 0.18) out += ' ';
    } else if (a && !RE_ACENTO.test(p.txt)) {
      const larguraAprox = a.txt.length * a.fs * 0.5;
      if (p.x - (a.x + larguraAprox) > a.fs * 0.18) out += ' ';
    }
    out += p.txt;
  });
  return out.replace(/\s+/g, ' ').trim();
}

export function idadeDeNascimento(nasc) {
  const m = /^(\d{1,2})\s+([a-zç]{3})\.?\s+(\d{4})$/i.exec(nasc || '');
  if (!m) return 0;
  const mes = MESES_PT[m[2].toLowerCase()];
  if (mes === undefined) return 0;
  const nascimento = new Date(+m[3], mes, +m[1]);
  const hoje = new Date();
  let anos = hoje.getFullYear() - nascimento.getFullYear();
  const dm = hoje.getMonth() - nascimento.getMonth();
  if (dm < 0 || (dm === 0 && hoje.getDate() < nascimento.getDate())) anos--;
  return (anos >= 0 && anos < 130) ? anos : 0;
}

export function formatarTelefone(t) {
  const d = (t || '').replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return d.length >= 8 ? (t || '').trim() : '';
}
export const RE_DATA   = /^\d{1,2}\s+[a-zç]{3}\.?\s+\d{4}$/i;
export const RE_TEL    = /^\(?\d{2}\)?\s*\d{4,5}-?\d{4}$/;
export const RE_EMAIL  = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const RE_DATA_NO_TEXTO = /\d{1,2}\s+[a-zç]{3}\.?\s+\d{4}/i;
const RE_TEL_NO_TEXTO = /\(?\d{2}\)?\s*\d{4,5}-?\s?\d{4}/;
const RE_CONTAGEM = /^contagem:?\s*(\d+)$/i;
const RE_RODAPE = /somente para uso da igreja/i;

// ---------- 1) leitura pelo formato (PDF sem a coluna Endereço) ----------
// O nome ocupa uma caixa de texto que pode quebrar em várias linhas, enquanto as
// demais colunas ficam centralizadas verticalmente. Por isso os pedaços do nome
// aparecem acima E abaixo da linha que traz o sexo. Cada pedaço é associado à
// linha-âncora verticalmente mais próxima.
function lerPorFormato(paginas) {
  const registros = [];

  paginas.forEach(itens => {
    const linhas = extrairLinhas(itens);

    // A coluna Sexo é a âncora: única com um M ou F isolado.
    let xSexo = null;
    for (const l of linhas) {
      const p = l.partes.find(p => /^[MF]$/.test(p.txt.trim()));
      if (p) { xSexo = p.x; break; }
    }
    if (xSexo == null) return;

    const ancoras = [], soltas = [];

    linhas.forEach(l => {
      const uteis = l.partes.filter(p => !RE_LIXO.test(p.txt.trim()));
      if (!uteis.length) return;
      const esq = uteis.filter(p => p.x <  xSexo - 2);
      const dir = uteis.filter(p => p.x >= xSexo - 2);

      if (dir.some(p => /^[MF]$/.test(p.txt.trim()))) {
        const campos = { sexo:'', idade:'', nasc:'', tel:'' }, resto = [];
        dir.forEach(p => {
          const t = p.txt.trim();
          if      (/^[MF]$/.test(t))     campos.sexo  = t;
          else if (/^\d{1,3}$/.test(t))  campos.idade = t;
          else if (RE_DATA.test(t))      campos.nasc  = t;
          else if (RE_TEL.test(t))       campos.tel   = t;
          else                           resto.push({ ...p, y: l.y });
        });
        ancoras.push({ y: l.y, campos, resto, pedacos: esq.length ? [{ y: l.y, partes: esq }] : [] });
      } else {
        if (esq.length) soltas.push({ y: l.y, partes: esq });
        if (dir.length) soltas.push({ y: l.y, resto: dir.map(p => ({ ...p, y: l.y })) });
      }
    });

    // cada linha solta pertence à âncora mais próxima
    soltas.forEach(s => {
      let alvo = null, dist = Infinity;
      ancoras.forEach(a => { const d = Math.abs(a.y - s.y); if (d < dist) { dist = d; alvo = a; } });
      if (!alvo || dist > 18) return;
      if (s.resto) alvo.resto.push(...s.resto);
      else alvo.pedacos.push(s);
    });

    ancoras.forEach(a => {
      // pedaços de cima para baixo
      const nome = a.pedacos
        .sort((p, q) => q.y - p.y)
        .map(f => juntarNome(f.partes))
        .join(' ').replace(/\s+/g, ' ').trim();
      registros.push({
        name: nome,
        gender: a.campos.sexo,
        age: parseInt(a.campos.idade, 10) || idadeDeNascimento(a.campos.nasc),
        nascimento: a.campos.nasc,
        telefone: formatarTelefone(a.campos.tel),
        email: emailDoResto(a.resto),
      });
    });
  });
  return registros;
}

// O e-mail sai só da célula dele. À direita do Sexo, o que não tem forma de
// idade, data nem telefone fica no `resto` — e ali cai também a data quebrada
// ("3 jan" + "1985") e, se o PDF tiver um endereço que não foi reconhecido como
// coluna, o endereço: juntado tudo, "Qd 104 Lote 9" + "ana@…" passava no
// RE_EMAIL e ia para o quadro. A célula começa no trecho com "@" (ou no vizinho
// colado à esquerda dele, sem vão de espaço, se o pdf.js partiu a linha), e a
// linha quebrada ("…@gmail.co" + "m") começa no mesmo x: o que fica à esquerda é
// de outra coluna. Colado é o vão do juntarNome: as colunas encostam (um telefone
// fora da forma enche a dele até o e-mail), e um corpo inteiro de folga o juntava.
function emailDoResto(resto) {
  const arroba = resto.find(p => p.txt.includes('@'));
  if (!arroba) return '';
  const fim = p => p.x + (p.w || p.txt.length * p.fs * 0.5);
  let x0 = arroba.x;
  const aEsquerda = resto.filter(p => p.y === arroba.y && p.x < arroba.x).sort((a, b) => b.x - a.x);
  for (const p of aEsquerda) { if (x0 - fim(p) > p.fs * 0.18) break; x0 = p.x; }
  return resto.filter(p => p.x >= x0 - FOLGA_COLUNA)
    .sort((a, b) => b.y - a.y || a.x - b.x)
    .map(p => p.txt).join('').replace(/\s+/g, '');
}

// ---------- 2) leitura pelas colunas (PDF com a coluna Endereço) ----------
// Tolerâncias relativas ao corpo do cabeçalho (9 pt em out/2026), nunca por
// igualdade: outra ala, ou outra versão do LCR, muda um décimo aqui e ali.
const MESMA_LINHA = 0.25;      // × corpo: trechos da mesma linha física
const VAO_ROTULO = 0.5;        // × corpo: vão maior que isto separa dois rótulos na mesma linha do cabeçalho
const ALTURA_CABECALHO = 2;    // × corpo: rótulo quebrado vai até ±1,37 corpo; o 1º registro começa ≥ 3,4 abaixo
const MESMO_REGISTRO = 1.74;   // × corpo: no registro as linhas distam ≤ 12,3 pt (1,37); de um ao outro, ≥ 19 (2,1)
const FOLGA_COLUNA = 3;        // pt: a célula começa no x do rótulo; folga para os arredondamentos

// Rótulo do cabeçalho (já pelo norm) → coluna. A parte de baixo de um rótulo
// quebrado ("Telefone", "Nascimento" ou o "o" que sobrou dele) cai no mesmo x
// da de cima e não abre coluna; rótulo desconhecido abre uma coluna ignorada,
// para o que vier nela não cair na vizinha. O do endereço vale também em inglês
// e espanhol: é ele que decide o leitor (temColunaEndereco).
const RE_ROTULO_ENDERECO = /^(endere|address|direcci)/;
const COLUNAS = [
  ['nome', /^nome$/], ['sexo', /^sexo$/], ['idade', /^idade$/], ['nasc', /^(data|nascimen)/],
  ['end', RE_ROTULO_ENDERECO], ['tel', /^(numero|telefone)/], ['email', /^e-?mail/],
];

const corpoDe = t => Math.hypot(t[0], t[1]) || Math.hypot(t[2], t[3]) || 0;

// Linhas físicas da página, de cima para baixo: { y, f (maior corpo), partes, texto }.
// As partes têm a forma do juntarNome ({ x, fs, w, txt }).
function linhasDaPagina(itens) {
  const trechos = [];
  for (const i of itens || []) {
    if (!i || typeof i.str !== 'string' || !i.str.trim() || !Array.isArray(i.transform)) continue;
    trechos.push({ x: i.transform[4], y: i.transform[5], fs: corpoDe(i.transform) || 9, w: i.width > 0 ? i.width : 0, txt: i.str });
  }
  trechos.sort((a, b) => b.y - a.y || a.x - b.x);
  const linhas = [];
  for (const t of trechos) {
    const l = linhas.at(-1);
    if (l && l.y - t.y <= Math.min(l.f, t.fs) * MESMA_LINHA) { l.partes.push(t); l.f = Math.max(l.f, t.fs); }
    else linhas.push({ y: t.y, f: t.fs, partes: [t] });
  }
  for (const l of linhas) {
    l.partes.sort((a, b) => a.x - b.x);
    l.texto = juntarNome(l.partes);
  }
  return linhas;
}

// Pedaços de uma linha separados por vão de coluna (rótulos do cabeçalho)
function rotulosDaLinha(l) {
  const out = [];
  for (const p of l.partes) {
    const a = out.at(-1), ult = a && a.partes.at(-1);
    const fim = ult && ult.x + (ult.w || ult.txt.length * ult.fs * 0.5);
    if (a && p.x - fim <= p.fs * VAO_ROTULO) a.partes.push(p);
    else out.push({ x: p.x, partes: [p] });
  }
  return out.map(r => ({ x: r.x, texto: norm(juntarNome(r.partes)) }));
}

// O cabeçalho da página: "Nome" e "Sexo" na mesma linha; os outros rótulos na
// faixa de ±ALTURA_CABECALHO em volta. Devolve { y, f, x: { coluna: x }, ordem } ou null.
function cabecalhoDaPagina(linhas) {
  const l = linhas.find(l => {
    const r = rotulosDaLinha(l).map(r => r.texto);
    return r.includes('nome') && r.includes('sexo');
  });
  if (!l) return null;
  const f = l.f;
  const rotulos = linhas.filter(o => Math.abs(o.y - l.y) <= f * ALTURA_CABECALHO)
    .flatMap(rotulosDaLinha).sort((a, b) => a.x - b.x);
  const x = {};
  for (const r of rotulos) {
    const c = COLUNAS.find(([, re]) => re.test(r.texto));
    if (c && x[c[0]] == null) x[c[0]] = r.x;   // em ordem de x: fica o menor
  }
  rotulos.forEach((r, k) => {
    if (!COLUNAS.some(([, re]) => re.test(r.texto)) && !Object.values(x).some(v => Math.abs(v - r.x) <= FOLGA_COLUNA)) x['outra' + k] = r.x;
  });
  const ordem = Object.keys(x).sort((a, b) => x[a] - x[b]);
  return { y: l.y, f, x, ordem };
}

const colunaDe = (cab, px) => {
  let c = cab.ordem[0];
  for (const k of cab.ordem) if (px >= cab.x[k] - FOLGA_COLUNA) c = k;
  return c;
};

const ehAncora = (cab, p) => /^[MF]$/.test(p.txt.trim()) && colunaDe(cab, p.x) === 'sexo';

// todas: por página, as linhas de linhasDaPagina
function lerPorColunas(todas) {
  // 1. Por página: tira o cabeçalho (e o título e a ala, acima dele), o rodapé e
  //    a "Contagem"; o que sobra vai em faixas — linhas seguidas, mais perto que
  //    MESMO_REGISTRO, são de um registro só
  const faixas = [];
  let cab = null;   // página sem cabeçalho usa as colunas da anterior
  todas.forEach((linhas, p) => {
    const daPagina = cabecalhoDaPagina(linhas);
    if (daPagina) cab = daPagina;
    if (!cab) return;
    const corpo = cab.f;
    const rodape = Math.max(-Infinity, ...linhas.filter(l => RE_RODAPE.test(l.texto)).map(l => l.y));
    let atual = null;
    for (const l of linhas) {
      if (daPagina && l.y >= daPagina.y - corpo * ALTURA_CABECALHO) continue;
      if (l.y <= rodape + 1 || RE_CONTAGEM.test(l.texto)) continue;
      l.cab = cab;
      if (atual && atual.linhas.at(-1).y - l.y < corpo * MESMO_REGISTRO) atual.linhas.push(l);
      else { atual = { p, linhas: [l] }; faixas.push(atual); }
    }
  });

  // 2. Um registro por M/F. Faixa com dois (registros colados demais) se parte
  //    pela âncora mais próxima de cada linha.
  for (const fx of faixas) {
    const ancoras = fx.linhas.flatMap(l => l.partes.filter(pt => ehAncora(l.cab, pt)).map(pt => ({ y: l.y, sexo: pt.txt.trim() })));
    fx.registros = ancoras.map(a => ({ sexo: a.sexo, y: a.y, linhas: [] }));
    for (const l of fx.linhas) {
      let alvo = null, d = Infinity;
      for (const r of fx.registros) if (Math.abs(r.y - l.y) < d) { d = Math.abs(r.y - l.y); alvo = r; }
      if (alvo) alvo.linhas.push(l);
    }
  }

  // 3. Faixa sem M/F é pedaço de registro partido pela quebra de página: no alto
  //    da página, é o fim do último registro da anterior; no pé, o começo do 1º
  //    da seguinte (20 vezes no PDF de 2026). Fora disso (não acontece em 2026),
  //    fica com a vizinha mais perto na página. Só um passo: duas faixas sem M/F
  //    seguidas são um registro sem sexo, que fica de fora — e a "Contagem" acusa na prévia.
  faixas.forEach((fx, i) => {
    if (fx.registros.length) return;
    const ant = faixas[i - 1], prox = faixas[i + 1];
    let alvo;
    if (ant && ant.p !== fx.p) alvo = ant.registros.at(-1);
    else if (prox && prox.p !== fx.p) alvo = prox.registros[0];
    else {
      const acima = ant ? ant.linhas.at(-1).y - fx.linhas[0].y : Infinity;
      const abaixo = prox ? fx.linhas.at(-1).y - prox.linhas[0].y : Infinity;
      alvo = acima <= abaixo ? ant?.registros.at(-1) : prox?.registros[0];
    }
    if (alvo) alvo.linhas.push(...fx.linhas.map(l => ({ ...l, p: fx.p })));
  });

  // 4. Células: em cada coluna, as linhas de cima para baixo (e da página
  //    anterior para a seguinte). Da data e da idade fica só o que tem a forma
  //    delas (um pedaço solto na célula não estraga); o e-mail junta sem espaço
  //    ("…@gmail.co" + "m").
  const registros = [];
  for (const fx of faixas) {
    for (const r of fx.registros) {
      const linhas = r.linhas.map(l => ({ ...l, p: l.p ?? fx.p })).sort((a, b) => a.p - b.p || b.y - a.y);
      const cel = {};
      for (const l of linhas) {
        const porColuna = {};
        for (const pt of l.partes) (porColuna[colunaDe(l.cab, pt.x)] ||= []).push(pt);
        for (const [c, partes] of Object.entries(porColuna)) (cel[c] ||= []).push(juntarNome(partes));
      }
      const texto = c => (cel[c] || []).join(' ').replace(/\s+/g, ' ').trim();
      const idade = (/\d{1,3}/.exec(texto('idade')) || [''])[0];
      const nasc = (RE_DATA_NO_TEXTO.exec(texto('nasc')) || [''])[0].replace(/\s+/g, ' ');
      const tel = texto('tel');
      registros.push({
        name: texto('nome'),
        gender: r.sexo,
        age: parseInt(idade, 10) || idadeDeNascimento(nasc),
        nascimento: nasc,
        // letra ou @ na célula do telefone é sobra de outra coluna: fica só o número
        telefone: formatarTelefone(/[a-z@]/i.test(tel) ? (RE_TEL_NO_TEXTO.exec(tel) || [''])[0] : tel),
        email: texto('email').replace(/\s+/g, ''),
        // o endereço (cel.end) para aqui: não vai para o quadro
      });
    }
  }
  return registros;
}

// ---------- o PDF inteiro ----------
// Com a coluna Endereço, só a leitura pelas colunas acerta; sem ela, segue a
// leitura pelo formato, a que foi medida no PDF de jun/2026.
// A coluna se reconhece pelo rótulo dela, em qualquer linha, e não pelo
// cabeçalho inteiro: este exige "Nome" e "Sexo" na mesma linha, e um "Gênero" no
// lugar do "Sexo" (ou o LCR em inglês) mandava o PDF COM endereço para o leitor
// pelo formato. Rótulo achado a mais só custa a leitura pelas colunas.
const temColunaEndereco = todas => todas.some(linhas =>
  linhas.some(l => rotulosDaLinha(l).some(r => RE_ROTULO_ENDERECO.test(r.texto))));

// Devolve { membros: [{ name, gender, age, nascimento, telefone, email }],
//           contagem: o N de "Contagem: N" (ou null, se o PDF não traz),
//           endereco: o PDF tinha a coluna Endereço (lida e descartada),
//           semCabecalho: tinha o Endereço, mas não o cabeçalho que separa as
//             colunas — nada foi lido (membros vazio) e a importação explica,
//           repetidos: registros que tinham o nome de outro e ficaram um só }.
// contagem ≠ membros.length: algo não foi lido (ou havia nomes iguais) — a prévia avisa.
export function lerPdfMembros(paginas) {
  const todas = (paginas || []).map(linhasDaPagina);
  const endereco = temColunaEndereco(todas);
  // Com o Endereço e sem as colunas, não há leitor que sirva: o pelo formato
  // juntava o endereço no e-mail, que ia para o /api/membros (sem senha).
  const semCabecalho = endereco && !todas.some(linhas => cabecalhoDaPagina(linhas));
  const brutos = semCabecalho ? [] : endereco ? lerPorColunas(todas) : lerPorFormato(paginas || []);

  let contagem = null;
  for (const l of todas.flat()) { const m = RE_CONTAGEM.exec(l.texto); if (m) contagem = +m[1]; }

  const limpos = brutos
    .filter(r => r.name && r.name.length >= 3 && !/^\d+$/.test(r.name))
    .map(r => ({ ...r, email: RE_EMAIL.test(r.email) ? r.email : '' }));

  // remove repetidos, conservando o registro mais completo
  const porNome = new Map();
  limpos.forEach(r => {
    const k = norm(r.name);
    const preenchidos = o => [o.age, o.nascimento, o.telefone, o.email].filter(Boolean).length;
    const atual = porNome.get(k);
    if (!atual || preenchidos(r) > preenchidos(atual)) porNome.set(k, r);
  });
  const membros = [...porNome.values()];
  return { membros, contagem, endereco, semCabecalho, repetidos: limpos.length - membros.length };
}

// Só o quadro (a forma de antes)
export const parsearPdfMembros = paginas => lerPdfMembros(paginas).membros;

export function detectarAlaNoPdf(paginas) {
  for (const itens of paginas) {
    const txt = itens.map(i => i.str).join(' ');
    const m = txt.match(/Lista de Membros\s*(.+?)\s*\((\d+)\)/);
    if (m) return { nome: m[1].trim(), unidade: m[2] };
  }
  return null;
}
