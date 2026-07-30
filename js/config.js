// =============================================
// CONFIGURAÇÃO
// =============================================
export const API_AGENDA    = '/api/agenda';
export const API_REUNIOES  = '/api/reunioes';
export const API_DESIG     = '/api/designacoes';
export const API_EVENTOS   = '/api/eventos_extras';
export const API_SAC       = '/api/sacramentais';

// Cargos do bispado — genéricos, servem a qualquer ala
export const CARGOS = ['Bispo', '1º Conselheiro', '2º Conselheiro', 'Secretário', 'Secretário Executivo'];

export let DADOS = { agenda:[], reunioes:[], designacoes:[], eventos_extras:[], sacramentais:[], acompanhamentos:[] };
export let filAgenda = 'ativas', filDesig = 'ativas';
export let calMes = new Date().getMonth(), calAno = new Date().getFullYear();

// =============================================
// NOME DA ALA
// Constante única: outra ala troca só esta linha antes de publicar.
// =============================================
export const ALA = 'Ala Queimados';

// Resolve o marcador {ALA} usado nos textos de dados (eventos do calendário)
export function comAla(txt) {
  return String(txt).replace(/\{ALA\}/g, ALA);
}

// Preenche todo elemento marcado com data-ala
export function aplicarNomeAla() {
  document.querySelectorAll('[data-ala]').forEach(el => { el.textContent = ALA; });
  document.title = `Bispado ${ALA} — Painel`;
}
