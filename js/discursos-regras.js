// =============================================
// REGRAS DO RODÍZIO DE DISCURSOS (sem DOM)
// Usadas pela aba Sacramental (sacramental.js, rodizio.js), pelo Início, pela
// fila offline (pendentes.js) e pela function /api/sacramentais. Por isso não
// tocam em document, em DADOS nem em config.js (que lê location) — e os testes
// rodam direto no Node (tests/discursos-regras.test.mjs).
//
// O Manual Geral atual (29.2.1.4) diz só que o bispado escolhe os oradores e os
// convida "com bastante antecedência"; a reunião dura uma hora (29.2.1.1).
// 5/10/15 minutos e o jovem no 1º discurso são COSTUME — vêm do Manual 2 (2019)
// —, por isso ficam aqui como padrões editáveis, nunca como regra.
// =============================================
import { dataLocal, norm, partesDoNascimento } from './utils.js';

// ---------- constantes ----------
export const TEMPO_PADRAO = { 1: 5, 2: 10, 3: 15 };
export const TEMPOS_OPCOES = [5, 10, 15, 20];
export const POSICOES = [1, 2, 3];
export const INTERVALO_MESES = 6;      // quem falou há menos que isto vai para uma lista à parte
export const JOVEM_PRIMEIRO = true;    // costume: o jovem faz o 1º discurso
export const SEMANAS_PLANO = 8;
export const MAIS_SEMANAS = 4;
export const MAX_SEMANAS = 26;
export const ANTECEDENCIA_DIAS = 21;   // o Início cobra as vagas destes próximos dias
export const SEM_RESPOSTA_DIAS = 3;
export const LEMBRETE_DIAS = 7;
export const MINUTOS_ALERTA = 35;
export const IDADE_MINIMA = 8;
export const NOVOS_MESES = 12;         // "Membros novos" volta ao automático depois disto
export const PAUSAS_MESES = [3, 6];
export const CORES_POSICAO = { 1: '#34d399', 2: '#a78bfa', 3: '#e8b040' };

// vagas: se o domingo tem as 3 vagas; cobra: se o Início cobra oradores;
// conta: se os discursos entram no histórico do rodízio
export const TIPOS_DOMINGO = {
  '':            { rotulo: 'Não marcado',                                curto: '',                resumo: '',                                               vagas: true,  cobra: true,  conta: true  },
  normal:        { rotulo: 'Reunião normal',                             curto: '',                resumo: '',                                               vagas: true,  cobra: true,  conta: true  },
  jejum:         { rotulo: 'Jejum e testemunhos',                        curto: 'Jejum',           resumo: 'Jejum e testemunhos — sem oradores designados',  vagas: false, cobra: false, conta: false },
  'conf-geral':  { rotulo: 'Conferência geral — sem reunião na ala',     curto: 'Conf. geral',     resumo: 'Conferência geral — sem reunião na ala',         vagas: false, cobra: false, conta: false, semReuniao: true },
  'conf-estaca': { rotulo: 'Conferência de estaca — sem reunião na ala', curto: 'Conf. de estaca', resumo: 'Conferência de estaca — sem reunião na ala',     vagas: false, cobra: false, conta: false, semReuniao: true },
  'conf-ala':    { rotulo: 'Conferência de ala — oradores da estaca',    curto: 'Conf. de ala',    resumo: 'Conferência de ala — oradores da estaca',        vagas: false, cobra: false, conta: false },
  primaria:      { rotulo: 'Apresentação da Primária',                   curto: 'Primária',        resumo: 'Apresentação da Primária',                       vagas: false, cobra: false, conta: false },
  especial:      { rotulo: 'Programa especial (Páscoa, Natal, musical)', curto: 'Especial',        resumo: '',                                               vagas: true,  cobra: false, conta: true  },
};
export const ORDEM_TIPOS = ['normal', 'jejum', 'conf-geral', 'conf-estaca', 'conf-ala', 'primaria', 'especial'];
const temTipo = t => Object.prototype.hasOwnProperty.call(TIPOS_DOMINGO, t);
export const tipoDe = sac => TIPOS_DOMINGO[temTipo(sac?.tipo) ? sac.tipo : ''];

// As organizações da planilha "Discursantes em Potencial". JAS e Membros novos
// só por marcação manual: o LCR não traz estado civil nem data de entrada.
export const GRUPOS = [
  { id: 'quorum',   rotulo: 'Quórum de Élderes', curto: 'Quórum',        cor: '#a78bfa' },
  { id: 'ss',       rotulo: 'Soc. Socorro',      curto: 'Soc. Socorro',  cor: '#f472b6' },
  { id: 'rapazes',  rotulo: 'Rapazes',           curto: 'Rapazes',       cor: '#60a5fa' },
  { id: 'mocas',    rotulo: 'Moças',             curto: 'Moças',         cor: '#f9a8d4' },
  { id: 'jas',      rotulo: 'JAS',               curto: 'JAS',           cor: '#e8b040' },
  { id: 'novos',    rotulo: 'Membros novos',     curto: 'Membros novos', cor: '#2dd4bf' },
  { id: 'primaria', rotulo: 'Primária',          curto: 'Primária',      cor: '#34d399' },
  { id: 'outros',   rotulo: 'Outros',            curto: 'Outros',        cor: '#94a3b8' },
];
export const GRUPOS_JOVENS = ['rapazes', 'mocas'];
const GRUPO = Object.fromEntries(GRUPOS.map(g => [g.id, g]));
export const grupoValido = g => Object.prototype.hasOwnProperty.call(GRUPO, g);
export const infoGrupo = g => GRUPO[g] || GRUPO.outros;

export const ROTULO_ESTADO = {
  vazia: 'Vaga aberta',
  dispensada: 'Sem este discurso',
  'a-convidar': 'A convidar',
  convidado: 'Aguardando resposta',
  aceito: 'Confirmado',
  recusou: 'Não poderá',
  fora: 'De fora da ala',
  realizado: 'Discursou',
};

// ---------- datas (sempre por partes: new Date('AAAA-MM-DD') é meia-noite UTC,
// que aqui ainda é o dia anterior) ----------
const DATA = /^(\d{4})-(\d{2})-(\d{2})$/;
export function partesData(dk) {
  const r = DATA.exec(String(dk || ''));
  if (!r) return null;
  const a = +r[1], m = +r[2], d = +r[3];
  const t = new Date(a, m - 1, d);
  return t.getFullYear() === a && t.getMonth() === m - 1 && t.getDate() === d ? { a, m, d, t } : null;
}
export const dataValida = dk => !!partesData(dk);
export const ehDomingo = dk => partesData(dk)?.t.getDay() === 0;

export function somarDias(dk, k) {
  const p = partesData(dk);
  return p ? dataLocal(new Date(p.a, p.m - 1, p.d + k)) : '';
}

// O dia é limitado ao fim do mês: 31/01 + 1 mês = 28 ou 29/02
export function somarMeses(dk, k) {
  const p = partesData(dk);
  if (!p) return '';
  const alvo = new Date(p.a, p.m - 1 + k, 1);
  const ultimo = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
  return dataLocal(new Date(alvo.getFullYear(), alvo.getMonth(), Math.min(p.d, ultimo)));
}

export function diasEntre(a, b) {
  const pa = partesData(a), pb = partesData(b);
  if (!pa || !pb) return NaN;
  return Math.round((Date.UTC(pb.a, pb.m - 1, pb.d) - Date.UTC(pa.a, pa.m - 1, pa.d)) / 86400000);
}

export function mesesEntre(a, b) {
  const pa = partesData(a), pb = partesData(b);
  if (!pa || !pb) return NaN;
  return (pb.a * 12 + pb.m) - (pa.a * 12 + pa.m) - (pb.d < pa.d ? 1 : 0);
}

export function proximoDomingo(dk) {
  const p = partesData(dk);
  if (!p) return '';
  const dia = p.t.getDay();
  return dia === 0 ? dk : somarDias(dk, 7 - dia);
}

export function proximosDomingos(desde, k) {
  const primeiro = proximoDomingo(desde);
  if (!primeiro) return [];
  return Array.from({ length: Math.max(0, k) }, (_, i) => somarDias(primeiro, 7 * i));
}

// Só uma dica para o 1º domingo do mês: jejum, ou a conferência geral em abril
// e outubro. Nunca grava — o jejum muda de domingo quando há conferência.
export function tipoProvavel(dk) {
  const p = partesData(dk);
  if (!p || p.t.getDay() !== 0 || p.d > 7) return '';
  return p.m === 4 || p.m === 10 ? 'conf-geral' : 'jejum';
}

const MESES_EXTENSO = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const mesPorExtenso = m => MESES_EXTENSO[m - 1] || '';

// "domingo, 18 de outubro" (+ " de 2027" em outro ano; + ", às 9h" com horário)
export function quandoPorExtenso(dk, horario = '', hojeKey = '') {
  const p = partesData(dk);
  if (!p) return '';
  let s = `domingo, ${p.d} de ${MESES_EXTENSO[p.m - 1]}`;
  if (!hojeKey || String(p.a) !== String(hojeKey).slice(0, 4)) s += ` de ${p.a}`;
  const h = /^(\d{1,2}):(\d{2})$/.exec(String(horario || '').trim());
  if (h) s += `, às ${+h[1]}h${h[2] === '00' ? '' : h[2]}`;
  return s;
}

// ---------- nomes ----------
// A identidade da pessoa é a CHAVE do nome — o id do membro muda a cada
// importação do LCR e pode ser reaproveitado por outra pessoa.
// Comparados com o acento: "Irmã"/"Élder" são tratamento; "Irma"/"Elder" são
// prenomes comuns e ficam. E nada é tirado de um nome no formato do LCR
// ("Sobrenome, Prenomes"), que nunca traz tratamento.
const TRATAMENTOS = new Set(['irmão', 'irmã', 'irmao', 'ir', 'irm', 'élder', 'bispo', 'presidente', 'pres', 'sr', 'sra', 'dona']);
const PARTICULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
const ehTratamento = p => TRATAMENTOS.has(String(p).toLowerCase().replace(/[.,;:]+$/, ''));

// "Sobrenome, Prenomes" (formato do LCR) → "Prenomes Sobrenome"
export function nomeNatural(nome) {
  const s = String(nome || '').replace(/\s+/g, ' ').trim();
  const i = s.indexOf(',');
  if (i < 0) return s;
  const sobrenome = s.slice(0, i).trim(), prenomes = s.slice(i + 1).trim();
  return prenomes ? `${prenomes} ${sobrenome}`.trim() : sobrenome;
}

function palavrasSemTratamento(nome) {
  const p = nomeNatural(nome).split(' ').filter(Boolean);
  if (!String(nome || '').includes(',')) while (p.length > 1 && ehTratamento(p[0])) p.shift();
  return p;
}

// "Ana Beatriz Fictícia Souza" → "Ana Souza"
export function nomeCurto(nome) {
  const p = palavrasSemTratamento(nome);
  return p.length <= 2 ? p.join(' ') : `${p[0]} ${p[p.length - 1]}`;
}

// "Irmã Ana Souza" → "Ana"
export const primeiroNomeDe = nome => palavrasSemTratamento(nome)[0] || '';

const palavrasNormais = nome => norm(palavrasSemTratamento(nome).join(' ')).replace(/[^a-z0-9 ]+/g, ' ').split(' ').filter(Boolean);

// A chave casa o nome digitado com o do quadro: sem acento, tratamento,
// partícula nem a vírgula do LCR ("Exemplo da Lima, Bruno" = "Bruno Exemplo Lima")
export const chavePessoa = nome => palavrasNormais(nome).filter(x => !PARTICULAS.has(x)).join(' ');

// Mais estrita, COM as partículas: para decidir se o nome trocado na ata é outra
// pessoa ("Maria de Souza" e "Maria Souza" podem ser duas irmãs da ala)
export const chaveEstrita = nome => palavrasNormais(nome).join(' ');

// chave → [membros]. Telefone, sexo e idade só saem de uma chave com UM membro:
// com homônimos, o convite poderia ir para a pessoa errada.
export function indiceDoQuadro(membros = [], saidos = []) {
  const fora = new Set(saidos);
  const ind = new Map();
  for (const m of membros) {
    if (!m || !m.name || fora.has(m.id)) continue;
    const k = chavePessoa(m.name);
    if (!k) continue;
    if (!ind.has(k)) ind.set(k, []);
    ind.get(k).push(m);
  }
  return ind;
}

export function membroDaChave(chave, indice) {
  const l = chave && indice ? indice.get(chave) : null;
  return l && l.length === 1 ? l[0] : null;
}

// "Você quis dizer…?": membros cujo nome contém todas as palavras digitadas,
// com o mesmo primeiro nome. Só sugestão — nunca alimenta telefone nem mensagem.
export function parecidos(nome, indice, limite = 3) {
  const k = chavePessoa(nome);
  const pal = k.split(' ').filter(Boolean);
  if (!pal.length || !indice) return [];
  const achados = [];
  for (const [chave, lista] of indice) {
    if (chave === k || lista.length !== 1) continue;
    const dele = chave.split(' ');
    if (dele[0] !== pal[0]) continue;
    if (pal.every(w => dele.includes(w))) achados.push(lista[0]);
    if (achados.length >= limite) break;
  }
  return achados;
}

// ---------- pessoas e grupos ----------
export function idadeEm(p, dk) {
  const h = partesData(dk);
  if (!p || !h) return NaN;
  return h.a - p.a - ((h.m < p.m || (h.m === p.m && h.d < p.d)) ? 1 : 0);
}

// Pelo sexo e pelo nascimento do LCR (a `age` envelhece desde a importação).
// O jovem sai da Primária em janeiro do ano em que faz 12 (Manual 12.1.4).
export function grupoAuto(membro, hojeKey) {
  if (!membro) return 'outros';
  const p = partesDoNascimento(membro.nascimento);
  let idade;
  if (p) {
    if (+String(hojeKey).slice(0, 4) < p.a + 12) return 'primaria';
    idade = idadeEm(p, hojeKey);
  } else if (membro.age > 0) {
    idade = membro.age;
    if (idade < 12) return 'primaria';
  } else {
    return 'outros';
  }
  const sexo = membro.gender;
  if (sexo !== 'M' && sexo !== 'F') return 'outros';
  if (idade < 18) return sexo === 'F' ? 'mocas' : 'rapazes';
  return sexo === 'F' ? 'ss' : 'quorum';
}

export function grupoDe(membro, ajuste, hojeKey) {
  const g = ajuste?.grupo;
  if (grupoValido(g)) {
    if (g !== 'novos') return g;
    if (dataValida(ajuste.grupoEm) && mesesEntre(ajuste.grupoEm, hojeKey) < NOVOS_MESES) return g;
  }
  return membro ? grupoAuto(membro, hojeKey) : 'outros';
}

export const pausadoEm = (ajuste, dk) => dataValida(ajuste?.pausaAte) && ajuste.pausaAte >= dk;

// Para a concordância da mensagem. Menor = o telefone costuma ser da família.
export function perfilParaMensagem(pessoa, dk) {
  const membro = pessoa?.membro || null;
  const grupo = pessoa?.grupo || '';
  let genero = membro && (membro.gender === 'M' || membro.gender === 'F') ? membro.gender : '';
  if (!genero) genero = ['rapazes', 'quorum'].includes(grupo) ? 'M' : ['mocas', 'ss'].includes(grupo) ? 'F' : '';
  let menor;
  const p = membro ? partesDoNascimento(membro.nascimento) : null;
  if (p) menor = idadeEm(p, dk) < 18;
  else if (membro && membro.age > 0) menor = membro.age < 18;
  else menor = ['primaria', 'rapazes', 'mocas'].includes(grupo);
  return { genero, menor };
}

const idadeConhecida = (m, hojeKey) => {
  const p = partesDoNascimento(m.nascimento);
  if (p) return idadeEm(p, hojeKey);
  return m.age > 0 ? m.age : NaN;
};

// O pool do rodízio: o quadro ativo + quem foi ajustado/adicionado à mão + quem
// já aparece nos domingos. Com o quadro vazio, funciona com os dois últimos.
export function montarPessoas({ membros = [], saidos = [], oradores = [], historico = new Map(), hojeKey }) {
  const pessoas = new Map();
  const fora = new Set(saidos);
  const chavesSaidas = new Set(membros.filter(m => m && fora.has(m.id)).map(m => chavePessoa(m.name)));
  const indice = indiceDoQuadro(membros, saidos);
  const docs = new Map();
  for (const o of oradores) if (o && o.chave && !docs.has(o.chave)) docs.set(o.chave, o);

  for (const [chave, lista] of indice) {
    const membro = lista.length === 1 ? lista[0] : null;
    if (membro && idadeConhecida(membro, hojeKey) < IDADE_MINIMA) continue;
    pessoas.set(chave, { chave, nome: nomeNatural(lista[0].name), membro, homonimos: lista.length });
  }
  const acrescentar = (chave, nome) => {
    if (!chave || pessoas.has(chave) || chavesSaidas.has(chave)) return;
    pessoas.set(chave, { chave, nome: nomeNatural(nome), membro: null, homonimos: 0 });
  };
  for (const [chave, o] of docs) acrescentar(chave, o.nome || chave);
  for (const [chave, h] of historico) acrescentar(chave, h.nome || chave);

  for (const p of pessoas.values()) {
    const ajuste = docs.get(p.chave) || null;
    const hist = historico.get(p.chave) || null;
    p.ajuste = ajuste;
    p.hist = hist;
    p.grupo = grupoDe(p.membro, ajuste, hojeKey);
    p.vezes = hist ? hist.discursos.length : 0;
    p.planejadas = hist ? hist.planejadas : [];
    p.pausadoAte = pausadoEm(ajuste, hojeKey) ? ajuste.pausaAte : '';
    const doApp = hist && hist.discursos[0] ? { data: hist.discursos[0].data, n: hist.discursos[0].n } : null;
    const manual = ajuste && dataValida(ajuste.ultimoManual) && ajuste.ultimoManual <= hojeKey ? { data: ajuste.ultimoManual, n: null } : null;
    p.ultimo = !doApp ? manual : !manual ? doApp : (manual.data > doApp.data ? manual : doApp);
  }
  return pessoas;
}

// Lista branca do documento de /api/oradores: nada de motivo, telefone,
// nascimento ou id de membro — a API não tem autenticação.
export function docOrador(form, anterior, hojeKey) {
  const campos = {};
  const nome = String(form?.nome ?? anterior?.nome ?? '').trim();
  campos.nome = nomeNatural(nome);
  campos.chave = chavePessoa(nome) || anterior?.chave || '';
  const g = grupoValido(form?.grupo) ? form.grupo : '';
  campos.grupo = g;
  campos.grupoEm = g === 'novos'
    ? (anterior?.grupo === 'novos' && dataValida(anterior.grupoEm) ? anterior.grupoEm : hojeKey)
    : '';
  const pos = String(form?.posicao ?? '');
  campos.posicao = ['1', '2', '3'].includes(pos) ? pos : '';
  const ult = String(form?.ultimo ?? '');
  campos.ultimoManual = dataValida(ult) && ult <= hojeKey ? ult : '';
  const pausa = String(form?.pausa ?? '');
  if (pausa === 'manter') campos.pausaAte = dataValida(anterior?.pausaAte) ? anterior.pausaAte : '';
  else if (PAUSAS_MESES.map(String).includes(pausa)) campos.pausaAte = somarMeses(hojeKey, +pausa);
  else campos.pausaAte = '';
  const padrao = !campos.grupo && !campos.posicao && !campos.ultimoManual && !campos.pausaAte;
  return { campos, padrao };
}

export const grupoDoBancoAntigo = g => ({ quorum: 'quorum', socsoc: 'ss' })[g] || '';

// ---------- vagas ----------
export const camposDaVaga = n => ['orador' + n, 'tema' + n, 'orador' + n + 'Min', 'orador' + n + 'Status',
  'orador' + n + 'Chave', 'orador' + n + 'ConvidadoEm', 'orador' + n + 'RespostaEm', 'orador' + n + 'Por', 'orador' + n + 'Fora'];

export function camposVagaVazia(n) {
  const c = Object.fromEntries(camposDaVaga(n).map(k => [k, '']));
  c['orador' + n + 'Fora'] = false;
  return c;
}

export function minutosDaVaga(sac, n) {
  const v = sac?.['orador' + n + 'Min'];
  const num = typeof v === 'number' ? v : (/^\d+$/.test(String(v ?? '').trim()) ? +String(v).trim() : NaN);
  return Number.isInteger(num) && num >= 1 && num <= 30 ? num : TEMPO_PADRAO[n];
}

export function somaMinutos(sac) {
  if (!tipoDe(sac).vagas) return 0;
  return POSICOES.filter(n => (sac?.['orador' + n + 'Status'] || '') !== 'dispensada' || String(sac?.['orador' + n] || '').trim())
    .reduce((t, n) => t + minutosDaVaga(sac, n), 0);
}

// O PRIMEIRO registro com a data: o mesmo critério da tela, do PDF e do upsert
// do servidor (registros duplicados antigos continuam lá).
export function registroDoDomingo(lista, dk) {
  return (Array.isArray(lista) ? lista : []).find(s => s && s.data === dk) || null;
}

// Estado de uma vaga. O status, as datas e o "por" só valem para a pessoa da
// orador{n}Chave: um "Aceitou" de uma tela atrasada, depois que outro aparelho
// trocou o orador, grava a chave antiga e não passa para a pessoa nova.
export function estadoDaVaga(sac, n, hojeKey) {
  const nome = String(sac?.['orador' + n] ?? '').trim();
  const chaveOk = String(sac?.['orador' + n + 'Chave'] ?? '') === chavePessoa(nome);
  const st = chaveOk ? String(sac?.['orador' + n + 'Status'] || '') : '';
  if (!nome) return String(sac?.['orador' + n + 'Status'] || '') === 'dispensada' ? 'dispensada' : 'vazia';
  if (sac?.data && sac.data < hojeKey) return st === 'recusou' ? 'recusou' : 'realizado';
  if (sac?.['orador' + n + 'Fora'] === true) return 'fora';
  if (st === 'convidado' || st === 'aceito' || st === 'recusou') return st;
  return 'a-convidar';
}

// Toda troca de pessoa zera o convite: a resposta era de outra pessoa.
// Tema e tempo ficam como estão.
export function camposAoTrocarOrador(n, nome, { passado = false, fora = false } = {}) {
  const nm = String(nome || '').trim();
  return {
    ['orador' + n]: nm,
    ['orador' + n + 'Chave']: chavePessoa(nm),
    ['orador' + n + 'Status']: !nm ? '' : passado ? '' : 'planejado',
    ['orador' + n + 'ConvidadoEm']: '',
    ['orador' + n + 'RespostaEm']: '',
    ['orador' + n + 'Por']: '',
    ['orador' + n + 'Fora']: !!fora && !!nm,
  };
}

// Só o que mudou: o formulário da ata manda o diff, para não desfazer o que
// outro aparelho gravou nos outros campos (o PUT do servidor faz merge raso).
const normalizar = v => v === true ? 'true' : (v === false || v === null || v === undefined) ? '' : String(v).trim();
export function diffCampos(antes = {}, depois = {}) {
  const d = {};
  for (const k of Object.keys(depois)) if (normalizar(antes[k]) !== normalizar(depois[k])) d[k] = depois[k];
  return d;
}

// Upsert por data (servidor e fila offline): um aparelho que não via o domingo
// nunca sobrescreve a vaga que outro já preencheu com outra pessoa.
// Também: um POST nunca apaga o que já está preenchido (as escritas novas
// mandam só o que mudou e limpam por PUT; um POST com '' só vem de aparelho que
// não via o domingo, ou da fila de uma versão antiga, que mandava a ata inteira),
// e o convite já feito a esta mesma pessoa não volta a "planejado".
const NIVEL_STATUS = { '': 0, planejado: 1, convidado: 2, recusou: 3, aceito: 3, dispensada: 3 };
const vazio = v => v === false || v === null || v === undefined || String(v).trim() === '';
export function fundirDomingo(existente, corpo) {
  const c = { ...corpo };
  const descartados = [];
  for (const n of POSICOES) {
    if (!Object.prototype.hasOwnProperty.call(c, 'orador' + n)) continue;
    const atual = String(existente?.['orador' + n] ?? '').trim();
    if (!atual) continue;
    const chave = chavePessoa(atual);
    if (chave !== chavePessoa(c['orador' + n])) {
      for (const k of camposDaVaga(n)) delete c[k];
      descartados.push(n);
      continue;
    }
    // a mesma pessoa: o estado do convite que já está lá não é rebaixado
    const stLa = String(existente['orador' + n + 'Chave'] ?? '') === chave ? String(existente['orador' + n + 'Status'] || '') : '';
    const stAqui = String(c['orador' + n + 'Status'] ?? '');
    if ((NIVEL_STATUS[stAqui] ?? 0) < (NIVEL_STATUS[stLa] ?? 0)) {
      for (const k of ['Status', 'Chave', 'ConvidadoEm', 'RespostaEm', 'Por']) delete c['orador' + n + k];
    }
  }
  for (const k of Object.keys(c)) if (vazio(c[k]) && !vazio(existente?.[k])) delete c[k];
  return { registro: { ...existente, ...c }, descartados };
}

// ---------- rodízio ----------
// Histórico derivado dos domingos gravados — nada é guardado à parte (o merge
// raso perderia um array). A ata corrigida é a verdade.
export function historicoDiscursos(sacramentais, hojeKey) {
  const hist = new Map();
  const lista = Array.isArray(sacramentais) ? sacramentais : [];
  const datas = [...new Set(lista.filter(s => s && ehDomingo(s.data)).map(s => s.data))].sort();
  for (const dk of datas) {
    const sac = registroDoDomingo(lista, dk);
    if (!tipoDe(sac).conta) continue;
    for (const n of POSICOES) {
      const nome = String(sac['orador' + n] ?? '').trim();
      if (!nome || sac['orador' + n + 'Fora'] === true) continue;
      const est = estadoDaVaga(sac, n, hojeKey);
      if (est === 'recusou' || est === 'dispensada') continue;
      const chave = chavePessoa(nome);
      if (!chave) continue;
      if (!hist.has(chave)) hist.set(chave, { nome: nomeNatural(nome), discursos: [], planejadas: [] });
      const h = hist.get(chave);
      if (dk < hojeKey) h.discursos.unshift({ data: dk, n, tema: String(sac['tema' + n] || '') });
      else h.planejadas.push({ data: dk, n, estado: est });
    }
  }
  return hist;
}

// FNV-1a 32 bits: desempate que não favorece a ordem alfabética nem muda a
// cada atualização de 30 s
export function hashEstavel(s) {
  let h = 0x811c9dc5;
  for (const ch of String(s)) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

const FILTROS_SUGESTAO = {
  sugeridos: g => g !== 'primaria',
  jovens: g => GRUPOS_JOVENS.includes(g),
  adultos: g => ['quorum', 'ss', 'jas', 'novos', 'outros'].includes(g),
  primaria: g => g === 'primaria',
  todos: () => true,
};

// "este mês" / "há 1 mês" / "há N meses"
export const haMeses = m => m < 1 ? 'este mês' : m === 1 ? 'há 1 mês' : `há ${m} meses`;

// `hojeKey`: o texto ("há 4 meses") conta até hoje; o corte dos 6 meses conta
// até o domingo da vaga
export function sugerirParaVaga({ pessoas, dk, n, ocupadas = new Map(), gruposNoDomingo = new Set(), filtro = 'sugeridos', hojeKey = dk }) {
  const passa = FILTROS_SUGESTAO[filtro] || FILTROS_SUGESTAO.sugeridos;
  const lista = [], recentes = [];
  const jovem = p => GRUPOS_JOVENS.includes(p.grupo);
  for (const p of (pessoas instanceof Map ? pessoas.values() : pessoas || [])) {
    if (!passa(p.grupo) || pausadoEm(p.ajuste, dk)) continue;
    const ocupada = (ocupadas.get(p.chave) || [])[0] || null;
    if (ocupada && filtro === 'sugeridos') continue;
    let afinidade;
    const pos = String(p.ajuste?.posicao || '');
    if (pos) afinidade = pos === String(n) ? 0 : 2;
    else if (JOVEM_PRIMEIRO) afinidade = n === 1 ? (jovem(p) ? 0 : 1) : (jovem(p) ? 2 : 0);
    else afinidade = 0;
    if (gruposNoDomingo.has(p.grupo)) afinidade += 1;
    const meses = p.ultimo ? mesesEntre(p.ultimo.data, dk) : null;
    const partes = [infoGrupo(p.grupo).curto,
      meses === null ? 'nunca discursou' : haMeses(Math.max(0, mesesEntre(p.ultimo.data, hojeKey)))];
    if (pos && pos === String(n)) partes.push(`prefere o ${n}º`);
    if (n === 1 && jovem(p)) partes.push('jovem');
    const item = { pessoa: p, motivo: partes.join(' · '), ocupada,
      _ord: [afinidade, p.ultimo ? 1 : 0, p.ultimo ? p.ultimo.data : '', hashEstavel(p.chave + '|' + dk + '|' + n)] };
    if (meses !== null && meses < INTERVALO_MESES) recentes.push(item); else lista.push(item);
  }
  const cmp = (a, b) => {
    for (let i = 0; i < a._ord.length; i++) {
      if (a._ord[i] < b._ord[i]) return -1;
      if (a._ord[i] > b._ord[i]) return 1;
    }
    return 0;
  };
  const limpar = l => l.sort(cmp).map(({ _ord, ...resto }) => resto);
  return { lista: limpar(lista), recentes: limpar(recentes) };
}

// Ordem da vista Rodízio: sem pausa primeiro; quem nunca discursou; o último
// discurso mais antigo; depois o nome.
export function ordenarRodizio(pessoas) {
  return [...pessoas].sort((a, b) =>
    (a.pausadoAte ? 1 : 0) - (b.pausadoAte ? 1 : 0)
    || (a.ultimo ? 1 : 0) - (b.ultimo ? 1 : 0)
    || String(a.ultimo?.data || '').localeCompare(String(b.ultimo?.data || ''))
    || a.nome.localeCompare(b.nome, 'pt-BR'));
}

// ---------- convite ----------
const ORD = { M: 'º', F: 'ª', '': 'º' };

export function assinaturaConvite(cod, nome, ala) {
  const n = String(nome || '').trim();
  switch (cod) {
    case 'bispo': return n ? `o Bispo ${n}, da ${ala}` : `o bispo da ${ala}`;
    case 'c1':
    case 'c2': {
      const ordem = cod === 'c1' ? '1º' : '2º';
      return n ? `o irmão ${n}, ${ordem} conselheiro do bispado da ${ala}` : `o ${ordem} conselheiro do bispado da ${ala}`;
    }
    case 'sec': return n ? `o irmão ${n}, secretário da ${ala}` : `o secretário da ${ala}`;
    case 'se': return n ? `o irmão ${n}, secretário executivo da ${ala}` : `o secretário executivo da ${ala}`;
    default: return `o bispado da ${ala}`;
  }
}

// Texto do convite e do lembrete. Só o primeiro nome, a data, a posição, o
// tempo, o tema e quem convida: a prévia aparece na tela bloqueada, muitas
// vezes no celular da família. Nada de link, telefone, sobrenome ou outros oradores.
export function mensagemDiscurso({ tipo = 'convite', nome, genero = '', menor = false, n, dk, minutos, tema = '', horario = '', assinatura, hojeKey = '' }) {
  const Nome = primeiroNomeDe(nome) || String(nome || '').trim();
  const quando = quandoPorExtenso(dk, horario, hojeKey);
  const min = minutos || TEMPO_PADRAO[n];
  const t = String(tema || '').trim();
  const F = genero === 'F', M = genero === 'M';
  const ord = `${n}${ORD[genero] || 'º'}`;
  const papel = F ? `a ${ord} oradora` : `o ${ord} orador`;
  const tratamento = F ? 'irmã' : 'irmão';

  if (tipo === 'lembrete') {
    const temaTxt = t ? `. Tema: "${t}"` : '';
    if (menor) {
      if (F || M) {
        return `Olá! Aqui é ${assinatura}. Passando para lembrar do discurso ${F ? 'da' : 'do'} ${Nome} no ${quando}: ${F ? 'ela' : 'ele'} será ${papel}, com cerca de ${min} minutos${temaTxt}. Obrigado!`;
      }
      return `Olá! Aqui é ${assinatura}. Passando para lembrar do discurso de ${Nome} no ${quando}: será o ${n}º discurso, com cerca de ${min} minutos${temaTxt}. Obrigado!`;
    }
    if (F || M) {
      return `Olá, ${tratamento} ${Nome}! Aqui é ${assinatura}. Passando para lembrar do seu discurso no ${quando}: você será ${papel}, com cerca de ${min} minutos${temaTxt}. Obrigado por aceitar!`;
    }
    return `Olá, ${Nome}! Aqui é ${assinatura}. Passando para lembrar do seu discurso no ${quando}: você fará o ${n}º discurso, com cerca de ${min} minutos${temaTxt}. Obrigado por aceitar!`;
  }

  if (menor) {
    const temaTxt = t ? `Tema: "${t}".` : 'Sobre o tema, conversamos em seguida.';
    if (F || M) {
      return `Olá! Aqui é ${assinatura}.\n\n` +
        `Gostaríamos de convidar ${F ? 'a' : 'o'} ${Nome} para ser ${papel} na reunião sacramental do ${quando}.\n\n` +
        `${F ? 'Ela' : 'Ele'} teria cerca de ${min} minutos. ${temaTxt}\n\n` +
        'Pode nos confirmar por aqui? Obrigado!';
    }
    return `Olá! Aqui é ${assinatura}.\n\n` +
      `Gostaríamos de convidar ${Nome} para fazer o ${n}º discurso na reunião sacramental do ${quando}.\n\n` +
      `O discurso teria cerca de ${min} minutos. ${temaTxt}\n\n` +
      'Pode nos confirmar por aqui? Obrigado!';
  }

  const temaTxt = t ? `Tema: "${t}".` : 'Sobre o tema, conversamos com você em seguida.';
  if (F || M) {
    return `Olá, ${tratamento} ${Nome}! Aqui é ${assinatura}.\n\n` +
      `Gostaríamos de ${F ? 'convidá-la' : 'convidá-lo'} para ser ${papel} na reunião sacramental do ${quando}.\n\n` +
      `Você teria cerca de ${min} minutos. ${temaTxt}\n\n` +
      'Pode nos responder por aqui se aceita? Obrigado!';
  }
  return `Olá, ${Nome}! Aqui é ${assinatura}.\n\n` +
    `Gostaríamos de convidar você para fazer o ${n}º discurso na reunião sacramental do ${quando}.\n\n` +
    `Você teria cerca de ${min} minutos. ${temaTxt}\n\n` +
    'Pode nos responder por aqui se aceita? Obrigado!';
}

// ---------- Início ----------
const pl = (k, um, varios) => `${k} ${k === 1 ? um : varios}`;

// A pergunta "é jejum?" só cabe no 1º domingo sem tipo marcado e ainda sem
// nenhum orador: com orador escolhido, a reunião é normal.
export function perguntarTipo(sac, dk) {
  if (sac?.tipo) return '';
  if (POSICOES.some(n => String(sac?.['orador' + n] ?? '').trim())) return '';
  return tipoProvavel(dk);
}

export function resumoDomingo(sac, dk, hojeKey) {
  const tipo = tipoDe(sac);
  if (!tipo.vagas) return tipo.resumo;
  const provavel = perguntarTipo(sac, dk);
  if (provavel) return `📅 1º domingo do mês — marque se é ${provavel === 'jejum' ? 'jejum' : 'conferência geral'}`;
  const c = { C: 0, W: 0, P: 0, R: 0, V: 0, T: 0 };
  for (const n of POSICOES) {
    const e = estadoDaVaga({ ...sac, data: dk }, n, hojeKey);
    if (e === 'dispensada') continue;
    c.T++;
    if (e === 'aceito' || e === 'fora' || e === 'realizado') c.C++;
    else if (e === 'convidado') c.W++;
    else if (e === 'a-convidar') c.P++;
    else if (e === 'recusou') c.R++;
    else c.V++;
  }
  if (c.T === 0) return 'sem discursos designados';
  if (c.C === c.T) return c.T === 1 ? '✅ o orador confirmado' : `✅ os ${c.T} oradores confirmados`;
  if (c.V === c.T) return '⚠️ ainda sem oradores definidos';
  return [
    c.C && `✅ ${pl(c.C, 'confirmado', 'confirmados')}`,
    c.W && `⏳ ${c.W} aguardando resposta`,
    c.P && `💬 ${c.P} a convidar`,
    c.R && `❌ ${c.R} ${c.R === 1 ? 'não poderá' : 'não poderão'}`,
    c.V && `⚠️ ${pl(c.V, 'vaga aberta', 'vagas abertas')}`,
  ].filter(Boolean).join(' · ');
}

const PRIORIDADE = { recusou: 0, 'sem-resposta': 1, vagas: 2, convidar: 3, tipo: 4 };

// O que o Início cobra nos próximos domingos. O convite ainda sem resposta só
// aparece depois de alguns dias (ou quando o domingo está perto).
export function pendenciasDiscurso(sacramentais, hojeKey) {
  const itens = [];
  for (const dk of proximosDomingos(hojeKey, SEMANAS_PLANO)) {
    const sac = registroDoDomingo(sacramentais, dk);
    const d = diasEntre(hojeKey, dk);
    const tipo = tipoDe(sac);
    // com um orador já escolhido, o domingo claramente não é de jejum
    const provavel = perguntarTipo(sac, dk);
    if (provavel && d <= ANTECEDENCIA_DIAS) {
      itens.push({ tipo: 'tipo', dk, provavel });
      continue;
    }
    if (!tipo.vagas) continue;
    const reg = { ...(sac || {}), data: dk };
    const vazias = [];
    for (const n of POSICOES) {
      const est = estadoDaVaga(reg, n, hojeKey);
      const nome = String(reg['orador' + n] ?? '').trim();
      if (est === 'recusou') itens.push({ tipo: 'recusou', dk, n, nome });
      else if (est === 'convidado') {
        // dias de calendário, como o selo do card ("Aguardando · há 2 dias")
        const em = new Date(reg['orador' + n + 'ConvidadoEm'] || '');
        const dias = isNaN(em) ? 0 : Math.max(0, diasEntre(dataLocal(em), hojeKey));
        if (dias >= SEM_RESPOSTA_DIAS || d <= LEMBRETE_DIAS) itens.push({ tipo: 'sem-resposta', dk, n, nome, dias });
      } else if (est === 'a-convidar' && d <= ANTECEDENCIA_DIAS) itens.push({ tipo: 'convidar', dk, n, nome });
      else if (est === 'vazia') vazias.push(n);
    }
    if (tipo.cobra && vazias.length && d <= ANTECEDENCIA_DIAS) itens.push({ tipo: 'vagas', dk, ns: vazias });
  }
  return itens.sort((a, b) => a.dk.localeCompare(b.dk) || PRIORIDADE[a.tipo] - PRIORIDADE[b.tipo] || (a.n || 0) - (b.n || 0));
}
