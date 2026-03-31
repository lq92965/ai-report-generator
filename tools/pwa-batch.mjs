/**
 * Batch PWA chrome for static HTML: manifest, has-app-nav, bottom nav, pwa-nav.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const HEAD_INJECT = `
    <meta name="theme-color" content="#2563eb">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <link rel="manifest" href="manifest.json">
    <link rel="apple-touch-icon" href="icons/icon-192.png">
    <link rel="stylesheet" href="style.css?v=3.1">`;

const BOTTOM_NAV = `
    <nav class="app-bottom-nav" aria-label="Main navigation">
        <a href="index.html" class="app-nav-item" data-nav="home"><i class="fas fa-house"></i><span>Home</span></a>
        <a href="news.html" class="app-nav-item" data-nav="news"><i class="fas fa-newspaper"></i><span>News</span></a>
        <a href="blog.html" class="app-nav-item" data-nav="blog"><i class="fas fa-book-open"></i><span>Blog</span></a>
        <a href="history.html" class="app-nav-item" data-nav="history"><i class="fas fa-clock-rotate-left"></i><span>History</span></a>
        <a href="profile.html" class="app-nav-item" data-nav="profile"><i class="fas fa-user"></i><span>Profile</span></a>
    </nav>
`;

const PWA_SCRIPT = `    <script src="pwa-nav.js"></script>
`;

function processFile(filePath) {
  let s = fs.readFileSync(filePath, 'utf8');
  if (s.includes('app-bottom-nav')) {
    console.log('skip (already has nav):', filePath);
    return;
  }

  if (!s.includes('manifest.json')) {
    s = s.replace(
      /(<meta\s+name="viewport"[^>]*>)/i,
      `$1${HEAD_INJECT}`
    );
  }

  if (s.includes('<body')) {
    s = s.replace(/<body([^>]*)>/i, (m, attrs) => {
      if (/class="/i.test(attrs)) {
        return `<body${attrs.replace(/class="/i, 'class="has-app-nav ')}>`;
      }
      return `<body class="has-app-nav"${attrs}>`;
    });
  }

  s = s.replace(
    /<header\s+class="main-header/g,
    '<header class="main-header pwa-app-header'
  );

  const footerIdx = s.indexOf('<footer');
  if (footerIdx === -1) {
    console.warn('no footer:', filePath);
    return;
  }
  s = s.slice(0, footerIdx) + BOTTOM_NAV + '\n    ' + s.slice(footerIdx);

  if (!s.includes('pwa-nav.js')) {
    s = s.replace(/<script\s+src="script\.js/i, `${PWA_SCRIPT}<script src="script.js`);
  }

  fs.writeFileSync(filePath, s, 'utf8');
  console.log('updated:', filePath);
}

const names = fs.readdirSync(root).filter((f) => /^(news|blog)-.+\.html$/.test(f));
for (const f of names) {
  processFile(path.join(root, f));
}
