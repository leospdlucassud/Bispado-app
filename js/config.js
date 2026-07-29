// =============================================
// CONFIGURAÇÃO
// =============================================
const API_AGENDA    = '/api/agenda';
const API_REUNIOES  = '/api/reunioes';
const API_DESIG     = '/api/designacoes';
const API_EVENTOS   = '/api/eventos_extras';
const API_SAC       = '/api/sacramentais';

// Cargos do bispado — genéricos, servem a qualquer ala
const CARGOS = ['Bispo', '1º Conselheiro', '2º Conselheiro', 'Secretário', 'Secretário Executivo'];

let DADOS = { agenda:[], reunioes:[], designacoes:[], eventos_extras:[], sacramentais:[], acompanhamentos:[] };
let filAgenda = 'ativas', filDesig = 'ativas';
let calMes = new Date().getMonth(), calAno = new Date().getFullYear();

// =============================================
// NOME DA ALA
// Constante única: outra ala troca só esta linha antes de publicar.
// =============================================
const ALA = 'Ala Queimados';

// Resolve o marcador {ALA} usado nos textos de dados (eventos do calendário)
function comAla(txt) {
  return String(txt).replace(/\{ALA\}/g, ALA);
}

// Preenche todo elemento marcado com data-ala
function aplicarNomeAla() {
  document.querySelectorAll('[data-ala]').forEach(el => { el.textContent = ALA; });
  document.title = `Bispado ${ALA} — Painel`;
}
