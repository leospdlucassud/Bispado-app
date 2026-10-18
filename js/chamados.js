// =============================================
// QUEM OCUPA CADA CHAMADO
// Os cargos (Bispo, 1º Conselheiro…) são fixos; quem os ocupa muda. Por isso
// nenhum nome de pessoa fica escrito no código: os nomes moram aqui, editáveis
// pela tela e guardados no servidor, para todos os aparelhos verem o mesmo.
// =============================================
import { renderAgenda } from './agenda.js';
import { apiFetch, atualizarUltimaSinc, avisarPendente, setSyncStatus } from './api.js';
import { CARGOS } from './config.js';
import { renderDesignacoes } from './designacoes.js';
import { pedirTexto } from './dialogo.js';
import { renderInicio } from './inicio.js';
import { renderAbaSacramental, sacCarregado } from './sacramental.js';
import { renderQuemBadge, toast } from './usuario.js';

export const API_BISPADO = '/api/bispado';

// { 'Bispo': 'França', … } — cargo vago simplesmente não aparece no mapa
export let NOMES_CARGOS = {};
let idRegistro = null;   // o registro único dentro da coleção
// O GET de /api/bispado já respondeu nesta sessão. Antes disso o mapa vazio quer
// dizer "não sei", não "sem nomes" — e, sem idRegistro, não dá para saber se o
// registro já existe (ver salvarChamados). A prévia da importação do LCR olha isto.
export let nomesCarregados = false;

export function setNomesCargos(mapa) { NOMES_CARGOS = mapa || {}; }

// "Bispo França" quando há nome; só "Bispo" quando o chamado está sem nome.
export function comNome(cargo) {
  if (!cargo) return '';
  const nome = NOMES_CARGOS[cargo];
  return nome ? `${cargo} ${nome}` : cargo;
}

export function nomeDoCargo(cargo) {
  return NOMES_CARGOS[cargo] || '';
}

export async function carregarChamados() {
  try {
    const lista = await apiFetch(API_BISPADO);
    const reg = Array.isArray(lista) ? lista[0] : null;
    if (reg) {
      idRegistro = reg.id;
      setNomesCargos(reg.nomes);
      // o cracha do topo e desenhado no boot, antes desta carga terminar
      renderQuemBadge();
    }
    // lista vazia também é resposta: ainda não há registro, e o POST vai criá-lo
    if (Array.isArray(lista)) nomesCarregados = true;
    return true;
  } catch (e) { return false; }
}

// Tenta a carga que faltou; sem ela, avisa e diz que não dá
async function garantirNomes() {
  if (!nomesCarregados) await carregarChamados();
  if (!nomesCarregados) toast('Os nomes do bispado ainda não vieram do servidor — tente de novo com conexão');
  return nomesCarregados;
}

export async function abrirEdicaoChamados() {
  // sem os nomes atuais, o formulário abriria vazio e o salvar não passaria
  if (!await garantirNomes()) return;
  const campos = CARGOS.map((c, i) => ({
    id: 'cargo' + i,
    label: c,
    valor: NOMES_CARGOS[c] || '',
    placeholder: 'Nome de quem ocupa (vazio = sem nome)',
  }));
  const r = await pedirTexto('Quem ocupa cada chamado', campos, { okLabel: 'Salvar' });
  if (r === null) return;

  const nomes = {};
  CARGOS.forEach((c, i) => {
    const v = (r['cargo' + i] || '').trim();
    if (v) nomes[c] = v;
  });
  await salvarChamados(nomes);
}

// Devolve true só quando o servidor confirmou: quem chama (a importação do LCR)
// não pode dizer "atualizados" por cima do aviso de pendente.
export async function salvarChamados(nomes) {
  // Sem a resposta do GET, um POST "às cegas" criava um SEGUNDO registro na
  // coleção (o servidor não a trata como registro único), e a carga seguinte,
  // que lê o primeiro, desfazia a mudança sem aviso.
  if (!await garantirNomes()) return false;
  setNomesCargos(nomes);   // otimista: a tela reflete na hora
  redesenhar();
  try {
    if (idRegistro) {
      await apiFetch(`${API_BISPADO}?id=${idRegistro}`, 'PUT', { nomes });
    } else {
      const criado = await apiFetch(API_BISPADO, 'POST', { nomes });
      idRegistro = criado?.id || null;
    }
    atualizarUltimaSinc(); setSyncStatus('ok');
    toast('Nomes atualizados');
    return true;
  } catch (e) {
    // a alteração fica na fila e será reenviada; o aviso evita achar que já foi
    avisarPendente('mudança de nomes');
    return false;
  }
}

// Redesenha o que mostra nome de chamado.
function redesenhar() {
  renderQuemBadge();
  renderAgenda();
  renderDesignacoes();
  renderInicio();   // saudação e responsáveis
  if (sacCarregado) renderAbaSacramental();   // a assinatura do convite de discurso leva o nome
}
