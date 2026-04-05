/**
 * 统一 <header> 与首页一致：去掉多余 Tailwind 与内联 style（由 style.css .main-header.pwa-app-header 控制）
 * Run: node tools/normalize-pwa-app-headers.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

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

function processFile(filePath) {
  let s = fs.readFileSync(filePath, 'utf8');
  const orig = s;

  s = s.replace(
    /class="main-header pwa-app-header bg-white shadow-sm border-b border-gray-200 py-4"/g,
    'class="main-header pwa-app-header"'
  );
  s = s.replace(
    /class="main-header account-header pwa-app-header bg-white shadow-sm border-b border-gray-200 py-4"/g,
    'class="main-header account-header pwa-app-header"'
  );
  s = s.replace(
    /class="main-header account-header pwa-app-header" style="background: #fff; border-bottom: 1px solid #e2e8f0;"/g,
    'class="main-header account-header pwa-app-header"'
  );
  s = s.replace(
    /class="main-header account-header pwa-app-header" style="background: white; border-bottom: 1px solid #e2e8f0;"/g,
    'class="main-header account-header pwa-app-header"'
  );

  if (s !== orig) {
    fs.writeFileSync(filePath, s, 'utf8');
    return true;
  }
  return false;
}

let n = 0;
for (const f of walk(ROOT)) {
  if (processFile(f)) {
    console.log('OK', path.relative(ROOT, f));
    n++;
  }
}
console.log('Done. Updated', n, 'file(s).');
