// =============================================
// ABA CHAMADOS — o relatório "Organizações e Chamados" do LCR
// Quem ocupa cada chamado da ala, o que está vago e quem foi apoiado mas ainda
// não recebeu a designação (imposição de mãos). Os dados vêm do PDF que o LCR
// gera, importado aqui; a leitura do PDF, as contas e os filtros moram em
// chamados-lcr.js (sem DOM, testado no Node) — este módulo só carrega, desenha,
// conduz a importação e abre a Agenda para marcar a designação de quem falta.
// Não confundir com chamados.js: lá ficam os NOMES do bispado (Bispo,
// conselheiros, secretários) que a entrada, os convites e as atas usam. A
// importação daqui só os atualiza por lá, se a pessoa marcar.
// =============================================
import { abrirModalAgenda } from './agenda.js';
import { agendaCarregada, atualizarUltimaSinc, apiFetch, avisarPendente, setSyncStatus } from './api.js';
import { switchTab } from './app.js';
import { NOMES_CARGOS, carregarChamados, nomesCarregados, salvarChamados } from './chamados.js';
import {
  FILTROS_CHAMADOS, aDesignar, agruparPorOrganizacao, compararBispado, compararChamados, designacaoNaAgenda,
  cargoDoChamado, editarOcupante, filtrarChamados, membroDoQuadro, membrosSemChamado, nomeCurto, nomesAposImportar,
  obsDaDesignacao, ordemNatural, parsearPdfChamados, resumoChamados,
} from './chamados-lcr.js';
import { ALA, API_CHAMADOS, DADOS } from './config.js';
import { TIPO_DESIGNACAO } from './convite-regras.js';
import { NOMES_DOS_PDFS, abaDoPdf, tipoDePdfLcr } from './crescimento-lcr.js';
import { MEMBROS } from './dados-membros.js';
import { confirmar } from './dialogo.js';
import { renderInicio } from './inicio.js';
import { carregarPdfJs } from './membros-import.js';
import { MEMBROS_SAIDOS, renderMembros } from './membros.js';
import { lerFila } from './offline-pwa.js';
import { iniciarProgresso, liberarAplicar, textoDasPaginas, travarAplicar } from './pdf-progresso.js';
import { abrirModal, fecharModal } from './ui.js';
import { podeVer, toast } from './usuario.js';
import { dataParaExibir, esc, norm } from './utils.js';

// ---------- estado ----------
// O documento de /api/chamados: { chamados, relatorio: { ala, unidade, estaca, data }, atualizadoEm }
export let CHAMADOS_ALA = [];
export let RELATORIO_CHAMADOS = null;
export let CHAMADOS_ATUALIZADO_EM = null;
// Já veio do servidor alguma vez. Enquanto não, "nenhum chamado" quer dizer
// "não sei" — o Início não pode dizer que não há ninguém a designar.
export let chamadosAlaCarregados = false;
// A última importação está na fila (feita sem sinal): ainda não chegou ao servidor
export let importacaoPendente = false;
let carregando = true;   // a 1ª carga ainda não terminou (nem bem, nem mal)

export let filChamados = 'todos';
// organizações recolhidas na vista completa (sem filtro nem busca)
const orgsFechadas = new Set();

// Para o Início, o cartão do membro e a Agenda: o que a aba tem agora
export function dadosDosChamados() {
  return {
    chamados: CHAMADOS_ALA, relatorio: RELATORIO_CHAMADOS, atualizadoEm: CHAMADOS_ATUALIZADO_EM,
    carregados: chamadosAlaCarregados, pendente: importacaoPendente,
  };
}

// O Início abre a aba já no filtro ("A designar"): troca o filtro e redesenha.
// `limparBusca`: o item do Início promete "N a designar" — uma busca esquecida
// na caixa esconderia parte deles.
export function setFiltroChamados(id, { limparBusca = false } = {}) {
  filChamados = FILTROS_CHAMADOS.some(f => f.id === id) ? id : 'todos';
  const busca = document.getElementById('busca-chamados');
  if (limparBusca && busca) busca.value = '';
  renderChamadosAla();
}

function aplicarDocumento(doc, { pendente = false } = {}) {
  CHAMADOS_ALA = Array.isArray(doc?.chamados) ? doc.chamados.filter(c => c && typeof c === 'object') : [];
  RELATORIO_CHAMADOS = doc?.relatorio && typeof doc.relatorio === 'object' ? doc.relatorio : null;
  CHAMADOS_ATUALIZADO_EM = doc?.atualizadoEm || null;
  importacaoPendente = pendente;
}

// Os chamados aparecem fora desta aba também: no cartão de cada membro e no
// "Precisa de atenção" do Início. Chegou documento novo, os dois redesenham
// (o Início só troca o que mudou e, antes do fim da 1ª carga, segue "Carregando…").
function redesenharQuemMostra() {
  renderMembros();
  renderInicio();
}

// As entrevistas que este cargo pode ver (podeVer), para a designação marcada
const entrevistasVisiveis = () => (DADOS.agenda || []).filter(podeVer);

// A importação feita sem sinal fica na fila do IndexedDB até sair. Ela é mais
// nova que o que o servidor tem: vale por cima da carga — senão a atualização
// de 30 s trazia o relatório antigo e a importação "sumia" da tela, embora
// continuasse na fila (o mesmo motivo de pendentes.js, para as coleções).
const caminhoDe = url => { try { return new URL(url, location.href).pathname; } catch (e) { return ''; } };
async function importacaoNaFila() {
  const fila = await lerFila().catch(() => []);
  const ultima = fila
    .filter(i => i && i.method === 'POST' && caminhoDe(i.url) === API_CHAMADOS && Array.isArray(i.body?.chamados))
    .sort((a, b) => b.ts - a.ts)[0];
  return ultima ? { ...ultima.body, atualizadoEm: new Date(ultima.ts).toISOString() } : null;
}

// Muda quando o documento muda (cada importação grava um atualizadoEm novo): a
// carga de 30 s que traz o mesmo relatório não redesenha o quadro de membros.
const assinatura = () => `${CHAMADOS_ATUALIZADO_EM}|${CHAMADOS_ALA.length}|${importacaoPendente}`;

// Devolve true se o servidor respondeu (como os load* de api.js). Uma falha
// mantém o que já está na tela: a carga de 30 s sem sinal não apaga a aba.
export async function carregarChamadosAla() {
  const antes = assinatura();
  let ok = false;
  try {
    const doc = await apiFetch(API_CHAMADOS);
    if (doc && Array.isArray(doc.chamados)) { aplicarDocumento(doc); chamadosAlaCarregados = ok = true; }
  } catch (e) { /* sem conexão: fica o que havia */ }
  const naFila = await importacaoNaFila();
  if (naFila) aplicarDocumento(naFila, { pendente: true });
  else importacaoPendente = false;   // a fila já mandou (o que a tela mostra é o que foi enviado)
  carregando = false;
  renderChamadosAla();
  if (assinatura() !== antes) redesenharQuemMostra();
  return ok;
}

// ---------- desenho ----------
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
const ativos = () => MEMBROS.filter(m => m && !MEMBROS_SAIDOS.includes(m.id));
const temQuadro = () => MEMBROS.length > 0;
const stat = (n, rotulo, cor) =>
  `<div class="membros-stat"><div class="stat-num" style="--c:${cor}">${n}</div><div class="stat-label">${rotulo}</div></div>`;
const vazia = (titulo, dica = '') =>
  `<div class="vazia">${titulo}${dica ? `<br><span class="cham-vazia-dica">${dica}</span>` : ''}</div>`;

function infoChamados() {
  if (!CHAMADOS_ALA.length && !RELATORIO_CHAMADOS) {
    if (carregando) return 'Carregando os chamados…';
    return chamadosAlaCarregados
      ? '📄 Nenhum relatório de chamados ainda. Toque em <strong>Importar PDF do LCR</strong> e escolha o relatório “Organizações e Chamados”.'
      : 'Sem conexão — os chamados ainda não foram carregados.';
  }
  const partes = [RELATORIO_CHAMADOS?.data ? `Relatório do LCR de ${dataParaExibir(RELATORIO_CHAMADOS.data)}` : 'Relatório do LCR'];
  if (CHAMADOS_ATUALIZADO_EM) partes.push(`importado em ${dataParaExibir(CHAMADOS_ATUALIZADO_EM)}`);
  let html = '📄 ' + partes.map(esc).join(' · ');
  if (importacaoPendente) html += ' · <strong>aguardando envio ao servidor</strong>';
  const ala = RELATORIO_CHAMADOS?.ala;
  if (ala && norm(ala) !== norm(ALA)) html += ` · <span style="--c:#e8b040">relatório da ${esc(ala)}</span>`;
  return html;
}

export function renderChamadosAla() {
  const el = document.getElementById('lista-chamados');
  if (!el) return;
  const busca = document.getElementById('busca-chamados')?.value || '';
  const r = resumoChamados(CHAMADOS_ALA);

  const stats = document.getElementById('chamados-stats');
  if (stats) {
    stats.innerHTML = stat(r.total, 'Chamados', '#fb923c') + stat(r.preenchidos, 'Preenchidos', '#34d399')
      + stat(r.vagos, 'Vagos', r.vagos ? '#e8b040' : '#34d399')
      + stat(r.aDesignar, 'A designar', r.aDesignar ? '#f472b6' : '#34d399');
  }
  const info = document.getElementById('chamados-info');
  if (info) info.innerHTML = infoChamados();

  // "Sem chamado" só existe com o quadro de membros (a aba Membros): sem ele,
  // não há quem comparar com os ocupantes
  if (filChamados === 'sem-chamado' && !temQuadro()) filChamados = 'todos';
  const filtros = document.getElementById('filtros-chamados');
  if (filtros) {
    const conta = {
      todos: r.total, vagos: r.vagos, 'a-designar': r.aDesignar,
      'sem-chamado': temQuadro() && CHAMADOS_ALA.length ? membrosSemChamado(ativos(), CHAMADOS_ALA).length : 0,
    };
    filtros.innerHTML = !CHAMADOS_ALA.length ? '' : FILTROS_CHAMADOS
      .filter(f => f.id !== 'sem-chamado' || temQuadro())
      .map(f => {
        const ativo = f.id === filChamados;
        return `<button type="button" class="filtro-btn${ativo ? ' active' : ''}" data-fil="${f.id}" aria-pressed="${ativo}">${esc(f.rotulo)} (${conta[f.id] ?? 0})</button>`;
      }).join('');
  }

  if (filChamados === 'sem-chamado') { renderSemChamado(el, busca); return; }

  if (!CHAMADOS_ALA.length) {
    el.innerHTML = carregando ? '<div class="loading">Carregando…</div>'
      : !chamadosAlaCarregados ? vazia('📡 Sem conexão com o servidor', 'Os chamados aparecem quando a conexão voltar')
      : vazia('📭 Nenhum chamado importado', 'Importe o PDF “Organizações e Chamados” do LCR pelo botão acima');
    return;
  }
  const achados = filtrarChamados(CHAMADOS_ALA, { filtro: filChamados, busca });
  if (!achados.length) { el.innerHTML = vazia('🔍 Nenhum chamado com esse filtro'); return; }

  // Com filtro ou busca, toda organização abre: o que foi achado não pode
  // ficar escondido numa organização recolhida
  const livre = filChamados === 'todos' && !busca.trim();
  const conta = achados.length === CHAMADOS_ALA.length
    ? plural(achados.length, 'chamado', 'chamados')
    : `${achados.length} de ${plural(CHAMADOS_ALA.length, 'chamado', 'chamados')}`;
  el.innerHTML = `<div class="cham-conta">${conta}</div>`
    + agruparPorOrganizacao(achados).map(o => blocoOrganizacao(o, !livre || !orgsFechadas.has(o.org))).join('');
}

function blocoOrganizacao(o, aberta) {
  const vagos = o.vagos ? plural(o.vagos, 'vago', 'vagos') : 'sem vagos';
  return `<details class="cham-org" data-org="${esc(o.org)}"${aberta ? ' open' : ''}>
    <summary><span class="cham-org-nome"><span class="cham-seta" aria-hidden="true">▸</span> ${esc(o.org || 'Outros')}</span>
      <span class="cham-org-conta">${plural(o.total, 'chamado', 'chamados')} · ${vagos}</span></summary>
    ${o.grupos.map(g => `<div class="cham-grupo">
      ${g.grupo ? `<div class="cham-grupo-nome">${esc(g.grupo)}</div>` : ''}
      ${g.chamados.map(linhaChamado).join('')}
    </div>`).join('')}
  </details>`;
}

// A ação de quem está "a designar", conforme a Agenda (designacaoNaAgenda):
// agendar; ou a designação já marcada, que leva à Agenda; ou, feita, o lembrete
// de marcá-la no LCR — o relatório só traz o ✓ na próxima importação.
// Antes de a agenda vir do servidor, "não está na Agenda" não é sabido: o botão
// fica de fora (a aba redesenha quando ela chega, no carregarTudo).
function acaoDesignacao(c) {
  if (!agendaCarregada) return '<span class="cham-espera" title="A Agenda ainda não veio do servidor">📡 Agenda ainda não carregada</span>';
  const ag = designacaoNaAgenda(entrevistasVisiveis(), c);
  if (!ag) {
    return `<button type="button" class="btn-secondary cham-agendar" data-act="agendar-designacao" data-i="${CHAMADOS_ALA.indexOf(c)}">📅 Agendar designação</button>`;
  }
  const quando = ag.e.data ? `${dataParaExibir(ag.e.data)}${ag.e.hora ? ` às ${ag.e.hora}` : ''}` : '';
  if (ag.estado === 'marcada') {
    return `<button type="button" class="cham-marcada" data-act="ver-agenda" title="Abrir a Agenda">📅 ${quando ? `Marcada · ${esc(quando)}` : 'Na Agenda, sem data'}</button>`;
  }
  return `<span class="cham-feita" title="A Agenda registra a designação como realizada; o LCR ainda não">✓ Feita${ag.e.data ? ` em ${esc(dataParaExibir(ag.e.data))}` : ''} · falta marcar no LCR</span>`;
}

// Uma linha por chamado: o título, quem ocupa (na ordem natural: "Ana Clara
// Simulado", não "Simulado, Ana Clara") e a situação. A ação da linha (agendar
// a designação de quem está "a designar") entra ao lado dos selos.
function linhaChamado(c) {
  const vago = !c.nome, falta = aDesignar(c);
  const selo = vago ? '<span class="selo-cham selo-cham-vago">vago</span>'
    : falta ? `<span class="selo-cham selo-cham-designar">a designar</span>${acaoDesignacao(c)}`
    : '<span class="selo-cham selo-cham-ok">✓ designado</span>';
  const pers = c.personalizado
    ? ' <span class="cham-pers" title="Chamado personalizado da ala" aria-hidden="true">✦</span><span class="so-leitor">, chamado personalizado</span>' : '';
  return `<div class="cham-linha${vago ? ' vago' : falta ? ' a-designar' : ''}">
    <div class="cham-corpo">
      <div class="cham-titulo">${esc(c.chamado)}${pers}</div>
      <div class="cham-nome${vago ? ' vazio' : ''}">${vago ? 'Chamado em aberto' : esc(ordemNatural(c.nome))}</div>
      ${c.apoiado ? `<div class="cham-sub">Apoiado em ${esc(dataParaExibir(c.apoiado))}</div>` : ''}
    </div>
    <div class="cham-selos">${selo}
      <button type="button" class="cham-editar" data-act="editar-chamado" data-i="${CHAMADOS_ALA.indexOf(c)}" aria-label="${vago ? 'Preencher' : 'Editar quem ocupa'}: ${esc(c.chamado)}" title="${vago ? 'Preencher' : 'Editar ou deixar vago'}">${vago ? '＋ Preencher' : '✏️ Editar'}</button>
    </div>
  </div>`;
}

// ---------- editar quem ocupa um chamado ----------
// Preencher o vago, trocar a pessoa ou deixar vago, sem esperar o próximo
// relatório do LCR (editarOcupante, de chamados-lcr.js). O nome sai do quadro de
// membros (a lista sugere, na forma do LCR); quem não está no quadro também vale.
let edicao = null;   // { i, chamado } aberto na janela
function abrirEdicaoChamado(i) {
  const c = CHAMADOS_ALA[i];
  if (!c) return;
  edicao = { i, c };
  const cargo = cargoDoChamado(c);
  const sugestoes = ativos().slice().sort((a, b) => a.name.localeCompare(b.name))
    .map(m => `<option value="${esc(m.name)}">${esc(ordemNatural(m.name))}</option>`).join('');
  const onde = [c.org, c.grupo].filter(Boolean).map(esc).join(' · ');
  conteudo(`
    <h3>${c.nome ? '✏️' : '＋'} ${esc(c.chamado)} <button type="button" class="modal-close" aria-label="Fechar">✕</button></h3>
    ${onde ? `<p class="cham-prev-resumo">${onde}</p>` : ''}
    <form class="cham-edicao" data-form="editar-chamado">
      <div class="form-group">
        <label for="cham-ed-nome">Quem ocupa</label>
        <input type="text" class="form-input" id="cham-ed-nome" list="cham-ed-membros" value="${esc(c.nome || '')}" placeholder="Digite e escolha no quadro de membros" autocomplete="off" required>
        <datalist id="cham-ed-membros">${sugestoes}</datalist>
      </div>
      <div class="form-group">
        <label for="cham-ed-apoiado">Apoiado em</label>
        <input type="date" class="form-input" id="cham-ed-apoiado" value="${esc(c.apoiado || '')}">
      </div>
      <label class="cham-ed-check"><input type="checkbox" id="cham-ed-designado"${c.designado ? ' checked' : ''}> Já foi designado (imposição de mãos)</label>
      ${cargo ? `<label class="cham-ed-check"><input type="checkbox" id="cham-ed-bispado" checked> Atualizar também o nome do ${esc(cargo)} no “Quem está usando?”</label>` : ''}
      <p class="cham-prev-nota">A próxima importação do relatório do LCR troca a lista inteira; a prévia dela mostra o que estiver diferente do que foi mudado aqui.</p>
      <div class="cham-prev-botoes">
        <button type="submit" class="btn-primary">Salvar</button>
        ${c.nome ? '<button type="button" class="btn-secondary" data-act="vagar-chamado">Deixar vago</button>' : ''}
        <button type="button" class="btn-secondary" data-act="fechar">Cancelar</button>
      </div>
    </form>`);
  abrirModal('modal-chamados', { semConfirmacao: true });
  document.getElementById('cham-ed-nome')?.focus();
}

async function salvarEdicaoChamado({ vagar = false } = {}) {
  const ed = edicao;
  if (!ed || CHAMADOS_ALA[ed.i] !== ed.c) { toast('A lista de chamados mudou enquanto a janela estava aberta — abra de novo'); fecharModal('modal-chamados'); return; }
  const v = id => document.getElementById(id);
  const nome = vagar ? '' : (v('cham-ed-nome')?.value || '').trim();
  if (!vagar && !nome) { toast('Digite quem ocupa o chamado (ou use "Deixar vago")'); return; }
  if (vagar && !await confirmar(`Deixar vago o chamado "${ed.c.chamado}"?`, { okLabel: 'Deixar vago' })) return;
  const r = editarOcupante(CHAMADOS_ALA, ed.i, {
    nome, apoiado: v('cham-ed-apoiado')?.value || '', designado: !!v('cham-ed-designado')?.checked,
  });
  if (r.erro) { toast(`Não foi possível salvar: ${r.erro}`); return; }
  const cargo = cargoDoChamado(ed.c);
  const trocarNome = !!cargo && !!v('cham-ed-bispado')?.checked;
  edicao = null;
  fecharModal('modal-chamados');

  // otimista: a aba (e o cartão do membro, o Início) mostram na hora
  const doc = { chamados: r.chamados, relatorio: RELATORIO_CHAMADOS };
  aplicarDocumento({ ...doc, atualizadoEm: new Date().toISOString() });
  renderChamadosAla();
  redesenharQuemMostra();
  let enviado = false;
  try {
    const resp = await apiFetch(API_CHAMADOS, 'POST', doc);
    if (resp?.atualizadoEm) CHAMADOS_ATUALIZADO_EM = resp.atualizadoEm;
    enviado = true;
    atualizarUltimaSinc(); setSyncStatus('ok');
  } catch (e) {
    importacaoPendente = true;   // ficou na fila (apiFetch) e sai na próxima sincronização
  }
  renderChamadosAla();
  const nomesOk = trocarNome ? await salvarChamados({ ...NOMES_CARGOS, [cargo]: nome ? nomeCurto(nome) : '' }) : true;
  if (!enviado) avisarPendente('alteração do chamado');
  else if (nomesOk) toast(vagar || !nome ? 'Chamado deixado vago' : 'Chamado atualizado');
}

// "📅 Agendar designação": a entrevista nova da Agenda já vem com a pessoa (o
// nome como o quadro escreve, para o telefone vir junto; sem ela no quadro, o do
// LCR), o tipo e o chamado na observação. A data e quem designa ficam com o bispado.
export function agendarDesignacao(c) {
  if (!c || !c.nome) return;
  const m = membroDoQuadro(ativos(), c.nome);
  abrirModalAgenda('', { membro: m ? m.name : c.nome, tipo: TIPO_DESIGNACAO, obs: obsDaDesignacao(c) });
}

// Adultos do quadro sem nenhum chamado no relatório — quem o bispado pode
// considerar ao preencher os vagos
function renderSemChamado(el, busca) {
  if (!CHAMADOS_ALA.length) {
    el.innerHTML = vazia('📭 Nenhum chamado importado', 'Importe o relatório para ver quem está sem chamado');
    return;
  }
  const lista = membrosSemChamado(ativos(), CHAMADOS_ALA, { busca })
    .map(m => ({ m, nome: ordemNatural(m.name) }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  if (!lista.length) { el.innerHTML = vazia(busca.trim() ? '🔍 Ninguém com esse nome' : '🎉 Todos os adultos ativos têm chamado'); return; }
  const data = RELATORIO_CHAMADOS?.data ? ` de ${dataParaExibir(RELATORIO_CHAMADOS.data)}` : '';
  el.innerHTML = `<div class="cham-conta">${plural(lista.length, 'membro ativo', 'membros ativos')}, de 18 anos ou mais, sem chamado no relatório${esc(data)}</div>`
    + lista.map(({ m, nome }) => `<div class="membro-card">
        <div>
          <div class="membro-nome">${esc(nome)}</div>
          <div class="membro-info">${m.gender === 'M' ? '♂ · ' : m.gender === 'F' ? '♀ · ' : ''}${esc(m.age)} anos</div>
        </div>
      </div>`).join('');
}

// ---------- importação do PDF ----------
// Como a dos membros (membros-import.js): o pdf.js lê o arquivo no próprio
// aparelho, a prévia mostra o que muda, e só o "Aplicar" grava.
let IMPORT_CHAMADOS = null;   // { doc: { chamados, relatorio }, bispado (null: nomes atuais não vieram) }
const conteudo = html => { const c = document.getElementById('modal-chamados-content'); if (c) c.innerHTML = html; };
const modalAberto = () => !!document.getElementById('modal-chamados')?.classList.contains('open');

function mostrarAviso(icone, titulo, html, extra = '') {
  conteudo(`
    <h3>${icone} ${esc(titulo)} <button type="button" class="modal-close" aria-label="Fechar">✕</button></h3>
    <div class="cham-aviso-texto">${html}</div>
    <div class="cham-prev-botoes">${extra}<button type="button" class="btn-secondary" data-act="fechar">Fechar</button></div>`);
}

const AVISO_TIPO = {
  'sem-texto': () => mostrarAviso('⚠️', 'Este PDF não tem texto', `
    <p>Ele foi gerado como imagem — é o que acontece ao imprimir pelo <strong>Microsoft Print to PDF</strong> —, e não há o que ler nele.</p>
    <p>Gere o PDF de novo pelo LCR: abra o relatório <strong>Organizações e Chamados</strong> e use o PDF do próprio LCR (imprimir / baixar). Se abrir a janela de impressão, escolha o destino <strong>Salvar como PDF</strong> — não “Microsoft Print to PDF”.</p>`),
  membros: () => mostrarAviso('👥', 'Este é a Lista de Membros', `
    <p>O PDF escolhido é a <strong>Lista de Membros</strong> do LCR. Ele se importa na aba Membros, pelo botão <strong>📄 Importar PDF do LCR</strong>.</p>
    <p>Aqui entra o relatório <strong>Organizações e Chamados</strong>.</p>`,
    '<button type="button" class="btn-secondary btn-destaque" data-act="ir-membros">Ir para Membros</button>'),
  // os relatórios da aba Vamos crescer a Ala (o tipoDePdfLcr os distingue da Lista de Membros)
  crescimento: tipo => mostrarAviso('🌱', `Este é o relatório ${NOMES_DOS_PDFS[tipo]}`, `
    <p>O PDF escolhido é o relatório <strong>${esc(NOMES_DOS_PDFS[tipo])}</strong> do LCR. Ele se importa na aba <strong>Vamos crescer a Ala</strong>, pelo botão <strong>📄 Importar PDF do LCR</strong>.</p>
    <p>Aqui entra o relatório <strong>Organizações e Chamados</strong>.</p>`,
    '<button type="button" class="btn-secondary btn-destaque" data-act="ir-crescimento">Ir para Vamos crescer a Ala</button>'),
  outro: () => mostrarAviso('⚠️', 'Não é o relatório de chamados', `
    <p>Não encontrei neste PDF o relatório <strong>Organizações e Chamados</strong> do LCR (o título no alto de cada página e as tabelas Chamado · Nome · Apoiado).</p>
    <p>Confira o arquivo escolhido.</p>`),
};

// As mensagens do pdf.js vêm em inglês
function mensagemDeErro(e) {
  if (e?.name === 'PasswordException') return 'O PDF tem senha. Gere-o de novo pelo LCR, sem senha.';
  if (e?.name === 'InvalidPDFException') return 'O arquivo não é um PDF válido (ou veio corrompido).';
  return String(e?.message || e || 'Erro desconhecido');
}

export async function importarPdfChamados(input) {
  const arquivo = input.files && input.files[0];
  input.value = '';
  if (!arquivo) return;

  IMPORT_CHAMADOS = null;
  // semConfirmacao: a prévia tem uma caixa de marcar, e fechar com ela mexida
  // não é "perder o que foi digitado"
  abrirModal('modal-chamados', { semConfirmacao: true });
  const progresso = iniciarProgresso(document.getElementById('modal-chamados-content'), 'Abrindo o PDF…');

  try {
    const pdfjs = await carregarPdfJs();
    const doc = await pdfjs.getDocument({ data: await arquivo.arrayBuffer() }).promise;
    progresso.etapa('Lendo os chamados…');
    const paginas = await textoDasPaginas(doc, progresso);
    if (!modalAberto()) return;   // fechou enquanto lia
    progresso.etapa('Conferindo as organizações…');
    // o PDF de outra aba (abaDoPdf) recebe o aviso de onde ele se importa
    const tipo = tipoDePdfLcr(paginas);
    const aba = abaDoPdf(tipo);
    if (aba === 'crescimento') { AVISO_TIPO.crescimento(tipo); return; }
    if (aba !== 'chamados') { (AVISO_TIPO[tipo] || AVISO_TIPO.outro)(); return; }
    const lido = parsearPdfChamados(paginas);
    if (!lido.chamados.length) throw new Error('O relatório foi reconhecido, mas nenhum chamado foi lido nele. Confira se o PDF veio inteiro.');
    // A prévia compara com o que está no servidor. O que ainda não veio (app
    // aberto sem sinal, carga que falhou) tenta de novo agora; se não vier, a
    // prévia diz que não comparou (e não "sem nome → …" nos 5 cargos).
    if (!nomesCarregados || !chamadosAlaCarregados) {
      progresso.etapa('Buscando no servidor os chamados e nomes atuais…');
      await Promise.allSettled([nomesCarregados || carregarChamados(), chamadosAlaCarregados || carregarChamadosAla()]);
      if (!modalAberto()) return;
    }
    mostrarPrevia(lido, doc.numPages);
  } catch (e) {
    if (modalAberto()) mostrarAviso('⚠️', 'Não foi possível importar', `<p>${esc(mensagemDeErro(e))}</p>`);
  }
}

// Bloco recolhível da prévia (como o da importação de membros)
function bloco(cor, titulo, itens, fmt) {
  if (!itens.length) return '';
  return `<details class="cham-prev-bloco" style="border-left-color:${cor}">
    <summary><span style="--c:${cor}">${titulo}: ${itens.length}</span></summary>
    <div class="cham-prev-lista">${itens.slice(0, 80).map(fmt).join('')}
      ${itens.length > 80 ? `<div class="cham-prev-mais">…e mais ${itens.length - 80}</div>` : ''}</div>
  </details>`;
}
const onde = c => `${esc(c.chamado)} <span class="cham-prev-org">(${esc(c.org)}${c.grupo ? ' › ' + esc(c.grupo) : ''})</span>`;

function textoBispado(b) {
  const atual = b.atual ? esc(b.atual) : '<em>sem nome</em>';
  if (b.estado === 'troca') return `${atual} → <strong>${esc(b.novo)}</strong>`;
  if (b.estado === 'vago') return `${atual} → <strong>vago no LCR</strong> (o nome sai)`;
  if (b.estado === 'ausente') return `${atual} <span class="cham-prev-org">— não está no relatório (fica)</span>`;
  return b.atual ? `✓ ${atual}` : '<span class="cham-prev-org">vago no LCR e sem nome aqui</span>';
}

function mostrarPrevia({ relatorio, chamados, tabelas }, nPaginas) {
  const r = resumoChamados(chamados);
  const personalizados = chamados.filter(c => c.personalizado).length;
  const tortas = tabelas.filter(t => t.contagem !== t.lidos);
  // Sem os nomes atuais (o GET de /api/bispado não respondeu), comparar com o
  // mapa vazio dava "troca" nos 5 cargos, com a caixa já marcada: não se oferece.
  const bispado = nomesCarregados ? compararBispado(chamados, NOMES_CARGOS) : null;
  const mudaBispado = !!bispado?.some(b => b.estado === 'troca' || b.estado === 'vago');
  // Os chamados atuais também podem não ter vindo (nem há importação na fila):
  // aí a lista vazia é "não sei", não "primeira importação"
  const semBase = !chamadosAlaCarregados && !importacaoPendente;
  IMPORT_CHAMADOS = { doc: { chamados, relatorio: relatorio || null }, bispado };

  const avisos = [];
  if (relatorio?.ala && norm(relatorio.ala) !== norm(ALA)) {
    avisos.push(`O PDF é da <strong>${esc(relatorio.ala)}</strong>, mas o painel está configurado como <strong>${esc(ALA)}</strong>. Confira antes de aplicar.`);
  }
  if (semBase) {
    avisos.push('Os chamados atuais não vieram do servidor (sem conexão): não deu para mostrar o que muda, nem conferir se este relatório é mais novo que o já importado.');
  } else if (relatorio?.data && RELATORIO_CHAMADOS?.data && relatorio.data < RELATORIO_CHAMADOS.data) {
    avisos.push(`Este relatório é de <strong>${esc(dataParaExibir(relatorio.data))}</strong>, mais antigo que o já importado (${esc(dataParaExibir(RELATORIO_CHAMADOS.data))}). Aplicar volta os chamados para aquela data.`);
  }
  if (tortas.length) {
    // a "Contagem" que o LCR escreve no fim de cada tabela é a conferência da leitura
    avisos.push(`${plural(tortas.length, 'tabela não confere', 'tabelas não conferem')} com a “Contagem” do PDF — confira esses chamados no LCR:
      <ul class="cham-prev-tortas">${tortas.map(t => `<li>${esc(t.org)}${t.grupo ? ' › ' + esc(t.grupo) : ''} (pág. ${t.pagina}): ${t.lidos} lido${t.lidos === 1 ? '' : 's'}, ${t.contagem == null ? 'sem “Contagem” no PDF' : `“Contagem” ${t.contagem}`}</li>`).join('')}</ul>`);
  }

  let mudancas = '';   // semBase: o aviso acima já diz que não comparou
  if (!semBase && !CHAMADOS_ALA.length) {
    mudancas = `<p class="cham-prev-nota">Primeira importação: ${plural(r.preenchidos, 'chamado preenchido', 'chamados preenchidos')} e ${plural(r.vagos, 'vago', 'vagos')}.</p>`;
  } else if (!semBase) {
    const d = compararChamados(CHAMADOS_ALA, chamados);
    const desde = RELATORIO_CHAMADOS?.data ? ` desde o relatório de ${esc(dataParaExibir(RELATORIO_CHAMADOS.data))}` : ' desde a última importação';
    mudancas = (d.novos.length || d.saidos.length || d.trocados.length)
      ? `<div class="cham-prev-titulo">O que muda${desde}</div>`
        + bloco('#34d399', 'Chamados preenchidos', d.novos, c => `<div>+ ${onde(c)}: ${esc(ordemNatural(c.nome))}</div>`)
        + bloco('#60a5fa', 'Trocas de ocupante', d.trocados, c => `<div>~ ${onde(c)}: ${esc(ordemNatural(c.antes))} → ${esc(ordemNatural(c.depois))}</div>`)
        + bloco('#e8b040', 'Desobrigações (ficaram vagos)', d.saidos, c => `<div>− ${onde(c)}: ${esc(ordemNatural(c.nome))}</div>`)
      : `<p class="cham-prev-nota">Nenhum ocupante mudou${desde}.</p>`;
  }

  const nomes = `<div class="cham-prev-titulo">Nomes do bispado</div>` + (!bispado
    ? '<p class="cham-prev-nota">Os nomes atuais do bispado não vieram do servidor (sem conexão): não deu para compará-los com o LCR, e eles ficam como estão. Para atualizá-los, importe de novo com conexão.</p>'
    : `<ul class="cham-bispado">${bispado.map(b => `<li><span class="cham-bispado-cargo">${esc(b.cargo)}</span> <span>${textoBispado(b)}</span></li>`).join('')}</ul>
    ${mudaBispado
      ? `<label class="cham-check"><input type="checkbox" id="cham-atualizar-bispado" checked> Atualizar os nomes do bispado</label>
         <p class="cham-prev-nota">São os nomes da entrada no app, dos convites e da presença das atas.</p>`
      : '<p class="cham-prev-nota">Os nomes do bispado já conferem com o LCR.</p>'}`);

  const da = relatorio?.ala ? ` · ${esc(relatorio.ala)}${relatorio.unidade ? ` (${esc(relatorio.unidade)})` : ''}` : '';
  const de = relatorio?.data ? ` · relatório de ${esc(dataParaExibir(relatorio.data))}` : '';
  conteudo(`
    <h3>📄 Conferir importação dos chamados <button type="button" class="modal-close" aria-label="Fechar">✕</button></h3>
    ${avisos.map(a => `<div class="cham-aviso">${a}</div>`).join('')}
    <p class="cham-prev-resumo"><strong>${r.total}</strong> chamados lidos em ${plural(nPaginas, 'página', 'páginas')}${da}${de}</p>
    <div class="membros-stats">${stat(r.preenchidos, 'Preenchidos', '#34d399')}${stat(r.vagos, 'Vagos', '#e8b040')}${stat(r.aDesignar, 'A designar', '#f472b6')}${stat(personalizados, 'Personalizados', '#fb923c')}</div>
    ${mudancas}
    ${nomes}
    <p class="cham-prev-nota cham-prev-rodape">Os chamados da aba serão substituídos pelos deste PDF. As listas de membros que o relatório traz (com telefone, e-mail e nascimento) não são lidas nem guardadas.</p>
    <div class="cham-prev-botoes">
      <button type="button" class="btn-primary" data-act="aplicar" disabled aria-disabled="true">Aplicar</button>
      <button type="button" class="btn-secondary" data-act="fechar">Cancelar</button>
    </div>`);
  // o mesmo modal com conteúdo novo: renova o retrato (ui.js)
  abrirModal('modal-chamados', { semConfirmacao: true });
  // a prévia está inteira na tela: só agora o Aplicar liga (pdf-progresso.js)
  liberarAplicar(document.getElementById('modal-chamados-content'));
}

export async function aplicarImportacaoChamados() {
  const imp = IMPORT_CHAMADOS;
  if (!imp || !travarAplicar(document.getElementById('modal-chamados-content'))) return;
  IMPORT_CHAMADOS = null;
  // a caixa só existe quando os nomes atuais vieram do servidor (imp.bispado)
  const atualizarNomes = !!imp.bispado && !!document.getElementById('cham-atualizar-bispado')?.checked;
  fecharModal('modal-chamados');

  // otimista: a aba mostra o relatório novo na hora
  aplicarDocumento({ ...imp.doc, atualizadoEm: new Date().toISOString() });
  chamadosAlaCarregados = true;
  carregando = false;
  renderChamadosAla();
  redesenharQuemMostra();

  let enviado = false;
  try {
    const resp = await apiFetch(API_CHAMADOS, 'POST', imp.doc);
    if (resp?.atualizadoEm) CHAMADOS_ATUALIZADO_EM = resp.atualizadoEm;
    enviado = true;
    atualizarUltimaSinc(); setSyncStatus('ok');
  } catch (e) {
    // ficou na fila (apiFetch) e sai na próxima sincronização
    importacaoPendente = true;
  }
  renderChamadosAla();

  // os nomes vão por chamados.js (o /api/bispado), que redesenha o que os mostra
  // e diz true só quando o servidor confirmou
  const nomesOk = atualizarNomes ? await salvarChamados(nomesAposImportar(NOMES_CARGOS, imp.bispado)) : true;
  // Por último, para o aviso não ser coberto pelo do salvarChamados. "Nomes
  // atualizados" só com os nomes confirmados: com os chamados enviados e os
  // nomes na fila, o que fica na tela é o aviso de pendente do salvarChamados.
  if (!enviado) avisarPendente(atualizarNomes && !nomesOk ? 'importação dos chamados e dos nomes' : 'importação dos chamados');
  else if (nomesOk) toast(`${plural(imp.doc.chamados.length, 'chamado importado', 'chamados importados')}${atualizarNomes ? ' · nomes do bispado atualizados' : ''}`);
}

// ---------- ligações ----------
function ligarChamadosAla() {
  document.getElementById('chamados-acoes')?.addEventListener('click', e => {
    // o input de arquivo fica escondido; o botão é quem o aciona
    if (e.target.closest('button[data-act="importar"]')) document.getElementById('pdf-chamados')?.click();
  });
  document.getElementById('pdf-chamados')?.addEventListener('change', e => importarPdfChamados(e.target));

  document.getElementById('filtros-chamados')?.addEventListener('click', e => {
    const btn = e.target.closest('.filtro-btn');
    if (btn) setFiltroChamados(btn.dataset.fil);
  });
  document.getElementById('busca-chamados')?.addEventListener('input', renderChamadosAla);

  // as linhas são recriadas a cada desenho: um listener só, na lista. O data-i
  // é a posição em CHAMADOS_ALA no desenho em que o botão nasceu — e todo
  // documento novo redesenha a lista, levando os botões velhos junto.
  document.getElementById('lista-chamados')?.addEventListener('click', e => {
    const alvo = e.target.closest('[data-act]');
    if (!alvo) return;
    if (alvo.dataset.act === 'agendar-designacao') agendarDesignacao(CHAMADOS_ALA[+alvo.dataset.i]);
    else if (alvo.dataset.act === 'ver-agenda') switchTab('agenda');
    else if (alvo.dataset.act === 'editar-chamado') abrirEdicaoChamado(+alvo.dataset.i);
  });

  // 'toggle' não sobe pela árvore: escuta na captura. Só a vista completa
  // lembra o que foi recolhido (com filtro ou busca, tudo abre).
  document.getElementById('lista-chamados')?.addEventListener('toggle', e => {
    const d = e.target;
    if (!d.matches?.('details.cham-org')) return;
    if (filChamados !== 'todos' || (document.getElementById('busca-chamados')?.value || '').trim()) return;
    if (d.open) orgsFechadas.delete(d.dataset.org); else orgsFechadas.add(d.dataset.org);
  }, true);

  // o conteúdo do modal é reescrito em cada etapa (lendo / aviso / prévia);
  // o ✕ e o "Fechar"/"Cancelar" (data-act="fechar") são do ui.js
  document.getElementById('modal-chamados')?.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    if (el.dataset.act === 'aplicar') aplicarImportacaoChamados();
    else if (el.dataset.act === 'vagar-chamado') salvarEdicaoChamado({ vagar: true });
    else if (el.dataset.act === 'ir-membros') { fecharModal('modal-chamados'); switchTab('membros'); }
    else if (el.dataset.act === 'ir-crescimento') { fecharModal('modal-chamados'); switchTab('crescimento'); }
  });
  document.getElementById('modal-chamados')?.addEventListener('submit', e => {
    if (!e.target.closest('form[data-form="editar-chamado"]')) return;
    e.preventDefault();
    salvarEdicaoChamado();
  });
}
ligarChamadosAla();
