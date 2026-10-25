// =============================================
// DISCURSO BASE — sugestão de tema e de discursos para inspirar o orador (sem DOM)
// Usado pelo servidor (netlify/functions/discursos-base.js) e pelo app
// (js/discurso-base.js, quando o servidor não consegue buscar).
//
// A busca é a da Biblioteca do Evangelho (churchofjesuschrist.org/search), em
// português, nas três fontes, nesta ordem de prioridade (pedido do Leo):
//   1. Conferência Geral — das mais recentes para as mais antigas;
//   2. Revista Liahona — sem as reimpressões da conferência (já estão em 1);
//   3. BYU Speeches em português.
// A busca devolve título, link, data e um trecho curto; o autor vem da página
// do próprio discurso (só o servidor consegue lê-la: ela não libera CORS).
// =============================================

import { norm } from './utils.js';

const SITE = 'https://www.churchofjesuschrist.org';
export const URL_BUSCA = SITE + '/search/proxy/search';
export const URL_CONTEUDO = SITE + '/study/api/v3/language-pages/type/content';

export const FONTES = [
  { id: 'conferencia', facet: 'general-conference', titulo: 'Conferência Geral', paginas: 2, max: 6 },
  { id: 'liahona', facet: 'liahona', titulo: 'Revista Liahona', paginas: 1, max: 4 },
  { id: 'byu', facet: 'byu-speeches', titulo: 'BYU Speeches', paginas: 1, max: 4 },
];

export const MAX_TEMA = 80;
export const limparTema = t => String(t ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_TEMA);

// ---------- temas ----------
// Assuntos comuns de discurso sacramental. Sem tema digitado, o app sugere os
// que a ala não ouviu há mais tempo (os temas gravados nas atas).
export const TEMAS_SUGERIDOS = [
  'Fé em Jesus Cristo', 'Arrependimento', 'A Expiação de Jesus Cristo', 'O sacramento',
  'O Espírito Santo', 'Oração', 'Estudo das escrituras', 'O Livro de Mórmon',
  'A Restauração', 'Profetas vivos', 'O templo', 'História da família',
  'Ministração', 'Serviço', 'Caridade', 'Obra missionária',
  'Dízimo e ofertas', 'Jejum', 'O Dia do Senhor', 'A família',
  'Gratidão', 'Esperança', 'Perdão', 'Obediência',
  'Sacrifício', 'Humildade', 'Discipulado', 'Provações e fortaleza',
  'Paz em Cristo', 'O plano de salvação', 'Convênios', 'Palavra de Sabedoria',
  'Unidade', 'Alegria', 'Ressurreição', 'Amor ao próximo',
];

// A última vez (data do domingo) em que cada tema apareceu numa ata — o tema
// gravado conta quando contém o sugerido ou está contido nele ("Oração em
// família" conta para "Oração").
function ultimoUso(sacramentais, hojeKey) {
  const usos = [];
  for (const s of Array.isArray(sacramentais) ? sacramentais : []) {
    if (!s?.data || (hojeKey && s.data > hojeKey)) continue;
    for (const n of [1, 2, 3]) {
      const t = norm(s['tema' + n]);
      if (t) usos.push({ t, data: s.data });
    }
  }
  return tema => {
    const alvo = norm(tema);
    let ultimo = '';
    for (const u of usos) if ((u.t.includes(alvo) || alvo.includes(u.t)) && u.data > ultimo) ultimo = u.data;
    return ultimo;
  };
}

// Os `qtd` temas para sugerir: primeiro os que nunca apareceram nas atas, depois
// os de uso mais antigo. Entre os nunca usados, a lista gira a cada semana
// (para o bispado não ver sempre os mesmos seis).
export function sugerirTemas(sacramentais, hojeKey, qtd = 6) {
  const uso = ultimoUso(sacramentais, hojeKey);
  const semana = hojeKey ? Math.floor(Date.parse(hojeKey + 'T12:00:00Z') / (7 * 864e5)) : 0;
  const giro = ((semana * qtd) % TEMAS_SUGERIDOS.length + TEMAS_SUGERIDOS.length) % TEMAS_SUGERIDOS.length;
  return TEMAS_SUGERIDOS
    .map((tema, i) => ({ tema, ultimo: uso(tema), ordem: (i - giro + TEMAS_SUGERIDOS.length) % TEMAS_SUGERIDOS.length }))
    .sort((a, b) => (a.ultimo || '').localeCompare(b.ultimo || '') || a.ordem - b.ordem)
    .slice(0, qtd)
    .map(({ tema, ultimo }) => ({ tema, ultimo }));
}

// ---------- endereços ----------
export function urlDaBusca(tema, facet) {
  const q = new URLSearchParams({ query: limparTema(tema), page: '1', facet, lang: 'por', type: 'web' });
  if (facet === 'liahona') q.set('year', 'any-date');   // sem ele a busca da Liahona dá erro 500
  return URL_BUSCA + '?' + q;
}

// A página de busca do site, para "ver mais" (e quando a busca do app falha)
export const urlDaPaginaDeBusca = (tema, facet) =>
  SITE + '/search?' + new URLSearchParams({ query: limparTema(tema), lang: 'por', facet });

export const urlDoConteudo = caminho => URL_CONTEUDO + '?' + new URLSearchParams({ lang: 'por', uri: caminho });

// Só links destas páginas viram <a> no app: o que está gravado no domingo pode
// ter sido editado por qualquer um (a API é aberta).
export function urlSegura(u) {
  try {
    const url = new URL(String(u || ''));
    if (url.protocol !== 'https:') return '';
    if (url.hostname === 'www.churchofjesuschrist.org' && url.pathname.startsWith('/study/')) return url.href;
    if (url.hostname === 'speeches.byu.edu') return url.href;
    return '';
  } catch { return ''; }
}

// ---------- leitura da busca ----------
const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
export const textoLimpo = s => String(s ?? '')
  .replace(/<[^>]*>/g, '')
  .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const c = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(c) ? String.fromCodePoint(c) : m;
    }
    return ENTIDADES[e.toLowerCase()] ?? m;
  })
  .replace(/\s+/g, ' ').trim();

const cortar = (s, max) => s.length > max ? s.slice(0, max - 1).replace(/\s+\S*$/, '') + '…' : s;

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto',
  'setembro', 'outubro', 'novembro', 'dezembro'];

const campo = (f, k) => f?.[k]?.stringValue ?? f?.[k]?.listValue?.values?.[0]?.stringValue ?? '';

// Iniciais com ponto: "l-tom-perry" → "L. Tom Perry"
const nomeDoSlug = slug => String(slug || '').split('-').filter(Boolean)
  .map(p => p.length === 1 ? p.toUpperCase() + '.' : p[0].toUpperCase() + p.slice(1)).join(' ');

// Um resultado da busca → { titulo, url, ano, mes, data, trecho, autor, caminho }
// ou null quando não é um discurso/artigo (página de tópico, índice da sessão,
// reimpressão da conferência na Liahona).
export function lerResultado(r, fonte) {
  const d = r?.document?.derivedStructData?.fields;
  if (!d) return null;
  let url;
  try { url = new URL(campo(d, 'link')); } catch { return null; }
  let titulo = textoLimpo(campo(d, 'title') || campo(d, 'htmlTitle'));
  const trecho = cortar(textoLimpo(
    d.extractive_answers?.listValue?.values?.[0]?.structValue?.fields?.content?.stringValue
    || d.snippets?.listValue?.values?.[0]?.structValue?.fields?.snippet?.stringValue || ''), 240);
  const data = campo(r.document.structData?.fields, 'published_date').slice(0, 10);
  const p = url.pathname.replace(/\/+$/, '');
  let m, autor = '', caminho = '';
  if (fonte === 'conferencia') {
    if (url.hostname !== 'www.churchofjesuschrist.org') return null;
    m = p.match(/^\/study\/general-conference\/(\d{4})\/(\d{2})\/([a-z0-9-]+)$/);
    if (!m) return null;
    caminho = p.slice('/study'.length);
  } else if (fonte === 'liahona') {
    if (url.hostname !== 'www.churchofjesuschrist.org') return null;
    m = p.match(/^\/study\/liahona\/(\d{4})\/(\d{2})\/([a-z0-9-]+(?:\/[a-z0-9-]+)*)$/);
    // as edições de maio e novembro reimprimem a conferência, sessão por sessão
    if (!m || /(^|\/)[a-z-]*session(\/|$)/.test(m[3])) return null;
    caminho = p.slice('/study'.length);
  } else if (fonte === 'byu') {
    if (url.hostname !== 'speeches.byu.edu') return null;
    m = p.match(/^\/por\/talks\/([a-z0-9-]+)\/([a-z0-9-]+)$/);
    if (!m) return null;
    titulo = titulo.replace(/\s*\|\s*BYU Speeches.*$/i, '');
    autor = nomeDoSlug(m[1]);
    return { titulo, url: url.origin + p + '/', ano: '', mes: '', data, trecho, autor, caminho: '' };
  } else return null;
  if (!titulo) return null;
  return { titulo, url: SITE + p + '?lang=por', ano: m[1], mes: m[2], data, trecho, autor, caminho, slug: m[3].split('/').pop() };
}

// Os itens de uma fonte, sem repetir e na ordem certa: Conferência e Liahona
// das mais recentes para as mais antigas; BYU na ordem da busca (ela não traz
// a data do discurso).
export function ordenarItens(itens, fonte) {
  const vistos = new Set();
  const unicos = itens.filter(it => it && !vistos.has(it.url) && vistos.add(it.url));
  if (fonte === 'byu') return unicos;
  const chave = it => `${it.ano}${it.mes}${it.data || ''}`;
  return unicos.sort((a, b) => chave(b).localeCompare(chave(a)));
}

export function rotuloDaFonte(it, fonte) {
  const mes = MESES[Number(it.mes) - 1];
  if (fonte === 'conferencia') return mes ? `Conferência Geral de ${mes} de ${it.ano}` : 'Conferência Geral';
  if (fonte === 'liahona') return mes ? `Liahona, ${mes} de ${it.ano}` : 'Liahona';
  return 'BYU Speeches';
}

// O autor na página do discurso (a API de conteúdo da Biblioteca do Evangelho)
export function autorDoConteudo(json) {
  const corpo = String(json?.content?.body || '');
  // as páginas novas marcam o nome; as mais antigas só têm o bloco "byline",
  // com o nome no 1º parágrafo (o 2º é o chamado)
  const m = corpo.match(/<p[^>]*class="[^"]*\bauthor-name\b[^"]*"[^>]*>([\s\S]*?)<\/p>/i)
    || corpo.match(/<div[^>]*class="[^"]*\bbyline\b[^"]*"[^>]*>\s*<p[^>]*>([\s\S]*?)<\/p>/i);
  return m ? cortar(textoLimpo(m[1]).replace(/^(Por|By)\s+/i, ''), 80) : '';
}

// O texto que fica gravado no domingo (base{n}) e vai no convite
// (o título que já vem entre aspas não ganha outras: ““A mais desejável…””)
export function textoBase(it) {
  const t = String(it.titulo || '');
  const titulo = /^[“"]/.test(t) && /[”"]$/.test(t) ? t.slice(1, -1) : t;
  const autor = it.autor ? `, ${it.autor}` : '';
  return `“${titulo}”${autor} (${it.rotulo})`;
}

// ---------- a busca inteira ----------
// `buscarJson(url)` devolve o JSON (ou lança); com `comAutor`, lê a página de
// cada discurso da Conferência e da Liahona para achar o autor.
// Devolve { tema, fontes: [{ id, titulo, itens, erro, mais }] } — a fonte que
// falhou fica com erro: true e as outras seguem.
export async function buscarDiscursosBase(tema, { buscarJson, comAutor = false }) {
  const t = limparTema(tema);
  const fontes = await Promise.all(FONTES.map(async f => {
    const mais = urlDaPaginaDeBusca(t, f.facet);
    try {
      const paginas = await Promise.all(Array.from({ length: f.paginas }, (_, i) => {
        const u = new URL(urlDaBusca(t, f.facet));
        u.searchParams.set('page', String(i + 1));
        return buscarJson(u.href).catch(e => { if (i === 0) throw e; return null; });
      }));
      const brutos = paginas.flatMap(p => Array.isArray(p?.results) ? p.results : []);
      const itens = ordenarItens(brutos.map(r => lerResultado(r, f.id)), f.id);
      return { id: f.id, titulo: f.titulo, itens, erro: false, mais };
    } catch {
      return { id: f.id, titulo: f.titulo, itens: [], erro: true, mais };
    }
  }));
  // a Liahona sem os discursos que já vieram da Conferência (mesmo endereço final)
  const daConferencia = new Set(fontes[0].itens.map(it => it.slug));
  fontes[1].itens = fontes[1].itens.filter(it => !daConferencia.has(it.slug));
  for (const [i, f] of fontes.entries()) {
    f.itens = f.itens.slice(0, FONTES[i].max).map(it => ({ ...it, rotulo: rotuloDaFonte(it, f.id) }));
  }
  if (comAutor) {
    await Promise.all(fontes.flatMap(f => f.itens.filter(it => it.caminho && !it.autor).map(async it => {
      try { it.autor = autorDoConteudo(await buscarJson(urlDoConteudo(it.caminho))); } catch { /* sem autor */ }
    })));
  }
  for (const f of fontes) for (const it of f.itens) { delete it.caminho; delete it.slug; }
  return { tema: t, fontes };
}
