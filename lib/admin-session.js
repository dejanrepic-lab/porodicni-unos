// Signed admin session cookie with an optional "remember this device" lifetime.
// A remembered session renews itself while it is used, and every session ends when the admin password changes.
const crypto = require('crypto');

const COOKIE = 'porodicni_admin';

function createAdminSession({ secret, user, password, sessionHours = 12, rememberDays = 30, now = () => Date.now() }) {
  const shortMs = Math.max(1, Number(sessionHours) || 12) * 60 * 60 * 1000;
  const longMs = Math.max(1, Number(rememberDays) || 30) * 24 * 60 * 60 * 1000;
  const hmac = value => crypto.createHmac('sha256', secret).update(value).digest('base64url');
  // Binds sessions to the current password without storing or revealing it.
  const passwordVersion = hmac(`password:${user}:${password}`).slice(0, 16);

  function sign(payload) {
    const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${data}.${hmac(data)}`;
  }
  function verify(token = '') {
    try {
      const [data, sig] = String(token).split('.');
      if (!data || !sig) return null;
      const expected = hmac(data);
      if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
      const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
      if (payload.user !== user || payload.pv !== passwordVersion || !(Number(payload.exp) > now())) return null;
      return payload;
    } catch {
      return null;
    }
  }
  const isSecure = req => String(req.headers['x-forwarded-proto'] || req.protocol || '').split(',')[0].trim() === 'https';
  function setCookie(req, res, value, maxAgeSeconds) {
    const parts = [`${COOKIE}=${encodeURIComponent(value)}`, 'Path=/admin', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAgeSeconds}`];
    if (isSecure(req)) parts.push('Secure');
    const previous = res.getHeader('Set-Cookie');
    res.setHeader('Set-Cookie', [...(previous ? [].concat(previous) : []), parts.join('; ')]);
  }
  function issue(req, res, remember) {
    const lifetime = remember ? longMs : shortMs;
    setCookie(req, res, sign({ user, pv: passwordVersion, exp: now() + lifetime, ...(remember ? { r: 1 } : {}) }), Math.floor(lifetime / 1000));
  }
  function read(req, cookies) {
    return verify(cookies[COOKIE]);
  }
  // A remembered device stays signed in while it is used: past half its lifetime it gets a fresh one.
  function renew(req, res, payload) {
    if (payload?.r && payload.exp - now() < longMs / 2) issue(req, res, true);
  }
  function clear(req, res) {
    setCookie(req, res, '', 0);
  }
  return { cookie: COOKIE, issue, read, renew, clear, verify, rememberDays: Math.round(longMs / 86400000) };
}

module.exports = { createAdminSession };
