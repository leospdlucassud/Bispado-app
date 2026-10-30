// =============================================
// REGRAS DO CONVITE (sem DOM)
// Usadas por três lados: a Agenda do bispado (agenda.js), a tela que o membro
// abre pelo link e a function /api/convite, que roda no servidor. Por isso não
// tocam em document nem em DADOS — e os testes (tests/) rodam direto no Node.
// =============================================

// A designação (imposição de mãos) vem DEPOIS do apoio na reunião sacramental:
// o chamado já foi lido diante da ala, então o assunto pode ir no convite — ao
// contrário do "Apoio de Chamado", que é conversa antes de o chamado ser público.
// Mas não é entrevista: o convite fala dela com as palavras dela (comoNoConvite).
// A aba Chamados (chamados-ala.js) agenda com este tipo, e chamados-lcr.js o
// procura na Agenda.
export const TIPO_DESIGNACAO = 'Designação de Chamado (Imposição de Mãos)';

// Tipos que podem aparecer no convite. O convite vai pelo WhatsApp ou e-mail:
// aparece na prévia da tela bloqueada, e o número cadastrado muitas vezes é o da
// família. Por isso só os tipos de rotina são nomeados; os demais — e qualquer
// entrevista sigilosa — viram "uma conversa com o bispado". O tipo real
// continua visível para o bispado. Na dúvida, um tipo fica FORA desta lista.
export const TIPOS_NO_CONVITE = new Set([
  'Recomendação para o Templo (Batismos Vicários)',
  'Recomendação para o Templo (Investidura)',
  'Renovação de Recomendação para o Templo',
  'Recomendação para Ordenanças Próprias (Investidura)',
  'Recomendação para Ordenanças Próprias (Selamento)',
  'Recomendação de Uso Limitado (Jovens)',
  'Recomendação para Bênção Patriarcal',
  'Ordenação ao Ofício de Diácono',
  'Ordenação ao Ofício de Mestre',
  'Ordenação ao Ofício de Sacerdote',
  'Ordenação ao Ofício de Élder',
  'Ordenação ao Ofício de Sumo Sacerdote',
  'Entrevista Anual (Jovem de 12–15 Anos)',
  'Entrevista Semestral (Jovem de 16–17 Anos)',
  'Entrevista Anual (Jovem Adulto Solteiro)',
  'Preparação para Missão',
  'Retorno de Missão',
  'Recomendação para Missionário de Serviço da Igreja',
  TIPO_DESIGNACAO,
  'Ministração da Liderança',
  'Novo Membro (Pós-Batismo)',
  'Batismo e Confirmação de Criança de Registro (8 anos)',
  'Declaração de Dízimo',
]);

// O tipo que o membro pode ler, ou '' quando o convite não deve dizer o assunto.
export function tipoNoConvite(e) {
  return e && !e.sigiloso && TIPOS_NO_CONVITE.has(e.tipo) ? e.tipo : '';
}

// Como o convite fala do assunto, nos três lugares em que ele aparece: a frase
// da mensagem ("Gostaríamos de marcar <frase> para <quando>." — WhatsApp, e-mail
// e link copiado), o assunto do e-mail e o título da tela do membro. Recebe o
// tipo JÁ filtrado por tipoNoConvite ('' = o assunto não aparece).
export function comoNoConvite(tipo) {
  if (!tipo) return { frase: 'uma conversa com você', assunto: 'Convite do bispado', titulo: 'Convite do bispado' };
  // "marcar uma entrevista — Designação de Chamado —" soaria como outra coisa
  if (tipo === TIPO_DESIGNACAO) {
    return { frase: 'a sua designação no chamado, por imposição de mãos,', assunto: 'Convite do bispado — designação no chamado', titulo: 'Convite para a designação' };
  }
  return { frase: `uma entrevista com você — ${tipo} —`, assunto: `Entrevista com o bispado — ${tipo}`, titulo: 'Convite para entrevista' };
}

// "Sobrenome, Nome" → primeiro nome
export function primeiroNome(nome) {
  const dep = (nome || '').split(',')[1];
  return ((dep || nome || '').trim().split(/\s+/)[0]) || nome || '';
}

// O link do convite e sempre o mesmo (?confirmar=<id>), entao ele nao pode ser
// "de uso unico" para sempre — precisa voltar a valer quando o bispado convida
// de novo. A resposta vale para o convite ATUAL: ja respondeu se ha resposta
// posterior ao ultimo envio. Reagendar limpa a resposta, o que tambem libera.
// Sem `convidadoEm` (registro antigo), qualquer resposta ja conta como dada.
export function conviteJaRespondido(e) {
  if (!e.confirmadoEm) return false;
  return !e.convidadoEm || e.confirmadoEm > e.convidadoEm;
}

// Encerrada pelo bispado (marcou Realizada ou Não realizada, com o motivo). O
// campo `status` gravado só diz isto — aberta ('aberta', ou 'pendente' /
// 'agendada' dos registros antigos) ou encerrada; o status que o card mostra
// sai de estadoDaEntrevista.
export const encerrada = e => e.status === 'realizada' || e.status === 'nao-realizada';

// =============================================
// STATUS DO CARD
// Criado → Enviado → (Em agendamento) → Agendado → Realizada / Não realizada.
// Sai dos campos da entrevista, e não de um campo gravado: a resposta do membro
// (no servidor), o convite (no aparelho do bispado) e a data que passa mudam o
// status sem ninguém precisar regravá-lo.
// =============================================
export const ESTADOS = {
  criado: 'Criado',
  enviado: 'Enviado',
  'em-agendamento': 'Em agendamento',
  agendada: 'Agendado',
  'nao-realizada': 'Não Realizada',
  realizada: 'Realizada',
};
export const ESTADOS_ABERTOS = new Set(['criado', 'enviado', 'em-agendamento', 'agendada']);

// O membro pediu outra data e o bispado ainda não fechou nenhuma. Enquanto isso,
// `data`/`hora` continuam sendo as que ele recusou — convidar de novo mandaria
// exatamente a data recusada. O próximo passo aqui é Reagendar, não Convidar.
export function aguardandoNovaData(e) {
  if (e.confirmacao !== 'reagendar' || !e.confirmadoEm) return false;
  if (encerrada(e)) return false;
  const hist = e.reagendamentos || [];
  const ultimo = hist[hist.length - 1]?.reagendadoEm;
  return !ultimo || ultimo < e.confirmadoEm;
}

// Entrevista reagendada cujo convite mais recente é ANTERIOR ao reagendamento:
// o membro ainda não foi avisado da data nova. Comparação de ISO por string
// funciona (mesmo fuso, mesmo formato). Horário já combinado (o bispado aceitou
// o que o membro sugeriu) não pede convite: pede a confirmação (avisarAceite).
export function precisaReenviarConvite(e) {
  const hist = e.reagendamentos || [];
  const ultimoReagendamento = hist[hist.length - 1]?.reagendadoEm;
  if (!ultimoReagendamento) return false;                       // nunca foi reagendada
  if (encerrada(e) || e.confirmacao === 'confirmado') return false;
  return !e.convidadoEm || e.convidadoEm < ultimoReagendamento;
}

// Quantos horários diferentes já foram mandados ao membro (o "2ª tentativa").
// Registro de antes do contador: com convite, conta 1.
export const tentativasDe = e =>
  Number.isInteger(e?.tentativas) && e.tentativas > 0 ? e.tentativas : (e?.convidadoEm ? 1 : 0);

const DIA = /^\d{4}-\d{2}-\d{2}$/;

// `hojeKey`: AAAA-MM-DD local. A data "passa" no dia seguinte ao marcado.
export function estadoDaEntrevista(e, hojeKey) {
  if (e.status === 'realizada') return 'realizada';
  if (e.status === 'nao-realizada') return 'nao-realizada';
  const passou = DIA.test(e.data || '') && DIA.test(hojeKey || '') && e.data < hojeKey;
  if (e.confirmacao === 'confirmado') return passou ? 'nao-realizada' : 'agendada';
  // o membro pediu outra data: a vez é do bispado, mesmo que a data velha já tenha passado
  if (e.confirmacao === 'reagendar' || e.confirmacao === 'recusado') return 'em-agendamento';
  if (passou) return 'nao-realizada';
  // já houve um "não posso, pode ser outro dia?": até os dois baterem o horário
  if (e.negociando) return 'em-agendamento';
  if (e.convidadoEm) return precisaReenviarConvite(e) ? 'em-agendamento' : 'enviado';
  return 'criado';
}

// "Não realizada" que o app concluiu sozinho (a data passou sem reagendamento):
// o bispado ainda pode marcar Realizada, reagendar ou registrar o motivo.
export const naoRealizadaPelaData = (e, hojeKey) => !encerrada(e) && estadoDaEntrevista(e, hojeKey) === 'nao-realizada';

export function rotuloDoEstado(e, hojeKey) {
  const est = estadoDaEntrevista(e, hojeKey);
  const n = tentativasDe(e);
  const vez = (est === 'enviado' || est === 'em-agendamento') && n >= 2 ? ` · ${n}ª tentativa` : '';
  return ESTADOS[est] + vez;
}

// O que o envio do convite grava. Cada horário novo mandado conta uma tentativa;
// reenviar o mesmo horário (outro meio, outro número) não conta.
export function camposDoEnvio(e, agora) {
  const para = `${e.data || ''}|${e.hora || ''}`;
  const antes = tentativasDe(e);
  const mesmo = typeof e.convidadoPara === 'string'
    ? e.convidadoPara === para
    : antes > 0 && !precisaReenviarConvite(e);        // registro de antes do contador
  return { convidadoEm: agora, convidadoPara: para, tentativas: mesmo ? Math.max(1, antes) : antes + 1 };
}

// O bispado escolheu a nova data. Se é exatamente a que o membro sugeriu, os
// dois bateram: fica Agendado, e o membro só precisa ser avisado (avisarAceite).
// Senão, é uma contraproposta: o convite sai de novo, com o horário novo.
export function camposDaNovaData(atual, data, hora, agora) {
  const hist = [...(atual.reagendamentos || []), {
    dataAnterior: atual.data || '', horaAnterior: atual.hora || '', reagendadoEm: agora,
  }];
  const campos = { data, hora: hora || '', reagendamentos: hist, sugestaoData: '', sugestaoHora: '' };
  const aceitou = aguardandoNovaData(atual) && data === atual.sugestaoData && (hora || '') === (atual.sugestaoHora || '');
  if (aceitou) {
    return { ...campos, confirmacao: 'confirmado', confirmadoEm: agora, negociando: false, aceitoEm: agora,
      convidadoPara: `${data}|${hora || ''}` };
  }
  return { ...campos, confirmacao: '', confirmadoEm: '', aceitoEm: '' };
}

// O bispado aceitou o horário do membro e ainda não mandou a confirmação.
export const avisarAceite = e => !encerrada(e) && e.confirmacao === 'confirmado' && !!e.aceitoEm
  && !(e.confirmacaoEnviadaEm && e.confirmacaoEnviadaEm >= e.aceitoEm);

// Só duas respostas: quem não pode vir pede outra data, não apenas recusa.
// ('recusado' segue reconhecido na Agenda, por causa dos registros antigos.)
export const RESPOSTAS = ['confirmado', 'reagendar'];

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^\d{2}:\d{2}$/;

// O que a resposta do membro grava na entrevista. Decidido no servidor, e não no
// aparelho do membro: a tela pública só diz o que ele escolheu.
// Devolve null quando a resposta é inválida.
export function camposDaResposta(atual, resposta, sugestao, agora) {
  if (!RESPOSTAS.includes(resposta)) return null;
  // O status do card sai destes campos (estadoDaEntrevista): confirmar deixa
  // Agendado; pedir outra data deixa Em agendamento até os horários baterem.
  // Uma entrevista encerrada não muda (o servidor já recusa antes).
  const campos = { confirmacao: resposta, confirmadoEm: agora };
  if (!encerrada(atual)) campos.negociando = resposta === 'reagendar';
  if (resposta === 'reagendar') {
    // a sugestão é um pedido, não muda a data por conta própria
    if (!sugestao || !DATA.test(sugestao.data || '')) return null;
    if (sugestao.hora && !HORA.test(sugestao.hora)) return null;
    campos.sugestaoData = sugestao.data;
    campos.sugestaoHora = sugestao.hora || '';
  }
  return campos;
}

// Só o que a tela do membro precisa — nunca o registro inteiro, que tem as
// observações do bispado, os registros de acompanhamento e o tipo real.
export function conviteParaMembro(e) {
  return {
    id: e.id,
    nome: primeiroNome(e.membro),
    tipo: tipoNoConvite(e),
    data: e.data || '', hora: e.hora || '',
    status: e.status || '',
    confirmacao: e.confirmacao || '', confirmadoEm: e.confirmadoEm || '',
    convidadoEm: e.convidadoEm || '',
    sugestaoData: e.sugestaoData || '', sugestaoHora: e.sugestaoHora || '',
  };
}
