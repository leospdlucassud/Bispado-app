// =============================================
// ABA "VAMOS CRESCER A ALA" — o momento da ala e o caminho até duas alas
// Uma tela para a ala se ver de relance e se animar a trabalhar no que falta:
// os mínimos de uma ala do Manual Geral 36.2 (e o dobro, para dividir), os
// próximos passos que saem dos números, a frequência da sacramental, os
// indicadores do Relatório Trimestral, as recomendações para o templo, a
// frequência às classes, as famílias e os chamados.
// Os relatórios vêm do LCR em PDF. A leitura e as contas moram em
// crescimento-lcr.js (sem DOM, testado no Node) e os desenhos em graficos.js;
// este módulo carrega, desenha, conduz a importação e grava o que só o bispo
// informa. O servidor (/api/crescimento) entrega a parte privada — as
// recomendações por pessoa e o número dos dizimistas — só com a sessão de Bispo
// ou ADM, e só a sessão grava. A frequência da sacramental não mora lá: ela é a
// "frequência" de cada ata (sacramental.js), e a grade daqui grava nas atas.
// Cada número é uma pessoa (33.5.1.3): a tela conta, mas fala de gente.
// =============================================
import { abrirModalAgenda } from './agenda.js';
import { agendaCarregada, apiFetch, atualizarUltimaSinc, avisarPendente, setSyncStatus } from './api.js';
import { switchTab } from './app.js';
import { dadosDosChamados, setFiltroChamados } from './chamados-ala.js';
import { agruparPorOrganizacao, membroDoQuadro, membrosSemChamado, ordemNatural, resumoChamados } from './chamados-lcr.js';
import { ALA, API_CRESCIMENTO, DADOS } from './config.js';
import {
  METAS_ALA, MIN_SEMANAS_ANO, NOMES_DOS_PDFS, SECOES_TRIMESTRAL, SITUACOES, TIPO_RENOVACAO, abaDoPdf, chaveTrimestre, comparacaoIndicador,
  docCrescimentoVazio, domingosSemFrequencia, frequenciaSacramental, fundirCrescimento, gradeFrequencia, gruposSemMarcacao,
  historicoDigitado, historicoDoIndicador, historicoSacramental, lerEstatisticas, lerFrequenciaClasses, lerRecomendacoes,
  lerTrimestral, liderancaChave, limparCorpoCrescimento, mesCurto, mudancasDaGrade, normalizarDocCrescimento,
  participantesAdultos, participantesJovens, participantesSemNomes, piramideEtaria, progressoQualificacao, proximosPassos,
  recomendacaoValida, renovacaoNaAgenda, renovacoesAgendar, resumoQualificacao, resumoRenovacoes, tendenciaPorGrupo,
  tipoDePdfLcr, totalDeMembros, vencimentosPorMes,
} from './crescimento-lcr.js';
import { MEMBROS } from './dados-membros.js';
import { EM_DEMO } from './demo.js';
import { somarDias, somarMeses } from './discursos-regras.js';
import { confirmar } from './dialogo.js';
import {
  anel, barraDeMeta, barraEmpilhada, colunas, faisca, figura, fmt, fmtPct, legenda, linhaTempo, medidor, mini, piramide, tabela,
} from './graficos.js';
import { carregarPdfJs } from './membros-import.js';
import { MEMBROS_SAIDOS } from './membros.js';
import { lerFila } from './offline-pwa.js';
import { caixasDaPagina, lerPaginas } from './pdf-icones.js';
import { iniciarProgresso, liberarAplicar, travarAplicar } from './pdf-progresso.js';
import { carregarSacramentais, gravarCamposDomingo, sacCarregado, sacDoServidor } from './sacramental.js';
import { aoTerminarSessao, papelDaSessao } from './sessao.js';
import { abrirModal, fecharModal } from './ui.js';
import { abrirEscolhaCargo, podeVer, toast } from './usuario.js';
import { dataLocal, dataParaExibir, esc, norm } from './utils.js';

// ---------- estado ----------
// O documento de /api/crescimento: { publico, privado } — privado null sem a sessão
let DOC = { publico: docCrescimentoVazio().publico, privado: null };
// Já veio do servidor alguma vez. Antes disso, "nada importado" quer dizer "não sei".
export let crescimentoCarregado = false;
let carregando = true;               // a 1ª carga ainda não terminou
let gravacaoPendente = false;        // há gravação desta aba na fila (feita sem sinal)

const temSessao = () => !!papelDaSessao();
const ativos = () => MEMBROS.filter(m => m && !MEMBROS_SAIDOS.includes(m.id));
const entrevistasVisiveis = () => (DADOS.agenda || []).filter(podeVer);
// a data de cada relatório de recomendações: a renovação feita depois dela ainda não aparece na lista
const datasDasListas = pub => ({ adultos: pub.recomendacoes?.adultos?.data || '', jovens: pub.recomendacoes?.jovens?.data || '' });

// Para o Início (e quem mais precisar): o que a aba tem agora, só contagens —
// os próximos passos não levam nome nenhum. `renovacoes` sai da lista por
// pessoa (o privado): só com a sessão, e só os números (resumoRenovacoes);
// antes de a agenda vir, as já marcadas não são sabidas.
export function dadosDoCrescimento() {
  const ctx = contexto();
  const renovacoes = ctx.pri ? {
    ...resumoRenovacoes(ctx.pri.recomendacoesPessoas, agendaCarregada ? entrevistasVisiveis() : [], { hoje: ctx.hoje, datas: datasDasListas(ctx.pub) }),
    agendaCarregada,
  } : null;
  return {
    publico: DOC.publico, carregado: crescimentoCarregado, pendente: gravacaoPendente,
    progresso: ctx.progresso, passos: ctx.passos, membros: ctx.membros, renovacoes,
  };
}

// O privado só vale com a sessão aberta AGORA: a resposta de um pedido que
// saiu antes do "Sair" não traz os nomes de volta para a tela
function aplicarDoServidor(r) {
  const n = r && typeof r === 'object' ? normalizarDocCrescimento(r) : null;
  if (!n) return false;
  DOC = { publico: n.publico, privado: r.privado && temSessao() ? n.privado : null };
  return true;
}

// A gravação feita sem sinal fica na fila do IndexedDB até sair, e é mais nova
// que o que o servidor tem: vale por cima da carga — senão a atualização de
// 30 s trazia o documento antigo e a importação "sumia" (como em chamados-ala.js).
// Ela é juntada aqui com a MESMA conta do servidor (fundirCrescimento).
const caminhoDe = url => { try { return new URL(url, location.href).pathname; } catch (e) { return ''; } };
async function gravacoesNaFila() {
  const fila = await lerFila().catch(() => []);
  return fila.filter(i => i && i.method === 'POST' && caminhoDe(i.url) === API_CRESCIMENTO && i.body && typeof i.body === 'object')
    .sort((a, b) => a.ts - b.ts);
}
function comAFila(doc, fila) {
  let d = { publico: doc.publico, privado: doc.privado || docCrescimentoVazio().privado };
  for (const item of fila) {
    const r = limparCorpoCrescimento(item.body);
    if (!r.erro) d = fundirCrescimento(d, r.parcial, new Date(item.ts).toISOString());
  }
  return { publico: d.publico, privado: doc.privado ? d.privado : null };
}

// Devolve true se o servidor respondeu (como os load* de api.js). Uma falha
// mantém o que já está na tela: a carga de 30 s sem sinal não apaga a aba.
export async function carregarCrescimento() {
  let ok = false;
  try {
    if (aplicarDoServidor(await apiFetch(API_CRESCIMENTO))) crescimentoCarregado = ok = true;
  } catch (e) { /* sem conexão: fica o que havia */ }
  const fila = await gravacoesNaFila();
  gravacaoPendente = fila.length > 0;
  if (fila.length) DOC = comAFila(DOC, fila);
  carregando = false;
  renderCrescimento();
  return ok;
}

// Fim da sessão (Sair, troca de cargo, token recusado): os nomes das
// recomendações e o número dos dizimistas saem da memória e da tela na hora.
// Com a aba fechada o renderCrescimento não desenha — e o painel escondido
// guardava a lista de renovações (os nomes) e o campo dos dizimistas no DOM
// até alguém abrir a aba. Por isso as seções que mostram o privado são
// esvaziadas aqui (e esquecidas no ultimoHtml): o switchTab as redesenha sem ele.
// A prévia de importação aberta (com a lista de nomes) também vai embora.
const SECOES_COM_PRIVADO = ['cresc-rumo-corpo', 'cresc-sacramental-corpo', 'cresc-recomendacoes-corpo', 'cresc-passos-corpo'];
function esquecerPrivado() {
  DOC = { ...DOC, privado: null };
  if (IMPORTACAO?.corpo?.privado) { IMPORTACAO = null; if (modalAberto()) fecharModal('modal-crescimento'); }
  // esvazia sempre (mesmo com a aba aberta: a seção com o campo em foco seria
  // "adiada" pelo preencher, e o número ficava); aberta, redesenha na hora
  for (const id of SECOES_COM_PRIVADO) {
    ultimoHtml.delete(id);
    adiados.delete(id);
    const el = document.getElementById(id);
    if (el) el.innerHTML = '';
  }
  renderCrescimento();
}
aoTerminarSessao(esquecerPrivado);

// ---------- as contas de um desenho ----------
// Os adultos e jovens participantes que dá para provar. Com a sessão (as listas
// de recomendação por pessoa), cada um conta uma vez; sem ela, o maior dos dois
// grupos. null: sem recomendação importada e sem chamados com quadro, não há o que contar.
function contarParticipantes({ pub, pri, quadro, chamados }) {
  const out = {};
  for (const faixa of ['adultos', 'jovens']) {
    const resumo = pub.recomendacoes?.[faixa] || null;
    const pessoas = pri?.recomendacoesPessoas?.[faixa] || [];
    if (!resumo && !(chamados.length && quadro.length)) { out[faixa] = null; continue; }
    if (pri && pessoas.length) {
      const r = (faixa === 'jovens' ? participantesJovens : participantesAdultos)({ membros: quadro, chamados, recomendacoes: pessoas });
      out[faixa] = { total: r.total, chamado: r.porMotivo.chamado, recomendacao: r.porMotivo.recomendacao, porPessoa: true, naoEncontrados: r.naoEncontrados };
    } else {
      out[faixa] = { ...participantesSemNomes({ membros: quadro, chamados, resumo }, faixa), porPessoa: false, naoEncontrados: 0 };
    }
  }
  return out;
}

// O número que a importação das recomendações e o "Salvar" do bispo gravam no
// privado (participantes): a mesma conta de contarParticipantes, com as listas
// novas por cima das guardadas
function participantesParaGravar(listas) {
  const quadro = ativos(), { chamados } = dadosDosChamados();
  const out = {};
  for (const faixa of ['adultos', 'jovens']) {
    const pessoas = listas[faixa] || [];
    if (!pessoas.length && !(chamados.length && quadro.length)) continue;
    out[faixa] = (faixa === 'jovens' ? participantesJovens : participantesAdultos)({ membros: quadro, chamados, recomendacoes: pessoas }).total;
  }
  return out;
}

function contexto() {
  const hoje = dataLocal();
  const pub = DOC.publico;
  const pri = temSessao() ? DOC.privado : null;
  const ch = dadosDosChamados();
  const chamados = ch.carregados || ch.pendente ? ch.chamados : [];
  const quadro = ativos();
  const membros = totalDeMembros({ estatisticas: pub.estatisticas, trimestres: pub.trimestral, quadro });
  const participantes = contarParticipantes({ pub, pri, quadro, chamados });
  const progresso = progressoQualificacao({
    membros: membros.valor, portadoresSM: pri?.portadoresAtivosDizimistas ?? null,
    adultosParticipantes: participantes.adultos?.total ?? null, jovensParticipantes: participantes.jovens?.total ?? null,
  });
  const atas = DADOS.sacramentais || [];
  // sacDoServidor, não sacCarregado: este fica true mesmo quando a carga falha
  // (sem sinal), e aí TODO domingo parecia sem contagem (como em inicio.js)
  const semContagem = sacDoServidor ? domingosSemFrequencia(atas, { hoje }) : [];
  const passos = proximosPassos({
    hoje, publico: pub, privado: pri, chamados, chamadosCarregados: ch.carregados || ch.pendente,
    domingosSemContagem: semContagem, sessao: !!pri,
  });
  const trimestreChave = Object.keys(pub.trimestral || {}).sort().at(-1) || '';
  return { hoje, pub, pri, ch, chamados, quadro, membros, participantes, progresso, atas, semContagem, passos, trimestreChave };
}

// ---------- pedaços ----------
const plural = (n, um, varios) => `${fmt(n)} ${n === 1 ? um : varios}`;
const ddmm = d => `${String(d).slice(8, 10)}/${String(d).slice(5, 7)}`;
const fimDoMes = mes => somarDias(somarMeses(mes + '-01', 1), -1);
const rotuloTrimestre = k => (/^\d{4}-T[1-4]$/.test(k) ? `${k.slice(-1)}º tri/${k.slice(0, 4)}` : k);
const pctDe = (a, b) => (b > 0 ? Math.round((a / b) * 100) : null);
const CARREGANDO = '<div class="loading">Carregando…</div>';
const vazia = (titulo, dica = '') => `<div class="cresc-vazia">${titulo}${dica ? `<span class="cresc-vazia-dica">${dica}</span>` : ''}</div>`;
const botaoEntrar = () => (EM_DEMO || temSessao() ? '' : ' <button type="button" class="inicio-link" data-act="entrar">Entrar como Bispo</button>');

// Seção que depende de um relatório que ainda não veio
function semRelatorio(nome, oQue) {
  if (carregando && !crescimentoCarregado) return CARREGANDO;
  if (!crescimentoCarregado) return vazia('📡 Sem conexão com o servidor', 'Os relatórios aparecem quando a conexão voltar');
  return vazia(`📄 Falta o relatório “${esc(nome)}”`, `Importe o PDF do LCR pelo botão lá em cima para ver ${esc(oQue)}.`);
}

// A atualização de 30 s redesenha a aba aberta: só troca o que mudou (sem
// piscar nem tirar o foco), e nunca a seção em que alguém está digitando —
// ela espera o campo perder o foco (adiados)
const ultimoHtml = new Map();
const adiados = new Set();
function preencher(id, html) {
  const el = document.getElementById(id);
  if (!el || ultimoHtml.get(id) === html) return;
  const foco = document.activeElement;
  if (foco && el.contains(foco) && foco.matches('input, textarea, select')) { adiados.add(id); return; }
  adiados.delete(id);
  ultimoHtml.set(id, html);
  el.innerHTML = html;
}

// =============================================
export function renderCrescimento() {
  const painel = document.getElementById('panel-crescimento');
  // fechada, a aba não desenha: o switchTab redesenha ao abri-la
  if (!painel || !painel.classList.contains('active')) return;
  const ctx = contexto();
  preencher('cresc-importar-dica', dicaImportar());
  preencher('cresc-fontes', fontes(ctx));
  preencher('cresc-indice', indice(ctx));
  preencher('cresc-rumo-corpo', secaoRumo(ctx));
  preencher('cresc-sacramental-corpo', secaoSacramental(ctx));
  if (!gradeSuja) preencher('cresc-sac-grade', gradeSacramental(ctx));
  preencher('cresc-trimestral-corpo', secaoTrimestral(ctx));
  preencher('cresc-recomendacoes-corpo', secaoRecomendacoes(ctx));
  preencher('cresc-classes-corpo', secaoClasses(ctx));
  preencher('cresc-familias-corpo', secaoFamilias(ctx));
  preencher('cresc-chamados-corpo', secaoChamados(ctx));
  preencher('cresc-passos-corpo', secaoPassos(ctx));
}

// ---------- topo: importar, fontes e o índice ----------
function dicaImportar() {
  if (EM_DEMO) return 'Na demonstração, a importação do LCR fica desligada: os números são fictícios.';
  const aceita = 'Aceita o Relatório Trimestral, as Estatísticas da Unidade, a Situação de Recomendação para o Templo, a Situação da Recomendação do Jovem e a Frequência à classe e ao quórum (um mês por PDF), gerados no LCR com “Salvar como PDF”.';
  return temSessao() ? esc(aceita) : `🔒 Importar e informar os números do bispo pede a sessão de Bispo ou ADM.${botaoEntrar()} <span class="cresc-mudo">${esc(aceita)}</span>`;
}

function fontes(ctx) {
  const p = ctx.pub, itens = [];
  if (ctx.trimestreChave) {
    const t = p.trimestral[ctx.trimestreChave];
    itens.push(`Trimestral ${rotuloTrimestre(ctx.trimestreChave)}${t.data ? ` (${dataParaExibir(t.data)})` : ''}`);
  }
  if (p.estatisticas) itens.push(`Estatísticas${p.importadoEm?.estatisticas ? ` (importadas em ${dataParaExibir(p.importadoEm.estatisticas)})` : ''}`);
  for (const [k, r] of [['adultos', 'Recomendações de adultos'], ['jovens', 'Recomendações de jovens']]) {
    const x = p.recomendacoes?.[k];
    if (x) itens.push(`${r}${x.data ? ` (${dataParaExibir(x.data)})` : ''}`);
  }
  const sem = (p.frequenciaClasses?.semanas || []).filter(s => s.registrada).map(s => s.data).sort();
  if (sem.length) itens.push(`Frequência às classes (${mesCurto(sem[0].slice(0, 7))} a ${mesCurto(sem.at(-1).slice(0, 7))})`);
  if (!itens.length) return '';
  let html = '📄 ' + itens.map(esc).join(' · ');
  if (gravacaoPendente) html += ' · <strong>aguardando envio ao servidor</strong>';
  const outra = [ctx.trimestreChave && p.trimestral[ctx.trimestreChave].ala, p.estatisticas?.ala].find(a => a && norm(a) !== norm(ALA));
  if (outra) html += ` · <span class="cresc-alerta-txt">relatório da ${esc(outra)}</span>`;
  return html;
}

const SECOES = [
  ['cresc-rumo', 'Rumo a duas alas'], ['cresc-passos', 'Próximos passos'], ['cresc-sacramental', 'Sacramental'],
  ['cresc-trimestral', 'Trimestral'], ['cresc-recomendacoes', 'Recomendações'], ['cresc-classes', 'Classes e quóruns'],
  ['cresc-familias', 'Famílias'], ['cresc-chamados', 'Chamados'],
];
function indice(ctx) {
  return SECOES.map(([id, r]) => {
    const n = id === 'cresc-passos' && ctx.passos.length ? ` (${ctx.passos.length})` : '';
    return `<button type="button" class="filtro-btn" data-act="ir-secao" data-secao="${id}">${esc(r + n)}</button>`;
  }).join('');
}

// ---------- 1. Rumo a duas alas ----------
const SELO = {
  regra: '<span class="cresc-selo cresc-selo-regra" title="O mínimo é a regra publicada no Manual Geral 36.2">mínimo: Manual Geral 36.2</span>',
  // os jovens participantes: a tabela de 36.2 os marca como recomendados, não exigidos
  recomendado: '<span class="cresc-selo cresc-selo-regra" title="O Manual Geral 36.2 recomenda este número, mas não o exige">recomendado: Manual Geral 36.2</span>',
  lcr: '<span class="cresc-selo cresc-selo-lcr">número do LCR</span>',
  quadro: '<span class="cresc-selo cresc-selo-lcr">contado no quadro</span>',
  est: '<span class="cresc-selo cresc-selo-est" title="O que dá para provar com os dados do app: o número de verdade é maior">estimativa · mínimo comprovado</span>',
  bispo: '<span class="cresc-selo cresc-selo-bispo">informado pelo bispo</span>',
};

const barraCriterio = c => barraDeMeta({
  atual: c.atual,
  metas: [{ valor: c.meta, rotulo: `1 ala · ${fmt(c.meta)}` }, { valor: c.metaDuas, rotulo: `2 alas · ${fmt(c.metaDuas)}` }],
  rotulo: `${c.rotulo}: ${c.atual == null ? 'número não informado' : fmt(c.atual)} — o ${c.recomendado ? 'recomendado' : 'mínimo'} é ${fmt(c.meta)} para uma ala e ${fmt(c.metaDuas)} para duas`,
});
// Na estimativa (um mínimo), o que falta é o que falta COMPROVAR: o número de
// verdade pode já ter passado — o dízimo não entra na conta
function situacao(c) {
  if (c.atual == null) return '';
  const faltam = c.estimativa ? 'faltam comprovar' : 'faltam';
  const alvo = c.recomendado ? 'recomendado' : 'mínimo';
  if (c.atual >= c.metaDuas) return `<div class="cresc-crit-sit ok">✓ Já chega ao ${alvo} de duas alas (${fmt(c.metaDuas)})</div>`;
  if (c.atual >= c.meta) return `<div class="cresc-crit-sit ok">✓ Passa do ${alvo} de uma ala · ${faltam} ${fmt(c.faltaDuas)} para duas</div>`;
  return `<div class="cresc-crit-sit">${faltam[0].toUpperCase() + faltam.slice(1)} ${fmt(c.falta)} para o ${alvo} de uma ala (${fmt(c.meta)})</div>`;
}
// o nome curto de cada critério, para a manchete
const CURTO = {
  membros: 'membros', portadoresSM: 'portadores do Sacerdócio de Melquisedeque ativos e dizimistas',
  adultosParticipantes: 'adultos participantes', jovensParticipantes: 'jovens participantes',
};
const cartao = ({ c, numero, selo, fonte = '', extra = '' }) => `
  <article class="cresc-crit">
    <div class="cresc-crit-cab"><h3 class="cresc-crit-rot">${esc(c.rotulo)}</h3>${c.recomendado ? SELO.recomendado : SELO.regra}</div>
    <div class="cresc-crit-num">${numero}</div>
    <div class="cresc-crit-barra">${barraCriterio(c)}</div>
    ${situacao(c)}
    <div class="cresc-crit-fonte">${selo}${fonte ? ` <span>${fonte}</span>` : ''}</div>
    ${extra}
  </article>`;

function secaoRumo(ctx) {
  if (carregando && !crescimentoCarregado) return CARREGANDO;
  const por = Object.fromEntries(ctx.progresso.map(c => [c.chave, c]));
  const r = resumoQualificacao(ctx.progresso);
  const v = ctx.pub.estatisticas?.valores || {};

  // a manchete: o que já está cumprido e o que mais falta para dividir. A
  // estimativa (participantes) é um mínimo: abaixo da meta ela não prova que falta.
  // Os jovens são recomendados, não exigidos: contam à parte, numa frase só deles
  const semNumero = r.total - r.conhecidos;
  const algum = r.conhecidos || r.recomendados.some(x => x.atual != null);
  const falta = ctx.progresso.filter(c => c.atual != null && !c.estimativa && c.atual < c.metaDuas).sort((a, b) => a.pctDuas - b.pctDuas)[0];
  const estimativaAbaixo = ctx.progresso.some(c => c.estimativa && c.atual != null && c.atual < c.meta);
  const manchete = !algum
    ? (crescimentoCarregado ? 'Importe os relatórios do LCR para ver onde a ala está.' : '📡 Os relatórios do LCR ainda não vieram do servidor.')
    : r.umaAla === r.total ? `🎉 A ala cumpre os ${r.total} mínimos de uma ala.`
    : `A ala já cumpre, comprovadamente, <strong>${r.umaAla} de ${r.total}</strong> mínimos de uma ala${semNumero ? ` (${semNumero === 1 ? 'um ainda sem número' : `${semNumero} ainda sem número`})` : ''}.`;
  const duas = algum ? ` Para dividir, cada metade precisa dos mínimos — o dobro de tudo: <strong>${r.duasAlas} de ${r.total}</strong> já chegariam lá.` : '';
  const foco = falta ? ` O que mais falta: <strong>${esc(CURTO[falta.chave] || falta.rotulo)}</strong> — ${fmt(falta.faltaDuas)} para duas alas.` : '';
  const jov = r.recomendados.find(x => x.chave === 'jovensParticipantes');
  const recomendado = jov?.atual == null ? ''
    : ` Os jovens participantes são recomendados, não exigidos: ${jov.umaAla ? `✓ já passam dos ${fmt(jov.meta)} de uma ala` : `${plural(jov.atual, 'comprovado', 'comprovados')}, de ${fmt(jov.meta)}`}.`;
  const ressalva = estimativaAbaixo ? ' Os participantes contados aqui são um mínimo (o dízimo, que só o bispo sabe, não entra): o número de verdade pode já ter passado.' : '';

  // membros
  const m = por.membros;
  const fonteMembros = ctx.membros.fonte === 'estatisticas' ? 'Estatísticas da Unidade'
    : ctx.membros.fonte === 'trimestral' ? `Relatório Trimestral ${rotuloTrimestre(ctx.trimestreChave)}, linha 10` : ctx.membros.fonte === 'quadro' ? 'quadro de membros (aba Membros)' : '';
  const cMembros = cartao({
    c: m, numero: m.atual == null ? '—' : `${fmt(m.atual)} <span class="cresc-crit-un">membros</span>`,
    selo: ctx.membros.fonte === 'quadro' ? SELO.quadro : SELO.lcr, fonte: esc(fonteMembros),
  });

  // portadores do SM ativos e dizimistas integrais: só o bispo sabe (o dízimo é confidencial, 34.4)
  const p = por.portadoresSM;
  const totalSM = (v.sumosSacerdotes ?? null) != null || (v.elderes ?? null) != null ? (v.sumosSacerdotes || 0) + (v.elderes || 0) : null;
  const contextoSM = totalSM == null ? '' : `<p class="cresc-crit-nota">No LCR: ${plural(totalSM, 'portador', 'portadores')} do Sacerdócio de Melquisedeque (${fmt(v.sumosSacerdotes || 0)} sumos sacerdotes e ${fmt(v.elderes || 0)} élderes)${v.elderesPerspectiva ? `, e ${plural(v.elderesPerspectiva, 'élder', 'élderes')} em perspectiva` : ''}. Quantos são ativos, dizimistas integrais e capazes de liderar, só o bispo sabe.</p>`;
  const formSM = ctx.pri ? `
    <form class="cresc-form-bispo" data-form="portadores">
      <label for="cresc-portadores">Quantos são ativos e dizimistas integrais?</label>
      <div class="cresc-form-linha">
        <input type="text" inputmode="numeric" maxlength="5" id="cresc-portadores" class="form-input" value="${p.atual ?? ''}" placeholder="0" autocomplete="off">
        <button type="submit" class="btn-secondary">Salvar</button>
      </div>
      <p class="cresc-crit-nota">🔒 Só o Bispo e o ADM veem e mudam este número — o dízimo é confidencial (34.4).</p>
    </form>`
    : `<p class="cresc-crit-nota">🔒 O número fica com o bispo (o dízimo é confidencial — 34.4).${botaoEntrar()}</p>`;
  const cSM = cartao({
    c: p, numero: ctx.pri ? (p.atual == null ? '—' : `${fmt(p.atual)} <span class="cresc-crit-un">portadores</span>`) : '<span class="cresc-cadeado-num" aria-label="Sigiloso">🔒</span>',
    selo: SELO.bispo, extra: contextoSM + formSM,
  });

  return `
    <p class="cresc-lead">${manchete}${duas}${foco}${recomendado}${ressalva}</p>
    <div class="cresc-criterios">${cMembros}${cSM}${cartaoParticipantes(por.adultosParticipantes, ctx.participantes.adultos, 'adultos')}${cartaoParticipantes(por.jovensParticipantes, ctx.participantes.jovens, 'jovens')}</div>
    ${blocoLideranca(ctx, v, totalSM)}
    <p class="cresc-nota">📖 Manual Geral 36.2 (em vigor desde 1º/1/2024): uma ala precisa de ${METAS_ALA.membros} membros, ${METAS_ALA.portadoresSM} portadores do Sacerdócio de Melquisedeque ativos, dizimistas integrais e capazes de liderar, ${METAS_ALA.adultosParticipantes} adultos participantes e ${METAS_ALA.jovensParticipantes} jovens participantes (recomendado). “Participante” é quem paga o dízimo (integral ou parcial), tem recomendação para o templo válida, tem um chamado, é membro novo que frequenta no 1º ano, ou é jovem no seminário. A divisão é proposta pelo presidente da estaca: aqui está o caminho, não o pedido.</p>`;
}

function cartaoParticipantes(c, p, faixa) {
  const jovens = faixa === 'jovens';
  const numero = p ? `≥ ${fmt(p.total)} <span class="cresc-crit-un">${jovens ? 'jovens' : 'adultos'}</span>` : '—';
  const conta = !p ? `<p class="cresc-crit-nota">Importe a ${jovens ? 'Situação da Recomendação do Jovem' : 'Situação de Recomendação para o Templo'} e os chamados (aba Chamados) para contar.</p>`
    : p.porPessoa
      ? `<p class="cresc-crit-nota">Cada pessoa conta uma vez: com chamado (${fmt(p.chamado)}) ou com recomendação válida (${fmt(p.recomendacao)}).${p.naoEncontrados ? ` ${plural(p.naoEncontrados, 'pessoa com chamado não está', 'pessoas com chamado não estão')} no quadro de membros e fica${p.naoEncontrados === 1 ? '' : 'm'} de fora (sem a idade).` : ''}</p>`
      : `<p class="cresc-crit-nota">Sem os nomes das recomendações (que vêm só com a sessão do bispo), vale o maior dos dois grupos: com chamado (${fmt(p.chamado)}) ou com recomendação válida (${fmt(p.recomendacao)}).</p>`;
  const naoConta = `<p class="cresc-crit-nota">Não entra aqui, e conta no Manual: quem paga o dízimo (só o bispo sabe)${jovens ? ' e quem está no seminário' : ' e o membro novo que frequenta no 1º ano'}. O número de verdade é maior.</p>`;
  return cartao({ c, numero, selo: SELO.est, extra: conta + naoConta });
}

function blocoLideranca(ctx, v, totalSM) {
  const titulo = '<h3 class="cresc-sub">Liderança</h3>';
  if (!ctx.ch.carregados && !ctx.ch.pendente) return `${titulo}<p class="cresc-mudo">Os chamados ainda não vieram do servidor.</p>`;
  if (!ctx.chamados.length) return `${titulo}${vazia('🤝 Nenhum relatório de chamados', 'Importe “Organizações e Chamados” na aba Chamados para ver as presidências.')}`;
  const pres = liderancaChave(ctx.chamados);
  const completas = pres.filter(x => !x.vagos.length).length;
  const semChamado = ctx.quadro.length ? membrosSemChamado(ctx.quadro, ctx.chamados).length : null;
  const reserva = [
    totalSM != null ? `${plural(totalSM, 'portador', 'portadores')} do Sacerdócio de Melquisedeque na ala` : '',
    semChamado != null ? `${plural(semChamado, 'adulto ativo', 'adultos ativos')} sem chamado` : '',
  ].filter(Boolean);
  return `${titulo}
    <p class="cresc-texto">${completas} de ${pres.length} presidências completas. Duas alas pedem duas de cada — dois bispados, dois quóruns de élderes, duas Sociedades de Socorro, duas presidências das Moças, da Primária e da Escola Dominical.</p>
    <div class="cresc-medidores">${pres.map(x => medidor({
      rotulo: x.rotulo, valor: x.preenchidos, total: x.total, nota: x.vagos.length ? `Falta: ${x.vagos.join(', ')}` : '✓ completa',
    })).join('')}</div>
    ${reserva.length ? `<p class="cresc-texto">De onde vêm os líderes da segunda ala: ${esc(reserva.join(' e '))}.</p>` : ''}`;
}

// ---------- 8. Próximos passos ----------
function secaoPassos(ctx) {
  if (carregando && !crescimentoCarregado) return CARREGANDO;
  if (!ctx.passos.length) return vazia('🎉 Nada pendente por aqui', 'Continue ministrando: cada número é uma pessoa.');
  return `<ol class="cresc-passos">${ctx.passos.map(p => `<li>
    <button type="button" class="cresc-passo prioridade-${p.prioridade}" data-act="passo"${p.aba ? ` data-aba="${esc(p.aba)}"` : ''}${p.filtro ? ` data-filtro="${esc(p.filtro)}"` : ''}${p.secao ? ` data-secao="${esc(p.secao)}"` : ''}>
      <span class="cresc-passo-ico" aria-hidden="true">${esc(p.icone)}</span>
      <span class="cresc-passo-txt"><span class="cresc-passo-titulo">${esc(p.texto)}</span>${p.detalhe ? `<span class="cresc-passo-sub">${esc(p.detalhe)}</span>` : ''}</span>
      <span class="cresc-passo-ir" aria-hidden="true">→</span>
    </button></li>`).join('')}</ol>`;
}

// ---------- 2. Frequência da reunião sacramental ----------
function cartaoMes(m, atual) {
  const nome = mesCurto(m.mes);
  const leitura = m.media == null ? `${nome}: sem contagem`
    : `${nome}: média de ${fmt(m.media)} pessoas${m.pct != null ? `, ${m.pct}% dos membros` : ''} em ${plural(m.semanas.length, 'domingo', 'domingos')}`;
  return `<div class="cresc-mes${atual ? ' atual' : ''}${m.media == null ? ' vazio' : ''}">
    <div class="cresc-mes-nome">${esc(nome)}${atual ? ' <span class="cresc-mes-agora">este mês</span>' : ''}</div>
    ${anel({ pct: m.pct, tamanho: 64, rotulo: leitura, centro: m.pct == null ? '—' : undefined })}
    <div class="cresc-mes-media">${m.media == null ? 'Sem contagem' : `Média · <strong>${fmt(m.media)}</strong>`}</div>
    ${m.semanas.length ? `<ul class="cresc-mes-semanas">${m.semanas.map(s => `<li><span>${esc(ddmm(s.data))}</span><span>${fmt(s.n)}</span></li>`).join('')}</ul>` : ''}
  </div>`;
}

function secaoSacramental(ctx) {
  if (!sacCarregado) return CARREGANDO;
  const total = ctx.membros.valor;
  const f = frequenciaSacramental(ctx.atas, { membros: total, hoje: ctx.hoje, meses: 12 });
  const mesAtual = ctx.hoje.slice(0, 7);
  const aviso = sacDoServidor ? '' : '<div class="cresc-aviso">As atas ainda não vieram do servidor (sem conexão): os domingos podem estar incompletos.</div>';
  const denominador = total == null
    ? '<p class="cresc-nota">Sem o total de membros o % não sai: importe as Estatísticas da Unidade ou o Relatório Trimestral.</p>'
    : `<p class="cresc-texto">Das atas de cada domingo (aba Sacramental). O % é a média do mês sobre ${plural(total, 'membro', 'membros')}, como no LCR.</p>`;

  const pontos = f.porMes.flatMap(m => m.semanas.map(s => ({ data: s.data, valor: s.n })));
  const medias = f.porMes.filter(m => m.media != null).map(m => ({ de: m.mes + '-01', ate: fimDoMes(m.mes), valor: m.media }));
  const mediaDe = data => f.porMes.find(x => data.startsWith(x.mes));
  const figLinha = !pontos.length ? '' : figura({
    titulo: 'Cada domingo', sub: 'A linha é a contagem de cada domingo; o traço cinza, a média do mês.',
    conteudo: linhaTempo({
      pontos, medias, unidade: 'pessoas',
      rotulo: `Frequência da sacramental por domingo nos últimos 12 meses: ${plural(pontos.length, 'domingo contado', 'domingos contados')}, o último com ${fmt(pontos.at(-1).valor)} pessoas`,
      dicaExtra: p => { const m = mediaDe(p.data); return m?.media != null ? `Média de ${mesCurto(m.mes)}: ${fmt(m.media)}` : ''; },
    }),
    legendaHtml: legenda([{ rotulo: 'Domingo', classe: 'acento', forma: 'linha' }, { rotulo: 'Média do mês', classe: 'media', forma: 'linha' }]),
    tabelaHtml: tabela({ cab: ['Domingo', 'Pessoas', 'Média do mês'], linhas: pontos.map(p => [dataParaExibir(p.data), fmt(p.valor), fmt(mediaDe(p.data)?.media)]) }),
  });

  // todos os anos, do primeiro conhecido até o corrente: o ano que falta fica
  // sem coluna (à vista), em vez de sumir do eixo
  const anoAtual = +ctx.hoje.slice(0, 4);
  const conhecidos = historicoSacramental(ctx.pub.historicoSacramental, f.porAno, anoAtual);
  const primeiro = conhecidos.length ? Math.min(conhecidos[0].ano, anoAtual) : anoAtual;
  const anos = !conhecidos.length ? [] : Array.from({ length: anoAtual - primeiro + 1 }, (_, i) => primeiro + i)
    .map(ano => conhecidos.find(a => a.ano === ano) || { ano, pct: null, fonte: '' });
  const fonteAno = a => (a.fonte === 'calculado' ? `calculado das atas (${plural(a.semanas, 'domingo', 'domingos')})` : a.fonte === 'informado' ? 'informado do LCR' : 'não informado');
  const figAnos = !anos.length ? '' : figura({
    titulo: 'Ano a ano', sub: `% da média de cada ano sobre o total de membros. Os anos passados vêm do LCR (sem o % do LCR, das atas, se tiverem ao menos ${MIN_SEMANAS_ANO} domingos); ${anoAtual} sai das atas.`,
    conteudo: colunas({
      categorias: anos.map(a => String(a.ano)), series: [{ nome: 'Frequência', classe: 'acento', valores: anos.map(a => a.pct) }],
      formato: fmtPct, destaque: anos.findIndex(a => a.ano === anoAtual), altura: 140,
      rotulo: `Frequência da sacramental por ano: ${anos.map(a => `${a.ano}, ${a.pct == null ? 'não informado' : fmtPct(a.pct)}`).join('; ')}`,
      dicas: anos.map(a => `${a.ano}: ${fmtPct(a.pct)}\n${fonteAno(a)}`),
    }),
    tabelaHtml: tabela({ cab: ['Ano', 'Frequência', 'De onde'], linhas: anos.map(a => [String(a.ano), fmtPct(a.pct), fonteAno(a)]) }),
  });

  return `${aviso}${denominador}
    <div class="cresc-meses">${f.porMes.map(m => cartaoMes(m, m.mes === mesAtual)).join('')}</div>
    <div class="cresc-figuras">${figLinha}${figAnos}</div>
    ${formAnos(ctx, anoAtual)}`;
}

// O % dos anos passados, digitado uma vez a partir do LCR (gravar pede a sessão)
function formAnos(ctx, anoAtual) {
  if (!ctx.pri) return `<p class="cresc-mudo">🔒 O % dos anos anteriores (do LCR) é informado pelo Bispo ou ADM.${botaoEntrar()}</p>`;
  const h = ctx.pub.historicoSacramental || {};
  const anos = [...new Set([...Array.from({ length: 4 }, (_, i) => String(anoAtual - 4 + i)), ...Object.keys(h).filter(a => +a < anoAtual)])].sort();
  return `<details class="cresc-bispo">
    <summary>🔒 Informar o % dos anos anteriores (do LCR)</summary>
    <form class="cresc-form-anos" data-form="historico">
      ${anos.map(a => `<label class="cresc-ano"><span>${a}</span><input type="text" inputmode="decimal" maxlength="5" class="form-input" name="${a}" value="${h[a] ?? ''}" placeholder="%" autocomplete="off"></label>`).join('')}
      <button type="submit" class="btn-secondary">Salvar</button>
    </form>
    <p class="cresc-crit-nota">Na página de frequência da reunião sacramental do LCR, o % de cada ano. Deixe vazio para apagar.</p>
  </details>`;
}

// A grade de anotar a frequência: um mês por vez, gravando nas atas
let mesGrade = dataLocal().slice(0, 7);
let gradeSuja = false;   // digitado e não salvo: o redesenho não apaga
function gradeSacramental(ctx) {
  if (!sacCarregado) return '';
  const g = gradeFrequencia(ctx.atas, mesGrade, ctx.hoje);
  const faltam = ctx.semContagem;
  // sem as atas do servidor, "sem contagem" não é sabido, e o campo vazio
  // gravado (o POST que o servidor junta pela data) trocaria a contagem de lá:
  // a grade fica à vista, mas travada, até as atas virem
  const travada = !sacDoServidor;
  const status = travada ? '📡 As atas ainda não vieram do servidor (sem conexão): a grade abre quando elas chegarem.'
    : faltam.length
    ? `${plural(faltam.length, 'domingo recente sem contagem', 'domingos recentes sem contagem')}: ${esc(faltam.map(ddmm).join(', '))}.${faltam[0].slice(0, 7) !== mesGrade ? ` <button type="button" class="inicio-link" data-act="grade-mes-ir" data-mes="${esc(faltam[0].slice(0, 7))}">Ir para ${esc(mesCurto(faltam[0].slice(0, 7)))}</button>` : ''}`
    : '✓ As últimas 8 semanas estão com a contagem.';
  return `<h3 class="cresc-sub">Anotar a frequência</h3>
    <p class="cresc-texto">${status} A contagem fica na ata do domingo (aba Sacramental).</p>
    <div class="cresc-grade-nav">
      <button type="button" class="cal-nav" data-act="grade-mes" data-dir="-1" aria-label="Mês anterior">‹</button>
      <span class="cresc-grade-mes">${esc(mesCurto(mesGrade))}</span>
      <button type="button" class="cal-nav" data-act="grade-mes" data-dir="1" aria-label="Mês seguinte"${mesGrade >= ctx.hoje.slice(0, 7) ? ' disabled' : ''}>›</button>
    </div>
    <form class="cresc-grade" data-form="grade">
      ${g.map(d => `<label class="cresc-grade-dia${d.semReuniao ? ' sem' : ''}">
        <span class="cresc-grade-data">${esc(ddmm(d.data))}</span>
        ${d.semReuniao ? '<span class="cresc-grade-sem">conferência</span>'
          : `<input type="text" inputmode="numeric" maxlength="5" class="form-input" name="${d.data}" value="${esc(d.frequencia)}" placeholder="${d.futuro ? '—' : 'pessoas'}"${d.futuro || travada ? ' disabled' : ''} aria-label="Frequência de ${esc(dataParaExibir(d.data))}" autocomplete="off">`}
      </label>`).join('')}
      <button type="submit" class="btn-secondary cresc-grade-salvar"${travada ? ' disabled' : ''}>Salvar</button>
    </form>`;
}

async function mudarMesGrade(mes) {
  if (gradeSuja && !await confirmar('Descartar a frequência digitada e não salva?', { perigo: true, okLabel: 'Descartar' })) return;
  gradeSuja = false;
  const hoje = dataLocal().slice(0, 7);
  mesGrade = mes > hoje ? hoje : mes;
  renderCrescimento();
}

async function salvarGrade(form) {
  // sem as atas do servidor, a grade é de campos vazios: gravar mandaria POSTs
  // que, juntados pela data, trocariam a contagem que já está lá
  if (!sacDoServidor) { toast('As atas ainda não vieram do servidor: anote quando a conexão voltar'); return; }
  const g = gradeFrequencia(DADOS.sacramentais || [], mesGrade, dataLocal());
  // o que estava no campo quando a grade foi desenhada (defaultValue): só vai o
  // que a pessoa mexeu — o resto pode ter mudado depois, em outra tela
  const campos = [...form.querySelectorAll('input[name]')].filter(i => !i.disabled);
  const digitado = Object.fromEntries(campos.map(i => [i.name, i.value]));
  const desenhado = Object.fromEntries(campos.map(i => [i.name, i.defaultValue]));
  const membros = contexto().membros.valor;
  const { mudancas, invalidos, zeros, acima, conflitos } = mudancasDaGrade(g, digitado, { desenhado, teto: membros });
  if (invalidos.length) { toast(`Use só números: ${invalidos.map(ddmm).join(', ')}`); return; }
  if (zeros.length) { toast(`0 não é contagem (${zeros.map(ddmm).join(', ')}): para domingo sem reunião, marque o tipo na ata (aba Sacramental)`); return; }
  for (const c of conflitos) {
    if (!await confirmar(`A frequência de ${ddmm(c.data)} mudou em outra tela ou aparelho (agora: ${c.atual || 'vazia'}). Gravar ${c.novo || 'vazio'} por cima?`, { okLabel: 'Gravar' })) return;
  }
  if (acima.length) {
    const maior = Math.max(...mudancas.filter(m => acima.includes(m.data)).map(m => +m.frequencia));
    if (!await confirmar(`${fmt(maior)} pessoas é mais que os ${fmt(membros)} membros da ala. Salvar assim?`, { okLabel: 'Salvar' })) return;
  }
  gradeSuja = false;
  if (!mudancas.length) { toast('Nada foi alterado'); renderCrescimento(); return; }
  // uma gravação por domingo, pelo caminho das atas: só o campo frequencia vai
  // (PUT parcial ou o POST que o servidor junta pela data) — o resto da ata fica
  const r = await Promise.all(mudancas.map(m => gravarCamposDomingo(m.data, { frequencia: m.frequencia })));
  if (r.every(x => x === 'ok')) toast(plural(mudancas.length, 'domingo salvo', 'domingos salvos'));
  renderCrescimento();
}

// ---------- 3. Relatório Trimestral ----------
const SETA = { melhor: '▲', pior: '▼', igual: '=' };
const LEITOR = { melhor: ' (agora está melhor)', pior: ' (agora está pior)', igual: ' (igual)' };
function comparacoes(l, ano) {
  if (l.pct == null) return '';   // sem o % de agora (linhas 8, 10, 11, 21), não há o que comparar
  const c = comparacaoIndicador(l);
  const um = (dir, pct, a) => (pct == null ? '' : `<span class="cresc-comp cresc-comp-${dir || 'igual'}"><span aria-hidden="true">${SETA[dir] || '='}</span> era ${fmtPct(pct)} em ${a}<span class="so-leitor">${LEITOR[dir] || ''}</span></span>`);
  return um(c.anoAnterior, l.pctAnoAnterior, ano - 1) + um(c.cincoAnos, l.pct5Anos, ano - 5);
}
const valorIndicador = l => (l.potencial != null && l.real != null
  ? `<strong>${fmt(l.real)}</strong> de ${fmt(l.potencial)}${l.pct != null ? ` · <strong>${fmtPct(l.pct)}</strong>` : ''}`
  : l.real != null ? `<strong>${fmt(l.real)}</strong>` : '—');

function cartaoIndicador(l, ano, hist) {
  const pct = l.potencial ? Math.min(100, Math.max(0, (l.real || 0) / l.potencial * 100)) : null;
  const leitura = `${l.rotulo || 'Linha ' + l.n}: ${l.real ?? '—'}${l.potencial != null ? ` de ${l.potencial}` : ''}${l.pct != null ? `, ${l.pct}%` : ''}`;
  const serie = hist.map(h => h.pct);
  return `<article class="cresc-ind">
    <div class="cresc-ind-cab"><span class="cresc-ind-n">${l.n}</span><span class="cresc-ind-rot">${esc(l.rotulo || 'Linha ' + l.n)}</span></div>
    <div class="cresc-ind-valor">${valorIndicador(l)}</div>
    ${pct == null ? '' : `<div class="cg-medidor-trilho" role="img" aria-label="${esc(leitura)}"><div class="cg-medidor-barra cg-bg-acento" style="width:${Math.round(pct * 10) / 10}%"></div></div>`}
    <div class="cresc-ind-comps">${comparacoes(l, ano)}${serie.filter(x => x != null).length > 1 ? `<span class="cresc-ind-hist">${faisca(serie, { rotulo: `Histórico do indicador ${l.n}: ${hist.map(h => `${rotuloTrimestre(h.chave)} ${fmtPct(h.pct)}`).join(', ')}` })}</span>` : ''}</div>
  </article>`;
}

function secaoTrimestral(ctx) {
  const chave = ctx.trimestreChave;
  if (!chave) return semRelatorio(NOMES_DOS_PDFS.trimestral, 'os indicadores de conversão e de crescimento e o resto do relatório');
  const t = ctx.pub.trimestral[chave];
  const chaves = Object.keys(ctx.pub.trimestral).sort();
  const hist = n => (chaves.length > 1 ? historicoDoIndicador(ctx.pub.trimestral, n) : []);
  const linhas = t.linhas || [];
  const cards = linhas.filter(l => l.n <= 9).map(l => cartaoIndicador(l, t.ano, hist(l.n))).join('');
  const resto = SECOES_TRIMESTRAL.filter(s => s.chave !== 'conversao').map(s => {
    const ls = linhas.filter(l => (l.secao || '') === s.chave || (!l.secao && l.n >= s.de && l.n <= s.ate));
    if (!ls.length) return '';
    return `<div class="cresc-ind-grupo"><h4 class="cresc-ind-grupo-tit">${esc(s.titulo)}</h4><ul class="cresc-ind-lista">${ls.map(l => `
      <li class="cresc-ind-linha"><span class="cresc-ind-n">${l.n}</span><span class="cresc-ind-rot">${esc(l.rotulo || '')}</span>
        <span class="cresc-ind-val">${valorIndicador(l)}</span><span class="cresc-ind-comps">${comparacoes(l, t.ano)}</span></li>`).join('')}</ul></div>`;
  }).join('');
  return `<p class="cresc-texto">${t.trimestre}º trimestre de ${t.ano}${t.data ? ` · relatório de ${esc(dataParaExibir(t.data))}` : ''}. As setas comparam o % de agora com o de ${t.ano - 1} e o de ${t.ano - 5}.${chaves.length > 1 ? ` Trimestres importados: ${esc(chaves.map(rotuloTrimestre).join(', '))}.` : ''}</p>
    <h3 class="cresc-sub">${esc(SECOES_TRIMESTRAL[0].titulo)}</h3>
    <div class="cresc-indicadores">${cards || vazia('Nenhuma das linhas 1 a 9 foi lida.')}</div>
    <div class="cresc-ind-grupos">${resto}</div>`;
}

// ---------- 4. Recomendações para o templo ----------
// Ativa / para vencer / vencida são SITUAÇÃO: cor de situação, sempre com o
// ícone e o rótulo na legenda (o verde e o vermelho se confundem para o daltônico)
const SEGMENTOS = [['ativa', '✓ Ativa', 'bom'], ['para-vencer', '⏳ Para vencer', 'atencao'], ['vencida', '✕ Vencida', 'critico']];
function segmentosDe(r) {
  const s = r.porSituacao || {};
  const conhecidas = new Set(SEGMENTOS.map(x => x[0]));
  const outras = Object.entries(s).filter(([k]) => !conhecidas.has(k));
  const segs = SEGMENTOS.map(([k, rotulo, classe]) => ({ rotulo, valor: s[k] || 0, classe })).filter(x => x.valor);
  const nOutras = outras.reduce((t, [, n]) => t + n, 0);
  if (nOutras) segs.push({ rotulo: `• ${outras.map(([k]) => SITUACOES[k] || k).join(', ')}`, valor: nOutras, classe: 'neutro' });
  if (r.semSituacao) segs.push({ rotulo: '○ Sem recomendação', valor: r.semSituacao, classe: 'trilho' });
  return segs;
}

function figuraRecomendacao(tipo, r) {
  const jovens = tipo === 'jovens';
  const segs = segmentosDe(r);
  const total = r.lidos || segs.reduce((t, s) => t + s.valor, 0);
  const validas = (r.porSituacao?.ativa || 0) + (r.porSituacao?.['para-vencer'] || 0);
  const quem = jovens ? 'jovens' : 'adultos';
  const titulo = jovens ? 'Jovens · recomendação de uso limitado' : 'Adultos · recomendação para o templo';
  const sub = `${fmt(validas)} de ${fmt(total)} na lista com recomendação válida (${fmtPct(pctDe(validas, total))})${r.data ? ` · relatório de ${dataParaExibir(r.data)}` : ''}`;
  const confere = r.contagem != null && r.contagem !== r.lidos ? `O PDF dizia “Contagem: ${r.contagem}”, e foram lidos ${r.lidos}.` : '';
  const faixas = (r.porFaixa || []).filter(f => f.total);
  return figura({
    titulo, sub,
    conteudo: barraEmpilhada({ segs, rotulo: `${titulo}: ${segs.map(s => `${s.rotulo.replace(/^\S+\s/, '')} ${s.valor}`).join(', ')}` })
      + (faixas.length ? `<div class="cresc-medidores cresc-medidores-compactos">${faixas.map(f => medidor({
        rotulo: `${f.faixa} anos`, valor: f.ativas, total: f.total, nota: '', classe: 'bom',
      })).join('')}</div><p class="cresc-crit-nota">Por idade: com recomendação válida, de quantos ${quem} na lista.</p>` : ''),
    legendaHtml: legenda(segs.map(s => ({ rotulo: s.rotulo, classe: s.classe, valor: fmt(s.valor) }))),
    tabelaHtml: tabela({ cab: ['Situação', quem[0].toUpperCase() + quem.slice(1)], linhas: segs.map(s => [s.rotulo.replace(/^\S+\s/, ''), fmt(s.valor)]) }),
    nota: confere,
  });
}

const MES_EIXO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
function figuraVencimentos(a, j, hoje) {
  const desde = hoje.slice(0, 7);
  const va = vencimentosPorMes(a, { desde }), vj = vencimentosPorMes(j, { desde });
  const series = [];
  if (a) series.push({ nome: 'Adultos', classe: 's1', valores: va.meses.map(m => m.n) });
  if (j) series.push({ nome: 'Jovens', classe: 's2', valores: vj.meses.map(m => m.n) });
  const total = series.reduce((t, s) => t + s.valores.reduce((x, y) => x + y, 0), 0);
  const meses = va.meses.map(m => m.mes);
  const antes = (a ? va.antes : 0) + (j ? vj.antes : 0);
  return figura({
    titulo: 'Quando as recomendações vencem',
    sub: `As válidas, pelo mês da validade, de ${mesCurto(meses[0])} a ${mesCurto(meses.at(-1))} — a agenda de renovações do ano.`,
    conteudo: total ? colunas({
      categorias: meses.map(m => MES_EIXO[+m.slice(5, 7) - 1]), series, destaque: 0,
      rotulo: `Recomendações que vencem por mês nos próximos 12 meses: ${fmt(total)} no total`,
      dicas: meses.map((m, i) => [mesCurto(m), ...series.map(s => `${s.nome}: ${fmt(s.valores[i])}`)].join('\n')),
    }) : '<p class="cresc-mudo">Nenhuma recomendação válida vence nos próximos 12 meses.</p>',
    legendaHtml: series.length > 1 ? legenda(series.map(s => ({ rotulo: s.nome, classe: s.classe }))) : '',
    tabelaHtml: total ? tabela({ cab: ['Mês', ...series.map(s => s.nome)], linhas: meses.map((m, i) => [mesCurto(m), ...series.map(s => fmt(s.valores[i]))]) }) : '',
    nota: antes ? `${plural(antes, 'recomendação ainda válida no relatório já passou', 'recomendações ainda válidas no relatório já passaram')} da validade — o relatório é de antes. Importe um novo.` : '',
  });
}

function secaoRecomendacoes(ctx) {
  const { adultos, jovens } = ctx.pub.recomendacoes || {};
  if (!adultos && !jovens) return semRelatorio(`${NOMES_DOS_PDFS['recomendacoes-adultos']}” e “${NOMES_DOS_PDFS['recomendacoes-jovens']}`, 'quantas recomendações estão válidas, quando vencem e as renovações a agendar');
  const falta = t => `<div class="cresc-vazia">📄 Falta a “${esc(NOMES_DOS_PDFS['recomendacoes-' + t])}”.</div>`;
  const vencidas = [['adultos', adultos], ['jovens', jovens]].filter(([, r]) => r?.porSituacao?.vencida).map(([t, r]) => `${fmt(r.porSituacao.vencida)} de ${t}`);
  return `<div class="cresc-figuras">${adultos ? figuraRecomendacao('adultos', adultos) : falta('adultos')}${jovens ? figuraRecomendacao('jovens', jovens) : falta('jovens')}</div>
    ${vencidas.length ? `<p class="cresc-texto">Já vencidas: <strong>${esc(vencidas.join(' e '))}</strong> — cada uma, um convite para conversar.</p>` : ''}
    <div class="cresc-figuras">${figuraVencimentos(adultos, jovens, ctx.hoje)}</div>
    ${listaRenovacoes(ctx)}`;
}

// A ação de cada linha, conforme a Agenda (renovacaoNaAgenda) — como a da
// designação na aba Chamados: agendar; a renovação já marcada, que leva à
// Agenda; ou, feita depois do relatório, o lembrete de que a lista é de antes
// (só a próxima importação traz a validade nova). Antes de a agenda vir do
// servidor, "não está na Agenda" não é sabido: o botão fica de fora (a aba
// redesenha quando ela chega, no fim do carregarTudo).
function acaoRenovacao(p, tipo, desde) {
  if (!agendaCarregada) return '<span class="cham-espera" title="A Agenda ainda não veio do servidor">📡 Agenda ainda não carregada</span>';
  const ag = renovacaoNaAgenda(entrevistasVisiveis(), p, tipo, { desde });
  if (!ag) return `<button type="button" class="btn-secondary cresc-agendar" data-act="agendar-renovacao" data-tipo="${tipo}" data-nome="${esc(p.nome)}">📅 Agendar renovação</button>`;
  const quando = ag.e.data ? `${dataParaExibir(ag.e.data)}${ag.e.hora ? ` às ${ag.e.hora}` : ''}` : '';
  if (ag.estado === 'marcada') {
    return `<button type="button" class="cham-marcada" data-act="ir-aba" data-aba="agenda" title="Abrir a Agenda">📅 ${quando ? `Marcada · ${esc(quando)}` : 'Na Agenda, sem data'}</button>`;
  }
  return `<span class="cham-feita" title="A Agenda registra a entrevista como realizada; o relatório importado é de antes dela">✓ Feita${ag.e.data ? ` em ${esc(dataParaExibir(ag.e.data))}` : ''} · sai da lista na próxima importação</span>`;
}

// A lista com os nomes: só com a sessão (o servidor nem a entrega sem ela)
function listaRenovacoes(ctx) {
  if (!ctx.pri) return `<div class="cresc-cadeado">🔒 A lista de quem renovar, com os nomes, aparece só com a sessão de Bispo ou ADM.${botaoEntrar()}</div>`;
  const blocos = ['adultos', 'jovens'].map(tipo => {
    const pessoas = ctx.pri.recomendacoesPessoas?.[tipo] || [];
    if (!pessoas.length) return '';
    const lista = renovacoesAgendar(pessoas, { hoje: ctx.hoje });
    const desde = datasDasListas(ctx.pub)[tipo];
    const quem = tipo === 'adultos' ? 'adultos' : 'jovens';
    if (!lista.length) return `<p class="cresc-texto">✓ Nenhuma recomendação de ${quem} a renovar nos próximos 2 meses.</p>`;
    const vencem = lista.filter(p => p.motivo === 'vence').length;
    return `<details class="cresc-renov"${vencem ? ' open' : ''}>
      <summary>📅 Renovações a agendar — ${quem}: ${fmt(lista.length)} <span class="cresc-mudo">(${plural(vencem, 'vence', 'vencem')} em até 2 meses, ${plural(lista.length - vencem, 'já vencida', 'já vencidas')})</span></summary>
      <ul class="cresc-renov-lista">${lista.map(p => `<li class="cresc-renov-linha">
        <div class="cresc-renov-corpo"><div class="cresc-renov-nome">${esc(ordemNatural(p.nome))}</div>
          <div class="cresc-renov-sub">${p.idade != null ? `${p.idade} anos · ` : ''}${p.motivo === 'vencida' ? `venceu${p.validade ? ` em ${esc(mesCurto(p.validade))}` : ''}` : `vence${p.validade ? ` em ${esc(mesCurto(p.validade))}` : ' em breve'}`}</div></div>
        <div class="cresc-renov-acao">${acaoRenovacao(p, tipo, desde)}</div>
      </li>`).join('')}</ul>
    </details>`;
  }).join('');
  // o id: o item do Início ("recomendações a renovar") vem direto para cá
  return blocos ? `<h3 class="cresc-sub" id="cresc-renovacoes">🔒 Renovações a agendar</h3>${blocos}` : '';
}

// O "📅 Agendar renovação": a entrevista nova da Agenda já vem com a pessoa (o
// nome como o quadro escreve, para o telefone vir junto), o tipo e o motivo na
// observação — como o "Agendar designação" da aba Chamados
export function agendarRenovacao(p, tipo) {
  if (!p || !p.nome) return;
  const m = membroDoQuadro(ativos(), p.nome);
  const quando = p.validade ? ` em ${mesCurto(p.validade)}` : '';
  const obs = p.motivo === 'vencida' ? `Recomendação vencida${quando}` : `Recomendação vence${quando || ' em breve'}`;
  abrirModalAgenda('', { membro: m ? m.name : p.nome, tipo: TIPO_RENOVACAO[tipo] || TIPO_RENOVACAO.adultos, obs });
}
function agendarRenovacaoDe(ds) {
  const pessoas = (temSessao() && DOC.privado?.recomendacoesPessoas?.[ds.tipo]) || [];
  const p = renovacoesAgendar(pessoas, { hoje: dataLocal() }).find(x => x.nome === ds.nome);
  if (p) agendarRenovacao(p, ds.tipo);
}

// ---------- 5. Frequência às classes e aos quóruns ----------
const DIRECAO = { sobe: 'melhor', desce: 'pior', estavel: 'igual' };
// (a série é só dos domingos em que o grupo teve presença — tendenciaPorGrupo)
function cartaoGrupo(t, datas, semMarca) {
  const rec = t.serie.slice(-4);
  const dir = DIRECAO[t.direcao];
  const variacao = t.variacao == null ? ''
    : `<span class="cresc-comp cresc-comp-${dir}"><span aria-hidden="true">${SETA[dir]}</span> ${t.direcao === 'estavel' ? 'estável' : `${Math.abs(t.variacao)} pontos`}<span class="so-leitor">${t.direcao === 'sobe' ? ' a mais que' : t.direcao === 'desce' ? ' a menos que' : ' em relação'} nos 4 domingos com reunião anteriores</span></span>`;
  const janela = rec.length ? `${rec.length === 1 ? 'último domingo' : `últimos ${rec.length} domingos`} com reunião` : 'nenhum domingo com presença';
  return `<div class="cresc-grupo">
    <div class="cresc-grupo-cab"><span class="cresc-grupo-nome">${esc(t.rotulo)}</span><span class="cresc-grupo-pct">${fmtPct(t.taxaRecente * 100)}</span></div>
    <div class="cresc-grupo-sub">${plural(t.matriculados, 'matriculado', 'matriculados')} · ${janela} ${variacao}</div>
    ${mini({
      serie: t.serie.map(s => ({ data: s.data, taxa: s.taxa, dica: `${ddmm(s.data)}: ${s.presentes} de ${s.matriculados} (${Math.round(s.taxa * 100)}%)` })),
      datas, rotulo: `${t.rotulo}: presença por domingo com reunião, ${fmtPct(t.taxaRecente * 100)} (${janela})`,
    })}
    ${semMarca ? '<div class="cresc-grupo-alerta">📝 Quase ninguém marcado — confira se a frequência está sendo registrada no LCR</div>' : ''}
  </div>`;
}

function secaoClasses(ctx) {
  const semanas = ctx.pub.frequenciaClasses?.semanas || [];
  if (!semanas.length) return semRelatorio(NOMES_DOS_PDFS['frequencia-classes'], 'a frequência de cada quórum, classe e organização por domingo (um PDF por mês)');
  const tend = tendenciaPorGrupo(semanas);
  const datas = semanas.filter(s => s.registrada).map(s => s.data).sort();
  if (!tend.length || !datas.length) return vazia('Os meses importados ainda não têm presença marcada.');
  const semMarca = new Set(gruposSemMarcacao(tend));
  const linhas = datas.map(d => {
    const s = semanas.find(x => x.data === d);
    return [dataParaExibir(d), ...tend.map(t => { const g = s.porGrupo?.[t.grupo]; return g ? `${g.presentes} de ${g.matriculados}` : '—'; })];
  });
  return `<p class="cresc-texto">${plural(datas.length, 'domingo registrado', 'domingos registrados')}, de ${esc(dataParaExibir(datas[0]))} a ${esc(dataParaExibir(datas.at(-1)))}. Todos os quadros na mesma escala — de 0 a 100% dos matriculados — para comparar. O domingo em que o grupo não tem ninguém marcado (sem reunião, como a Escola Dominical em domingos alternados, ou sem a marcação) fica fora da conta. As setas comparam os 4 últimos domingos com reunião com os 4 anteriores.</p>
    <div class="cresc-grupos">${tend.map(t => cartaoGrupo(t, datas, semMarca.has(t.grupo))).join('')}</div>
    ${tabela({ cab: ['Domingo', ...tend.map(t => t.rotulo)], linhas, resumo: 'Ver os números de cada domingo' })}`;
}

// ---------- 6. Famílias e idades ----------
const tile = (valor, rotulo, nota = '') => (valor == null ? '' : `<div class="cresc-stat"><div class="cresc-stat-num">${fmt(valor)}</div><div class="cresc-stat-rot">${esc(rotulo)}</div>${nota ? `<div class="cresc-stat-nota">${esc(nota)}</div>` : ''}</div>`);
function secaoFamilias(ctx) {
  const v = ctx.pub.estatisticas?.valores || null;
  let numeros = '';
  if (v) {
    const fam = v.familias, sem = v.familiasSemPortadorSM;
    const destaque = fam && sem != null
      ? `<p class="cresc-destaque"><strong>${fmtPct(pctDe(sem, fam))}</strong> das famílias (${fmt(sem)} de ${fmt(fam)}) não têm um portador do Sacerdócio de Melquisedeque — é onde a ministração, as ordenações e o selamento mais fazem diferença.</p>` : '';
    const grupo = (titulo, tiles) => (tiles.join('') ? `<h4 class="cresc-ind-grupo-tit">${esc(titulo)}</h4><div class="cresc-stats">${tiles.join('')}</div>` : '');
    numeros = destaque
      + grupo('Famílias', [tile(fam, 'famílias'), tile(sem, 'sem portador do SM'), tile(v.familiasComJovens, 'com jovens'), tile(v.familiasComFilhos, 'com filhos'), tile(v.familiasMonoparentais, 'só um dos pais, com filhos')])
      + grupo('Adultos', [tile(v.adultos, 'adultos'), tile(v.adultosCasados, 'casados'), tile(v.adultosSolteiros36, 'solteiros de 36+'), tile(v.jas, 'jovens adultos solteiros (18–35)'), tile(v.recemConversos, 'recém-conversos (12 meses)')])
      + grupo('Sacerdócio', [tile(v.sumosSacerdotes, 'sumos sacerdotes'), tile(v.elderes, 'élderes'), tile(v.elderesPerspectiva, 'élderes em perspectiva'),
        tile(v.rapazes, 'rapazes', [v.sacerdotes != null && `${v.sacerdotes} sacerdotes`, v.mestres != null && `${v.mestres} mestres`, v.diaconos != null && `${v.diaconos} diáconos`].filter(Boolean).join(' · '))])
      + grupo('Moças e crianças', [tile(v.mocas, 'moças', [v.guardias != null && `${v.guardias} Guardiãs da Luz`, v.mensageiras != null && `${v.mensageiras} Mensageiras`, v.edificadoras != null && `${v.edificadoras} Edificadoras`].filter(Boolean).join(' · ')),
        tile(v.criancasPrimaria, 'crianças na Primária (3+)'), tile(v.criancas0a2, 'crianças de 0 a 2 anos')]);
  } else {
    numeros = semRelatorio(NOMES_DOS_PDFS.estatisticas, 'as famílias, os adultos casados e solteiros e o sacerdócio');
  }

  let pir = '';
  if (ctx.quadro.length) {
    const p = piramideEtaria(ctx.quadro);
    const contados = p.faixas.reduce((t, f) => t + f.m + f.f, 0);
    pir = figura({
      titulo: 'Idades e sexo, do quadro de membros', sub: `${plural(contados, 'pessoa', 'pessoas')} do quadro (aba Membros), por faixa de idade.`,
      conteudo: piramide({ faixas: p.faixas, rotulo: `Pirâmide de idades: ${p.faixas.map(f => `${f.faixa} anos, ${f.m} homens e ${f.f} mulheres`).join('; ')}` }),
      legendaHtml: legenda([{ rotulo: 'Homens', classe: 's1' }, { rotulo: 'Mulheres', classe: 's2' }]),
      tabelaHtml: tabela({ cab: ['Idade', 'Homens', 'Mulheres'], linhas: p.faixas.map(f => [f.faixa, fmt(f.m), fmt(f.f)]) }),
      nota: p.semIdade ? `${plural(p.semIdade, 'pessoa sem idade ou sexo no quadro ficou', 'pessoas sem idade ou sexo no quadro ficaram')} de fora.` : '',
    });
  } else {
    pir = `<p class="cresc-mudo">A pirâmide de idades sai do quadro de membros: importe a Lista de Membros na aba Membros.</p>`;
  }
  return `${numeros}<div class="cresc-figuras">${pir}</div>`;
}

// ---------- 7. Chamados ----------
function secaoChamados(ctx) {
  if (!ctx.ch.carregados && !ctx.ch.pendente) return vazia('📡 Os chamados ainda não vieram do servidor');
  if (!ctx.chamados.length) return `${vazia('🤝 Nenhum relatório de chamados', 'Importe “Organizações e Chamados” na aba Chamados.')}<div class="cresc-botoes"><button type="button" class="btn-secondary" data-act="ir-aba" data-aba="chamados">Abrir a aba Chamados</button></div>`;
  const r = resumoChamados(ctx.chamados);
  const orgs = agruparPorOrganizacao(ctx.chamados);
  return `<p class="cresc-texto"><strong>${fmt(r.preenchidos)} de ${fmt(r.total)}</strong> chamados preenchidos (${fmtPct(pctDe(r.preenchidos, r.total))}) · ${plural(r.vagos, 'vago', 'vagos')} · ${fmt(r.aDesignar)} a designar.</p>
    <div class="cresc-medidores">${orgs.map(o => medidor({ rotulo: o.org || 'Outros', valor: o.total - o.vagos, total: o.total, nota: o.vagos ? plural(o.vagos, 'vago', 'vagos') : '✓ todos preenchidos' })).join('')}</div>
    <div class="cresc-botoes">
      <button type="button" class="btn-secondary" data-act="ir-aba" data-aba="chamados">Abrir a aba Chamados</button>
      ${r.vagos ? '<button type="button" class="btn-secondary" data-act="ir-aba" data-aba="chamados" data-filtro="vagos">Ver os vagos</button>' : ''}
      ${r.aDesignar ? '<button type="button" class="btn-secondary" data-act="ir-aba" data-aba="chamados" data-filtro="a-designar">Ver os a designar</button>' : ''}
    </div>`;
}

// ---------- navegação ----------
// (o Início também usa: o item das renovações abre a aba já na lista)
export function irParaSecao(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  el.classList.add('plano-alvo');
  setTimeout(() => el.classList.remove('plano-alvo'), 2000);
}
function irParaAba(aba, filtro) {
  if (!aba) return;
  switchTab(aba);
  if (aba === 'chamados' && filtro) setFiltroChamados(filtro, { limparBusca: true });
}
function seguirPasso(ds) {
  if (ds.secao) irParaSecao(ds.secao);
  else irParaAba(ds.aba, ds.filtro);
}

// ---------- gravar (o que só a sessão grava) ----------
// Otimista: a tela muda na hora, juntando com a MESMA conta do servidor; sem
// sinal, a gravação fica na fila (apiFetch) e sai na próxima sincronização.
// A importação das recomendações leva a lista de NOMES: ela não vai para a fila
// (no IndexedDB, sobrevivia ao "Sair" até alguém entrar de novo como Bispo/ADM).
// Sem conexão, falha às claras e a tela volta ao que era — importar de novo
// com sinal (o PDF continua no aparelho).
async function gravar(corpo, { ok, acao }) {
  const r = limparCorpoCrescimento(corpo);
  if (r.erro) { toast('Não foi possível gravar: ' + r.erro); return false; }
  const comNomes = Object.values(r.parcial.privado?.recomendacoesPessoas || {}).some(l => l?.length);
  const antes = DOC;
  const base = { publico: DOC.publico, privado: DOC.privado || docCrescimentoVazio().privado };
  const novo = fundirCrescimento(base, r.parcial, new Date().toISOString());
  DOC = { publico: novo.publico, privado: temSessao() ? novo.privado : null };
  carregando = false;
  renderCrescimento();
  try {
    aplicarDoServidor(await apiFetch(API_CRESCIMENTO, 'POST', corpo, { semFila: comNomes }));
    crescimentoCarregado = true;
    atualizarUltimaSinc(); setSyncStatus('ok');
    if (ok) toast(ok);
    return true;
  } catch (e) {
    if (e?.semFila) {
      DOC = { publico: antes.publico, privado: temSessao() ? antes.privado : null };
      const porque = /^HTTP /.test(e.message || '') ? `o servidor recusou (${e.message})` : 'sem conexão com o servidor';
      toast(`Não foi gravado: ${porque}. Importe de novo com conexão — a lista tem nomes e não fica guardada no aparelho`);
      return false;
    }
    gravacaoPendente = true;
    avisarPendente(acao);
    return false;
  } finally {
    renderCrescimento();
  }
}

function salvarPortadores(form) {
  if (!temSessao()) { abrirEscolhaCargo(); return; }
  const txt = (form.querySelector('#cresc-portadores')?.value || '').trim();
  if (txt && !/^\d{1,5}$/.test(txt)) { toast('Use só números'); return; }
  const n = txt ? +txt : null;
  if (n === (DOC.privado?.portadoresAtivosDizimistas ?? null)) { toast('Nada foi alterado'); return; }
  gravar({ privado: { portadoresAtivosDizimistas: n } }, { ok: 'Número salvo — só o Bispo e o ADM o veem', acao: 'alteração' });
}

function salvarHistorico(form) {
  if (!temSessao()) { abrirEscolhaCargo(); return; }
  const digitado = Object.fromEntries([...form.querySelectorAll('input[name]')].map(i => [i.name, i.value]));
  const { valores, invalidos } = historicoDigitado(digitado);
  if (invalidos.length) { toast(`Use um % de 0 a 100: ${invalidos.join(', ')}`); return; }
  const atual = DOC.publico.historicoSacramental || {};
  const mudou = Object.fromEntries(Object.entries(valores).filter(([a, v]) => (atual[a] ?? null) !== v));
  if (!Object.keys(mudou).length) { toast('Nada foi alterado'); return; }
  gravar({ publico: { historicoSacramental: mudou } }, { ok: 'Histórico da sacramental salvo', acao: 'alteração' });
}

// ---------- importação do PDF ----------
// Como a dos chamados e a dos membros: o pdf.js lê o arquivo no próprio
// aparelho, a prévia mostra o que entra (e o que NÃO é guardado), e só o
// "Aplicar" grava. Um botão só para os cinco relatórios: o tipo vem do título.
let IMPORTACAO = null;   // { corpo, ok } — a prévia aberta
const conteudo = html => { const c = document.getElementById('modal-crescimento-content'); if (c) c.innerHTML = html; };
const modalAberto = () => !!document.getElementById('modal-crescimento')?.classList.contains('open');

function aviso(icone, titulo, html, extra = '') {
  conteudo(`
    <h3>${icone} ${esc(titulo)} <button type="button" class="modal-close" aria-label="Fechar">✕</button></h3>
    <div class="cham-aviso-texto">${html}</div>
    <div class="cham-prev-botoes">${extra}<button type="button" class="btn-secondary" data-act="fechar">Fechar</button></div>`);
}

const ACEITOS = `<ul class="cresc-lista-pdfs">${Object.values(NOMES_DOS_PDFS).map(n => `<li>${esc(n)}</li>`).join('')}</ul>`;
const AVISO_TIPO = {
  'sem-texto': () => aviso('⚠️', 'Este PDF não tem texto', `
    <p>Ele foi gerado como imagem — é o que acontece ao imprimir pelo <strong>Microsoft Print to PDF</strong> —, e não há o que ler nele.</p>
    <p>Gere de novo pelo LCR e, no destino da impressão, escolha <strong>Salvar como PDF</strong>.</p>`),
  membros: () => aviso('👥', 'Este é a Lista de Membros', `
    <p>A <strong>Lista de Membros</strong> se importa na aba Membros, pelo botão <strong>📄 Importar PDF do LCR</strong> — e a pirâmide de idades daqui sai dela.</p>`,
    '<button type="button" class="btn-secondary btn-destaque" data-act="ir-aba" data-aba="membros">Ir para Membros</button>'),
  chamados: () => aviso('🤝', 'Este é o relatório Organizações e Chamados', `
    <p>Ele se importa na aba Chamados, pelo botão <strong>📄 Importar PDF do LCR</strong> — e a liderança daqui sai dele.</p>`,
    '<button type="button" class="btn-secondary btn-destaque" data-act="ir-aba" data-aba="chamados">Ir para Chamados</button>'),
  outro: () => aviso('⚠️', 'Não reconheci este relatório', `<p>Esta aba importa estes relatórios do LCR:</p>${ACEITOS}<p>Confira o arquivo escolhido.</p>`),
};

function mensagemDeErro(e) {
  if (e?.name === 'PasswordException') return 'O PDF tem senha. Gere-o de novo pelo LCR, sem senha.';
  if (e?.name === 'InvalidPDFException') return 'O arquivo não é um PDF válido (ou veio corrompido).';
  return String(e?.message || e || 'Erro desconhecido');
}

// O botão "Importar": sem a sessão, explica (e oferece entrar) antes de abrir o arquivo
function pedirImportacao() {
  if (EM_DEMO) { toast('Na demonstração, a importação do LCR fica desligada — os números são fictícios'); return; }
  if (!temSessao()) {
    abrirModal('modal-crescimento', { semConfirmacao: true });
    aviso('🔒', 'Importar pede a sessão do bispo', `
      <p>Os relatórios do LCR desta aba são importados pelo <strong>Bispo</strong> ou pelo <strong>ADM</strong>: a situação das recomendações traz nomes, e só a sessão deles grava aqui.</p>`,
      '<button type="button" class="btn-secondary btn-destaque" data-act="entrar">Entrar como Bispo</button>');
    return;
  }
  document.getElementById('pdf-crescimento')?.click();
}

export async function importarPdfCrescimento(input) {
  const arquivo = input.files && input.files[0];
  input.value = '';
  if (!arquivo) return;
  // o PDF do LCR tem os dados de verdade: não entram na demonstração
  if (EM_DEMO) { toast('Na demonstração, a importação do LCR fica desligada — os números são fictícios'); return; }
  if (!temSessao()) { pedirImportacao(); return; }
  IMPORTACAO = null;
  abrirModal('modal-crescimento', { semConfirmacao: true });
  const progresso = iniciarProgresso(document.getElementById('modal-crescimento-content'), 'Abrindo o PDF…');
  try {
    const pdfjs = await carregarPdfJs();
    const doc = await pdfjs.getDocument({ data: await arquivo.arrayBuffer() }).promise;
    progresso.etapa('Lendo o relatório…');
    const { paginas } = await lerPaginas(doc, { OPS: pdfjs.OPS, progresso });
    if (!modalAberto()) return;   // fechou enquanto lia
    progresso.etapa('Conferindo os números…');
    // a Lista de Membros e os chamados são de outra aba (abaDoPdf): o aviso diz onde
    const tipo = tipoDePdfLcr(paginas);
    if (abaDoPdf(tipo) !== 'crescimento') (AVISO_TIPO[tipo] || AVISO_TIPO.outro)();
    else if (tipo === 'trimestral') previaTrimestral(lerTrimestral(paginas), doc.numPages);
    else if (tipo === 'estatisticas') previaEstatisticas(lerEstatisticas(paginas), doc.numPages);
    else if (tipo === 'recomendacoes-adultos' || tipo === 'recomendacoes-jovens') previaRecomendacoes(lerRecomendacoes(paginas), doc.numPages);
    else if (tipo === 'frequencia-classes') {
      // a presença não é texto: são ícones desenhados (pdf-icones.js), lidos página a página
      progresso.etapa('Lendo as presenças marcadas em cada domingo…');
      const icones = [];
      for (let i = 1; i <= doc.numPages; i++) {
        icones.push(await caixasDaPagina(await doc.getPage(i), pdfjs.OPS));
        progresso.pagina(i, doc.numPages);
      }
      progresso.etapa('Somando as presenças por organização…');
      if (!modalAberto()) return;
      previaFrequencia(lerFrequenciaClasses(paginas, icones), doc.numPages);
    }
  } catch (e) {
    if (modalAberto()) aviso('⚠️', 'Não foi possível importar', `<p>${esc(mensagemDeErro(e))}</p>`);
  }
}

// Pedaços da prévia (o visual é o da importação dos chamados: cham-prev-*)
const lista = (titulo, itens, aberto = false) => (!itens.length ? '' : `<details class="cham-prev-bloco"${aberto ? ' open' : ''}>
  <summary>${esc(titulo)}: ${itens.length}</summary><div class="cham-prev-lista">${itens.join('')}</div></details>`);
const avisoAla = ala => (ala && norm(ala) !== norm(ALA)
  ? `O PDF é da <strong>${esc(ala)}</strong>, mas o painel está configurado como <strong>${esc(ALA)}</strong>. Confira antes de aplicar.` : '');
const naoGuarda = txt => `<p class="cham-prev-nota cham-prev-rodape">🔐 ${txt}</p>`;

function mostrarPrevia({ titulo, avisos = [], resumo, corpo = '', rodape, dados, ok }) {
  const r = limparCorpoCrescimento(dados);
  if (r.erro) { aviso('⚠️', 'Não foi possível importar', `<p>O relatório foi lido, mas não ficou no formato que o servidor aceita (${esc(r.erro)}). Confira se o PDF veio inteiro.</p>`); return; }
  IMPORTACAO = { corpo: dados, ok };
  conteudo(`
    <h3>📄 ${esc(titulo)} <button type="button" class="modal-close" aria-label="Fechar">✕</button></h3>
    ${avisos.filter(Boolean).map(a => `<div class="cham-aviso">${a}</div>`).join('')}
    <p class="cham-prev-resumo">${resumo}</p>
    ${corpo}
    ${rodape}
    <div class="cham-prev-botoes">
      <button type="button" class="btn-primary" data-act="aplicar" disabled aria-disabled="true">Aplicar</button>
      <button type="button" class="btn-secondary" data-act="fechar">Cancelar</button>
    </div>`);
  // o mesmo modal com conteúdo novo: renova o retrato (ui.js)
  abrirModal('modal-crescimento', { semConfirmacao: true });
  // a prévia está inteira na tela: só agora o Aplicar liga (pdf-progresso.js)
  liberarAplicar(document.getElementById('modal-crescimento-content'));
}

function previaTrimestral(t, nPaginas) {
  if (!t.trimestre || !t.ano || !t.linhas.length) {
    aviso('⚠️', 'Relatório Trimestral sem os indicadores', `<p>${esc(t.avisos.join(' ') || 'Não encontrei o trimestre nem as linhas do relatório.')} Confira se o PDF veio inteiro.</p>`);
    return;
  }
  const k = chaveTrimestre(t), ja = DOC.publico.trimestral?.[k];
  mostrarPrevia({
    titulo: `Relatório Trimestral — ${t.trimestre}º trimestre de ${t.ano}`,
    avisos: [
      avisoAla(t.ala),
      t.faltando.length ? `Não li ${t.faltando.length === 1 ? 'a linha' : 'as linhas'} ${esc(t.faltando.join(', '))} — elas ficam sem número.` : '',
      ...t.avisos.map(esc),
      ja ? `Substitui o ${esc(rotuloTrimestre(k))} já importado${ja.data ? ` (relatório de ${esc(dataParaExibir(ja.data))})` : ''}. Os outros trimestres ficam no histórico.` : '',
    ],
    resumo: `<strong>${t.linhas.length}</strong> de 26 linhas lidas em ${plural(nPaginas, 'página', 'páginas')}${t.ala ? ` · ${esc(t.ala)}${t.unidade ? ` (${esc(t.unidade)})` : ''}` : ''}${t.data ? ` · relatório de ${esc(dataParaExibir(t.data))}` : ''}`,
    corpo: lista('Indicadores de conversão e de crescimento', t.linhas.filter(l => l.n <= 9).map(l => `<div>${l.n}. ${esc(l.rotulo)}: ${valorIndicador(l)}</div>`), true)
      + lista('As outras linhas', t.linhas.filter(l => l.n > 9).map(l => `<div>${l.n}. ${esc(l.rotulo)}: ${valorIndicador(l)}</div>`)),
    rodape: naoGuarda('Só os números das 26 linhas são guardados. A página “Detalhes sobre o Converso”, com nomes, não é lida.'),
    dados: { publico: { trimestral: t } },
    ok: `Relatório Trimestral do ${rotuloTrimestre(k)} importado`,
  });
}

function previaEstatisticas(e, nPaginas) {
  const n = Object.keys(e.valores).length;
  if (!n) { aviso('⚠️', 'Estatísticas da Unidade sem números', '<p>O relatório foi reconhecido, mas nenhum número foi lido nele. Confira se o PDF veio inteiro.</p>'); return; }
  const v = e.valores;
  const chave = (k, r) => (v[k] == null ? '' : `<div>${esc(r)}: <strong>${fmt(v[k])}</strong></div>`);
  mostrarPrevia({
    titulo: 'Estatísticas da Unidade',
    avisos: [avisoAla(e.ala), DOC.publico.estatisticas ? `Substitui as Estatísticas já importadas${DOC.publico.importadoEm?.estatisticas ? ` em ${esc(dataParaExibir(DOC.publico.importadoEm.estatisticas))}` : ''}.` : ''],
    resumo: `<strong>${n}</strong> números lidos em ${plural(nPaginas, 'página', 'páginas')}${e.ala ? ` · ${esc(e.ala)}${e.unidade ? ` (${esc(e.unidade)})` : ''}` : ''}`,
    corpo: `<div class="cham-prev-lista cresc-prev-chaves">${chave('totalMembros', 'Total de membros')}${chave('familias', 'Famílias')}${chave('familiasSemPortadorSM', 'Famílias sem portador do SM')}${chave('adultos', 'Adultos')}${chave('sumosSacerdotes', 'Sumos sacerdotes')}${chave('elderes', 'Élderes')}${chave('elderesPerspectiva', 'Élderes em perspectiva')}${chave('rapazes', 'Rapazes')}${chave('mocas', 'Moças')}${chave('recemConversos', 'Recém-conversos')}</div>`
      + lista('Linhas que o app não conhece (ficam guardadas com o rótulo)', e.outros.map(o => `<div>${esc(o.rotulo)}: ${fmt(o.valor)}</div>`)),
    rodape: naoGuarda('Só os totais da unidade são guardados — o relatório não tem nomes.'),
    dados: { publico: { estatisticas: { ala: e.ala, unidade: e.unidade, data: '', valores: e.valores, outros: e.outros } } },
    ok: 'Estatísticas da Unidade importadas',
  });
}

function previaRecomendacoes(r, nPaginas) {
  const jovens = r.tipo === 'jovens';
  const nome = NOMES_DOS_PDFS[jovens ? 'recomendacoes-jovens' : 'recomendacoes-adultos'];
  if (!r.pessoas.length) { aviso('⚠️', nome, '<p>O relatório foi reconhecido, mas ninguém foi lido nele. Confira se o PDF veio inteiro.</p>'); return; }
  const s = r.resumo;
  const confere = r.contagem != null && r.contagem === r.pessoas.length;
  const ja = DOC.publico.recomendacoes?.[r.tipo];
  const validas = r.pessoas.filter(p => recomendacaoValida(p.situacao)).length;
  // as listas que valem depois de aplicar: a nova deste tipo e a guardada do outro
  const listas = { ...(DOC.privado?.recomendacoesPessoas || {}), [r.tipo]: r.pessoas };
  mostrarPrevia({
    titulo: nome,
    avisos: [
      avisoAla(r.ala),
      r.contagem != null && !confere ? `O PDF diz <strong>Contagem: ${r.contagem}</strong>, mas foram lidas <strong>${r.pessoas.length}</strong> pessoas. Confira no LCR antes de aplicar.` : '',
      ja?.data && r.data && r.data < ja.data ? `Este relatório é de <strong>${esc(dataParaExibir(r.data))}</strong>, mais antigo que o já importado (${esc(dataParaExibir(ja.data))}).` : '',
    ],
    resumo: `<strong>${r.pessoas.length}</strong> ${jovens ? 'jovens' : 'adultos'} lidos em ${plural(nPaginas, 'página', 'páginas')}${confere ? ' (confere com a Contagem do LCR)' : ''}${r.data ? ` · relatório de ${esc(dataParaExibir(r.data))}` : ''} · <strong>${validas}</strong> com recomendação válida`,
    corpo: `<div class="cham-prev-lista cresc-prev-chaves">${Object.entries(s.porSituacao).map(([k, n]) => `<div>${esc(SITUACOES[k] || k)}: <strong>${fmt(n)}</strong></div>`).join('')}${s.semSituacao ? `<div>Sem recomendação: <strong>${fmt(s.semSituacao)}</strong></div>` : ''}</div>`,
    rodape: naoGuarda('Para todos, só as contagens. Os nomes ficam na parte protegida, que o servidor entrega só com a sessão de Bispo ou ADM — é dela que sai a lista de renovações. O tipo de recomendação não é guardado.'),
    dados: {
      publico: { recomendacoes: { [r.tipo]: s } },
      privado: { recomendacoesPessoas: { [r.tipo]: r.pessoas }, participantes: participantesParaGravar(listas) },
    },
    ok: `${nome}: ${plural(r.pessoas.length, 'pessoa importada', 'pessoas importadas')}`,
  });
}

function previaFrequencia(f, nPaginas) {
  const regs = f.semanas.filter(s => s.registrada);
  if (!f.semanas.length || !f.classes.length) {
    aviso('⚠️', 'Frequência à classe e ao quórum', `<p>${esc(f.avisos.join(' ') || 'Não encontrei os domingos nem as classes.')} Confira se o PDF veio inteiro.</p>`);
    return;
  }
  const grupos = {};
  for (const c of f.classes) (grupos[c.grupo] ||= []).push(c);
  const rotuloGrupo = g => ({ quorumElderes: 'Quórum de Élderes', sociedadeSocorro: 'Sociedade de Socorro', escolaDominicalAdultos: 'Escola Dominical (adultos)', rapazes: 'Rapazes', mocas: 'Moças', escolaDominicalJovens: 'Escola Dominical (jovens)', primaria: 'Primária', outros: 'Outras classes' })[g] || g;
  const semDados = f.semanas.filter(s => !s.registrada).map(s => ddmm(s.data));
  mostrarPrevia({
    titulo: `Frequência à classe e ao quórum — ${mesCurto(f.mes)}`,
    avisos: [
      avisoAla(f.ala),
      ...f.avisos.map(esc),
      f.icones.semRotulo ? `${f.icones.semRotulo} ícones de presença ficaram sem a classe ao lado e não entram na conta.` : '',
      semDados.length ? `Sem nenhuma presença marcada em ${esc(semDados.join(', '))} — esse${semDados.length === 1 ? ' domingo não entra' : 's domingos não entram'} (ainda não chegou, ou ninguém marcou) e não apaga${semDados.length === 1 ? '' : 'm'} o que já estiver guardado.` : '',
    ],
    resumo: `<strong>${f.pessoas}</strong> pessoas em ${plural(nPaginas, 'página', 'páginas')} · ${plural(regs.length, 'domingo com presença', 'domingos com presença')} de ${f.semanas.length} · ${fmt(f.icones.presentes)} presenças e ${fmt(f.icones.ausentes)} ausências`,
    corpo: lista('Classes em cada grupo (matriculados)', Object.entries(grupos).map(([g, cs]) => `<div><strong>${esc(rotuloGrupo(g))}</strong>: ${cs.map(c => `${esc(c.rotulo)} (${c.matriculados})`).join(', ')}</div>`)),
    rodape: naoGuarda('Nenhum nome é lido nem guardado: só, por domingo, quantos vieram e quantos estão matriculados em cada grupo. Os outros meses importados ficam.'),
    dados: { publico: { frequenciaClasses: { semanas: f.semanas.map(s => ({ data: s.data, porGrupo: s.porGrupo, registrada: s.registrada })) } } },
    ok: `Frequência de ${mesCurto(f.mes)} importada`,
  });
}

async function aplicarImportacao() {
  const imp = IMPORTACAO;
  if (!imp || !travarAplicar(document.getElementById('modal-crescimento-content'))) return;
  // a sessão pode ter terminado com a prévia aberta: sem ela o servidor recusa
  if (!temSessao()) { pedirImportacao(); return; }
  IMPORTACAO = null;
  fecharModal('modal-crescimento');
  await gravar(imp.corpo, { ok: imp.ok, acao: 'importação do relatório' });
}

// ---------- a dica dos gráficos ----------
// Uma caixa só, perto do dedo ou do cursor (e da marca, no foco do teclado),
// com o texto do data-tip — sempre por textContent: o rótulo vem do PDF.
// O app aplica zoom no body (o A+ de tema.js): a posição é dividida por ele.
function ligarDicas(raiz) {
  let caixa = null, atual = null;
  const zoom = () => parseFloat(document.body.style.zoom) || 1;
  const esconder = () => { atual?.classList.remove('cg-ativo'); atual = null; if (caixa) caixa.hidden = true; };
  function mostrar(alvo, x, y) {
    const t = alvo.getAttribute('data-tip');
    if (!t) { esconder(); return; }
    if (!caixa) {
      caixa = document.createElement('div');
      caixa.className = 'cg-dica';
      caixa.setAttribute('aria-hidden', 'true');   // o leitor de tela tem a tabela e o aria-label
      document.body.appendChild(caixa);
    }
    if (atual !== alvo) { atual?.classList.remove('cg-ativo'); atual = alvo; alvo.classList.add('cg-ativo'); caixa.textContent = t; }
    caixa.hidden = false;
    const z = zoom(), w = caixa.offsetWidth * z, h = caixa.offsetHeight * z, vw = document.documentElement.clientWidth;
    let left = x + 14, top = y - h - 14;
    if (left + w > vw - 8) left = Math.max(8, x - w - 14);
    if (top < 8) top = y + 18;
    caixa.style.left = `${left / z}px`;
    caixa.style.top = `${top / z}px`;
  }
  const alvoDe = e => { const a = e.target.closest?.('.cg-alvo[data-tip]'); return a && raiz.contains(a) ? a : null; };
  const noPonteiro = e => { const a = alvoDe(e); if (a) mostrar(a, e.clientX, e.clientY); else if (atual) esconder(); };
  raiz.addEventListener('pointermove', noPonteiro);
  raiz.addEventListener('pointerdown', noPonteiro);
  raiz.addEventListener('pointerleave', esconder);
  raiz.addEventListener('focusin', e => { const a = alvoDe(e); if (a) { const r = a.getBoundingClientRect(); mostrar(a, r.left + r.width / 2, r.top); } });
  raiz.addEventListener('focusout', esconder);
  addEventListener('scroll', esconder, { passive: true });
}

// ---------- ligações ----------
function ligarCrescimento() {
  const painel = document.getElementById('panel-crescimento');
  if (!painel) return;
  // os blocos são recriados a cada desenho: um listener só, no painel
  painel.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el || !painel.contains(el)) return;
    const ds = el.dataset;
    if (ds.act === 'importar') pedirImportacao();
    else if (ds.act === 'entrar') abrirEscolhaCargo();
    else if (ds.act === 'ir-secao') irParaSecao(ds.secao);
    else if (ds.act === 'passo') seguirPasso(ds);
    else if (ds.act === 'ir-aba') irParaAba(ds.aba, ds.filtro);
    else if (ds.act === 'grade-mes') mudarMesGrade(somarMeses(mesGrade + '-01', Number(ds.dir) || 0).slice(0, 7));
    else if (ds.act === 'grade-mes-ir') mudarMesGrade(ds.mes);
    else if (ds.act === 'agendar-renovacao') agendarRenovacaoDe(ds);
  });
  painel.addEventListener('submit', e => {
    const form = e.target.closest('form[data-form]');
    if (!form) return;
    e.preventDefault();
    if (form.dataset.form === 'portadores') salvarPortadores(form);
    else if (form.dataset.form === 'historico') salvarHistorico(form);
    else if (form.dataset.form === 'grade') salvarGrade(form);
  });
  painel.addEventListener('input', e => { if (e.target.closest('form[data-form="grade"]')) gradeSuja = true; });
  // a seção que esperou alguém sair do campo (preencher) redesenha agora
  painel.addEventListener('focusout', () => {
    if (!adiados.size) return;
    setTimeout(() => { if (!document.activeElement?.matches?.('input, textarea, select')) renderCrescimento(); }, 0);
  });
  document.getElementById('pdf-crescimento')?.addEventListener('change', e => importarPdfCrescimento(e.target));

  // o conteúdo do modal é reescrito em cada etapa (lendo / aviso / prévia);
  // o ✕ e o "Fechar"/"Cancelar" (data-act="fechar") são do ui.js
  document.getElementById('modal-crescimento')?.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    if (el.dataset.act === 'aplicar') aplicarImportacao();
    else if (el.dataset.act === 'entrar') { fecharModal('modal-crescimento'); abrirEscolhaCargo(); }
    else if (el.dataset.act === 'ir-aba') { fecharModal('modal-crescimento'); irParaAba(el.dataset.aba); }
  });
  ligarDicas(painel);
}
ligarCrescimento();

// Ao abrir a aba (app.js): as atas podem não ter vindo ainda (a frequência da
// sacramental mora nelas)
export function abrirCrescimento() {
  if (!crescimentoCarregado && !carregando) carregarCrescimento();
  if (!sacCarregado) carregarSacramentais().then(renderCrescimento);
  renderCrescimento();
}
