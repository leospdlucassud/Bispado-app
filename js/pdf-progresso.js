// =============================================
// PROGRESSO DA LEITURA DE PDF — as 3 importações do LCR (membros-import.js,
// chamados-ala.js, crescimento.js)
// Ler um PDF de 34-40 páginas leva segundos no celular (a frequência às
// classes, que lê os ícones desenhados, mais ainda). Antes a janela mostrava só
// "Lendo o PDF…" parado, e parecia travada. Agora: uma animação, a etapa e a
// página em que a leitura está.
// O "Aplicar" da prévia nasce DESLIGADO e só liga quando a prévia terminou de
// ser montada (liberarAplicar); ao tocar nele, desliga de novo e diz
// "Aplicando…" — um segundo toque não grava duas vezes.
// =============================================

// O HTML fica fora da função de atualizar: a animação é do CSS, e trocar o
// innerHTML a cada página reiniciaria o giro.
function htmlProgresso(etapa) {
  return `
    <div class="pdf-progresso" role="status" aria-live="polite">
      <div class="pdf-progresso-anim" aria-hidden="true"><span></span><span></span><span></span></div>
      <div class="pdf-progresso-etapa">${etapa}</div>
      <div class="pdf-progresso-barra" aria-hidden="true"><div class="pdf-progresso-feito"></div></div>
      <div class="pdf-progresso-pagina"></div>
    </div>`;
}

// Mostra o progresso dentro de `el` e devolve como avançá-lo. `etapa` é texto
// fixo do app (nunca vem do PDF). Se o conteúdo da janela já foi trocado (a
// pessoa fechou, veio um aviso), as atualizações seguintes não fazem nada.
export function iniciarProgresso(el, etapa = 'Lendo o PDF…') {
  if (!el) return { etapa() {}, pagina() {} };
  el.innerHTML = htmlProgresso(etapa);
  const raiz = el.querySelector('.pdf-progresso');
  const vivo = () => raiz.isConnected;
  return {
    etapa(texto) {
      if (!vivo()) return;
      raiz.querySelector('.pdf-progresso-etapa').textContent = texto;
      raiz.querySelector('.pdf-progresso-feito').style.width = '0%';
      raiz.querySelector('.pdf-progresso-pagina').textContent = '';
    },
    pagina(feitas, total) {
      if (!vivo() || !total) return;
      raiz.querySelector('.pdf-progresso-feito').style.width = `${Math.min(100, Math.round(feitas / total * 100))}%`;
      raiz.querySelector('.pdf-progresso-pagina').textContent = `Página ${feitas} de ${total}`;
    },
  };
}

// O texto de cada página (o que todos os leitores recebem), avisando o progresso
export async function textoDasPaginas(doc, progresso) {
  const paginas = [];
  for (let i = 1; i <= doc.numPages; i++) {
    paginas.push((await (await doc.getPage(i)).getTextContent()).items);
    progresso?.pagina(i, doc.numPages);
  }
  return paginas;
}

// ---------- o botão Aplicar ----------
const botaoAplicar = el => el?.querySelector('button[data-act="aplicar"]');

// A prévia escreve o botão com `disabled`; isto o liga quando ela está pronta
export function liberarAplicar(el) {
  const b = botaoAplicar(el);
  if (b) { b.disabled = false; b.removeAttribute('aria-disabled'); }
}

// Ao tocar: desliga e mostra "Aplicando…" com a mesma animação. Devolve false
// se ele já estava desligado (prévia ainda montando ou gravação em andamento).
export function travarAplicar(el) {
  const b = botaoAplicar(el);
  if (!b || b.disabled) return false;
  b.disabled = true;
  b.setAttribute('aria-disabled', 'true');
  b.innerHTML = '<span class="pdf-progresso-mini" aria-hidden="true"></span> Aplicando…';
  return true;
}

// Se a gravação falhar com a prévia ainda aberta, o botão volta
export function destravarAplicar(el, rotulo = 'Aplicar') {
  const b = botaoAplicar(el);
  if (!b) return;
  b.textContent = rotulo;
  liberarAplicar(el);
}
