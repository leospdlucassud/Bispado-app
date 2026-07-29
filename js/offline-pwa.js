// ── FILA OFFLINE (IndexedDB) ──
const DB_NAME = 'bispado-offline';
const STORE_Q = 'fila-pendente';
let dbInstance = null;

function abrirDB() {
  return new Promise((resolve, reject) => {
    if (dbInstance) return resolve(dbInstance);
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore(STORE_Q, { keyPath: 'id', autoIncrement: true });
    req.onsuccess = e => { dbInstance = e.target.result; resolve(dbInstance); };
    req.onerror = () => reject(req.error);
  });
}

async function salvarNaFila(chave, dados) {
  try {
    const db = await abrirDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_Q, 'readwrite');
      tx.objectStore(STORE_Q).add({ chave, dados, ts: Date.now() });
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });
  } catch(e) {}
}

async function lerFila() {
  try {
    const db = await abrirDB();
    return new Promise((resolve, reject) => {
      const req = db.transaction(STORE_Q, 'readonly').objectStore(STORE_Q).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = reject;
    });
  } catch(e) { return []; }
}

async function removerDaFila(id) {
  try {
    const db = await abrirDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_Q, 'readwrite');
      tx.objectStore(STORE_Q).delete(id);
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });
  } catch(e) {}
}

async function enviarFilaPendente() {
  const fila = await lerFila();
  if (!fila.length) return;
  const btn = document.getElementById('sync-btn');
  if (btn) { btn.className = 'sync-btn syncing'; btn.innerHTML = `<span class="sync-icone">⟳</span> Enviando ${fila.length} pendente${fila.length>1?'s':''}…`; btn.disabled = true; }
  let ok = 0;
  for (const item of fila) {
    try {
      await fetch(`${API}?chave=${item.chave}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.dados)
      });
      await removerDaFila(item.id);
      ok++;
    } catch(e) {}
  }
  if (ok === fila.length) {
    atualizarUltimaSinc();
    setSyncStatus('ok');
  }
}

abrirDB().catch(() => {});

// ── PWA — Service Worker externo + detecção de nova versão ──
let swRegistration = null;
let isOnline = navigator.onLine;

window.addEventListener('online',  () => {
  isOnline = true;
  setSyncStatus('ok');
  enviarFilaPendente();
});
window.addEventListener('offline', () => {
  isOnline = false;
  const btn = document.getElementById('sync-btn');
  if (btn) { btn.className = 'sync-btn erro'; btn.innerHTML = '<span class="sync-icone">📵</span> Sem conexão'; }
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => {
        swRegistration = reg;

        // Se já há versão nova esperando → aplica imediatamente
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }

        // Quando nova versão terminar de instalar → aplica na hora
        reg.addEventListener('updatefound', () => {
          const novaSW = reg.installing;
          if (!novaSW) return;
          novaSW.addEventListener('statechange', () => {
            if (novaSW.state === 'installed') {
              // Força ativação imediata — nova versão ativa SEM precisar
              // de uma segunda abertura do app
              novaSW.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });

        // Verificar atualização silenciosa ao abrir — aguarda instalação
        verificarAtualizacaoSilenciosa(reg);
      })
      .catch(() => {});

    // Quando SW troca (nova versão ativada) → recarrega a página imediatamente
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });

    // Confirmação do SW que o cache foi limpo e renovado
    navigator.serviceWorker.addEventListener('message', e => {
      if (e.data?.type === 'CACHE_REFRESHED') {
        console.log('[PWA] Cache do app renovado com sucesso');
      }
    });
  });
}

async function verificarAtualizacaoSilenciosa(reg) {
  if (!isOnline) return;
  try {
    await reg.update();
    // Se já há uma versão instalada esperando, força skip agora
    if (reg.waiting) {
      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  } catch(e) {}
}

// Envia mensagem ao SW para limpar e regenerar cache do app
function limparCacheApp() {
  if (!swRegistration || !swRegistration.active) return;
  swRegistration.active.postMessage({ type: 'CLEAR_AND_REFRESH_CACHE' });
}

// Ouve confirmação do SW que o cache foi renovado
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', e => {
    if (e.data?.type === 'CACHE_REFRESHED') {
      console.log('[SW] Cache do app renovado com sucesso.');
    }
  });
}

// Quando usuário volta ao app: verifica nova versão E recarrega dados
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    if (swRegistration && isOnline) {
      verificarAtualizacaoSilenciosa(swRegistration);
      limparCacheApp(); // renova cache ao retornar ao app
    }
    if (isOnline) carregarDados();
  }
});

let dp=null;
const banner=document.createElement('div');
banner.innerHTML=`<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap"><span style="font-size:22px">📱</span><div style="flex:1;min-width:160px"><div style="font-weight:700;font-size:14px">Instalar como App</div><div style="font-size:12px;color:#aac0d8;margin-top:2px">Acesse offline, sem precisar do link</div></div><button id="pwa-install" style="background:#c9a84c;color:#0d1b2a;border:none;padding:8px 18px;border-radius:20px;font-weight:700;cursor:pointer;font-size:13px">Instalar</button><button id="pwa-dismiss" style="background:transparent;color:#8eacc8;border:none;padding:8px;cursor:pointer;font-size:18px">✕</button></div>`;
Object.assign(banner.style,{display:'none',position:'fixed',bottom:'0',left:'0',right:'0',background:'#1a2d42',borderTop:'2px solid #c9a84c',padding:'14px 18px',zIndex:'9999',boxShadow:'0 -4px 20px rgba(0,0,0,.5)'});
document.body.appendChild(banner);
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  dp = e;
  banner.style.display = 'block';
  const btnH = document.getElementById('btn-instalar-header');
  if (btnH) btnH.classList.add('visivel');
});
// Dispara o instalador nativo. Usada pelo banner e pelo botão do cabeçalho.
async function installPWA() {
  if (!dp) { toast('Use o menu do navegador para instalar (Adicionar à tela inicial).'); return; }
  dp.prompt();
  await dp.userChoice;
  dp = null;
  banner.style.display = 'none';
  const btnH = document.getElementById('btn-instalar-header');
  if (btnH) btnH.classList.remove('visivel');
}
document.getElementById('pwa-install').addEventListener('click', installPWA);
document.getElementById('pwa-dismiss').addEventListener('click',()=>{banner.style.display='none';});
window.addEventListener('appinstalled', () => {
  banner.style.display = 'none';
  const btnH = document.getElementById('btn-instalar-header');
  if (btnH) btnH.classList.remove('visivel');
});

(function(){
  const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
  const isSafari=/safari/i.test(navigator.userAgent)&&!/chrome/i.test(navigator.userAgent);
  const isStandalone=window.matchMedia('(display-mode: standalone)').matches;
  if(isIOS&&isSafari&&!isStandalone&&!sessionStorage.getItem('ios-dismissed')){
    const tip=document.createElement('div');
    tip.innerHTML=`<div style="display:flex;align-items:flex-start;gap:10px"><span style="font-size:20px">📲</span><div style="flex:1"><div style="font-weight:700;font-size:13px;margin-bottom:4px">Instalar no iPhone/iPad</div><div style="font-size:12px;color:#aac0d8;line-height:1.6">Toque em <strong style="color:#c9a84c">Compartilhar</strong> (□↑) → <strong style="color:#c9a84c">"Adicionar à Tela de Início"</strong></div></div><button id="ios-dismiss" style="background:transparent;color:#8eacc8;border:none;padding:4px;cursor:pointer;font-size:16px">✕</button></div>`;
    Object.assign(tip.style,{position:'fixed',bottom:'0',left:'0',right:'0',background:'#1a2d42',borderTop:'2px solid #5b9bd5',padding:'14px 18px',zIndex:'9999',boxShadow:'0 -4px 20px rgba(0,0,0,.5)'});
    document.body.appendChild(tip);
    document.getElementById('ios-dismiss').addEventListener('click',()=>{tip.remove();sessionStorage.setItem('ios-dismissed','1');});
  }
})();
