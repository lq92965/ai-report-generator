/**
 * 顶栏内层改用 .app-header-shell，避免与 Tailwind .container 冲突。
 * Run: node tools/use-app-header-shell.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FROM =
  'container pwa-header-inner flex flex-row flex-nowrap items-center justify-between w-full gap-3 md:gap-6';
const TO =
  'app-header-shell pwa-header-inner flex flex-row flex-nowrap items-center justify-between w-full gap-3 md:gap-6';

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
  let s = fs.readFileSync(f, 'utf8');
  const orig = s;
  s = s.split(FROM).join(TO);
  if (s !== orig) {
    fs.writeFileSync(f, s, 'utf8');
    console.log('OK', path.relative(ROOT, f));
    n++;
  }
}
console.log('Done. Updated', n, 'file(s).');
