// =============================================
// IMPORTAÇÃO DO PDF DE MEMBROS (LCR)
// =============================================
import { ALA } from './config.js';
import { MEMBROS, setMembros } from './dados-membros.js';
import { API_MEMBROS, MEMBROS_SAIDOS, MOVIMENTACOES, movimentacoesCarregadas, renderMembros, setMembrosSaidos, setRosterAtualizado } from './membros.js';
import { abrirModal, fecharModal } from './ui.js';
import { toast } from './usuario.js';
import { esc } from './utils.js';

export const PDFJS_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
export const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

export function carregarPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  return new Promise((ok, erro) => {
    const s = document.createElement('script');
    s.src = PDFJS_SRC;
    s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER; ok(window.pdfjsLib); };
    s.onerror = () => erro(new Error('Não foi possível carregar o leitor de PDF. Verifique a conexão.'));
    document.head.appendChild(s);
  });
}

export const norm = s => (s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/\s+/g,' ').trim();

// Agrupa os trechos do PDF em linhas (por Y). Guarda a largura para saber
// quando dois trechos vizinhos formam a mesma palavra (acentos vêm separados).
export function extrairLinhas(itens) {
  const linhas = [];
  itens.forEach(it => {
    if (!it.str || !it.str.trim()) return;
    const x = it.transform[4], y = Math.round(it.transform[5]);
    let ln = linhas.find(l => Math.abs(l.y - y) <= 3);
    if (!ln) { ln = { y, partes: [] }; linhas.push(ln); }
    // transform[0] ≈ corpo da fonte; pdf.js não preenche width neste PDF
    ln.partes.push({ x, fs: Math.abs(it.transform[0]) || 10, txt: it.str });
  });
  linhas.forEach(l => l.partes.sort((a,b) => a.x - b.x));
  return linhas.sort((a,b) => b.y - a.y);
}

export const RE_LIXO   = /lista de membros|somente para uso da igreja|intellectual reserve|direitos reservados|^nome$|^sexo$|^idade$|^data de$|^nascimento$|^n[úu]mero de$|^telefone$|^e-?mail$/i;

// Acentos vêm como trechos separados. Sem width, estima-se a largura pelo corpo
// da fonte para decidir se dois trechos vizinhos têm um espaço entre eles.
export const RE_ACENTO = /^[áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ]$/;

export function juntarNome(partes) {
  let out = '';
  partes.forEach((p, i) => {
    if (i > 0 && !RE_ACENTO.test(p.txt)) {   // acento sempre cola na letra anterior
      const a = partes[i-1];
      const larguraAprox = a.txt.length * a.fs * 0.5;
      if (p.x - (a.x + larguraAprox) > a.fs * 0.18) out += ' ';
    }
    out += p.txt;
  });
  return out.replace(/\s+/g, ' ').trim();
}

export const MESES_PT = { jan:0, fev:1, mar:2, abr:3, mai:4, jun:5, jul:6, ago:7, set:8, out:9, nov:10, dez:11 };

export function idadeDeNascimento(nasc) {
  const m = /^(\d{1,2})\s+([a-zç]{3})\.?\s+(\d{4})$/i.exec(nasc || '');
  if (!m) return 0;
  const mes = MESES_PT[m[2].toLowerCase()];
  if (mes === undefined) return 0;
  const nascimento = new Date(+m[3], mes, +m[1]);
  const hoje = new Date();
  let anos = hoje.getFullYear() - nascimento.getFullYear();
  const dm = hoje.getMonth() - nascimento.getMonth();
  if (dm < 0 || (dm === 0 && hoje.getDate() < nascimento.getDate())) anos--;
  return (anos >= 0 && anos < 130) ? anos : 0;
}

export function formatarTelefone(t) {
  const d = (t || '').replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return d.length >= 8 ? (t || '').trim() : '';
}
export const RE_DATA   = /^\d{1,2}\s+[a-zç]{3}\.?\s+\d{4}$/i;
export const RE_TEL    = /^\(?\d{2}\)?\s*\d{4,5}-?\d{4}$/;
export const RE_EMAIL  = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

// O nome ocupa uma caixa de texto que pode quebrar em várias linhas, enquanto as
// demais colunas ficam centralizadas verticalmente. Por isso os pedaços do nome
// aparecem acima E abaixo da linha que traz o sexo. Cada pedaço é associado à
// linha-âncora verticalmente mais próxima.
export function parsearPdfMembros(paginas) {
  const registros = [];

  paginas.forEach(itens => {
    const linhas = extrairLinhas(itens);

    // A coluna Sexo é a âncora: única com um M ou F isolado.
    let xSexo = null;
    for (const l of linhas) {
      const p = l.partes.find(p => /^[MF]$/.test(p.txt.trim()));
      if (p) { xSexo = p.x; break; }
    }
    if (xSexo == null) return;

    const ancoras = [], soltas = [];

    linhas.forEach(l => {
      const uteis = l.partes.filter(p => !RE_LIXO.test(p.txt.trim()));
      if (!uteis.length) return;
      const esq = uteis.filter(p => p.x <  xSexo - 2);
      const dir = uteis.filter(p => p.x >= xSexo - 2);

      if (dir.some(p => /^[MF]$/.test(p.txt.trim()))) {
        const campos = { sexo:'', idade:'', nasc:'', tel:'', email:'' };
        dir.forEach(p => {
          const t = p.txt.trim();
          if      (/^[MF]$/.test(t))     campos.sexo  = t;
          else if (/^\d{1,3}$/.test(t))  campos.idade = t;
          else if (RE_DATA.test(t))      campos.nasc  = t;
          else if (RE_TEL.test(t))       campos.tel   = t;
          else                           campos.email += t;
        });
        ancoras.push({ y: l.y, campos, pedacos: esq.length ? [{ y: l.y, partes: esq }] : [] });
      } else {
        if (esq.length) soltas.push({ y: l.y, partes: esq });
        if (dir.length) soltas.push({ y: l.y, email: dir.map(p => p.txt.trim()).join('') });
      }
    });

    // cada linha solta pertence à âncora mais próxima
    soltas.forEach(s => {
      let alvo = null, dist = Infinity;
      ancoras.forEach(a => { const d = Math.abs(a.y - s.y); if (d < dist) { dist = d; alvo = a; } });
      if (!alvo || dist > 18) return;
      if (s.email) alvo.campos.email += s.email;
      else alvo.pedacos.push(s);
    });

    ancoras.forEach(a => {
      // pedaços de cima para baixo
      const nome = a.pedacos
        .sort((p, q) => q.y - p.y)
        .map(f => juntarNome(f.partes))
        .join(' ').replace(/\s+/g, ' ').trim();
      registros.push({
        name: nome,
        gender: a.campos.sexo,
        age: parseInt(a.campos.idade, 10) || idadeDeNascimento(a.campos.nasc),
        nascimento: a.campos.nasc,
        telefone: formatarTelefone(a.campos.tel),
        email: a.campos.email.replace(/\s+/g, ''),
      });
    });
  });

  const limpos = registros
    .filter(r => r.name && r.name.length >= 3 && !/^\d+$/.test(r.name))
    .map(r => ({ ...r, email: RE_EMAIL.test(r.email) ? r.email : '' }));

  // remove repetidos, conservando o registro mais completo
  const porNome = new Map();
  limpos.forEach(r => {
    const k = norm(r.name);
    const preenchidos = o => [o.age, o.nascimento, o.telefone, o.email].filter(Boolean).length;
    const atual = porNome.get(k);
    if (!atual || preenchidos(r) > preenchidos(atual)) porNome.set(k, r);
  });
  return [...porNome.values()];
}

export function detectarAlaNoPdf(paginas) {
  for (const itens of paginas) {
    const txt = itens.map(i => i.str).join(' ');
    const m = txt.match(/Lista de Membros\s*(.+?)\s*\((\d+)\)/);
    if (m) return { nome: m[1].trim(), unidade: m[2] };
  }
  return null;
}

export async function importarPdfMembros(input) {
  const arquivo = input.files && input.files[0];
  input.value = '';
  if (!arquivo) return;

  abrirModal('modal-import');
  document.getElementById('modal-import-content').innerHTML =
    '<div class="loading">Lendo o PDF…</div>';

  try {
    const pdfjs = await carregarPdfJs();
    const buf = await arquivo.arrayBuffer();
    const doc = await pdfjs.getDocument({ data: buf }).promise;

    const paginas = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const pg = await doc.getPage(i);
      paginas.push((await pg.getTextContent()).items);
    }

    const lidos = parsearPdfMembros(paginas);
    if (!lidos.length) throw new Error('Nenhum membro reconhecido. Confirme que é a "Lista de Membros" exportada do LCR.');
    mostrarPreviaImportacao(lidos, detectarAlaNoPdf(paginas), doc.numPages);
  } catch (e) {
    document.getElementById('modal-import-content').innerHTML = `
      <div style="text-align:center;padding:10px">
        <div style="font-size:32px;margin-bottom:10px">⚠️</div>
        <div style="color:#e05555;font-size:14px;margin-bottom:8px">Não foi possível importar</div>
        <div style="color:#8eacc8;font-size:12px;line-height:1.6">${(e.message||e).toString().replace(/</g,'&lt;')}</div>
        <button data-act="fechar" style="margin-top:16px;background:rgba(74,106,138,.25);color:#c8d8e8;border:none;border-radius:10px;padding:10px 20px;cursor:pointer">Fechar</button>
      </div>`;
  }
}

export let IMPORT_PENDENTE = null;

export function mostrarPreviaImportacao(lidos, ala, nPaginas) {
  const atuais = new Map(MEMBROS.map(m => [norm(m.name), m]));
  const vistos = new Set();

  const novos = [], atualizados = [];
  lidos.forEach(r => {
    const chave = norm(r.name);
    vistos.add(chave);
    const atual = atuais.get(chave);
    if (!atual) { novos.push(r); return; }
    const mudou = ['age','telefone','email'].filter(c => (atual[c] || '') !== (r[c] || '') && r[c]);
    if (mudou.length) atualizados.push({ ...r, id: atual.id, campos: mudou });
  });
  const ausentes = MEMBROS.filter(m => !vistos.has(norm(m.name)) && !MEMBROS_SAIDOS.includes(m.id));

  IMPORT_PENDENTE = { lidos, novos, atualizados, ausentes, ala };

  const bloco = (cor, titulo, itens, fmt) => !itens.length ? '' : `
    <details style="margin-bottom:8px;background:rgba(255,255,255,.03);border-left:3px solid ${cor};border-radius:8px;padding:8px 10px">
      <summary style="cursor:pointer;color:${cor};font-size:13px;font-weight:700">${titulo}: ${itens.length}</summary>
      <div style="margin-top:8px;max-height:150px;overflow-y:auto;font-size:11px;color:#c8d8e8;line-height:1.7">
        ${itens.slice(0,80).map(fmt).join('')}
        ${itens.length > 80 ? `<div style="opacity:.6">…e mais ${itens.length-80}</div>` : ''}
      </div>
    </details>`;

  const avisoAla = ala && norm(ala.nome) !== norm(ALA)
    ? `<div style="background:rgba(232,176,64,.12);border:1px solid rgba(232,176,64,.35);border-radius:8px;padding:8px 10px;font-size:11px;color:#e8b040;margin-bottom:10px">
         O PDF é da <strong>${esc(ala.nome)}</strong>, mas o painel está configurado como <strong>${esc(ALA)}</strong>. Confira antes de aplicar.
       </div>` : '';

  document.getElementById('modal-import-content').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <h3 style="color:#c9a84c;font-size:16px">📄 Conferir importação</h3>
      <span data-act="fechar" style="cursor:pointer;color:#4a6a8a;font-size:20px">✕</span>
    </div>
    ${avisoAla}
    <div style="font-size:12px;color:#8eacc8;margin-bottom:12px">
      <strong style="color:#c8d8e8">${lidos.length}</strong> membros lidos em ${nPaginas} páginas${ala ? ` · ${esc(ala.nome)} (${esc(ala.unidade)})` : ''}
      · <strong style="color:#c8d8e8">${lidos.filter(m=>m.telefone).length}</strong> com telefone
      · <strong style="color:#c8d8e8">${lidos.filter(m=>m.email).length}</strong> com e-mail
    </div>
    ${bloco('#34d399','Novos membros', novos, m => `<div>+ ${esc(m.name)} <span style="opacity:.6">(${m.gender}, ${m.age})</span></div>`)}
    ${bloco('#60a5fa','Dados atualizados', atualizados, m => `<div>~ ${esc(m.name)} <span style="opacity:.6">(${m.campos.join(', ')})</span></div>`)}
    ${bloco('#e8b040','Ausentes no PDF', ausentes, m => `<div>− ${esc(m.name)}</div>`)}
    <div style="font-size:11px;color:#8eacc8;background:rgba(255,255,255,.03);border-radius:8px;padding:8px 10px;margin-bottom:14px;line-height:1.6">
      O quadro de membros será substituído pelo conteúdo do PDF. Movimentações e histórico são preservados.
      ${ausentes.length ? '<br><strong style="color:#e8b040">Os ausentes serão removidos da lista ativa</strong> — registre a saída antes se quiser manter o histórico.' : ''}
    </div>
    <div style="display:flex;gap:8px">
      <button data-act="aplicar" style="flex:1;background:#c9a84c;color:#0d1b2a;border:none;border-radius:10px;padding:11px;font-weight:700;cursor:pointer;font-size:13px">Aplicar</button>
      <button data-act="fechar" style="background:rgba(74,106,138,.25);color:#8eacc8;border:none;border-radius:10px;padding:11px 18px;cursor:pointer;font-size:13px">Cancelar</button>
    </div>`;
}

export async function aplicarImportacao() {
  if (!IMPORT_PENDENTE) return;
  const { lidos, ala } = IMPORT_PENDENTE;

  // conserva os ids já existentes para não quebrar movimentações e agenda
  const porNome = new Map(MEMBROS.map(m => [norm(m.name), m.id]));
  let proximo = Math.max(0, ...MEMBROS.map(m => m.id || 0)) + 1;

  setMembros(lidos.map(r => ({
    id: porNome.get(norm(r.name)) || proximo++,
    name: r.name,
    gender: r.gender,
    age: r.age,
    nascimento: r.nascimento || '',
    telefone: r.telefone || '',
    email: r.email || '',
  })));

  const ativos = new Set(MEMBROS.map(m => m.id));
  setMembrosSaidos(MEMBROS_SAIDOS.filter(id => ativos.has(id)));

  try {
    // Só manda histórico e saídas se eles vieram mesmo do servidor; o que o
    // corpo não traz, a function preserva (evita apagar dados de verdade).
    const corpo = { adicionados: [], roster: MEMBROS };
    if (movimentacoesCarregadas) { corpo.movimentacoes = MOVIMENTACOES; corpo.saidos = MEMBROS_SAIDOS; }
    const res = await fetch(API_MEMBROS, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    setRosterAtualizado(new Date().toISOString());
  } catch {
    toast('Salvo neste aparelho — sem conexão com o servidor');
  }

  IMPORT_PENDENTE = null;
  fecharModal('modal-import');
  renderMembros();
  toast(`${MEMBROS.length} membros importados`);
}

function ligarImportMembros() {
  // o conteúdo do modal é reescrito em cada etapa (lendo / erro / prévia)
  document.getElementById('modal-import')?.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    if (el.dataset.act === 'fechar') fecharModal('modal-import');
    else if (el.dataset.act === 'aplicar') aplicarImportacao();
  });
}
ligarImportMembros();
