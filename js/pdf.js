// =============================================
// IMPRESSÃO DE ATA EM PDF (jsPDF)
// =============================================
// Ata da reunião sacramental em PDF, na mesma ordem do formulário
import { ALA, DADOS } from './config.js';
import { estadoDaVaga, minutosDaVaga, nomeNatural, tipoDe } from './discursos-regras.js';
import { tipoReuniao } from './reunioes.js';
import { nomeArquivoAta, paragrafos, presentes, rotuloPresenca, textoParaPdf } from './reunioes-regras.js';
import { ATA_ORDEM, campoAta, formatDateSac, getSacPorData } from './sacramental.js';
import { toast } from './usuario.js';
import { carregarScript, dataLocal, formatarData } from './utils.js';

// jsPDF fica no próprio site (vendor/, MIT) e a página só o carrega ao gerar a
// primeira ata. Antes vinha de um CDN no <head> de toda tela — inclusive na do
// convite — e segurava a abertura do app até chegar. O service worker já o
// guarda na instalação (está no ASSETS), então a ata sai também sem sinal.
const JSPDF_SRC = '/vendor/jspdf.umd.min.js';
let preparando = false;
async function geradorPronto() {
  if (window.jspdf) return true;
  // segundo toque enquanto o gerador chega: sem isso, saíam dois PDFs
  if (preparando) return false;
  preparando = true;
  try { await carregarScript(JSPDF_SRC); } catch (e) { /* tratado abaixo */ } finally { preparando = false; }
  if (window.jspdf) return true;
  toast('Não foi possível abrir o gerador de PDF. Verifique a conexão e tente de novo.');
  return false;
}

export async function imprimirAtaSacramental(dataKey) {
  if (!await geradorPronto()) return;
  const sac = getSacPorData(dataKey);
  if (!sac) return toast('Este domingo ainda não foi programado');

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, H = 297, margem = 20, larguraUtil = W - margem * 2;
  const d = new Date(dataKey + 'T12:00:00');

  // Cabeçalho
  doc.setFillColor(13, 27, 42);
  doc.rect(0, 0, W, 35, 'F');
  doc.setTextColor(232, 208, 128);
  doc.setFontSize(8);
  doc.text('A IGREJA DE JESUS CRISTO DOS SANTOS DOS ÚLTIMOS DIAS', W/2, 10, { align:'center' });
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text('Ata da Reunião Sacramental — ' + ALA, W/2, 18, { align:'center' });
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.text(formatDateSac(d) + ' de ' + d.getFullYear(), W/2, 26, { align:'center' });
  // jejum, conferência, Primária: a ata diz que tipo de reunião foi
  const tipo = tipoDe(sac);
  if (sac.tipo && sac.tipo !== 'normal' && tipo.rotulo) {
    doc.setFontSize(9);
    doc.text(tipo.rotulo, W/2, 31, { align:'center' });
  }

  let y = 44;
  doc.setTextColor(30, 30, 30);

  const quebraPagina = (altura) => {
    if (y + altura <= H - 22) return;
    doc.addPage();
    y = 22;
  };

  // Frequência
  doc.setFillColor(245, 240, 226);
  doc.rect(margem, y - 6, larguraUtil, 11, 'F');
  doc.setFontSize(10);
  doc.setFont(undefined, 'bold');
  doc.text('Frequência geral: ' + (sac.frequencia || '____'), margem + 3, y + 1);
  doc.text('Visitantes: ' + (sac.visitantes || '____'), margem + larguraUtil / 2 + 3, y + 1);
  y += 14;

  const linha = (rotulo, valor) => {
    const texto = (valor || '').trim();
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    const larguraRot = doc.getTextWidth(rotulo + ': ');
    doc.setFont(undefined, 'normal');
    const linhas = doc.splitTextToSize(texto || '—', larguraUtil - larguraRot);
    quebraPagina(linhas.length * 5 + 3);
    doc.setFont(undefined, 'bold');
    doc.text(rotulo + ':', margem, y);
    doc.setFont(undefined, 'normal');
    doc.text(linhas, margem + larguraRot, y);
    y += linhas.length * 5 + 3;
  };

  ATA_ORDEM.forEach(c => {
    if (c.orador) {
      const n = c.orador;
      const nome = String(sac['orador' + n] || '').trim();
      const tema = sac['tema' + n] || '';
      // "não haverá este discurso", ou domingo sem oradores: a linha não sai
      if (!nome && (sac['orador' + n + 'Status'] === 'dispensada' || !tipo.vagas)) return;
      // quem respondeu "não poderá" e não foi trocado não discursou: a ata não o lista
      if (!nome || estadoDaVaga({ ...sac, data: dataKey }, n, dataLocal()) === 'recusou') linha(n + 'º Orador', '');
      else linha(`${n}º Orador (${minutosDaVaga(sac, n)} min)`, nomeNatural(nome) + (tema ? ' — ' + tema : ''));
    } else {
      linha(c.r, campoAta(sac, c.k));
    }
  });

  if (sac.observacoes) {
    y += 4;
    quebraPagina(14);
    doc.setDrawColor(200, 190, 165);
    doc.line(margem, y - 4, W - margem, y - 4);
    linha('Observações', sac.observacoes);
  }

  // Assinatura
  quebraPagina(26);
  y += 12;
  doc.setDrawColor(120, 120, 120);
  doc.line(margem, y, margem + 70, y);
  doc.setFontSize(9);
  doc.text('Secretário da Ala', margem, y + 5);

  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text('Gerado pelo Painel do Bispado · ' + ALA + ' — ' + new Date().toLocaleDateString('pt-BR'), W/2, H - 12, { align:'center' });

  doc.save('ata-sacramental-' + dataKey + '.pdf');
}

// Ata de reunião (aba Reuniões), na MESMA ordem do formulário e do card:
// presença do bispado, participantes, oração inicial, pauta, itens de ação e
// oração de encerramento. Ata antiga, sem os campos novos, sai só com o que tem.
// Antes a pauta saía num text() só (passava do pé da página, sem quebrar) e o
// "[✔]" dos itens não existe nas fontes padrão do jsPDF (WinAnsi): saía lixo.
// Agora cada linha confere se cabe antes de ser escrita, e os quadradinhos são
// desenhados. Nada de emoji aqui: as fontes padrão também não os têm — e todo
// texto DIGITADO (pauta, itens, orações, participantes, nomes, tipo) passa
// pelo textoParaPdf antes do splitTextToSize: um ✅ ou um 🙏 estragava a linha
// inteira, não só o símbolo.
export async function imprimirAtaPDF(id) {
  if (!await geradorPronto()) return;
  const r = DADOS.reunioes.find(x => x.id === id);
  if (!r) return toast('Reunião não encontrada');

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, H = 297, margem = 20, larguraUtil = W - margem * 2;
  const LIMITE = H - 22;     // nenhuma linha passa daqui: o rodapé fica em H - 12
  const TOPO = 22;           // primeira linha das páginas seguintes
  const LH = 5;              // altura da linha em 10 pt
  const LADO = 3.4;          // lado do quadradinho
  const rotuloTipo = tipoReuniao(r.tipo).r;   // tipo desconhecido: a própria chave gravada
  const tipo = textoParaPdf(rotuloTipo) || 'Reunião';
  const quando = tipo + ' — ' + formatarData(r.data);

  // Cabeçalho (1ª página)
  doc.setFillColor(13, 27, 42);
  doc.rect(0, 0, W, 35, 'F');
  doc.setTextColor(201, 168, 76);
  doc.setFontSize(8);
  doc.text('A IGREJA DE JESUS CRISTO DOS SANTOS DOS ÚLTIMOS DIAS', W/2, 10, {align:'center'});
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text('Ata de Reunião — ' + ALA, W/2, 18, {align:'center'});
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.text(quando, W/2, 26, {align:'center'});

  let y = 46;
  let primeiroBloco = true;
  const corpo = () => { doc.setFontSize(10); doc.setFont(undefined, 'normal'); doc.setTextColor(30, 30, 30); };
  corpo();

  // Quebra ANTES de escrever: o que não couber até o LIMITE começa na página seguinte
  const cabe = altura => {
    if (y + altura <= LIMITE) return;
    doc.addPage();
    y = TOPO;
  };
  // espaço entre um bloco e outro (não no primeiro, colado no cabeçalho)
  const novoBloco = mm => { if (!primeiroBloco) y += mm; primeiroBloco = false; };
  // linhas já quebradas na largura: a 1ª reserva `juntas` linhas (um item curto
  // não fica partido entre duas páginas); as outras conferem uma a uma, e assim
  // uma pauta longa continua na página seguinte
  const linhas = (lista, x, juntas = 1) => {
    cabe(Math.min(lista.length, juntas) * LH);
    lista.forEach((l, i) => { if (i) cabe(LH); doc.text(l, x, y); y += LH; });
  };

  // `primeiro` = o que o 1º bloco da seção reserva: o título só fica nesta
  // página se esse bloco couber junto, senão os dois vão para a seguinte e o
  // título não fica sozinho no pé da página. Antes reservava uma linha só, e o
  // assunto de 2 linhas ou o item de 3 pulava de página sem o título.
  const titulo = (txt, primeiro = LH) => {
    novoBloco(5);
    cabe(7 + primeiro);
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(13, 27, 42);
    doc.text(txt, margem, y);
    doc.setDrawColor(201, 168, 76);
    doc.setLineWidth(0.3);
    doc.line(margem, y + 1.8, W - margem, y + 1.8);
    y += 7;
    corpo();
  };

  // "Rótulo: valor" (participantes, orações), o valor quebrando ao lado do rótulo
  const linhaRotulada = (rotulo, valor) => {
    novoBloco(3);
    corpo();
    doc.setFont(undefined, 'bold');
    const larguraRot = doc.getTextWidth(rotulo + ': ');
    doc.setFont(undefined, 'normal');
    const partes = doc.splitTextToSize(valor, larguraUtil - larguraRot);
    cabe(Math.min(partes.length, 3) * LH);
    doc.setFont(undefined, 'bold');
    doc.text(rotulo + ':', margem, y);
    doc.setFont(undefined, 'normal');
    linhas(partes, margem + larguraRot);
  };

  // Quadradinho desenhado (doc.rect) e o visto em dois traços (doc.line): a
  // base do quadrado acompanha a linha de base do texto
  const caixa = (x, base, marcada) => {
    const topo = base - 2.9;
    doc.setDrawColor(70, 70, 70);
    doc.setLineWidth(0.3);
    doc.rect(x, topo, LADO, LADO);
    if (marcada) {
      doc.setLineWidth(0.55);
      doc.line(x + 0.7, topo + 1.8, x + 1.4, topo + 2.6);
      doc.line(x + 1.4, topo + 2.6, x + 2.8, topo + 0.8);
    }
  };
  // O item vem já quebrado na largura (partesItem), para o título da seção saber
  // quanto o 1º item reserva (alturaItem) antes de ser escrito
  const RECUO = LADO + 2.6;
  const partesItem = texto => doc.splitTextToSize(textoParaPdf(texto), larguraUtil - RECUO - 1);
  const alturaItem = partes => Math.min(partes.length, 3) * LH + 1;
  const itemMarcado = (partes, marcada, apagado = false) => {
    const x = margem + 1;
    cabe(alturaItem(partes));
    caixa(x, y, marcada);
    if (apagado) doc.setTextColor(115, 115, 115);
    linhas(partes, x + RECUO, 3);
    y += 1;
    doc.setTextColor(30, 30, 30);
  };

  // 1. Presença: todos os chamados, o quadradinho diz quem estava. Ninguém
  //    marcado (ou ata antiga): a seção não sai, como no card.
  const chamados = presentes(r.presenca).length
    ? r.presenca.filter(p => p && p.cargo).map(p => ({ partes: partesItem(rotuloPresenca(p)), sim: p.presente === true }))
    : [];
  if (chamados.length) {
    titulo('Presença do bispado', alturaItem(chamados[0].partes));
    chamados.forEach(c => itemMarcado(c.partes, c.sim, !c.sim));
  }

  // 2. Participantes  3. Oração inicial
  const participantes = (Array.isArray(r.participantes) ? r.participantes : []).map(textoParaPdf).filter(Boolean);
  if (participantes.length) linhaRotulada('Participantes', participantes.join(', '));
  const oracaoIni = typeof r.oracaoInicial === 'string' ? textoParaPdf(r.oracaoInicial).trim() : '';
  if (oracaoIni) linhaRotulada('Oração inicial', oracaoIni);

  // 4. Pauta: um parágrafo por assunto, como foi digitada; a quebra simples
  //    dentro do assunto (lista um por linha) também fica. A linha que era só
  //    emoji fica vazia no textoParaPdf e sai — não vira linha em branco.
  const assuntos = paragrafos(r.pauta)
    .map(p => p.split('\n').map(textoParaPdf).filter(Boolean).flatMap(l => doc.splitTextToSize(l, larguraUtil)))
    .filter(a => a.length);
  if (assuntos.length) {
    titulo('Pauta / Anotações', Math.min(assuntos[0].length, 2) * LH);
    assuntos.forEach((a, i) => {
      if (i) y += 2.5;
      linhas(a, margem, 2);
    });
  }

  // 5. Itens de ação
  const itens = (Array.isArray(r.itens) ? r.itens : []).map(it => ({ partes: partesItem(it?.texto), feito: !!it?.feito }));
  if (itens.length) {
    titulo('Itens de ação', alturaItem(itens[0].partes));
    itens.forEach(it => itemMarcado(it.partes, it.feito));
  }

  // 6. Oração de encerramento
  const oracaoEnc = typeof r.oracaoEncerramento === 'string' ? textoParaPdf(r.oracaoEncerramento).trim() : '';
  if (oracaoEnc) linhaRotulada('Oração de encerramento', oracaoEnc);

  // Rodapé em TODAS as páginas (antes só na última); da 2ª em diante, a linha
  // do topo diz de que ata é a folha solta
  const total = doc.getNumberOfPages();
  const hoje = new Date().toLocaleDateString('pt-BR');
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(120, 120, 120);
    if (p > 1) doc.text('Ata de Reunião — ' + quando, W/2, 12, {align:'center'});
    const pagina = total > 1 ? ` · página ${p} de ${total}` : '';
    doc.text('Gerado pelo Painel do Bispado · ' + ALA + ' — ' + hoje + pagina, W/2, H - 12, {align:'center'});
  }

  // ata-<tipo>-<data>.pdf: duas reuniões do mesmo dia não saem com o mesmo nome
  doc.save(nomeArquivoAta(rotuloTipo, r.data));
}
