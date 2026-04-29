const fs = require('fs');
const pages = fs.readdirSync('.').filter(f => f.endsWith('.html') && !f.startsWith('.'));
for (const p of pages) {
  let h = fs.readFileSync(p, 'utf8');
  let i = h.indexOf('</head>');
  if (i === -1) continue;
  let head = h.slice(0, i), body = h.slice(i), ch = false;
  while (true) {
    let f = head.indexOf('<!-- Open Graph / Social -->');
    if (f === -1) break;
    let s = head.indexOf('<!-- Open Graph / Social -->', f + 5);
    if (s === -1) break;
    let ends = [];
    for (let m of ['<!-- Twitter Card -->', 'rel="canonical"', 'application/ld+json']) {
      let pos = head.indexOf(m, s);
      if (pos !== -1) {
        let rest = head.slice(pos);
        if (m === 'application/ld+json') { let se = rest.indexOf('</script>'); if (se !== -1) ends.push(pos + se + 9); }
        else { let le = rest.indexOf('\n'); if (le !== -1) ends.push(pos + le); }
      }
    }
    if (ends.length) { head = head.slice(0, s) + head.slice(Math.max(...ends)); ch = true; } else break;
  }
  while ((head.match(/name="description"/g) || []).length > 1) {
    let fd = head.indexOf('name="description"');
    let sd = head.indexOf('name="description"', fd + 5);
    if (sd === -1) break;
    let ls = head.lastIndexOf('<', sd), le = head.indexOf('>', sd);
    if (ls !== -1 && le !== -1) { head = head.slice(0, ls) + head.slice(le + 1); ch = true; } else break;
  }
  while ((head.match(/application\/ld\+json/g) || []).length > 1) {
    let fd = head.indexOf('application/ld+json');
    let sd = head.indexOf('application/ld+json', fd + 5);
    if (sd === -1) break;
    let se = head.indexOf('</script>', sd);
    if (se !== -1) { head = head.slice(0, sd) + head.slice(se + 9); ch = true; } else break;
  }
  if (ch) { fs.writeFileSync(p, head + body, 'utf8'); console.log('Fixed: ' + p); }
}
console.log('Done!');
