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
// O estado de filtro/mês de cada aba mora no módulo da própria aba (filAgenda em
// agenda.js, filDesig em designacoes.js, calMes/calAno em calendario.js): só ela
// lê e escreve, e binding importado é somente-leitura.

// Versao do app que esta rodando neste aparelho. Comparada com /version.json
// (o que esta publicado) para o app instalado se atualizar sozinho.
// Nao editar a mao: `node scripts/versao.mjs patch|minor|major` atualiza este,
// o version.json, o CACHE do sw.js e o package.json juntos.
export const VERSAO = '5.16.0';

// =============================================
// NOME DA ALA
// Trocar de ala são DUAS linhas: esta (o nome na tela) e ALA_ID em
// netlify/functions/_ala.js (os stores de dados). Trocar só esta faria a ala
// nova ler e gravar nos dados da anterior.
// =============================================
export const ALA = 'Ala Palmas 4';

// Resolve o marcador {ALA} usado nos textos de dados (eventos do calendário)
export function comAla(txt) {
  return String(txt).replace(/\{ALA\}/g, ALA);
}

// Preenche todo elemento marcado com data-ala
export function aplicarNomeAla() {
  document.querySelectorAll('[data-ala]').forEach(el => { el.textContent = ALA; });
  document.title = `Bispado ${ALA} — Painel`;
  // o rodape vem da constante: assim o que aparece na tela e o que o app usa
  // para se comparar com o servidor nunca ficam diferentes
  document.querySelectorAll('[data-versao]').forEach(el => { el.textContent = 'v' + VERSAO; });
}
