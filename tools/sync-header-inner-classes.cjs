/**
 * Unify app header inner row with index.html:
 * app-header-shell pwa-header-inner flex flex-row flex-nowrap items-center justify-between w-full gap-3 md:gap-6
 * Run: node tools/sync-header-inner-classes.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CANON =
  'app-header-shell pwa-header-inner flex flex-row flex-nowrap items-center justify-between w-full gap-3 md:gap-6';

function processHtml(filePath) {
  let s = fs.readFileSync(filePath, 'utf8');
  const orig = s;

  s = s.replace(/container mx-auto px-6 pwa-header-inner/g, CANON);
  s = s.replace(/container pwa-header-inner" style="max-width: 1200px;"/g, `${CANON}"`);
  s = s.replace(/<div class="container pwa-header-inner">/g, `<div class="${CANON}">`);

  if (s !== orig) {
    fs.writeFileSync(filePath, s, 'utf8');
    return true;
  }
  return false;
}

function walk(dir, list = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === '.git' || name === 'android' || name === 'www') continue;
      walk(p, list);
    } else if (name.endsWith('.html')) list.push(p);
  }
  return list;
}

let n = 0;
for (const f of walk(ROOT)) {
  if (processHtml(f)) {
    console.log('OK', path.relative(ROOT, f));
    n++;
  }
}
console.log('Done. Updated', n, 'file(s).');
