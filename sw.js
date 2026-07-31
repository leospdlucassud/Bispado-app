const CACHE = 'bispado-app-v5.7.3';
const ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/acompanhamento.js',
  '/js/agenda.js',
  '/js/api.js',
  '/js/app.js',
  '/js/busca.js',
  '/js/calendario.js',
  '/js/config.js',
  '/js/dados-membros.js',
  '/js/designacoes.js',
  '/js/dialogo.js',
  '/js/main.js',
  '/js/manual.js',
  '/js/membros-import.js',
  '/js/membros.js',
  '/js/notas.js',
  '/js/offline-pwa.js',
  '/js/pdf.js',
  '/js/reunioes.js',
  '/js/sacramental.js',
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

  // API Netlify — sempre rede, nunca cache
  if (url.pathname.startsWith('/.netlify/') || url.pathname.startsWith('/api/')) {
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
