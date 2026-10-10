// =============================================
// UTILITÁRIOS
// =============================================
export function formatarData(iso) {
  if (!iso) return '—';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

// "Hoje" como AAAA-MM-DD na hora LOCAL. Não usar toISOString().slice(0,10):
// ela está em UTC e, no horário de Brasília, já devolve o dia seguinte a partir
// das 21h — atas e registros feitos à noite ficavam com a data de amanhã.
const dois = n => String(n).padStart(2, '0');
export function dataLocal(d = new Date()) {
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
}

// Data para exibir: AAAA-MM-DD vira dd/mm/aaaa direto (new Date('2026-10-08')
// é meia-noite em UTC, ou seja, dia 7 às 21h aqui — e mostraria o dia anterior);
// um instante completo (ISO com hora) vai para a data local.
export function dataParaExibir(v) {
  if (!v) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return formatarData(v);
  const d = new Date(v);
  return isNaN(d) ? '' : d.toLocaleDateString('pt-BR');
}

// Cor vinda dos dados (eventos do calendário) só entra em style= se for um hex:
// uma cor com aspas ou ponto e vírgula desmontava a tela.
export const corSegura = c => /^#[0-9a-f]{3,8}$/i.test(c || '') ? c : '#94a3b8';

// Ícone do sprite (icons/sprite.svg, Lucide). Herda a cor do texto em volta;
// aria-hidden porque o rótulo ao lado já diz o que o botão faz.
export const ico = nome => `<svg class="ico" aria-hidden="true"><use href="/icons/sprite.svg#i-${nome}"/></svg>`;

// Carrega um script clássico uma vez só — as bibliotecas grandes (PDF) vêm só
// quando alguém precisa delas, e não na abertura de toda tela. Com `integrity`,
// o navegador recusa o arquivo se ele tiver sido trocado no servidor de terceiros.
const scriptsCarregando = new Map();
export function carregarScript(src, { integrity } = {}) {
  if (!scriptsCarregando.has(src)) {
    scriptsCarregando.set(src, new Promise((ok, erro) => {
      const s = document.createElement('script');
      s.src = src;
      if (integrity) { s.integrity = integrity; s.crossOrigin = 'anonymous'; }
      s.onload = () => ok();
      s.onerror = () => { scriptsCarregando.delete(src); s.remove(); erro(new Error('Não carregou: ' + src)); };
      document.head.appendChild(s);
    }));
  }
  return scriptsCarregando.get(src);
}

// Comparação de nomes sem acento, caixa ou espaço sobrando. Morava em
// membros-import.js (que segue reexportando): agenda, rodízio e servidor usam.
export const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

// Meses como vêm no PDF do LCR ("03 fev 2010")
export const MESES_PT = { jan:0, fev:1, mar:2, abr:3, mai:4, jun:5, jul:6, ago:7, set:8, out:9, nov:10, dez:11 };

// "03 fev 2010" → { a:2010, m:2, d:3 } (m de 1 a 12), ou null
export function partesDoNascimento(nasc) {
  const r = /^(\d{1,2})\s+([a-zç]{3})\.?\s+(\d{4})$/i.exec(String(nasc || '').trim());
  if (!r) return null;
  const m = MESES_PT[r[2].toLowerCase()];
  if (m === undefined) return null;
  const d = +r[1], a = +r[3];
  const t = new Date(a, m, d);
  return t.getMonth() === m && t.getDate() === d ? { a, m: m + 1, d } : null;
}

// wa.me exige só dígitos com o código do país. Abaixo de 10 dígitos falta o
// DDD: antes virava '55'+número e o WhatsApp abria a conversa de outra pessoa.
export function digitosTelefone(t) {
  let d = String(t || '').replace(/\D/g, '');
  if (d.length < 10) return '';
  if (d.length <= 11) d = '55' + d;
  return d;
}

// Link do WhatsApp com a mensagem pronta. Sem número, o WhatsApp abre e pede o
// contato — o caminho de quem não está no quadro de membros.
export function hrefWhatsApp(telefone, msg) {
  const d = digitosTelefone(telefone);
  return `https://wa.me/${d}?text=${encodeURIComponent(msg || '')}`;
}

// Destaca o termo buscado. Parte o texto CRU e escapa cada pedaço: o antigo
// highlight() rodava sobre o HTML já escapado e, buscando "amp", partia o &amp;.
export function realcar(texto, q) {
  const t = String(texto ?? '');
  const termo = String(q || '').trim();
  if (!termo) return esc(t);
  const re = new RegExp(termo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  let out = '', ultimo = 0, m;
  while ((m = re.exec(t))) {
    if (!m[0]) { re.lastIndex++; continue; }
    out += esc(t.slice(ultimo, m.index)) + '<mark>' + esc(m[0]) + '</mark>';
    ultimo = m.index + m[0].length;
  }
  return out + esc(t.slice(ultimo));
}

// Fila por chave: tarefas da mesma chave rodam uma de cada vez, na ordem em que
// chegaram (a 2ª gravação de um domingo novo espera o POST da 1ª, e já sai como
// PUT com o id real). Chaves diferentes não se esperam; uma falha não trava a
// seguinte.
export function encadearPorChave() {
  const caudas = new Map();
  return (chave, tarefa) => {
    const anterior = caudas.get(chave) || Promise.resolve();
    const atual = anterior.catch(() => {}).then(tarefa);
    const cauda = atual.catch(() => {});
    caudas.set(chave, cauda);
    cauda.then(() => { if (caudas.get(chave) === cauda) caudas.delete(chave); });
    return atual;
  };
}

// Escapa texto do usuário antes de inserir via innerHTML.
// A ordem importa: '&' primeiro, senão as demais entidades seriam re-escapadas.
export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
