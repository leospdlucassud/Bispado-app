// =============================================
// IMPORTAÇÃO DO PDF DE MEMBROS (LCR)
// =============================================
import { switchTab } from './app.js';
import { ALA } from './config.js';
import { NOMES_DOS_PDFS, abaDoPdf, tipoDePdfLcr } from './crescimento-lcr.js';
import { MEMBROS, setMembros } from './dados-membros.js';
import { EM_DEMO } from './demo.js';
import { detectarAlaNoPdf, lerPdfMembros } from './membros-lcr.js';
import { API_MEMBROS, MEMBROS_SAIDOS, MOVIMENTACOES, movimentacoesCarregadas, renderMembros, setMembrosSaidos, setRosterAtualizado } from './membros.js';
import { abrirModal, fecharModal } from './ui.js';
import { toast } from './usuario.js';
import { MESES_PT, carregarScript, esc, norm } from './utils.js';

export const PDFJS_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
export const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// Integridade do pdf.min.js no CDN: se o arquivo for trocado lá, o navegador
// recusa. (O worker é carregado pelo próprio pdf.js e não aceita integrity.)
const PDFJS_INTEGRIDADE = 'sha384-/1qUCSGwTur9vjf/z9lmu/eCUYbpOTgSjmpbMQZ1/CtX2v/WcAIKqRv+U1DUCG6e';
export async function carregarPdfJs() {
  if (window.pdfjsLib) return window.pdfjsLib;
  try { await carregarScript(PDFJS_SRC, { integrity: PDFJS_INTEGRIDADE }); }
  catch (e) { throw new Error('Não foi possível carregar o leitor de PDF. Verifique a conexão.'); }
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  return window.pdfjsLib;
}

// norm e MESES_PT moram em utils.js, e a leitura do PDF em membros-lcr.js (sem
// DOM, para os testes); seguem exportados daqui para quem já importa
export { MESES_PT, norm };
export {
  RE_ACENTO, RE_DATA, RE_EMAIL, RE_LIXO, RE_TEL, detectarAlaNoPdf, extrairLinhas, formatarTelefone,
  idadeDeNascimento, juntarNome, parsearPdfMembros,
} from './membros-lcr.js';

// O PDF que não é a Lista de Membros com texto não chega ao leitor (tipoDePdfLcr,
// de crescimento-lcr.js: o tipoDePdf de chamados-lcr.js mais os relatórios da
// aba Vamos crescer a Ala). O "Microsoft Print to PDF" do Windows grava a página
// como desenho — letra por letra em traços, sem nenhum texto: nada no navegador
// lê isso (só OCR). O "Salvar como PDF" do navegador mantém o texto.
function avisoDaImportacao(titulo, html, extra = '') {
  document.getElementById('modal-import-content').innerHTML = `
    <div style="text-align:center;padding:10px">
      <div style="font-size:32px;margin-bottom:10px">⚠️</div>
      <div style="--c:#e8b040;font-size:14px;font-weight:700;margin-bottom:10px">${esc(titulo)}</div>
      <div style="color:var(--text-corpo);font-size:13px;line-height:1.6;text-align:left">${html}</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:16px">${extra}
        <button data-act="fechar" style="background:rgba(74,106,138,.25);color:var(--text-corpo);border:none;border-radius:10px;padding:10px 20px;cursor:pointer">Fechar</button>
      </div>
    </div>`;
}

const AVISO_DO_TIPO = {
  'sem-texto': () => avisoDaImportacao('Este PDF não tem texto', `
    <p>Ele foi salvo como imagem — é o que acontece ao imprimir pela impressora <strong>Microsoft Print to PDF</strong> —, e não há nomes para ler nele.</p>
    <p style="margin-top:8px">Gere de novo pelo LCR: abra a <strong>Lista de Membros</strong>, toque em <strong>Imprimir</strong> e, no destino da impressão, escolha <strong>Salvar como PDF</strong> (não “Microsoft Print to PDF”).</p>`),
  chamados: () => avisoDaImportacao('Este é o relatório Organizações e Chamados', `
    <p>O PDF escolhido é o relatório <strong>Organizações e Chamados</strong> do LCR. Ele se importa na aba <strong>Chamados</strong>, pelo botão <strong>📄 Importar PDF do LCR</strong>.</p>
    <p style="margin-top:8px">Aqui entra a <strong>Lista de Membros</strong>.</p>`,
    `<button data-act="ir-chamados" style="background:#fb923c;color:#0d1b2a;border:none;border-radius:10px;padding:10px 20px;font-weight:700;cursor:pointer">Ir para Chamados</button>`),
  // lerPdfMembros recusa: com o Endereço e sem as colunas, o endereço iria para o e-mail
  'sem-cabecalho': () => avisoDaImportacao('O cabeçalho da lista não foi reconhecido', `
    <p>Este PDF tem a coluna <strong>Endereço</strong>, mas os nomes das colunas não são os que o app conhece (<strong>Nome</strong>, <strong>Sexo</strong>, <strong>Idade</strong>…). Sem eles não dá para separar o endereço dos outros dados — e o endereço não pode ir para o quadro.</p>
    <p style="margin-top:8px">Gere de novo pelo LCR em <strong>português</strong>: <strong>Lista de Membros</strong> → <strong>Imprimir</strong> → <strong>Salvar como PDF</strong>.</p>`),
};

// Os relatórios da aba Vamos crescer a Ala (recomendações, frequência às
// classes…) têm "Nome | Sexo" no cabeçalho, como a Lista de Membros: sem este
// aviso, a lista das recomendações (só quem tem recomendação) substituiria o quadro.
const avisoDoCrescimento = tipo => avisoDaImportacao(`Este é o relatório ${NOMES_DOS_PDFS[tipo]}`, `
    <p>O PDF escolhido é o relatório <strong>${esc(NOMES_DOS_PDFS[tipo])}</strong> do LCR. Ele se importa na aba <strong>Vamos crescer a Ala</strong>, pelo botão <strong>📄 Importar PDF do LCR</strong>.</p>
    <p style="margin-top:8px">Aqui entra a <strong>Lista de Membros</strong>.</p>`,
  `<button data-act="ir-crescimento" style="background:#a3e635;color:#0d1b2a;border:none;border-radius:10px;padding:10px 20px;font-weight:700;cursor:pointer">Ir para Vamos crescer a Ala</button>`);

export async function importarPdfMembros(input) {
  const arquivo = input.files && input.files[0];
  input.value = '';
  if (!arquivo) return;
  // o PDF do LCR tem os nomes de verdade: não entram na demonstração
  if (EM_DEMO) { toast('Na demonstração, a importação do LCR fica desligada — o quadro de membros é fictício'); return; }

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

    // PDF sem texto ou de outra aba (abaDoPdf: os chamados, os relatórios da
    // aba Vamos crescer a Ala): diz o que fazer, em vez do "nenhum membro
    // reconhecido" ou de ler a lista errada (o resto vai ao leitor, que decide)
    const tipo = tipoDePdfLcr(paginas);
    const aba = abaDoPdf(tipo);
    if (tipo === 'sem-texto') { AVISO_DO_TIPO['sem-texto'](); return; }
    if (aba === 'chamados') { AVISO_DO_TIPO.chamados(); return; }
    if (aba === 'crescimento') { avisoDoCrescimento(tipo); return; }

    const leitura = lerPdfMembros(paginas);
    if (leitura.semCabecalho) { AVISO_DO_TIPO['sem-cabecalho'](); return; }
    if (!leitura.membros.length) throw new Error('Nenhum membro reconhecido. Confirme que é a "Lista de Membros" exportada do LCR.');
    mostrarPreviaImportacao(leitura.membros, detectarAlaNoPdf(paginas), doc.numPages, leitura);
  } catch (e) {
    document.getElementById('modal-import-content').innerHTML = `
      <div style="text-align:center;padding:10px">
        <div style="font-size:32px;margin-bottom:10px">⚠️</div>
        <div style="--c:#e05555;font-size:14px;margin-bottom:8px">Não foi possível importar</div>
        <div style="color:var(--text2);font-size:12px;line-height:1.6">${(e.message||e).toString().replace(/</g,'&lt;')}</div>
        <button data-act="fechar" style="margin-top:16px;background:rgba(74,106,138,.25);color:var(--text-corpo);border:none;border-radius:10px;padding:10px 20px;cursor:pointer">Fechar</button>
      </div>`;
  }
}

export let IMPORT_PENDENTE = null;

// leitura: o resto do que lerPdfMembros devolve (contagem, endereco, repetidos)
export function mostrarPreviaImportacao(lidos, ala, nPaginas, { contagem = null, endereco = false, repetidos = 0 } = {}) {
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
      <summary style="cursor:pointer;--c:${cor};font-size:13px;font-weight:700">${titulo}: ${itens.length}</summary>
      <div style="margin-top:8px;max-height:150px;overflow-y:auto;font-size:11px;color:var(--text-corpo);line-height:1.7">
        ${itens.slice(0,80).map(fmt).join('')}
        ${itens.length > 80 ? `<div style="opacity:.6">…e mais ${itens.length-80}</div>` : ''}
      </div>
    </details>`;

  const avisoAla = ala && norm(ala.nome) !== norm(ALA)
    ? `<div style="background:rgba(232,176,64,.12);border:1px solid rgba(232,176,64,.35);border-radius:8px;padding:8px 10px;font-size:11px;--c:#e8b040;margin-bottom:10px">
         O PDF é da <strong>${esc(ala.nome)}</strong>, mas o painel está configurado como <strong>${esc(ALA)}</strong>. Confira antes de aplicar.
       </div>` : '';

  // O LCR fecha a lista com "Contagem: N". Lido a menos, alguém ficaria de fora
  // do quadro (e cairia em "Ausentes no PDF") sem nenhum erro aparente.
  const confere = contagem != null && contagem === lidos.length;
  const avisoContagem = contagem != null && !confere
    ? `<div style="background:rgba(232,176,64,.12);border:1px solid rgba(232,176,64,.35);border-radius:8px;padding:8px 10px;font-size:11px;--c:#e8b040;margin-bottom:10px">
         O PDF diz <strong>Contagem: ${contagem}</strong>, mas foram lidos <strong>${lidos.length}</strong> membros.
         ${repetidos ? `${repetidos === 1 ? 'Um nome aparece' : `${repetidos} nomes aparecem`} duas vezes no PDF e ${repetidos === 1 ? 'ficou' : 'ficaram'} uma vez só.` : ''}
         Confira os novos e os ausentes antes de aplicar.
       </div>` : '';

  document.getElementById('modal-import-content').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <h3 style="--c:#c9a84c;font-size:16px">📄 Conferir importação</h3>
      <span data-act="fechar" style="cursor:pointer;color:var(--text3);font-size:20px">✕</span>
    </div>
    ${avisoAla}
    ${avisoContagem}
    <div style="font-size:12px;color:var(--text2);margin-bottom:12px">
      <strong style="color:var(--text-corpo)">${lidos.length}</strong> membros lidos em ${nPaginas} páginas${confere ? ' (confere com a contagem do LCR)' : ''}${ala ? ` · ${esc(ala.nome)} (${esc(ala.unidade)})` : ''}
      · <strong style="color:var(--text-corpo)">${lidos.filter(m=>m.telefone).length}</strong> com telefone
      · <strong style="color:var(--text-corpo)">${lidos.filter(m=>m.email).length}</strong> com e-mail
    </div>
    ${bloco('#34d399','Novos membros', novos, m => `<div>+ ${esc(m.name)} <span style="opacity:.6">(${m.gender}, ${m.age})</span></div>`)}
    ${bloco('#60a5fa','Dados atualizados', atualizados, m => `<div>~ ${esc(m.name)} <span style="opacity:.6">(${m.campos.join(', ')})</span></div>`)}
    ${bloco('#e8b040','Ausentes no PDF', ausentes, m => `<div>− ${esc(m.name)}</div>`)}
    <div style="font-size:11px;color:var(--text2);background:rgba(255,255,255,.03);border-radius:8px;padding:8px 10px;margin-bottom:14px;line-height:1.6">
      O quadro de membros será substituído pelo conteúdo do PDF. Movimentações e histórico são preservados.
      ${endereco ? '<br>A coluna <strong>Endereço</strong> do PDF é ignorada: o endereço não é guardado.' : ''}
      ${ausentes.length ? '<br><strong style="--c:#e8b040">Os ausentes serão removidos da lista ativa</strong> — registre a saída antes se quiser manter o histórico.' : ''}
    </div>
    <div style="display:flex;gap:8px">
      <button data-act="aplicar" style="flex:1;background:#c9a84c;color:#0d1b2a;border:none;border-radius:10px;padding:11px;font-weight:700;cursor:pointer;font-size:13px">Aplicar</button>
      <button data-act="fechar" style="background:rgba(74,106,138,.25);color:var(--text2);border:none;border-radius:10px;padding:11px 18px;cursor:pointer;font-size:13px">Cancelar</button>
    </div>`;
}

export async function aplicarImportacao() {
  if (!IMPORT_PENDENTE) return;
  const { lidos } = IMPORT_PENDENTE;

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
    else if (el.dataset.act === 'ir-chamados') { fecharModal('modal-import'); switchTab('chamados'); }
    else if (el.dataset.act === 'ir-crescimento') { fecharModal('modal-import'); switchTab('crescimento'); }
  });
}
ligarImportMembros();
