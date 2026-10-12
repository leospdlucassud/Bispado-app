// =============================================
// DADOS FICTÍCIOS DO MODO DEMONSTRAÇÃO (`?demo`) — sem DOM
//
// TUDO AQUI É INVENTADO. Nomes, telefones e textos não pertencem a ninguém da
// ala: o repositório é público. Os telefones usam o prefixo 90000, que não é
// distribuído a celulares, e os e-mails o domínio reservado example.com.
//
// Três escolhas:
//  - As datas saem de HOJE: uma carga presa a um mês abriria a agenda, o plano
//    dos domingos e o calendário vazios numa apresentação meses depois.
//  - Nada é sorteado: a mesma data dá a mesma carga, para ensaiar e encontrar
//    a mesma tela na apresentação.
//  - A história é uma só em todas as abas: quem está no quadro de membros é
//    quem tem entrevista, discursa, aparece no rodízio e no acompanhamento.
//
// Mudou o formato do que gerar() devolve? Suba VERSAO_DEMO em js/demo.js.
// =============================================

import { chavePessoa, nomeNatural, partesData, proximoDomingo, somarDias } from './discursos-regras.js';

const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const dois = n => String(n).padStart(2, '0');

// O quadro de membros, no formato do LCR ("Sobrenome, Prenomes").
// aniv: daqui a quantos dias é o aniversário (negativo: já passou este ano).
// tel: final do número (63) 90000-00NN; '' = sem telefone; texto = como está.
const ELENCO = [
  ['Albuquerque Ramos', 'Marcelo', 'M', 44, 40, 1],
  ['Albuquerque Ramos', 'Patrícia', 'F', 41, -90, 2, 'patricia.ramos@example.com'],
  ['Albuquerque Ramos', 'Davi', 'M', 16, 120, 3],
  ['Albuquerque Ramos', 'Lívia', 'F', 13, 6, 4],
  ['Albuquerque Ramos', 'Heitor', 'M', 9, -30, ''],
  ['Batista Lopes', 'Renato', 'M', 52, -150, 5, 'renato.lopes@example.com'],
  ['Batista Lopes', 'Cláudia', 'F', 50, 200, 6],
  ['Batista Lopes', 'Gabriel', 'M', 24, 15, 7],
  ['Cardoso Neves', 'Bruno', 'M', 35, -10, 8],
  ['Cardoso Neves', 'Fernanda', 'F', 33, 75, 9, 'fernanda.neves@example.com'],
  ['Cardoso Neves', 'Miguel', 'M', 10, 160, ''],
  ['Cardoso Neves', 'Alice', 'F', 7, 25, ''],
  ['Duarte Silveira', 'Antônio', 'M', 68, -200, 10],
  ['Duarte Silveira', 'Lúcia', 'F', 66, 2, 11],
  ['Esteves Moura', 'Rafael', 'M', 29, 90, 13],
  ['Esteves Moura', 'Camila', 'F', 27, -60, 14, 'camila.moura@example.com'],
  ['Fonseca Prado', 'Juliana', 'F', 38, -120, 15],
  ['Fonseca Prado', 'Pedro', 'M', 14, 50, 16],
  ['Fonseca Prado', 'Sofia', 'F', 12, -5, ''],
  ['Guimarães Teles', 'Otávio', 'M', 47, 110, 17, 'otavio.teles@example.com'],
  ['Guimarães Teles', 'Helena', 'F', 45, -40, 18],
  ['Guimarães Teles', 'Laura', 'F', 17, 30, 19],
  ['Guimarães Teles', 'Vítor', 'M', 15, -100, 20],
  ['Holanda Ribeiro', 'Tiago', 'M', 22, 140, 21],
  ['Lacerda Pinto', 'Sérgio', 'M', 58, -20, 22],
  ['Lacerda Pinto', 'Vera', 'F', 57, 180, 23],
  ['Macedo Freitas', 'Larissa', 'F', 21, -170, 24, 'larissa.freitas@example.com'],
  ['Nogueira Paiva', 'Eduardo', 'M', 39, 60, 25],
  ['Nogueira Paiva', 'Simone', 'F', 37, -80, 26],
  ['Nogueira Paiva', 'Enzo', 'M', 10, 12, ''],
  ['Nogueira Paiva', 'Clara', 'F', 5, -140, ''],
  ['Queiroz Bastos', 'Rosa', 'F', 74, 9, '9000-0012'],   // sem DDD: mostra o aviso
  ['Rezende Lima', 'André', 'M', 31, -50, 27],
  ['Rezende Lima', 'Bianca', 'F', 30, 100, 28],
  ['Sampaio Vidal', 'Joaquim', 'M', 19, -15, 29],
  ['Tavares Rocha', 'Lucas', 'M', 28, 70, 30],
  ['Tavares Rocha', 'Mariana', 'F', 26, -25, 31, 'mariana.rocha@example.com'],
  ['Vasconcelos Brito', 'Paulo', 'M', 62, 130, 32],
  ['Vasconcelos Brito', 'Teresa', 'F', 60, -110, 33],
  ['Vasconcelos Brito', 'Isabela', 'F', 34, 20, 34],
  ['Xavier Monteiro', 'Regina', 'F', 43, -70, 35],
  ['Xavier Monteiro', 'Mateus', 'M', 18, 45, 36],
  ['Xavier Monteiro', 'Natália', 'F', 16, -130, 37],
  ['Pires Correia', 'Wagner', 'M', 49, 80, 38],          // saíram (transferência enviada)
  ['Pires Correia', 'Sônia', 'F', 47, -35, 39],
];

const telefone = t => typeof t === 'number' ? `(63) 90000-00${dois(t)}` : (t || '');

function nascimentoDe(hoje, idade, aniv) {
  const p = partesData(somarDias(hoje, aniv));
  const h = partesData(hoje);
  // o aniversário deste ano (no calendário) ainda não chegou: nasceu um ano antes
  const passou = p.m < h.m || (p.m === h.m && p.d <= h.d);
  return `${dois(p.d)} ${MES[p.m - 1]} ${h.a - idade - (passou ? 0 : 1)}`;
}

// "Sobrenome, Prenome" → "Prenome Sobrenome", como o app grava na vaga
const natural = nome => nomeNatural(nome);

export function gerar(hoje) {
  const H = hoje;
  const d = k => somarDias(H, k);
  const em = (k, hora = '13:00') => `${d(k)}T${hora}:00.000Z`;   // instante (ISO) k dias atrás/à frente

  // ---------- quadro de membros ----------
  const roster = ELENCO.map(([sob, nomes, sexo, idade, aniv, tel, email], i) => ({
    id: i + 1,
    name: `${sob}, ${nomes}`,
    gender: sexo,
    age: idade,
    nascimento: nascimentoDe(H, idade, aniv),
    telefone: telefone(tel),
    email: email || '',
  }));
  const membro = nome => roster.find(m => m.name.endsWith(', ' + nome.split(' ')[0]) && m.name.startsWith(nome.split(' ').slice(1).join(' ')));
  const lcr = nome => {   // "Tiago Holanda Ribeiro" → "Holanda Ribeiro, Tiago"
    const m = membro(nome);
    if (!m) throw new Error('demo: membro fictício inexistente: ' + nome);
    return m.name;
  };
  const saidos = roster.filter(m => m.name.startsWith('Pires Correia')).map(m => m.id);
  const membros = {
    roster,
    rosterAtualizadoEm: em(-30),
    saidos,
    adicionados: [],
    movimentacoes: [
      { id: 'mov_demo_1', tipo: 'entrada', membroId: roster.find(m => m.name === lcr('Tiago Holanda Ribeiro')).id,
        nome: lcr('Tiago Holanda Ribeiro'), motivo: 'Batismo e Confirmação', data: d(-63), obs: 'Batizado pelos missionários de tempo integral', registradoPor: 'Secretário' },
      { id: 'mov_demo_2', tipo: 'entrada', membroId: roster.find(m => m.name === lcr('André Rezende Lima')).id,
        nome: lcr('André Rezende Lima'), motivo: 'Transferência Recebida (Mudança para a Ala)', data: d(-45), obs: 'Vieram de outra estaca, com a esposa', registradoPor: 'Secretário' },
      { id: 'mov_demo_3', tipo: 'entrada', membroId: roster.find(m => m.name === lcr('Bianca Rezende Lima')).id,
        nome: lcr('Bianca Rezende Lima'), motivo: 'Transferência Recebida (Mudança para a Ala)', data: d(-45), obs: '', registradoPor: 'Secretário' },
      ...saidos.map((id, i) => ({ id: 'mov_demo_s' + i, tipo: 'saida', membroId: id, nome: roster.find(m => m.id === id).name,
        motivo: 'Transferência Enviada (Mudança de Ala)', data: d(-20), obs: 'Mudaram para outra cidade', registradoPor: 'Secretário' })),
    ],
  };

  // ---------- chamados ----------
  const bispado = [{ nomes: {
    'Bispo': 'Renato Batista', '1º Conselheiro': 'Otávio Guimarães', '2º Conselheiro': 'Eduardo Nogueira',
    'Secretário': 'Paulo Vasconcelos', 'Secretário Executivo': 'Sérgio Lacerda',
  } }];

  // ---------- agenda de entrevistas ----------
  const ent = (nome, tipo, responsavel, extra) => ({
    membro: lcr(nome), tipo, responsavel, data: '', hora: '', telefone: '', prioridade: 'media', obs: '',
    acompanhar: false, sigiloso: false, status: 'pendente', reagendamentos: [], ...extra,
  });
  const agenda = [
    ent('Patrícia Albuquerque Ramos', 'Renovação de Recomendação para o Templo', 'c1',
      { data: d(2), hora: '19:30', status: 'agendada', convidadoEm: em(-3), confirmacao: 'confirmado', confirmadoEm: em(-2, '15:20') }),
    ent('Davi Albuquerque Ramos', 'Entrevista Semestral (Jovem de 16–17 Anos)', 'bispo',
      { data: d(4), hora: '10:00', status: 'agendada', convidadoEm: em(-1) }),
    ent('Tiago Holanda Ribeiro', 'Novo Membro (Pós-Batismo)', 'c2',
      { prioridade: 'alta', acompanhar: true, obs: 'Combinar com os missionários', situacaoAcomp: 'aberto',
        registros: [
          { data: d(-50), autor: '2º Conselheiro', texto: 'Primeira visita com os missionários. Recebeu o chamado de professor familiar júnior.' },
          { data: d(-21), autor: '2º Conselheiro', texto: 'Participou da noite familiar da ala. Quer ir ao templo fazer batismos.' },
        ] }),
    ent('Joaquim Sampaio Vidal', 'Preparação para Missão', 'bispo',
      { data: d(0), hora: '20:00', status: 'agendada', prioridade: 'alta', convidadoEm: em(-4), confirmacao: 'confirmado', confirmadoEm: em(-4, '18:00') }),
    ent('Larissa Macedo Freitas', 'Entrevista Anual (Jovem Adulto Solteiro)', 'bispo',
      { data: d(1), hora: '19:00', status: 'pendente', convidadoEm: em(-2), confirmacao: 'reagendar', confirmadoEm: em(-1, '21:10'),
        sugestaoData: d(6), sugestaoHora: '19:30' }),
    ent('Lucas Tavares Rocha', 'Ordenação ao Ofício de Élder', 'c1',
      { data: d(7), hora: '18:30', status: 'agendada' }),
    ent('Rosa Queiroz Bastos', 'Orientação Espiritual', 'bispo',
      { data: d(5), hora: '16:00', status: 'agendada', sigiloso: true, prioridade: 'alta', acompanhar: true, situacaoAcomp: 'aberto',
        obs: 'Visita na casa dela', registros: [
          { data: d(-14), autor: 'Bispo', texto: 'Conversa de seguimento. Combinamos nova visita.' },
        ] }),
    ent('Mariana Tavares Rocha', 'Declaração de Dízimo', 'bispo',
      { data: d(-10), hora: '11:00', status: 'realizada', realizadaEm: em(-10, '14:30'), obs_conclusao: 'Tudo certo.' }),
    ent('Antônio Duarte Silveira', 'Renovação de Recomendação para o Templo', 'c2',
      { data: d(-20), hora: '09:30', status: 'realizada', realizadaEm: em(-20, '12:40'), obs_conclusao: 'Recomendação renovada.' }),
    ent('Pedro Fonseca Prado', 'Ordenação ao Ofício de Mestre', 'c1',
      { data: d(-14), hora: '10:30', status: 'realizada', realizadaEm: em(-14, '13:50'), obs_conclusao: 'Apoio na sacramental do próximo domingo.' }),
    ent('Camila Esteves Moura', 'Apoio de Chamado', 'c2',
      { data: d(-6), hora: '19:00', status: 'nao-realizada', motivo: 'Viajou a trabalho; remarcar depois do feriado.' }),
    ent('Gabriel Batista Lopes', 'Retorno de Missão', 'bispo',
      { data: d(-30), hora: '20:00', status: 'realizada', realizadaEm: em(-30, '23:00'), obs_conclusao: 'Relato na sacramental combinado.' }),
    ent('Bianca Rezende Lima', 'Bem-Estar e Autossuficiência', 'bispo',
      { sigiloso: true, prioridade: 'alta', acompanhar: true, situacaoAcomp: 'aberto', registros: [
        { data: d(-9), autor: 'Bispo', texto: 'Conversa inicial. Encaminhado para o curso de autossuficiência.' },
      ] }),
    ent('Lívia Albuquerque Ramos', 'Entrevista Anual (Jovem de 12–15 Anos)', 'c2',
      { data: d(9), hora: '15:00', status: 'agendada', convidadoEm: em(-1), confirmacao: 'confirmado', confirmadoEm: em(0, '12:05') }),
    ent('Isabela Vasconcelos Brito', 'Recomendação para Ordenanças Próprias (Investidura)', 'bispo',
      { data: d(12), hora: '19:00', status: 'agendada', convidadoEm: em(-6),
        reagendamentos: [{ dataAnterior: d(-2), horaAnterior: '19:00', reagendadoEm: em(-5) }] }),
    ent('Regina Xavier Monteiro', 'Desobrigação de Chamado', 'c1', { prioridade: 'normal' }),
    ent('Alice Cardoso Neves', 'Batismo e Confirmação de Criança de Registro (8 anos)', 'bispo',
      { data: d(10), hora: '17:00', status: 'agendada', obs: 'Com os pais presentes' }),
  ];

  // ---------- reuniões ----------
  const reunioes = [
    { data: d(-21), tipo: 'correlacao', participantes: ['1º Conselheiro', 'Líder da obra missionária', 'Missionários'],
      pauta: 'Pessoas sendo ensinadas e próximos batismos.', itens: [
        { texto: 'Convidar os conversos para a noite familiar da ala', feito: true },
        { texto: 'Definir quem acompanha o irmão Tiago nas primeiras semanas', feito: true }] },
    { data: d(-14), tipo: 'conselho', participantes: ['Bispado', 'Presidentes das organizações'],
      pauta: 'Calendário do trimestre e famílias que precisam de apoio.', itens: [
        { texto: 'Fechar a data da noite familiar da ala', feito: true },
        { texto: 'Levantar quem precisa de carona para a viagem ao templo', feito: false },
        { texto: 'Lista de aniversariantes para o mural', feito: false }] },
    { data: d(-10), tipo: 'jovens', participantes: ['Bispado', 'Presidências de quórum e de classe'],
      pauta: 'Atividade de gincana e participação nas entrevistas.', itens: [
        { texto: 'Reservar o salão cultural', feito: true },
        { texto: 'Convidar os rapazes menos ativos', feito: false }] },
    { data: d(-7), tipo: 'bispado', participantes: ['Bispo', '1º Conselheiro', '2º Conselheiro', 'Secretário', 'Secretário Executivo'],
      pauta: 'Chamados em aberto, entrevistas da semana e oradores dos próximos domingos.', itens: [
        { texto: 'Convidar os oradores do domingo que vem', feito: true },
        { texto: 'Preparar a desobrigação da irmã Regina', feito: false },
        { texto: 'Conferir as recomendações a vencer', feito: false }] },
    { data: d(-28), tipo: 'bemestar', participantes: ['Bispo', 'Presidente da Sociedade de Socorro', 'Presidente do quórum de élderes'],
      pauta: 'Necessidades temporais e o curso de autossuficiência.', itens: [
        { texto: 'Abrir turma do curso de autossuficiência', feito: true }] },
    { data: d(5), tipo: 'bispado', participantes: ['Bispo', '1º Conselheiro', '2º Conselheiro', 'Secretário', 'Secretário Executivo'],
      pauta: 'Planejamento do mês que vem.', itens: [
        { texto: 'Rever o rodízio de discursantes', feito: false },
        { texto: 'Programa especial de fim de ano', feito: false }] },
  ];

  // ---------- designações ----------
  const designacoes = [
    { tarefa: 'Visitar a família Rezende Lima (recém-chegada)', tipo: 'pontual', responsaveis: ['Bispo', 'Secretário'], prazo: d(-3), status: 'andamento', obs: 'Levar o folheto da ala' },
    { tarefa: 'Reunião com a presidência da Primária', tipo: 'pontual', responsaveis: ['Bispo'], prazo: d(2), status: 'pendente', obs: '' },
    { tarefa: 'Atualizar a lista de recomendações a vencer', tipo: 'pontual', responsaveis: ['Secretário'], prazo: d(7), status: 'pendente', obs: '' },
    { tarefa: 'Preparar o programa especial de fim de ano', tipo: 'pontual', responsaveis: ['2º Conselheiro'], prazo: d(30), status: 'pendente', obs: 'Com o regente e a Primária' },
    { tarefa: 'Organizar o devocional dos jovens', tipo: 'pontual', responsaveis: ['1º Conselheiro'], prazo: d(-12), status: 'concluido', obs: '', obs_conclusao: 'Feito com os quóruns e as classes juntos.' },
    { tarefa: 'Conferir a frequência da sacramental', tipo: 'permanente', responsaveis: ['Secretário Executivo'], prazo: '', status: 'ativa', obs: 'Todo domingo' },
    { tarefa: 'Agendar as entrevistas de jovens', tipo: 'permanente', responsaveis: ['Secretário Executivo', '2º Conselheiro'], prazo: '', status: 'ativa', obs: '' },
    { tarefa: 'Relatório trimestral', tipo: 'permanente', responsaveis: ['Secretário'], prazo: '', status: 'inativa', obs: 'Volta no próximo trimestre' },
  ].map(x => ({ ...x, responsavel: x.responsaveis[0] }));

  // ---------- calendário (os eventos da ala) ----------
  const eventos_extras = [
    { data: d(3), txt: 'Noite familiar da ala — 19h30', cor: '#34d399' },
    { data: d(8), txt: 'Atividade dos jovens — gincana', cor: '#f472b6' },
    { data: d(27), txt: 'Batismo — Alice Cardoso', cor: '#34d399' },   // depois dos 8 anos dela
    { data: d(19), txt: 'Viagem ao templo', cor: '#50d0c0' },
    { data: d(26), txt: 'Conselho da ala', cor: '#c9a84c' },
    { data: d(-4), txt: 'Mutirão de limpeza da capela', cor: '#34d399' },
  ];

  // ---------- reunião sacramental ----------
  const S0 = proximoDomingo(H);
  const dom = k => somarDias(S0, 7 * k);
  const ehPrimeiro = dk => partesData(dk).d <= 7;
  const tipoDoPrimeiro = dk => [4, 10].includes(partesData(dk).m) ? 'conf-geral' : 'jejum';
  const vaga = (n, nome, extra = {}) => ({
    ['orador' + n]: nome, ['orador' + n + 'Chave']: chavePessoa(nome), ['orador' + n + 'Fora']: false, ...extra,
  });
  const aceito = (n, nome, tema, extra = {}) => vaga(n, nome, {
    ['tema' + n]: tema, ['orador' + n + 'Status']: 'aceito',
    ['orador' + n + 'ConvidadoEm']: em(-12), ['orador' + n + 'RespostaEm']: em(-11), ['orador' + n + 'Por']: 'c1', ...extra,
  });
  const presidencia = (i) => ({
    presidida: 'Bispo Renato Batista',
    dirigida: i % 2 ? 'Irmão Otávio Guimarães' : 'Irmão Eduardo Nogueira',
    regente: 'Irmã Simone Nogueira',
    pianista: 'Irmã Teresa Vasconcelos',
  });

  // passados: 10 domingos de atas (os de jejum sem oradores)
  const PASSADOS = [
    ['Davi Albuquerque Ramos', 'A oração', 'Fernanda Cardoso Neves', 'O dízimo', 'Antônio Duarte Silveira', 'O templo'],
    ['Pedro Fonseca Prado', 'O sacerdócio', 'Gabriel Batista Lopes', 'Relato da missão', 'Patrícia Albuquerque Ramos', 'A família'],
    ['Laura Guimarães Teles', 'A fé', 'Rafael Esteves Moura', 'O serviço', 'Teresa Vasconcelos Brito', 'A expiação'],
    ['Vítor Guimarães Teles', 'O dia do Senhor', 'Juliana Fonseca Prado', 'Ministrar', 'Marcelo Albuquerque Ramos', 'O arrependimento'],
    ['Natália Xavier Monteiro', 'O Livro de Mórmon', 'Mateus Xavier Monteiro', 'A obra missionária', null, null],
    ['Lívia Albuquerque Ramos', 'A gratidão', 'Simone Nogueira Paiva', 'O Espírito Santo', 'Paulo Vasconcelos Brito', 'Os convênios'],
    ['Sofia Fonseca Prado', 'O exemplo de Cristo', 'Bruno Cardoso Neves', 'A esperança', 'Cláudia Batista Lopes', 'A caridade'],
    ['Davi Albuquerque Ramos', 'A honestidade', 'Mariana Tavares Rocha', 'A obediência', 'Otávio Guimarães Teles', 'A Restauração'],
  ];
  const sacramentais = [];
  let p = 0;
  for (let k = 10; k >= 1; k--) {
    const dk = dom(-k);
    const base = { data: dk, ...presidencia(k), frequencia: String(92 + ((k * 7) % 23)), visitantes: String(k % 4),
      primeiroHino: String(2 + k * 11), hinoSacramental: String(169 + (k % 6)), hinoFinal: String(85 + k * 3),
      oracaoAbertura: 'Irmã Vera Lacerda', oracaoEncerramento: 'Irmão Sérgio Lacerda',
      anuncios: 'Noite familiar da ala; inscrições para a viagem ao templo.' };
    if (ehPrimeiro(dk)) { sacramentais.push({ ...base, tipo: tipoDoPrimeiro(dk), observacoes: 'Testemunhos da congregação' }); continue; }
    const r = PASSADOS[p++ % PASSADOS.length];
    sacramentais.push({ ...base, tipo: 'normal', hinoIntermediario: String(140 + k),
      ...aceito(1, r[0], r[1]), ...aceito(2, r[2], r[3]),
      ...(r[4] ? aceito(3, r[4], r[5]) : vaga(3, 'Presidente Vidal, do sumo conselho', { tema3: 'A união', orador3Fora: true, orador3Status: '' })),
      apoios: k === 3 ? 'Apoio: irmã Camila Moura como professora da Primária.' : '' });
  }

  // próximos: cada domingo mostra um estado diferente das vagas
  const PROXIMOS = [
    // o domingo que vem: dois confirmados (dá o Lembrete) e um sem resposta há 5 dias
    () => ({ ...aceito(1, 'Vítor Guimarães Teles', 'O dia do Senhor', { orador1ConvidadoEm: em(-9), orador1RespostaEm: em(-8) }),
      ...aceito(2, 'Camila Esteves Moura', 'Ministrar como o Salvador'),
      ...vaga(3, 'Sérgio Lacerda Pinto', { tema3: 'A paz', orador3Status: 'convidado', orador3ConvidadoEm: em(-5), orador3Por: 'bispo' }),
      primeiroHino: '3', hinoSacramental: '173', presidida: 'Bispo Renato Batista' }),
    // um convite aguardando, um "não poderá" e uma vaga a convidar
    () => ({ ...vaga(1, 'Lívia Albuquerque Ramos', { orador1Status: 'convidado', orador1ConvidadoEm: em(-2), orador1Por: 'c2' }),
      ...vaga(2, 'Lucas Tavares Rocha', { orador2Status: 'recusou', orador2ConvidadoEm: em(-4), orador2RespostaEm: em(-3), orador2Por: 'c1' }),
      ...vaga(3, 'Regina Xavier Monteiro', { tema3: 'A família', orador3Status: 'planejado' }) }),
    // orador de fora no 3º e um 2º com 20 minutos
    () => ({ ...vaga(1, 'Mateus Xavier Monteiro', { orador1Status: 'planejado' }),
      ...vaga(2, 'Isabela Vasconcelos Brito', { orador2Status: 'planejado', orador2Min: 20, tema2: 'O templo' }),
      ...vaga(3, 'Irmão Lima, da presidência da estaca', { orador3Fora: true, orador3Status: '' }) }),
    // só um orador planejado: as vagas abertas mostram as sugestões
    () => ({ ...vaga(3, 'Paulo Vasconcelos Brito', { orador3Status: 'planejado' }) }),
    // "não haverá este discurso" no 2º
    () => ({ orador2: '', orador2Status: 'dispensada' }),
    () => ({ tipo: 'especial', observacoes: 'Programa especial com a Primária e o coro da ala' }),
    () => ({}),
    () => ({}),
  ];
  // O 1º domingo do mês que vem primeiro fica sem tipo, para o app perguntar se
  // é jejum (ou conferência geral, em abril e outubro); o seguinte já marcado.
  let q = 0, primeiros = 0;
  for (let k = 0; k < 8; k++) {
    const dk = dom(k);
    if (ehPrimeiro(dk)) {
      if (primeiros++ > 0) sacramentais.push({ data: dk, tipo: tipoDoPrimeiro(dk) });
      continue;
    }
    const v = PROXIMOS[q++ % PROXIMOS.length]();
    if (Object.keys(v).length) sacramentais.push({ data: dk, ...v });
  }

  // ---------- ajustes do rodízio ----------
  const ajuste = (nome, campos) => ({ chave: chavePessoa(nome), nome: natural(nome), grupo: '', grupoEm: '', posicao: '', ultimoManual: '', pausaAte: '', ...campos });
  const oradores = [
    ajuste('Tiago Holanda Ribeiro', { grupo: 'novos', grupoEm: d(-63) }),
    ajuste('Gabriel Batista Lopes', { grupo: 'jas' }),
    ajuste('Larissa Macedo Freitas', { grupo: 'jas' }),
    ajuste('Rosa Queiroz Bastos', { pausaAte: d(75) }),
    ajuste('Vera Lacerda Pinto', { ultimoManual: d(-200) }),
    ajuste('Renato Batista Lopes', { ultimoManual: d(-420) }),
    ajuste('Helena Guimarães Teles', { posicao: '3' }),
  ];

  // ---------- acompanhamentos (os avulsos; os das entrevistas vêm da agenda) ----------
  const acompanhamentos = [
    { titulo: 'Família Fonseca Prado', assunto: 'Ministração: carona para as atividades', responsavel: '2º Conselheiro', data: d(-18),
      sigiloso: false, situacao: 'aberto', registros: [
        { data: d(-18), autor: '2º Conselheiro', texto: 'Combinado com o quórum de élderes o revezamento das caronas.' },
        { data: d(-4), autor: '2º Conselheiro', texto: 'Funcionando nas duas últimas semanas.' }] },
    { titulo: 'Rapazes do sacerdócio', assunto: 'Frequência às atividades de terça', responsavel: '1º Conselheiro', data: d(-25),
      sigiloso: false, situacao: 'aberto', registros: [
        { data: d(-25), autor: '1º Conselheiro', texto: 'Três rapazes não vêm há um mês. Conversar com os pais.' }] },
    { titulo: 'Família Duarte Silveira', assunto: 'Saúde do irmão Antônio — visitas', responsavel: 'Bispo', data: d(-30),
      sigiloso: true, situacao: 'aberto', registros: [
        { data: d(-30), autor: 'Bispo', texto: 'Visita feita. A família pediu discrição.' }] },
    { titulo: 'Casal Rezende Lima', assunto: 'Integração na ala', responsavel: 'Secretário', data: d(-44),
      sigiloso: false, situacao: 'concluido', registros: [
        { data: d(-44), autor: 'Secretário', texto: 'Registros de membro recebidos.' },
        { data: d(-30), autor: 'Secretário', texto: 'Já participam das reuniões e receberam ministradores.' }] },
  ];

  // ---------- notas ----------
  const notas = [
    { titulo: 'Escala de oração da reunião do bispado', texto: 'Semana 1: Bispo · Semana 2: 1º Conselheiro · Semana 3: 2º Conselheiro · Semana 4: Secretário', autor: 'Secretário', criadaEm: em(-40) },
    { titulo: 'Recomendações a vencer', texto: 'Conferir no LCR na primeira semana do mês e passar a lista para o secretário executivo.', autor: 'Secretário', criadaEm: em(-12) },
    { titulo: 'Ideias para a noite familiar da ala', texto: 'Jogo das famílias, testemunhos curtos dos jovens, lanche coletivo.', autor: '2º Conselheiro', criadaEm: em(-9) },
    { titulo: 'Zelador da capela', texto: 'Telefone de contato: (63) 90000-0099 (fictício).', autor: 'Secretário Executivo', criadaEm: em(-60) },
  ];
  const notasPrivadas = [
    { id: 'n_demo_p1', titulo: 'Para a próxima entrevista com a presidência da estaca', texto: 'Levar o resumo do rodízio de discursantes e as entrevistas de jovens.', autor: 'Bispo', criadaEm: em(-3) },
    { id: 'n_demo_p2', titulo: '', texto: 'Ligar para o irmão Antônio na quinta.', autor: 'Bispo', criadaEm: em(-1) },
  ];

  return {
    colecoes: { agenda, reunioes, designacoes, eventos_extras, sacramentais, acompanhamentos, oradores, bispado, notas },
    membros,
    notasPrivadas,
  };
}
