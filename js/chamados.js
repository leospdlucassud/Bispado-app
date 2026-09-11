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
import { renderQuemBadge, toast } from './usuario.js';

export const API_BISPADO = '/api/bispado';

// { 'Bispo': 'França', … } — cargo vago simplesmente não aparece no mapa
export let NOMES_CARGOS = {};
let idRegistro = null;   // o registro único dentro da coleção

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
    return true;
  } catch (e) { return false; }
}

export async function abrirEdicaoChamados() {
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

export async function salvarChamados(nomes) {
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
  } catch (e) {
    // a alteração fica na fila e será reenviada; o aviso evita achar que já foi
    avisarPendente('mudança de nomes');
  }
}

// Redesenha o que mostra nome de chamado.
function redesenhar() {
  renderQuemBadge();
  renderAgenda();
  renderDesignacoes();
  renderInicio();   // saudação e responsáveis
}
