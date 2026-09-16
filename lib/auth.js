const crypto = require('crypto');

function parseCookies(req) {
  const out = {};
  const raw = req.headers.cookie || '';
  raw.split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i > -1) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

function signPayload(payload, secret) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifySignedPayload(token = '', secret) {
  try {
    const [data, sig] = token.split('.');
    if (!data || !sig) return null;
    const expected = crypto.createHmac('sha256', secret).update(data).digest('base64url');
    if (sig.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    return JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function createAuthHelpers(options) {
  const {
    adminUser,
    adminSessionSecret,
    adminCookie,
    formAccessPassword,
    formAccessDays,
    formCookie,
    formCookieSecret,
  } = options;

  function signSession(payload) {
    return signPayload(payload, adminSessionSecret);
  }

  function verifySession(token = '') {
    const payload = verifySignedPayload(token, adminSessionSecret);
    return Boolean(
      payload && payload.user === adminUser && Number(payload.exp || 0) > Date.now(),
    );
  }

  function signFormAccess() {
    return signPayload({
      ok: true,
      exp: Date.now() + formAccessDays * 24 * 60 * 60 * 1000,
    }, formCookieSecret);
  }

  function verifyFormAccess(token = '') {
    const payload = verifySignedPayload(token, formCookieSecret);
    return Boolean(payload && payload.ok === true && Number(payload.exp || 0) > Date.now());
  }

  function formAccessRequired(req, res, next) {
    if (!formAccessPassword) return next();
    const token = parseCookies(req)[formCookie];
    if (verifyFormAccess(token)) return next();
    const nextUrl = encodeURIComponent(req.originalUrl || '/');
    return res.redirect(`/access?next=${nextUrl}`);
  }

  function adminAuth(req, res, next) {
    const token = parseCookies(req)[adminCookie];
    if (verifySession(token)) return next();
    const nextUrl = encodeURIComponent(req.originalUrl || '/admin');
    return res.redirect(`/admin/login?next=${nextUrl}`);
  }

  return {
    adminAuth,
    formAccessRequired,
    parseCookies,
    signFormAccess,
    signSession,
    verifyFormAccess,
    verifySession,
  };
}

module.exports = {
  createAuthHelpers,
  parseCookies,
  signPayload,
  verifySignedPayload,
};
