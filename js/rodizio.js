// =============================================
// RODÍZIO DE DISCURSOS — vistas "Próximos domingos" e "Rodízio" da Sacramental
// O bispado vê as vagas das próximas semanas, escolhe o orador pelas sugestões
// do rodízio, convida pelo WhatsApp com a mensagem pronta e marca a resposta.
// As regras (estado da vaga, sugestões, mensagem) ficam em discursos-regras.js;
// toda escrita de domingo passa por gravarCamposDomingo (sacramental.js).
//
// Privacidade (a API não tem senha): o telefone é lido do quadro na hora e
// nunca gravado; a pausa não tem motivo; recusas não ficam guardadas.
// =============================================
import { apiFetch, atualizarUltimaSinc, avisarPendente, idProvisorioDo, setSyncStatus } from './api.js';
import { comNome, nomeDoCargo } from './chamados.js';
import { ALA, API_ORADORES, DADOS, HORARIO_SACRAMENTAL, cargoInfo, nomeDoResponsavel } from './config.js';
import { MEMBROS } from './dados-membros.js';
import { confirmar } from './dialogo.js';
import {
  CORES_POSICAO, GRUPOS, LEMBRETE_DIAS, MAIS_SEMANAS, MAX_SEMANAS, MINUTOS_ALERTA, ORDEM_TIPOS, POSICOES,
  ROTULO_ESTADO, SEMANAS_PLANO, TEMPOS_OPCOES, TIPOS_DOMINGO,
  assinaturaConvite, camposAoTrocarOrador, camposVagaVazia, chavePessoa, diasEntre, docOrador, estadoDaVaga,
  grupoAuto, grupoDe, grupoDoBancoAntigo, grupoValido, haMeses, historicoDiscursos, indiceDoQuadro, infoGrupo,
  membroDaChave, mensagemDiscurso, mesPorExtenso, mesesEntre, minutosDaVaga, montarPessoas, nomeCurto,
  nomeNatural, ordenarRodizio, parecidos, partesData, pausadoEm, perfilParaMensagem, perguntarTipo,
  proximosDomingos, registroDoDomingo, somaMinutos, sugerirParaVaga, tipoDe,
} from './discursos-regras.js';
import { MEMBROS_SAIDOS } from './membros.js';
import {
  abrirModalSac, campoAta, chavesNaAta, getSacPorData, gravarCamposDomingo,
  renderAbaSacramental, sacCarregado, sacDoServidor, seloVaga,
} from './sacramental.js';
import { abrirModal, fecharModal } from './ui.js';
import { USUARIO, toast } from './usuario.js';
import { dataLocal, digitosTelefone, esc, formatarData, hrefWhatsApp, ico, norm } from './utils.js';

// Os ajustes (/api/oradores) vieram do servidor nesta sessão. Sem eles, a ficha
// abriria com os padrões e o salvar (upsert por chave) apagaria lá a pausa e o
// grupo que já existiam — então a ficha e a migração esperam a carga.
export let oradoresCarregados = false;
export function setOradoresCarregados(v) { oradoresCarregados = v; }
const ajustesNaoVieram = () => {
  if (oradoresCarregados) return false;
  toast('Os ajustes do rodízio ainda não vieram do servidor. Toque em Sincronizar e tente de novo.');
  return true;
};

let planoSemanas = SEMANAS_PLANO;
let filRodizio = 'todos';
let rodLimite = 50;
let escolha = null;      // o seletor aberto: { dk, n, modo, filtro, mostrar, sel, fora, min, tema }
let outroMeio = null;    // { dk, n, chave }
let tempoTema = null;    // { dk, n, chave, min }
let mover = null;        // { dk, n, chave }

const hojeK = () => dataLocal();
const codAtual = () => cargoInfo(USUARIO)?.cod || '';
const agoraIso = () => new Date().toISOString();
const dm = dk => { const p = partesData(dk); return p ? `${String(p.d).padStart(2, '0')}/${String(p.m).padStart(2, '0')}` : ''; };
const domingoCurto = dk => { const p = partesData(dk); return p ? `Dom, ${p.d} de ${mesPorExtenso(p.m)}` : ''; };

// histórico, pool e índice do quadro — recalculados a cada desenho (o app
// instalado fica aberto por dias; os dados chegam a cada 30 s)
function contexto() {
  const hoje = hojeK();
  const historico = historicoDiscursos(DADOS.sacramentais, hoje);
  const pessoas = montarPessoas({ membros: MEMBROS, saidos: MEMBROS_SAIDOS, oradores: DADOS.oradores || [], historico, hojeKey: hoje });
  return { hoje, historico, pessoas, indice: indiceDoQuadro(MEMBROS, MEMBROS_SAIDOS) };
}

// o domingo do Início ou da busca precisa estar na janela da vista
export function garantirJanela(dk) {
  const hoje = hojeK();
  while (planoSemanas < MAX_SEMANAS && !proximosDomingos(hoje, planoSemanas).includes(dk)) planoSemanas++;
}

function pessoaDaVaga(ctx, nome) {
  const chave = chavePessoa(nome);
  return ctx.pessoas.get(chave) || { chave, nome: nomeNatural(nome), membro: null, grupo: 'outros' };
}

// Texto e telefone do convite (ou do lembrete) de uma vaga. O telefone só vem
// de um membro com o nome idêntico e único no quadro: com homônimos o convite
// poderia ir para a pessoa errada.
function mensagemDaVaga(ctx, sac, dk, n, tipo, troca = {}) {
  const nome = troca.nome ?? sac?.['orador' + n] ?? '';
  const pessoa = pessoaDaVaga(ctx, nome);
  const membro = membroDaChave(pessoa.chave, ctx.indice);
  const perfil = perfilParaMensagem({ ...pessoa, membro }, dk);
  const msg = mensagemDiscurso({
    tipo, nome, genero: perfil.genero, menor: perfil.menor, n, dk,
    minutos: troca.min ?? minutosDaVaga(sac, n),
    tema: troca.tema ?? String(sac?.['tema' + n] || ''),
    horario: HORARIO_SACRAMENTAL,
    assinatura: assinaturaConvite(codAtual(), nomeDoCargo(USUARIO), ALA),
    hojeKey: ctx.hoje,
  });
  return { msg, tel: membro?.telefone || '', membro };
}

// Os "Convidar" são <a href> de verdade, montados no desenho: abrir o WhatsApp
// por script depois de gravar seria bloqueado pelo navegador.
function linkWhats(ctx, reg, dk, n, tipo, act, rotulo, icone, attrs) {
  const { msg, tel, membro } = mensagemDaVaga(ctx, reg, dk, n, tipo);
  const temTel = !!digitosTelefone(tel);
  const title = temTel ? `WhatsApp de ${nomeNatural(membro.name)}` : 'Abre o WhatsApp para você escolher o contato';
  return `<a class="btn-secondary" href="${esc(hrefWhatsApp(tel, msg))}" target="_blank" rel="noopener" data-act="${act}" ${attrs}
    title="${esc(title)}" style="text-decoration:none;--c:#25d366;border-color:#25d366">${ico(icone)} ${rotulo}</a>`;
}

function textoSelo(reg, n, estado, hoje) {
  if (estado !== 'convidado') return ROTULO_ESTADO[estado];
  const em = reg['orador' + n + 'ConvidadoEm'];
  const d = em ? diasEntre(dataLocal(new Date(em)), hoje) : NaN;
  if (!(d >= 0)) return 'Aguardando resposta';
  return d === 0 ? 'Aguardando · convidado hoje' : `Aguardando · há ${d} ${d === 1 ? 'dia' : 'dias'}`;
}

// O redesenho (a cada toque e a cada 30 s) recria os botões: sem isto o foco
// de quem navega pelo teclado ou pelo leitor de tela caía no <body>
function chaveDoFoco(container) {
  const el = document.activeElement;
  if (!el || el === document.body || !container.contains(el)) return null;
  if (el.tagName === 'SUMMARY') return { summary: el.closest('details')?.dataset.id || '' };
  const alvo = el.closest('[data-act]');
  if (!alvo) return null;
  const d = alvo.dataset;
  return { act: d.act, dk: d.dk || '', n: d.n || '', chave: d.chave || '', tipo: d.tipo || '' };
}

function restaurarFoco(container, k) {
  if (!k) return;
  let el = null;
  if (k.summary !== undefined) el = [...container.querySelectorAll('details.mais-acoes')].find(x => x.dataset.id === k.summary)?.querySelector('summary');
  else {
    const mesmo = x => (x.dataset.dk || '') === k.dk && (x.dataset.n || '') === k.n;
    el = [...container.querySelectorAll('[data-act]')].find(x => x.dataset.act === k.act && mesmo(x)
      && (x.dataset.chave || '') === k.chave && (x.dataset.tipo || '') === k.tipo)
      // a ação mudou com o estado (Escolher → Convidar): o 1º botão da mesma vaga
      || (k.dk && k.n ? [...container.querySelectorAll('.vaga [data-act], .vaga summary')].find(x => {
        const v = x.closest('.vaga');
        return v && v.dataset.dk === k.dk && v.dataset.n === k.n;
      }) : null);
  }
  el?.focus({ preventScroll: true });
}

// ---------- vista "Próximos domingos" ----------
export function renderPlano() {
  const lista = document.getElementById('plano-lista');
  const resumo = document.getElementById('plano-resumo');
  const mais = document.getElementById('plano-mais');
  if (!lista) return;
  if (!sacCarregado) {
    lista.innerHTML = '<div class="loading">Carregando…</div>';
    if (resumo) resumo.textContent = '';
    return;
  }
  const ctx = contexto();
  const abertos = new Set([...lista.querySelectorAll('details.mais-acoes[open]')].map(d => d.dataset.id));
  const foco = chaveDoFoco(lista);
  const cont = { V: 0, P: 0, W: 0, R: 0, C: 0 };
  lista.innerHTML = proximosDomingos(ctx.hoje, planoSemanas).map(dk => cardDomingo(ctx, dk, cont)).join('');
  for (const d of lista.querySelectorAll('details.mais-acoes')) if (abertos.has(d.dataset.id)) d.open = true;
  restaurarFoco(lista, foco);

  if (resumo) {
    const partes = [
      cont.V && `⚠️ ${cont.V} ${cont.V === 1 ? 'vaga aberta' : 'vagas abertas'}`,
      cont.P && `💬 ${cont.P} a convidar`,
      cont.W && `⏳ ${cont.W} aguardando resposta`,
      cont.R && `❌ ${cont.R} ${cont.R === 1 ? 'não poderá' : 'não poderão'}`,
      cont.C && `✅ ${cont.C} ${cont.C === 1 ? 'confirmado' : 'confirmados'}`,
    ].filter(Boolean);
    resumo.textContent = partes.length ? partes.join(' · ') : `Nenhuma vaga nos próximos ${planoSemanas} domingos`;
  }
  if (mais) mais.hidden = planoSemanas >= MAX_SEMANAS;
}

function cardDomingo(ctx, dk, cont) {
  const sac = registroDoDomingo(DADOS.sacramentais, dk);
  const reg = { ...(sac || {}), data: dk };
  const tipo = tipoDe(sac);
  const p = partesData(dk);
  const dataTxt = domingoCurto(dk) + (String(p.a) !== ctx.hoje.slice(0, 4) ? ` de ${p.a}` : '');
  const tipoAtual = sac?.tipo || '';
  const provavel = perguntarTipo(sac, dk);

  const dica = provavel ? `
    <div class="plano-dica">${provavel === 'jejum' ? '1º domingo do mês — é jejum e testemunhos?' : `1º domingo de ${mesPorExtenso(p.m)} — é a conferência geral?`}
      <span class="plano-dica-acoes">
        <button type="button" class="btn-secondary" data-act="tipo" data-dk="${esc(dk)}" data-tipo="${provavel}">${provavel === 'jejum' ? 'Sim, jejum' : 'Sim, conferência geral'}</button>
        <button type="button" class="btn-secondary" data-act="tipo" data-dk="${esc(dk)}" data-tipo="normal">Não, reunião normal</button>
      </span>
    </div>` : '';

  let corpo;
  if (!tipo.vagas) {
    corpo = `<div class="plano-semvagas">${esc(tipo.resumo)}</div>`;
    const nomes = POSICOES.filter(n => String(reg['orador' + n] || '').trim()).length;
    if (nomes) corpo += `<div class="plano-alerta">⚠️ ${nomes === 1 ? 'Há 1 orador marcado neste domingo — tire da vaga (Ata) e avise a pessoa.'
      : `Há ${nomes} oradores marcados neste domingo — tire das vagas (Ata) e avise as pessoas.`}</div>`;
  } else {
    for (const n of POSICOES) {
      const e = estadoDaVaga(reg, n, ctx.hoje);
      if (e === 'vazia') cont.V++;
      else if (e === 'a-convidar') cont.P++;
      else if (e === 'convidado') cont.W++;
      else if (e === 'recusou') cont.R++;
      else if (e === 'aceito' || e === 'fora') cont.C++;
    }
    const hino = String(campoAta(sac, 'hinoIntermediario') || '').trim();
    const soma = somaMinutos(reg);
    corpo = (soma > MINUTOS_ALERTA ? `<div class="plano-alerta">⚠️ ${soma} min de discursos — a reunião tem 1 hora (Manual 29.2.1.1)</div>` : '')
      + vagaHtml(ctx, reg, dk, 1) + vagaHtml(ctx, reg, dk, 2)
      + `<div class="vaga-hino">♪ Hino intermediário${hino ? `: ${esc(hino)}` : ''}</div>`
      + vagaHtml(ctx, reg, dk, 3);
  }

  return `
  <div class="plano-domingo" data-dk="${esc(dk)}">
    <div class="plano-cab">
      <span class="plano-data">${esc(dataTxt)}</span>
      ${tipo.curto ? `<span class="selo-tipo">${esc(tipo.curto)}</span>` : ''}
      ${dk === ctx.hoje ? '<span class="selo-hoje">HOJE</span>' : ''}
      <span class="plano-cab-acoes">
        <button type="button" class="btn-secondary" data-act="ata" data-dk="${esc(dk)}">${ico('clipboard-list')} Ata</button>
        <details class="mais-acoes" data-id="tipo-${esc(dk)}">
          <summary class="btn-secondary">${ico('ellipsis')} Tipo</summary>
          <div class="mais-acoes-lista">
            ${ORDEM_TIPOS.map(t => `<button type="button" class="btn-secondary" data-act="tipo" data-dk="${esc(dk)}" data-tipo="${t}">${t === tipoAtual ? '✓ ' : ''}${esc(TIPOS_DOMINGO[t].rotulo)}</button>`).join('')}
          </div>
        </details>
      </span>
    </div>
    ${dica}
    ${corpo}
  </div>`;
}

function vagaHtml(ctx, reg, dk, n) {
  const estado = estadoDaVaga(reg, n, ctx.hoje);
  const nome = String(reg['orador' + n] || '').trim();
  const chave = chavePessoa(nome);
  const cor = CORES_POSICAO[n];
  const attrs = `data-dk="${esc(dk)}" data-n="${n}" data-chave="${esc(chave)}"`;
  const b = (act, rotulo, cls = 'btn-secondary') => `<button type="button" class="${cls}" data-act="${act}" ${attrs}>${rotulo}</button>`;
  const a = (act, tipo, rotulo, icone) => linkWhats(ctx, reg, dk, n, tipo, act, rotulo, icone, attrs);
  const trocar = b('escolher', 'Trocar'), moverB = b('mover', 'Mudar de domingo'), tt = b('tempo-tema', 'Tempo e tema');
  const tirar = b('limpar', 'Tirar', 'btn-danger'), desfazer = b('desfazer', 'Desfazer resposta');

  let frente = [], mais = [];
  switch (estado) {
    case 'vazia':
      frente = [b('escolher', '🎤 Escolher orador', 'btn-secondary btn-destaque')];
      mais = [b('dispensar', 'Não haverá este discurso')];
      break;
    case 'dispensada':
      frente = [b('limpar', 'Desfazer')];
      break;
    case 'a-convidar':
      frente = [a('convidar', 'convite', 'Convidar', 'message-circle')];
      mais = [b('aceitou-pessoal', 'Já aceitou pessoalmente'), b('outro-meio', 'Outro número ou copiar a mensagem'),
        trocar, moverB, tt, b('dispensar', 'Não haverá este discurso'), tirar];
      break;
    case 'convidado':
      frente = [b('aceitou', `${ico('check')} Aceitou`), b('naopode', `${ico('x')} Não pode`)];
      mais = [a('convidar', 'convite', 'Reenviar convite', 'send'), b('outro-meio', 'Outro número ou copiar a mensagem'),
        trocar, moverB, tt, tirar];
      break;
    case 'aceito':
      if (diasEntre(ctx.hoje, dk) <= LEMBRETE_DIAS) frente = [a('lembrete', 'lembrete', 'Lembrete', 'send')];
      mais = [desfazer, trocar, moverB, tt, tirar];
      break;
    case 'recusou':
      frente = [b('escolher', 'Escolher outra pessoa', 'btn-secondary btn-destaque')];
      mais = [moverB, desfazer, tirar];
      break;
    case 'fora':
      mais = [trocar, tt, tirar];
      break;
  }

  const por = reg['orador' + n + 'Por'];
  // vaga aberta ou dispensada: o nome já diz ("Vaga aberta"), sem selo repetido
  const selo = estado === 'vazia' || estado === 'dispensada' ? '' : seloVaga(estado, textoSelo(reg, n, estado, ctx.hoje));
  const detalhes = [
    ['convidado', 'aceito', 'recusou'].includes(estado) && por ? `por ${esc(comNome(nomeDoResponsavel(por)))}` : '',
    reg['tema' + n] ? `Tema: ${esc(reg['tema' + n])}` : '',
  ].filter(Boolean).join(' · ');
  const sub = selo + (detalhes ? `<span>${detalhes}</span>` : '');

  const nomeHtml = estado === 'dispensada' ? '<span class="vaga-vazia">Sem este discurso</span>'
    : nome ? esc(nomeCurto(nome)) : '<span class="vaga-vazia">Vaga aberta</span>';

  return `
  <div class="vaga" style="--vc:${cor}" data-dk="${esc(dk)}" data-n="${n}">
    <div class="vaga-pos" style="--c:${cor}">${n}º · ${minutosDaVaga(reg, n)} min</div>
    <div class="vaga-corpo">
      <div class="vaga-nome" title="${esc(nomeNatural(nome))}">${nomeHtml}</div>
      <div class="vaga-sub">${sub}</div>
    </div>
    <div class="vaga-acoes">
      ${frente.join('')}
      ${mais.length ? `<details class="mais-acoes" data-id="vaga-${esc(dk)}-${n}">
        <summary class="btn-secondary">${ico('ellipsis')} Mais</summary>
        <div class="mais-acoes-lista">${mais.join('')}</div>
      </details>` : ''}
    </div>
  </div>`;
}

// ---------- ações das vagas ----------
// A vaga mudou em outro aparelho entre o desenho e o toque: não grava em cima
function vagaMudou(dk, n, chave) {
  const atual = chavePessoa(getSacPorData(dk)?.['orador' + n] || '');
  if (atual === (chave || '')) return false;
  toast('Esta vaga mudou em outro aparelho — confira e tente de novo.');
  renderAbaSacramental();
  return true;
}

const quemJa = estado => estado === 'aceito' ? 'aceitou o' : 'recebeu o convite para o';

export function registrarConviteDiscurso(dk, n, chave) {
  return gravarCamposDomingo(dk, {
    ['orador' + n + 'Status']: 'convidado', ['orador' + n + 'Chave']: chave,
    ['orador' + n + 'ConvidadoEm']: agoraIso(), ['orador' + n + 'RespostaEm']: '', ['orador' + n + 'Por']: codAtual(),
  });
}

export function marcarResposta(dk, n, chave, resposta) {
  return gravarCamposDomingo(dk, {
    ['orador' + n + 'Status']: resposta, ['orador' + n + 'Chave']: chave, ['orador' + n + 'RespostaEm']: agoraIso(),
  });
}

function jaAceitouPessoalmente(dk, n, chave) {
  const sac = getSacPorData(dk) || {};
  return gravarCamposDomingo(dk, {
    ['orador' + n + 'Status']: 'aceito', ['orador' + n + 'Chave']: chave,
    ['orador' + n + 'ConvidadoEm']: sac['orador' + n + 'ConvidadoEm'] || agoraIso(),
    ['orador' + n + 'RespostaEm']: agoraIso(),
    ['orador' + n + 'Por']: sac['orador' + n + 'Por'] || codAtual(),
  });
}

export function desfazerResposta(dk, n, chave) {
  const sac = getSacPorData(dk) || {};
  return gravarCamposDomingo(dk, {
    ['orador' + n + 'Status']: sac['orador' + n + 'ConvidadoEm'] ? 'convidado' : 'planejado',
    ['orador' + n + 'Chave']: chave, ['orador' + n + 'RespostaEm']: '',
  });
}

export async function dispensarVaga(dk, n) {
  const sac = getSacPorData(dk);
  const est = sac ? estadoDaVaga(sac, n, hojeK()) : 'vazia';
  if ((est === 'convidado' || est === 'aceito') && !await confirmar(
    `${nomeCurto(sac['orador' + n])} já ${quemJa(est)} ${n}º discurso. Marcar que não haverá este discurso? Lembre-se de avisar.`,
    { okLabel: 'Marcar' })) return;
  return gravarCamposDomingo(dk, { ...camposVagaVazia(n), ['orador' + n + 'Status']: 'dispensada' });
}

export async function limparVaga(dk, n) {
  const sac = getSacPorData(dk);
  const est = sac ? estadoDaVaga(sac, n, hojeK()) : 'vazia';
  if ((est === 'convidado' || est === 'aceito') && !await confirmar(
    `Tirar ${nomeCurto(sac['orador' + n])} do ${n}º discurso? Lembre-se de avisar.`, { perigo: true, okLabel: 'Tirar' })) return;
  return gravarCamposDomingo(dk, camposVagaVazia(n));
}

async function definirTipo(dk, tipo) {
  if (!Object.prototype.hasOwnProperty.call(TIPOS_DOMINGO, tipo)) return;
  const r = await gravarCamposDomingo(dk, { tipo });
  const sac = getSacPorData(dk);
  const comNomes = POSICOES.filter(n => String(sac?.['orador' + n] || '').trim()).length;
  if (r && !TIPOS_DOMINGO[tipo].vagas && comNomes) {
    toast(comNomes === 1 ? 'Este domingo tem 1 orador marcado — tire da vaga e avise a pessoa.'
      : `Este domingo tem ${comNomes} oradores marcados — tire das vagas e avise as pessoas.`);
  }
}

// As vagas abertas da janela (para "Mudar de domingo", "Convidar para um
// domingo" e o "+" da aba)
function vagasAbertas({ exceto = null } = {}) {
  const hoje = hojeK();
  const out = [];
  for (const dk of proximosDomingos(hoje, planoSemanas)) {
    const sac = getSacPorData(dk);
    if (!tipoDe(sac).vagas) continue;
    const reg = { ...(sac || {}), data: dk };
    for (const n of POSICOES) {
      if (exceto && exceto.dk === dk && exceto.n === n) continue;
      if (estadoDaVaga(reg, n, hoje) === 'vazia') out.push({ dk, n, min: minutosDaVaga(sac, n) });
    }
  }
  return out;
}

export function primeiraVagaAberta() {
  const v = vagasAbertas()[0];
  if (!v) { toast(`Todas as vagas dos próximos ${planoSemanas} domingos estão preenchidas`); return; }
  abrirEscolhaOrador(v.dk, v.n);
}

const listaDeVagas = (vagas, act, extra = '') => vagas.map(v =>
  `<button type="button" class="orador-op" data-act="${act}" data-dk2="${esc(v.dk)}" data-n2="${v.n}" ${extra}>
     <strong>${esc(domingoCurto(v.dk))}</strong><span class="op-sub">${v.n}º discurso (${v.min} min)</span></button>`).join('');

// ---------- seletor de orador ----------
export function abrirEscolhaOrador(dk, n, { modo = 'plano', pessoa = null } = {}) {
  const sac = getSacPorData(dk);
  const reg = { ...(sac || {}), data: dk };
  const estado = estadoDaVaga(reg, n, hojeK());
  escolha = { dk, n, modo, filtro: 'sugeridos', mostrar: 5, sel: null, fora: false,
    min: minutosDaVaga(sac, n), tema: String(sac?.['tema' + n] || '') };
  const p = partesData(dk);
  const aviso = modo === 'plano' && (estado === 'convidado' || estado === 'aceito')
    ? `<div class="plano-alerta">⚠️ ${esc(nomeCurto(reg['orador' + n]))} já ${estado === 'aceito' ? 'aceitou este discurso' : 'recebeu o convite para este discurso'}. Ao trocar, avise essa pessoa.</div>`
    : '';
  const filtros = [['sugeridos', 'Sugeridos'], ['jovens', 'Jovens'], ['adultos', 'Adultos'], ['primaria', 'Primária'], ['todos', 'Todos']];

  document.getElementById('modal-orador-content').innerHTML = `
    <h3>Escolher o ${n}º orador <button class="modal-close" data-act="fechar">✕</button></h3>
    <div class="orador-contexto">Domingo, ${p.d} de ${mesPorExtenso(p.m)} · ${minutosDaVaga(sac, n)} min</div>
    ${aviso}
    <div id="orador-escolha">
      <input type="text" class="form-input" id="orador-busca" placeholder="Buscar ou digitar um nome…" autocomplete="off">
      <div class="filtros" id="orador-filtros">
        ${filtros.map(([f, r]) => `<button type="button" class="filtro-btn${f === 'sugeridos' ? ' active' : ''}" data-act="filtro" data-filtro="${f}">${r}</button>`).join('')}
      </div>
      <div id="orador-lista"></div>
      ${modo === 'plano' ? '<button type="button" class="btn-secondary orador-fora-btn" data-act="fora">Orador de fora da ala (sumo conselheiro, visitante)</button>' : ''}
    </div>
    <div id="orador-painel" hidden></div>`;
  abrirModal('modal-orador', { semConfirmacao: true });
  renderListaSeletor();
  if (pessoa) selecionar(pessoa);
}

function renderListaSeletor() {
  const el = document.getElementById('orador-lista');
  if (!el || !escolha) return;
  const ctx = contexto();
  const { dk, n, modo } = escolha;
  for (const b of document.querySelectorAll('#orador-filtros .filtro-btn')) b.classList.toggle('active', b.dataset.filtro === escolha.filtro);

  // quem já tem outro domingo marcado (ou outra vaga deste)
  const ocupadas = new Map();
  const ocupar = (k, v) => { if (!ocupadas.has(k)) ocupadas.set(k, []); ocupadas.get(k).push(v); };
  for (const pes of ctx.pessoas.values()) {
    for (const pl of pes.planejadas) {
      if (pl.data === dk && (modo === 'ata' || pl.n === n)) continue;
      ocupar(pes.chave, pl);
    }
  }
  const gruposNoDomingo = new Set();
  const sac = getSacPorData(dk);
  const outras = modo === 'ata' ? chavesNaAta(n)
    : POSICOES.filter(m => m !== n).map(m => chavePessoa(sac?.['orador' + m] || '')).filter(Boolean);
  for (const k of outras) {
    if (modo === 'ata') ocupar(k, { data: dk, n: 0 });
    const g = ctx.pessoas.get(k)?.grupo;
    if (g) gruposNoDomingo.add(g);
  }
  // quem acabou de dizer "não posso" a esta vaga não volta como 1ª sugestão
  // (só na tela: o app não guarda recusas)
  if (estadoDaVaga({ ...(sac || {}), data: dk }, n, ctx.hoje) === 'recusou') {
    ocupar(chavePessoa(sac['orador' + n]), { data: dk, n, recusou: true });
  }

  const seloOcupada = o => !o ? '' : `<span class="selo-reenviar">${o.recusou ? 'não pôde nesta vaga'
    : o.data === dk ? 'já neste domingo' : `já em ${dm(o.data)} · ${o.n}º`}</span>`;
  const linha = (pes, sub, selos = '') => `
    <button type="button" class="orador-op" data-act="pegar" data-chave="${esc(pes.chave)}">
      <strong>${esc(pes.nome)}</strong> ${selos}<span class="op-sub">${esc(sub)}</span></button>`;

  const q = (document.getElementById('orador-busca')?.value || '').trim();
  if (q.length >= 2) {
    const nq = norm(q);
    const achados = [...ctx.pessoas.values()].filter(p => norm(p.nome).includes(nq))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).slice(0, 12);
    // "Maria Lima", "Irmã Ana Souza", "Souza, Ana": a pessoa casa pela chave
    // mesmo sem o texto aparecer igual no nome — vai para o topo
    const exato = ctx.pessoas.get(chavePessoa(q));
    if (exato && !achados.includes(exato)) achados.unshift(exato);
    el.innerHTML = achados.map(p => linha(p, infoGrupo(p.grupo).curto + (p.ultimo ? ` · último em ${formatarData(p.ultimo.data)}` : ' · nunca discursou'),
      (pausadoEm(p.ajuste, dk) ? '<span class="selo-reenviar">em pausa</span>' : '') + seloOcupada((ocupadas.get(p.chave) || [])[0]))).join('')
      + (exato ? '' : `<button type="button" class="btn-secondary" data-act="digitado">Usar “${esc(q)}”</button>`)
      + (achados.length ? '' : '<div class="op-sub">Ninguém com esse nome no rodízio.</div>');
    return;
  }

  const { lista, recentes } = sugerirParaVaga({ pessoas: ctx.pessoas, dk, n, ocupadas, gruposNoDomingo, filtro: escolha.filtro, hojeKey: ctx.hoje });
  if (!ctx.pessoas.size) {
    el.innerHTML = '<div class="vazia" style="padding:16px">Ninguém no rodízio ainda. Digite um nome acima para usar alguém que não está no quadro de membros.</div>';
    return;
  }
  const mostrar = escolha.mostrar;
  el.innerHTML = (lista.length
    ? lista.slice(0, mostrar).map(it => linha(it.pessoa, it.motivo, seloOcupada(it.ocupada))).join('')
    : '<div class="op-sub">Ninguém neste filtro.</div>')
    + (lista.length > mostrar ? '<button type="button" class="btn-secondary" data-act="mais-op">Mostrar mais</button>' : '')
    + (recentes.length ? `<details class="orador-recentes"><summary>Falaram há menos de 6 meses (${recentes.length})</summary>
        ${recentes.map(it => linha(it.pessoa, it.motivo, seloOcupada(it.ocupada))).join('')}</details>` : '');
}

// Escolheu a pessoa: na ata, só preenche o nome; no plano, abre o painel com
// tempo, tema e o convite
function selecionar(chave, nomeDigitado = '') {
  if (!escolha) return;
  const ctx = contexto();
  const pessoa = ctx.pessoas.get(chave) || { chave, nome: nomeNatural(nomeDigitado || chave), membro: null, grupo: 'outros' };
  if (escolha.modo === 'ata') {
    const campo = document.getElementById('sac-orador' + escolha.n);
    if (campo) { campo.value = pessoa.nome; campo.dispatchEvent(new Event('input', { bubbles: true })); }
    fecharModal('modal-orador');
    return;
  }
  escolha.sel = pessoa;
  escolha.fora = false;
  const membro = membroDaChave(pessoa.chave, ctx.indice);
  const temTel = !!digitosTelefone(membro?.telefone);
  const ultimo = !pessoa.ultimo ? 'nunca discursou'
    : pessoa.ultimo.n ? `último discurso ${haMeses(Math.max(0, mesesEntre(pessoa.ultimo.data, ctx.hoje)))} (${pessoa.ultimo.n}º)`
      : `último discurso em ${formatarData(pessoa.ultimo.data)} (antes do app)`;
  // só quem está no rodízio (o quadro tem também as crianças abaixo de 8 anos)
  const parec = membro ? [] : parecidos(pessoa.nome, ctx.indice).filter(m => ctx.pessoas.has(chavePessoa(m.name)));
  // A programação não veio e este domingo não está no aparelho: a vaga pode já
  // ter orador no servidor. Reservar é seguro (o servidor não troca quem está
  // lá); mandar o convite agora pode convidar alguém para uma vaga ocupada.
  const incerto = vagaIncerta(escolha.dk);
  painel(`
    <div class="orador-escolhido">
      <div><strong>${esc(pessoa.nome)}</strong> · ${esc(infoGrupo(pessoa.grupo).rotulo)}</div>
      <div class="op-sub">${esc(ultimo)}</div>
      <div class="op-sub">${temTel ? `📱 WhatsApp do quadro de membros (${esc(nomeNatural(membro.name))})` : '📵 Sem telefone no quadro — o WhatsApp vai abrir para você escolher o contato.'}</div>
      ${parec.length ? `<div class="op-sub">Você quis dizer: ${parec.map(m => `<button type="button" class="btn-secondary" data-act="usar-parecido" data-chave="${esc(chavePessoa(m.name))}" data-nome="${esc(m.name)}">${esc(nomeNatural(m.name))}</button>`).join(' ')}?</div>` : ''}
      ${camposTempoTema()}
      ${incerto ? '<div class="plano-alerta">📡 A programação deste domingo não veio do servidor — a vaga pode já ter orador. Sincronize antes de convidar, ou só reserve a vaga.</div>' : ''}
      <a class="btn-primary" id="orador-ir-whats" data-act="reservar-convidar" target="_blank" rel="noopener"
         style="display:block;text-align:center;text-decoration:none${incerto ? ';opacity:.45' : ''}">${ico('message-circle')} Convidar pelo WhatsApp</a>
      <button type="button" class="btn-secondary" data-act="reservar">Só reservar a vaga (convido depois)</button>
      <button type="button" class="btn-secondary" data-act="voltar-lista">‹ Escolher outra pessoa</button>
    </div>`);
  atualizarLinkEscolha();
}

const chipsTempo = (atual, act) => [...new Set([...TEMPOS_OPCOES, atual])].sort((a, b) => a - b)
  .map(m => `<button type="button" class="filtro-btn chip-tempo${m === atual ? ' active' : ''}" data-act="${act}" data-min="${m}">${m} min</button>`).join('');

const camposTempoTema = () => `
  <label>Tempo</label>
  <div class="filtros" id="orador-tempo">${chipsTempo(escolha.min, 'tempo')}</div>
  <label for="orador-tema">Tema (opcional)</label>
  <input type="text" class="form-input" id="orador-tema" value="${esc(escolha.tema)}" placeholder="Ex.: A oração">`;

function painel(html) {
  const lista = document.getElementById('orador-escolha');
  const p = document.getElementById('orador-painel');
  if (!p) return;
  p.innerHTML = html;
  p.hidden = false;
  if (lista) lista.hidden = true;
  focarCaixaDoSeletor();
}

// O elemento focado some junto com a parte escondida: o foco vai para a caixa
// do diálogo (no celular, focar um campo abriria o teclado por cima)
function focarCaixaDoSeletor(campo = null) {
  const toque = window.matchMedia?.('(pointer: coarse)').matches;
  if (campo && !toque) { campo.focus({ preventScroll: true }); return; }
  const caixa = document.querySelector('#modal-orador .modal-box');
  if (!caixa) return;
  caixa.setAttribute('tabindex', '-1');
  caixa.focus({ preventScroll: true });
}

function voltarLista() {
  const lista = document.getElementById('orador-escolha');
  const p = document.getElementById('orador-painel');
  if (p) { p.hidden = true; p.innerHTML = ''; }
  if (lista) lista.hidden = false;
  if (escolha) { escolha.sel = null; escolha.fora = false; }
  renderListaSeletor();
  focarCaixaDoSeletor(document.getElementById('orador-busca'));
}

function abrirFora() {
  escolha.fora = true;
  escolha.sel = null;
  painel(`
    <div class="orador-escolhido">
      <label for="orador-fora-nome">Nome</label>
      <input type="text" class="form-input" id="orador-fora-nome" placeholder="Nome (ex.: Presidente Exemplo)" autocomplete="off">
      <div class="ficha-dica">Convite a quem não é da ala precisa de aprovação prévia do líder presidente (Manual 38.8.19).</div>
      ${camposTempoTema()}
      <button type="button" class="btn-primary" data-act="reservar-fora">Reservar a vaga</button>
      <button type="button" class="btn-secondary" data-act="voltar-lista">‹ Voltar</button>
    </div>`);
}

// O href acompanha a escolha, o tempo e o tema — de forma síncrona: o toque no
// link é a própria navegação para o WhatsApp
function atualizarLinkEscolha() {
  const a = document.getElementById('orador-ir-whats');
  if (!a || !escolha?.sel) return;
  escolha.tema = document.getElementById('orador-tema')?.value || '';
  if (vagaIncerta(escolha.dk)) { a.removeAttribute('href'); a.title = 'Sincronize antes de convidar'; return; }
  const { msg, tel } = mensagemDaVaga(contexto(), getSacPorData(escolha.dk), escolha.dk, escolha.n, 'convite',
    { nome: escolha.sel.nome, min: escolha.min, tema: escolha.tema });
  a.href = hrefWhatsApp(tel, msg);
}

const vagaIncerta = dk => !sacDoServidor && !getSacPorData(dk);

function reservarVaga(convidar) {
  if (!escolha?.sel) return;
  if (convidar && vagaIncerta(escolha.dk)) { toast('Sincronize antes de convidar — ou só reserve a vaga'); return; }
  const { dk, n, sel, min } = escolha;
  const tema = (document.getElementById('orador-tema')?.value || '').trim();
  const campos = { ...camposAoTrocarOrador(n, sel.nome, { passado: false }), ['tema' + n]: tema, ['orador' + n + 'Min']: min };
  if (convidar) {
    Object.assign(campos, {
      ['orador' + n + 'Status']: 'convidado', ['orador' + n + 'ConvidadoEm']: agoraIso(), ['orador' + n + 'Por']: codAtual(),
    });
  }
  fecharModal('modal-orador');
  gravarCamposDomingo(dk, campos).then(r => {
    if (r === 'ok') toast(convidar ? 'Convite registrado — a vaga fica aguardando a resposta' : 'Vaga reservada');
  });
}

function reservarFora() {
  if (!escolha?.fora) return;
  const campo = document.getElementById('orador-fora-nome');
  const nome = (campo?.value || '').trim();
  if (nome.length < 2) { toast('Digite o nome do orador'); campo?.focus(); return; }
  const { dk, n, min } = escolha;
  const tema = (document.getElementById('orador-tema')?.value || '').trim();
  const campos = { ...camposAoTrocarOrador(n, nome, { passado: false, fora: true }), ['orador' + n + 'Status']: '',
    ['tema' + n]: tema, ['orador' + n + 'Min']: min };
  fecharModal('modal-orador');
  gravarCamposDomingo(dk, campos).then(r => { if (r === 'ok') toast('Vaga reservada'); });
}

// ---------- outro meio (outro número, copiar a mensagem) ----------
export function abrirOutroMeio(dk, n) {
  const sac = getSacPorData(dk);
  const nome = sac?.['orador' + n] || '';
  if (!nome) return;
  const { msg, tel } = mensagemDaVaga(contexto(), sac, dk, n, 'convite');
  outroMeio = { dk, n, chave: chavePessoa(nome) };
  document.getElementById('modal-orador-content').innerHTML = `
    <h3>Convite para discursar <button class="modal-close" data-act="fechar">✕</button></h3>
    <div class="orador-contexto">${esc(nomeCurto(nome))} · ${esc(domingoCurto(dk))} · ${n}º discurso · ${minutosDaVaga(sac, n)} min</div>
    <div class="form-group">
      <label for="om-tel">WhatsApp</label>
      <input type="tel" class="form-input" id="om-tel" value="${esc(tel)}" placeholder="(63) 90000-0000">
      <div class="ficha-dica">O número não fica salvo.</div>
    </div>
    <div class="form-group">
      <label for="om-msg">Mensagem</label>
      <textarea class="form-input" id="om-msg" rows="8">${esc(msg)}</textarea>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px">
      <a id="om-whats" class="btn-secondary" data-act="om-enviar" target="_blank" rel="noopener"
         style="text-align:center;text-decoration:none;--c:#25d366;border-color:#25d366"></a>
      <button type="button" class="btn-secondary" data-act="om-copiar">Copiar mensagem</button>
      <button type="button" class="btn-secondary" data-act="om-pessoal">Já convidei de outro jeito</button>
    </div>
    <p class="ficha-dica" style="margin-top:12px">Qualquer opção marca a vaga como Aguardando resposta. A resposta você marca no card.</p>`;
  abrirModal('modal-orador', { semConfirmacao: true });
  atualizarLinkOutroMeio();
}

function atualizarLinkOutroMeio() {
  const a = document.getElementById('om-whats');
  if (!a) return;
  const bruto = document.getElementById('om-tel')?.value || '';
  const msg = document.getElementById('om-msg')?.value || '';
  const digitos = bruto.replace(/\D/g, '');
  if (digitos && digitos.length < 10) {
    a.removeAttribute('href');
    a.style.opacity = '.45';
    a.title = 'Inclua o DDD';
    a.innerHTML = `${ico('message-circle')} Enviar pelo WhatsApp`;
    return;
  }
  a.href = hrefWhatsApp(bruto, msg);
  a.style.opacity = '';
  a.title = '';
  a.innerHTML = digitos ? `${ico('message-circle')} Enviar pelo WhatsApp` : `${ico('message-circle')} Abrir o WhatsApp e escolher o contato`;
}

// Copiar: execCommand primeiro (síncrono, sem permissão); a API de clipboard
// REJEITA com o documento sem foco, por isso o resultado é esperado
async function copiarMensagem() {
  const campo = document.getElementById('om-msg');
  let copiou = false;
  try { campo?.select(); copiou = document.execCommand('copy'); } catch (e) {}
  if (!copiou) { try { await navigator.clipboard.writeText(campo?.value || ''); copiou = true; } catch (e) {} }
  if (!copiou) { toast('Selecione e copie o texto acima'); return; }
  concluirOutroMeio('Mensagem copiada — convite marcado como enviado');
}

function concluirOutroMeio(aviso) {
  if (!outroMeio) return;
  const { dk, n, chave } = outroMeio;
  fecharModal('modal-orador');
  if (vagaMudou(dk, n, chave)) return;
  registrarConviteDiscurso(dk, n, chave).then(r => { if (r === 'ok' && aviso) toast(aviso); });
}

// ---------- tempo e tema ----------
export function abrirTempoTema(dk, n) {
  const sac = getSacPorData(dk);
  if (!sac) return;
  const min = minutosDaVaga(sac, n);
  tempoTema = { dk, n, chave: chavePessoa(sac['orador' + n] || '') };
  // um <select> (e não chips): assim o "Descartar o que foi digitado?" percebe a troca
  document.getElementById('modal-orador-content').innerHTML = `
    <h3>Tempo e tema — ${n}º discurso <button class="modal-close" data-act="fechar">✕</button></h3>
    <div class="orador-contexto">${esc(nomeCurto(sac['orador' + n] || ''))} · ${esc(domingoCurto(dk))}</div>
    <div class="form-group">
      <label for="tt-min">Tempo</label>
      <select class="form-select" id="tt-min">
        ${[...new Set([...TEMPOS_OPCOES, min])].sort((a, b) => a - b).map(m => `<option value="${m}" ${m === min ? 'selected' : ''}>${m} min</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label for="tt-tema">Tema</label>
      <input type="text" class="form-input" id="tt-tema" value="${esc(sac['tema' + n] || '')}" placeholder="Ex.: A oração">
    </div>
    <button type="button" class="btn-primary" data-act="salvar-tempo-tema">Salvar</button>`;
  abrirModal('modal-orador', { semConfirmacao: false });
}

function salvarTempoTema() {
  if (!tempoTema) return;
  const { dk, n, chave } = tempoTema;
  const sac = getSacPorData(dk);
  const min = Number(document.getElementById('tt-min')?.value) || minutosDaVaga(sac, n);
  const tema = (document.getElementById('tt-tema')?.value || '').trim();
  fecharModal('modal-orador');
  if (!sac || vagaMudou(dk, n, chave)) return;
  const mudou = min !== minutosDaVaga(sac, n) || tema !== String(sac['tema' + n] || '').trim();
  if (!mudou) { toast('Nada foi alterado'); return; }
  const est = estadoDaVaga(sac, n, hojeK());
  const nome = nomeCurto(sac['orador' + n]);
  gravarCamposDomingo(dk, { ['orador' + n + 'Min']: min, ['tema' + n]: tema }).then(r => {
    if (!r) return;
    // o caminho para avisar depende do estado: quem aceitou não tem "Reenviar"
    if (est === 'convidado') toast(`Tempo ou tema alterado — avise ${nome} (Mais › Reenviar convite)`);
    else if (est === 'aceito') toast(`Tempo ou tema alterado — avise ${nome} pelo WhatsApp; na semana do discurso, o Lembrete já leva o novo`);
    else if (r === 'ok') toast('Vaga atualizada');
  });
}

// ---------- mudar de domingo ----------
export function abrirMoverVaga(dk, n) {
  const sac = getSacPorData(dk);
  const nome = sac?.['orador' + n] || '';
  if (!nome) return;
  mover = { dk, n, chave: chavePessoa(nome) };
  renderMover();
  abrirModal('modal-orador', { semConfirmacao: true });
}

function renderMover() {
  if (!mover) return;
  const sac = getSacPorData(mover.dk);
  const vagas = vagasAbertas({ exceto: { dk: mover.dk, n: mover.n } });
  document.getElementById('modal-orador-content').innerHTML = `
    <h3>Mudar de domingo <button class="modal-close" data-act="fechar">✕</button></h3>
    <div class="orador-contexto">${esc(nomeCurto(sac?.['orador' + mover.n] || ''))} · hoje no ${mover.n}º discurso de ${esc(dm(mover.dk))}</div>
    <label style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--text2);margin-bottom:10px">
      <input type="checkbox" id="mover-combinado" ${mover.combinado ? 'checked' : ''}> Já combinamos esta data com a pessoa (fica Confirmado)
    </label>
    ${vagas.length ? listaDeVagas(vagas, 'mover-para')
      : `<div class="op-sub">Nenhuma vaga aberta nos próximos ${planoSemanas} domingos.</div>
         ${planoSemanas < MAX_SEMANAS ? '<button type="button" class="btn-secondary" data-act="mais-semanas">Mostrar mais 4 domingos</button>' : ''}`}`;
}

async function moverVaga(destino) {
  if (!mover) return;
  const { dk, n, chave } = mover;
  const combinado = !!document.getElementById('mover-combinado')?.checked;
  fecharModal('modal-orador');
  const sac = getSacPorData(dk);
  if (!sac || vagaMudou(dk, n, chave)) return;
  const nome = sac['orador' + n];
  const m = destino.n;
  const agora = agoraIso();
  const campos = { ...camposAoTrocarOrador(m, nome, { passado: false }), ['tema' + m]: sac['tema' + n] || '',
    ['orador' + m + 'Status']: combinado ? 'aceito' : 'planejado' };
  if (combinado) {
    Object.assign(campos, {
      ['orador' + m + 'ConvidadoEm']: sac['orador' + n + 'ConvidadoEm'] || agora,
      ['orador' + m + 'RespostaEm']: agora,
      ['orador' + m + 'Por']: sac['orador' + n + 'Por'] || codAtual(),
    });
  }
  // Destino primeiro, e a origem só é liberada quando a pessoa de fato ficou lá.
  // Um domingo que este aparelho ainda não tinha vai como POST, e o servidor
  // pode manter a vaga com quem outro aparelho escolheu ('descartado') — ou,
  // sem sinal, só vai saber disso ao sincronizar. Nos dois casos a pessoa
  // continua na vaga de origem: melhor estar em dois domingos do que em nenhum.
  const destinoTinhaId = !!getSacPorData(destino.dk)?.id;
  const r = await gravarCamposDomingo(destino.dk, campos);
  const ficou = chavePessoa(getSacPorData(destino.dk)?.['orador' + m] || '') === chave;
  if (r === 'descartado' || !ficou) return;
  if (r === 'pendente' && !destinoTinhaId) {
    toast(`Sem conexão: a vaga de ${dm(destino.dk)} ficou com ${nomeCurto(nome)}. Depois de sincronizar, tire ${nomeCurto(nome)} do ${n}º discurso de ${dm(dk)} (Mais › Tirar).`);
    return;
  }
  if (!r) return;
  await gravarCamposDomingo(dk, camposVagaVazia(n));
  toast(`${nomeCurto(nome)} passou para ${dm(destino.dk)} · ${m}º discurso`);
}

// ---------- vista "Rodízio" ----------
export function renderRodizio() {
  const lista = document.getElementById('rod-lista');
  if (!lista) return;
  renderMigracao();
  // sem a programação, todos pareceriam "nunca discursou"
  if (!sacCarregado) {
    lista.innerHTML = '<div class="loading">Carregando…</div>';
    for (const id of ['rod-stats', 'rod-filtros']) { const el = document.getElementById(id); if (el) el.innerHTML = ''; }
    return;
  }
  const foco = chaveDoFoco(lista);
  const ctx = contexto();
  const todas = [...ctx.pessoas.values()];
  const ativos = todas.filter(p => !p.pausadoAte && p.grupo !== 'primaria');
  const meses = p => mesesEntre(p.ultimo.data, ctx.hoje);
  const stats = [
    ['Nunca discursaram', ativos.filter(p => !p.ultimo).length, '#e8b040'],
    ['Há mais de 1 ano', ativos.filter(p => p.ultimo && meses(p) >= 12).length, '#f472b6'],
    ['Nos últimos 6 meses', ativos.filter(p => p.ultimo && meses(p) < 6).length, '#34d399'],
    ['Com domingo marcado', ativos.filter(p => p.planejadas.length).length, '#60a5fa'],
  ];
  const st = document.getElementById('rod-stats');
  if (st) st.innerHTML = stats.map(([r, v, c]) => `<div class="membros-stat"><div class="stat-num" style="--c:${c}">${v}</div><div class="stat-label">${r}</div></div>`).join('');

  const conta = id => id === 'todos' ? todas.length : id === 'pausados' ? todas.filter(p => p.pausadoAte).length : todas.filter(p => p.grupo === id).length;
  const filtros = [['todos', 'Todos'], ...GRUPOS.map(g => [g.id, g.curto]), ['pausados', 'Em pausa']];
  const fe = document.getElementById('rod-filtros');
  if (fe) fe.innerHTML = filtros.map(([id, r]) =>
    `<button type="button" class="filtro-btn${filRodizio === id ? ' active' : ''}" data-act="filtro-rod" data-fil="${id}">${esc(r)} (${conta(id)})</button>`).join('');

  const q = norm(document.getElementById('rod-busca')?.value || '');
  let sel = ordenarRodizio(todas.filter(p =>
    (filRodizio === 'todos' || (filRodizio === 'pausados' ? p.pausadoAte : p.grupo === filRodizio))
    && (!q || norm(p.nome).includes(q))));

  const vazioQuadro = !MEMBROS.length
    ? `<div class="vazia rod-quadro-vazio">O quadro de membros ainda não foi importado. Os nomes aparecem aqui conforme vocês planejam os domingos — ou importe o PDF do LCR na aba Membros.
         <div style="margin-top:10px"><button type="button" class="btn-secondary" data-act="adicionar">+ Adicionar nome</button></div></div>` : '';
  if (!sel.length) {
    lista.innerHTML = vazioQuadro + (todas.length ? '<div class="vazia">Ninguém neste filtro.</div>' : (vazioQuadro ? '' : '<div class="vazia">Ninguém no rodízio ainda.</div>'));
    return;
  }
  const total = sel.length;
  sel = sel.slice(0, rodLimite);
  lista.innerHTML = vazioQuadro + sel.map(p => cardPessoa(p, ctx)).join('')
    + (total > rodLimite ? `<button type="button" class="btn-secondary" data-act="mais-rod">Mostrar mais (${total - rodLimite})</button>` : '');
  restaurarFoco(lista, foco);
}

function cardPessoa(p, ctx) {
  const g = infoGrupo(p.grupo);
  const ultimo = !p.ultimo ? 'Nunca discursou no app'
    : p.ultimo.n ? `Último: ${p.ultimo.n}º discurso em ${formatarData(p.ultimo.data)} (${haMeses(Math.max(0, mesesEntre(p.ultimo.data, ctx.hoje)))})`
      : `Último: ${formatarData(p.ultimo.data)} (antes do app)`;
  const info = [
    `<span>${esc(ultimo)}</span>`,
    p.vezes > 1 ? `<span>${p.vezes} discursos no app</span>` : '',
    ...p.planejadas.map(pl => `<span>Marcado: ${esc(dm(pl.data))} · ${pl.n}º · ${esc(ROTULO_ESTADO[pl.estado] || '')}</span>`),
    p.homonimos >= 2 ? `<span>${p.homonimos} pessoas no quadro com este nome</span>` : '',
  ].filter(Boolean).join('');
  return `
  <div class="entrevista-card rod-pessoa" style="border-left:3px solid ${g.cor}">
    <div class="ent-header">
      <span class="ent-nome">${esc(p.nome)}</span>
      <span class="rod-grupo" style="--c:${g.cor}">${esc(g.curto)}</span>
      ${p.pausadoAte ? `<span class="selo-reenviar">Em pausa até ${esc(formatarData(p.pausadoAte))}</span>` : ''}
    </div>
    <div class="ent-info">${info}</div>
    <div class="ent-actions">
      <button type="button" class="btn-secondary" data-act="designar" data-chave="${esc(p.chave)}">${ico('message-circle')} Convidar para um domingo</button>
      <button type="button" class="btn-secondary" data-act="ficha" data-chave="${esc(p.chave)}">${ico('pencil')} Ajustar</button>
    </div>
  </div>`;
}

// ---------- ficha da pessoa ----------
export function abrirFicha(chave) {
  if (ajustesNaoVieram()) return;
  const ctx = contexto();
  const pessoa = chave ? ctx.pessoas.get(chave) : null;
  if (chave && !pessoa) { toast('Pessoa não encontrada no rodízio'); return; }
  const doc = pessoa?.ajuste || null;
  const hoje = ctx.hoje;
  const auto = pessoa?.membro ? grupoAuto(pessoa.membro, hoje) : 'outros';
  const grupoSel = grupoValido(doc?.grupo) && grupoDe(pessoa?.membro, doc, hoje) === doc.grupo ? doc.grupo : '';
  const pausado = pausadoEm(doc, hoje);
  const discursos = pessoa?.hist?.discursos || [];

  document.getElementById('modal-orador-content').innerHTML = `
    <h3>${pessoa ? esc(pessoa.nome) : 'Adicionar nome'} <button class="modal-close" data-act="fechar">✕</button></h3>
    ${pessoa ? '' : `<div class="form-group"><label for="ficha-nome">Nome</label>
      <input type="text" class="form-input" id="ficha-nome" placeholder="Nome completo" autocomplete="off"></div>`}
    <div class="form-group">
      <label for="ficha-grupo">Organização</label>
      <select class="form-select" id="ficha-grupo">
        <option value="" ${grupoSel === '' ? 'selected' : ''}>Automático (${esc(infoGrupo(auto).rotulo)})</option>
        ${GRUPOS.map(g => `<option value="${g.id}" ${grupoSel === g.id ? 'selected' : ''}>${esc(g.rotulo)}</option>`).join('')}
      </select>
      <div class="ficha-dica">JAS: 18 a 35 anos, solteiros (Manual 14.0) — marque à mão. “Membros novos” vale por 12 meses e depois volta ao automático.</div>
    </div>
    <div class="form-group">
      <label for="ficha-pos">Posição preferida</label>
      <select class="form-select" id="ficha-pos">
        ${[['', 'Qualquer'], ['1', '1º discurso'], ['2', '2º discurso'], ['3', '3º discurso']].map(([v, r]) =>
          `<option value="${v}" ${String(doc?.posicao || '') === v ? 'selected' : ''}>${r}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label for="ficha-ultimo">Último discurso antes do app</label>
      <input type="date" class="form-input" id="ficha-ultimo" max="${hoje}" value="${esc(doc?.ultimoManual || '')}">
    </div>
    <div class="form-group">
      <label for="ficha-pausa">Pausar sugestões</label>
      <select class="form-select" id="ficha-pausa">
        ${pausado ? `<option value="manter" selected>Até ${esc(formatarData(doc.pausaAte))}</option>` : ''}
        <option value="" ${pausado ? '' : 'selected'}>${pausado ? 'Tirar a pausa' : 'Não pausar'}</option>
        <option value="3">Por 3 meses</option>
        <option value="6">Por 6 meses</option>
      </select>
      <div class="ficha-aviso">O app não guarda motivo. Não escreva o motivo em lugar nenhum.</div>
    </div>
    ${pessoa ? `<div class="form-group"><label>Discursos no app</label>
      <div class="op-sub">${discursos.length ? discursos.map(d => `${esc(formatarData(d.data))} · ${d.n}º${d.tema ? ` · ${esc(d.tema)}` : ''}`).join('<br>') : 'Nenhum ainda'}</div></div>` : ''}
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
      <button type="button" class="btn-primary" data-act="salvar-ficha" data-chave="${esc(chave || '')}" style="flex:1;margin-top:0">Salvar</button>
      ${pessoa && !pessoa.membro && !(pessoa.homonimos > 0) && !pessoa.hist && doc ? `<button type="button" class="btn-danger" data-act="remover-ficha" data-chave="${esc(chave)}">Tirar do rodízio</button>` : ''}
    </div>`;
  abrirModal('modal-orador', { semConfirmacao: false });
}

async function salvarFicha(chaveDada) {
  const hoje = hojeK();
  const ctx = contexto();
  let chave = chaveDada;
  let nome = '';
  if (!chave) {
    const campo = document.getElementById('ficha-nome');
    nome = (campo?.value || '').trim();
    chave = chavePessoa(nome);
    if (nome.length < 2 || !chave) { toast('Digite o nome'); campo?.focus(); return; }
    if (ctx.pessoas.has(chave)) { toast('Já está no rodízio'); abrirFicha(chave); return; }
  }
  const pessoa = ctx.pessoas.get(chave) || null;
  const anterior = (DADOS.oradores || []).find(o => o.chave === chave) || null;
  const v = id => document.getElementById(id)?.value || '';
  const { campos, padrao } = docOrador({
    nome: nome || pessoa?.nome || anterior?.nome || '',
    grupo: v('ficha-grupo'), posicao: v('ficha-pos'), ultimo: v('ficha-ultimo'), pausa: v('ficha-pausa'),
  }, anterior, hoje);
  fecharModal('modal-orador');
  // sem nenhum ajuste e já no pool pelo quadro ou pelo histórico: o documento sobra
  if (padrao && pessoa && (pessoa.membro || pessoa.homonimos > 0 || pessoa.hist)) {
    if (anterior) await removerDoc(anterior);
    else toast('Nada foi alterado');
    return;
  }
  await gravarDoc(anterior, campos);
  toast(chaveDada ? 'Ajuste salvo' : 'Nome adicionado ao rodízio');
}

// Documento criado há pouco ainda sem id (o POST não voltou): a edição ou a
// exclusão espera por ele — senão sairia um PUT/DELETE sem id
const criando = new WeakMap();
const esperarCriacao = async doc => { if (doc && !doc.id && criando.has(doc)) await criando.get(doc).catch(() => {}); };

async function gravarDoc(anterior, campos) {
  if (!DADOS.oradores) DADOS.oradores = [];
  if (anterior) {
    Object.assign(anterior, campos);   // otimista
    renderAbaSacramental();
    await esperarCriacao(anterior);
    try {
      const r = await apiFetch(API_ORADORES + '?id=' + encodeURIComponent(anterior.id), 'PUT', campos);
      if (r) Object.assign(anterior, r);
      atualizarUltimaSinc(); setSyncStatus('ok');
    } catch (e) { avisarPendente('ajuste do rodízio'); }
  } else {
    const novo = { ...campos };
    DADOS.oradores.push(novo);
    renderAbaSacramental();
    const p = apiFetch(API_ORADORES, 'POST', campos);
    criando.set(novo, p);
    try {
      const r = await p;
      if (r) Object.assign(novo, r);
      atualizarUltimaSinc(); setSyncStatus('ok');
    } catch (e) { novo.id = idProvisorioDo(e); avisarPendente('ajuste do rodízio'); }
    criando.delete(novo);
  }
  renderAbaSacramental();
}

async function removerDoc(doc) {
  DADOS.oradores = (DADOS.oradores || []).filter(o => o !== doc);
  renderAbaSacramental();
  await esperarCriacao(doc);
  if (doc.id) {
    try { await apiFetch(API_ORADORES + '?id=' + encodeURIComponent(doc.id), 'DELETE'); atualizarUltimaSinc(); setSyncStatus('ok'); }
    catch (e) { avisarPendente('ajuste do rodízio'); }
  }
  toast('Ajuste removido');
}

async function removerFicha(chave) {
  const doc = (DADOS.oradores || []).find(o => o.chave === chave);
  if (!doc) return;
  if (!await confirmar(`Tirar ${nomeCurto(doc.nome)} do rodízio?`, { perigo: true, okLabel: 'Tirar' })) return;
  fecharModal('modal-orador');
  await removerDoc(doc);
}

// ---------- convidar uma pessoa para um domingo ----------
export function abrirDesignar(chave) {
  const pessoa = contexto().pessoas.get(chave);
  if (!pessoa) return;
  const vagas = vagasAbertas();
  document.getElementById('modal-orador-content').innerHTML = `
    <h3>Convidar para um domingo <button class="modal-close" data-act="fechar">✕</button></h3>
    <div class="orador-contexto">${esc(pessoa.nome)}</div>
    ${vagas.length ? listaDeVagas(vagas, 'designar-vaga', `data-chave="${esc(chave)}"`)
      : `<div class="op-sub">Nenhuma vaga aberta nos próximos ${planoSemanas} domingos.</div>`}`;
  abrirModal('modal-orador', { semConfirmacao: true });
}

// ---------- migração do antigo Banco de Oradores (ficava só neste aparelho) ----------
const BANCO_ANTIGO = 'sac_banco_oradores';
const BANCO_MIGRADO = 'sac_banco_migrado';
const ROTULO_BANCO = { quorum: 'Quórum', socsoc: 'Soc. Socorro', jovens: 'Jovens', outros: 'Outros' };
const lerLocal = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };

export function lerBancoAntigo() {
  let banco = null;
  try { banco = JSON.parse(lerLocal(BANCO_ANTIGO) || 'null'); } catch (e) { banco = null; }
  if (!banco || typeof banco !== 'object') return [];
  const vistos = new Set();
  const out = [];
  for (const g of Object.keys(ROTULO_BANCO)) {
    for (const nome of Array.isArray(banco[g]) ? banco[g] : []) {
      const k = chavePessoa(nome);
      if (!k || vistos.has(k)) continue;
      vistos.add(k);
      out.push({ nome: String(nome).trim(), grupoAntigo: g });
    }
  }
  return out;
}

function renderMigracao() {
  const el = document.getElementById('rod-migrar');
  if (!el) return;
  const nomes = lerBancoAntigo();
  if (!nomes.length) { el.innerHTML = ''; return; }
  el.innerHTML = lerLocal(BANCO_MIGRADO)
    ? `<div class="sac-aviso">A lista antiga do Banco de Oradores continua neste aparelho.
         <button type="button" class="btn-secondary" data-act="apagar-banco">Apagar a lista antiga</button></div>`
    : `<div class="sac-aviso">Este aparelho tem ${nomes.length} ${nomes.length === 1 ? 'nome' : 'nomes'} no antigo Banco de Oradores, que ficava só neste celular.
         <button type="button" class="btn-secondary" data-act="migrar">Revisar e trazer</button></div>`;
}

function abrirMigracao() {
  const nomes = lerBancoAntigo();
  document.getElementById('modal-orador-content').innerHTML = `
    <h3>Trazer nomes do banco antigo <button class="modal-close" data-act="fechar">✕</button></h3>
    <div class="plano-alerta">A lista foi criada quando o app era de outra ala e pode ter nomes de lá. Marque só quem é da ${esc(ALA)}.</div>
    <div id="mig-lista">${nomes.map((x, i) => `<label class="mig-item"><input type="checkbox" data-i="${i}"> ${esc(x.nome)} · ${ROTULO_BANCO[x.grupoAntigo]}</label>`).join('')}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
      <button type="button" class="btn-secondary" data-act="mig-todos">Marcar todos</button>
      <button type="button" class="btn-primary" data-act="mig-trazer" style="margin-top:0">Trazer os marcados</button>
      <button type="button" class="btn-danger" data-act="apagar-banco">Apagar a lista antiga deste aparelho</button>
    </div>`;
  abrirModal('modal-orador', { semConfirmacao: true });
}

async function migrarBancoLocal() {
  if (ajustesNaoVieram()) return;
  const nomes = lerBancoAntigo();
  const marcados = [...document.querySelectorAll('#mig-lista input[type="checkbox"]:checked')].map(c => nomes[Number(c.dataset.i)]).filter(Boolean);
  if (!marcados.length) { toast('Marque os nomes que são desta ala'); return; }
  fecharModal('modal-orador');
  const hoje = hojeK();
  const indice = indiceDoQuadro(MEMBROS, MEMBROS_SAIDOS);
  let n = 0;
  for (const x of marcados) {
    const chave = chavePessoa(x.nome);
    if ((DADOS.oradores || []).some(o => o.chave === chave)) continue;
    const grupo = grupoDoBancoAntigo(x.grupoAntigo);
    // quem já está no quadro sem grupo a ajustar não precisa de documento
    if (!grupo && membroDaChave(chave, indice)) { n++; continue; }
    await gravarDoc(null, docOrador({ nome: x.nome, grupo }, null, hoje).campos);
    n++;
  }
  try { localStorage.setItem(BANCO_MIGRADO, new Date().toISOString()); } catch (e) {}
  toast(`${n} ${n === 1 ? 'nome trazido' : 'nomes trazidos'} para o rodízio`);
  renderAbaSacramental();
}

async function apagarBancoLocal() {
  if (!await confirmar('Apagar a lista antiga do Banco de Oradores deste aparelho? Os nomes que você não trouxe para o rodízio serão perdidos.', { perigo: true, okLabel: 'Apagar' })) return;
  try { localStorage.removeItem(BANCO_ANTIGO); localStorage.setItem(BANCO_MIGRADO, new Date().toISOString()); } catch (e) {}
  fecharModal('modal-orador');
  renderAbaSacramental();
  toast('Lista antiga apagada');
}

// ---------- eventos ----------
function aoClicarPlano(e) {
  const alvo = e.target.closest('[data-act]');
  if (!alvo) return;
  // Escolheu uma ação do "⋯ Mais": o menu fecha, e o foco vai para o "⋯ Mais"
  // antes da ação — é para ele que o diálogo da ação devolve o foco
  const menu = alvo.closest('details.mais-acoes');
  if (menu) { menu.removeAttribute('open'); menu.querySelector('summary')?.focus({ preventScroll: true }); }
  const { act, dk, chave = '' } = alvo.dataset;
  const n = Number(alvo.dataset.n);
  switch (act) {
    case 'ata': abrirModalSac(dk); break;
    case 'tipo': definirTipo(dk, alvo.dataset.tipo); break;
    case 'escolher': abrirEscolhaOrador(dk, n); break;
    case 'dispensar': dispensarVaga(dk, n); break;
    case 'limpar': limparVaga(dk, n); break;
    // link do WhatsApp: sem preventDefault (só registra) — a não ser que a vaga
    // tenha mudado em outro aparelho, aí o convite não deve sair
    case 'convidar':
      if (vagaMudou(dk, n, chave)) { e.preventDefault(); return; }
      registrarConviteDiscurso(dk, n, chave);
      break;
    case 'lembrete': break;
    case 'aceitou': if (!vagaMudou(dk, n, chave)) marcarResposta(dk, n, chave, 'aceito'); break;
    case 'naopode': if (!vagaMudou(dk, n, chave)) marcarResposta(dk, n, chave, 'recusou'); break;
    case 'aceitou-pessoal': if (!vagaMudou(dk, n, chave)) jaAceitouPessoalmente(dk, n, chave); break;
    case 'desfazer': if (!vagaMudou(dk, n, chave)) desfazerResposta(dk, n, chave); break;
    case 'outro-meio': abrirOutroMeio(dk, n); break;
    case 'mover': abrirMoverVaga(dk, n); break;
    case 'tempo-tema': abrirTempoTema(dk, n); break;
  }
}

function aoClicarRodizio(e) {
  const alvo = e.target.closest('[data-act]');
  if (!alvo) return;
  switch (alvo.dataset.act) {
    case 'filtro-rod': filRodizio = alvo.dataset.fil; rodLimite = 50; renderRodizio(); break;
    case 'designar': abrirDesignar(alvo.dataset.chave); break;
    case 'ficha': abrirFicha(alvo.dataset.chave); break;
    case 'adicionar': abrirFicha(null); break;
    case 'mais-rod': rodLimite += 50; renderRodizio(); break;
    case 'migrar': abrirMigracao(); break;
    case 'apagar-banco': apagarBancoLocal(); break;
  }
}

function aoClicarModal(e) {
  const alvo = e.target.closest('[data-act]');
  if (!alvo) return;
  const d = alvo.dataset;
  switch (d.act) {
    case 'fechar': fecharModal('modal-orador'); break;
    // seletor
    case 'filtro': if (escolha) { escolha.filtro = d.filtro; escolha.mostrar = d.filtro === 'sugeridos' ? 5 : 30; renderListaSeletor(); } break;
    case 'mais-op': if (escolha) { escolha.mostrar += escolha.filtro === 'sugeridos' ? 5 : 30; renderListaSeletor(); } break;
    case 'pegar': selecionar(d.chave); break;
    case 'usar-parecido': selecionar(d.chave, d.nome || ''); break;
    case 'digitado': {
      const q = (document.getElementById('orador-busca')?.value || '').trim();
      if (q) selecionar(chavePessoa(q), q);
      break;
    }
    case 'fora': abrirFora(); break;
    case 'voltar-lista': voltarLista(); break;
    case 'tempo':
      if (escolha) {
        escolha.min = Number(d.min);
        for (const b of document.querySelectorAll('#orador-tempo .filtro-btn')) b.classList.toggle('active', b === alvo);
        atualizarLinkEscolha();
      }
      break;
    case 'reservar': reservarVaga(false); break;
    case 'reservar-convidar': reservarVaga(true); break;   // <a>: sem preventDefault
    case 'reservar-fora': reservarFora(); break;
    // outro meio
    case 'om-enviar': if (alvo.getAttribute('href')) concluirOutroMeio(''); break;
    case 'om-copiar': copiarMensagem(); break;
    case 'om-pessoal': concluirOutroMeio('Convite marcado como enviado'); break;
    // tempo e tema
    case 'salvar-tempo-tema': salvarTempoTema(); break;
    // mover / designar
    case 'mover-para': moverVaga({ dk: d.dk2, n: Number(d.n2) }); break;
    case 'mais-semanas':
      // o "Já combinamos" marcado não pode se perder no redesenho
      if (mover) mover.combinado = !!document.getElementById('mover-combinado')?.checked;
      planoSemanas = Math.min(MAX_SEMANAS, planoSemanas + MAIS_SEMANAS);
      renderMover(); renderAbaSacramental();
      break;
    case 'designar-vaga': abrirEscolhaOrador(d.dk2, Number(d.n2), { pessoa: d.chave }); break;
    // ficha
    case 'salvar-ficha': salvarFicha(d.chave); break;
    case 'remover-ficha': removerFicha(d.chave); break;
    // migração
    case 'mig-todos': for (const c of document.querySelectorAll('#mig-lista input[type="checkbox"]')) c.checked = true; break;
    case 'mig-trazer': migrarBancoLocal(); break;
    case 'apagar-banco': apagarBancoLocal(); break;
  }
}

function ligarRodizio() {
  document.getElementById('sac-vista-plano')?.addEventListener('click', aoClicarPlano);
  document.getElementById('sac-vista-rodizio')?.addEventListener('click', aoClicarRodizio);
  document.getElementById('plano-mais')?.addEventListener('click', () => {
    planoSemanas = Math.min(MAX_SEMANAS, planoSemanas + MAIS_SEMANAS);
    renderPlano();
  });
  document.getElementById('rod-adicionar')?.addEventListener('click', () => abrirFicha(null));
  document.getElementById('rod-busca')?.addEventListener('input', () => { rodLimite = 50; renderRodizio(); });

  // tocar fora fecha o "⋯ Mais"/"Tipo" que estiver aberto
  document.addEventListener('click', e => {
    for (const d of document.querySelectorAll('#sac-vista-plano details.mais-acoes[open]')) if (!d.contains(e.target)) d.removeAttribute('open');
  });

  const modal = document.getElementById('modal-orador');
  modal?.addEventListener('click', aoClicarModal);
  modal?.addEventListener('input', e => {
    if (e.target.id === 'orador-busca' && escolha) { escolha.mostrar = escolha.filtro === 'sugeridos' ? 5 : 30; renderListaSeletor(); }
    else if (e.target.id === 'orador-tema') atualizarLinkEscolha();
    else if (e.target.id === 'om-tel' || e.target.id === 'om-msg') atualizarLinkOutroMeio();
  });
}
ligarRodizio();
