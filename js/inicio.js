// =============================================
// INÍCIO — tela de boas-vindas (a primeira aba)
// Junta o que importa das outras abas: saudação, próximas entrevistas, o que
// pede atenção, a semana e atalhos. Só lê — nada é criado nem editado aqui.
//
// Sigilo: entrevistas vêm de resumoAgenda() e acompanhamentos de
// listaAcompanhamentos(), que já aplicam podeVer. E mesmo para o bispo a
// entrevista sigilosa aparece sem nome e sem tipo: é a tela que fica aberta.
//
// Redesenha em cinco pontos: boot e volta à aba (app.js), fim de cada carga
// (api.js), troca de cargo (usuario.js) e dos nomes dos chamados (chamados.js).
// =============================================
import { listaAcompanhamentos } from './acompanhamento.js';
import { aguardandoNovaData, precisaReenviarConvite, resumoAgenda, selosConfirmacao } from './agenda.js';
import { switchTab } from './app.js';
import { DIAS_SEMANA, EVENTOS_FIXOS, MESES } from './calendario.js';
import { comNome } from './chamados.js';
import { COR_STATUS, DADOS, cargoInfo, comAla, nomeDoResponsavel } from './config.js';
import { nomeCurto, pendenciasDiscurso, registroDoDomingo, resumoDomingo } from './discursos-regras.js';
import { irParaDomingo } from './sacramental.js';
import { USUARIO, abrirEscolhaCargo } from './usuario.js';
import { corSegura, dataLocal, esc, formatarData } from './utils.js';

const DIAS_LONGOS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const MAX_ENTREVISTAS = 5, MAX_ATENCAO = 6, MAX_EVENTOS = 6;

// Quais coleções já vieram do servidor nesta sessão. O app não guarda dados no
// aparelho: sem conexão as listas ficam vazias, e sem este controle a tela
// diria "nenhuma pendência" sem ter olhado nada.
let cargaTerminou = false;
const carregado = { agenda: false, designacoes: false, eventos: false, sacramentais: false, acomp: false };

// Carga avulsa de uma coleção, fora do carregarTudo (a Sacramental recarrega
// ao abrir a aba). Não redesenha: quem está na outra aba volta pelo switchTab.
// Ali não serve o sacCarregado: ele fica true mesmo quando a carga falha.
export function inicioColecaoCarregada(k) {
  if (k in carregado) carregado[k] = true;
}

export function inicioAposCarga(res = {}) {
  cargaTerminou = true;
  // uma atualização que falha mantém o que já estava em DADOS (ver api.js)
  for (const k of Object.keys(carregado)) if (res[k]) carregado[k] = true;
  renderInicio();
}

// ---------- datas ----------
// AAAA-MM-DD na hora local (ver dataLocal em utils.js)
const chave = dataLocal;
// a API grava o que receber: data fora do formato não entra em comparação
const dataValida = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

// Recalculado a cada desenho: o app instalado fica aberto por dias
function datas() {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const somar = n => { const x = new Date(hoje); x.setDate(x.getDate() + n); return x; };
  return {
    ano: String(hoje.getFullYear()),
    kHoje: chave(hoje), kAmanha: chave(somar(1)),
    kFim: chave(somar(7)),                              // exclusivo: hoje + 6 dias
    kDomingo: chave(somar((7 - hoje.getDay()) % 7)),    // hoje, se for domingo
  };
}

function rotuloDia(k, d) {
  if (k === d.kHoje) return 'Hoje';
  if (k === d.kAmanha) return 'Amanhã';
  const dia = DIAS_SEMANA[new Date(k + 'T12:00:00').getDay()];
  return k.slice(0, 4) === d.ano ? `${dia}, ${k.slice(8, 10)}/${k.slice(5, 7)}` : `${dia}, ${formatarData(k)}`;
}

// ---------- pedaços ----------
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
const quandoData = (data, hora) => esc(formatarData(data)) + (hora ? ` às ${esc(hora)}` : '');
const nomeEntrevista = e => e.sigiloso ? '🔒 Entrevista sigilosa' : esc(e.membro);
const responsavel = e => esc(comNome(nomeDoResponsavel(e.responsavel)));
const respsDe = d => Array.isArray(d.responsaveis) ? d.responsaveis : [d.responsavel || ''];   // = designacoes.js
const desigAtivas = () => (DADOS.designacoes || []).filter(d =>                                 // = filtro "Ativas"
  d.tipo === 'permanente' ? d.status !== 'inativa' : d.status !== 'concluido');

const CARREGANDO = '<div class="loading">Carregando…</div>';
const semServidor = txt => `<div class="vazia inicio-vazia">📡 ${txt}</div>`;
const vazio = txt => `<div class="vazia inicio-vazia">${txt}</div>`;
const mudo = txt => `<div class="inicio-mudo">${txt}</div>`;
const verMais = (txt, aba) => `<button type="button" class="inicio-mais" data-act="ir" data-aba="${aba}">${txt} →</button>`;

// `dk`: o item leva ao card daquele domingo (pendências de discurso)
function item({ cor, aba, quando = '', titulo, sub = '', dk = '' }) {
  return `<button type="button" class="inicio-item${quando ? '' : ' sem-quando'}" style="--ic:${cor}" data-act="ir" data-aba="${aba}"${dk ? ` data-dk="${esc(dk)}"` : ''}>`
    + (quando ? `<span class="inicio-item-quando">${quando}</span>` : '')
    + `<span class="inicio-item-titulo">${titulo}</span>`
    + (sub ? `<span class="inicio-item-sub">${sub}</span>` : '')
    + '</button>';
}

// A atualização de 30s redesenha a tela aberta: só troca o que mudou, para não
// piscar nem tirar o foco de quem navega pelo teclado.
const ultimoHtml = new Map();
function preencher(id, html) {
  const el = document.getElementById(id);
  if (!el || ultimoHtml.get(id) === html) return;
  ultimoHtml.set(id, html);
  el.innerHTML = html;
}
function texto(id, t) {
  const el = document.getElementById(id);
  if (el && el.textContent !== t) el.textContent = t;
}

// =============================================
export function renderInicio() {
  if (!document.getElementById('panel-inicio')) return;   // a tela do convite troca o body
  const d = datas();
  const ag = resumoAgenda();
  const atencao = pendencias(ag, d);
  renderSaudacao();
  renderResumo(ag, d, atencao);
  renderMeu(ag);
  renderEntrevistas(ag, d);
  renderAtencao(atencao);
  renderSemana(d);
}

function renderSaudacao() {
  const agora = new Date();
  const h = agora.getHours();
  const oi = h >= 5 && h < 12 ? 'Bom dia' : h >= 12 && h < 18 ? 'Boa tarde' : 'Boa noite';
  texto('inicio-saudacao', USUARIO ? `${oi}, ${comNome(USUARIO)}` : `${oi}! Bem-vindo ao painel do bispado`);
  texto('inicio-data', `${DIAS_LONGOS[agora.getDay()]}, ${agora.getDate()} de ${MESES[agora.getMonth()].toLowerCase()} de ${agora.getFullYear()}`);
}

// Uma linha sob a data, que responde "tem algo para mim hoje?"
function renderResumo(ag, d, { itens, faltando }) {
  if (!cargaTerminou) return preencher('inicio-resumo', '');
  if (!carregado.agenda && !carregado.designacoes) {
    return preencher('inicio-resumo', '📡 Sem conexão com o servidor — os dados aparecem quando ela voltar');
  }
  const partes = [];
  if (carregado.agenda) {
    // quem pediu outra data ou recusou não conta como entrevista de hoje
    const hoje = ag.ativas.filter(e =>
      e.data === d.kHoje && !aguardandoNovaData(e) && e.confirmacao !== 'recusado').length;
    partes.push(hoje ? `📅 ${plural(hoje, 'entrevista hoje', 'entrevistas hoje')}` : '📅 Nenhuma entrevista hoje');
  }
  if (itens.length) partes.push(`⚠️ ${plural(itens.length, 'item pede atenção', 'itens pedem atenção')}`);
  else if (!faltando.length) partes.push('✅ Nada pendente');
  preencher('inicio-resumo', partes.join(' · '));
}

// O que está com o cargo identificado — cada parte leva à aba
function renderMeu(ag) {
  if (!USUARIO) {
    return preencher('inicio-meu', 'Identifique-se para ver o que está com você.<br>'
      + '<button type="button" class="btn-secondary" data-act="identificar">👤 Identificar-se</button>');
  }
  if (!cargaTerminou) return preencher('inicio-meu', '');
  const link = (n, um, varios, aba) =>
    `<button type="button" class="inicio-link" data-act="ir" data-aba="${aba}">${plural(n, um, varios)}</button>`;
  // o Secretário Executivo não tem código de responsável na agenda
  const codigo = cargoInfo(USUARIO)?.cod;
  const partes = [];
  if (carregado.agenda && codigo) {
    const n = ag.proximas.filter(e => e.responsavel === codigo).length;
    if (n) partes.push(link(n, 'entrevista nos próximos 7 dias', 'entrevistas nos próximos 7 dias', 'agenda'));
  }
  if (carregado.acomp && carregado.agenda) {   // os que vêm de entrevistas saem da agenda
    const n = listaAcompanhamentos().filter(a => a.situacao !== 'concluido' && a.responsavel === USUARIO).length;
    if (n) partes.push(link(n, 'acompanhamento em aberto', 'acompanhamentos em aberto', 'acompanhamento'));
  }
  if (carregado.designacoes) {
    const n = desigAtivas().filter(x => respsDe(x).includes(USUARIO)).length;
    if (n) partes.push(link(n, 'designação ativa', 'designações ativas', 'designacoes'));
  }
  // "nada com você" só quando tudo veio; com parte faltando, avisa em vez de afirmar
  const completo = carregado.agenda && carregado.acomp && carregado.designacoes;
  const olhou = carregado.agenda || carregado.acomp || carregado.designacoes;
  let html = partes.length ? `Com você: ${partes.join(' · ')}` : completo ? 'Nada com você no momento.' : '';
  if (olhou && !completo) html += (html ? '<br>' : '') + '<span class="inicio-mudo">📡 Parte dos dados ainda não veio do servidor</span>';
  preencher('inicio-meu', html);
}

function renderEntrevistas(ag, d) {
  if (!cargaTerminou) return preencher('inicio-entrevistas', CARREGANDO);
  if (!carregado.agenda) return preencher('inicio-entrevistas', semServidor('As entrevistas ainda não vieram do servidor'));
  const ordem = e => e.data + (e.hora || '99:99');
  const futuras = ag.ativas.filter(e => dataValida(e.data) && e.data >= d.kHoje)
    .sort((a, b) => ordem(a).localeCompare(ordem(b)));
  const semData = ag.ativas.filter(e => !dataValida(e.data)).length;

  let html = futuras.length
    ? futuras.slice(0, MAX_ENTREVISTAS).map(e => item({
        cor: COR_STATUS[e.status] || 'var(--text3)', aba: 'agenda',
        quando: esc(rotuloDia(e.data, d)) + (e.hora ? `<span class="inicio-hora">${esc(e.hora)}</span>` : ''),
        titulo: nomeEntrevista(e),
        sub: [
          e.sigiloso ? '' : esc(e.tipo),
          `👤 ${responsavel(e)}`,
          e.confirmacao ? selosConfirmacao(e) : '<span class="inicio-sem-conf">⏳ Sem confirmação</span>',
        ].filter(Boolean).join(' · '),
      })).join('')
    : vazio('📭 Nenhuma entrevista marcada de hoje em diante');
  if (futuras.length > MAX_ENTREVISTAS) html += verMais(`Ver todas as ${futuras.length} na Agenda`, 'agenda');
  if (semData) html += mudo(`📌 ${plural(semData, 'entrevista em aberto ainda sem data', 'entrevistas em aberto ainda sem data')}`);
  preencher('inicio-entrevistas', html);
}

// O que ficou para trás, na ordem de urgência. Cada entrevista entra uma vez
// só: vale a primeira regra que casar.
function pendencias(ag, d) {
  const itens = [], vistos = new Set();
  const add = (reg, html) => { if (!vistos.has(reg)) { vistos.add(reg); itens.push(html); } };
  if (carregado.agenda) {
    ag.ativas.filter(aguardandoNovaData).forEach(e => add(e, item({
      cor: '#e8b040', aba: 'agenda',
      titulo: `⏳ Definir nova data — <strong>${nomeEntrevista(e)}</strong>`,
      sub: dataValida(e.sugestaoData) ? `pediu ${quandoData(e.sugestaoData, e.sugestaoHora)}` : 'o membro pediu outra data',
    })));
    // com a nova data já passada, o que falta é registrar o resultado (regra abaixo)
    ag.ativas.filter(e => precisaReenviarConvite(e) && !(dataValida(e.data) && e.data < d.kHoje)).forEach(e => add(e, item({
      cor: '#c9a84c', aba: 'agenda',
      titulo: `📨 Reenviar convite — <strong>${nomeEntrevista(e)}</strong>`,
      sub: dataValida(e.data) ? `nova data: ${quandoData(e.data, e.hora)}` : '',
    })));
    ag.ativas.filter(e => dataValida(e.data) && e.data < d.kHoje)
      .sort((a, b) => a.data.localeCompare(b.data))
      .forEach(e => add(e, item({
        cor: '#f87171', aba: 'agenda',
        titulo: `📋 Registrar o resultado — <strong>${nomeEntrevista(e)}</strong>`,
        sub: `estava marcada para ${quandoData(e.data, e.hora)}`,
      })));
  }
  if (carregado.designacoes) {
    desigAtivas().filter(x => x.tipo !== 'permanente' && dataValida(x.prazo) && x.prazo < d.kHoje)
      .sort((a, b) => a.prazo.localeCompare(b.prazo))
      .forEach(x => {
        const quem = respsDe(x).filter(Boolean).map(r => esc(comNome(r))).join(', ');
        add(x, item({
          cor: '#f472b6', aba: 'designacoes',
          titulo: `⏰ Prazo vencido — <strong>${esc(x.tarefa)}</strong>`,
          sub: `prazo ${esc(formatarData(x.prazo))}${quem ? ` · ${quem}` : ''}`,
        }));
      });
    // prazo hoje ou amanhã: é aqui que o lembrete aparece (não há alarme)
    desigAtivas().filter(x => x.tipo !== 'permanente' && (x.prazo === d.kHoje || x.prazo === d.kAmanha))
      .sort((a, b) => a.prazo.localeCompare(b.prazo))
      .forEach(x => {
        const quem = respsDe(x).filter(Boolean).map(r => esc(comNome(r))).join(', ');
        add(x, item({
          cor: '#f472b6', aba: 'designacoes',
          titulo: `📌 Prazo ${x.prazo === d.kHoje ? 'hoje' : 'amanhã'} — <strong>${esc(x.tarefa)}</strong>`,
          sub: quem,
        }));
      });
  }
  // discursos dos próximos domingos: vagas abertas, convites sem resposta…
  if (carregado.sacramentais) {
    for (const p of pendenciasDiscurso(DADOS.sacramentais, d.kHoje)) itens.push(itemDiscurso(p, d));
  }
  // o verbo concorda com o item, não com a quantidade ("as entrevistas … vieram")
  const faltando = [
    !carregado.agenda && { txt: 'as entrevistas', plural: true },
    !carregado.designacoes && { txt: 'as designações', plural: true },
    !carregado.sacramentais && { txt: 'a programação sacramental', plural: false },
  ].filter(Boolean);
  return { itens, faltando };
}

function itemDiscurso(p, d) {
  const quando = esc(rotuloDia(p.dk, d));
  const base = { aba: 'sacramental', dk: p.dk };
  switch (p.tipo) {
    case 'recusou':
      return item({ ...base, cor: '#f87171', titulo: `❌ Escolher outro orador — <strong>${esc(nomeCurto(p.nome))}</strong> não poderá`, sub: `${p.n}º discurso · ${quando}` });
    case 'sem-resposta':
      return item({ ...base, cor: '#e8b040', titulo: `⏳ Sem resposta — <strong>${esc(nomeCurto(p.nome))}</strong>`,
        sub: `${p.n}º discurso · ${quando} · convidado ${p.dias === 0 ? 'hoje' : `há ${plural(p.dias, 'dia', 'dias')}`}` });
    case 'vagas': {
      const k = p.ns.length;
      const sub = k === 3 ? 'nenhum orador definido' : `falta o ${p.ns.map(n => n + 'º').join(' e o ')}`;
      return item({ ...base, cor: '#e8d080', titulo: `🎤 ${plural(k, 'vaga aberta', 'vagas abertas')} — ${quando}`, sub });
    }
    case 'convidar':
      return item({ ...base, cor: '#e8d080', titulo: `💬 Convidar <strong>${esc(nomeCurto(p.nome))}</strong>`, sub: `${p.n}º discurso · ${quando}` });
    default:
      return item({ ...base, cor: '#e8d080', titulo: `📅 ${quando}: é ${p.provavel === 'jejum' ? 'jejum e testemunhos' : 'conferência geral'}? Marque o tipo`,
        sub: 'o app não cobra oradores em jejum nem em conferência' });
  }
}

// "As entrevistas e a programação sacramental ainda não vieram do servidor"
function avisoFaltando(faltando) {
  if (!faltando.length) return '';
  const nomes = faltando.map(f => f.txt);
  const lista = nomes.length === 1 ? nomes[0] : nomes.slice(0, -1).join(', ') + ' e ' + nomes[nomes.length - 1];
  const plural = faltando.length > 1 || faltando[0].plural;
  return lista.charAt(0).toUpperCase() + lista.slice(1)
    + (plural ? ' ainda não vieram do servidor' : ' ainda não veio do servidor');
}

function renderAtencao({ itens, faltando }) {
  if (!cargaTerminou) return preencher('inicio-atencao', CARREGANDO);
  const aviso = avisoFaltando(faltando);
  if (!itens.length) {
    return preencher('inicio-atencao', aviso ? semServidor(aviso) : vazio('✅ Nenhuma pendência no momento'));
  }
  preencher('inicio-atencao', itens.slice(0, MAX_ATENCAO).join('')
    + (itens.length > MAX_ATENCAO ? mudo(`…e mais ${itens.length - MAX_ATENCAO}`) : '')
    + (aviso ? mudo('📡 ' + aviso) : ''));
}

function renderSemana(d) {
  // o domingo primeiro: é o compromisso fixo de todo o bispado
  let situacao;
  if (!cargaTerminou) situacao = 'carregando…';
  else if (!carregado.sacramentais) situacao = '📡 programação não carregada';
  // jejum e conferência não cobram oradores; o resumo diz quem já confirmou
  else situacao = esc(resumoDomingo(registroDoDomingo(DADOS.sacramentais, d.kDomingo), d.kDomingo, d.kHoje));
  let html = item({
    cor: '#e8d080', aba: 'sacramental', quando: esc(rotuloDia(d.kDomingo, d)),
    titulo: '🕊️ Reunião sacramental', sub: situacao, dk: d.kDomingo,
  });

  // calendário embutido + os eventos cadastrados pela ala
  const eventos = [...EVENTOS_FIXOS, ...(DADOS.eventos_extras || [])]
    .filter(ev => ev && ev.txt && dataValida(ev.data) && ev.data >= d.kHoje && ev.data < d.kFim)
    .sort((a, b) => a.data.localeCompare(b.data));
  html += eventos.slice(0, MAX_EVENTOS).map(ev => item({
    cor: corSegura(ev.cor), aba: 'calendario', quando: esc(rotuloDia(ev.data, d)),
    titulo: esc(comAla(ev.txt)),
  })).join('');
  if (eventos.length > MAX_EVENTOS) html += verMais(`Mais ${eventos.length - MAX_EVENTOS} no Calendário`, 'calendario');
  // os fixos estão sempre à mão; os da ala vêm do servidor — sem eles, avisa
  if (!cargaTerminou) html += mudo('Carregando os eventos da ala…');
  else if (!carregado.eventos) html += mudo('📡 Os eventos cadastrados pela ala ainda não vieram do servidor');
  else if (!eventos.length) html += mudo('Nenhum evento no calendário nos próximos 7 dias.');
  preencher('inicio-semana', html);
}

// Um listener só para a tela inteira: os itens são recriados a cada desenho
function ligarInicio() {
  document.getElementById('panel-inicio')?.addEventListener('click', e => {
    const alvo = e.target.closest('[data-act]');
    if (!alvo) return;
    if (alvo.dataset.act === 'identificar') abrirEscolhaCargo();
    else if (alvo.dataset.act === 'ir' && alvo.dataset.aba) {
      switchTab(alvo.dataset.aba);
      // item de um domingo: vai até o card dele; senão, o topo da aba
      // (a tela é comprida: sem isto a aba nova abriria rolada)
      if (alvo.dataset.dk) irParaDomingo(alvo.dataset.dk);
      else window.scrollTo(0, 0);
    }
  });
  // O app instalado fica aberto por dias. Ao voltar para ele, saudação, data e
  // "Hoje/Amanhã" precisam estar certos mesmo sem conexão — sem ela não há
  // carga, e a carga era o único outro gatilho enquanto a aba está aberta.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') renderInicio();
  });
}
ligarInicio();
