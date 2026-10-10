// =============================================
// CONFIGURAÇÃO
// =============================================
export const API_AGENDA    = '/api/agenda';
export const API_REUNIOES  = '/api/reunioes';
export const API_DESIG     = '/api/designacoes';
export const API_EVENTOS   = '/api/eventos_extras';
export const API_SAC       = '/api/sacramentais';
// ajustes do rodízio de discursos por pessoa (organização, pausa…) — rodizio.js
export const API_ORADORES  = '/api/oradores';
// Horário da reunião sacramental, "HH:MM". Preenchido, entra na mensagem do
// convite para discursar ("domingo, 18 de outubro, às 9h"); vazio, fica de fora.
export const HORARIO_SACRAMENTAL = '';
// A tela do membro (link do convite) usa só este caminho, que devolve só a
// entrevista dele — ver netlify/functions/convite.js
export const API_CONVITE   = '/api/convite';

// Aberto pelo link do convite: a tela do membro substitui o app inteiro. Nesse
// modo nada do painel pode rodar — nem carga de dados, nem service worker, nem
// o convite para instalar o app no celular de quem só veio responder.
export const MODO_CONVITE = new URLSearchParams(location.search).has('confirmar');

// =============================================
// CARGOS DO BISPADO — a tabela única (genérica, serve a qualquer ala)
// Antes, nome, código, cor e ícone estavam copiados em 6 arquivos, e cada cópia
// tinha a sua falha. `cod` é o que a entrevista grava em `responsavel`;
// designações e acompanhamentos gravam o nome. `entrevista`: aparece como
// responsável no formulário da entrevista.
// =============================================
export const CARGOS_INFO = [
  { cod: 'bispo', nome: 'Bispo',                icone: '⚜️', cor: '#c9a84c', entrevista: true },
  { cod: 'c1',    nome: '1º Conselheiro',       icone: '🔵', cor: '#5b9bd5', entrevista: true },
  { cod: 'c2',    nome: '2º Conselheiro',       icone: '🟢', cor: '#6dbf8c', entrevista: true },
  { cod: 'sec',   nome: 'Secretário',           icone: '📝', cor: '#e8b040', entrevista: true },
  { cod: 'se',    nome: 'Secretário Executivo', icone: '🗓️', cor: '#e86848', entrevista: false },
];
export const CARGOS = CARGOS_INFO.map(c => c.nome);
// aceita o código ('c1') ou o nome ('1º Conselheiro')
export const cargoInfo = x => CARGOS_INFO.find(c => c.cod === x || c.nome === x) || null;
export const nomeDoResponsavel = x => cargoInfo(x)?.nome || x || '';
export const corDoCargo = x => cargoInfo(x)?.cor || '#8eacc8';

// Cor de cada status da entrevista (borda do card, itens do Início): tokens
// --st-* do style.css, que têm a sua versão no tema claro.
export const COR_STATUS = {
  pendente: 'var(--st-pendente)', agendada: 'var(--st-agendada)',
  realizada: 'var(--st-realizada)', 'nao-realizada': 'var(--st-nao-realizada)',
};

export let DADOS = { agenda:[], reunioes:[], designacoes:[], eventos_extras:[], sacramentais:[], acompanhamentos:[], oradores:[] };
// O estado de filtro/mês de cada aba mora no módulo da própria aba (filAgenda em
// agenda.js, filDesig em designacoes.js, calMes/calAno em calendario.js): só ela
// lê e escreve, e binding importado é somente-leitura.

// Versao do app que esta rodando neste aparelho. Comparada com /version.json
// (o que esta publicado) para o app instalado se atualizar sozinho.
// Nao editar a mao: `node scripts/versao.mjs patch|minor|major` atualiza este,
// o version.json, o CACHE do sw.js e o package.json juntos.
export const VERSAO = '5.21.0';

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
