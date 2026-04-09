/**
 * build_www.cjs — Copy frontend assets from repo root into ./www for Capacitor packaging.
 * Does not walk or copy: node_modules, android, .vscode, .cursor, services, tools, content, etc.
 * Run: node build_www.cjs
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const WWW = path.join(ROOT, 'www');

const FOLDERS_TO_COPY = ['images', 'icons', 'data', 'vendor'];

const FRONTEND_JS = new Set([
  'account.js',
  'payments.js',
  'config.js',
  'history.js',
  'index.js',
  'mobile-patch.js',
  'paypal-subscription.js',
  'profile.js',
  'pwa-nav.js',
  'script.js',
  'security.js',
  'subscription.js',
  'templates.js',
  'sw.js',
]);

const NAMED_ROOT_FILES = new Set([
  'manifest.json',
  'robots.txt',
  'sitemap.xml',
  'rss.xml',
  'trending_news_raw.json',
]);

const NEVER_COPY_JS = new Set(['server.js', 'auto_test.js']);

const LOGO_IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg', '.ico', '.gif']);

function isLogoImageAtRoot(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  if (!LOGO_IMAGE_EXT.has(ext)) return false;
  const base = path.basename(fileName, ext).toLowerCase();
  return base.includes('logo');
}

function emptyDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function copyDirRecursive(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) {
    console.log(`[skip] missing folder: ${path.relative(ROOT, srcDir)}`);
    return 0;
  }
  fs.cpSync(srcDir, destDir, { recursive: true });
  let count = 0;
  function walk(d) {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) walk(p);
      else count += 1;
    }
  }
  walk(destDir);
  return count;
}

function main() {
  console.log('[build_www] Cleaning', path.relative(ROOT, WWW) || 'www', '...');
  emptyDir(WWW);
  console.log('[build_www] www/ is empty and ready.\n');

  let total = 0;

  for (const name of FOLDERS_TO_COPY) {
    const src = path.join(ROOT, name);
    const dest = path.join(WWW, name);
    const n = copyDirRecursive(src, dest);
    total += n;
    console.log(`[ok] Copied folder ${name}/ (${n} files)`);
  }

  const entries = fs.readdirSync(ROOT, { withFileTypes: true });
  const counts = { html: 0, css: 0, js: 0, named: 0, logo: 0 };

  for (const ent of entries) {
    if (!ent.isFile()) continue;
    const name = ent.name;

    if (name.endsWith('.cjs')) {
      continue;
    }
    if (NEVER_COPY_JS.has(name)) {
      continue;
    }

    const ext = path.extname(name).toLowerCase();
    let take = false;
    let bucket = null;

    if (ext === '.html') {
      take = true;
      bucket = 'html';
    } else if (ext === '.css') {
      take = true;
      bucket = 'css';
    } else if (NAMED_ROOT_FILES.has(name)) {
      take = true;
      bucket = 'named';
    } else if (FRONTEND_JS.has(name)) {
      take = true;
      bucket = 'js';
    } else if (isLogoImageAtRoot(name)) {
      take = true;
      bucket = 'logo';
    }

    if (!take || !bucket) continue;

    const src = path.join(ROOT, name);
    const dest = path.join(WWW, name);
    copyFile(src, dest);
    total += 1;
    counts[bucket] += 1;
  }

  console.log(
    '[ok] Root files: .html ×',
    counts.html,
    ', .css ×',
    counts.css,
    ', frontend JS ×',
    counts.js,
    ', manifest/rss/etc ×',
    counts.named,
    ', logo images ×',
    counts.logo
  );
  const wwwScript = path.join(WWW, 'script.js');
  if (fs.existsSync(wwwScript)) {
    const st = fs.statSync(wwwScript);
    console.log('[ok] www/script.js (from repo script.js, ' + st.size + ' bytes)');
  } else {
    console.warn('[warn] www/script.js missing — check FRONTEND_JS in build_www.cjs');
  }
  console.log('\n[build_www] Success. Total files under www/:', total);
  console.log('[build_www] Output:', WWW);
}

try {
  main();
} catch (err) {
  console.error('[build_www] Failed:', err);
  process.exit(1);
}
