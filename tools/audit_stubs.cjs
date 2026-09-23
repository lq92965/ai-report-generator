const fs = require('fs'), path = require('path');
const REPO = '/root/ai-report-generator';
const { isStubBody } = require(path.join(REPO, 'tools/stub-detect.cjs'));
const posts = JSON.parse(fs.readFileSync(path.join(REPO, 'data/posts.json'), 'utf8'));

let flagged = 0;
for (const p of posts) {
  if (!p.contentFile) continue;
  const mdPath = path.join(REPO, 'content', p.contentFile);
  if (!fs.existsSync(mdPath)) continue;
  const md = fs.readFileSync(mdPath, 'utf8');
  const pagePath = path.join(REPO, 'article-pages', `${p.type}-${p.id}.html`);
  if (!fs.existsSync(pagePath)) { console.log('MISSING  ' + p.type + '-' + p.id); flagged++; continue; }
  if (isStubBody(fs.readFileSync(pagePath, 'utf8'), md)) {
    console.log('STUB     ' + p.type + '-' + p.id);
    flagged++;
  }
}
console.log('---');
console.log('posts checked :', posts.length);
console.log('stubs flagged :', flagged);
