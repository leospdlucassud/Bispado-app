// =============================================
// TELA DO CONVITE — o que o membro vê ao abrir o link do WhatsApp
// Página própria (convite.html): o membro baixa só isto — sem o painel, sem a
// biblioteca de PDF, sem service worker. Antes, o link abria o app inteiro.
// Lê e grava só por /api/convite (ver netlify/functions/convite.js).
// =============================================
import { ALA, API_CONVITE } from './config.js';
import { conviteJaRespondido, encerrada } from './convite-regras.js';
import { esc, formatarData } from './utils.js';
// --- Tela que o membro vê ao abrir o link do WhatsApp ---
// Lê só a própria entrevista, por /api/convite (só os campos da tela). Antes
// baixava /api/agenda inteira — com as sigilosas e as anotações do bispado —
// no celular de quem abria o link.
async function abrirTelaConfirmacao(id) {
  // a tela pública tem a cara do convite, não a do tema escolhido neste aparelho
  document.documentElement.setAttribute('data-theme', 'dark');
  document.title = `Convite — ${ALA}`;
  document.body.innerHTML = `
    <div id="conf-wrap" style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px">
      <div style="max-width:420px;width:100%;background:#152233;border:1px solid #2a4060;border-radius:18px;padding:28px;text-align:center">
        <div class="loading">Carregando…</div>
      </div>
    </div>`;
  const caixa = document.querySelector('#conf-wrap > div');

  let e = null, semConexao = false;
  try {
    const r = await fetch(`${API_CONVITE}?id=${encodeURIComponent(id)}`, { cache: 'no-store' });
    if (r.ok) e = await r.json();
    else if (r.status !== 404) semConexao = true;   // 404 = não existe; o resto é falha
  } catch { semConexao = true; }

  // Falha de rede não é "convite expirado": dizer isso fazia a pessoa desistir
  if (semConexao) {
    caixa.innerHTML = `
      <div style="font-size:34px;margin-bottom:10px">📡</div>
      <h2 style="color:var(--sac);font-size:17px;margin-bottom:8px">Não deu para abrir o convite</h2>
      <p style="color:var(--text2);font-size:13px;line-height:1.6;margin-bottom:16px">Parece que a conexão falhou. Confira a internet e tente de novo.</p>
      <button id="conf-tentar" style="background:rgba(232,208,128,.15);color:var(--sac);border:1px solid rgba(232,208,128,.35);border-radius:12px;padding:11px 22px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit">Tentar de novo</button>`;
    caixa.querySelector('#conf-tentar').addEventListener('click', () => abrirTelaConfirmacao(id));
    return;
  }

  if (!e || !e.id) {
    caixa.innerHTML = `
      <div style="font-size:34px;margin-bottom:10px">🔎</div>
      <h2 style="color:var(--sac);font-size:17px;margin-bottom:8px">Convite não encontrado</h2>
      <p style="color:var(--text2);font-size:13px;line-height:1.6">Este link pode ter expirado. Fale com o bispado para confirmar sua entrevista.</p>`;
    return;
  }

  // Entrevista já encerrada pelo bispado: o link antigo não pode mais responder,
  // senão um pedido de remarcação ressuscitaria algo que já aconteceu.
  if (encerrada(e)) return telaJaEncerrada(caixa);

  // Uso único por convite: já respondeu o convite atual, então só vê o que respondeu.
  if (conviteJaRespondido(e)) {
    const { base, quando: respondidoEm, sugerido } = resumoDaResposta(e);
    const detalhe = e.confirmacao === 'reagendar'
      ? (sugerido ? ` sugerindo <strong style="color:var(--text-corpo)">${esc(sugerido)}</strong>.` : '.') +
        ' O bispado vai enviar um novo convite com a data confirmada.'
      : '.';
    // A saída de emergência existe porque o `convidadoEm` pode estar velho no
    // servidor (o clique em "Convidar" pode nao ter subido, ex.: sem sinal na
    // capela) e o membro apareceria aqui logo depois de receber um convite novo.
    // Trancar sem alternativa deixaria a pessoa sem saída nenhuma dentro do app.
    return telaEncerrada(caixa, '✉️', 'Você já respondeu',
      `${base}${respondidoEm ? ` em ${esc(respondidoEm)}` : ''}${detalhe}` +
      ' Precisa mudar alguma coisa? Fale com o bispado — eles reenviam o convite.',
      '#e8d080',
      { rotulo: 'Recebi um convite novo e quero responder', acao: () => telaConvite(caixa, e) });
  }

  return telaConvite(caixa, e);
}

const telaJaEncerrada = caixa => telaEncerrada(caixa, '✅', 'Entrevista encerrada',
  'O bispado já registrou o resultado desta entrevista. Se precisar de outra, fale com o bispado.');

// O formulário de resposta. Fica separado porque a tela "você já respondeu"
// precisa poder reabri-lo (ver a saída de emergência em abrirTelaConfirmacao).
// `e` é o que /api/convite devolve (conviteParaMembro): nome já é o primeiro
// nome e tipo vem vazio quando o assunto não pode aparecer.
function telaConvite(caixa, e) {
  const quando = e.data
    ? formatarData(e.data) + (e.hora ? `, às ${e.hora}` : '')
    : 'data a combinar';

  // Só duas opções: quem não pode vir deve pedir outra data, não apenas recusar.
  // ('recusado' segue reconhecido em selosConfirmacao, por causa dos registros antigos.)
  const opcoes = [
    ['confirmado', '✅ Confirmo minha presença', '#34d399'],
    ['reagendar',  '🔄 Preciso de outra data',   '#e8b040'],
  ];

  caixa.innerHTML = `
    <div style="font-size:34px;margin-bottom:6px">🕊️</div>
    <h2 style="color:var(--sac);font-size:17px;margin-bottom:4px">${e.tipo ? 'Convite para entrevista' : 'Convite do bispado'}</h2>
    <p style="color:var(--text2);font-size:12px;margin-bottom:18px">${esc(ALA)}</p>
    <div style="background:rgba(255,255,255,.04);border-radius:12px;padding:14px;margin-bottom:18px;text-align:left">
      <div style="color:var(--text-corpo);font-size:14px;font-weight:700;margin-bottom:6px">${esc(e.nome)}</div>
      <div style="color:var(--text2);font-size:12px;line-height:1.8">
        ${e.tipo ? `📋 ${esc(e.tipo)}` : '💬 Conversa com o bispado'}<br>📅 ${esc(quando)}
      </div>
    </div>
    <p style="color:var(--text2);font-size:13px;margin-bottom:14px">Você pode comparecer?</p>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${opcoes.map(([v, r, c]) => `
        <button data-resp="${v}"
          style="background:transparent;border:1px solid ${c};--c:${c};border-radius:12px;padding:12px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit">${r}</button>`).join('')}
    </div>
    <!-- aparece só ao pedir outra data: o membro sugere quando pode -->
    <div id="conf-sugestao" style="display:none;text-align:left;margin-top:14px;background:rgba(232,176,64,.08);border:1px solid rgba(232,176,64,.3);border-radius:12px;padding:14px">
      <p style="--c:#e8b040;font-size:13px;font-weight:600;margin-bottom:10px">Quando ficaria bom para você?</p>
      <label style="color:var(--text2);font-size:11px;display:block;margin-bottom:3px">Data</label>
      <input type="date" id="conf-data" value="${esc(e.data || '')}"
        style="width:100%;background:#0d1b2a;border:1px solid #2a4060;color:var(--text-corpo);border-radius:10px;padding:10px;font-size:14px;font-family:inherit;margin-bottom:10px">
      <label style="color:var(--text2);font-size:11px;display:block;margin-bottom:3px">Horário</label>
      <input type="time" id="conf-hora" value="${esc(e.hora || '')}"
        style="width:100%;background:#0d1b2a;border:1px solid #2a4060;color:var(--text-corpo);border-radius:10px;padding:10px;font-size:14px;font-family:inherit;margin-bottom:12px">
      <button id="conf-enviar-sugestao"
        style="width:100%;background:#e8b040;color:#0d1b2a;border:none;border-radius:12px;padding:12px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit">Enviar pedido</button>
    </div>
    ${e.confirmacao ? `<p style="color:var(--text3);font-size:11px;margin-top:14px">O bispado enviou um convite novo. Sua resposta anterior não vale mais para esta data.</p>` : ''}`;

  const sugestao = caixa.querySelector('#conf-sugestao');
  caixa.querySelectorAll('button[data-resp]').forEach(btn =>
    btn.addEventListener('click', () => {
      // "Preciso de outra data" abre o formulário em vez de responder na hora
      if (btn.dataset.resp === 'reagendar') { sugestao.style.display = 'block'; sugestao.scrollIntoView({ behavior:'smooth', block:'center' }); return; }
      responderConvite(e.id, btn.dataset.resp);
    }));

  caixa.querySelector('#conf-enviar-sugestao').addEventListener('click', () => {
    const data = caixa.querySelector('#conf-data').value;
    const hora = caixa.querySelector('#conf-hora').value;
    if (!data) { caixa.querySelector('#conf-data').focus(); return; }
    responderConvite(e.id, 'reagendar', { data, hora });
  });
}


// `sugestao` ({data, hora}) só vem quando o membro pede outra data.
// Fica em campos próprios: é um pedido, não muda a entrevista por conta própria —
// quem reagenda é o bispado (o formulário de lá já abre com esta sugestão).
async function responderConvite(id, resposta, sugestao = null) {
  const caixa = document.querySelector('#conf-wrap > div');
  caixa.innerHTML = '<div class="loading">Enviando…</div>';
  // Manda só a escolha: o que ela muda no card (status, data da resposta) é
  // decidido no servidor, por camposDaResposta (convite-regras.js).
  let ok = true, motivo = '';
  try {
    const r = await fetch(`${API_CONVITE}?id=${encodeURIComponent(id)}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resposta, sugestao }),
    });
    ok = r.ok;
    // 409 também é o conflito momentâneo de gravação (_crud.js) — esse se
    // resolve tentando de novo. Só o corpo diz se a entrevista foi encerrada.
    if (!ok) motivo = r.status === 404 ? 'sumiu' : ((await r.json().catch(() => ({})))?.error || '');
  } catch { ok = false; }
  if (motivo === 'encerrada') return telaJaEncerrada(caixa);   // o bispado encerrou com a tela aberta
  if (motivo === 'sumiu') {
    caixa.innerHTML = `
      <div style="font-size:34px;margin-bottom:10px">🔎</div>
      <h2 style="color:var(--sac);font-size:17px;margin-bottom:8px">Convite não encontrado</h2>
      <p style="color:var(--text2);font-size:13px;line-height:1.6">Esta entrevista não está mais na agenda do bispado. Fale com eles para combinar.</p>`;
    return;
  }

  const quandoPedido = sugestao?.data
    ? formatarData(sugestao.data) + (sugestao.hora ? ` às ${sugestao.hora}` : '')
    : '';
  // O horário que o membro sugere é um pedido, não um agendamento: quem fecha a
  // agenda é o bispado, que reenvia o convite. A mensagem precisa deixar isso
  // claro, senão a pessoa sai achando que já está marcado.
  const txt = {
    confirmado: ['✅', 'Presença confirmada', 'Obrigado! O bispado já foi avisado.'],
    reagendar:  ['🔄', 'Pedido registrado',
                 (quandoPedido
                   ? `Anotamos sua sugestão de <strong style="color:var(--text-corpo)">${esc(quandoPedido)}</strong>. `
                   : '') +
                 'O bispado vai conferir a disponibilidade e enviar um novo convite com a data e o horário confirmados.'],
  }[resposta] || ['✅', 'Resposta registrada', 'Obrigado! O bispado foi informado.'];

  // na falha o membro precisa da tela aberta para tentar de novo — sem timer
  if (!ok) {
    caixa.innerHTML = `
      <div style="font-size:36px;margin-bottom:10px">⚠️</div>
      <h2 style="--c:#e05555;font-size:16px;margin-bottom:8px">Não deu para enviar</h2>
      <p style="color:var(--text2);font-size:13px;line-height:1.6;margin-bottom:16px">Verifique sua conexão e tente de novo, ou responda direto ao bispado pelo WhatsApp.</p>
      <button id="conf-tentar" style="background:rgba(232,208,128,.15);--c:#e8d080;border:1px solid rgba(232,208,128,.35);border-radius:12px;padding:11px 22px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit">Tentar de novo</button>`;
    // reenvia a mesma resposta: a pessoa não precisa escolher tudo outra vez
    caixa.querySelector('#conf-tentar').addEventListener('click', () => responderConvite(id, resposta, sugestao));
    return;
  }
  telaEncerrada(caixa, txt[0], txt[1], txt[2]);
}

// Fecha a aba do convite: aos 20s ou no botão.
// `window.close()` só encerra janelas abertas por script — abrindo o link pelo
// WhatsApp o navegador quase sempre recusa. Por isso a tentativa é verificada:
// se a aba continuar de pé, o aviso vira "pode fechar", em vez de deixar uma
// contagem que não cumpre o que promete.
function agendarFechamento(caixa, segundos = 20) {
  const aviso = caixa.querySelector('#conf-contagem');
  const botao = caixa.querySelector('#conf-fechar');
  let restam = segundos;

  const tentarFechar = () => {
    clearInterval(cronometro);
    if (aviso) aviso.textContent = 'Fechando…';
    window.close();
    // se em 400ms ainda estamos aqui, o navegador bloqueou o fechamento
    setTimeout(() => {
      if (botao) botao.style.display = 'none';
      if (aviso) aviso.textContent = 'Sua resposta foi registrada. Pode fechar esta aba.';
    }, 400);
  };

  const cronometro = setInterval(() => {
    restam--;
    if (restam <= 0) return tentarFechar();
    if (aviso) aviso.innerHTML = `Esta janela fecha sozinha em <strong>${restam}</strong>s`;
  }, 1000);

  botao?.addEventListener('click', tentarFechar);
  return () => clearInterval(cronometro);   // quem reabre a tela cancela a contagem
}

// Moldura unica das telas que encerram o convite (resposta enviada, convite ja
// respondido, entrevista concluida). Todas fecham sozinhas em 20s.
function telaEncerrada(caixa, icone, titulo, mensagemHtml, cor = '#e8d080', extra = null) {
  caixa.innerHTML = `
    <div style="font-size:40px;margin-bottom:10px">${icone}</div>
    <h2 style="--c:${cor};font-size:17px;margin-bottom:8px">${titulo}</h2>
    <p style="color:var(--text2);font-size:13px;line-height:1.6">${mensagemHtml}</p>
    <div style="margin-top:20px;border-top:1px solid rgba(255,255,255,.08);padding-top:16px">
      <button id="conf-fechar"
        style="background:rgba(232,208,128,.15);color:var(--sac);border:1px solid rgba(232,208,128,.35);border-radius:12px;padding:11px 22px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit">Fechar agora</button>
      <p id="conf-contagem" style="color:var(--text3);font-size:11px;margin-top:10px">Esta janela fecha sozinha em <strong>20</strong>s</p>
      ${extra ? `<button id="conf-extra" style="display:block;margin:12px auto 0;background:none;border:none;--c:#5b7a99;font-size:12px;text-decoration:underline;cursor:pointer;font-family:inherit">${extra.rotulo}</button>` : ''}
    </div>`;
  const cancelar = agendarFechamento(caixa);
  if (extra) caixa.querySelector('#conf-extra')?.addEventListener('click', () => { cancelar(); extra.acao(); });
}

// Texto do que a pessoa respondeu, para ela reconhecer a propria resposta.
function resumoDaResposta(e) {
  const quando = e.confirmadoEm ? new Date(e.confirmadoEm).toLocaleDateString('pt-BR') : '';
  const sugerido = e.sugestaoData
    ? formatarData(e.sugestaoData) + (e.sugestaoHora ? ` às ${e.sugestaoHora}` : '')
    : '';
  const base = {
    confirmado: 'Você confirmou presença',
    reagendar:  'Você pediu outra data',
    recusado:   'Você respondeu que não poderia ir',
  }[e.confirmacao] || 'Sua resposta foi registrada';
  return { base, quando, sugerido };
}

// convite.html?id=<id> (e ?confirmar=<id>, o formato dos links antigos)
const parametros = new URLSearchParams(location.search);
abrirTelaConfirmacao(parametros.get('id') || parametros.get('confirmar') || '');
