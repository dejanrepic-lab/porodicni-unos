// The shared family password page, in the same look as the form and the admin sign-in.
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function accessPage({ next = '/', error = '' } = {}) {
  return `<!doctype html><html lang="bs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>Pristup porodičnom unosu</title><style>
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:20px 16px;font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#172033;background:radial-gradient(120% 80% at 0% 0%,#dfe9ff 0%,rgba(223,233,255,0) 60%),#f3f6fb}
.card{width:min(420px,100%);background:#fff;border:1px solid #e2e8f2;border-radius:22px;overflow:hidden;box-shadow:0 18px 50px rgba(16,24,40,.12)}
.head{padding:22px 24px 18px;color:#fff;background:radial-gradient(120% 140% at 100% 0%,rgba(255,255,255,.16) 0%,rgba(255,255,255,0) 55%),linear-gradient(135deg,#1f4fae,#2f6fe0)}
.head h1{margin:0;font-size:25px;letter-spacing:-.02em}
.head p{margin:6px 0 0;opacity:.9;line-height:1.45;font-size:15px}
form{padding:20px 24px 24px}
label{display:block;font-size:14px;font-weight:650;color:#3a4558;margin:0 0 6px}
input{width:100%;min-height:52px;padding:12px 14px;border:1.5px solid #c9d4e3;border-radius:14px;font:inherit;font-size:16px;color:#172033;background:#fff}
input:focus{outline:none;border-color:#245ec7;box-shadow:0 0 0 4px rgba(36,94,199,.18)}
button{width:100%;min-height:52px;margin-top:16px;border:0;border-radius:14px;background:#245ec7;color:#fff;font:inherit;font-size:16px;font-weight:750;cursor:pointer;box-shadow:0 4px 14px rgba(36,94,199,.35)}
button:hover{background:#1f4fae}
.error{margin:0 0 14px;padding:10px 12px;border-radius:12px;background:#fff1ef;border:1px solid #f6c9c3;color:#b42318;font-size:14px}
</style></head><body><main class="card"><div class="head"><h1>🌳 Porodično stablo</h1><p>Ovaj obrazac je namijenjen porodici i rodbini. Unesite zajedničku pristupnu šifru.</p></div>
<form method="post" action="/access">${error ? `<p class="error" role="alert">${esc(error)}</p>` : ''}<input type="hidden" name="next" value="${esc(next)}">
<label for="access-password">Pristupna šifra</label><input id="access-password" name="password" type="password" autocomplete="current-password" required autofocus>
<button type="submit">Otvori obrazac</button></form></main></body></html>`;
}

module.exports = { accessPage };
