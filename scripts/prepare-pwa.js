const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'public', 'index.html');
const serverPath = path.join(__dirname, '..', 'server.js');

const links = `  <link rel="manifest" href="/manifest.webmanifest">\n  <meta name="theme-color" content="#173a66">\n  <link rel="icon" href="/icons/porodicni-unos.svg" type="image/svg+xml">\n  <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">\n`;

let html = fs.readFileSync(indexPath, 'utf8');
if (!html.includes('rel="manifest"')) {
  html = html.replace('</head>', `${links}</head>`);
}
html = html.replace(
  /Porodični unos v2\.12\.\d+[^<]*/,
  'Porodični unos v2.12.3 – ista app ikona i na javnom unosu i u admin panelu.'
);
fs.writeFileSync(indexPath, html, 'utf8');

let server = fs.readFileSync(serverPath, 'utf8');
const adminNeedle = '<title>${esc(title)}</title><style>';
const adminReplacement = `<title>${esc(title)}</title>\n${links}<style>`;
if (!server.includes('admin-shell-pwa-icon')) {
  server = server.replace(
    adminNeedle,
    `<!-- admin-shell-pwa-icon -->\n${adminReplacement}`
  );
}
fs.writeFileSync(serverPath, server, 'utf8');
