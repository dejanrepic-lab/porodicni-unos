// Shared admin navigation and the sign-in page, used by the answers admin and the family-link admin.
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const navStyle = `<style>
.admin-nav{position:sticky;top:0;z-index:30;display:flex;align-items:center;gap:6px 14px;flex-wrap:wrap;padding:10px max(16px,calc((100vw - 1100px)/2 + 20px));background:linear-gradient(135deg,#1f4fae,#2f6fe0);color:#fff;box-shadow:0 4px 18px rgba(31,79,174,.22);font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif}
.admin-nav-brand{font-weight:800;font-size:16px;letter-spacing:-.01em;margin-right:auto;color:#fff;text-decoration:none;white-space:nowrap}
.admin-nav-links{display:flex;gap:4px;flex-wrap:wrap;align-items:center}
.admin-nav-links a,.admin-nav-links button{display:inline-flex;align-items:center;min-height:38px;padding:6px 12px;border-radius:999px;border:0;background:transparent;color:rgba(255,255,255,.88);font-family:inherit;font-weight:600;font-size:14px;line-height:1.2;text-decoration:none;cursor:pointer;margin:0}
.admin-nav-links a:hover,.admin-nav-links button:hover{background:rgba(255,255,255,.14);color:#fff}
.admin-nav-links a[aria-current=page]{background:#fff;color:#1f4fae}
.admin-nav-links form{margin:0;display:inline}
.admin-nav-links .admin-nav-logout{border:1px solid rgba(255,255,255,.35)}
@media(max-width:640px){.admin-nav{padding:8px 12px}.admin-nav-brand{width:100%;margin:0 0 2px}.admin-nav-links a,.admin-nav-links button{min-height:36px;padding:6px 10px;font-size:13.5px}}
</style>`;

function adminNav(active = '') {
  const link = (key, href, label) => `<a href="${href}"${active === key ? ' aria-current="page"' : ''}>${label}</a>`;
  return `${navStyle}<nav class="admin-nav" aria-label="Administracija"><a class="admin-nav-brand" href="/admin">🌳 Porodični unos · Admin</a><div class="admin-nav-links">${link('answers', '/admin', 'Odgovori')}${link('links', '/admin/family-links', 'Porodični linkovi')}${link('user', '/admin/user-mode', 'Korisnički prikaz')}<form method="post" action="/admin/logout"><button class="admin-nav-logout" type="submit">Odjavi se</button></form></div></nav>`;
}

function loginPage({ error = '', username = '', next = '/admin', rememberDays = 30 } = {}) {
  return `<!doctype html><html lang="bs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Admin prijava</title><style>
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:20px 16px;font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#172033;background:radial-gradient(120% 80% at 0% 0%,#dfe9ff 0%,rgba(223,233,255,0) 60%),#f3f6fb}
.login-card{width:min(420px,100%);background:#fff;border:1px solid #e2e8f2;border-radius:22px;overflow:hidden;box-shadow:0 18px 50px rgba(16,24,40,.12)}
.login-head{padding:22px 24px 18px;color:#fff;background:radial-gradient(120% 140% at 100% 0%,rgba(255,255,255,.16) 0%,rgba(255,255,255,0) 55%),linear-gradient(135deg,#1f4fae,#2f6fe0)}
.login-head small{display:block;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;opacity:.8}
.login-head h1{margin:4px 0 0;font-size:24px;letter-spacing:-.02em}
form{padding:20px 24px 24px}
label{display:block;font-size:14px;font-weight:650;color:#3a4558;margin:14px 0 6px}
input:not([type=checkbox]){width:100%;min-height:50px;padding:12px 14px;border:1.5px solid #c9d4e3;border-radius:14px;font:inherit;font-size:16px;color:#172033;background:#fff}
input:not([type=checkbox]):focus{outline:none;border-color:#245ec7;box-shadow:0 0 0 4px rgba(36,94,199,.18)}
.remember{display:flex;gap:10px;align-items:flex-start;margin:16px 0 4px;font-weight:600;cursor:pointer}
.remember input{width:20px;height:20px;margin:1px 0 0;accent-color:#245ec7;flex:0 0 auto}
.remember span small{display:block;font-weight:400;color:#667085;margin-top:2px}
button{width:100%;min-height:52px;margin-top:18px;border:0;border-radius:14px;background:#245ec7;color:#fff;font:inherit;font-size:16px;font-weight:750;cursor:pointer;box-shadow:0 4px 14px rgba(36,94,199,.35)}
button:hover{background:#1f4fae}
.login-error{margin:0 0 4px;padding:10px 12px;border-radius:12px;background:#fff1ef;border:1px solid #f6c9c3;color:#b42318;font-size:14px}
</style></head><body><main class="login-card"><div class="login-head"><small>Porodični unos</small><h1>Admin prijava</h1></div>
<form method="post" action="/admin/login">${error ? `<p class="login-error" role="alert">${esc(error)}</p>` : ''}
<input type="hidden" name="next" value="${esc(next)}">
<label for="login-user">Korisničko ime</label><input id="login-user" name="username" autocomplete="username" required value="${esc(username)}"${username ? '' : ' autofocus'}>
<label for="login-pass">Lozinka</label><input id="login-pass" name="password" type="password" autocomplete="current-password" required${username ? ' autofocus' : ''}>
<label class="remember"><input type="checkbox" name="remember" value="1" checked><span>Zapamti me na ovom uređaju<small>Ostaješ prijavljen ${esc(rememberDays)} dana od zadnjeg korištenja. Na tuđem uređaju isključi ovu opciju.</small></span></label>
<button type="submit">Prijavi se</button></form></main></body></html>`;
}

module.exports = { adminNav, loginPage };
