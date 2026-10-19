// Modo demonstração: dados fictícios e o servidor que roda no navegador — `npm test`.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  compararBispado, limparDocumentoChamados, membrosSemChamado, resumoChamados, resumoDesignacoes,
} from '../js/chamados-lcr.js';
import {
  CHAVES_ESTATISTICAS, frequenciaSacramental, gruposSemMarcacao, historicoSacramental, limparCorpoCrescimento,
  normalizarDocCrescimento, participantesAdultos, participantesJovens, progressoQualificacao, renovacaoNaAgenda,
  renovacoesAgendar, resumoQualificacao, resumoRecomendacoes, resumoRenovacoes, tendenciaPorGrupo,
} from '../js/crescimento-lcr.js';
import { gerar } from '../js/demo-dados.js';
import { criarServidor } from '../js/demo-servidor.js';
import {
  TIPOS_DOMINGO, chavePessoa, ehDomingo, estadoDaVaga, grupoAuto, indiceDoQuadro, membroDaChave, nomeNatural,
} from '../js/discursos-regras.js';

const HOJE = '2026-10-12';
const DATAS = ['2026-10-12', '2026-10-11', '2026-12-28', '2027-01-01', '2026-03-31', '2026-07-05'];

test('a carga é a mesma para o mesmo dia (dá para ensaiar)', () => {
  assert.deepEqual(gerar(HOJE), gerar(HOJE));
  for (const d of DATAS) assert.doesNotThrow(() => gerar(d), d);
});

test('contatos só fictícios: telefone 90000 e e-mail example.com', () => {
  for (const d of DATAS) {
    const { roster } = gerar(d).membros;
    for (const m of roster) {
      assert.ok(m.telefone === '' || /^\(63\) 90000-\d{4}$/.test(m.telefone) || m.telefone === '9000-0012', m.telefone);
      assert.ok(m.email === '' || m.email.endsWith('@example.com'), m.email);
    }
  }
  const textos = JSON.stringify(gerar(HOJE));
  for (const tel of textos.match(/\(\d\d\) \d{4,5}-\d{4}/g) || []) assert.ok(tel.includes('90000'), tel);
});

test('a história é uma só: quem tem entrevista, discurso ou ajuste está no quadro', () => {
  for (const d of DATAS) {
    const { colecoes, membros } = gerar(d);
    const nomes = new Set(membros.roster.map(m => m.name));
    for (const e of colecoes.agenda) assert.ok(nomes.has(e.membro), e.membro);
    const indice = indiceDoQuadro(membros.roster, []);
    for (const s of colecoes.sacramentais) {
      for (const n of [1, 2, 3]) {
        const nome = s['orador' + n];
        if (!nome || s['orador' + n + 'Fora']) continue;
        assert.ok(membroDaChave(chavePessoa(nome), indice), `${s.data} ${n}º: ${nome}`);
        assert.equal(s['orador' + n + 'Chave'], chavePessoa(nome));
      }
    }
    for (const o of colecoes.oradores) assert.ok(membroDaChave(o.chave, indice), o.nome);
    for (const id of membros.saidos) assert.ok(membros.roster.some(m => m.id === id));
  }
});

test('cada domingo é domingo, uma vez só, com tipo válido', () => {
  for (const d of DATAS) {
    const sac = gerar(d).colecoes.sacramentais;
    const datas = sac.map(s => s.data);
    assert.equal(new Set(datas).size, datas.length, 'domingo repetido');
    for (const s of sac) {
      assert.ok(ehDomingo(s.data), s.data);
      assert.ok(!s.tipo || Object.prototype.hasOwnProperty.call(TIPOS_DOMINGO, s.tipo), s.tipo);
    }
    assert.ok(sac.some(s => s.tipo === 'jejum'), 'nenhum domingo de jejum');
  }
});

test('os próximos domingos mostram todos os estados de vaga', () => {
  const sac = gerar(HOJE).colecoes.sacramentais.filter(s => s.data >= HOJE);
  const estados = new Set(sac.flatMap(s => [1, 2, 3].map(n => estadoDaVaga(s, n, HOJE))));
  for (const e of ['aceito', 'convidado', 'recusou', 'a-convidar', 'fora', 'dispensada', 'vazia']) assert.ok(estados.has(e), e);
});

test('o quadro tem gente de todos os grupos do rodízio', () => {
  const grupos = new Set(gerar(HOJE).membros.roster.map(m => grupoAuto(m, HOJE)));
  for (const g of ['primaria', 'rapazes', 'mocas', 'ss', 'quorum']) assert.ok(grupos.has(g), g);
});

test('os chamados fictícios: gente do quadro, o bispado de sempre, vagos, a designar e um personalizado', () => {
  for (const d of DATAS) {
    const { chamados: doc, membros, colecoes } = gerar(d);
    // o documento é o que a importação grava: passa inteiro pela limpeza do servidor
    const limpo = limparDocumentoChamados(doc);
    assert.equal(limpo.erro, undefined, d);
    assert.deepEqual(limpo.doc, { chamados: doc.chamados, relatorio: doc.relatorio }, d);
    assert.equal(doc.relatorio.data, d);
    assert.ok(doc.atualizadoEm.startsWith(d));
    const nomes = new Set(membros.roster.filter(m => !membros.saidos.includes(m.id)).map(m => m.name));
    for (const c of doc.chamados.filter(c => c.nome)) {
      assert.ok(nomes.has(c.nome), c.nome);
      assert.ok(ehDomingo(c.apoiado) && c.apoiado <= d, `${c.chamado}: ${c.apoiado}`);
    }
    // os nomes do bispado (entrada, convites, atas) já conferem com o relatório
    assert.ok(compararBispado(doc.chamados, colecoes.bispado[0].nomes).every(b => b.estado === 'igual'), d);
    const r = resumoChamados(doc.chamados);
    assert.ok(r.vagos >= 5 && r.preenchidos >= 15, JSON.stringify(r));
    assert.equal(r.aDesignar, 2);
    assert.ok(doc.chamados.some(c => c.personalizado && c.nome));
    // um a designar já com a designação marcada na Agenda, o outro por agendar
    const des = resumoDesignacoes(doc.chamados, colecoes.agenda);
    assert.deepEqual([des.total, des.marcadas, des.feitas], [2, 1, 0], d);
    // e o "Sem chamado" tem quem mostrar
    assert.ok(membrosSemChamado(membros.roster.filter(m => !membros.saidos.includes(m.id)), doc.chamados).length >= 5);
  }
  assert.doesNotMatch(JSON.stringify(gerar(HOJE).chamados), /Palmas|telefone|email|nascimento/i);
});

test('a agenda cobre os estados da entrevista e do convite', () => {
  const ag = gerar(HOJE).colecoes.agenda;
  for (const st of ['pendente', 'agendada', 'realizada', 'nao-realizada']) assert.ok(ag.some(e => e.status === st), st);
  assert.ok(ag.some(e => e.confirmacao === 'confirmado'));
  assert.ok(ag.some(e => e.confirmacao === 'reagendar' && e.sugestaoData));
  assert.ok(ag.some(e => e.convidadoEm && !e.confirmacao), 'convite sem resposta');
  assert.ok(ag.some(e => e.sigiloso) && ag.some(e => e.acompanhar));
  assert.ok(ag.some(e => e.data === HOJE), 'entrevista hoje');
});

// ---------- a aba Vamos crescer a Ala ----------
const ativosDe = membros => membros.roster.filter(m => !membros.saidos.includes(m.id));
const validas = l => l.filter(p => p.situacao === 'ativa' || p.situacao === 'para-vencer').length;

test('Vamos crescer a Ala: o documento fictício é o que a importação gravaria', () => {
  for (const d of DATAS) {
    const { crescimento: doc } = gerar(d);
    assert.deepEqual(normalizarDocCrescimento(doc), doc, d);
    const pub = doc.publico, pri = doc.privado;
    // cada seção volta igual da limpeza do servidor (nada fora do formato)
    for (const t of Object.values(pub.trimestral)) {
      assert.deepEqual(limparCorpoCrescimento({ publico: { trimestral: t } }).parcial.publico.trimestral, t, d);
    }
    const r = limparCorpoCrescimento({
      publico: { estatisticas: pub.estatisticas, recomendacoes: pub.recomendacoes, frequenciaClasses: pub.frequenciaClasses, historicoSacramental: pub.historicoSacramental },
      privado: { recomendacoesPessoas: pri.recomendacoesPessoas, portadoresAtivosDizimistas: pri.portadoresAtivosDizimistas, participantes: pri.participantes },
    });
    assert.equal(r.erro, undefined, d);
    assert.deepEqual(r.parcial.publico.estatisticas, pub.estatisticas);
    assert.deepEqual(r.parcial.publico.frequenciaClasses, pub.frequenciaClasses);
    assert.deepEqual(r.parcial.privado.recomendacoesPessoas, pri.recomendacoesPessoas);
    // três trimestres já encerrados, com as 26 linhas
    const chaves = Object.keys(pub.trimestral);
    assert.equal(chaves.length, 3, d);
    for (const k of chaves) {
      const t = pub.trimestral[k];
      assert.deepEqual(t.linhas.map(l => l.n), Array.from({ length: 26 }, (_, i) => i + 1));
      assert.ok(t.data <= d, `${k}: ${t.data}`);
      assert.ok(`${t.ano}-${String(t.trimestre * 3).padStart(2, '0')}` < d.slice(0, 7), `${k} ainda não acabou em ${d}`);
    }
    // as Estatísticas somam: o total, os adultos, os homens adultos e os jovens
    const v = pub.estatisticas.valores;
    assert.deepEqual(Object.keys(v).sort(), [...CHAVES_ESTATISTICAS].sort());
    assert.equal(v.homens + v.mulheres + v.rapazes + v.mocas + v.criancasPrimaria + v.criancas0a2, v.totalMembros);
    assert.equal(v.adultosCasados + v.adultosSolteiros36 + v.jas, v.adultos);
    assert.equal(v.sumosSacerdotes + v.elderes + v.elderesPerspectiva, v.homens);
    assert.equal(v.sacerdotes + v.mestres + v.diaconos, v.rapazes);
    assert.equal(v.guardias + v.mensageiras + v.edificadoras, v.mocas);
    // as listas e o que se diz delas: o resumo público, a linha 2, os investidos e os jovens da ala
    for (const tipo of ['adultos', 'jovens']) {
      const l = pri.recomendacoesPessoas[tipo];
      assert.deepEqual(pub.recomendacoes[tipo], resumoRecomendacoes(l, { tipo, data: pub.recomendacoes[tipo].data, contagem: l.length }));
    }
    const ultimo = pub.trimestral[chaves.at(-1)];
    assert.deepEqual([ultimo.linhas[1].real, ultimo.linhas[1].potencial], [validas(pri.recomendacoesPessoas.adultos), v.adultosInvestidos]);
    assert.equal(v.investidosComRecomendacao + v.investidosSemRecomendacao, pri.recomendacoesPessoas.adultos.length);
    assert.equal(pri.recomendacoesPessoas.jovens.length, v.rapazes + v.mocas);
  }
});

test('Vamos crescer a Ala: quem aparece com nome está no quadro e é quem a Agenda conhece', () => {
  for (const d of DATAS) {
    const { crescimento: doc, membros, colecoes, chamados } = gerar(d);
    const ativos = ativosDe(membros);
    const nomes = new Set(ativos.map(m => m.name));
    const pri = doc.privado, pub = doc.publico;
    // só sai nome na tela nas "Renovações a agendar": todos do quadro (o resto da ala, nunca)
    for (const tipo of ['adultos', 'jovens']) {
      const lista = renovacoesAgendar(pri.recomendacoesPessoas[tipo], { hoje: d });
      assert.ok(lista.length > 0, `${d} ${tipo}`);
      for (const p of lista) assert.ok(nomes.has(p.nome), `${d}: ${p.nome}`);
      assert.equal(new Set(pri.recomendacoesPessoas[tipo].map(p => p.nome)).size, pri.recomendacoesPessoas[tipo].length, 'nome repetido');
    }
    // a Agenda tem uma renovação marcada e uma feita depois do relatório
    const datas = { adultos: pub.recomendacoes.adultos.data, jovens: pub.recomendacoes.jovens.data };
    const r = resumoRenovacoes(pri.recomendacoesPessoas, colecoes.agenda, { hoje: d, datas });
    assert.ok(r.marcadas >= 1 && r.feitas >= 1 && r.vencem >= 1 && r.vencidas >= 1, `${d}: ${JSON.stringify(r)}`);
    const patricia = pri.recomendacoesPessoas.adultos.find(p => p.nome === 'Albuquerque Ramos, Patrícia');
    assert.equal(renovacaoNaAgenda(colecoes.agenda, patricia, 'adultos', { desde: datas.adultos }).estado, 'marcada');
    // a parte pública não tem nome nenhum, nem do quadro nem do resto da ala
    const publico = JSON.stringify(pub);
    for (const p of [...pri.recomendacoesPessoas.adultos, ...pri.recomendacoesPessoas.jovens]) assert.ok(!publico.includes(p.nome), p.nome);
    for (const m of membros.roster) assert.ok(!publico.includes(m.name), m.name);
    // os participantes guardados são a conta da importação, com o quadro e os chamados da demonstração
    assert.equal(pri.participantes.adultos, participantesAdultos({ membros: ativos, chamados: chamados.chamados, recomendacoes: pri.recomendacoesPessoas.adultos }).total);
    assert.equal(pri.participantes.jovens, participantesJovens({ membros: ativos, chamados: chamados.chamados, recomendacoes: pri.recomendacoesPessoas.jovens }).total);
  }
});

test('Vamos crescer a Ala: um ano de frequência nas atas e os meses de classes', () => {
  for (const d of DATAS) {
    const { crescimento: doc, colecoes } = gerar(d);
    const pub = doc.publico;
    const membros = pub.estatisticas.valores.totalMembros;
    const f = frequenciaSacramental(colecoes.sacramentais, { membros, hoje: d });
    // os 12 meses com contagem (o corrente pode não ter tido domingo ainda)
    assert.ok(f.porMes.filter(m => m.media != null).length >= 11, d);
    assert.ok(f.porMes.every(m => m.pct == null || (m.pct > 20 && m.pct < 50)), d);
    // a conferência geral segue sem frequência (não há reunião na ala)
    assert.ok(colecoes.sacramentais.filter(s => s.tipo === 'conf-geral').every(s => !('frequencia' in s)));
    // os 4 anos de antes informados; o corrente, calculado das atas
    const ano = +d.slice(0, 4);
    const anos = historicoSacramental(pub.historicoSacramental, f.porAno, ano);
    assert.deepEqual(anos.filter(a => a.fonte === 'informado').map(a => a.ano), [ano - 4, ano - 3, ano - 2, ano - 1]);
    // classes: de 3 a 4 meses de domingos (sem os de conferência), cada grupo só nos dele
    const s = pub.frequenciaClasses.semanas;
    assert.ok(s.length >= 12 && s.every(x => ehDomingo(x.data) && x.data < d && x.registrada), d);
    assert.ok(new Set(s.map(x => x.data.slice(0, 7))).size >= 3, d);
    assert.ok(s.every(x => !('escolaDominicalAdultos' in x.porGrupo && 'sociedadeSocorro' in x.porGrupo)), 'Escola Dominical e Sociedade de Socorro no mesmo domingo');
    const tend = tendenciaPorGrupo(s);
    assert.equal(tend.length, 7, d);
    assert.deepEqual(gruposSemMarcacao(tend), ['escolaDominicalJovens'], d);
    assert.equal(tend.find(t => t.grupo === 'quorumElderes').direcao, 'desce', d);
    // o caminho até duas alas: dois mínimos cumpridos, nenhum ainda para duas
    const pri = doc.privado;
    const prog = progressoQualificacao({ membros, portadoresSM: pri.portadoresAtivosDizimistas, adultosParticipantes: pri.participantes.adultos, jovensParticipantes: pri.participantes.jovens });
    assert.deepEqual(resumoQualificacao(prog), { total: 4, conhecidos: 4, umaAla: 2, duasAlas: 0 }, d);
  }
});

// ---------- o servidor ----------
const armazem = (inicial = {}) => {
  const m = new Map(Object.entries(inicial).map(([k, v]) => [k, structuredClone(v)]));
  return { ler: k => (m.has(k) ? structuredClone(m.get(k)) : null), gravar: (k, v) => m.set(k, structuredClone(v)) };
};
const pedir = (srv, metodo, caminho, corpo) => srv.atender(new Request('http://local' + caminho, {
  method: metodo, headers: { 'Content-Type': 'application/json' }, body: corpo === undefined ? undefined : JSON.stringify(corpo),
}));

test('CRUD comum: cria, lê, altera sem trocar o id, exclui', async () => {
  const srv = criarServidor(armazem());
  const c = await (await pedir(srv, 'POST', '/api/designacoes', { tarefa: 'x', id: 'falso' })).json();
  assert.ok(c.id && c.id !== 'falso' && c.criadoEm);
  const r = await pedir(srv, 'PUT', '/api/designacoes?id=' + c.id, { status: 'concluido', id: 'outro' });
  assert.equal((await r.json()).id, c.id);
  assert.equal((await (await pedir(srv, 'PUT', '/api/designacoes?id=nao-existe', { a: 1 })).status), 404);
  await pedir(srv, 'DELETE', '/api/designacoes?id=' + c.id);
  assert.deepEqual(await (await pedir(srv, 'GET', '/api/designacoes')).json(), []);
});

test('domingo: o POST junta pela data e a trava protege a vaga de outra pessoa', async () => {
  const srv = criarServidor(armazem({ sacramentais: [
    { id: 's1', data: '2026-10-18', orador1: 'Ana Souza', orador1Chave: 'ana souza', orador1Status: 'convidado' }] }));
  const junta = await (await pedir(srv, 'POST', '/api/sacramentais', { data: '2026-10-18', orador1: 'Bruno Lima', primeiroHino: '3' })).json();
  assert.equal(junta.id, 's1');
  assert.equal(junta.orador1, 'Ana Souza');
  assert.deepEqual(junta._descartados, [1]);
  assert.equal(junta.primeiroHino, '3');
  const velho = await (await pedir(srv, 'PUT', '/api/sacramentais?id=s1', { orador1Status: 'aceito', _vaga1: 'gil teste' })).json();
  assert.deepEqual(velho._descartados, [1]);
  const lista = await (await pedir(srv, 'GET', '/api/sacramentais')).json();
  assert.equal(lista.length, 1);
  assert.equal(lista[0].orador1Status, 'convidado');
});

test('membros, notas e erros', async () => {
  const srv = criarServidor(armazem());
  assert.deepEqual(await (await pedir(srv, 'GET', '/api/membros')).json(),
    { movimentacoes: [], saidos: [], adicionados: [], roster: null, rosterAtualizadoEm: null });
  await pedir(srv, 'POST', '/api/membros', { saidos: [3] });
  assert.deepEqual((await (await pedir(srv, 'GET', '/api/membros')).json()).saidos, [3]);
  const n = await (await pedir(srv, 'POST', '/api/notas', { texto: 'oi' })).json();
  assert.ok(n.id.startsWith('n_') && n.criadaEm);
  assert.equal((await pedir(srv, 'GET', '/api/nada')).status, 404);
  const torto = await srv.atender(new Request('http://local/api/agenda', { method: 'POST', body: '{' }));
  assert.equal(torto.status, 400);
});

test('chamados: um documento só, trocado inteiro, com a limpeza do servidor', async () => {
  const srv = criarServidor(armazem(), { agora: () => '2026-10-15T12:00:00.000Z' });
  assert.deepEqual(await (await pedir(srv, 'GET', '/api/chamados')).json(), { chamados: [], relatorio: null, atualizadoEm: null });
  const bispo = { org: 'Bispado', grupo: '', chamado: 'Bispo', nome: 'Exemplo, Bruno', apoiado: '2026-09-13', designado: true, personalizado: false };
  const r = await (await pedir(srv, 'POST', '/api/chamados', {
    chamados: [{ ...bispo, telefone: '(63) 90000-0001' }, { org: 'Bispado', chamado: 'Secretário da Ala' }],
    relatorio: { ala: 'Ala Exemplo 9', unidade: '000009', estaca: 'Estaca Exemplo Brasil', data: '2026-10-14' },
  })).json();
  assert.deepEqual(r, { ok: true, total: 2, atualizadoEm: '2026-10-15T12:00:00.000Z' });
  const doc = await (await pedir(srv, 'GET', '/api/chamados')).json();
  assert.deepEqual(doc.chamados[0], bispo);   // sem o telefone
  assert.equal(doc.chamados[1].nome, '');
  assert.equal(doc.relatorio.data, '2026-10-14');
  assert.equal(doc.atualizadoEm, '2026-10-15T12:00:00.000Z');
  // o relatório novo substitui o anterior inteiro; o torto não grava nada
  await pedir(srv, 'POST', '/api/chamados', { chamados: [bispo] });
  assert.deepEqual((await (await pedir(srv, 'GET', '/api/chamados')).json()).chamados, [bispo]);
  const recusado = await pedir(srv, 'POST', '/api/chamados', { chamados: [{ ...bispo, apoiado: '13 set 2026' }] });
  assert.equal(recusado.status, 400);
  assert.match((await recusado.json()).error, /apoiado/);
  assert.deepEqual((await (await pedir(srv, 'GET', '/api/chamados')).json()).chamados, [bispo]);
  assert.equal((await pedir(srv, 'DELETE', '/api/chamados')).status, 405);
});

test('chamados: a carga da demonstração (semear grava "chamados") sai igual pelo GET', async () => {
  const { chamados } = gerar(HOJE);
  const srv = criarServidor(armazem({ chamados }));
  assert.deepEqual(await (await pedir(srv, 'GET', '/api/chamados')).json(), chamados);
});

test('crescimento: a carga da demonstração sai pelo GET, o privado só com a sessão "demo"', async () => {
  const { crescimento } = gerar(HOJE);
  const srv = criarServidor(armazem({ crescimento }));
  assert.deepEqual(await (await pedir(srv, 'GET', '/api/crescimento')).json(), { publico: crescimento.publico });
  // entra como o bispo entra na demonstração (senha "demo") e recebe a lista das recomendações
  const login = await (await pedir(srv, 'POST', '/api/sessao', { papel: 'bispo', senha: 'demo' })).json();
  const comSessao = await srv.atender(new Request('http://local/api/crescimento', { headers: { Authorization: 'Bearer ' + login.token } }));
  assert.deepEqual(await comSessao.json(), crescimento);
});

test('convite: a tela do membro vê só o primeiro nome e responde pela regra do servidor', async () => {
  const { colecoes } = gerar(HOJE);
  const agenda = colecoes.agenda.map((e, i) => ({ id: 'a' + i, ...e }));
  const srv = criarServidor(armazem({ agenda }));
  const i = agenda.findIndex(e => e.status === 'agendada' && !e.confirmacao && !e.sigiloso);
  const visto = await (await pedir(srv, 'GET', '/api/convite?id=a' + i)).json();
  assert.equal(visto.nome, nomeNatural(agenda[i].membro).split(' ')[0]);
  assert.ok(!('obs' in visto) && !('membro' in visto));
  const r = await (await pedir(srv, 'PUT', '/api/convite?id=a' + i, { resposta: 'confirmado' })).json();
  assert.equal(r.confirmacao, 'confirmado');
  const salvo = (await (await pedir(srv, 'GET', '/api/agenda')).json())[i];
  assert.equal(salvo.status, 'agendada');
  const feita = agenda.findIndex(e => e.status === 'realizada');
  assert.equal((await pedir(srv, 'PUT', '/api/convite?id=a' + feita, { resposta: 'confirmado' })).status, 409);
});

// ---------- achados da revisão ----------
import { partesDoNascimento } from '../js/utils.js';

test('domingo de conferência geral sem ata (não há reunião na ala)', () => {
  for (const d of DATAS) {
    for (const s of gerar(d).colecoes.sacramentais.filter(x => x.tipo === 'conf-geral')) {
      assert.deepEqual(Object.keys(s).sort(), ['data', 'tipo'], s.data);
    }
  }
});

test('eventos do calendário fictício nunca no domingo', () => {
  for (const d of DATAS) for (const e of gerar(d).colecoes.eventos_extras) assert.ok(!ehDomingo(e.data), e.data + ' ' + e.txt);
});

test('nascimento sempre uma data que existe (nada de 29/02 em ano comum)', () => {
  for (let i = 0; i < 366 * 3; i += 1) {
    const d = new Date(2027, 0, 1 + i);
    const dk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    for (const m of gerar(dk).membros.roster) {
      const p = partesDoNascimento(m.nascimento);
      assert.ok(p, m.nascimento);
      const t = new Date(p.a, p.m - 1, p.d);
      assert.equal(t.getDate(), p.d, `${dk}: ${m.nascimento}`);
    }
  }
});

test('convite: resposta sempre no passado e depois do envio', () => {
  for (const d of DATAS) {
    for (const e of gerar(d).colecoes.agenda.filter(x => x.confirmadoEm)) {
      assert.ok(e.confirmadoEm.slice(0, 10) < d, `${d} ${e.membro}: ${e.confirmadoEm}`);
      assert.ok(!e.convidadoEm || e.convidadoEm < e.confirmadoEm, e.membro);
    }
  }
});
