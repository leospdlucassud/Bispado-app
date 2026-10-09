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
