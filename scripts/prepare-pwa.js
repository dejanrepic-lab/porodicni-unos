const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'public', 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

const links = `  <link rel="manifest" href="/manifest.webmanifest">\n  <meta name="theme-color" content="#173a66">\n  <link rel="icon" href="/icons/porodicni-unos.svg" type="image/svg+xml">\n  <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">\n`;

if (!html.includes('rel="manifest"')) {
  html = html.replace('</head>', `${links}</head>`);
  fs.writeFileSync(indexPath, html, 'utf8');
}
