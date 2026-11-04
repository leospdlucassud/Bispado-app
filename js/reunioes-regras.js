// =============================================
// REGRAS DAS ATAS DE REUNIÃO — sem DOM
// O que o card (reunioes.js), o PDF (pdf.js) e a busca (busca.js) dividem: a
// presença do bispado, os parágrafos da pauta, o texto da busca, o texto que o
// PDF consegue escrever (as duas atas: a de reunião e a sacramental) e o nome
// do arquivo. Nada de DOM nem de módulo de tela
// aqui: tests/reunioes.test.mjs importa direto no Node. Quem ocupa cada chamado
// e o dia de hoje chegam por parâmetro (nomeDoCargo, de chamados.js, e
// dataLocal, de utils.js), não por import.
//
// Campos da ata, todos opcionais — atas gravadas antes deles não têm nenhum e
// continuam valendo como estão (nada é migrado):
//   presenca           [{ cargo, nome, presente }], um por chamado, na ordem de CARGOS
//   oracaoInicial      quem fez a oração inicial
//   oracaoEncerramento quem fez a oração de encerramento
// =============================================

const limpo = v => (typeof v === 'string' ? v.trim() : '');

// =============================================
// QUEM PARTICIPA DE CADA REUNIÃO — a lista de presença do formulário
// Pelo Manual Geral: reunião do bispado (29.2.4), conselho da ala (29.2.5),
// conselho de jovens da ala (29.2.6) e coordenação missionária (23.4). A
// estendida é a reunião do bispado com os dois presidentes que o 29.2.4 cita
// como convidados. "Liderança do Sacerdócio" e "Bem-Estar" não têm lista no
// Manual atual — ficou como o bispado da ala definiu (04/11/2026):
//   Liderança: todos os líderes portadores do sacerdócio (maior ou menor):
//     o bispado, os secretários e as presidências dos quóruns;
//   Bem-Estar: só o bispado e os presidentes do QE e da SS.
// Na coordenação missionária, além do 23.4, o conselheiro do bispado que cuida
// da obra missionária na ala.
//   bispado: 'todo' (bispado, secretário e secretário executivo — CARGOS),
//            'bispado' (bispo e conselheiros) ou 'nenhum'
// Os nomes dos que não são do bispado vêm do relatório de chamados do LCR (aba
// Chamados); papéis de várias pessoas (os missionários) ficam sem nome.
// =============================================
export const TIPO_ESTENDIDA = 'bispado-estendida';
const PQE = 'Presidente do Quórum de Élderes', PSS = 'Presidente da Sociedade de Socorro';
const ASSISTENTE = 'Assistente do Bispo no Quórum dos Sacerdotes';
export const PRESIDENTES_ESTENDIDA = [PQE, PSS];
// A presidência de um quórum: presidente, conselheiros e secretário
const presidencia = q => [`Presidente do Quórum ${q}`, `1º Conselheiro do Quórum ${q}`, `2º Conselheiro do Quórum ${q}`, `Secretário do Quórum ${q}`];
const LIDERES_DO_SACERDOCIO = [
  ...presidencia('de Élderes'),
  // o quórum dos sacerdotes é presidido pelo bispo: os assistentes no lugar dos conselheiros
  '1º Assistente do Bispo no Quórum dos Sacerdotes', '2º Assistente do Bispo no Quórum dos Sacerdotes', 'Secretário do Quórum dos Sacerdotes',
  ...presidencia('dos Mestres'),
  ...presidencia('dos Diáconos'),
];
export const PRESENCA_POR_TIPO = {
  conselho: { bispado: 'todo', outros: [PQE, PSS, 'Presidente das Moças', 'Presidente da Primária', 'Presidente da Escola Dominical'], ref: '29.2.5', titulo: 'Presença do conselho da ala' },
  bispado: { bispado: 'todo', outros: [], ref: '29.2.4', titulo: 'Presença do bispado' },
  [TIPO_ESTENDIDA]: { bispado: 'todo', outros: [PQE, PSS], ref: '29.2.4', titulo: 'Presença do bispado e dos presidentes' },
  jovens: { bispado: 'bispado', outros: [ASSISTENTE, 'Presidente do Quórum dos Diáconos', 'Presidente do Quórum dos Mestres', 'Presidentes dos grupos etários das Moças', 'Presidente das Moças'], ref: '29.2.6', titulo: 'Presença do conselho de jovens' },
  correlacao: { bispado: 'nenhum', outros: ['Líder de Missão da Ala', 'Conselheiro do bispado responsável pela obra missionária',
    'Conselheiro do Quórum de Élderes responsável pela obra missionária', 'Conselheira da Sociedade de Socorro responsável pela obra missionária',
    'Presidência da Primária (membro designado)', 'Missionários de ala', ASSISTENTE, 'Presidência das Guardiãs da Luz (membro designado)',
    'Missionários de tempo integral'], ref: '23.4', titulo: 'Presença na coordenação missionária' },
  lideranca: { bispado: 'todo', outros: LIDERES_DO_SACERDOCIO, ref: '', titulo: 'Presença dos líderes do sacerdócio' },
  bemestar: { bispado: 'bispado', outros: [PQE, PSS], ref: '', titulo: 'Presença' },
  outro: { bispado: 'todo', outros: [], ref: '', titulo: 'Presença do bispado' },
};
const BISPO_E_CONSELHEIROS = ['Bispo', '1º Conselheiro', '2º Conselheiro'];
const regraDe = tipo => (Object.hasOwn(PRESENCA_POR_TIPO, tipo) ? PRESENCA_POR_TIPO[tipo] : PRESENCA_POR_TIPO.outro);

// os chamados da lista de presença daquele tipo de reunião, na ordem: o
// bispado (de `cargos`, a lista CARGOS) e depois os outros
export function cargosDaReuniao(tipo, cargos) {
  const r = regraDe(tipo);
  const base = Array.isArray(cargos) ? cargos : [];
  const doBispado = r.bispado === 'nenhum' ? [] : r.bispado === 'bispado' ? base.filter(c => BISPO_E_CONSELHEIROS.includes(c)) : base;
  return [...doBispado, ...r.outros];
}
export const tituloPresenca = tipo => regraDe(tipo).titulo;
export const referenciaDaPresenca = tipo => regraDe(tipo).ref;

// O chamado como o LCR escreve, para achar o nome no relatório de chamados
const semAcento = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/\(a\)/g, '').replace(/\s+/g, ' ').trim();
// os quóruns como o LCR escreve: "de Élderes", "de Diáconos" ou "dos Diáconos"
const QUORUNS = { 'de Élderes': 'elderes', 'dos Mestres': 'mestres', 'dos Diáconos': 'diaconos', 'dos Sacerdotes': 'sacerdotes' };
const doQuorum = q => `quorum d(e|os) ${QUORUNS[q]}`;
const NO_LCR = {
  ...Object.fromEntries(Object.keys(QUORUNS).flatMap(q => [
    [`Presidente do Quórum ${q}`, new RegExp(`^presidente do ${doQuorum(q)}$`)],
    [`1º Conselheiro do Quórum ${q}`, new RegExp(`^primeiro conselheiro .*${doQuorum(q)}$`)],
    [`2º Conselheiro do Quórum ${q}`, new RegExp(`^segundo conselheiro .*${doQuorum(q)}$`)],
    [`Secretário do Quórum ${q}`, new RegExp(`^secretario (do|da presidencia do) ${doQuorum(q)}$`)],
  ])),
  '1º Assistente do Bispo no Quórum dos Sacerdotes': /^primeiro assistente .*quorum d(e|os) sacerdotes$/,
  '2º Assistente do Bispo no Quórum dos Sacerdotes': /^segundo assistente .*quorum d(e|os) sacerdotes$/,
  [PQE]: /^presidente do quorum de elderes$/,
  [PSS]: /^presidente da sociedade de socorro$/,
  'Presidente das Moças': /^presidente das mocas$/,
  'Presidente da Primária': /^presidente da primaria$/,
  'Presidente da Escola Dominical': /^presidente da escola dominical$/,
  'Líder de Missão da Ala': /^lider (de missao|da obra missionaria) da ala$/,
  [ASSISTENTE]: /^(primeiro )?assistente .*quorum d(e|os) sacerdotes$/,
};
// O nome de quem tem aquele chamado no relatório (o primeiro), ou ''.
// `formatar`: "Sobrenome, Nome" → como o app mostra (nomeCurto, chamados-lcr.js)
export function nomeNoRelatorio(chamados, cargo, formatar = n => n) {
  const re = NO_LCR[cargo];
  if (!re) return '';
  const c = (Array.isArray(chamados) ? chamados : []).find(x => x && x.nome && re.test(semAcento(x.chamado)));
  return c ? formatar(c.nome) : '';
}

// "Secretário Executivo Ana Ribeiro"; só "Secretário Executivo" com o chamado sem nome.
// Chamado antes do nome, como no crachá do topo (comNome, de chamados.js).
export const rotuloPresenca = ({ cargo, nome } = {}) => `${limpo(cargo)} ${limpo(nome)}`.trim();

// A reunião já aconteceu? `quando` = { data: da ata, hoje: dataLocal() }, as
// duas em AAAA-MM-DD (comparam como texto). Sem uma delas, conta como passada:
// vale a fotografia, que não reescreve nome nenhum.
const jaAconteceu = ({ data, hoje } = {}) => !(limpo(data) && limpo(hoje) && limpo(data) >= limpo(hoje));

// O nome entra na ata como FOTOGRAFIA: a ata de março tem de continuar dizendo
// quem era o 1º Conselheiro em março, mesmo depois que o chamado trocou de mãos.
// Por isso, ao editar ata de reunião que já passou, vale o nome já gravado; o
// atual só preenche o que veio vazio (ata criada antes de os nomes chegarem, ou
// com o chamado sem nome). A fotografia só vale do dia da reunião para trás: a
// ata cadastrada antes (a pauta da semana que vem) gravava quem tinha o chamado
// no dia do CADASTRO — se ele trocasse de mãos até a reunião, a ata dizia que
// estava presente quem já não era do bispado, sem campo para corrigir. Até o
// dia, vale o nome atual (o gravado, se o chamado ficou sem nome).
function nomeNaAta(cargo, nomeAtual, guardada, quando) {
  const salvo = limpo((Array.isArray(guardada) ? guardada.find(p => p && p.cargo === cargo) : null)?.nome);
  const atual = typeof nomeAtual === 'function' ? limpo(nomeAtual(cargo)) : '';
  return jaAconteceu(quando) ? (salvo || atual) : (atual || salvo);
}

// O que vai para o servidor ao salvar: um registro por chamado, na ordem de
// `cargos`, presente = marcado na lista. Marcação de cargo fora da lista (ADM,
// um cargo que saiu de CARGOS) não entra. `quando`: ver jaAconteceu.
export function montarPresenca(cargos, nomeAtual, guardada, marcados, quando) {
  const sim = new Set(marcados || []);
  return (Array.isArray(cargos) ? cargos : []).map(cargo => ({
    cargo, nome: nomeNaAta(cargo, nomeAtual, guardada, quando), presente: sim.has(cargo),
  }));
}

// A lista do formulário (criar e editar): os mesmos nomes de montarPresenca, e
// a marcação que estava gravada (desmarcado quando a ata não tem presença).
export function presencaParaFormulario(cargos, nomeAtual, guardada, quando) {
  const lista = Array.isArray(guardada) ? guardada : [];
  return (Array.isArray(cargos) ? cargos : []).map(cargo => ({
    cargo,
    nome: nomeNaAta(cargo, nomeAtual, lista, quando),
    presente: lista.find(p => p && p.cargo === cargo)?.presente === true,
  }));
}

// Quem estava. Sem ninguém marcado (ou ata antiga, sem o campo), o card e o PDF
// omitem a seção inteira — uma lista de "ausentes" numa ata em que ninguém
// marcou nada diria uma coisa falsa.
export function presentes(presenca) {
  return Array.isArray(presenca) ? presenca.filter(p => p && p.presente === true) : [];
}

// A pauta como foi digitada: linha em branco separa assuntos (linha só com
// espaços também conta — no celular ela some à vista). A quebra simples dentro
// de um assunto fica: é a lista que a pessoa escreveu um item por linha.
// Antes o card juntava tudo num bloco só (o HTML ignora a quebra de linha).
export function paragrafos(texto) {
  if (texto == null) return [];
  return String(texto)
    .replace(/\r\n?/g, '\n')
    .split(/\n(?:[^\S\n]*\n)+/)
    .map(p => p.trim())
    .filter(Boolean);
}

// Tudo o que a busca da aba e a busca global procuram numa ata, em minúsculas.
// Dos chamados, só os presentes: buscar um nome acha as reuniões em que ele estava.
export function textoDeBusca(r, rotuloTipo = '') {
  if (!r || typeof r !== 'object') return '';
  return [
    r.pauta, rotuloTipo, r.tipo,
    ...(Array.isArray(r.participantes) ? r.participantes : []),
    ...presentes(r.presenca).map(rotuloPresenca),
    r.oracaoInicial, r.oracaoEncerramento,
    ...(Array.isArray(r.itens) ? r.itens.map(i => i?.texto) : []),
  ].filter(v => typeof v === 'string' && v).join(' ').toLowerCase();
}

// Texto digitado → texto que as fontes padrão do jsPDF sabem escrever. Elas só
// têm o WinAnsi (o Latin-1 mais € ‚ „ … – — ‘ ’ “ ” • ™ e poucos outros), e
// bastava UM caractere fora dele — o ✅, o → ou o 🙏 que o celular põe na
// pauta — para o jsPDF gravar a linha INTEIRA em 2 bytes por letra: conforme o
// leitor de PDF, ela saía espaçada ou ilegível, e o símbolo virava lixo ("'",
// "!", "Ø=ÞO"). Os sinais com sentido viram texto; o resto (emoji, seletor de
// variação, letra de outro alfabeto, caractere de controle) sai. O tab vira
// espaço: a largura que o splitTextToSize calcula tem de ser a do que sai.
// Só a linha que perdeu algo tem os espaços acertados ("combinadas 🙏 ok" não
// fica com espaço duplo); a que veio limpa não é mexida.
const FORA_DO_WINANSI = /[^\n\x20-\x7E\xA0-\xFF€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]+/gu;
export function textoParaPdf(texto) {
  if (texto == null) return '';
  return String(texto)
    .replace(/\r\n?/g, '\n')
    .replace(/[\t -   　]/g, ' ')
    .replace(/[✓✔✅☑]/g, '(ok)')
    .replace(/[✗✘❌❎]/g, '(x)')
    .replace(/[→⇒➔➜➡⟶]/g, '->')
    .replace(/[←⇐⬅⟵]/g, '<-')
    .replace(/[‐‑‒−]/g, '-')
    .split('\n')
    .map(l => {
      const sem = l.replace(FORA_DO_WINANSI, '');
      return sem === l ? l : sem.replace(/ {2,}/g, ' ').trim();
    })
    .join('\n');
}

// Qualquer valor GRAVADO → texto do PDF. O formulário só grava texto, mas um
// domingo importado de planilha (ou de uma versão antiga) pode ter o hino como
// número, uma lista ou um objeto — e bastava um `primeiroHino: 123` para o
// .trim() estourar no meio da ata: o PDF não saía e, para quem tocou no botão,
// "nada acontecia". Texto passa pelo textoParaPdf; número e verdadeiro/falso
// viram texto; lista vira os itens separados por vírgula (lista dentro de
// lista também), sem os que ficaram vazios; o resto (null, objeto, data) não
// sai. Item a item: um 🙏 sozinho na lista não deixa ", " sobrando.
export function valorParaPdf(valor, nivel = 0) {
  if (typeof valor === 'string') return textoParaPdf(valor);
  if (typeof valor === 'number') return Number.isFinite(valor) ? String(valor) : '';
  if (typeof valor === 'boolean' || typeof valor === 'bigint') return String(valor);
  // o limite de níveis só protege de uma lista que contém a si mesma
  if (Array.isArray(valor) && nivel < 20) {
    return valor.map(v => valorParaPdf(v, nivel + 1).trim()).filter(Boolean).join(', ');
  }
  return '';
}

// "Reunião do Bispado" → "reuniao-do-bispado": sem acento (o arquivo vai para
// WhatsApp, e-mail, Drive — nem todos tratam bem), minúsculo, o resto vira hífen.
const slug = txt => String(txt ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// ata-reuniao-do-bispado-2026-10-15.pdf. Só "ata-<data>" deixava duas reuniões
// do mesmo dia (Bispado e Conselho da Ala) com o mesmo nome — na pasta de
// downloads não dava para saber qual era qual. A data fica em AAAA-MM-DD, que
// põe os arquivos em ordem.
export function nomeArquivoAta(rotuloTipo, data) {
  return `ata-${slug(rotuloTipo) || 'reuniao'}-${slug(data) || 'sem-data'}.pdf`;
}

// Ata resolvida = reunião que já passou e não tem item de ação em aberto (a
// que nem teve itens também conta). Sai da tela da aba Reuniões e vira
// histórico: a busca da aba, a busca geral e o filtro "Histórico" ainda a acham.
// A de hoje ou futura fica na tela mesmo sem pendência — é a pauta que vem.
// `hoje` em AAAA-MM-DD (dataLocal), por parâmetro: este módulo não tem DOM.
export function ataResolvida(r, hoje) {
  if (!r || typeof r !== 'object') return false;
  const data = typeof r.data === 'string' ? r.data : '';
  if (!data || !hoje || data >= hoje) return false;
  return !(Array.isArray(r.itens) ? r.itens : []).some(i => i && !i.feito);
}
