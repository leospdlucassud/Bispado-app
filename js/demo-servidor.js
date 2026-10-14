// =============================================
// SERVIDOR DA DEMONSTRAÇÃO — o /api/* dentro do navegador (sem DOM)
// No modo demonstração (js/demo.js), todo pedido ao /api/ é atendido aqui, e
// nunca sai para a rede. Imita as Netlify Functions com as MESMAS regras —
// crud-regras (upsert e PUT), fundirDomingo e travarVagas (sacramentais) e
// convite-regras (a tela do membro) —, para a demonstração se comportar como o
// app de verdade, inclusive nos conflitos.
// O armazém é injetado: no navegador, o localStorage separado da
// demonstração; nos testes (tests/), um Map.
// =============================================

import { aplicarPut, escondidoPorSigilo, fundirSimples, inserirOuMesclar, limparCorpo, semSigilosos } from './crud-regras.js';
import { camposDaResposta, conviteParaMembro, encerrada } from './convite-regras.js';
import { fundirDomingo, travarVagas } from './discursos-regras.js';

// As coleções do crudHandler (netlify/functions/_crud.js), com as mesmas opções
const CRUD = {
  agenda: { sigilo: true }, reunioes: {}, designacoes: {}, eventos_extras: {}, acompanhamentos: { sigilo: true }, bispado: {},
  sacramentais: { unicoPor: 'data', fundir: fundirDomingo, travar: travarVagas },
  oradores: { unicoPor: 'chave', fundir: fundirSimples },
};
const MEMBROS_VAZIO = { movimentacoes: [], saidos: [], adicionados: [], roster: null, rosterAtualizadoEm: null };

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
const naoAchou = (msg = 'Not found') => json({ error: msg }, 404);

// O login da demonstração (netlify/functions/sessao.js): a senha do Bispo é
// "demo" — está escrito no Como Usar —, e o token é fixo. O ADM, que não
// aparece na tela, não se demonstra (o pedido de 'bispo' entra como Bispo).
export const SENHA_DEMO = 'demo';
const PAPEIS = ['bispo', 'adm'];
const DIAS_30 = 30 * 24 * 60 * 60 * 1000;
const papelDe = req => /^Bearer\s+demo\.(bispo|adm)$/.exec(req.headers.get('authorization') || '')?.[1] || null;

// armazem: { ler(nome) → valor ou null, gravar(nome, valor) }
export function criarServidor(armazem, { agora = () => new Date().toISOString() } = {}) {
  let seq = 0;
  const novoId = () => `demo_${Date.now().toString(36)}_${++seq}`;
  const lista = nome => { const v = armazem.ler(nome); return Array.isArray(v) ? v : []; };

  // Cada operação lê, muda e grava sem nenhum await no meio: duas abas da
  // demonstração não intercalam uma escrita na outra.
  function crud(nome, { unicoPor, fundir, travar, sigilo }, metodo, id, body, veSigilo) {
    const dados = lista(nome);
    if (metodo === 'GET') return json(sigilo ? semSigilosos(dados, veSigilo) : dados);
    if (metodo === 'POST') {
      if (unicoPor) {
        const r = inserirOuMesclar(dados, body, { campo: unicoPor, agora: agora(), novoId: novoId(), fundir, travar });
        armazem.gravar(nome, r.lista);
        return json(r.descartados.length ? { ...r.item, _descartados: r.descartados } : r.item, r.criado ? 201 : 200);
      }
      const item = { ...limparCorpo(body), id: novoId(), criadoEm: agora() };
      armazem.gravar(nome, [...dados, item]);
      return json(item, 201);
    }
    if (metodo === 'PUT' && id) {
      const idx = dados.findIndex(i => i.id === id);
      if (idx < 0 || (sigilo && escondidoPorSigilo(dados[idx], veSigilo))) return naoAchou();
      const r = aplicarPut(dados[idx], limparCorpo(body, unicoPor ? [unicoPor] : []), { agora: agora(), travar });
      const novo = [...dados];
      novo[idx] = r.item;
      armazem.gravar(nome, novo);
      return json(r.descartados.length ? { ...r.item, _descartados: r.descartados } : r.item);
    }
    if (metodo === 'DELETE' && id) {
      if (sigilo && escondidoPorSigilo(dados.find(i => i.id === id), veSigilo)) return naoAchou();
      armazem.gravar(nome, dados.filter(i => i.id !== id));
      return json({ ok: true });
    }
    return json({ error: 'Method not allowed' }, 405);
  }

  // netlify/functions/sessao.js
  function sessao(metodo, body, req) {
    if (metodo === 'GET') { const p = papelDe(req); return p ? json({ papel: p }) : json({ error: 'sessao' }, 401); }
    if (metodo !== 'POST') return json({ error: 'Method not allowed' }, 405);
    if (!PAPEIS.includes(body?.papel)) return json({ error: 'papel' }, 400);
    if (body?.senha !== SENHA_DEMO) return json({ error: 'senha' }, 401);
    return json({ papel: body.papel, token: 'demo.' + body.papel, exp: Date.now() + DIAS_30 });
  }

  // netlify/functions/notas.js
  function notas(metodo, id, body) {
    const dados = lista('notas');
    if (metodo === 'GET') return json(dados);
    if (metodo === 'POST') {
      const nota = { ...(body || {}), id: 'n_' + novoId(), criadaEm: body?.criadaEm || agora() };
      armazem.gravar('notas', [...dados, nota]);
      return json(nota);
    }
    if (metodo === 'PUT' && id) {
      if (!dados.some(n => n.id === id)) return naoAchou('Nota não encontrada');
      armazem.gravar('notas', dados.map(n => n.id === id ? { ...n, ...body, id } : n));
      return json({ ...body, id });
    }
    if (metodo === 'DELETE' && id) {
      armazem.gravar('notas', dados.filter(n => n.id !== id));
      return json({ ok: true });
    }
    return json({ error: 'Method not allowed' }, 405);
  }

  // netlify/functions/membros.js: um documento só, gravado por campos
  function membros(metodo, body) {
    const atual = { ...MEMBROS_VAZIO, ...(armazem.ler('membros') || {}) };
    if (metodo === 'GET') return json(atual);
    if (metodo === 'POST') {
      const b = body || {};
      const data = {
        movimentacoes: b.movimentacoes !== undefined ? b.movimentacoes : atual.movimentacoes,
        saidos: b.saidos !== undefined ? b.saidos : atual.saidos,
        adicionados: b.adicionados !== undefined ? b.adicionados : atual.adicionados,
        roster: b.roster !== undefined ? b.roster : atual.roster,
        rosterAtualizadoEm: b.roster !== undefined ? agora() : atual.rosterAtualizadoEm,
      };
      armazem.gravar('membros', data);
      return json({ ok: true, total: data.roster ? data.roster.length : 0 });
    }
    return json({ error: 'Method not allowed' }, 405);
  }

  // netlify/functions/convite.js: a tela do membro só vê a projeção mínima
  function convite(metodo, id, body) {
    if (!id) return json({ error: 'Informe o convite' }, 400);
    const dados = lista('agenda');
    const idx = dados.findIndex(x => String(x.id) === id);
    if (idx < 0) return naoAchou('Convite não encontrado');
    if (metodo === 'GET') return json(conviteParaMembro(dados[idx]));
    if (metodo === 'PUT') {
      const atual = dados[idx];
      if (encerrada(atual)) return json({ error: 'encerrada' }, 409);
      const quando = agora();
      const campos = camposDaResposta(atual, body?.resposta, body?.sugestao, quando);
      if (!campos) return json({ error: 'Resposta inválida' }, 400);
      const atualizado = { ...atual, ...campos, atualizadoEm: quando };
      const novo = [...dados];
      novo[idx] = atualizado;
      armazem.gravar('agenda', novo);
      return json(conviteParaMembro(atualizado));
    }
    return json({ error: 'Method not allowed' }, 405);
  }

  async function atender(req) {
    const url = new URL(req.url);
    const nome = url.pathname.replace(/^\/api\//, '').replace(/\/+$/, '');
    const id = url.searchParams.get('id');
    const metodo = req.method.toUpperCase();
    if (metodo === 'OPTIONS') return new Response(null, { status: 204 });
    // o corpo é lido ANTES da operação, que daí em diante não espera nada
    let body = null;
    if (metodo === 'POST' || metodo === 'PUT') {
      try { body = await req.json(); } catch { return json({ error: 'Corpo inválido' }, 400); }
    }
    if (!url.pathname.startsWith('/api/')) return naoAchou();
    if (Object.prototype.hasOwnProperty.call(CRUD, nome)) return crud(nome, CRUD[nome], metodo, id, body, !!papelDe(req));
    if (nome === 'sessao') return sessao(metodo, body, req);
    if (nome === 'notas') return notas(metodo, id, body);
    if (nome === 'membros') return membros(metodo, body);
    if (nome === 'convite') return convite(metodo, id, body);
    return naoAchou();
  }

  return { atender };
}
