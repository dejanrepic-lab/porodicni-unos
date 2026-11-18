/* Admin app worker: makes the admin installable and shows a clear message offline. It caches nothing, so data is always live. */
const offline = `<!doctype html><html lang="bs"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nema veze</title>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;padding:20px;font-family:system-ui,sans-serif;background:#f3f6fb;color:#172033">
<main style="max-width:420px;background:#fff;border:1px solid #e2e8f2;border-radius:20px;padding:24px;box-shadow:0 18px 50px rgba(16,24,40,.12)">
<h1 style="margin:0 0 8px;font-size:22px">Nema veze sa serverom</h1><p style="margin:0 0 16px;color:#566277;line-height:1.5">Admin radi samo uz vezu sa serverom. Provjeri internet i pokušaj ponovo.</p>
<button onclick="location.reload()" style="width:100%;min-height:48px;border:0;border-radius:14px;background:#245ec7;color:#fff;font:inherit;font-weight:700">Pokušaj ponovo</button></main></body></html>`;
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(fetch(event.request).catch(() => new Response(offline, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } })));
});
