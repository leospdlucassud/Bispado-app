const CACHE = 'bispado-app-v5.36.0';
const ASSETS = [
  '/',
  '/index.html',
  '/convite.html',
  '/css/style.css',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-512.png',
  '/icons/apple-touch-icon.png',
  '/icons/sprite.svg',
  // jsPDF (360 KB): a página só o carrega ao gerar uma ata, mas ele fica guardado
  // desde a instalação — senão o "Sincronizar" e cada atualização (que renovam o
  // cache) o apagavam, e a ata deixava de sair sem sinal
  '/vendor/jspdf.umd.min.js',
  '/js/acompanhamento.js',
  '/js/lembretes-regras.js',
  '/js/lembretes.js',
  '/js/agenda.js',
  '/js/api.js',
  '/js/app.js',
  '/js/busca.js',
  '/js/calendario.js',
  '/js/chamados.js',
  '/js/chamados-ala.js',
  '/js/chamados-lcr.js',
  '/js/config.js',
  '/js/convite.js',
  '/js/convite-regras.js',
  '/js/crescimento.js',
  '/js/crescimento-lcr.js',
  '/js/crud-regras.js',
  '/js/discursos-regras.js',
  '/js/discursos-base-regras.js',
  '/js/discurso-base.js',
  '/js/dados-membros.js',
  '/js/designacoes.js',
  '/js/dialogo.js',
  '/js/graficos.js',
  '/js/inicio.js',
  '/js/main.js',
  '/js/manual.js',
  '/js/membros-import.js',
  '/js/membros-lcr.js',
  '/js/membros.js',
  '/js/notas.js',
  '/js/offline-pwa.js',
  '/js/pendentes.js',
  '/js/pdf.js',
  '/js/pdf-icones.js',
  '/js/pdf-progresso.js',
  '/js/redirecionar-convite.js',
  '/js/reunioes.js',
  '/js/reunioes-regras.js',
  '/js/rodizio.js',
  '/js/sacramental.js',
  '/js/sessao.js',
  '/js/tema.js',
  '/js/ui.js',
  '/js/usuario.js',
  '/js/utils.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  // Limpa e regenera o cache do app (chamado durante sincronização manual)
  if (e.data?.type === 'CLEAR_AND_REFRESH_CACHE') {
    e.waitUntil(
      caches.delete(CACHE).then(() =>
        caches.open(CACHE).then(cache =>
          Promise.all(
            ASSETS.map(url =>
              fetch(url, { cache: 'no-store' }).then(res => {
                if (res.ok) cache.put(url, res);
              }).catch(() => {})
            )
          )
        )
      ).then(() => {
        // Notifica todos os clientes que o cache foi renovado
        self.clients.matchAll().then(clients =>
          clients.forEach(client =>
            client.postMessage({ type: 'CACHE_REFRESHED' })
          )
        );
      })
    );
  }
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // A busca do "discurso base" na Biblioteca do Evangelho (discurso-base.js):
  // nunca do cache — cada tema é uma busca nova
  if (url.hostname === 'www.churchofjesuschrist.org') return;

  // API Netlify e o arquivo de versao — sempre rede, nunca cache.
  // version.json cacheado tornaria a verificacao de atualizacao inutil: o app
  // compararia sua versao com uma copia velha de si mesmo e nunca atualizaria.
  if (url.pathname.startsWith('/.netlify/') || url.pathname.startsWith('/api/')
      || url.pathname === '/version.json') {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response(JSON.stringify({ error: 'sem_conexao' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } })
      )
    );
    return;
  }

  // App — cache primeiro, rede em background para atualizar
  e.respondWith(
    caches.match(e.request).then(cached => {
      const network = fetch(e.request).then(res => {
        if (res && res.status === 200 && res.type !== 'opaque') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});

// Lembretes do Acompanhamento (netlify/functions/lembretes.js manda; o texto
// chega cifrado e o navegador entrega aqui já aberto). Sem dados, não mostra
// nada — mas o navegador exige mostrar algo: vai um aviso genérico.
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = {}; }
  const url = typeof d.url === 'string' && d.url.startsWith('/') ? d.url : '/#acompanhamento';
  e.waitUntil(self.registration.showNotification(String(d.titulo || '🧭 Lembrete de acompanhamento'), {
    body: String(d.corpo || 'Abra o app para ver.'),
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: typeof d.tag === 'string' ? d.tag : undefined,
    renotify: !!d.tag,
    data: { url },
  }));
});

// Tocar na notificação abre (ou traz para a frente) o app na aba Acompanhamento
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || '/#acompanhamento', self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(janelas => {
    const aberta = janelas.find(j => new URL(j.url).origin === self.location.origin);
    // já aberto: o app troca de aba (lembretes.js) — sem recarregar
    if (aberta) {
      aberta.postMessage({ type: 'ABRIR_ABA', aba: new URL(url).hash.slice(1) || 'acompanhamento' });
      return aberta.focus().catch(() => self.clients.openWindow(url));
    }
    return self.clients.openWindow(url);
  }));
});
