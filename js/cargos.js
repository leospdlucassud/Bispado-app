// =============================================
// CARGOS DO BISPADO — a tabela única (genérica, serve a qualquer ala)
// Sem DOM: o app (via config.js) e o servidor (o aviso ao responsável pela
// entrevista, netlify/functions/convite.js) leem daqui.
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
