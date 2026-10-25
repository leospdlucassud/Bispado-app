// =============================================
// DISCURSO BASE — o diálogo "💡 Sugerir discurso base"
// Aberto do convite do orador (escolha da vaga), do "Tempo e tema" e da ata.
// O bispado digita um tema (ou toca num dos sugeridos) e o app traz discursos
// para inspirar a preparação do orador, com a fonte de cada um:
// Conferência Geral (das mais recentes), Liahona e BYU Speeches — nesta ordem.
// "Usar este" devolve o escolhido para quem abriu (aoEscolher); quem grava é o
// formulário de lá, junto com o resto da vaga (base{n} e base{n}Url).
// As regras (busca, leitura, ordem) estão em discursos-base-regras.js.
// =============================================

import { apiFetch } from './api.js';
import { DADOS } from './config.js';
import { buscarDiscursosBase, limparTema, sugerirTemas, textoBase, urlDaPaginaDeBusca, urlSegura } from './discursos-base-regras.js';
import { abrirModal, fecharModal } from './ui.js';
import { dataLocal, esc, formatarData } from './utils.js';

export const API_DISCURSOS_BASE = '/api/discursos-base';

let atual = null;   // { n, aoEscolher, tema, resultado, seq, auto }

// O que já foi escolhido, para mostrar no formulário de quem abriu
export function htmlBaseEscolhida(base, url, act = 'tirar-base', n = '') {
  if (!String(base || '').trim()) return '';
  const u = urlSegura(url);
  const texto = u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(base)}</a>` : esc(base);
  // sem act (no card), só o texto
  const tirar = act ? `<button type="button" class="base-tirar" data-act="${act}" data-n="${esc(n)}" aria-label="Tirar o discurso base" title="Tirar o discurso base">✕</button>` : '';
  return `<div class="base-escolhida">📖 <span>${texto}</span>${tirar}</div>`;
}

export function abrirDiscursoBase({ n, tema = '', aoEscolher }) {
  const hoje = dataLocal();
  const sugeridos = sugerirTemas(DADOS.sacramentais, hoje);
  let t = limparTema(tema);
  // "informando ou não um tema": sem tema, já busca o primeiro sugerido
  const auto = !t && sugeridos.length ? sugeridos[0].tema : '';
  if (auto) t = auto;
  atual = { n, aoEscolher, tema: t, resultado: null, seq: 0, auto };
  const chips = sugeridos.map(s => `<button type="button" class="filtro-btn" data-act="base-tema" data-tema="${esc(s.tema)}"
      title="${esc(s.ultimo ? 'Último discurso com este tema: ' + formatarData(s.ultimo) : 'Nenhum discurso com este tema nas atas')}">${esc(s.tema)}</button>`).join('');
  document.getElementById('modal-base-content').innerHTML = `
    <h3>💡 Discurso base${n ? ` — ${n}º discurso` : ''} <button class="modal-close" data-act="fechar-base">✕</button></h3>
    <div class="ficha-dica">Um discurso para inspirar a preparação do orador. A busca é na Biblioteca do Evangelho, nesta ordem: Conferência Geral (das mais recentes para as mais antigas), revista Liahona e BYU Speeches.</div>
    <div class="form-group">
      <label for="base-tema">Tema</label>
      <div class="base-busca">
        <input type="text" class="form-input" id="base-tema" value="${esc(t)}" placeholder="Ex.: Sacrifício" maxlength="80" autocomplete="off">
        <button type="button" class="btn-primary" data-act="base-buscar">Buscar</button>
      </div>
    </div>
    <div class="op-sub">Temas que a ala não ouve há mais tempo:</div>
    <div class="filtros base-temas">${chips}</div>
    <div id="base-resultados" aria-live="polite"></div>`;
  abrirModal('modal-base');
  if (t) buscar(t);
}

async function buscar(tema) {
  if (!atual) return;
  const t = limparTema(tema);
  const el = document.getElementById('base-resultados');
  if (t.length < 2) { if (el) el.innerHTML = '<div class="op-sub">Digite um tema (pelo menos 2 letras).</div>'; return; }
  atual.tema = t;
  const seq = ++atual.seq;
  const campo = document.getElementById('base-tema');
  if (campo && campo.value.trim() !== t) campo.value = t;
  for (const b of document.querySelectorAll('#modal-base .base-temas .filtro-btn')) b.classList.toggle('active', b.dataset.tema === t);
  if (el) el.innerHTML = `<div class="pdf-progresso"><div class="pdf-progresso-anim" aria-hidden="true"><span></span><span></span><span></span></div>Buscando “${esc(t)}” na Biblioteca do Evangelho…</div>`;
  let r = null;
  if (navigator.onLine !== false) {
    // 1º o servidor (traz o autor); se ele falhar, direto do navegador
    try { r = await apiFetch(API_DISCURSOS_BASE + '?tema=' + encodeURIComponent(t)); } catch { r = null; }
    if (!r?.fontes) {
      try {
        r = await buscarDiscursosBase(t, { buscarJson: async u => {
          const res = await fetch(u, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout?.(10000) });
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.json();
        } });
      } catch { r = null; }
    }
  }
  if (!atual || seq !== atual.seq) return;   // outra busca começou depois desta
  atual.resultado = r?.fontes ? r : null;
  renderResultados();
}

function renderResultados() {
  const el = document.getElementById('base-resultados');
  if (!el || !atual) return;
  const t = atual.tema;
  const r = atual.resultado;
  const nota = atual.auto && t === atual.auto
    ? `<div class="op-sub">Sem tema digitado — o app sugeriu “${esc(t)}”. Toque em outro tema ou digite o seu.</div>` : '';
  if (!r || r.fontes.every(f => f.erro)) {
    el.innerHTML = nota + `<div class="plano-alerta">📡 Não deu para buscar agora${navigator.onLine === false ? ' (sem internet)' : ''}.
      Abra a busca no site: <a href="${esc(urlDaPaginaDeBusca(t, 'general-conference'))}" target="_blank" rel="noopener">Conferência Geral ↗</a> ·
      <a href="${esc(urlDaPaginaDeBusca(t, 'liahona'))}" target="_blank" rel="noopener">Liahona ↗</a> ·
      <a href="${esc(urlDaPaginaDeBusca(t, 'byu-speeches'))}" target="_blank" rel="noopener">BYU Speeches ↗</a></div>`;
    return;
  }
  const blocos = r.fontes.map((f, fi) => {
    const itens = f.erro
      ? '<div class="op-sub">Não deu para buscar nesta fonte agora.</div>'
      : !f.itens.length ? '<div class="op-sub">Nada encontrado com este tema.</div>'
        : f.itens.map((it, ii) => {
          const u = urlSegura(it.url);
          return `<div class="base-item">
            ${u ? `<a class="base-titulo" href="${esc(u)}" target="_blank" rel="noopener">${esc(it.titulo)}</a>` : `<span class="base-titulo">${esc(it.titulo)}</span>`}
            <div class="op-sub">${it.autor ? esc(it.autor) + ' · ' : ''}${esc(it.rotulo)}</div>
            ${it.trecho ? `<div class="base-trecho">${esc(it.trecho)}</div>` : ''}
            <button type="button" class="btn-secondary" data-act="base-usar" data-f="${fi}" data-i="${ii}">Usar este</button>
          </div>`;
        }).join('');
    return `<section class="base-fonte">
      <div class="base-fonte-tit">${fi + 1}. ${esc(f.titulo)}${f.id === 'conferencia' ? ' <span>· das mais recentes</span>' : ''}</div>
      ${itens}
      <a class="base-mais" href="${esc(f.mais)}" target="_blank" rel="noopener">Ver mais no site ↗</a>
    </section>`;
  }).join('');
  el.innerHTML = nota + blocos;
}

function usar(fi, ii) {
  const it = atual?.resultado?.fontes?.[fi]?.itens?.[ii];
  if (!it) return;
  const escolhido = { tema: atual.tema, base: textoBase(it), url: urlSegura(it.url) };
  const fn = atual.aoEscolher;
  atual = null;
  fecharModal('modal-base');
  fn?.(escolhido);
}

function ligarDiscursoBase() {
  const modal = document.getElementById('modal-base');
  modal?.addEventListener('click', e => {
    const alvo = e.target.closest('[data-act]');
    if (!alvo) return;
    switch (alvo.dataset.act) {
      case 'fechar-base': atual = null; fecharModal('modal-base'); break;
      case 'base-buscar': buscar(document.getElementById('base-tema')?.value || ''); break;
      case 'base-tema': buscar(alvo.dataset.tema || ''); break;
      case 'base-usar': usar(Number(alvo.dataset.f), Number(alvo.dataset.i)); break;
    }
  });
  modal?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.id === 'base-tema') { e.preventDefault(); buscar(e.target.value); }
  });
}
ligarDiscursoBase();
