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

export const encerrada = e => e.status === 'realizada' || e.status === 'nao-realizada';

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
  const campos = { confirmacao: resposta, confirmadoEm: agora };
  // A resposta move o status do card. Só em entrevista ainda aberta: um link
  // antigo não pode ressuscitar uma já realizada.
  const aberta = atual.status === 'pendente' || atual.status === 'agendada';
  if (aberta && resposta === 'confirmado') campos.status = 'agendada';
  // Pedir outra data desmarca: o horário combinado deixou de valer, e quem fecha
  // a nova data é o bispado. Sem isso o card seguia "Agendada".
  if (aberta && resposta === 'reagendar') campos.status = 'pendente';
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
