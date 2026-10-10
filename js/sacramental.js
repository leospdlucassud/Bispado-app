// =============================================
// SACRAMENTAL — vistas, ata de cada domingo e gravação dos domingos
// Três vistas na mesma aba: "Próximos domingos" (vagas e convites) e "Rodízio"
// (pessoas por organização) moram em rodizio.js; "Atas por mês" e o formulário
// da ata moram aqui. As regras (datas, vagas, estados) ficam em
// discursos-regras.js, sem DOM.
// =============================================
import { apiFetch, atualizarUltimaSinc, avisarPendente, idProvisorioDo, setSyncStatus } from './api.js';
import { API_SAC, DADOS } from './config.js';
import { MEMBROS } from './dados-membros.js';
import { confirmar } from './dialogo.js';
import {
  CORES_POSICAO, MAX_SEMANAS, ORDEM_TIPOS, POSICOES, ROTULO_ESTADO, TEMPOS_OPCOES, TIPOS_DOMINGO,
  camposAoTrocarOrador, chaveEstrita, chavePessoa, diffCampos, ehDomingo, estadoDaVaga, minutosDaVaga, nomeCurto,
  nomeNatural, partesData, proximoDomingo, proximosDomingos, registroDoDomingo, tipoDe,
} from './discursos-regras.js';
import { inicioColecaoCarregada, renderInicio } from './inicio.js';
import { imprimirAtaSacramental } from './pdf.js';
import {
  abrirEscolhaOrador, abrirFicha, garantirJanela, primeiraVagaAberta, renderPlano, renderRodizio,
} from './rodizio.js';
import { abrirModal, fecharModal } from './ui.js';
import { toast } from './usuario.js';
import { dataLocal, encadearPorChave, esc } from './utils.js';

export let sacCarregado = false;
// api.js marca o carregamento (binding importado é somente-leitura)
export function setSacCarregado(v) { sacCarregado = v; }
// A programação veio de fato do servidor nesta sessão. Sem ela, um domingo
// salvo aqui pode já existir lá: o servidor (e a fila) juntam pela data, sem
// trocar a vaga que outro aparelho já preencheu — a faixa #sac-aviso-carga avisa.
export let sacDoServidor = false;
export function setSacDoServidor(v) { sacDoServidor = v; }
export let sacMes = new Date().getMonth();
export let sacAno = new Date().getFullYear();

// A vista vale enquanto o app está aberto (como o Histórico de Membros, não
// entra no Voltar). Começa em "Próximos domingos".
export let sacVista = 'plano';
const VISTAS = ['plano', 'rodizio', 'atas'];
export function setSacVista(v) {
  if (!VISTAS.includes(v)) return;
  sacVista = v;
  document.querySelectorAll('#sac-vistas .filtro-btn').forEach(b => b.classList.toggle('active', b.dataset.vista === v));
  for (const x of VISTAS) {
    const el = document.getElementById('sac-vista-' + x);
    if (el) el.hidden = x !== v;
  }
  renderAbaSacramental();
}

// Redesenha só a vista que está à mostra
export function renderAbaSacramental() {
  const aviso = document.getElementById('sac-aviso-carga');
  if (aviso) aviso.hidden = !(sacCarregado && !sacDoServidor);
  if (sacVista === 'plano') renderPlano();
  else if (sacVista === 'rodizio') renderRodizio();
  else renderSacramentais();
}


// Gerar domingos do mês
export function getDomingosMes(mes, ano) {
  const domingos = [];
  const d = new Date(ano, mes, 1);
  while (d.getMonth() === mes) {
    if (d.getDay() === 0) domingos.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return domingos;
}

export function formatDateSac(d) {
  const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  return `${d.getDate()} de ${meses[d.getMonth()]}`;
}

// Chave do domingo (AAAA-MM-DD) na hora local — com toISOString, no sábado à
// noite o domingo já aparecia como "HOJE".
export const formatDateKey = d => dataLocal(d);

export const MESES_NOME = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

export function mudarMesSac(dir) {
  sacMes += dir;
  if (sacMes > 11) { sacMes = 0; sacAno++; }
  if (sacMes < 0) { sacMes = 11; sacAno--; }
  renderSacramentais();
}

// "Hoje" e o "Ver →" da busca: vai direto ao mês (mudarMesSac(0) só redesenharia)
export function irParaMesSac(ano, mes) {
  sacAno = ano; sacMes = mes;
  renderSacramentais();
}

export async function carregarSacramentais() {
  try {
    const data = await apiFetch(API_SAC);
    // o Início precisa saber que os domingos vieram de fato: sacCarregado,
    // logo abaixo, fica true mesmo quando a carga falha
    if (Array.isArray(data)) { DADOS.sacramentais = data; setSacDoServidor(true); inicioColecaoCarregada('sacramentais'); }
  } catch { }
  sacCarregado = true;
  renderAbaSacramental();
}

export function getSacPorData(dataKey) {
  if (!DADOS.sacramentais) DADOS.sacramentais = [];
  return registroDoDomingo(DADOS.sacramentais, dataKey);
}

// Campos da ata, na ordem em que a reunião acontece.
// 'hinoEspecial' era o nome antigo do hino intermediário — lido como reserva.
export const ATA_ORDEM = [
  { k:'presidida',        r:'Presidida por' },
  { k:'dirigida',         r:'Dirigida por' },
  { k:'regente',          r:'Regente' },
  { k:'pianista',         r:'Pianista' },
  { k:'reconhecimentos',  r:'Reconhecimentos',        area:true, ph:'Líderes e autoridades presentes' },
  { k:'anuncios',         r:'Anúncios',               area:true },
  { k:'primeiroHino',     r:'Hino inicial',           hino:true },
  { k:'oracaoAbertura',   r:'Oração de abertura' },
  { k:'apoios',           r:'Apoios e desobrigações', area:true },
  { k:'hinoSacramental',  r:'Hino Sacramental',       hino:true },
  { orador:1 },
  { orador:2 },
  { k:'hinoIntermediario',r:'Hino intermediário',     hino:true },
  { orador:3 },
  { k:'hinoFinal',        r:'Hino de encerramento',   hino:true },
  { k:'oracaoEncerramento', r:'Oração de encerramento' },
];

// Lê um campo aceitando os nomes antigos
export function campoAta(sac, k) {
  if (!sac) return '';
  if (k === 'hinoIntermediario') return sac.hinoIntermediario ?? sac.hinoEspecial ?? '';
  return sac[k] ?? '';
}

export const seloVaga = (estado, texto = ROTULO_ESTADO[estado]) =>
  `<span class="selo-vaga selo-vaga-${esc(estado)}">${esc(texto || '')}</span>`;

// ---------- vista "Atas por mês" ----------
export function renderSacramentais() {
  const el = document.getElementById('lista-sacramentais');
  const tit = document.getElementById('sac-mes-titulo');
  if (tit) tit.textContent = `${MESES_NOME[sacMes]} ${sacAno}`;
  if (!el) return;
  // antes da carga, todo domingo pareceria "não programado"
  if (!sacCarregado) { el.innerHTML = '<div class="loading">Carregando…</div>'; return; }

  const domingos = getDomingosMes(sacMes, sacAno);
  if (!domingos.length) { el.innerHTML = '<div class="vazia">Nenhum domingo neste mês</div>'; return; }

  const hoje = formatDateKey(new Date());

  el.innerHTML = domingos.map(dom => {
    const dk = formatDateKey(dom);
    const sac = getSacPorData(dk) || {};
    const isHoje = dk === hoje;
    const isPast = dk < hoje;
    const duplicados = (DADOS.sacramentais || []).filter(s => s && s.data === dk).length;
    const tipo = tipoDe(sac);

    const borderColor = isHoje ? '#e8d080' : isPast ? 'rgba(74,106,138,.3)' : 'rgba(232,208,128,.2)';
    const opacity = isPast ? 'opacity:.7' : '';

    const g = k => campoAta(sac, k);
    // um domingo de jejum ou de conferência, só com o tipo ou a frequência, também
    // conta; "reunião normal" sozinha não é programação (a ata ainda não foi feita)
    const preenchido = !!((sac.tipo && sac.tipo !== 'normal') || sac.frequencia || sac.visitantes || sac.observacoes
      || ATA_ORDEM.some(c => c.k && g(c.k)) || sac.orador1 || sac.orador2 || sac.orador3);

    const statusDot = preenchido
      ? '<span style="width:6px;height:6px;border-radius:50%;background:#34d399;display:inline-block;margin-right:6px" title="Programado"></span>'
      : '<span style="width:6px;height:6px;border-radius:50%;background:#e05555;display:inline-block;margin-right:6px" title="Não programado"></span>';

    const freq = (sac.frequencia || sac.visitantes)
      ? `<span style="color:var(--text2);font-size:11px">👥 ${esc(sac.frequencia||'—')}${sac.visitantes ? ` · ${esc(sac.visitantes)} visit.` : ''}</span>`
      : '';

    const linha = (rot, val, cor) => val
      ? `<div><span style="--c:${cor};font-size:11px">${rot}</span><div style="color:var(--text-corpo)">${esc(val)}</div></div>` : '';

    const orador = n => {
      const reg = { ...sac, data: dk };
      const estado = estadoDaVaga(reg, n, hoje);
      if (estado === 'dispensada') {
        return `<div><span style="--c:${CORES_POSICAO[n]};font-size:11px">${n}º</span><div style="color:var(--text3)">sem discurso neste domingo</div></div>`;
      }
      if (!sac['orador' + n]) return '';
      const selo = estado === 'realizado' ? '' : ' ' + seloVaga(estado);
      return `<div><span style="--c:${CORES_POSICAO[n]};font-size:11px">${n}º Orador · ${minutosDaVaga(sac, n)} min</span>` +
        `<div style="color:var(--text-corpo)">${esc(nomeNatural(sac['orador'+n]))}${sac['tema'+n] ? ` <span style="color:var(--text3)">· ${esc(sac['tema'+n])}</span>` : ''}${selo}</div></div>`;
    };

    return `
    <div class="card" style="border-color:${borderColor};${opacity};margin-bottom:12px;cursor:pointer" data-act="abrir" data-dk="${esc(dk)}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:8px;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          ${statusDot}
          <span style="color:var(--sac);font-weight:700;font-size:14px">${formatDateSac(dom)}</span>
          ${tipo.curto ? `<span class="selo-tipo">${esc(tipo.curto)}</span>` : ''}
          ${isHoje ? '<span class="selo-hoje">HOJE</span>' : ''}
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          ${freq}
          ${preenchido ? `<button class="btn-secondary" style="font-size:11px;padding:3px 9px" data-act="pdf" data-dk="${esc(dk)}">📄 PDF</button>` : ''}
        </div>
      </div>
      ${duplicados > 1 ? `<div class="sac-aviso">Há ${duplicados} registros para este domingo; o app usa o primeiro.</div>` : ''}

      ${preenchido ? `
      ${tipo.resumo && !tipo.vagas ? `<div class="plano-semvagas">${esc(tipo.resumo)}</div>` : ''}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 16px;font-size:12px">
        ${linha('Presidida por', g('presidida'), '#c9a84c')}
        ${linha('Dirigida por',  g('dirigida'),  '#c9a84c')}
        ${linha('Hino inicial',  g('primeiroHino'), '#5b9bd5')}
        ${linha('Hino Sacramental', g('hinoSacramental'), '#5b9bd5')}
        ${orador(1)}
        ${orador(2)}
        ${linha('Hino intermediário', g('hinoIntermediario'), '#f472b6')}
        ${orador(3)}
        ${linha('Hino de encerramento', g('hinoFinal'), '#5b9bd5')}
      </div>
      ${sac.observacoes ? `<div style="margin-top:6px;font-size:11px;color:var(--text2);border-top:1px solid rgba(74,106,138,.2);padding-top:6px">📝 ${esc(sac.observacoes)}</div>` : ''}
      ` : `
      <div style="text-align:center;color:var(--text3);font-size:12px;padding:8px 0">Toque para montar a ata deste domingo</div>
      `}
    </div>`;
  }).join('');
}

// ---------- formulário da ata ----------
let retratoAta = null;   // os campos como estavam ao abrir: o salvar manda só o que mudou
let ataAberta = '';

export function abrirModalSac(dataKey) {
  if (!ehDomingo(dataKey)) { toast('Esta data não é um domingo'); return; }
  const sac = getSacPorData(dataKey) || {};
  const p = partesData(dataKey);
  const titulo = formatDateSac(p.t) + ' de ' + p.a;
  const hoje = dataLocal();

  // sugestões de nome: o quadro de membros (em ordem natural) e quem está no rodízio
  const nomes = [...new Set([
    ...MEMBROS.map(m => nomeNatural(m.name)),
    ...(DADOS.oradores || []).map(o => o.nome),
  ])].filter(Boolean);
  const datalist = `<datalist id="dl-nomes">${nomes.map(n=>`<option value="${esc(n)}">`).join('')}</datalist>`;

  const campo = (c) => {
    const v = esc(campoAta(sac, c.k));
    const ph = c.ph || (c.hino ? 'Nº e título do hino' : '');
    const lista = (!c.area && !c.hino) ? ' list="dl-nomes"' : '';
    return c.area
      ? `<div style="margin-bottom:10px">
           <label style="color:var(--text2);font-size:11px">${c.r}</label>
           <textarea class="form-input" id="ata-${c.k}" rows="2" placeholder="${ph}"
             style="font-size:12px;padding:6px 10px;resize:vertical">${v}</textarea>
         </div>`
      : `<div style="margin-bottom:10px">
           <label style="color:var(--text2);font-size:11px">${c.r}</label>
           <input type="text" class="form-input" id="ata-${c.k}" value="${v}" placeholder="${ph}"${lista}
             style="font-size:12px;padding:6px 10px">
         </div>`;
  };

  const blocoOrador = (n) => {
    const cor = CORES_POSICAO[n];
    const reg = { ...sac, data: dataKey };
    const estado = estadoDaVaga(reg, n, hoje);
    const selo = dataKey >= hoje && sac['orador' + n] ? ' ' + seloVaga(estado) : '';
    const min = minutosDaVaga(sac, n);
    return `
    <div style="background:rgba(255,255,255,.03);border-left:3px solid ${cor};border-radius:8px;padding:10px;margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:8px">
        <span style="--c:${cor};font-size:11px;font-weight:700">🎤 ${n}º ORADOR</span>${selo}
      </div>
      <div style="display:grid;grid-template-columns:1fr auto;gap:8px;align-items:end">
        <div>
          <label style="color:var(--text2);font-size:11px" for="sac-orador${n}">Nome</label>
          <input type="text" class="form-input" id="sac-orador${n}" value="${esc(sac['orador'+n])}" placeholder="Nome" list="dl-nomes" style="font-size:12px;padding:6px 10px">
        </div>
        <button type="button" class="btn-secondary" data-act="sugerir" data-n="${n}">Sugestões</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr auto;gap:8px;margin-top:8px">
        <div>
          <label style="color:var(--text2);font-size:11px" for="sac-tema${n}">Tema</label>
          <input type="text" class="form-input" id="sac-tema${n}" value="${esc(sac['tema'+n])}" placeholder="Tema do discurso" style="font-size:12px;padding:6px 10px">
        </div>
        <div>
          <label style="color:var(--text2);font-size:11px" for="sac-min${n}">Tempo</label>
          <select class="form-select" id="sac-min${n}" style="font-size:12px;padding:6px 8px;width:auto">
            ${[...new Set([...TEMPOS_OPCOES, min])].sort((a, b) => a - b).map(m => `<option value="${m}" ${m === min ? 'selected' : ''}>${m} min</option>`).join('')}
          </select>
        </div>
      </div>
      <label style="display:flex;align-items:center;gap:6px;margin-top:8px;font-size:12px;color:var(--text2)">
        <input type="checkbox" id="sac-fora${n}" ${sac['orador'+n+'Fora'] === true ? 'checked' : ''}> De fora da ala (sumo conselheiro, visitante)
      </label>
    </div>`;
  };

  const tipoAtual = Object.prototype.hasOwnProperty.call(TIPOS_DOMINGO, sac.tipo) ? (sac.tipo || '') : '';

  document.getElementById('modal-sacramental-content').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <h3 style="color:var(--sac);font-size:16px">🕊️ ${titulo}</h3>
      <span data-act="fechar" style="cursor:pointer;color:var(--text3);font-size:20px">✕</span>
    </div>

    ${datalist}

    <div class="form-group">
      <label for="ata-tipo">Tipo do domingo</label>
      <select class="form-select" id="ata-tipo">
        <option value="" ${tipoAtual === '' ? 'selected' : ''}>Não marcado (reunião normal)</option>
        ${ORDEM_TIPOS.map(t => `<option value="${t}" ${tipoAtual === t ? 'selected' : ''}>${esc(TIPOS_DOMINGO[t].rotulo)}</option>`).join('')}
      </select>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;background:rgba(232,208,128,.08);border:1px solid rgba(232,208,128,.2);border-radius:10px;padding:10px;margin-bottom:14px">
      <div>
        <label style="color:var(--text2);font-size:11px">Frequência geral</label>
        <input type="number" min="0" class="form-input" id="ata-frequencia" value="${esc(sac.frequencia)}" placeholder="0" style="font-size:12px;padding:6px 10px">
      </div>
      <div>
        <label style="color:var(--text2);font-size:11px">Visitantes</label>
        <input type="number" min="0" class="form-input" id="ata-visitantes" value="${esc(sac.visitantes)}" placeholder="0" style="font-size:12px;padding:6px 10px">
      </div>
    </div>

    ${ATA_ORDEM.map(c => c.orador ? blocoOrador(c.orador) : campo(c)).join('')}

    <div style="margin-bottom:10px">
      <label style="color:var(--text2);font-size:11px">Observações</label>
      <textarea class="form-input" id="sac-obs" rows="2" placeholder="Ex.: número musical, aviso para a ata" style="font-size:12px;padding:6px 10px;resize:vertical">${esc(sac.observacoes)}</textarea>
    </div>

    <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
      <button data-act="salvar" data-dk="${esc(dataKey)}" style="flex:1;background:#e8d080;color:#0d1b2a;border:none;border-radius:10px;padding:11px;font-weight:700;cursor:pointer;font-size:13px">Salvar</button>
      ${sac.id ? `<button data-act="pdf" data-dk="${esc(dataKey)}" style="background:rgba(232,208,128,.15);color:var(--sac);border:1px solid rgba(232,208,128,.35);border-radius:10px;padding:11px 16px;cursor:pointer;font-size:13px">📄 PDF</button>` : ''}
      ${sac.id ? `<button data-act="excluir" data-id="${esc(sac.id)}" style="background:rgba(224,85,85,.15);--c:#e05555;border:1px solid rgba(224,85,85,.3);border-radius:10px;padding:11px 16px;cursor:pointer;font-size:13px">Excluir</button>` : ''}
      <button data-act="fechar" style="background:rgba(74,106,138,.25);color:var(--text2);border:none;border-radius:10px;padding:11px 16px;cursor:pointer;font-size:13px">Cancelar</button>
    </div>`;
  ataAberta = dataKey;
  retratoAta = lerFormularioAta();
  abrirModal('modal-sacramental');
}

export function lerFormularioAta() {
  const v = id => (document.getElementById(id)?.value || '').trim();
  const obj = { tipo: v('ata-tipo'), frequencia: v('ata-frequencia'), visitantes: v('ata-visitantes') };
  ATA_ORDEM.forEach(c => { if (c.k) obj[c.k] = v('ata-' + c.k); });
  obj.observacoes = v('sac-obs');
  for (const n of POSICOES) {
    obj['orador' + n] = v('sac-orador' + n);
    obj['tema' + n] = v('sac-tema' + n);
    obj['orador' + n + 'Min'] = Number(v('sac-min' + n)) || '';
    obj['orador' + n + 'Fora'] = !!document.getElementById('sac-fora' + n)?.checked;
  }
  return obj;
}

// Nomes digitados nos outros blocos da ata aberta: o seletor de Sugestões não
// oferece quem já está em outra vaga do mesmo domingo
export function chavesNaAta(exceto) {
  return POSICOES.filter(n => n !== exceto)
    .map(n => chavePessoa(document.getElementById('sac-orador' + n)?.value || ''))
    .filter(Boolean);
}

const quemJa = (estado) => estado === 'aceito' ? 'aceitou o' : 'recebeu o convite para o';

export async function salvarSac(dataKey) {
  if (!ehDomingo(dataKey)) { toast('Esta data não é um domingo'); return; }
  const depois = lerFormularioAta();
  const diff = diffCampos(retratoAta || {}, depois);
  if (!Object.keys(diff).length) {
    fecharModal('modal-sacramental');
    toast('Nada foi alterado');
    return;
  }
  if ('hinoIntermediario' in diff) diff.hinoEspecial = diff.hinoIntermediario; // compatibilidade com registros antigos

  const hoje = dataLocal();
  const atual = getSacPorData(dataKey);
  const avisos = [];
  for (const n of POSICOES) {
    if (!('orador' + n in diff)) continue;
    const antes = retratoAta?.['orador' + n] || '';
    // estrita: "Maria de Souza" → "Maria Souza" pode ser outra irmã — conta como troca
    if (chaveEstrita(antes) === chaveEstrita(depois['orador' + n])) continue;
    // outra pessoa na vaga: o convite e a resposta eram da anterior
    Object.assign(diff, camposAoTrocarOrador(n, depois['orador' + n], {
      passado: dataKey < hoje, fora: depois['orador' + n + 'Fora'],
    }));
    if (atual && dataKey >= hoje) {
      const est = estadoDaVaga(atual, n, hoje);
      if (est === 'convidado' || est === 'aceito') {
        avisos.push(`${nomeCurto(atual['orador' + n])} já ${quemJa(est)} ${n}º discurso deste domingo.`);
      }
    }
  }
  if (avisos.length && !await confirmar(avisos.join(' ') + ' Trocar mesmo assim? Lembre-se de avisar.', { okLabel: 'Trocar' })) return;

  fecharModal('modal-sacramental');
  const r = await gravarCamposDomingo(dataKey, diff);
  if (r === 'ok') toast('Programação salva');
}

export async function excluirSac(id) {
  const sac = (DADOS.sacramentais || []).find(s => String(s.id) === String(id));
  const hoje = dataLocal();
  let msg = 'Excluir esta programação?';
  if (sac && sac.data < hoje) msg = 'Excluir esta programação? Os discursos deste domingo saem do histórico do rodízio.';
  else if (sac) {
    const ativos = POSICOES.filter(n => ['convidado', 'aceito'].includes(estadoDaVaga(sac, n, hoje))).length;
    if (ativos) msg = ativos === 1
      ? 'Este domingo tem 1 orador convidado. Excluir apaga também o convite — avise essa pessoa.'
      : `Este domingo tem ${ativos} oradores convidados. Excluir apaga também os convites — avise essas pessoas.`;
  }
  if (!await confirmar(msg, { perigo: true, okLabel: 'Excluir' })) return;
  try { await apiFetch(API_SAC + '?id=' + encodeURIComponent(id), 'DELETE'); atualizarUltimaSinc(); setSyncStatus('ok'); } catch { avisarPendente('exclusão'); }
  if (DADOS.sacramentais) DADOS.sacramentais = DADOS.sacramentais.filter(s => s.id !== id);
  fecharModal('modal-sacramental');
  renderAbaSacramental();
  renderInicio();
}

// ---------- gravação de um domingo ----------
// Toda escrita de domingo (ata, vaga, tipo) passa por aqui: PUT só com os
// campos que mudaram — o servidor junta com o resto (merge raso) — ou POST,
// que o servidor junta no registro da mesma data, se já houver.
// Uma gravação por vez em cada domingo, na ordem dos toques: a segunda de um
// domingo novo espera o POST da primeira e já sai como PUT com o id real.
const emOrdem = encadearPorChave();

export function gravarCamposDomingo(dk, campos) {
  if (!ehDomingo(dk)) { toast('Esta data não é um domingo'); return Promise.resolve(false); }
  if (!DADOS.sacramentais) DADOS.sacramentais = [];
  let reg = getSacPorData(dk);
  // otimista: a tela mostra na hora
  if (reg) Object.assign(reg, campos);
  else { reg = { data: dk, ...campos }; DADOS.sacramentais.push(reg); }
  renderAbaSacramental(); renderInicio();

  // 'ok' | 'pendente' (na fila) | 'descartado' (o servidor manteve, numa vaga,
  // a pessoa que outro aparelho já tinha escolhido) | false (data inválida)
  return emOrdem(dk, async () => {
    // a carga de 30 s pode ter trocado a lista: procura o registro de novo —
    // de preferência um que já tenha id (a gravação anterior deste domingo)
    const vivo = (reg.id && DADOS.sacramentais.find(s => String(s.id) === String(reg.id)))
      || DADOS.sacramentais.find(s => s && s.data === dk && s.id) || getSacPorData(dk) || reg;
    if (vivo !== reg) Object.assign(vivo, campos);   // a escolha aparece no registro que vale
    let resultado = 'ok';
    try {
      // o servidor devolve o registro inteiro, já com o que outro aparelho gravou
      let registro = null;
      if (vivo.id) {
        registro = await apiFetch(API_SAC + '?id=' + encodeURIComponent(vivo.id), 'PUT', campos);
      } else {
        const r = await apiFetch(API_SAC, 'POST', { data: dk, ...campos });
        if (r) {
          // o servidor pode ter juntado com um domingo que já existia lá
          const { _descartados, ...resto } = r;
          registro = resto;
          if (Array.isArray(_descartados) && _descartados.length) {
            toast(`Outro aparelho já tinha escolhido o orador do ${_descartados.join('º e do ')}º discurso deste domingo — veja como ficou.`);
            resultado = 'descartado';
          }
        }
      }
      if (registro && registro.id != null) Object.assign(vivo, registro);
      // a atualização de 30 s pode ter trocado a lista durante a gravação: o
      // registro desta data na lista nova recebe a resposta, sem duplicar
      const naLista = DADOS.sacramentais.find(s => s !== vivo && vivo.id != null && String(s.id) === String(vivo.id));
      if (naLista) Object.assign(naLista, registro || campos);
      else if (!DADOS.sacramentais.includes(vivo)) DADOS.sacramentais.push(vivo);
      // cópias otimistas desta data que ficaram sem id (escolhas feitas enquanto
      // o POST estava em voo) já foram para o servidor por esta cadeia
      if (vivo.id != null) DADOS.sacramentais = DADOS.sacramentais.filter(s => s === vivo || s === naLista || !(s && s.data === dk && !s.id));
      atualizarUltimaSinc(); setSyncStatus('ok');
    } catch (e) {
      // sem sinal: fica na tela e na fila, e sai ao sincronizar
      if (!vivo.id) vivo.id = idProvisorioDo(e);
      if (!DADOS.sacramentais.includes(vivo)) DADOS.sacramentais.push(vivo);
      DADOS.sacramentais = DADOS.sacramentais.filter(s => s === vivo || !(s && s.data === dk && !s.id));
      avisarPendente('programação');
      resultado = 'pendente';
    }
    renderAbaSacramental(); renderInicio();
    return resultado;
  });
}

// ---------- navegação ----------
// Vai até o card de um domingo (itens do Início, "Ver →" da busca)
export function irParaDomingo(dk) {
  if (!ehDomingo(dk)) return;
  let seletor;
  // a vista do plano vai até MAX_SEMANAS; um domingo mais distante (ou passado) abre nas atas
  if (proximosDomingos(dataLocal(), MAX_SEMANAS).includes(dk)) {
    garantirJanela(dk);
    setSacVista('plano');
    seletor = `.plano-domingo[data-dk="${dk}"]`;
  } else {
    setSacVista('atas');
    const p = partesData(dk);
    irParaMesSac(p.a, p.m - 1);
    seletor = `#lista-sacramentais [data-dk="${dk}"]`;
  }
  setTimeout(() => {
    const alvo = document.querySelector(seletor);
    if (!alvo) return;
    alvo.scrollIntoView({ behavior: 'smooth', block: 'center' });
    alvo.classList.add('plano-alvo');
    setTimeout(() => alvo.classList.remove('plano-alvo'), 2000);
  }, 60);
}

// O "+" da aba: depende da vista — e nunca abre a data de hoje (num dia de
// semana, criava um registro que a lista de domingos não mostrava)
export function acaoMaisSacramental() {
  if (sacVista === 'rodizio') abrirFicha(null);
  else if (sacVista === 'atas') abrirModalSac(proximoDomingo(dataLocal()));
  else primeiraVagaAberta();
}

function ligarSacramental() {
  document.getElementById('sac-vistas')?.addEventListener('click', e => {
    const btn = e.target.closest('.filtro-btn[data-vista]');
    if (btn) setSacVista(btn.dataset.vista);
  });

  document.getElementById('sac-nav')?.addEventListener('click', e => {
    if (e.target.closest('[data-act="mes-atual"]')) {
      const h = new Date();
      irParaMesSac(h.getFullYear(), h.getMonth());
      return;
    }
    const btn = e.target.closest('button[data-mes]');
    if (btn) mudarMesSac(Number(btn.dataset.mes));
  });

  document.getElementById('lista-sacramentais')?.addEventListener('click', e => {
    // o PDF fica dentro do card: tratar antes para não abrir o modal junto
    const pdf = e.target.closest('button[data-act="pdf"]');
    if (pdf) { imprimirAtaSacramental(pdf.dataset.dk); return; }
    const card = e.target.closest('[data-act="abrir"]');
    if (card) abrirModalSac(card.dataset.dk);
  });

  document.getElementById('modal-sacramental')?.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    switch (el.dataset.act) {
      case 'fechar':  fecharModal('modal-sacramental'); break;
      case 'salvar':  salvarSac(el.dataset.dk); break;
      case 'pdf':     imprimirAtaSacramental(el.dataset.dk); break;
      case 'excluir': excluirSac(el.dataset.id); break;
      case 'sugerir': abrirEscolhaOrador(ataAberta, Number(el.dataset.n), { modo: 'ata' }); break;
    }
  });
}
ligarSacramental();
