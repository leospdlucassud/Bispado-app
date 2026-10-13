// =============================================
// IMPRIMIR / SALVAR EM PDF — a aba aberta, pela impressão do navegador
//
// O mesmo modelo do iSudApp: todo navegador atual oferece "Salvar como PDF"
// como destino da impressão (Chrome, Edge e Firefox no computador; a tela de
// impressão do Android; Compartilhar → Imprimir no iPhone). Gerar o PDF em
// JavaScript desenharia a tela como imagem; pela impressão o texto sai
// selecionável. (A ata sacramental continua tendo o seu PDF próprio, pdf.js.)
//
// O que vai para o papel é a própria tela, limpa pelo @media print do
// style.css: sem navegação, botões nem filtros, e sempre nas cores claras. O
// que a tela dizia pelos filtros (o mês, a vista, o filtro, a busca) vai para
// o topo da folha, lido na HORA de imprimir — a pessoa pode ter trocado de mês.
//
// Sigilo: papel circula. Entrevista e acompanhamento sigilosos saem só como
// "🔒 sigiloso", com a data e a situação, sem nome nem assunto — como o Início
// já faz na tela (o card marca data-sigiloso e traz a linha .so-papel).
// =============================================

import { ALA, MODO_CONVITE } from './config.js';
import { EM_DEMO } from './demo.js';
import { detalheDaFolha } from './impressao-regras.js';

// as abas com o que imprimir (Manual e Como Usar são só links e ajuda)
export const IMPRIMIVEIS = ['inicio', 'agenda', 'acompanhamento', 'designacoes', 'reuniao', 'calendario',
  'sacramental', 'membros', 'notas', 'ordenancas'];
const PAISAGEM = new Set(['calendario']);   // a grade do mês cabe melhor deitada

const FMT = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const limpo = s => String(s || '').replace(/\s+/g, ' ').trim();
const visivel = el => el.getClientRects().length > 0;

// O que a aba aberta está mostrando, para o topo da folha e o nome do arquivo.
// Lido com a tela ainda no layout de tela (no clique e no beforeprint).
export function descrever(painel) {
  if (!painel) return { titulo: ALA, detalhe: '', paisagem: false };
  const id = painel.id.replace(/^panel-/, '');
  const txt = sel => limpo(painel.querySelector(sel)?.textContent);
  const titulo = (id === 'inicio' ? 'Resumo do bispado' : id === 'calendario' ? 'Calendário' : txt('h2')).replace(/\s*—\s*$/, '');
  const periodo = [];
  if (id === 'inicio') periodo.push(txt('#inicio-data'));
  if (id === 'calendario') periodo.push(txt('#cal-titulo-mes'));
  const mesSac = painel.querySelector('#sac-mes-titulo');
  if (mesSac && visivel(mesSac)) periodo.push(limpo(mesSac.textContent));
  // os filtros e a vista que estão valendo (só os à vista: a Sacramental tem
  // filtros dentro das vistas escondidas)
  const filtros = [...painel.querySelectorAll('.filtros .filtro-btn.active, .filtros .filtro-btn[aria-pressed="true"]')]
    .filter(visivel).map(f => f.textContent);
  // um <select> também filtra (o responsável das Designações) e some do papel
  const selecoes = [...painel.querySelectorAll('select')].filter(s => visivel(s) && s.value).map(s => {
    const rotulo = s.getAttribute('aria-label');
    const escolhido = limpo(s.selectedOptions[0]?.textContent);
    return rotulo ? `${rotulo}: ${escolhido}` : escolhido;
  });
  const buscas = [...painel.querySelectorAll('input[type="text"], input[type="search"]')]
    .filter(c => visivel(c) && c.value.trim()).map(c => c.value);
  const temSigiloso = [...painel.querySelectorAll('[data-sigiloso]')].some(visivel);
  return { titulo: titulo || ALA, detalhe: detalheDaFolha({ periodo, filtros, selecoes, buscas, temSigiloso }), paisagem: PAISAGEM.has(id) };
}

// ---------- o topo da folha ----------
// Fica no documento o tempo todo (escondido na tela pelo CSS), e não nasce só
// no beforeprint: há caminhos de impressão que não disparam o evento, e o
// papel sairia sem dizer o que é.
function topo() {
  let t = document.getElementById('impressao-topo');
  if (!t) {
    t = document.createElement('div');
    t.id = 'impressao-topo';
    t.setAttribute('aria-hidden', 'true');
    document.body.prepend(t);
  }
  return t;
}

function atualizarTopo() {
  const d = descrever(document.querySelector('.panel.active'));
  const t = topo();
  t.replaceChildren();
  const linha = (classe, texto) => {
    if (!texto) return;
    const p = document.createElement('p');
    p.className = classe;
    p.textContent = texto;
    t.append(p);
  };
  // papel não tem a faixa da demonstração: sem este aviso, uma folha dela
  // podia circular como se fossem os dados da ala
  if (EM_DEMO) linha('impressao-topo__demo', 'DEMONSTRAÇÃO — dados fictícios, não pertencem à ala');
  linha('impressao-topo__titulo', d.titulo);
  linha('impressao-topo__detalhe', d.detalhe);
  linha('impressao-topo__rodape', `${ALA} · impresso em ${FMT.format(new Date())}`);
  return d;
}

// ---------- antes e depois da impressão ----------
let desfazerAoTerminar = null;

function preparar() {
  desfazer();
  const d = atualizarTopo();
  const tituloAntes = document.title;
  // o tema claro inteiro (as regras [data-theme="light"] do style.css), não só as
  // cores: o escuro sairia como um borrão de tinta
  const raiz = document.documentElement;
  const temaAntes = raiz.getAttribute('data-theme');
  raiz.setAttribute('data-theme', 'light');
  // o título da página é o nome sugerido do arquivo ao salvar em PDF
  document.title = `${d.titulo} — ${ALA}`;
  // @page não aceita seletor: a orientação entra como estilo só durante a impressão
  let pagina = null;
  if (d.paisagem) {
    pagina = document.createElement('style');
    pagina.textContent = '@page { size: A4 landscape; }';
    document.head.append(pagina);
  }
  // campo de texto imprime com a altura da tela e corta o texto longo: ganha,
  // só durante a impressão, uma cópia em texto corrido
  const copias = [];
  for (const campo of document.querySelectorAll('.panel.active textarea')) {
    const c = document.createElement('div');
    c.className = 'texto-impresso';
    c.textContent = campo.value;
    campo.after(c);
    copias.push(c);
  }
  desfazerAoTerminar = () => {
    if (temaAntes === null) raiz.removeAttribute('data-theme'); else raiz.setAttribute('data-theme', temaAntes);
    document.title = tituloAntes;
    pagina?.remove();
    for (const c of copias) c.remove();
  };
}

function desfazer() {
  desfazerAoTerminar?.();
  desfazerAoTerminar = null;
}

// ---------- o botão em cada aba ----------
function porBotoes() {
  for (const id of IMPRIMIVEIS) {
    const painel = document.getElementById('panel-' + id);
    if (!painel || painel.querySelector(':scope > .impressao-barra')) continue;
    const barra = document.createElement('div');
    barra.className = 'impressao-barra';
    barra.innerHTML = `<button type="button" class="btn-secondary btn-imprimir" data-imprimir
      title="Abre a impressão do navegador. Para PDF, escolha “Salvar como PDF” como destino.">🖨 Imprimir / PDF</button>`;
    painel.prepend(barra);
  }
}

function ligarImpressao() {
  porBotoes();
  topo();
  document.addEventListener('click', e => {
    if (!e.target.closest('[data-imprimir]')) return;
    atualizarTopo();
    window.print();
  });
  addEventListener('beforeprint', preparar);
  addEventListener('afterprint', desfazer);
}
if (!MODO_CONVITE) ligarImpressao();
