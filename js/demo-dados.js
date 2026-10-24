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

import { obsDaDesignacao } from './chamados-lcr.js';
import { TIPO_DESIGNACAO } from './convite-regras.js';
import {
  TIPO_RENOVACAO, fundirCrescimento, limparCorpoCrescimento, participantesAdultos, participantesJovens, resumoRecomendacoes,
} from './crescimento-lcr.js';
import { chavePessoa, ehDomingo, nomeNatural, partesData, proximoDomingo, somarDias, somarMeses } from './discursos-regras.js';

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
  const ano = h.a - idade - (passou ? 0 : 1);
  const bissexto = ano % 4 === 0 && (ano % 100 !== 0 || ano % 400 === 0);
  const dia = p.m === 2 && p.d === 29 && !bissexto ? 28 : p.d;   // 29/02 só em ano bissexto
  return `${dois(dia)} ${MES[p.m - 1]} ${ano}`;
}

// "Sobrenome, Prenome" → "Prenome Sobrenome", como o app grava na vaga
const natural = nome => nomeNatural(nome);

// ---------- a aba Vamos crescer a Ala: os relatórios fictícios do LCR ----------
// O elenco acima é a parte da ala que aparece nas outras abas; os relatórios do
// LCR falam da ala INTEIRA (288 membros — como a frequência das atas, ~100 por
// domingo, já supunha). Por isso as listas das recomendações juntam o elenco a
// "o resto da ala": gente inventada que nunca aparece com nome na tela — só
// recomendação válida por mais de 2 meses, sem recomendação ou não batizado,
// nada que entre nas "Renovações a agendar". Quem aparece com nome na lista
// está no quadro, com telefone, e é quem a Agenda conhece (a renovação marcada
// da Patrícia, a feita da Laura). Os números batem entre si: as Estatísticas
// somam o total, a linha 2 do Trimestral é a lista dos investidos, a 20 a dos jovens.
const PRENOMES = {
  M: ['Arthur', 'Bernardo', 'Caio', 'Diego', 'Elias', 'Fábio', 'Gustavo', 'Henrique', 'Igor', 'Jonas',
    'Leandro', 'Márcio', 'Nélson', 'Osvaldo', 'Renan', 'Saulo', 'Túlio', 'Vinícius', 'Wesley', 'Yuri'],
  F: ['Adriana', 'Beatriz', 'Cecília', 'Débora', 'Elaine', 'Flávia', 'Gisele', 'Heloísa', 'Ingrid', 'Joana',
    'Kátia', 'Luana', 'Marta', 'Nádia', 'Olga', 'Priscila', 'Raquel', 'Sílvia', 'Tânia', 'Valéria'],
};
const SOBRENOMES = ['Amaral', 'Barros', 'Campos', 'Dantas', 'Faria', 'Gouveia', 'Leal', 'Medeiros', 'Paixão',
  'Quintela', 'Sales', 'Toledo', 'Valente', 'Aguiar', 'Brandão'];
// o i-ésimo do "resto da ala": nenhum nome se repete até i = 59
const outroDaAla = (i, sexo) => `${SOBRENOMES[i % 15]} ${SOBRENOMES[(i + 5) % 15]}, ${PRENOMES[sexo][i % 20]}`;

// Estatísticas da Unidade (as chaves de lerEstatisticas): homens + mulheres +
// rapazes + moças + crianças = o total; os três grupos de adultos = os adultos
const ESTATISTICAS = {
  totalMembros: 288, homens: 108, sumosSacerdotes: 12, elderes: 28, elderesPerspectiva: 68, mulheres: 124,
  rapazes: 18, sacerdotes: 8, mestres: 6, diaconos: 4, mocas: 16, guardias: 6, mensageiras: 5, edificadoras: 5,
  criancasPrimaria: 17, criancas0a2: 5, familias: 172, familiasSemPortadorSM: 131, familiasComJovens: 26,
  familiasComFilhos: 19, familiasMonoparentais: 8, adultos: 232, adultosCasados: 64, adultosSolteiros36: 70, jas: 98,
  recemConversos: 4, conversosAdultosM: 1, conversosAdultosF: 1, conversosRapazes: 1, conversosMocas: 0, conversosCriancas: 1,
  ordenacoesRecemConversos: 2, recemConversosOrdenados: 1, recemConversosNaoOrdenados: 1,
  pessoasNaoIncluidas: 3, nascimentoFaltando: 0, batizadosNaoConfirmados: 0, registradosNoveAnosOuMais: 2,
};

// As 26 linhas do Relatório Trimestral (os rótulos do LCR) no trimestre mais
// recente: [n, real, potencial, % de 1 ano antes, % de 5 anos antes, passo]. Nos
// trimestres anteriores, real − passo × k: o histórico mostra a ala subindo — e
// algumas linhas abaixo de um ano antes, para as setas ▼ e os próximos passos.
// As linhas 2 e 20 saem das listas das recomendações (null aqui).
const SECAO_DA_LINHA = n => (n <= 9 ? 'conversao' : n <= 13 ? 'membros' : n <= 17 ? 'adultos' : n <= 20 ? 'jovens' : n <= 22 ? 'criancas' : 'conversos');
const LINHAS_TRIMESTRAL = [
  [1, 'Pessoas que são seladas ao cônjuge no templo', 30, 52, 55, 48, 1],
  [2, 'Membros com investidura que possuem recomendação válida para o templo', null, null, 80, 70, 1],
  [3, 'Pessoas do sexo masculino com idade entre 18–25 anos que estão servindo ou que serviram missão de tempo integral', 2, 14, 21, 14, 0],
  [4, 'Homens adultos que portam o Sacerdócio de Melquisedeque', 40, 108, 35, 33, 1],
  [5, 'Élderes em perspectiva ordenados ao Sacerdócio de Melquisedeque nos últimos 12 meses', 3, 71, 2, 4, 1],
  [6, 'Rapazes com o ofício do sacerdócio adequado à faixa etária', 14, 18, 72, 60, 0],
  [7, 'Média de frequência na reunião sacramental', 98, 288, 31, 36, 2],
  [8, 'Conversos batizados e confirmados nos últimos 12 meses', 4, null, null, null, 1],
  [9, 'Adultos e jovens que enviaram nomes de seus antepassados para as ordenanças do templo nos últimos 12 meses', 22, 260, 9, 4, 2],
  [10, 'Total de membros', 286, null, null, null, 2],
  [11, 'Total de famílias', 171, null, null, null, 1],
  [12, 'Duplas de irmãos ministradores entrevistados', 9, 24, 33, 50, 1],
  [13, 'Duplas de irmãs ministradoras entrevistadas', 14, 30, 40, 55, 1],
  [14, 'Portadores do Sacerdócio de Melquisedeque que frequentam as reuniões do sacerdócio, da Escola Dominical ou da Primária', 22, 40, 50, 45, 1],
  [15, 'Élderes em perspectiva que estão frequentando as reuniões do sacerdócio, da Escola Dominical ou da Primária', 9, 68, 15, 12, 0],
  [16, 'Mulheres que estão frequentando as reuniões da Sociedade de Socorro, da Escola Dominical, das Moças ou da Primária', 52, 124, 38, 35, 2],
  [17, 'Jovens adultos solteiros que estão frequentando as reuniões do sacerdócio, da Sociedade de Socorro, da Escola Dominical, das Moças ou da Primária', 18, 98, 16, 20, 1],
  [18, 'Rapazes que estão frequentando as reuniões do sacerdócio e da Escola Dominical', 9, 18, 61, 55, 0],
  [19, 'Moças que estão frequentando as reuniões das Moças e da Escola Dominical', 10, 16, 56, 60, 1],
  [20, 'Jovens com recomendação para o templo válida para batismos e confirmações vicários', null, null, 45, 30, 1],
  [21, 'Crianças com idade entre 0 e 2 anos (em 1º de janeiro)', 5, null, null, null, 0],
  [22, 'Crianças de 3 anos ou mais que frequentam a Primária', 15, 17, 82, 70, 0],
  [23, 'Conversos que assistiram a pelo menos uma reunião sacramental no último mês', 3, 4, 67, 100, 0],
  [24, 'Jovens e adultos conversos com um chamado ou responsabilidade na Igreja', 2, 4, 33, 50, 0],
  [25, 'Jovens e adultos conversos ordenados ao ofício apropriado do sacerdócio', 1, 2, 50, 0, 0],
  [26, 'Conversos de 12 anos de idade ou mais que enviaram nomes de seus antepassados para as ordenanças do templo nos últimos 12 meses', 1, 3, 0, 0, 0],
];

// Frequência às classes: [grupo, matriculados, presentes no começo, por semana,
// nas 4 últimas reuniões]. Cada grupo só se reúne nos domingos dele (Escola
// Dominical no 1º, 3º e 5º; quóruns, Sociedade de Socorro, Moças e Rapazes no 2º
// e no 4º; a Primária em todos) — nos outros, o grupo não entra no domingo. Os
// élderes caem nas últimas semanas e a Escola Dominical dos jovens quase não é
// marcada: os dois avisos da aba e dos próximos passos.
const CLASSES = [
  ['escolaDominicalAdultos', 230, 50, 0.6, null],
  ['escolaDominicalJovens', 34, 12, 0, 1],
  ['sociedadeSocorro', 124, 42, 0.1, null],
  ['quorumElderes', 108, 30, 0, 21],
  ['mocas', 16, 8, 0.25, null],
  ['rapazes', 18, 8, 0, null],
  ['primaria', 22, 15, 0.05, null],
];
const DOMINGOS_DO_GRUPO = {
  escolaDominicalAdultos: [1, 3, 5], escolaDominicalJovens: [1, 3, 5], sociedadeSocorro: [2, 4], quorumElderes: [2, 4],
  mocas: [2, 4], rapazes: [2, 4], primaria: [1, 2, 3, 4, 5],
};

function relatoriosDaDemo({ H, roster, saidos, chamados, lcr }) {
  const d = k => somarDias(H, k);
  const em = k => `${d(k)}T12:00:00.000Z`;
  const mes = k => somarMeses(H.slice(0, 8) + '01', k).slice(0, 7);   // k meses de hoje, 'AAAA-MM'
  let doc = null;
  const aplicar = (corpo, agora) => {
    const r = limparCorpoCrescimento(corpo);
    if (r.erro) throw new Error('demo: relatório fictício fora do formato — ' + r.erro);
    doc = fundirCrescimento(doc, r.parcial, agora);
  };

  // ---------- as listas das recomendações ----------
  const doQuadro = nome => { const k = lcr(nome); return roster.find(m => m.name === k); };
  const pessoa = (nome, situacao, meses) => {
    const m = doQuadro(nome);
    return { nome: m.name, sexo: m.gender, idade: m.age, situacao, validade: meses == null ? '' : mes(meses) };
  };
  // o elenco: os investidos do quadro (a Isabela e o Lucas ainda se preparam,
  // os jovens adultos e o converso ainda não foram ao templo)
  const adultos = [
    pessoa('Patrícia Albuquerque Ramos', 'para-vencer', 0),   // a renovação já está marcada na Agenda
    pessoa('Fernanda Cardoso Neves', 'para-vencer', 1),
    pessoa('Marcelo Albuquerque Ramos', 'ativa', 1),
    pessoa('Helena Guimarães Teles', 'ativa', 2),
    pessoa('Renato Batista Lopes', 'ativa', 14), pessoa('Cláudia Batista Lopes', 'ativa', 9),
    pessoa('Gabriel Batista Lopes', 'ativa', 20), pessoa('Bruno Cardoso Neves', 'ativa', 6),
    pessoa('Antônio Duarte Silveira', 'ativa', 23),   // renovou há 20 dias (Agenda)
    pessoa('Rafael Esteves Moura', 'ativa', 11), pessoa('Juliana Fonseca Prado', 'ativa', 4),
    pessoa('Otávio Guimarães Teles', 'ativa', 17), pessoa('Sérgio Lacerda Pinto', 'ativa', 12),
    pessoa('Vera Lacerda Pinto', 'ativa', 5), pessoa('Eduardo Nogueira Paiva', 'ativa', 8),
    pessoa('Simone Nogueira Paiva', 'ativa', 15), pessoa('André Rezende Lima', 'ativa', 19),
    pessoa('Bianca Rezende Lima', 'ativa', 19), pessoa('Paulo Vasconcelos Brito', 'ativa', 7),
    pessoa('Teresa Vasconcelos Brito', 'ativa', 10), pessoa('Mariana Tavares Rocha', 'ativa', 3),
    pessoa('Regina Xavier Monteiro', 'vencida', -1), pessoa('Lúcia Duarte Silveira', 'vencida', -3),
    pessoa('Camila Esteves Moura', 'vencida', -8), pessoa('Rosa Queiroz Bastos', 'vencida', -14),
  ];
  // o resto da ala: válidas por mais de 2 meses (de 3 a 24)
  for (let i = 0; i < 30; i++) {
    const sexo = i % 3 === 0 ? 'M' : 'F';
    adultos.push({ nome: outroDaAla(i, sexo), sexo, idade: 24 + ((i * 11) % 55), situacao: 'ativa', validade: mes(3 + ((i * 7) % 22)) });
  }
  const jovens = [
    pessoa('Davi Albuquerque Ramos', 'ativa', 7), pessoa('Lívia Albuquerque Ramos', 'ativa', 10),
    pessoa('Sofia Fonseca Prado', 'ativa', 11),
    pessoa('Vítor Guimarães Teles', 'ativa', 1),       // vence: a agendar
    pessoa('Pedro Fonseca Prado', 'vencida', -2),
    pessoa('Laura Guimarães Teles', 'vencida', -1),    // renovou ontem (Agenda): sai da lista na próxima importação
    pessoa('Natália Xavier Monteiro', '', null),       // ainda sem recomendação
  ];
  // 18 rapazes e 16 moças na ala (as Estatísticas): o resto, sem nome na tela
  for (let i = 0; i < 27; i++) {
    const sexo = i < 15 ? 'M' : 'F';
    const situacao = i % 3 === 0 ? 'ativa' : i % 9 === 4 ? 'nao-batizado' : '';
    jovens.push({ nome: outroDaAla(30 + i, sexo), sexo, idade: 11 + (i % 7), situacao, validade: situacao === 'ativa' ? mes(3 + (i % 9)) : '' });
  }
  const validas = l => l.filter(p => p.situacao === 'ativa' || p.situacao === 'para-vencer').length;

  // ---------- os trimestres (o mais recente completo e os dois de antes) ----------
  const m0 = +H.slice(5, 7);
  let tri = Math.ceil(m0 / 3) - 1, ano = +H.slice(0, 4);
  if (!tri) { tri = 4; ano--; }
  for (let k = 2; k >= 0; k--) {
    let t = tri - k, a = ano;
    while (t < 1) { t += 4; a--; }
    // o relatório do trimestre sai depois dele: duas semanas no seguinte (no máximo, hoje)
    const seguinte = somarMeses(`${a}-${dois(3 * t - 2)}-01`, 3);
    const data = somarDias(seguinte, 14) < H ? somarDias(seguinte, 14) : H;
    const linhas = LINHAS_TRIMESTRAL.map(([n, rotulo, real, potencial, ant, cinco, passo]) => {
      if (n === 2) [real, potencial] = [validas(adultos), adultos.length];
      if (n === 20) [real, potencial] = [validas(jovens), ESTATISTICAS.rapazes + ESTATISTICAS.mocas];
      const r = Math.max(0, real - passo * k);
      const pct = potencial ? Math.round(r / potencial * 100) : null;
      return { n, secao: SECAO_DA_LINHA(n), rotulo, real: r, potencial, pct, pctAnoAnterior: potencial ? ant : null, pct5Anos: potencial ? cinco : null };
    });
    aplicar({ publico: { trimestral: { ala: '', unidade: '', trimestre: t, ano: a, data, linhas } } }, `${data}T12:00:00.000Z`);
  }

  // ---------- Estatísticas da Unidade (a parte dos investidos sai da lista) ----------
  const valores = {
    ...ESTATISTICAS, adultosInvestidos: adultos.length,
    investidosComRecomendacao: validas(adultos), investidosSemRecomendacao: adultos.length - validas(adultos),
  };
  aplicar({ publico: { estatisticas: { ala: '', unidade: '', data: '', valores, outros: [] } } }, em(-2));

  // ---------- as recomendações: o resumo para todos, a lista no privado ----------
  const ativos = roster.filter(m => !saidos.includes(m.id));
  const doRelatorio = d(-2);
  aplicar({
    publico: { recomendacoes: {
      adultos: resumoRecomendacoes(adultos, { tipo: 'adultos', data: doRelatorio, contagem: adultos.length }),
      jovens: resumoRecomendacoes(jovens, { tipo: 'jovens', data: doRelatorio, contagem: jovens.length }),
    } },
    privado: {
      recomendacoesPessoas: { adultos, jovens },
      participantes: {
        adultos: participantesAdultos({ membros: ativos, chamados, recomendacoes: adultos }).total,
        jovens: participantesJovens({ membros: ativos, chamados, recomendacoes: jovens }).total,
      },
    },
  }, em(-2));
  // o número que só o bispo sabe (34.4): passa de uma ala, falta para duas
  aplicar({ privado: { portadoresAtivosDizimistas: 26 } }, em(-40));

  // ---------- frequência às classes: os 4 últimos meses, até o domingo passado ----------
  const semanas = [];
  let i = 0;
  for (let dk = proximoDomingo(somarMeses(H.slice(0, 8) + '01', -3)); dk < H; dk = somarDias(dk, 7)) {
    const p = partesData(dk);
    if (p.d <= 7 && (p.m === 4 || p.m === 10)) continue;   // conferência geral: não há aula
    const ordem = Math.ceil(p.d / 7);
    const porGrupo = {};
    for (const [g, matriculados, base, sobe] of CLASSES) {
      if (!DOMINGOS_DO_GRUPO[g].includes(ordem)) continue;
      porGrupo[g] = { presentes: Math.round(base + sobe * i + ((i * 7 + matriculados) % 5) - 2), matriculados };
    }
    semanas.push({ data: dk, porGrupo, registrada: true });
    i++;
  }
  // as 4 últimas reuniões dos grupos que mudam no fim (os élderes caem; a
  // Escola Dominical dos jovens quase não é marcada: 1 ou 2 de 34 — nunca 0, que
  // a aba lê como "sem reunião" e tira da conta)
  for (const [g, , , , recente] of CLASSES) {
    if (recente == null) continue;
    semanas.filter(s => s.porGrupo[g]).slice(-4).forEach((s, k) => { s.porGrupo[g].presentes = recente + (k % 2); });
  }
  for (const s of semanas) for (const g of Object.values(s.porGrupo)) g.presentes = Math.min(g.matriculados, Math.max(0, g.presentes));
  aplicar({ publico: { frequenciaClasses: { semanas } } }, em(-2));

  // ---------- o % da sacramental dos anos passados (digitado do LCR) ----------
  const a0 = +H.slice(0, 4);
  aplicar({ publico: { historicoSacramental: { [a0 - 4]: 38, [a0 - 3]: 35, [a0 - 2]: 33, [a0 - 1]: 31 } } }, em(-60));
  return doc;
}

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
        nome: lcr('André Rezende Lima'), motivo: 'Transferência Recebida (Mudança para a Ala)', data: d(-45), obs: 'Veio de outra estaca com a esposa', registradoPor: 'Secretário' },
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

  // ---------- chamados da ala (o relatório "Organizações e Chamados" do LCR) ----------
  // O documento de /api/chamados, como a importação do PDF o grava. O bispado é
  // o dos nomes acima; os vagos são os da reunião do bispado (professor da Escola
  // Dominical, conselheira das Moças) e mais alguns; um chamado personalizado; e
  // dois apoiados no domingo passado ainda "a designar" — o do André já com a
  // designação marcada na Agenda, o da Isabela por agendar. A Camila é a do apoio
  // da ata de 3 domingos atrás. Os adultos que não estão aqui são os que o filtro
  // "Sem chamado" mostra. A ala do relatório fica vazia: a tela mostra o nome
  // configurado (config.js).
  const domingo = k => somarDias(proximoDomingo(H), 7 * k);   // k < 0: domingos que passaram
  const cham = (org, grupo, chamado, nome = '', apoiadoHa = 0, extra = {}) => ({
    org, grupo, chamado, nome: nome ? lcr(nome) : '', apoiado: nome ? domingo(-apoiadoHa) : '',
    designado: !!nome, personalizado: false, ...extra,
  });
  const naoDesignado = { designado: false };
  const PRES_EQ = 'Presidência do Quórum de Élderes', PRES_SS = 'Presidência da Sociedade de Socorro';
  const chamados = {
    relatorio: { ala: '', unidade: '', estaca: '', data: H },
    atualizadoEm: em(0, '11:00'),
    chamados: [
      cham('Bispado', '', 'Bispo', 'Renato Batista Lopes', 150),
      cham('Bispado', '', 'Primeiro Conselheiro no Bispado', 'Otávio Guimarães Teles', 150),
      cham('Bispado', '', 'Segundo Conselheiro no Bispado', 'Eduardo Nogueira Paiva', 90),
      cham('Bispado', '', 'Secretário Executivo da Ala', 'Sérgio Lacerda Pinto', 60),
      cham('Bispado', '', 'Secretário executivo assistente da ala'),
      cham('Bispado', '', 'Secretário da Ala', 'Paulo Vasconcelos Brito', 200),
      cham('Quórum de Élderes', PRES_EQ, 'Presidente do Quórum de Élderes', 'Bruno Cardoso Neves', 40),
      cham('Quórum de Élderes', PRES_EQ, 'Primeiro Conselheiro na Presidência do Quórum de Élderes', 'Rafael Esteves Moura', 40),
      cham('Quórum de Élderes', PRES_EQ, 'Segundo Conselheiro na Presidência do Quórum de Élderes'),
      cham('Quórum de Élderes', PRES_EQ, 'Secretário do Quórum de Élderes', 'André Rezende Lima', 1, naoDesignado),
      cham('Sociedade de Socorro', PRES_SS, 'Presidente da Sociedade de Socorro', 'Patrícia Albuquerque Ramos', 70),
      cham('Sociedade de Socorro', PRES_SS, 'Primeira Conselheira na Presidência da Sociedade de Socorro', 'Juliana Fonseca Prado', 70),
      cham('Sociedade de Socorro', PRES_SS, 'Segunda Conselheira na Presidência da Sociedade de Socorro', 'Isabela Vasconcelos Brito', 1, naoDesignado),
      cham('Sociedade de Socorro', PRES_SS, 'Secretária da Sociedade de Socorro'),
      cham('Quóruns do Sacerdócio Aarônico', 'Presidência do Quórum de Mestres', 'Presidente do Quórum de Mestres', 'Vítor Guimarães Teles', 20),
      cham('Quóruns do Sacerdócio Aarônico', 'Presidência do Quórum de Mestres', 'Secretário do Quórum de Mestres'),
      cham('Moças', 'Presidência das Moças', 'Presidente das Moças', 'Regina Xavier Monteiro', 120),
      cham('Moças', 'Presidência das Moças', 'Primeira Conselheira na Presidência das Moças'),
      cham('Escola Dominical', 'Presidência da Escola Dominical', 'Presidente da Escola Dominical', 'Antônio Duarte Silveira', 100),
      cham('Escola Dominical', 'Professores', 'Professor da Escola Dominical', 'Mariana Tavares Rocha', 30),
      cham('Escola Dominical', 'Professores', 'Professor da Escola Dominical'),
      cham('Primária', 'Presidência da Primária', 'Presidente da Primária', 'Vera Lacerda Pinto', 80),
      cham('Primária', 'Presidência da Primária', 'Primeira Conselheira na Presidência da Primária'),
      cham('Primária', 'Professores', 'Professor da Primária', 'Camila Esteves Moura', 3),
      cham('Primária', 'Professores', 'Professor da Primária'),
      cham('Missionários de Ala', '', 'Líder da Obra Missionária da Ala', 'Marcelo Albuquerque Ramos', 90),
      cham('Missionários de Ala', '', 'Missionário de Ala', 'Gabriel Batista Lopes', 10),
      cham('Templo e história da família', '', 'Líder de Templo e História da Família da Ala'),
      cham('Templo e história da família', '', 'Consultor de Templo e História da Família da Ala', 'Lúcia Duarte Silveira', 60),
      cham('Outros Chamados', 'Música', 'Regente de Música da Ala', 'Simone Nogueira Paiva', 200),
      cham('Outros Chamados', 'Música', 'Organista ou Pianista da Ala', 'Teresa Vasconcelos Brito', 200),
      cham('Outros Chamados', '', 'Recepcionista da Ala', 'Tiago Holanda Ribeiro', 6, { personalizado: true }),
    ],
  };
  const chamadoDe = nome => chamados.chamados.find(c => c.nome === lcr(nome));

  // ---------- agenda de entrevistas ----------
  const ent = (nome, tipo, responsavel, extra) => ({
    membro: lcr(nome), tipo, responsavel, data: '', hora: '', telefone: '', prioridade: 'media', obs: '',
    acompanhar: false, sigiloso: false, status: 'pendente', reagendamentos: [], ...extra,
  });
  const agenda = [
    ent('Patrícia Albuquerque Ramos', TIPO_RENOVACAO.adultos, 'c1',
      { data: d(2), hora: '19:30', status: 'agendada', convidadoEm: em(-3), confirmacao: 'confirmado', confirmadoEm: em(-2, '15:20') }),
    ent('Davi Albuquerque Ramos', 'Entrevista Semestral (Jovem de 16–17 Anos)', 'bispo',
      { data: d(4), hora: '10:00', status: 'agendada', convidadoEm: em(-1) }),
    ent('Tiago Holanda Ribeiro', 'Novo Membro (Pós-Batismo)', 'c2',
      { prioridade: 'alta', acompanhar: true, obs: 'Combinar com os missionários', situacaoAcomp: 'aberto',
        registros: [
          { data: d(-50), autor: '2º Conselheiro', texto: 'Primeira visita com os missionários. Recebeu irmãos ministradores.' },
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
    ent('Antônio Duarte Silveira', TIPO_RENOVACAO.adultos, 'c2',
      { data: d(-20), hora: '09:30', status: 'realizada', realizadaEm: em(-20, '12:40'), obs_conclusao: 'Recomendação renovada.' }),
    ent('Pedro Fonseca Prado', 'Ordenação ao Ofício de Mestre', 'c1',
      { data: d(-14), hora: '10:30', status: 'realizada', realizadaEm: em(-14, '13:50'), obs_conclusao: 'Apoio na sacramental do próximo domingo.' }),
    ent('Camila Esteves Moura', 'Apoio de Chamado', 'c2',
      { data: d(-6), hora: '19:00', status: 'nao-realizada', motivo: 'Viajou a trabalho; remarcar depois do feriado.' }),
    ent('Gabriel Batista Lopes', 'Retorno de Missão', 'bispo',
      // antes dos 10 domingos de atas: o relato dele na sacramental vem depois
      { data: d(-80), hora: '20:00', status: 'realizada', realizadaEm: em(-80, '23:00'), obs_conclusao: 'Relato na sacramental combinado.' }),
    ent('Bianca Rezende Lima', 'Bem-Estar e Autossuficiência', 'bispo',
      { sigiloso: true, prioridade: 'alta', acompanhar: true, situacaoAcomp: 'aberto', registros: [
        { data: d(-9), autor: 'Bispo', texto: 'Conversa inicial. Encaminhada para o curso de autossuficiência.' },
      ] }),
    ent('Lívia Albuquerque Ramos', 'Entrevista Anual (Jovem de 12–15 Anos)', 'c2',
      { data: d(9), hora: '15:00', status: 'agendada', convidadoEm: em(-2), confirmacao: 'confirmado', confirmadoEm: em(-1, '22:05') }),
    ent('Isabela Vasconcelos Brito', 'Recomendação para Ordenanças Próprias (Investidura)', 'bispo',
      { data: d(12), hora: '19:00', status: 'agendada', convidadoEm: em(-6),
        reagendamentos: [{ dataAnterior: d(-2), horaAnterior: '19:00', reagendadoEm: em(-5) }] }),
    ent('Regina Xavier Monteiro', 'Desobrigação de Chamado', 'c1', { prioridade: 'normal' }),
    // a designação do André, apoiado no domingo passado: marcada pela aba Chamados
    ent('André Rezende Lima', TIPO_DESIGNACAO, 'c1',
      { data: domingo(0), hora: '12:30', status: 'agendada', obs: obsDaDesignacao(chamadoDe('André Rezende Lima')) }),
    ent('Alice Cardoso Neves', 'Batismo e Confirmação de Criança de Registro (8 anos)', 'bispo',
      { data: d(10), hora: '17:00', status: 'agendada', obs: 'Com os pais presentes' }),
    // a renovação da Laura foi ontem, depois do relatório das recomendações (de
    // anteontem): nas "Renovações a agendar" ela aparece como feita
    ent('Laura Guimarães Teles', TIPO_RENOVACAO.jovens, 'c2',
      { data: d(-1), hora: '19:00', status: 'realizada', realizadaEm: em(-1, '22:30'), obs: 'Recomendação vencida', obs_conclusao: 'Recomendação renovada.' }),
  ];

  // ---------- reuniões ----------
  // Presença nas atas (reunioes-regras.js): a fotografia dos nomes do bispado
  // fictício lá de cima, na ordem dos chamados. `faltou`: quem não estava.
  // As atas sem presença nem orações ficam como estão: são o formato antigo,
  // que o card e o PDF também precisam mostrar bem.
  const presenca = (faltou = []) => Object.entries(bispado[0].nomes)
    .map(([cargo, nome]) => ({ cargo, nome, presente: !faltou.includes(cargo) }));
  const reunioes = [
    { data: d(-21), tipo: 'correlacao', participantes: ['1º Conselheiro', 'Líder da obra missionária', 'Missionários'],
      pauta: 'Pessoas sendo ensinadas e próximos batismos.', itens: [
        { texto: 'Convidar os conversos para a noite familiar da ala', feito: true },
        { texto: 'Definir quem acompanha o irmão Tiago nas primeiras semanas', feito: true }] },
    { data: d(-14), tipo: 'conselho', presenca: presenca(['Secretário']),
      participantes: ['Presidentes das organizações', 'Líder da obra missionária'],
      oracaoInicial: 'Patrícia Albuquerque Ramos',
      pauta: 'Calendário do trimestre: noite familiar da ala e viagem ao templo.\n\n'
        + 'Famílias que precisam de apoio: combinar as visitas com os irmãos ministradores.',
      oracaoEncerramento: 'Renato Batista', itens: [
        { texto: 'Fechar a data da noite familiar da ala', feito: true },
        { texto: 'Levantar quem precisa de carona para a viagem ao templo', feito: false },
        { texto: 'Lista de aniversariantes para o mural', feito: false }] },
    { data: d(-10), tipo: 'jovens', participantes: ['Bispado', 'Presidências de quórum e de classe'],
      pauta: 'Atividade de gincana e participação nas entrevistas.', itens: [
        { texto: 'Reservar o salão cultural', feito: true },
        { texto: 'Convidar os rapazes menos ativos', feito: false }] },
    { data: d(-7), tipo: 'bispado', presenca: presenca(['2º Conselheiro']), participantes: [],
      oracaoInicial: 'Otávio Guimarães',
      // assuntos separados por linha em branco; o último é uma lista, um por linha
      pauta: 'Chamados em aberto: professor da Escola Dominical e conselheira das Moças. '
        + 'Conversar com os candidatos antes de domingo.\n\n'
        + 'Entrevistas da semana: recomendações para o templo a vencer e os jovens de 16–17 anos.\n\n'
        + 'Oradores dos próximos domingos:\nconferir o rodízio\nconvidar quem ainda não discursou neste ano',
      oracaoEncerramento: 'Paulo Vasconcelos', itens: [
        { texto: 'Convidar os oradores do domingo que vem', feito: true },
        { texto: 'Preparar a desobrigação da irmã Regina', feito: false },
        { texto: 'Conferir as recomendações a vencer', feito: false }] },
    { data: d(-28), tipo: 'bemestar', participantes: ['Bispo', 'Presidente da Sociedade de Socorro', 'Presidente do quórum de élderes'],
      pauta: 'Necessidades temporais e o curso de autossuficiência.', itens: [
        { texto: 'Abrir turma do curso de autossuficiência', feito: true }] },
    // ainda não aconteceu: a lista foi salva sem ninguém marcado (o card omite a seção)
    { data: d(5), tipo: 'bispado', presenca: presenca().map(p => ({ ...p, presente: false })), participantes: [],
      pauta: 'Planejamento do mês que vem.\n\nPrograma especial de fim de ano: músicas, oradores e a Primária.', itens: [
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
  // nenhum no domingo: o domingo é da sacramental, que tem o seu card
  const semDomingo = dk => (ehDomingo(dk) ? somarDias(dk, -1) : dk);
  const eventos_extras = [
    { data: d(3), txt: 'Noite familiar da ala — 19h30', cor: '#34d399' },
    { data: d(8), txt: 'Atividade dos jovens — gincana', cor: '#f472b6' },
    { data: d(27), txt: 'Batismo — Alice Cardoso', cor: '#34d399' },   // depois dos 8 anos dela
    { data: d(19), txt: 'Viagem ao templo', cor: '#50d0c0' },
    { data: d(26), txt: 'Conselho da ala', cor: '#c9a84c' },
    { data: d(-4), txt: 'Mutirão de limpeza da capela', cor: '#34d399' },
    { data: d(12), txt: 'Devocional da Primária', cor: '#34d399' },
    { data: d(18), txt: 'Limite do relatório trimestral', cor: '#c9a84c' },
    { data: d(22), txt: 'Reunião de liderança da estaca', cor: '#a78bfa' },
  ].map(e => ({ ...e, data: semDomingo(e.data) }));

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
    if (ehPrimeiro(dk)) {
      // conferência geral não tem reunião na ala: nem ata, nem hinos, nem frequência
      const tipo = tipoDoPrimeiro(dk);
      sacramentais.push(tipo === 'jejum' ? { ...base, tipo, observacoes: 'Testemunhos da congregação' } : { data: dk, tipo });
      continue;
    }
    const r = PASSADOS[p++ % PASSADOS.length];
    sacramentais.push({ ...base, tipo: 'normal', hinoIntermediario: String(140 + k),
      ...aceito(1, r[0], r[1]), ...aceito(2, r[2], r[3]),
      ...(r[4] ? aceito(3, r[4], r[5]) : vaga(3, 'Irmão Vidal, do sumo conselho', { tema3: 'A união', orador3Fora: true, orador3Status: '' })),
      apoios: k === 3 ? 'Apoio: irmã Camila Moura como professora da Primária.' : '' });
  }

  // um ano de frequência (a aba Vamos crescer a Ala desenha 12 meses): os
  // domingos de antes dos 10 de atas completas vêm só com a contagem e a
  // presidência, um pouco abaixo dos recentes — a ala cresceu no ano. A
  // conferência geral segue sem ata.
  for (let k = 52; k > 10; k--) {
    const dk = dom(-k);
    const tipo = ehPrimeiro(dk) ? tipoDoPrimeiro(dk) : 'normal';
    if (tipo === 'conf-geral') { sacramentais.push({ data: dk, tipo }); continue; }
    sacramentais.push({ data: dk, tipo, ...presidencia(k), frequencia: String(84 + ((k * 5) % 17)) });
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
      ...vaga(3, 'Presidente Lima, da presidência da estaca', { orador3Fora: true, orador3Status: '' }) }),
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

  // ---------- a aba Vamos crescer a Ala (o documento de /api/crescimento) ----------
  const crescimento = relatoriosDaDemo({ H, roster, saidos, chamados: chamados.chamados, lcr });

  return {
    colecoes: { agenda, reunioes, designacoes, eventos_extras, sacramentais, acompanhamentos, oradores, bispado, notas },
    membros,
    chamados,
    crescimento,
    notasPrivadas,
  };
}
