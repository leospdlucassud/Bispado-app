// O texto oficial de cada roteiro de entrevista (aba Ordenanças), lido na hora
// da Biblioteca do Evangelho. O texto não fica no repositório (é público, mas é
// material da Intellectual Reserve): o servidor busca a seção do Manual, tira o
// HTML e devolve só os parágrafos e os itens, com a fonte e o link.
//
// Só as páginas e seções desta lista — o app não pede URL nenhuma.

export const SITE = "https://www.churchofjesuschrist.org";
export const URL_CONTEUDO = SITE + "/study/api/v3/language-pages/type/content";

const MG26 = "/manual/general-handbook/26-temple-recommends";
const MG31 = "/manual/general-handbook/31";
const MG32 = "/manual/general-handbook/32-repentance-and-membership-councils";
const PMG12 = "/manual/preach-my-gospel-2023/20-chapter-12";
const MISSAO = "/manual/missionary-interview-questions/interview-questions";

// aid = o data-aid do título da seção na página; sem aid, a página inteira
const PERGUNTAS_TEMPLO = { uri: MG26, aid: "155794429", livro: "Manual Geral" };

// `semLista`: o Manual não traz perguntas fixas para essa entrevista — o app
// mostra o texto oficial que a orienta e avisa
export const FONTES_ROTEIRO = {
  "recom-renovacao": { partes: [PERGUNTAS_TEMPLO] },
  "recom-primeira": { partes: [{ uri: MG26, aid: "169656018", livro: "Manual Geral" }, PERGUNTAS_TEMPLO] },
  "recom-limitada": { partes: [{ uri: MG26, aid: "169655817", livro: "Manual Geral" }, PERGUNTAS_TEMPLO] },
  "ordenacao-sa": { semLista: true, partes: [{ uri: MG31, aid: "151405146", livro: "Manual Geral" }] },
  "batismo-crianca": { partes: [
    { uri: MG31, aid: "151404086", livro: "Manual Geral" },
    { uri: PMG12, aid: "155230043", livro: "Pregar Meu Evangelho, cap. 12" },
  ] },
  "jovens-anual": { semLista: true, partes: [{ uri: MG31, aid: "151405242", livro: "Manual Geral" }] },
  "missao": { partes: [{ uri: MISSAO, livro: "Perguntas para missionários em perspectiva" }] },
  "dignidade": { semLista: true, partes: [
    { uri: MG32, aid: "144580934", livro: "Manual Geral" },
    { uri: MG32, aid: "144586691", livro: "Manual Geral" },
  ] },
};

export const urlDoConteudo = uri => `${URL_CONTEUDO}?lang=por&uri=${encodeURIComponent(uri)}`;

const ENTIDADES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
export function textoDoHtml(html) {
  return String(html || "")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
      if (e[0] === "#") {
        const n = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : "";
      }
      return ENTIDADES[e.toLowerCase()] ?? m;
    })
    .replace(/\s+/g, " ")
    .trim();
}

// A <section> que tem o título `aid`, inteira (com as subseções). Sem aid, ou
// sem a seção, null.
export function recortarSecao(body, aid) {
  const b = String(body || "");
  const i = aid ? b.indexOf(`data-aid="${aid}"`) : -1;
  if (i < 0) return null;
  const ini = b.lastIndexOf("<section", i);
  if (ini < 0) return null;
  const re = /<(\/?)section\b[^>]*>/g;
  re.lastIndex = ini;
  let nivel = 0, m;
  while ((m = re.exec(b))) {
    nivel += m[1] ? -1 : 1;
    if (nivel === 0) return b.slice(ini, re.lastIndex);
  }
  return null;
}

// HTML → blocos: { tipo: 'titulo', num, texto, ancora } | { tipo: 'p', texto }
// | { tipo: 'item', marcador, nivel, textos: [] }. Só texto: o app escapa.
export function blocosDoHtml(html) {
  const blocos = [];
  const listas = []; // pilha: { numerada, item }
  let numPendente = "";
  const re = /<(\/?)(ol|ul|li|p|h[1-6])\b([^>]*)>/gi;
  let m;
  while ((m = re.exec(html))) {
    const [, fecha, tagBruta, attrs] = m;
    const tag = tagBruta.toLowerCase();
    if (tag === "ol" || tag === "ul") {
      if (fecha) listas.pop(); else listas.push({ numerada: tag === "ol", item: null });
      continue;
    }
    if (tag === "li") {
      const topo = listas[listas.length - 1];
      if (!topo) continue;
      if (fecha) { topo.item = null; continue; }
      const marcador = (attrs.match(/data-marker="([^"]*)"/) || [])[1] || (topo.numerada ? "" : "•");
      topo.item = { tipo: "item", marcador: textoDoHtml(marcador), nivel: listas.length, textos: [] };
      blocos.push(topo.item);
      continue;
    }
    if (fecha) continue;
    // conteúdo até o fechamento da mesma tag
    const fim = html.indexOf(`</${tag}>`, re.lastIndex);
    if (fim < 0) break;
    const texto = textoDoHtml(html.slice(re.lastIndex, fim));
    re.lastIndex = fim + tag.length + 3;
    if (tag[0] === "h") {
      if (texto) blocos.push({ tipo: "titulo", num: numPendente, texto, ancora: (attrs.match(/\bid="([^"]+)"/) || [])[1] || "" });
      numPendente = "";
      continue;
    }
    if (/class="[^"]*title-number/.test(attrs)) { numPendente = texto; continue; }
    if (!texto) continue;
    const item = listas[listas.length - 1]?.item;
    if (item) item.textos.push(texto); else blocos.push({ tipo: "p", texto });
  }
  return blocos.filter(b => b.tipo !== "item" || b.textos.length);
}

// Uma parte do roteiro: lê a página e recorta a seção
export async function lerParte(parte, buscarJson) {
  const j = await buscarJson(urlDoConteudo(parte.uri));
  const body = j?.content?.body || "";
  const html = parte.aid ? recortarSecao(body, parte.aid) : body;
  if (!html) throw new Error("seção não encontrada");
  const blocos = blocosDoHtml(html);
  if (!blocos.length) throw new Error("seção vazia");
  const primeiro = blocos.find(b => b.tipo === "titulo");
  const secao = primeiro?.num ? `${parte.livro} ${primeiro.num}` : parte.livro;
  const ancora = parte.aid && primeiro?.ancora ? `&id=${primeiro.ancora}#${primeiro.ancora}` : "";
  return { fonte: secao, url: `${SITE}/study${parte.uri}?lang=por${ancora}`, blocos };
}

export async function lerRoteiroOficial(id, buscarJson) {
  const f = Object.hasOwn(FONTES_ROTEIRO, id) ? FONTES_ROTEIRO[id] : null;
  if (!f) return null;
  const partes = await Promise.all(f.partes.map(p => lerParte(p, buscarJson)));
  return { id, semLista: !!f.semLista, partes };
}
