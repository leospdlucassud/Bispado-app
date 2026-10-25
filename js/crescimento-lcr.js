// =============================================
// "VAMOS CRESCER A ALA" — os relatórios do LCR e as contas da aba (sem DOM)
// Lê quatro PDFs do LCR (todos pelo "Salvar como PDF" do navegador, com texto):
//   1) Relatório Trimestral       — lerTrimestral
//   2) Estatísticas da Unidade    — lerEstatisticas
//   3) Situação de Recomendação para o Templo (adultos) e Situação da
//      Recomendação do Jovem      — lerRecomendacoes
//   4) Frequência à classe e ao quórum (um mês) — lerFrequenciaClasses, que
//      também recebe os ícones desenhados (js/pdf-icones.js)
// e faz as contas da aba: o caminho até os mínimos do Manual Geral 36.2 para
// uma ala (e para duas, se a ala for dividida), os adultos e jovens
// "participantes" que dá para provar, as médias da sacramental, a tendência de
// cada classe e as recomendações a renovar. Aqui também mora a limpeza do que o
// servidor grava (/api/crescimento), usada pela function.
// Nada de DOM nem de config.js (que lê location): tests/crescimento-lcr.test.mjs
// importa direto no Node, com PDFs SINTÉTICOS da mesma geometria e gente inventada.
//
// O que é de cada pessoa NUNCA sai daqui misturado com o resto. Os leitores
// devolvem contagens; só a lista de recomendações (nome, sexo, idade, situação,
// validade) sai por pessoa — para o "Renovações a agendar" e a conta dos
// participantes —, e ela vai para a parte do documento que só a sessão de Bispo
// ou ADM recebe (privado). A frequência às classes é contada direto dos ícones,
// sem passar por nomes; a página 2 do Trimestral ("Detalhes sobre o Converso",
// com nomes) é pulada inteira.
//
// Geometria (pdf.js, A4 595×842, y para cima), medida nos PDFs de out/2026:
//   Trimestral, corpo 7,5: "Relatório Trimestral | <Ala> (<n>) | Trimestre T - AAAA"
//     numa linha só (corpo 9); cabeçalho "Real | Potencial | 2026 | 2025 | 2021"
//     (o ano, 1 e 5 anos antes); cada indicador numa linha: número (x≈38,5),
//     rótulo (x≈48–53, que quebra em 2–3 linhas a 7,5 pt — ACIMA e abaixo da
//     linha do número, que então vem sem rótulo), valores CENTRALIZADOS sob o
//     rótulo da coluna; "--" = sem valor; "100% 100%" pode vir num trecho só.
//     Seções na margem (x≈37,7). Rodapé "18 out. 2026 | Somente para Uso da Igreja".
//   Estatísticas: "rótulo … valor" (rótulo x≈34,5; valor à direita, x≈543–556);
//     os acentos vêm em trechos SEPARADOS ("Fam"+"í"+"lias"). Não traz data.
//   Recomendações, corpo 6,6: "<Ala> (<n>)" / título / "<Estaca> (<n>)"; colunas
//     Nome | Sexo | Idade | [Tipo de Recomendação] | Situação | Validade, a
//     célula no x do rótulo; "mai. 2027"; jovem sem recomendação vem SEM situação;
//     "Contagem: N" no fim; rodapé com a data em inglês ("18 Oct 2026").
//   Frequência: "Nome | Sexo | 4 Out | 11 Out …" (sem o ano!) só na 1ª página;
//     por pessoa, em cada domingo, as classes dela — o ícone à esquerda e o
//     rótulo (que quebra em 2 linhas) centralizado nele; a quebra de página parte
//     o bloco da pessoa. Agosto (5 domingos) vem todo em escala menor (corpo 7,4
//     em vez de 8,8; ícone 10,5 em vez de 12,5): as tolerâncias são relativas.
// =============================================
import { CARGOS_DO_LCR, aDesignar, ordemNatural, tipoDePdf } from './chamados-lcr.js';
import { chavePessoa, ehDomingo, registroDoDomingo, somarDias, somarMeses, tipoDe } from './discursos-regras.js';
import { dataLocal, norm } from './utils.js';

const dois = n => String(n).padStart(2, '0');
// sem acento, caixa, espaço nem pontuação: "Fam"+"í"+"lias com Jovens" e
// "Famílias com  Jovens" dão o mesmo (o espaço entre trechos é estimado)
const compacto = s => norm(s).replace(/[^a-z0-9]/g, '');

// ---------- datas do LCR ----------
// O LCR escreve o mês em português ("18 out. 2026", "mai. 2027") e, no rodapé
// das recomendações, em inglês ("18 Oct 2026")
const MES_NUM = {
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
  feb: 2, apr: 4, may: 5, aug: 8, sep: 9, oct: 10, dec: 12,
};
const mesDe = t => MES_NUM[norm(t).slice(0, 3)] || 0;
const RE_DATA_LONGA = /(\d{1,2})\s+([a-zà-úç]{3})[a-zà-úç]*\.?\s+(\d{4})/i;
const RE_MES_ANO = /^([a-zà-úç]{3})[a-zà-úç]*\.?\s+(\d{4})$/i;
const RE_DIA_MES = /^(\d{1,2})\s+([a-zà-úç]{3})\.?$/i;

// "18 out. 2026" / "18 Oct 2026" (em qualquer lugar do texto) → "2026-10-18"; '' se não houver
export function dataDoLcr(texto) {
  const m = RE_DATA_LONGA.exec(String(texto || ''));
  const mes = m ? mesDe(m[2]) : 0;
  if (!mes) return '';
  const d = +m[1], a = +m[3];
  const t = new Date(a, mes - 1, d);
  return t.getMonth() === mes - 1 && t.getDate() === d ? `${a}-${dois(mes)}-${dois(d)}` : '';
}

// "mai. 2027" → "2027-05"; '' se não for mês
export function mesDoLcr(texto) {
  const m = RE_MES_ANO.exec(String(texto || '').trim());
  const mes = m ? mesDe(m[1]) : 0;
  return mes ? `${m[2]}-${dois(mes)}` : '';
}

// Os domingos do relatório de frequência vêm sem o ano ("4 Out"). O ano é o
// que faz de TODAS as datas um domingo — o mesmo dia da semana só se repete
// depois de 5 a 11 anos, então o mais recente (até um pouco depois de hoje: o
// mês corrente traz os domingos que ainda vêm) não deixa dúvida. Dezembro →
// janeiro na mesma lista passa para o ano seguinte. diasMeses: [{ dia, mes (1–12) }].
export function anoDasSemanas(diasMeses, hoje = dataLocal()) {
  const ref = +String(hoje).slice(0, 4) || new Date().getFullYear();
  const montar = a => {
    let ano = a, antes = 0;
    return (diasMeses || []).map(({ dia, mes }) => {
      if (mes < antes) ano++;
      antes = mes;
      return `${ano}-${dois(mes)}-${dois(dia)}`;
    });
  };
  const limite = somarDias(hoje, 45) || '9999';
  for (let a = ref + 1; a >= ref - 12; a--) {
    const datas = montar(a);
    if (datas.length && datas.every(ehDomingo) && datas[0] <= limite) return datas;
  }
  return montar(ref);
}

// ---------- trechos e linhas ----------
const MESMA_LINHA = 0.25;   // × corpo: trechos da mesma linha física
const COLA = 0.15;          // × corpo: trechos mais perto que isto são a mesma palavra
const RE_UNIDADE = /^(.*\S)\s*\((\d+)\)$/;
const RE_RODAPE = /somente para uso da igreja/i;
const RE_CONTAGEM = /^contagem:?\s*(\d+)$/i;

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
// a não ser que a largura diga que um encosta no outro (acento solto)
function juntar(trechos) {
  let out = '';
  trechos.forEach((t, k) => {
    const a = trechos[k - 1];
    if (a && t.x - (a.x + a.w) > Math.min(a.f, t.f) * COLA) out += ' ';
    out += t.s;
  });
  return out.replace(/\s+/g, ' ').trim();
}

// Trechos → linhas físicas, de cima para baixo: { y, f (maior corpo), x, itens, texto }
function agruparLinhas(trechos) {
  const ordem = [...trechos].sort((a, b) => b.y - a.y || a.x - b.x);
  const linhas = [];
  for (const t of ordem) {
    const l = linhas.at(-1);
    if (l && l.y - t.y <= Math.min(l.f, t.f) * MESMA_LINHA) { l.itens.push(t); l.f = Math.max(l.f, t.f); }
    else linhas.push({ y: t.y, f: t.f, itens: [t] });
  }
  for (const l of linhas) {
    l.itens.sort((a, b) => a.x - b.x);
    l.x = l.itens[0].x;
    l.texto = juntar(l.itens);
  }
  return linhas;
}
const linhasDaPagina = itens => agruparLinhas(trechosDaPagina(itens));

// Rótulos de uma linha de cabeçalho: trechos separados por vão de coluna
// ("Tipo de Recomenda"+"çã"+"o" é um rótulo só) → [{ x, x1, texto (já pelo norm) }]
function rotulosDaLinha(l, vao = 0.6) {
  const grupos = [];
  for (const t of l.itens) {
    const g = grupos.at(-1), ult = g && g.at(-1);
    if (ult && t.x - (ult.x + ult.w) <= t.f * vao) g.push(t);
    else grupos.push([t]);
  }
  return grupos.map(g => ({ x: g[0].x, x1: g.at(-1).x + g.at(-1).w, texto: norm(juntar(g)) }));
}

// A ala e a unidade ("Ala Exemplo 9 (000009)"): a 1ª linha com "(número)" no alto
// da 1ª página que não seja a estaca
function alaDoPdf(linhas) {
  for (const l of linhas || []) {
    if (/^estaca\b/i.test(l.texto)) continue;
    const m = RE_UNIDADE.exec(l.texto);
    if (m) return { ala: m[1].trim(), unidade: m[2] };
  }
  return { ala: '', unidade: '' };
}

// ---------- que PDF é este? ----------
// 'trimestral' | 'estatisticas' | 'recomendacoes-adultos' | 'recomendacoes-jovens'
// | 'frequencia-classes' — os desta aba —, ou o que tipoDePdf (chamados-lcr.js)
// diz dos outros: 'chamados' | 'membros' | 'sem-texto' | 'outro'. Vem pelo
// título: as recomendações e a frequência TÊM "Nome | Sexo" no cabeçalho, como a
// Lista de Membros, e o tipoDePdf de lá as tomaria por ela.
const TITULOS = [
  ['trimestral', /^relatoriotrimestral/],
  ['estatisticas', /^estatisticasdaunidade/],
  ['recomendacoes-adultos', /^situacaoderecomendacaoparaotemplo/],
  ['recomendacoes-jovens', /^situacaodarecomendacaodojovem/],
  ['frequencia-classes', /^frequenciaaclasseeaoquorum/],
];
export const NOMES_DOS_PDFS = {
  trimestral: 'Relatório Trimestral',
  estatisticas: 'Estatísticas da Unidade',
  'recomendacoes-adultos': 'Situação de Recomendação para o Templo',
  'recomendacoes-jovens': 'Situação da Recomendação do Jovem',
  'frequencia-classes': 'Frequência à classe e ao quórum',
};
export function tipoDePdfLcr(paginas) {
  const linhas = (paginas || []).flatMap(linhasDaPagina);
  if (!linhas.length) return 'sem-texto';
  for (const l of linhas) {
    const c = compacto(l.texto);
    const t = TITULOS.find(([, re]) => re.test(c));
    if (t) return t[0];
  }
  return tipoDePdf(paginas);
}

// Cada relatório do LCR tem UMA aba que o importa. Os três botões "📄 Importar
// PDF do LCR" (Membros, Chamados e esta aba) perguntam aqui, com o tipo do
// tipoDePdfLcr, e o PDF de outra aba recebe o aviso "importe lá" em vez de ir ao
// leitor — a lista das recomendações tem "Nome | Sexo" no cabeçalho e, lida como
// a Lista de Membros, trocava o quadro inteiro por quem tem recomendação.
// '' = de nenhuma aba ('sem-texto', 'outro'): cada importador avisa do seu jeito.
export const ABA_DO_PDF = Object.freeze({
  membros: 'membros', chamados: 'chamados',
  ...Object.fromEntries(Object.keys(NOMES_DOS_PDFS).map(t => [t, 'crescimento'])),
});
export const abaDoPdf = tipo => (Object.prototype.hasOwnProperty.call(ABA_DO_PDF, tipo) ? ABA_DO_PDF[tipo] : '');

// ---------- 1) Relatório Trimestral ----------
export const SECOES_TRIMESTRAL = [
  { chave: 'conversao', titulo: 'Indicadores de conversão e de crescimento da Igreja', de: 1, ate: 9, re: /^indicadores/ },
  { chave: 'membros', titulo: 'Membros / Famílias', de: 10, ate: 13, re: /^membros/ },
  { chave: 'adultos', titulo: 'Adultos', de: 14, ate: 17, re: /^adultos/ },
  { chave: 'jovens', titulo: 'Jovens', de: 18, ate: 20, re: /^jovens/ },
  { chave: 'criancas', titulo: 'Crianças', de: 21, ate: 22, re: /^criancas/ },
  { chave: 'conversos', titulo: 'Conversos (últimos 12 meses)', de: 23, ate: 26, re: /^conversos/ },
];
const CHAVES_SECAO = SECOES_TRIMESTRAL.map(s => s.chave);
const secaoPorNumero = n => SECOES_TRIMESTRAL.find(s => n >= s.de && n <= s.ate)?.chave || '';
const RE_CAB_TRIMESTRAL = /relat[oó]rio trimestral\s+(.+?)\s*\((\d+)\)\s*trimestre\s+([1-4])\s*[-–]\s*(\d{4})/i;
const RE_TRIMESTRE = /trimestre\s+([1-4])\s*[-–]\s*(\d{4})/i;
const RE_NUMERO_LINHA = /^\d{1,2}$/;
const RE_VALOR = /^(--|—|\d{1,3}(?:\.\d{3})*(?:,\d+)?%?|\d+(?:,\d+)?%?)$/;

// "64%" → 64; "1.234" → 1234; "--" → null
function valorDe(tok) {
  if (!tok || /^(--|—)$/.test(tok)) return null;
  const n = Number(tok.replace('%', '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

// Os tokens de um trecho, cada um com o centro estimado pela posição do
// caractere: "100% 100%" num trecho só se divide entre as duas colunas
function tokensDoTrecho(t) {
  const out = [], re = /\S+/g;
  const len = t.s.length || 1;
  let m;
  while ((m = re.exec(t.s))) {
    out.push({ s: m[0], c: t.x + t.w * ((m.index + m[0].length / 2) / len) });
  }
  return out;
}

// Devolve { ala, unidade, trimestre, ano, data,
//           linhas: [{ n, secao, rotulo, real, potencial, pct, pctAnoAnterior, pct5Anos }] (null = "--"),
//           faltando: números de 1 a 26 que não vieram, avisos: [texto] }.
export function lerTrimestral(paginas) {
  const todas = (paginas || []).map(linhasDaPagina);
  const out = { ala: '', unidade: '', trimestre: null, ano: null, data: '', linhas: [], faltando: [], avisos: [] };

  for (const l of todas.flat()) {
    const m = RE_CAB_TRIMESTRAL.exec(l.texto);
    if (m) { out.ala = m[1].trim(); out.unidade = m[2]; out.trimestre = +m[3]; out.ano = +m[4]; break; }
  }
  if (!out.ala) Object.assign(out, alaDoPdf((todas[0] || []).filter(l => !RE_RODAPE.test(l.texto))));
  if (!out.trimestre) {
    const m = todas.flat().map(l => RE_TRIMESTRE.exec(l.texto)).find(Boolean);
    if (m) { out.trimestre = +m[1]; out.ano = +m[2]; }
  }
  const rodape = todas.flat().find(l => RE_RODAPE.test(l.texto));
  if (rodape) out.data = dataDoLcr(rodape.texto);

  // a 2ª parte ("Detalhes sobre o Converso") tem nomes: daqui para baixo, nada se
  // lê. Corta no título e, se o LCR mudar o título, no cabeçalho da tabela de
  // pessoas ("Nome | Sexo | Idade") — uma linha dela que começasse por número e
  // tivesse algo nas colunas de valores viraria indicador, com o nome no rótulo.
  const tabelaDePessoas = l => l.itens.some(i => norm(i.s) === 'nome') && l.itens.some(i => ['sexo', 'idade'].includes(norm(i.s)));
  const conteudo = [];
  let parou = false;
  for (const linhas of todas) {
    if (parou) break;
    const pagina = [];
    for (const l of linhas) {
      if (/^detalhessobreoconverso/.test(compacto(l.texto)) || tabelaDePessoas(l)) { parou = true; break; }
      pagina.push(l);
    }
    conteudo.push(pagina);
  }

  // o cabeçalho das colunas: "Real | Potencial | anos"; o valor fica centralizado sob o rótulo
  const cab = conteudo.flat().find(l => {
    const r = l.itens.map(i => norm(i.s));
    return r.includes('real') && r.includes('potencial');
  });
  if (!cab) { out.avisos.push('O cabeçalho "Real | Potencial" não foi encontrado.'); return out; }
  const centro = i => i.x + i.w / 2;
  const itemDe = rot => cab.itens.find(i => norm(i.s) === rot);
  const anos = cab.itens.filter(i => /^\d{4}$/.test(i.s.trim())).sort((a, b) => a.x - b.x);
  const colunas = [{ k: 'real', c: centro(itemDe('real')) }, { k: 'potencial', c: centro(itemDe('potencial')) }];
  const nomesAnos = ['pct', 'pctAnoAnterior', 'pct5Anos'];
  anos.forEach((a, i) => {
    const ano = +a.s.trim();
    const k = out.ano === ano ? 'pct' : out.ano - 1 === ano ? 'pctAnoAnterior' : out.ano - 5 === ano ? 'pct5Anos' : nomesAnos[i];
    if (k && !colunas.some(c => c.k === k)) colunas.push({ k, c: centro(a) });
  });
  colunas.sort((a, b) => a.c - b.c);
  const passo = Math.min(...colunas.slice(1).map((c, i) => c.c - colunas[i].c));
  const inicioValores = colunas[0].c - passo / 2;   // à esquerda disto, é rótulo
  const colunaDe = c => {
    let melhor = null, d = Infinity;
    for (const col of colunas) if (Math.abs(col.c - c) < d) { d = Math.abs(col.c - c); melhor = col; }
    return d <= passo * 0.6 ? melhor.k : null;
  };

  // linhas de indicador: o número na margem e ao menos um valor nas colunas
  const corpo = cab.f;
  const pCab = conteudo.findIndex(pg => pg.includes(cab));
  const linhasIndicador = [], soltas = [];
  conteudo.forEach((linhas, p) => {
    for (const l of linhas) {
      if (p < pCab || (p === pCab && l.y >= cab.y - corpo * 0.5)) continue;   // o cabeçalho e o que vem acima dele
      if (RE_RODAPE.test(l.texto) || RE_CAB_TRIMESTRAL.test(l.texto) || RE_TRIMESTRE.test(l.texto)) continue;
      const primeiro = l.itens[0];
      const valores = l.itens.filter(i => i.x >= inicioValores);
      const rotulo = l.itens.filter(i => i.x < inicioValores && i !== primeiro);
      if (RE_NUMERO_LINHA.test(primeiro.s.trim()) && primeiro.x < inicioValores && valores.length) {
        linhasIndicador.push({ p, y: l.y, n: +primeiro.s.trim(), x: primeiro.x, xFim: primeiro.x + primeiro.w, rotulo: rotulo.length ? [{ y: l.y, texto: juntar(rotulo) }] : [], valores });
      } else if (!valores.length) {
        soltas.push({ p, y: l.y, x: l.x, texto: l.texto });
      }
    }
  });
  if (!linhasIndicador.length) { out.avisos.push('Nenhuma linha de indicador foi reconhecida.'); return out; }

  // texto solto: título de seção (na margem: começa antes de acabar o número da
  // linha, x≈37,7 contra 38,5) ou pedaço de rótulo quebrado (começa depois, x≈48:
  // vai para a linha de indicador mais próxima, na mesma página)
  const margemSecao = Math.min(...linhasIndicador.map(r => r.xFim)) + corpo * 0.3;
  const titulos = [];
  for (const s of soltas) {
    if (s.x < margemSecao) { titulos.push(s); continue; }
    let alvo = null, d = Infinity;
    for (const r of linhasIndicador) {
      if (r.p !== s.p) continue;
      const dist = Math.abs(r.y - s.y);
      if (dist < d) { d = dist; alvo = r; }
    }
    if (alvo && d <= corpo * 1.6) alvo.rotulo.push({ y: s.y, texto: s.texto });
  }

  // a seção de cada linha: o último título acima dela (na ordem de leitura)
  const ordem = (a, b) => a.p - b.p || b.y - a.y;
  const eventos = [...titulos.map(t => ({ ...t, titulo: true })), ...linhasIndicador].sort(ordem);
  let secaoAtual = '';
  const vistos = new Set();
  for (const e of eventos) {
    if (e.titulo) {
      const s = SECOES_TRIMESTRAL.find(s => s.re.test(norm(e.texto)));
      secaoAtual = s ? s.chave : '';
      continue;
    }
    if (vistos.has(e.n)) continue;   // número repetido (não acontece no LCR): fica o 1º
    vistos.add(e.n);
    const v = { real: null, potencial: null, pct: null, pctAnoAnterior: null, pct5Anos: null };
    for (const t of e.valores) {
      for (const tok of tokensDoTrecho(t)) {
        if (!RE_VALOR.test(tok.s)) continue;
        const k = colunaDe(tok.c);
        if (k && v[k] === null) v[k] = valorDe(tok.s);
      }
    }
    const rotulo = e.rotulo.sort((a, b) => b.y - a.y).map(r => r.texto).join(' ').replace(/\s+/g, ' ').trim();
    out.linhas.push({ n: e.n, secao: secaoAtual || secaoPorNumero(e.n), rotulo, ...v });
  }
  out.linhas.sort((a, b) => a.n - b.n);

  const tem = new Set(out.linhas.map(l => l.n));
  for (let n = 1; n <= 26; n++) if (!tem.has(n)) out.faltando.push(n);
  // conferência: o % do LCR é real ÷ potencial
  for (const l of out.linhas) {
    if (l.real != null && l.potencial && l.pct != null && Math.abs(Math.round(l.real / l.potencial * 100) - l.pct) > 1) {
      out.avisos.push(`Linha ${l.n}: ${l.real} de ${l.potencial} não dá ${l.pct}%.`);
    }
  }
  return out;
}

// Melhorou ou piorou (para as setas): o % do trimestre contra o de 1 e 5 anos
// antes. Sem % (linhas 10, 11, 21), não há o que comparar. Em todos os
// indicadores do relatório, mais é melhor.
export function comparacaoIndicador(linha, { limiar = 1 } = {}) {
  const dir = (a, b) => (a == null || b == null ? null : a - b >= limiar ? 'melhor' : b - a >= limiar ? 'pior' : 'igual');
  return {
    anoAnterior: dir(linha?.pct, linha?.pctAnoAnterior),
    cincoAnos: dir(linha?.pct, linha?.pct5Anos),
  };
}

// "2026-T3": a chave do trimestre no histórico
export const chaveTrimestre = t => (t && t.ano && t.trimestre ? `${t.ano}-T${t.trimestre}` : '');

// O histórico de um indicador ({ 'AAAA-Tn': trimestral }) em ordem: [{ chave, real, potencial, pct }]
export function historicoDoIndicador(trimestres, n) {
  return Object.keys(trimestres || {}).sort().map(chave => {
    const l = (trimestres[chave]?.linhas || []).find(l => l.n === n);
    return l ? { chave, real: l.real, potencial: l.potencial, pct: l.pct } : null;
  }).filter(Boolean);
}

// ---------- 2) Estatísticas da Unidade ----------
// Rótulo (compacto) → chave estável. A ordem importa: "Rapazes conversos" não é
// "Rapazes", "Sumos Sacerdotes" não é "Sacerdotes (completando 16…)".
export const ROTULOS_ESTATISTICAS = [
  ['totalMembros', 'Total de membros', /^totaldemembros/],
  ['homens', 'Homens', /^homens$/],
  ['sumosSacerdotes', 'Sumos sacerdotes', /^sumossacerdotes/],
  ['elderesPerspectiva', 'Élderes em perspectiva', /^elderesemperspectiva/],
  ['elderes', 'Élderes', /^elderes$/],
  ['mulheres', 'Mulheres', /^mulheres$/],
  ['rapazes', 'Rapazes', /^rapazes$/],
  ['sacerdotes', 'Sacerdotes', /^sacerdotes/],
  ['mestres', 'Mestres', /^mestres/],
  ['diaconos', 'Diáconos', /^diaconos/],
  ['mocas', 'Moças', /^mocas$/],
  ['guardias', 'Guardiãs da Luz', /^guardiasdaluz/],
  ['mensageiras', 'Mensageiras da Esperança', /^mensageirasdaesperanca/],
  ['edificadoras', 'Edificadoras da Fé', /^edificadorasdafe/],
  ['criancasPrimaria', 'Crianças (3 anos ou mais) na Primária', /^criancasde3anos/],
  ['criancas0a2', 'Crianças de 0 a 2 anos', /^criancasde0a2/],
  ['familias', 'Famílias', /^familias$/],
  ['familiasSemPortadorSM', 'Famílias sem portador do Sacerdócio de Melquisedeque', /^familiassem/],
  ['familiasComJovens', 'Famílias com jovens', /^familiascomjovens/],
  ['familiasComFilhos', 'Famílias com filhos', /^familiascomfilhos/],
  ['familiasMonoparentais', 'Famílias com apenas um dos pais e filhos', /^familiascomapenasumdospais/],
  ['adultos', 'Adultos', /^adultos$/],
  ['adultosCasados', 'Adultos casados', /^adultoscasados/],
  ['adultosSolteiros36', 'Adultos solteiros (36 anos ou mais)', /^adultossolteiros/],
  ['jas', 'Jovens adultos solteiros (18–35)', /^jovensadultossolteiros/],
  ['recemConversos', 'Recém-conversos (12 meses)', /^recemconversos/],
  ['conversosAdultosM', 'Conversos adultos do sexo masculino', /^conversosadultosdosexomasculino/],
  ['conversosAdultosF', 'Conversos adultos do sexo feminino', /^conversosadultosdosexofeminino/],
  ['conversosRapazes', 'Rapazes conversos', /^rapazesconversos/],
  ['conversosMocas', 'Moças conversas', /^mocasconversas/],
  ['conversosCriancas', 'Crianças conversas', /^criancasconversas/],
  // (o LCR escreve "Situação das Ordenações": as do sacerdócio, não as ordenanças)
  ['ordenacoesRecemConversos', 'Situação das ordenações de recém-conversos', /^situacaodasordena/],
  ['recemConversosOrdenados', 'Recém-conversos ordenados', /^ordenados$/],
  ['recemConversosNaoOrdenados', 'Recém-conversos não ordenados', /^naoordenados$/],
  ['adultosInvestidos', 'Adultos com investidura', /^adultoscominvestidura$/],
  ['investidosComRecomendacao', 'Com investidura e com recomendação', /^cominvestiduraecomrecomendacao/],
  ['investidosSemRecomendacao', 'Com investidura sem recomendação', /^cominvestidurasemrecomendacao/],
  ['pessoasNaoIncluidas', 'Pessoas não incluídas nos totais', /^pessoasnaoincluidas/],
  ['nascimentoFaltando', 'Data de nascimento faltando ou inválida', /^datadenascimentofaltando/],
  ['batizadosNaoConfirmados', 'Batizados que não foram confirmados', /^membrosbatizadosquenao/],
  ['registradosNoveAnosOuMais', 'Registrados com 9 anos ou mais', /^membrosregistradoscomnoveanos/],
];
export const CHAVES_ESTATISTICAS = ROTULOS_ESTATISTICAS.map(r => r[0]);
const RE_INTEIRO = /^\d{1,3}(?:\.\d{3})*$|^\d+$/;
const inteiroDe = s => Number(String(s).replace(/\./g, ''));

// Devolve { ala, unidade, valores: { chave: número }, outros: [{ rotulo, valor }] }
// (outros: linha com número que não está em ROTULOS_ESTATISTICAS — a prévia mostra)
export function lerEstatisticas(paginas) {
  const todas = (paginas || []).map(linhasDaPagina);
  const out = { ala: '', unidade: '', valores: {}, outros: [] };
  Object.assign(out, alaDoPdf(todas[0] || []));
  for (const linhas of todas) {
    for (const l of linhas) {
      if (l.itens.length < 2 || RE_RODAPE.test(l.texto) || RE_UNIDADE.test(l.texto)) continue;
      const ult = l.itens.at(-1);
      // o valor é o último trecho, número, bem à direita do rótulo
      const resto = l.itens.slice(0, -1);
      const fimRotulo = Math.max(...resto.map(i => i.x + i.w));
      if (!RE_INTEIRO.test(ult.s.trim()) || ult.x - fimRotulo < l.f * 3) continue;
      const rotulo = juntar(resto);
      const valor = inteiroDe(ult.s.trim());
      const r = ROTULOS_ESTATISTICAS.find(([, , re]) => re.test(compacto(rotulo)));
      if (r) { if (out.valores[r[0]] === undefined) out.valores[r[0]] = valor; }
      else out.outros.push({ rotulo, valor });
    }
  }
  return out;
}

// ---------- 3) Situação das recomendações ----------
// A situação como o LCR escreve → a chave guardada. "" = sem recomendação
// (o jovem que nunca teve vem com a célula vazia).
export const SITUACOES = {
  ativa: 'Ativa', 'para-vencer': 'Para vencer', vencida: 'Vencida', cancelada: 'Cancelada',
  'nao-batizado': 'Não batizado', '': 'Sem recomendação',
};
export const situacaoChave = t => norm(t).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);
// "recomendação válida": a ativa e a que está para vencer (ainda vale)
export const recomendacaoValida = s => s === 'ativa' || s === 'para-vencer';

export const FAIXAS_RECOMENDACAO = {
  adultos: [['até 30', 0, 30], ['31–50', 31, 50], ['51+', 51, 200]],
  jovens: [['até 13', 0, 13], ['14–15', 14, 15], ['16+', 16, 200]],
};

// O que vai para a parte pública (contagens): de pessoas [{ sexo, idade, situacao, validade }]
export function resumoRecomendacoes(pessoas, { tipo = 'adultos', data = '', contagem = null } = {}) {
  const lista = pessoas || [];
  const porSituacao = {}, porMesValidade = {}, vencidasPorAno = {};
  const porSexo = {};
  let semSituacao = 0;
  for (const p of lista) {
    const s = p.situacao || '';
    if (!s) semSituacao++;
    else porSituacao[s] = (porSituacao[s] || 0) + 1;
    if (p.validade && recomendacaoValida(s)) porMesValidade[p.validade] = (porMesValidade[p.validade] || 0) + 1;
    if (p.validade && s === 'vencida') { const a = p.validade.slice(0, 4); vencidasPorAno[a] = (vencidasPorAno[a] || 0) + 1; }
    if (p.sexo === 'F' || p.sexo === 'M') {
      const g = porSexo[p.sexo] ||= { total: 0, ativas: 0 };
      g.total++;
      if (recomendacaoValida(s)) g.ativas++;
    }
  }
  const porFaixa = (FAIXAS_RECOMENDACAO[tipo] || FAIXAS_RECOMENDACAO.adultos).map(([faixa, de, ate]) => {
    const da = lista.filter(p => Number.isInteger(p.idade) && p.idade >= de && p.idade <= ate);
    return { faixa, de, ate, total: da.length, ativas: da.filter(p => recomendacaoValida(p.situacao)).length };
  });
  // as válidas na faixa dos "participantes" de 36.2 (adulto: 18+; jovem: 11 a 17) —
  // o mínimo que a parte pública prova sem os nomes (participantesSemNomes): o
  // jovem de 18 ainda na lista dos jovens não é jovem para o Manual
  const [min, max] = tipo === 'jovens' ? FAIXA_JOVENS : [IDADE_ADULTO, 200];
  const validasNaFaixa = lista.filter(p => recomendacaoValida(p.situacao) && Number.isInteger(p.idade) && p.idade >= min && p.idade <= max).length;
  return { tipo, data, contagem, lidos: lista.length, porSituacao, semSituacao, porMesValidade, vencidasPorAno, porFaixa, porSexo, validasNaFaixa };
}

// Devolve { tipo: 'adultos'|'jovens', ala, unidade, estaca, data, contagem,
//           pessoas: [{ nome, sexo, idade, situacao, validade }]  ← SÓ para a parte privada,
//           resumo: resumoRecomendacoes(...) }
// contagem ≠ pessoas.length: alguém não foi lido — a prévia avisa.
export function lerRecomendacoes(paginas) {
  const todas = (paginas || []).map(linhasDaPagina);
  const tipoPdf = tipoDePdfLcr(paginas);
  const out = { tipo: tipoPdf === 'recomendacoes-jovens' ? 'jovens' : 'adultos', ala: '', unidade: '', estaca: '', data: '', contagem: null, pessoas: [] };

  const alto = (todas[0] || []).filter(l => RE_UNIDADE.test(l.texto) && !RE_RODAPE.test(l.texto));
  const ala = alto.find(l => !/^estaca\b/i.test(l.texto)), estaca = alto.find(l => /^estaca\b/i.test(l.texto));
  if (ala) { const m = RE_UNIDADE.exec(ala.texto); out.ala = m[1].trim(); out.unidade = m[2]; }
  if (estaca) out.estaca = RE_UNIDADE.exec(estaca.texto)[1].trim();

  const COLUNAS = [['nome', /^nome$/], ['sexo', /^sexo$/], ['idade', /^idade$/], ['tipo', /^tipo/], ['situacao', /^situacao$/], ['validade', /^validade$/]];
  let cab = null;   // a página sem cabeçalho usa o da anterior
  const registros = [];
  todas.forEach(linhas => {
    const l = linhas.find(l => { const r = rotulosDaLinha(l).map(r => r.texto); return r.includes('nome') && r.includes('sexo') && r.includes('validade'); });
    if (l) {
      const x = {};
      for (const r of rotulosDaLinha(l)) {
        const c = COLUNAS.find(([, re]) => re.test(r.texto));
        if (c && x[c[0]] == null) x[c[0]] = r.x;
      }
      cab = { y: l.y, f: l.f, x, ordem: Object.keys(x).sort((a, b) => x[a] - x[b]) };
      if (x.tipo != null) out.tipo = 'adultos';
    }
    if (!cab) return;
    const colunaDe = px => { let c = cab.ordem[0]; for (const k of cab.ordem) if (px >= cab.x[k] - 3) c = k; return c; };
    const rodape = Math.max(-Infinity, ...linhas.filter(r => RE_RODAPE.test(r.texto)).map(r => r.y));
    const ancoras = [], soltas = [];
    for (const r of linhas) {
      if (l && r.y >= l.y - cab.f * 0.5) continue;   // cabeçalho, título, ala e estaca
      if (r.y <= rodape + 1) continue;
      const cont = RE_CONTAGEM.exec(r.texto);
      if (cont) { out.contagem = +cont[1]; continue; }
      const sexo = r.itens.find(i => /^[MF]$/.test(i.s.trim()) && colunaDe(i.x) === 'sexo');
      (sexo ? ancoras : soltas).push(r);
    }
    const regs = ancoras.map(a => ({ y: a.y, linhas: [a] }));
    for (const s of soltas) {   // nome quebrado: vai para o registro mais perto
      let alvo = null, d = Infinity;
      for (const r of regs) if (Math.abs(r.y - s.y) < d) { d = Math.abs(r.y - s.y); alvo = r; }
      if (alvo && d <= cab.f * 1.6) alvo.linhas.push(s);
    }
    for (const r of regs) {
      const cel = {};
      for (const ln of r.linhas.sort((a, b) => b.y - a.y)) {
        const porColuna = {};
        for (const i of ln.itens) (porColuna[colunaDe(i.x)] ||= []).push(i);
        for (const [c, itens] of Object.entries(porColuna)) (cel[c] ||= []).push(juntar(itens));
      }
      const texto = c => (cel[c] || []).join(' ').replace(/\s+/g, ' ').trim();
      const idade = parseInt(texto('idade'), 10);
      registros.push({
        nome: texto('nome'),
        sexo: /^[MF]$/.test(texto('sexo')) ? texto('sexo') : '',
        idade: Number.isInteger(idade) ? idade : null,
        situacao: situacaoChave(texto('situacao')),
        validade: mesDoLcr(texto('validade')),
      });
    }
  });
  out.pessoas = registros.filter(r => r.nome);
  const rodape = todas.flat().find(l => RE_RODAPE.test(l.texto) && RE_DATA_LONGA.test(l.texto));
  if (rodape) out.data = dataDoLcr(rodape.texto);
  out.resumo = resumoRecomendacoes(out.pessoas, { tipo: out.tipo, data: out.data, contagem: out.contagem });
  return out;
}

// As recomendações a renovar, a mais urgente primeiro: as que vencem até daqui a
// `meses` (a "Para Vencer" do LCR e a ativa de validade próxima), por validade,
// e depois as vencidas — a que venceu há menos tempo antes (é a mais fácil de
// renovar). pessoas: as de lerRecomendacoes (privadas). → [{ ...pessoa, motivo }]
export function renovacoesAgendar(pessoas, { hoje = dataLocal(), meses = 2 } = {}) {
  const limite = (somarMeses(hoje, meses) || hoje).slice(0, 7);
  const vencem = [], vencidas = [];
  for (const p of pessoas || []) {
    if (!p || !p.nome) continue;
    if (p.situacao === 'vencida') vencidas.push({ ...p, motivo: 'vencida' });
    else if (p.situacao === 'para-vencer' || (p.situacao === 'ativa' && p.validade && p.validade <= limite)) vencem.push({ ...p, motivo: 'vence' });
  }
  vencem.sort((a, b) => (a.validade || '9999').localeCompare(b.validade || '9999'));
  vencidas.sort((a, b) => (b.validade || '').localeCompare(a.validade || ''));
  return [...vencem, ...vencidas];
}

// ---------- a renovação na Agenda ----------
// O tipo da entrevista que o "📅 Agendar renovação" abre, e os que contam como a
// renovação daquela lista: o jovem pode ter sido marcado como "Batismos Vicários"
export const TIPO_RENOVACAO = Object.freeze({
  adultos: 'Renovação de Recomendação para o Templo',
  jovens: 'Recomendação de Uso Limitado (Jovens)',
});
const TIPOS_DA_RENOVACAO = {
  adultos: [TIPO_RENOVACAO.adultos],
  jovens: [TIPO_RENOVACAO.jovens, 'Recomendação para o Templo (Batismos Vicários)'],
};
const diaDe = e => (RE_DIA.test(e?.data || '') ? e.data : String(e?.realizadaEm || '').slice(0, 10));

// O que a Agenda já tem para a renovação de uma pessoa da lista (como o
// designacaoNaAgenda da aba Chamados): { estado: 'marcada', e } — em aberto, a
// mais próxima; { estado: 'feita', e } — realizada DEPOIS do relatório (a lista
// ainda mostra a situação de antes: só a próxima importação traz a nova
// validade); ou null. Sem a data do relatório, só a marcada conta (uma realizada
// de qualquer época seria a renovação de outro ano). `entrevistas` vem já
// filtrada por podeVer, como toda lista de entrevistas.
export function renovacaoNaAgenda(entrevistas, pessoa, tipo = 'adultos', { desde = '' } = {}) {
  const k = pessoa && pessoa.nome ? chave(pessoa.nome) : '';
  if (!k) return null;
  const tipos = TIPOS_DA_RENOVACAO[tipo] || TIPOS_DA_RENOVACAO.adultos;
  const dela = (entrevistas || []).filter(e => e && tipos.includes(e.tipo) && e.membro && chave(e.membro) === k);
  const aberta = dela.filter(e => e.status === 'pendente' || e.status === 'agendada')
    .sort((a, b) => (a.data || '9999').localeCompare(b.data || '9999'))[0];
  if (aberta) return { estado: 'marcada', e: aberta };
  if (!RE_DIA.test(desde || '')) return null;
  const feita = dela.filter(e => e.status === 'realizada' && diaDe(e) >= desde)
    .sort((a, b) => diaDe(b).localeCompare(diaDe(a)))[0];
  return feita ? { estado: 'feita', e: feita } : null;
}

// As renovações a fazer nas duas listas, só em números — o item do Início, que
// leva à lista: { total (a fazer: sem as já feitas), vencem, vencidas, marcadas,
// feitas, ate ('AAAA-MM': o fim do prazo de "vence") }. listas: o privado
// (recomendacoesPessoas); datas: { adultos, jovens } — a de cada relatório.
export function resumoRenovacoes(listas, entrevistas, { hoje = dataLocal(), meses = 2, datas = {} } = {}) {
  const out = { total: 0, vencem: 0, vencidas: 0, marcadas: 0, feitas: 0, ate: (somarMeses(hoje, meses) || hoje).slice(0, 7) };
  for (const tipo of ['adultos', 'jovens']) {
    for (const p of renovacoesAgendar(listas?.[tipo] || [], { hoje, meses })) {
      const ag = renovacaoNaAgenda(entrevistas, p, tipo, { desde: datas[tipo] || '' });
      if (ag?.estado === 'feita') { out.feitas++; continue; }
      out.total++;
      out[p.motivo === 'vencida' ? 'vencidas' : 'vencem']++;
      if (ag?.estado === 'marcada') out.marcadas++;
    }
  }
  return out;
}

// ---------- 4) Frequência à classe e ao quórum ----------
// O rótulo da classe → o grupo do painel. Curso 11 a 18 é a Escola Dominical dos
// jovens; o curso de número menor, a Primária.
export const GRUPOS_CLASSE = [
  { chave: 'quorumElderes', rotulo: 'Quórum de Élderes', re: /quorumdeelderes|sumossacerdotes/ },
  { chave: 'sociedadeSocorro', rotulo: 'Sociedade de Socorro', re: /sociedadedesocorro/ },
  { chave: 'escolaDominicalAdultos', rotulo: 'Escola Dominical (adultos)', re: /escoladominical.*adult|doutrinadoevangelho/ },
  { chave: 'rapazes', rotulo: 'Rapazes', re: /quorumdesacerdotes|quorumdemestres|quorumdediaconos|sacerdocioaaronico|^rapazes/ },
  { chave: 'mocas', rotulo: 'Moças', re: /guardiasdaluz|mensageirasdaesperanca|edificadorasdafe|^mocas|classedasmocas/ },
  { chave: 'escolaDominicalJovens', rotulo: 'Escola Dominical (jovens)', re: /curso(1[1-8])$|escoladominicalcurso(1[1-8])|escoladominicaljovens/ },
  { chave: 'primaria', rotulo: 'Primária', re: /valorosos|^ctr|escolhaoqueecerto|raiosdesol|bercario|primaria|criancinhas|curso([1-9]|10)$/ },
  { chave: 'outros', rotulo: 'Outras classes', re: /$^/ },
];
export const CHAVES_GRUPO = GRUPOS_CLASSE.map(g => g.chave);
export const grupoDaClasse = rotulo => {
  const c = compacto(rotulo);
  return (GRUPOS_CLASSE.find(g => g.chave !== 'outros' && g.re.test(c)) || GRUPOS_CLASSE.at(-1)).chave;
};

// A forma de um ícone (as caixas de js/pdf-icones.js): 'presente' (círculo com o
// ✓ recortado: curvas E retas), 'ausente' (anel: só curvas — dois círculos,
// muitas curvas; ou um círculo só contornado), ou null (outra coisa: o glifo de
// tendência, um chevron, um botão). Os ícones de verdade são quadrados exatos
// (12,5 × 12,5; 10,5 × 10,5 em agosto): a folga é de 3%. O glifo de tendência
// (10,6 × 11,3; 9,0 × 9,5) difere uns 6% e já sai pela forma — com 10% de
// folga ele passava por "presente".
export function formaDoIcone(c) {
  if (!c || !(c.w > 0) || !(c.h > 0)) return null;
  if (Math.abs(c.w - c.h) > Math.max(c.w, c.h) * 0.03) return null;
  const pinta = c.pintura === 'fill' || c.pintura === 'eoFill';
  if (pinta && c.curvas >= 4 && c.retas >= 2) return 'presente';
  if (c.retas === 0 && ((pinta && c.curvas >= 8) || (c.pintura === 'stroke' && c.curvas >= 4))) return 'ausente';
  return null;
}

// paginas: os trechos do pdf.js por página; icones: as caixas por página
// (caixasDaPagina). Conta por domingo e por grupo quem está matriculado (um ícone)
// e quem veio (o ícone com ✓) — sem passar pelos nomes.
// Devolve { ala, unidade, mes ('AAAA-MM'), pessoas (linhas com M/F),
//           semanas: [{ data, porGrupo: { grupo: { presentes, matriculados } }, total, registrada }],
//           icones: { presentes, ausentes, ignorados, semRotulo },
//           rotulosOutros: { rótulo: matrículas } (classes que não caíram em grupo nenhum),
//           classes: [{ rotulo, grupo, matriculados }] (a prévia mostra o que caiu em cada grupo),
//           avisos }.
// `registrada`: houve ao menos uma presença marcada no domingo — o domingo que
// ainda não chegou (o relatório traz o mês inteiro) vem todo vazio, e não é 0%.
export function lerFrequenciaClasses(paginas, icones = [], { hoje = dataLocal() } = {}) {
  const trechos = (paginas || []).map(trechosDaPagina);
  const linhas = trechos.map(agruparLinhas);
  const out = { ala: '', unidade: '', mes: '', pessoas: 0, semanas: [], icones: { presentes: 0, ausentes: 0, ignorados: 0, semRotulo: 0 }, rotulosOutros: {}, classes: [], avisos: [] };
  Object.assign(out, alaDoPdf(linhas[0] || []));

  // o cabeçalho: "Nome | Sexo | 4 Out | 11 Out …" (a fileira de botões acima,
  // com as mesmas datas e "Todos", não tem "Nome")
  let cab = null;
  linhas.some((ls, p) => ls.some(l => {
    const r = rotulosDaLinha(l, 0.3);
    const nome = r.find(x => x.texto === 'nome'), sexo = r.find(x => x.texto === 'sexo');
    if (!nome || !sexo) return false;
    const datas = r.filter(x => x.x > sexo.x && RE_DIA_MES.test(x.texto)).map(x => {
      const m = RE_DIA_MES.exec(x.texto);
      return { x: x.x, dia: +m[1], mes: mesDe(m[2]) };
    }).filter(d => d.mes);
    if (!datas.length) return false;
    cab = { p, y: l.y, f: l.f, xSexo: sexo.x, datas };
    return true;
  }));
  if (!cab) { out.avisos.push('O cabeçalho "Nome | Sexo | domingos" não foi encontrado.'); return out; }
  const datas = anoDasSemanas(cab.datas, hoje);
  const porMes = {};
  for (const d of datas) porMes[d.slice(0, 7)] = (porMes[d.slice(0, 7)] || 0) + 1;
  out.mes = Object.keys(porMes).sort((a, b) => porMes[b] - porMes[a])[0] || '';
  const xs = cab.datas.map(d => d.x);
  const colunaDe = x => { let k = -1; xs.forEach((cx, i) => { if (x >= cx - 2) k = i; }); return k; };

  // o que é conteúdo: abaixo do cabeçalho (na página dele) e acima do rodapé; a
  // linha da ala, que toda página repete no alto, sai à parte (altos)
  const ehConteudo = (p, t, rodape) => !(p === cab.p && t.y >= cab.y - cab.f * 0.5) && !(p < cab.p) && t.y > rodape + 1;
  const rodapes = linhas.map(ls => Math.max(-Infinity, ...ls.filter(l => RE_RODAPE.test(l.texto)).map(l => l.y)));
  const altos = linhas.map(ls => ls.filter(l => RE_UNIDADE.test(l.texto) && l.y > 400).map(l => l.y));

  // 1. os ícones: forma e tamanho. O anel, o mais comum, dá a medida (o glifo de
  //    tendência tem forma de ✓ — curvas e retas —, mas nunca de anel); fica o
  //    que tem a medida dele com folga de 8% (o glifo tem 15% a menos).
  //    Sem nenhum anel, não há medida: a de "todas as formas" era a do glifo
  //    (um por pessoa), e os glifos viravam presenças — um mês de lixo
  //    plausível que, gravado, trocava os domingos já guardados. Sem anel, nada.
  const porPagina = (icones || []).map(lista => (lista || []).map(c => ({ ...c, forma: formaDoIcone(c) })));
  const aneis = porPagina.flat().filter(c => c.forma === 'ausente');
  if (!aneis.length) {
    out.avisos.push(porPagina.flat().length
      ? 'Não reconheci os ícones de ausência (o anel): o desenho do relatório pode ter mudado. Nada foi contado.'
      : 'Nenhum ícone de presença foi encontrado.');
    return out;
  }
  const lados = aneis.map(c => c.w).sort((a, b) => a - b);
  const lado = lados[Math.floor(lados.length / 2)];
  const doTamanho = c => c.forma && Math.abs(c.w - lado) <= lado * 0.08 && Math.abs(c.h - lado) <= lado * 0.08;
  const validos = porPagina.map((lista, p) => lista.filter(c => {
    if (!doTamanho(c) || !ehConteudo(p, { y: c.y + c.h }, rodapes[p] ?? -Infinity)) { if (c.forma) out.icones.ignorados++; return false; }
    if (colunaDe(c.x) < 0) { out.icones.ignorados++; return false; }
    return true;
  }).map(c => ({ ...c, col: colunaDe(c.x), yc: c.y + c.h / 2, rotulo: [] })));

  // 2. os rótulos: em cada coluna de domingo, as linhas de texto, cada uma com o
  //    ícone mais perto (na mesma coluna, à esquerda dela). Linha sem ícone perto
  //    é pedaço de um rótulo partido pela quebra de página: no alto, continua o
  //    último ícone da página anterior; no pé, abre o 1º da seguinte.
  const soltas = [];
  trechos.forEach((ts, p) => {
    const daColuna = new Map();
    for (const t of ts) {
      if (!ehConteudo(p, t, rodapes[p] ?? -Infinity) || altos[p].some(y => Math.abs(y - t.y) < 1)) continue;
      const k = colunaDe(t.x);
      if (k < 0) continue;
      if (!daColuna.has(k)) daColuna.set(k, []);
      daColuna.get(k).push(t);
    }
    for (const [k, ts2] of daColuna) {
      for (const l of agruparLinhas(ts2)) {
        const yc = l.y + l.f * 0.3;
        let alvo = null, d = Infinity;
        for (const c of validos[p] || []) {
          if (c.col !== k || c.x + c.w > l.x + 1) continue;
          const dist = Math.abs(c.yc - yc);
          if (dist < d) { d = dist; alvo = c; }
        }
        if (alvo && d <= lado * 1.6) alvo.rotulo.push({ y: l.y, texto: l.texto });
        else soltas.push({ p, k, y: l.y, texto: l.texto });
      }
    }
  });
  let soltos = 0;
  for (const s of soltas) {
    const daPagina = (validos[s.p] || []).filter(c => c.col === s.k);
    const acima = daPagina.every(c => c.yc < s.y), abaixo = daPagina.every(c => c.yc > s.y);
    let alvo = null;
    if (acima && s.p > 0) alvo = (validos[s.p - 1] || []).filter(c => c.col === s.k).sort((a, b) => a.yc - b.yc)[0];
    else if (abaixo && s.p + 1 < validos.length) alvo = (validos[s.p + 1] || []).filter(c => c.col === s.k).sort((a, b) => b.yc - a.yc)[0];
    if (alvo) alvo.rotulo.push({ y: acima ? -Infinity : Infinity, texto: s.texto });
    else soltos++;
  }

  // 3. as contas por domingo e grupo
  const semanas = datas.map(data => ({ data, porGrupo: {}, total: { presentes: 0, matriculados: 0 }, registrada: false }));
  const classes = new Map();   // rótulo → { grupo, por domingo: matrículas }
  for (const c of validos.flat()) {
    if (!c.rotulo.length) { out.icones.semRotulo++; continue; }
    const rotulo = c.rotulo.sort((a, b) => b.y - a.y).map(r => r.texto).join(' ').replace(/\s+/g, ' ').trim();
    const g = grupoDaClasse(rotulo);
    if (g === 'outros') out.rotulosOutros[rotulo] = (out.rotulosOutros[rotulo] || 0) + 1;
    if (!classes.has(rotulo)) classes.set(rotulo, { grupo: g, porDomingo: datas.map(() => 0) });
    classes.get(rotulo).porDomingo[c.col]++;
    const s = semanas[c.col];
    const pg = s.porGrupo[g] ||= { presentes: 0, matriculados: 0 };
    pg.matriculados++;
    s.total.matriculados++;
    if (c.forma === 'presente') { pg.presentes++; s.total.presentes++; out.icones.presentes++; }
    else out.icones.ausentes++;
  }
  for (const s of semanas) s.registrada = s.total.presentes > 0;
  out.semanas = semanas;
  // para a prévia: cada classe, o grupo em que caiu e quantos estão nela (a
  // matrícula é a mesma em todos os domingos; vale a maior, se um rótulo partiu)
  out.classes = [...classes].map(([rotulo, c]) => ({ rotulo, grupo: c.grupo, matriculados: Math.max(...c.porDomingo) }))
    .sort((a, b) => CHAVES_GRUPO.indexOf(a.grupo) - CHAVES_GRUPO.indexOf(b.grupo) || b.matriculados - a.matriculados);

  // as pessoas: um M/F na coluna Sexo (conferência para a prévia)
  trechos.forEach((ts, p) => {
    for (const t of ts) if (/^[MF]$/.test(t.s.trim()) && Math.abs(t.x - cab.xSexo) <= cab.f * 0.4 && ehConteudo(p, t, rodapes[p] ?? -Infinity)) out.pessoas++;
  });
  if (soltos) out.avisos.push(`${soltos} pedaço(s) de rótulo de classe ficaram sem ícone.`);
  if (!validos.flat().length) out.avisos.push('Nenhum ícone de presença foi encontrado.');
  return out;
}

// ---------- as metas do Manual Geral 36.2 ----------
// "Participantes" (carta da Primeira Presidência, 30/11/2023): paga dízimo
// integral ou parcial, tem recomendação para o templo válida, tem um chamado, é
// membro novo (1º ano) que frequenta, ou é jovem matriculado no seminário. O
// dízimo é sigiloso (só o bispo, 34.4) — por isso o app só PROVA uma parte:
// chamado, recomendação e converso dos últimos 12 meses. É um mínimo, nunca o número.
// Os jovens participantes são RECOMENDADOS, não exigidos (a tabela de 36.2 —
// e a de 36.1, da estaca — marca só essa linha assim): `recomendado` os tira
// da conta dos mínimos (resumoQualificacao) e muda o selo do cartão.
export const METAS_ALA = Object.freeze({ membros: 250, portadoresSM: 20, adultosParticipantes: 100, jovensParticipantes: 20 });
export const METAS_ESTACA = Object.freeze({ membros: 2000, portadoresSM: 150, adultosParticipantes: 500, jovensParticipantes: 100, alas: 5 });
export const CRITERIOS = [
  { chave: 'membros', rotulo: 'Membros', meta: METAS_ALA.membros },
  { chave: 'portadoresSM', rotulo: 'Portadores do Sacerdócio de Melquisedeque ativos e dizimistas integrais', meta: METAS_ALA.portadoresSM, sigiloso: true },
  { chave: 'adultosParticipantes', rotulo: 'Adultos participantes', meta: METAS_ALA.adultosParticipantes, estimativa: true },
  { chave: 'jovensParticipantes', rotulo: 'Jovens participantes', meta: METAS_ALA.jovensParticipantes, estimativa: true, recomendado: true },
];

// atual: { membros, portadoresSM, adultosParticipantes, jovensParticipantes } (null = não se sabe).
// Dividir em DUAS alas pede que cada metade cumpra o mínimo: o dobro de tudo.
// → [{ chave, rotulo, atual, meta, metaDuas, pct, pctDuas, falta, faltaDuas, sigiloso, estimativa, recomendado }]
export function progressoQualificacao(atual = {}) {
  const pct = (a, m) => (a == null ? null : Math.round(a / m * 100));
  return CRITERIOS.map(c => {
    const a = Number.isFinite(atual[c.chave]) ? atual[c.chave] : null;
    const metaDuas = c.meta * 2;
    return {
      chave: c.chave, rotulo: c.rotulo, atual: a, meta: c.meta, metaDuas,
      pct: pct(a, c.meta), pctDuas: pct(a, metaDuas),
      falta: a == null ? null : Math.max(0, c.meta - a), faltaDuas: a == null ? null : Math.max(0, metaDuas - a),
      sigiloso: !!c.sigiloso, estimativa: !!c.estimativa, recomendado: !!c.recomendado,
    };
  });
}

// O total de membros, da fonte mais firme: as Estatísticas, o Trimestral (linha
// 10) mais recente, ou o quadro de membros. → { valor, fonte } (valor null: nenhuma)
export function totalDeMembros({ estatisticas = null, trimestres = {}, quadro = null } = {}) {
  const e = estatisticas?.valores?.totalMembros;
  if (Number.isFinite(e)) return { valor: e, fonte: 'estatisticas' };
  const ult = Object.keys(trimestres || {}).sort().at(-1);
  const l10 = ult && (trimestres[ult].linhas || []).find(l => l.n === 10)?.real;
  if (Number.isFinite(l10)) return { valor: l10, fonte: 'trimestral' };
  if (Array.isArray(quadro) && quadro.length) return { valor: quadro.length, fonte: 'quadro' };
  return { valor: null, fonte: '' };
}

// Quem dá para PROVAR que participa, por pessoa (a chave do nome, sem acento,
// caixa, partícula nem a vírgula do LCR). O chamado e o converso valem se o
// quadro diz que a pessoa está na faixa de idade; a recomendação traz a idade
// no próprio relatório. Quem tem chamado e não está no quadro não entra (não se
// sabe a idade) e é contado à parte. Nomes que a chave junta (homônimos) contam
// uma vez — o erro é sempre para menos: segue sendo um mínimo.
// → { total, porMotivo: { chamado, recomendacao, converso }, combinacoes: { 'chamado+recomendacao': n, … }, naoEncontrados }
// A ordem natural antes da chave: o chavePessoa de discursos-regras.js só inverte
// "Sobrenome, Prenome" com o prenome em maiúscula — e "EXEMPLO, ana" é a mesma pessoa
const chave = nome => chavePessoa(ordemNatural(nome));
function participantesNaFaixa({ membros = [], chamados = [], recomendacoes = [], conversos = [] }, [min, max]) {
  const idade = new Map();
  for (const m of membros || []) {
    const k = m && m.name ? chave(m.name) : '';
    const a = +m?.age;
    if (k && a > 0 && !idade.has(k)) idade.set(k, a);
  }
  const naFaixa = a => Number.isFinite(a) && a >= min && a <= max;
  const motivos = new Map();
  const marcar = (k, motivo) => { if (!motivos.has(k)) motivos.set(k, new Set()); motivos.get(k).add(motivo); };
  const naoEncontrados = new Set();
  for (const c of chamados || []) {
    const k = c && c.nome ? chave(c.nome) : '';
    if (!k) continue;
    if (!idade.has(k)) { naoEncontrados.add(k); continue; }
    if (naFaixa(idade.get(k))) marcar(k, 'chamado');
  }
  for (const r of recomendacoes || []) {
    const k = r && r.nome ? chave(r.nome) : '';
    if (!k || !recomendacaoValida(r.situacao)) continue;
    if (naFaixa(Number.isInteger(r.idade) ? r.idade : idade.get(k))) marcar(k, 'recomendacao');
  }
  for (const nome of conversos || []) {
    const k = chave(nome);
    if (k && naFaixa(idade.get(k))) marcar(k, 'converso');
  }
  const porMotivo = { chamado: 0, recomendacao: 0, converso: 0 }, combinacoes = {};
  for (const set of motivos.values()) {
    for (const m of set) porMotivo[m]++;
    const chave = ['chamado', 'recomendacao', 'converso'].filter(m => set.has(m)).join('+');
    combinacoes[chave] = (combinacoes[chave] || 0) + 1;
  }
  return { total: motivos.size, porMotivo, combinacoes, naoEncontrados: naoEncontrados.size };
}
export const IDADE_ADULTO = 18;
export const FAIXA_JOVENS = [11, 17];   // de janeiro do ano em que faz 12 até a véspera dos 18
export const participantesAdultos = dados => participantesNaFaixa(dados, [IDADE_ADULTO, 200]);
export const participantesJovens = dados => participantesNaFaixa(dados, FAIXA_JOVENS);

// ---------- liderança: as presidências que uma ala precisa ter ----------
// Os chamados (o relatório de chamados do LCR) de cada presidência que se
// espera numa ala. Dividir pede duas de cada.
const PRESIDENCIAS = [
  { chave: 'bispado', rotulo: 'Bispado', titulos: Object.keys(CARGOS_DO_LCR).map(t => ({ titulo: t, re: new RegExp('^' + norm(t) + '$') })) },
  ...[
    ['elderes', 'Quórum de Élderes', 'do quorum de elderes', 'o'],
    ['socorro', 'Sociedade de Socorro', 'da sociedade de socorro', 'a'],
    ['mocas', 'Moças', 'das mocas', 'a'],
    ['primaria', 'Primária', 'da primaria', 'a'],
    ['escolaDominical', 'Escola Dominical', 'da escola dominical', 'o'],
  ].map(([chave, rotulo, de, g]) => ({
    chave, rotulo,
    titulos: [
      { titulo: 'Presidente', re: new RegExp(`^presidente ${de}$`) },
      { titulo: `Primeir${g} conselheir${g}`, re: new RegExp(`^primeir${g} conselheir${g} (na presidencia )?${de}$`) },
      { titulo: `Segund${g} conselheir${g}`, re: new RegExp(`^segund${g} conselheir${g} (na presidencia )?${de}$`) },
      { titulo: `Secretári${g}`, re: new RegExp(`^secretari${g} ${de}$`) },
    ],
  })),
];
// → [{ chave, rotulo, preenchidos, total, vagos: [título] }] — chamado que o
// relatório nem traz conta como vago: é um lugar da presidência sem ninguém
export function liderancaChave(chamados) {
  const lista = (chamados || []).filter(c => c && c.chamado);
  return PRESIDENCIAS.map(p => {
    const vagos = [];
    let preenchidos = 0;
    for (const t of p.titulos) {
      const ocupado = lista.some(c => c.nome && t.re.test(norm(c.chamado)));
      if (ocupado) preenchidos++;
      else vagos.push(t.titulo);
    }
    return { chave: p.chave, rotulo: p.rotulo, preenchidos, total: p.titulos.length, vagos };
  });
}

// ---------- frequência da reunião sacramental ----------
// A "frequência" de cada ata (sacramental.js) é um texto: vale o inteiro > 0.
const contagemDe = v => {
  const n = typeof v === 'number' ? v : /^\s*\d+\s*$/.test(String(v ?? '')) ? +v : NaN;
  return Number.isInteger(n) && n > 0 && n <= 100000 ? n : null;
};

// O domingo que NÃO entra na conta da frequência: a conferência geral ou de
// estaca (não há reunião na ala — o tipo da ata) e o que a pessoa marcou "não
// contabilizar" (frequenciaConta: 'nao' — reunião cancelada, programa da estaca,
// feriado). Antes o número digitado num desses domingos entrava na média do mês.
// O campo é 'nao'/'sim' e não verdadeiro/falso: ao juntar o domingo, o servidor
// (fundirDomingo) ignora false como "vazio", e a marca nunca mais sairia.
export const foraDaContagem = ata => !!tipoDe(ata).semReuniao || ata?.frequenciaConta === 'nao';
export const marcadoSemContagem = ata => ata?.frequenciaConta === 'nao';

// atas: [{ data, frequencia }]; membros: o total da ala (o % é a média ÷ membros,
// como no LCR). → { porMes: [{ mes, semanas: [{ data, n }], media, pct }] (os
// `meses` até o de hoje, com os vazios), porAno: { AAAA: { media, pct, semanas } } }
export function frequenciaSacramental(atas, { membros = null, hoje = dataLocal(), meses = 12 } = {}) {
  const semanas = [];
  const vistas = new Set();
  for (const a of atas || []) {
    if (!a || !RE_DIA.test(a.data || '') || vistas.has(a.data)) continue;
    if (foraDaContagem(a)) { vistas.add(a.data); continue; }
    const n = contagemDe(a.frequencia);
    if (n == null) continue;
    vistas.add(a.data);
    semanas.push({ data: a.data, n });
  }
  semanas.sort((a, b) => a.data.localeCompare(b.data));
  const pct = media => (media != null && membros > 0 ? Math.round(media / membros * 100) : null);
  const media = l => (l.length ? Math.round(l.reduce((s, x) => s + x.n, 0) / l.length) : null);
  const porMes = [];
  const inicio = somarMeses(String(hoje).slice(0, 7) + '-01', -(meses - 1));
  for (let k = 0; k < meses; k++) {
    const mes = somarMeses(inicio, k).slice(0, 7);
    const doMes = semanas.filter(s => s.data.startsWith(mes));
    porMes.push({ mes, semanas: doMes, media: media(doMes), pct: pct(media(doMes)) });
  }
  const porAno = {};
  for (const ano of [...new Set(semanas.map(s => s.data.slice(0, 4)))]) {
    const doAno = semanas.filter(s => s.data.startsWith(ano));
    porAno[ano] = { media: media(doAno), pct: pct(media(doAno)), semanas: doAno.length };
  }
  return { porMes, porAno };
}

// A linha dos anos: o % informado de cada ano (historicoSacramental, digitado uma
// vez a partir do LCR) e, no ano corrente, o calculado das atas — que é o que se
// está construindo agora. Um ano passado sem o % informado só sai das atas com
// meio ano de domingos contados (MIN_SEMANAS_ANO): a média de 2 domingos de
// dezembro sobre o total de membros de hoje, ao lado de anos inteiros do LCR,
// parecia o ano. → [{ ano, pct, fonte: 'informado'|'calculado', semanas? (no calculado) }]
export const MIN_SEMANAS_ANO = 26;
export function historicoSacramental(informado, porAno, anoAtual = +dataLocal().slice(0, 4)) {
  const anos = new Set([...Object.keys(informado || {}), ...Object.keys(porAno || {})]);
  return [...anos].sort().map(ano => {
    const calc = porAno?.[ano]?.pct, semanas = porAno?.[ano]?.semanas || 0;
    const inf = informado?.[ano];
    const vale = +ano === anoAtual || (!Number.isFinite(inf) && semanas >= MIN_SEMANAS_ANO);
    if (vale && Number.isFinite(calc)) return { ano: +ano, pct: calc, fonte: 'calculado', semanas };
    return Number.isFinite(inf) ? { ano: +ano, pct: inf, fonte: 'informado' } : null;
  }).filter(Boolean);
}

// ---------- frequência às classes: a tendência de cada grupo ----------
// semanas: as guardadas (frequenciaClasses.semanas), de vários meses. Compara a
// taxa dos `janela` últimos domingos COM REUNIÃO do grupo com a dos `janela`
// anteriores. No horário de duas horas, a Escola Dominical se reúne num domingo
// e os quóruns, a Sociedade de Socorro, as Moças e os Rapazes no outro — e o
// LCR desenha o anel de ausente para todo matriculado em TODOS os domingos. O
// domingo em que o grupo inteiro tem 0 presenças é "sem reunião (ou não
// marcado)": fica fora da série e das taxas — com ele, a manchete mostrava
// metade da frequência, e a seta virava conforme a janela pegava um domingo
// com aula a mais.
// → [{ grupo, rotulo, serie: [{ data, presentes, matriculados, taxa }] (só os com
//      presença), matriculados (o do último domingo), semReuniao (os domingos de
//      0 presenças), taxaRecente, taxaAnterior, variacao (pontos percentuais),
//      direcao: 'sobe'|'desce'|'estavel'|null }]
// O grupo com matriculados e NENHUMA presença em domingo nenhum continua na
// lista (serie vazia, taxaRecente 0): é o "quase ninguém marcado" de gruposSemMarcacao.
export function tendenciaPorGrupo(semanas, { janela = 4, limiar = 3 } = {}) {
  const regs = (semanas || []).filter(s => s && s.registrada && RE_DIA.test(s.data || '')).sort((a, b) => a.data.localeCompare(b.data));
  const taxa = l => {
    const m = l.reduce((s, x) => s + x.matriculados, 0);
    return m ? l.reduce((s, x) => s + x.presentes, 0) / m : null;
  };
  return GRUPOS_CLASSE.map(({ chave, rotulo }) => {
    const todos = regs.map(s => {
      const g = s.porGrupo?.[chave];
      return g && g.matriculados > 0 ? { data: s.data, presentes: g.presentes, matriculados: g.matriculados, taxa: g.presentes / g.matriculados } : null;
    }).filter(Boolean);
    if (!todos.length) return null;
    const serie = todos.filter(s => s.presentes > 0);
    const base = { grupo: chave, rotulo, serie, matriculados: todos.at(-1).matriculados, semReuniao: todos.length - serie.length };
    if (!serie.length) return { ...base, taxaRecente: 0, taxaAnterior: null, variacao: null, direcao: null };
    const rec = serie.slice(-janela), ant = serie.slice(-2 * janela, -janela);
    const taxaRecente = taxa(rec), taxaAnterior = ant.length ? taxa(ant) : null;
    const variacao = taxaAnterior == null ? null : Math.round((taxaRecente - taxaAnterior) * 100);
    const direcao = variacao == null ? null : variacao >= limiar ? 'sobe' : variacao <= -limiar ? 'desce' : 'estavel';
    return { ...base, taxaRecente, taxaAnterior, variacao, direcao };
  }).filter(Boolean);
}

// ---------- o documento do servidor (/api/crescimento) ----------
// Um documento só, em duas partes:
//   publico — contagens (os relatórios, as médias): vai para quem abre o app;
//   privado — o que é de cada pessoa (a lista das recomendações) e o que só o
//             bispo sabe (os portadores dizimistas), mais os participantes
//             calculados a partir disso: só sai com a sessão de Bispo ou ADM.
// O POST manda só as seções que mudaram ({ publico: {…}, privado: {…} }) e o
// servidor JUNTA (fundirCrescimento): importar o Trimestral não apaga as
// recomendações, e um mês de frequência não apaga os outros. Tudo passa por
// limparCorpoCrescimento: só as chaves conhecidas, do tipo e tamanho certos — um
// campo errado recusa o corpo inteiro (400), em vez de gravar meio relatório.
export const MAX_TEXTO = 300;
export const MAX_PESSOAS = 2000;
export const MAX_SEMANAS_CLASSES = 160;   // ~3 anos de domingos
export const MAX_TRIMESTRES = 40;         // 10 anos
export const MAX_LINHAS_TRIMESTRAL = 60;

const vazioPublico = () => ({
  trimestral: {}, estatisticas: null, recomendacoes: { adultos: null, jovens: null },
  frequenciaClasses: { semanas: [] }, historicoSacramental: {}, importadoEm: {}, atualizadoEm: null,
});
const vazioPrivado = () => ({
  recomendacoesPessoas: { adultos: [], jovens: [] }, portadoresAtivosDizimistas: null,
  participantes: { adultos: null, jovens: null }, importadoEm: {}, atualizadoEm: null,
});
export const docCrescimentoVazio = () => ({ publico: vazioPublico(), privado: vazioPrivado() });

const RE_DIA = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const RE_MES = /^\d{4}-(0[1-9]|1[0-2])$/;
const RE_ANO = /^(19|20)\d{2}$/;
const RE_SLUG = /^[a-z0-9-]{0,30}$/;
const ehObjeto = v => !!v && typeof v === 'object' && !Array.isArray(v);
const textoOk = (v, max = MAX_TEXTO) => v === undefined || (typeof v === 'string' && v.length <= max);
const inteiroOk = (v, max = 1e6) => Number.isInteger(v) && v >= 0 && v <= max;
const numeroOuNulo = (v, max = 1e6) => v === null || v === undefined || (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max);
const limpo = v => (v || '').replace(/\s+/g, ' ').trim();
const nulo = v => (v === undefined ? null : v);
const diaOk = v => v === undefined || v === '' || (typeof v === 'string' && RE_DIA.test(v));

// Cada limpador: (valor, onde) → { v } ou { erro }
function limparTrimestral(t, onde) {
  if (!ehObjeto(t)) return { erro: `${onde}: objeto esperado` };
  for (const k of ['ala', 'unidade']) if (!textoOk(t[k])) return { erro: `${onde}.${k}: texto de até ${MAX_TEXTO} caracteres` };
  if (!inteiroOk(t.trimestre, 4) || t.trimestre < 1) return { erro: `${onde}.trimestre: de 1 a 4` };
  if (!inteiroOk(t.ano, 2100) || t.ano < 2000) return { erro: `${onde}.ano: de 2000 a 2100` };
  if (!diaOk(t.data)) return { erro: `${onde}.data: AAAA-MM-DD ou vazio` };
  if (!Array.isArray(t.linhas) || t.linhas.length > MAX_LINHAS_TRIMESTRAL) return { erro: `${onde}.linhas: lista de até ${MAX_LINHAS_TRIMESTRAL}` };
  const linhas = [];
  for (const [i, l] of t.linhas.entries()) {
    const o = `${onde}.linhas[${i}]`;
    if (!ehObjeto(l)) return { erro: `${o}: objeto esperado` };
    if (!inteiroOk(l.n, 99) || l.n < 1) return { erro: `${o}.n: de 1 a 99` };
    if (!textoOk(l.rotulo)) return { erro: `${o}.rotulo: texto de até ${MAX_TEXTO} caracteres` };
    if (l.secao !== undefined && l.secao !== '' && !CHAVES_SECAO.includes(l.secao)) return { erro: `${o}.secao: desconhecida` };
    for (const k of ['real', 'potencial', 'pct', 'pctAnoAnterior', 'pct5Anos']) {
      if (!numeroOuNulo(l[k])) return { erro: `${o}.${k}: número ou null` };
    }
    linhas.push({ n: l.n, secao: l.secao || '', rotulo: limpo(l.rotulo), real: nulo(l.real), potencial: nulo(l.potencial), pct: nulo(l.pct), pctAnoAnterior: nulo(l.pctAnoAnterior), pct5Anos: nulo(l.pct5Anos) });
  }
  return { v: { ala: limpo(t.ala), unidade: limpo(t.unidade), trimestre: t.trimestre, ano: t.ano, data: t.data || '', linhas } };
}

function limparEstatisticas(e, onde) {
  if (!ehObjeto(e)) return { erro: `${onde}: objeto esperado` };
  for (const k of ['ala', 'unidade']) if (!textoOk(e[k])) return { erro: `${onde}.${k}: texto de até ${MAX_TEXTO} caracteres` };
  if (!diaOk(e.data)) return { erro: `${onde}.data: AAAA-MM-DD ou vazio` };
  if (!ehObjeto(e.valores)) return { erro: `${onde}.valores: objeto esperado` };
  const valores = {};
  for (const k of CHAVES_ESTATISTICAS) {
    if (e.valores[k] === undefined) continue;
    if (!inteiroOk(e.valores[k])) return { erro: `${onde}.valores.${k}: inteiro` };
    valores[k] = e.valores[k];
  }
  const outros = [];
  if (e.outros !== undefined) {
    if (!Array.isArray(e.outros) || e.outros.length > 60) return { erro: `${onde}.outros: lista de até 60` };
    for (const [i, o] of e.outros.entries()) {
      if (!ehObjeto(o) || !textoOk(o.rotulo) || !inteiroOk(o.valor)) return { erro: `${onde}.outros[${i}]: { rotulo, valor }` };
      outros.push({ rotulo: limpo(o.rotulo), valor: o.valor });
    }
  }
  return { v: { ala: limpo(e.ala), unidade: limpo(e.unidade), data: e.data || '', valores, outros } };
}

// { chave: inteiro } com a chave no formato certo
function limparContagens(obj, re, max, onde) {
  if (obj === undefined) return { v: {} };
  if (!ehObjeto(obj) || Object.keys(obj).length > max) return { erro: `${onde}: objeto de até ${max} chaves` };
  const v = {};
  for (const [k, n] of Object.entries(obj)) {
    if (!re.test(k) || !inteiroOk(n)) return { erro: `${onde}.${k}: chave ou número inválido` };
    v[k] = n;
  }
  return { v };
}

function limparResumoRecomendacoes(r, tipo, onde) {
  if (r === null) return { v: null };
  if (!ehObjeto(r)) return { erro: `${onde}: objeto ou null` };
  if (r.tipo !== undefined && r.tipo !== tipo) return { erro: `${onde}.tipo: ${tipo} esperado` };
  if (!diaOk(r.data)) return { erro: `${onde}.data: AAAA-MM-DD ou vazio` };
  if (!(r.contagem === null || r.contagem === undefined || inteiroOk(r.contagem))) return { erro: `${onde}.contagem: inteiro ou null` };
  for (const k of ['lidos', 'semSituacao']) if (!(r[k] === undefined || inteiroOk(r[k]))) return { erro: `${onde}.${k}: inteiro` };
  if (!(r.validasNaFaixa === undefined || r.validasNaFaixa === null || inteiroOk(r.validasNaFaixa))) return { erro: `${onde}.validasNaFaixa: inteiro ou null` };
  const porSituacao = limparContagens(r.porSituacao, /^[a-z0-9][a-z0-9-]{0,29}$/, 20, `${onde}.porSituacao`);
  const porMes = limparContagens(r.porMesValidade, RE_MES, 240, `${onde}.porMesValidade`);
  const vencidas = limparContagens(r.vencidasPorAno, RE_ANO, 100, `${onde}.vencidasPorAno`);
  for (const x of [porSituacao, porMes, vencidas]) if (x.erro) return x;
  const porFaixa = [];
  if (r.porFaixa !== undefined) {
    if (!Array.isArray(r.porFaixa) || r.porFaixa.length > 10) return { erro: `${onde}.porFaixa: lista de até 10` };
    for (const [i, f] of r.porFaixa.entries()) {
      if (!ehObjeto(f) || !textoOk(f.faixa, 20) || !inteiroOk(f.de, 200) || !inteiroOk(f.ate, 200) || !inteiroOk(f.total) || !inteiroOk(f.ativas)) {
        return { erro: `${onde}.porFaixa[${i}]: { faixa, de, ate, total, ativas }` };
      }
      porFaixa.push({ faixa: limpo(f.faixa), de: f.de, ate: f.ate, total: f.total, ativas: f.ativas });
    }
  }
  const porSexo = {};
  if (r.porSexo !== undefined) {
    if (!ehObjeto(r.porSexo)) return { erro: `${onde}.porSexo: objeto` };
    for (const [s, g] of Object.entries(r.porSexo)) {
      if (!['F', 'M'].includes(s) || !ehObjeto(g) || !inteiroOk(g.total) || !inteiroOk(g.ativas)) return { erro: `${onde}.porSexo.${s}: { total, ativas }` };
      porSexo[s] = { total: g.total, ativas: g.ativas };
    }
  }
  return { v: {
    tipo, data: r.data || '', contagem: nulo(r.contagem), lidos: r.lidos || 0, porSituacao: porSituacao.v,
    semSituacao: r.semSituacao || 0, porMesValidade: porMes.v, vencidasPorAno: vencidas.v, porFaixa, porSexo,
    validasNaFaixa: nulo(r.validasNaFaixa),
  } };
}

function limparPessoas(lista, onde) {
  if (!Array.isArray(lista) || lista.length > MAX_PESSOAS) return { erro: `${onde}: lista de até ${MAX_PESSOAS}` };
  const v = [];
  for (const [i, p] of lista.entries()) {
    const o = `${onde}[${i}]`;
    if (!ehObjeto(p)) return { erro: `${o}: objeto esperado` };
    if (typeof p.nome !== 'string' || !limpo(p.nome) || p.nome.length > 150) return { erro: `${o}.nome: texto de 1 a 150 caracteres` };
    if (!(p.sexo === undefined || ['', 'M', 'F'].includes(p.sexo))) return { erro: `${o}.sexo: M, F ou vazio` };
    if (!(p.idade === undefined || p.idade === null || inteiroOk(p.idade, 130))) return { erro: `${o}.idade: de 0 a 130 ou null` };
    if (!(p.situacao === undefined || (typeof p.situacao === 'string' && RE_SLUG.test(p.situacao)))) return { erro: `${o}.situacao: inválida` };
    if (!(p.validade === undefined || p.validade === '' || (typeof p.validade === 'string' && RE_MES.test(p.validade)))) return { erro: `${o}.validade: AAAA-MM ou vazio` };
    v.push({ nome: limpo(p.nome), sexo: p.sexo || '', idade: nulo(p.idade), situacao: p.situacao || '', validade: p.validade || '' });
  }
  return { v };
}

function limparSemanas(f, onde) {
  if (!ehObjeto(f) || !Array.isArray(f.semanas) || f.semanas.length > MAX_SEMANAS_CLASSES) return { erro: `${onde}.semanas: lista de até ${MAX_SEMANAS_CLASSES}` };
  const v = [];
  for (const [i, s] of f.semanas.entries()) {
    const o = `${onde}.semanas[${i}]`;
    if (!ehObjeto(s) || typeof s.data !== 'string' || !RE_DIA.test(s.data)) return { erro: `${o}.data: AAAA-MM-DD` };
    if (!ehObjeto(s.porGrupo)) return { erro: `${o}.porGrupo: objeto esperado` };
    const porGrupo = {};
    for (const [g, n] of Object.entries(s.porGrupo)) {
      if (!CHAVES_GRUPO.includes(g)) return { erro: `${o}.porGrupo.${g}: grupo desconhecido` };
      if (!ehObjeto(n) || !inteiroOk(n.presentes, 10000) || !inteiroOk(n.matriculados, 10000) || n.presentes > n.matriculados) {
        return { erro: `${o}.porGrupo.${g}: { presentes ≤ matriculados }` };
      }
      porGrupo[g] = { presentes: n.presentes, matriculados: n.matriculados };
    }
    if (!(s.registrada === undefined || typeof s.registrada === 'boolean')) return { erro: `${o}.registrada: verdadeiro ou falso` };
    const presentes = Object.values(porGrupo).reduce((t, n) => t + n.presentes, 0);
    v.push({ data: s.data, porGrupo, registrada: s.registrada === undefined ? presentes > 0 : s.registrada });
  }
  return { v };
}

// corpo { publico?: {...}, privado?: {...} } → { parcial } ou { erro }.
// Seções aceitas:
//   publico.trimestral (UM trimestre), publico.estatisticas, publico.recomendacoes
//   ({ adultos?, jovens? }: o resumo), publico.frequenciaClasses ({ semanas }),
//   publico.historicoSacramental ({ AAAA: % ou null — null apaga o ano });
//   privado.recomendacoesPessoas ({ adultos?, jovens? }), privado.portadoresAtivosDizimistas
//   (número ou null), privado.participantes ({ adultos?, jovens? }: número ou null).
// O resto é ignorado. Datas de gravação são de quem grava (o servidor).
export function limparCorpoCrescimento(corpo) {
  if (!ehObjeto(corpo)) return { erro: 'corpo: objeto esperado' };
  const parcial = { publico: {}, privado: {} };
  const pub = corpo.publico, pri = corpo.privado;
  if (pub !== undefined && !ehObjeto(pub)) return { erro: 'publico: objeto esperado' };
  if (pri !== undefined && !ehObjeto(pri)) return { erro: 'privado: objeto esperado' };

  if (pub?.trimestral !== undefined) {
    const r = limparTrimestral(pub.trimestral, 'publico.trimestral');
    if (r.erro) return r;
    parcial.publico.trimestral = r.v;
  }
  if (pub?.estatisticas !== undefined) {
    const r = limparEstatisticas(pub.estatisticas, 'publico.estatisticas');
    if (r.erro) return r;
    parcial.publico.estatisticas = r.v;
  }
  if (pub?.recomendacoes !== undefined) {
    if (!ehObjeto(pub.recomendacoes)) return { erro: 'publico.recomendacoes: objeto esperado' };
    parcial.publico.recomendacoes = {};
    for (const tipo of ['adultos', 'jovens']) {
      if (pub.recomendacoes[tipo] === undefined) continue;
      const r = limparResumoRecomendacoes(pub.recomendacoes[tipo], tipo, `publico.recomendacoes.${tipo}`);
      if (r.erro) return r;
      parcial.publico.recomendacoes[tipo] = r.v;
    }
  }
  if (pub?.frequenciaClasses !== undefined) {
    const r = limparSemanas(pub.frequenciaClasses, 'publico.frequenciaClasses');
    if (r.erro) return r;
    parcial.publico.frequenciaClasses = { semanas: r.v };
  }
  if (pub?.historicoSacramental !== undefined) {
    const h = pub.historicoSacramental;
    if (!ehObjeto(h) || Object.keys(h).length > 50) return { erro: 'publico.historicoSacramental: objeto de até 50 anos' };
    const v = {};
    for (const [ano, pct] of Object.entries(h)) {
      if (!RE_ANO.test(ano) || !(pct === null || numeroOuNulo(pct, 100))) return { erro: `publico.historicoSacramental.${ano}: % de 0 a 100 ou null` };
      v[ano] = pct;
    }
    parcial.publico.historicoSacramental = v;
  }

  if (pri?.recomendacoesPessoas !== undefined) {
    if (!ehObjeto(pri.recomendacoesPessoas)) return { erro: 'privado.recomendacoesPessoas: objeto esperado' };
    parcial.privado.recomendacoesPessoas = {};
    for (const tipo of ['adultos', 'jovens']) {
      if (pri.recomendacoesPessoas[tipo] === undefined) continue;
      const r = limparPessoas(pri.recomendacoesPessoas[tipo], `privado.recomendacoesPessoas.${tipo}`);
      if (r.erro) return r;
      parcial.privado.recomendacoesPessoas[tipo] = r.v;
    }
  }
  if (pri?.portadoresAtivosDizimistas !== undefined) {
    const n = pri.portadoresAtivosDizimistas;
    if (!(n === null || inteiroOk(n, 10000))) return { erro: 'privado.portadoresAtivosDizimistas: inteiro ou null' };
    parcial.privado.portadoresAtivosDizimistas = n;
  }
  if (pri?.participantes !== undefined) {
    if (!ehObjeto(pri.participantes)) return { erro: 'privado.participantes: objeto esperado' };
    parcial.privado.participantes = {};
    for (const k of ['adultos', 'jovens']) {
      const n = pri.participantes[k];
      if (n === undefined) continue;
      if (!(n === null || inteiroOk(n, 100000))) return { erro: `privado.participantes.${k}: inteiro ou null` };
      parcial.privado.participantes[k] = n;
    }
  }
  return { parcial };
}

// Junta as semanas novas nas guardadas, por data. Uma semana sem registro (o
// domingo que ainda não chegou, todo vazio) não apaga a que já tinha presenças.
function juntarSemanas(antigas, novas) {
  const porData = new Map((antigas || []).map(s => [s.data, s]));
  for (const s of novas || []) {
    const atual = porData.get(s.data);
    if (!atual || s.registrada || !atual.registrada) porData.set(s.data, s);
  }
  return [...porData.values()].sort((a, b) => a.data.localeCompare(b.data)).slice(-MAX_SEMANAS_CLASSES);
}

// O documento guardado (ou null, antes da 1ª importação) → o mesmo com as
// faltas preenchidas; null se não tiver a forma esperada (o GET responde 500 —
// falha de leitura não pode virar "não há nada importado")
export function normalizarDocCrescimento(data) {
  if (data == null) return docCrescimentoVazio();
  if (!ehObjeto(data) || (data.publico !== undefined && !ehObjeto(data.publico)) || (data.privado !== undefined && !ehObjeto(data.privado))) return null;
  const v = docCrescimentoVazio();
  const pub = { ...v.publico, ...(data.publico || {}) }, pri = { ...v.privado, ...(data.privado || {}) };
  pub.recomendacoes = { ...v.publico.recomendacoes, ...(ehObjeto(pub.recomendacoes) ? pub.recomendacoes : {}) };
  pub.frequenciaClasses = ehObjeto(pub.frequenciaClasses) && Array.isArray(pub.frequenciaClasses.semanas) ? pub.frequenciaClasses : { semanas: [] };
  for (const k of ['trimestral', 'historicoSacramental', 'importadoEm']) if (!ehObjeto(pub[k])) pub[k] = {};
  pri.recomendacoesPessoas = { ...v.privado.recomendacoesPessoas, ...(ehObjeto(pri.recomendacoesPessoas) ? pri.recomendacoesPessoas : {}) };
  pri.participantes = { ...v.privado.participantes, ...(ehObjeto(pri.participantes) ? pri.participantes : {}) };
  if (!ehObjeto(pri.importadoEm)) pri.importadoEm = {};
  return { publico: pub, privado: pri };
}

// atual: o documento guardado (normalizado); parcial: o de limparCorpoCrescimento.
// → o documento novo. Cada seção recebida troca só a si mesma: o trimestre pela
// chave dele (os outros ficam no histórico), as semanas por data, as
// recomendações pelo tipo, o histórico da sacramental por ano.
export function fundirCrescimento(atual, parcial, agora = new Date().toISOString()) {
  const doc = normalizarDocCrescimento(atual) || docCrescimentoVazio();
  const pub = { ...doc.publico, importadoEm: { ...doc.publico.importadoEm } };
  const pri = { ...doc.privado, importadoEm: { ...doc.privado.importadoEm } };
  const p = parcial?.publico || {}, q = parcial?.privado || {};
  let mudouPub = false, mudouPri = false;
  const marca = (alvo, secao) => { alvo.importadoEm[secao] = agora; };

  if (p.trimestral) {
    const chaves = { ...pub.trimestral, [chaveTrimestre(p.trimestral)]: p.trimestral };
    pub.trimestral = Object.fromEntries(Object.keys(chaves).sort().slice(-MAX_TRIMESTRES).map(k => [k, chaves[k]]));
    marca(pub, 'trimestral'); mudouPub = true;
  }
  if (p.estatisticas) { pub.estatisticas = p.estatisticas; marca(pub, 'estatisticas'); mudouPub = true; }
  if (p.recomendacoes) {
    pub.recomendacoes = { ...pub.recomendacoes };
    for (const tipo of Object.keys(p.recomendacoes)) { pub.recomendacoes[tipo] = p.recomendacoes[tipo]; marca(pub, 'recomendacoes-' + tipo); mudouPub = true; }
  }
  if (p.frequenciaClasses) {
    pub.frequenciaClasses = { semanas: juntarSemanas(pub.frequenciaClasses.semanas, p.frequenciaClasses.semanas) };
    marca(pub, 'frequenciaClasses'); mudouPub = true;
  }
  if (p.historicoSacramental) {
    const h = { ...pub.historicoSacramental };
    for (const [ano, pct] of Object.entries(p.historicoSacramental)) { if (pct === null) delete h[ano]; else h[ano] = pct; }
    pub.historicoSacramental = h;
    marca(pub, 'historicoSacramental'); mudouPub = true;
  }

  if (q.recomendacoesPessoas) {
    pri.recomendacoesPessoas = { ...pri.recomendacoesPessoas };
    for (const tipo of Object.keys(q.recomendacoesPessoas)) { pri.recomendacoesPessoas[tipo] = q.recomendacoesPessoas[tipo]; marca(pri, 'recomendacoesPessoas-' + tipo); mudouPri = true; }
  }
  if (q.portadoresAtivosDizimistas !== undefined) { pri.portadoresAtivosDizimistas = q.portadoresAtivosDizimistas; marca(pri, 'portadoresAtivosDizimistas'); mudouPri = true; }
  if (q.participantes) {
    pri.participantes = { ...pri.participantes, ...q.participantes };
    marca(pri, 'participantes'); mudouPri = true;
  }
  if (mudouPub) pub.atualizadoEm = agora;
  if (mudouPri) pri.atualizadoEm = agora;
  return { publico: pub, privado: pri };
}

// O que o GET entrega: a parte pública para todos; a privada só com a sessão.
// null se o guardado não tem a forma esperada — o GET responde 500, e não um
// documento vazio que a tela leria como "nada importado ainda"
export function respostaCrescimento(doc, veSigilo) {
  const d = normalizarDocCrescimento(doc);
  if (!d) return null;
  return veSigilo ? { publico: d.publico, privado: d.privado } : { publico: d.publico };
}

// O POST do servidor (netlify/functions/crescimento.js): atual = o guardado (ou null); corpo = o que
// chegou. → { status: 200, doc } ou { status: 400 | 500, erro }. Corpo sem
// nenhuma seção conhecida é recusado: "nada a gravar" não pode virar uma
// escrita nem um atualizadoEm novo. Guardado sem a forma esperada é 500 — gravar
// por cima apagaria o que lá estiver.
export const MAX_CORPO_CRESCIMENTO = 1500000;   // caracteres: 2000 pessoas cabem com folga
export function aplicarPostCrescimento(atual, corpo, agora = new Date().toISOString()) {
  const r = limparCorpoCrescimento(corpo);
  if (r.erro) return { status: 400, erro: r.erro };
  if (!Object.keys(r.parcial.publico).length && !Object.keys(r.parcial.privado).length) return { status: 400, erro: 'nenhuma seção para gravar' };
  const doc = normalizarDocCrescimento(atual);
  if (!doc) return { status: 500, erro: 'Conteúdo inesperado em crescimento' };
  return { status: 200, doc: fundirCrescimento(doc, r.parcial, agora) };
}

// ---------- o que a aba desenha (contas sem DOM) ----------
// A pirâmide do quadro de membros: homens e mulheres por faixa, da mais velha
// (no alto) para a mais nova. As faixas seguem as organizações: berçário,
// Primária, jovens, jovens adultos solteiros e os adultos em três.
export const FAIXAS_PIRAMIDE = [
  ['0–2', 0, 2], ['3–11', 3, 11], ['12–17', 12, 17], ['18–30', 18, 30],
  ['31–45', 31, 45], ['46–60', 46, 60], ['61–75', 61, 75], ['76+', 76, 200],
];
const idadeDe = v => (typeof v === 'number' ? v : /^\s*\d{1,3}\s*$/.test(String(v ?? '')) ? +v : NaN);
// membros: o quadro ({ gender, age }). → { faixas: [{ faixa, m, f }], semIdade }
// (semIdade: sem idade ou sem sexo — fica de fora, e a tela diz quantos)
export function piramideEtaria(membros, faixas = FAIXAS_PIRAMIDE) {
  const out = faixas.map(([faixa, de, ate]) => ({ faixa, de, ate, m: 0, f: 0 }));
  let semIdade = 0;
  for (const p of membros || []) {
    const a = idadeDe(p?.age);
    const f = Number.isFinite(a) ? out.find(x => a >= x.de && a <= x.ate) : null;
    if (!f || (p.gender !== 'M' && p.gender !== 'F')) { semIdade++; continue; }
    f[p.gender === 'M' ? 'm' : 'f']++;
  }
  return { faixas: out.reverse(), semIdade };
}

// As recomendações válidas que vencem em cada um dos `meses` meses a partir de
// `desde` ('AAAA-MM') — o trabalho do secretário executivo no ano. `antes`: as
// que o relatório ainda dava como válidas, mas com validade anterior a `desde`
// (o relatório é antigo: elas já venceram).
export function vencimentosPorMes(resumo, { desde, meses = 12 } = {}) {
  const base = (RE_MES.test(desde || '') ? desde : dataLocal().slice(0, 7)) + '-01';
  const lista = Array.from({ length: meses }, (_, k) => {
    const mes = somarMeses(base, k).slice(0, 7);
    return { mes, n: resumo?.porMesValidade?.[mes] || 0 };
  });
  let antes = 0;
  for (const [mes, n] of Object.entries(resumo?.porMesValidade || {})) if (mes < base.slice(0, 7)) antes += n;
  return { meses: lista, antes };
}

// As renovações a fazer contadas SEM os nomes (a parte pública): as válidas que
// vencem até daqui a `meses` e as já vencidas. A "Para vencer" do LCR já está
// no prazo; sem a lista por pessoa não dá para separá-la das ativas do mesmo
// mês, então vale a maior das duas contas — o mesmo número de renovacoesAgendar
// sempre que a "Para vencer" vence dentro do prazo (que é o que ela quer dizer).
export function renovacoesResumo(resumo, { hoje = dataLocal(), meses = 2 } = {}) {
  const ate = (somarMeses(hoje, meses) || hoje).slice(0, 7);
  let noPrazo = 0;
  for (const [mes, n] of Object.entries(resumo?.porMesValidade || {})) if (mes <= ate) noPrazo += n;
  return { vencem: Math.max(noPrazo, resumo?.porSituacao?.['para-vencer'] || 0), vencidas: resumo?.porSituacao?.vencida || 0, ate };
}

// Os participantes que dá para provar SEM os nomes das recomendações (sem a
// sessão do bispo): quem tem chamado na faixa (o quadro e os chamados são de
// todos no app) OU quem tem recomendação válida — o maior dos dois, porque sem
// os nomes não se sabe quem está nos dois grupos. Também é um mínimo. As
// válidas são as da faixa de idade (validasNaFaixa); um resumo guardado antes
// dela existir conta todas as válidas da lista.
export function participantesSemNomes({ membros = [], chamados = [], resumo = null } = {}, faixa = 'adultos') {
  const p = (faixa === 'jovens' ? participantesJovens : participantesAdultos)({ membros, chamados });
  const validas = Number.isInteger(resumo?.validasNaFaixa) ? resumo.validasNaFaixa
    : (resumo?.porSituacao?.ativa || 0) + (resumo?.porSituacao?.['para-vencer'] || 0);
  return { total: Math.max(p.porMotivo.chamado, validas), chamado: p.porMotivo.chamado, recomendacao: validas };
}

// Quantos MÍNIMOS de 36.2 se sabe que estão cumpridos, para 1 e 2 alas (o que
// não se sabe não conta nem como cumprido nem como faltando). O recomendado (os
// jovens) fica fora da conta, à parte: recomendados: [{ chave, atual, meta,
// metaDuas, umaAla, duasAlas }] (umaAla/duasAlas null quando não se sabe).
export function resumoQualificacao(progresso) {
  const lista = progresso || [];
  const exigidos = lista.filter(c => !c.recomendado);
  const conhecidos = exigidos.filter(c => c.atual != null);
  return {
    total: exigidos.length, conhecidos: conhecidos.length,
    umaAla: conhecidos.filter(c => c.atual >= c.meta).length,
    duasAlas: conhecidos.filter(c => c.atual >= c.metaDuas).length,
    recomendados: lista.filter(c => c.recomendado).map(c => ({
      chave: c.chave, atual: c.atual, meta: c.meta, metaDuas: c.metaDuas,
      umaAla: c.atual == null ? null : c.atual >= c.meta, duasAlas: c.atual == null ? null : c.atual >= c.metaDuas,
    })),
  };
}

// O cartão do Início em dois números: quantos mínimos já estão cumpridos (o
// resumo acima) e UM critério na barra até uma e duas alas — o dos membros, que
// é o número firme do LCR; sem ele, o primeiro conhecido que não é estimativa
// (a estimativa é um mínimo: a barra dela diria "falta" sem provar) nem o
// número do bispo (o Início é a tela que fica aberta: ele fica na aba).
// → { total, conhecidos, umaAla, duasAlas, recomendados, barra: critério de progressoQualificacao | null }
export function destaqueDoRumo(progresso) {
  const conhecidos = (progresso || []).filter(c => c.atual != null);
  const barra = conhecidos.find(c => c.chave === 'membros') || conhecidos.find(c => !c.estimativa && !c.sigiloso) || null;
  return { ...resumoQualificacao(progresso), barra };
}

// ---------- a grade da frequência sacramental ----------
const contagemDaAta = a => contagemDe(a?.frequencia);
// Os domingos de um mês ('AAAA-MM') para digitar a frequência:
// [{ data, frequencia (o texto gravado), tem (há contagem válida), semReuniao
//   (conferência geral ou de estaca: não há reunião na ala), naoConta (marcado
//   "não contabilizar"), futuro }]
export function gradeFrequencia(atas, mes, hoje = dataLocal()) {
  if (!RE_MES.test(mes || '')) return [];
  const out = [];
  for (let d = 1; d <= 31; d++) {
    const data = `${mes}-${dois(d)}`;
    if (somarDias(data, 0) !== data) break;   // passou do fim do mês
    if (!ehDomingo(data)) continue;
    const ata = registroDoDomingo(atas, data);
    out.push({
      data, frequencia: String(ata?.frequencia ?? '').trim(), tem: contagemDaAta(ata) != null,
      semReuniao: !!tipoDe(ata).semReuniao, naoConta: marcadoSemContagem(ata), futuro: data > hoje,
    });
  }
  return out;
}

// O que a grade grava: só o que mudou, e só número inteiro (ou vazio, que apaga).
// digitado: { data: texto }. desenhado: { data: texto } — o valor de cada campo
// quando a grade foi DESENHADA (o defaultValue). A grade congela enquanto alguém
// digita: comparar com as atas de agora fazia o domingo gravado depois (em outra
// aba ou em outro aparelho) parecer "mudado aqui", e o valor velho da tela ia
// por cima — apagava a contagem. Com `desenhado`, só vai o campo que a pessoa
// mexeu; e se a ata também mudou desde o desenho, ele vem em `conflitos`.
// O "0" não é contagem (contagemDe só aceita > 0: o domingo continuava "sem
// contagem"): vai em `zeros` — o domingo sem reunião se marca no tipo da ata.
// teto: o número acima do qual a contagem é suspeita (o total de membros):
// as datas vão em `acima`, para a tela confirmar ("1500" em vez de "150").
// → { mudancas: [{ data, frequencia }], invalidos: [data], zeros: [data],
//     acima: [data], conflitos: [{ data, atual, novo }] }
export function mudancasDaGrade(grade, digitado, { desenhado = null, teto = null } = {}) {
  const mudancas = [], invalidos = [], zeros = [], acima = [], conflitos = [];
  const tem = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);
  const igual = (a, b) => (/^\d+$/.test(a) && /^\d+$/.test(b) ? +a === +b : a === b);
  for (const g of grade || []) {
    if (g.semReuniao || g.naoConta || g.futuro || !tem(digitado, g.data)) continue;
    const v = String(digitado[g.data] ?? '').trim();
    const antes = tem(desenhado, g.data) ? String(desenhado[g.data] ?? '').trim() : g.frequencia;
    if (igual(v, antes)) continue;   // a pessoa não mexeu neste campo
    if (v && !/^\d{1,5}$/.test(v)) { invalidos.push(g.data); continue; }
    if (v && +v === 0) { zeros.push(g.data); continue; }
    const novo = v ? String(+v) : '';
    if (novo === g.frequencia) continue;
    if (!igual(antes, g.frequencia)) conflitos.push({ data: g.data, atual: g.frequencia, novo });
    if (novo && Number.isFinite(teto) && teto > 0 && +novo > teto) acima.push(g.data);
    mudancas.push({ data: g.data, frequencia: novo });
  }
  return { mudancas, invalidos, zeros, acima, conflitos };
}

// Os domingos que já passaram (das `semanas` mais recentes, sem o de hoje — a
// reunião pode ainda não ter acontecido) sem a frequência anotada, fora as
// conferências. Em ordem, do mais antigo ao mais recente.
export function domingosSemFrequencia(atas, { hoje = dataLocal(), semanas = 8 } = {}) {
  const dia = RE_DIA.test(hoje || '') ? new Date(+hoje.slice(0, 4), +hoje.slice(5, 7) - 1, +hoje.slice(8, 10)).getDay() : 0;
  const ultimo = somarDias(hoje, -(dia || 7));
  const out = [];
  for (let k = 0; k < semanas && ultimo; k++) {
    const data = somarDias(ultimo, -7 * k);
    const ata = registroDoDomingo(atas, data);
    if (foraDaContagem(ata) || contagemDaAta(ata) != null) continue;
    out.push(data);
  }
  return out.reverse();
}

// O % de cada ano, digitado uma vez a partir do LCR (ex.: "37" em 2022), para
// gravar: { 'AAAA': texto } → { valores: { AAAA: % ou null (vazio apaga) }, invalidos: [ano] }
export function historicoDigitado(digitado) {
  const valores = {}, invalidos = [];
  for (const [ano, txt] of Object.entries(digitado || {})) {
    if (!RE_ANO.test(ano)) continue;
    const v = String(txt ?? '').trim().replace(/%$/, '').trim().replace(',', '.');
    if (!v) { valores[ano] = null; continue; }
    const n = /^\d{1,3}(\.\d+)?$/.test(v) ? Number(v) : NaN;
    if (!Number.isFinite(n) || n > 100) { invalidos.push(ano); continue; }
    valores[ano] = Math.round(n * 10) / 10;
  }
  return { valores, invalidos };
}

// ---------- frequência às classes: o que provavelmente não está sendo marcado ----------
// Grupo grande com quase ninguém marcado nas semanas recentes: é mais provável
// que a frequência não esteja sendo registrada no LCR do que a classe estar vazia.
export function gruposSemMarcacao(tendencias, { minimo = 15, taxa = 0.05 } = {}) {
  return (tendencias || []).filter(t => {
    const m = t.matriculados ?? t.serie.at(-1)?.matriculados;
    return m >= minimo && t.taxaRecente != null && t.taxaRecente < taxa;
  }).map(t => t.grupo);
}

// ---------- próximos passos ----------
// A lista curta, em ordem de prioridade, do que dá para fazer agora — só com
// contagens, nenhum nome (o Início também pode mostrá-la). Cada item diz para
// onde levar: uma aba (e o filtro dela) ou uma seção desta aba.
// → [{ id, prioridade (1 primeiro), icone, texto, detalhe, aba?, filtro?, secao? }]
export const DIAS_RELATORIO_VELHO = 75;   // relatório mais velho que isto pede uma importação nova
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const mesCurto = am => (RE_MES.test(am || '') ? `${MESES_CURTOS[+am.slice(5, 7) - 1]}/${am.slice(0, 4)}` : '');
const emLista = itens => itens.join(', ').replace(/, ([^,]*)$/, ' e $1');

export function proximosPassos({
  hoje = dataLocal(), publico = null, privado = null, chamados = [], chamadosCarregados = false,
  domingosSemContagem = [], sessao = false,
} = {}) {
  const pub = publico || docCrescimentoVazio().publico;
  const passos = [];
  const add = p => passos.push(p);
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

  // recomendações para o templo
  for (const [tipo, quem] of [['adultos', 'de adultos'], ['jovens', 'de jovens']]) {
    const r = pub.recomendacoes?.[tipo];
    if (!r) continue;
    const { vencem, vencidas, ate } = renovacoesResumo(r, { hoje });
    if (vencem) {
      add({ id: 'renovar-' + tipo, prioridade: 1, icone: '📅', secao: 'cresc-recomendacoes',
        texto: `${plural(vencem, `recomendação ${quem} vence`, `recomendações ${quem} vencem`)} até ${mesCurto(ate)}`,
        detalhe: 'Agendar a renovação antes de vencer poupa a espera de quem vai ao templo.' });
    }
    if (vencidas) {
      add({ id: 'vencidas-' + tipo, prioridade: 2, icone: '🛕', secao: 'cresc-recomendacoes',
        texto: plural(vencidas, `recomendação ${quem} já venceu`, `recomendações ${quem} já venceram`),
        detalhe: 'Um convite para renovar é um bom motivo para uma visita.' });
    }
  }

  // chamados (só com o relatório carregado: lista vazia antes da carga é "não sei")
  if (chamadosCarregados && chamados.length) {
    const n = chamados.filter(aDesignar).length;
    if (n) add({ id: 'designar', prioridade: 1, icone: '🤲', aba: 'chamados', filtro: 'a-designar',
      texto: `${plural(n, 'chamado apoiado aguarda', 'chamados apoiados aguardam')} a designação`,
      detalhe: 'Quem foi apoiado já pode servir com a bênção da designação.' });
    const vagos = liderancaChave(chamados).filter(p => p.vagos.length);
    if (vagos.length) {
      const total = vagos.reduce((t, p) => t + p.vagos.length, 0);
      add({ id: 'presidencias', prioridade: 2, icone: '🧩', aba: 'chamados', filtro: 'vagos',
        texto: `${plural(total, 'lugar vago', 'lugares vagos')} nas presidências da ala`,
        detalhe: vagos.map(p => `${p.rotulo} (${p.vagos.length})`).join(' · ') });
    }
  }

  // o número que só o bispo informa
  if (sessao && privado && privado.portadoresAtivosDizimistas == null) {
    add({ id: 'portadores', prioridade: 2, icone: '🔒', secao: 'cresc-rumo',
      texto: 'Informe quantos portadores do Sacerdócio de Melquisedeque são ativos e dizimistas integrais',
      detalhe: 'É o critério que só o bispo conhece (34.4). O número fica na parte protegida.' });
  }

  // sacramental
  if (domingosSemContagem.length) {
    add({ id: 'sacramental', prioridade: 2, icone: '🕊️', secao: 'cresc-sacramental',
      texto: `${plural(domingosSemContagem.length, 'domingo recente está', 'domingos recentes estão')} sem a frequência da sacramental`,
      detalhe: 'Com a contagem de cada domingo, a média do mês e a do ano saem sozinhas.' });
  }

  // classes e quóruns
  const tend = tendenciaPorGrupo(pub.frequenciaClasses?.semanas || []);
  const semMarca = new Set(gruposSemMarcacao(tend));
  for (const t of tend) {
    if (semMarca.has(t.grupo)) {
      add({ id: 'marcar-' + t.grupo, prioridade: 3, icone: '📝', secao: 'cresc-classes',
        texto: `${t.rotulo}: quase ninguém marcado nas últimas semanas`,
        detalhe: 'Confira se a frequência está sendo registrada no LCR — sem ela, o progresso não aparece.' });
    } else if (t.direcao === 'desce') {
      add({ id: 'caiu-' + t.grupo, prioridade: 2, icone: '📉', secao: 'cresc-classes',
        texto: `A frequência de ${t.rotulo} caiu ${Math.abs(t.variacao)} pontos nas últimas semanas`,
        detalhe: 'Vale perguntar à presidência quem deixou de vir e quem pode ser ministrado.' });
    }
  }

  // o trimestre: os indicadores de conversão que pioraram em relação a 1 ano antes
  const ultimo = Object.keys(pub.trimestral || {}).sort().at(-1);
  if (ultimo) {
    const piores = (pub.trimestral[ultimo].linhas || [])
      .filter(l => l.n <= 9 && comparacaoIndicador(l).anoAnterior === 'pior')
      .sort((a, b) => (a.pct - a.pctAnoAnterior) - (b.pct - b.pctAnoAnterior)).slice(0, 2);
    for (const l of piores) {
      add({ id: 'indicador-' + l.n, prioridade: 3, icone: '📊', secao: 'cresc-trimestral',
        texto: `Indicador ${l.n}: ${l.pct}% contra ${l.pctAnoAnterior}% um ano antes`, detalhe: l.rotulo || '' });
    }
  }

  // os élderes em perspectiva: o caminho mais curto para mais portadores do SM
  const perspectiva = pub.estatisticas?.valores?.elderesPerspectiva;
  if (perspectiva) {
    add({ id: 'perspectiva', prioridade: 3, icone: '🌱', aba: 'agenda',
      texto: `${plural(perspectiva, 'élder em perspectiva', 'élderes em perspectiva')} na ala`,
      detalhe: `Cada ordenação aproxima a ala dos ${METAS_ALA.portadoresSM} portadores do Sacerdócio de Melquisedeque (${METAS_ALA.portadoresSM * 2} para duas alas).` });
  }

  // relatórios que faltam ou envelheceram
  const faltam = [];
  if (!ultimo) faltam.push('o Relatório Trimestral');
  if (!pub.estatisticas) faltam.push('as Estatísticas da Unidade');
  if (!pub.recomendacoes?.adultos && !pub.recomendacoes?.jovens) faltam.push('a situação das recomendações');
  if (!(pub.frequenciaClasses?.semanas || []).length) faltam.push('a frequência às classes');
  if (faltam.length) {
    add({ id: 'importar', prioridade: 3, icone: '📄', secao: 'cresc-importar',
      texto: `Importe do LCR ${emLista(faltam)}`, detalhe: 'Cada relatório acende uma parte desta aba.' });
  }
  const velho = d => RE_DIA.test(d || '') && somarDias(d, DIAS_RELATORIO_VELHO) < hoje;
  const velhos = [
    ['o Relatório Trimestral', ultimo && pub.trimestral[ultimo].data],
    ['as recomendações de adultos', pub.recomendacoes?.adultos?.data],
    ['as recomendações de jovens', pub.recomendacoes?.jovens?.data],
  ].filter(([, d]) => velho(d)).map(([o]) => o);
  if (velhos.length) {
    add({ id: 'atualizar', prioridade: 3, icone: '🔄', secao: 'cresc-importar',
      texto: `Importe de novo ${emLista(velhos)}`, detalhe: `São de mais de ${DIAS_RELATORIO_VELHO} dias atrás.` });
  }
  return passos.map((p, i) => ({ p, i })).sort((a, b) => a.p.prioridade - b.p.prioridade || a.i - b.i).map(x => x.p);
}
