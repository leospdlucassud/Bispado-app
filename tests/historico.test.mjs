// Pilha de modais × histórico do navegador (js/ui.js) — `npm test`.
// Um navegador de mentira, só com o que o ui.js usa: um history com a lista de
// entradas e o popstate assíncrono (como o de verdade), e elementos mínimos para
// abrir e fechar modal. O ui.js se liga ao window e ao document ao ser
// importado: os falsos entram antes do import.
import assert from 'node:assert/strict';
import { test } from 'node:test';

let entradas, atual, aoPopstate = null;
function zerar() { entradas = [{ estado: { aba: 'inicio' }, url: '#inicio' }]; atual = 0; }
zerar();

const historico = globalThis.history = {
  get state() { return entradas[atual].estado; },
  pushState(estado, _t, url) {
    entradas.splice(atual + 1);
    entradas.push({ estado, url: url ?? entradas[atual].url });
    atual++;
  },
  replaceState(estado, _t, url) { entradas[atual] = { estado, url: url ?? entradas[atual].url }; },
  go(n) {
    setTimeout(() => {
      const alvo = atual + n;
      if (alvo < 0 || alvo >= entradas.length) return;   // nada para onde ir: sem popstate
      atual = alvo;
      aoPopstate?.({ state: entradas[atual].estado });
    }, 0);
  },
};
const caixa = { setAttribute() {}, querySelector: () => null, querySelectorAll: () => [], contains: () => true };
const modal = () => ({ classList: { add() {}, remove() {}, contains: () => false }, querySelector: () => caixa, querySelectorAll: () => [] });
const modais = {};
globalThis.window = { addEventListener: (tipo, fn) => { if (tipo === 'popstate') aoPopstate = fn; } };
globalThis.document = {
  activeElement: null,
  addEventListener() {},
  getElementById: id => (id.startsWith('modal-') ? (modais[id] ||= modal()) : null),
};

const { abrirModal, definirVoltarAba, fecharModal, registrarNoHistorico } = await import('../js/ui.js');

// o fim do tique (a devolução) e o popstate do go(-n)
const assentar = () => new Promise(r => setTimeout(r, 20));
const pilhaDoNavegador = () => entradas.slice(0, atual + 1).map(e => e.url);
// a troca de aba como o switchTab do app.js a registra
const trocarAba = aba => registrarNoHistorico({ aba }, '#' + aba);

test('fechar o modal e trocar de aba no mesmo toque deixa a aba nova no topo', async () => {
  zerar();
  trocarAba('chamados');
  abrirModal('modal-chamados');
  assert.equal(entradas.length, 3, 'o modal ganhou uma entrada');
  // o "Ir para Membros" do aviso da importação
  fecharModal('modal-chamados');
  trocarAba('membros');
  await assentar();
  assert.deepEqual(pilhaDoNavegador(), ['#inicio', '#chamados', '#membros']);
  assert.equal(entradas.length, atual + 1, 'nada sobrou à frente');
  assert.deepEqual(historico.state, { aba: 'membros' });
});

test('o Voltar depois disso volta para a aba de antes (e não pula a nova)', async () => {
  zerar();
  const voltas = [];
  definirVoltarAba(estado => voltas.push(estado?.aba));
  trocarAba('chamados');
  abrirModal('modal-chamados');
  fecharModal('modal-chamados');
  trocarAba('membros');
  await assentar();
  trocarAba('agenda');
  historico.go(-1);
  await assentar();
  assert.deepEqual(voltas, ['membros']);
  historico.go(-1);
  await assentar();
  assert.deepEqual(voltas, ['membros', 'chamados']);
  definirVoltarAba(null);
});

test('dois modais fechados antes da troca de aba: os dois saem do histórico', async () => {
  zerar();
  trocarAba('chamados');
  abrirModal('modal-chamados');
  abrirModal('modal-dialogo');   // um diálogo por cima
  fecharModal('modal-dialogo');
  fecharModal('modal-chamados');
  trocarAba('membros');
  await assentar();
  assert.deepEqual(pilhaDoNavegador(), ['#inicio', '#chamados', '#membros']);
  assert.deepEqual(historico.state, { aba: 'membros' });
});

test('fechar um modal e abrir outro no mesmo toque segue herdando a entrada', async () => {
  zerar();
  trocarAba('agenda');
  abrirModal('modal-agenda');
  fecharModal('modal-agenda');
  abrirModal('modal-dialogo');
  await assentar();
  assert.deepEqual(pilhaDoNavegador(), ['#inicio', '#agenda', '#agenda']);
  assert.equal(historico.state.modal, 'modal-dialogo');
  fecharModal('modal-dialogo');
  await assentar();
  assert.deepEqual(pilhaDoNavegador(), ['#inicio', '#agenda']);
});

test('troca de aba sem modal nenhum empilha na hora', () => {
  zerar();
  trocarAba('chamados');
  assert.deepEqual(pilhaDoNavegador(), ['#inicio', '#chamados']);
});
