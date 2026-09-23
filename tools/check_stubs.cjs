const fs = require('fs'), path = require('path');
const REPO = '/root/ai-report-generator';
const posts = JSON.parse(fs.readFileSync(path.join(REPO, 'data/posts.json'), 'utf8'));
function plainText(md) {
  return String(md)
    .replace(/<figure[\s\S]*?<\/figure>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/[#*`>_|\[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
let targets = [];
for (const p of posts) {
  if (!p.contentFile) continue;
  const mdPath = path.join(REPO, 'content', p.contentFile);
  if (!fs.existsSync(mdPath)) { targets.push(['NO_MD', p.type + '-' + p.id, 0, 0]); continue; }
  const words = plainText(fs.readFileSync(mdPath, 'utf8')).split(' ').filter(Boolean).length;
  const pagePath = path.join(REPO, 'article-pages', p.type + '-' + p.id + '.html');
  if (!fs.existsSync(pagePath)) { targets.push(['MISSING', p.type + '-' + p.id + '.html', words, 0]); continue; }
  const len = fs.statSync(pagePath).size;
  if (words < 150) { targets.push(['THIN_MD', p.type + '-' + p.id + '.html', words, len]); continue; }
  if (len < 12000) targets.push(['STUB', p.type + '-' + p.id + '.html', words, len]);
}
console.log('total posts      :', posts.length);
console.log('problem targets  :', targets.length);
const byKind = {};
targets.forEach(t => byKind[t[0]] = (byKind[t[0]] || 0) + 1);
console.log('by kind          :', JSON.stringify(byKind));
targets.slice(0, 25).forEach(t => console.log('   ', t.join('  ')));
