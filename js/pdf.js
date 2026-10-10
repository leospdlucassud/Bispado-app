// =============================================
// IMPRESSÃO DE ATA EM PDF (jsPDF)
// =============================================
// Ata da reunião sacramental em PDF, na mesma ordem do formulário
import { ALA, DADOS } from './config.js';
import { estadoDaVaga, minutosDaVaga, nomeNatural, tipoDe } from './discursos-regras.js';
import { tipoReuniao } from './reunioes.js';
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

export async function imprimirAtaPDF(id) {
  if (!await geradorPronto()) return;
  const r = DADOS.reunioes.find(x => x.id === id);
  if (!r) return toast('Reunião não encontrada');

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, margin = 20;
  let y = 20;

  // Header
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
  doc.text(tipoReuniao(r.tipo).r + ' — ' + formatarData(r.data), W/2, 26, {align:'center'});
  y = 42;

  doc.setTextColor(30, 30, 30);

  // Participantes
  if (r.participantes?.length) {
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('Participantes:', margin, y); y += 6;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);
    doc.text(r.participantes.join(', '), margin, y, {maxWidth: W - margin*2}); y += 10;
  }

  // Pauta
  if (r.pauta) {
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('Pauta / Anotações:', margin, y); y += 6;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(r.pauta, W - margin*2);
    doc.text(lines, margin, y); y += lines.length * 5 + 6;
  }

  // Itens de ação
  if (r.itens?.length) {
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('Itens de Ação:', margin, y); y += 6;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);
    r.itens.forEach((it, i) => {
      if (y > 270) { doc.addPage(); y = 20; }
      const check = it.feito ? '[✔]' : '[  ]';
      doc.text(check + ' ' + it.texto, margin + 2, y);
      y += 6;
    });
  }

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text('Gerado pelo Painel do Bispado · ' + ALA + ' — ' + new Date().toLocaleDateString('pt-BR'), W/2, 290, {align:'center'});

  doc.save('ata-' + (r.data || 'reuniao') + '.pdf');
}
