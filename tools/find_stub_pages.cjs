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

// Count real rendered body nodes inside the #article-content region.
function bodyStats(html) {
  const start = html.indexOf('id="article-content"');
  if (start === -1) return { found: false };
  const open = html.indexOf('>', start) + 1;
  // walk to the matching close by scanning <div ...> / </div>
  let i = open, depth = 1, re = /<\/?div\b[^>]*>/g;
  let end = html.length;
  re.lastIndex = i;
  let m;
  while ((m = re.exec(html))) {
    if (m[0].startsWith('</')) { depth--; if (depth === 0) { end = m.index; break; } }
    else depth++;
  }
  const body = html.slice(open, end);
  const strip = body
    .replace(/<figure[\s\S]*?<\/figure>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return {
    found: true,
    h2: (body.match(/<h2\b/gi) || []).length,
    h3: (body.match(/<h3\b/gi) || []).length,
    p: (body.match(/<p\b/gi) || []).length,
    hasCover: /article-cover/.test(body),
    textLen: strip.length,
  };
}

const problems = [];
for (const p of posts) {
  if (!p.contentFile) continue;
  const mdPath = path.join(REPO, 'content', p.contentFile);
  if (!fs.existsSync(mdPath)) continue;
  const words = plainText(fs.readFileSync(mdPath, 'utf8')).split(' ').filter(Boolean).length;
  if (words < 150) continue; // markdown itself is thin; nothing to render
  const pagePath = path.join(REPO, 'article-pages', `${p.type}-${p.id}.html`);
  if (!fs.existsSync(pagePath)) { problems.push({ page: `${p.type}-${p.id}.html`, why: 'MISSING_FILE', words }); continue; }
  const st = bodyStats(fs.readFileSync(pagePath, 'utf8'));
  if (!st.found) { problems.push({ page: `${p.type}-${p.id}.html`, why: 'NO_CONTENT_DIV', words }); continue; }
  // A healthy page should render paragraphs and headings from its markdown.
  if (st.p < 5 || st.textLen < 600) {
    problems.push({ page: `${p.type}-${p.id}.html`, why: 'STUB_BODY', words, p: st.p, h2: st.h2, textLen: st.textLen });
  }
}
console.log('posts checked      :', posts.length);
console.log('problem pages      :', problems.length);
problems.forEach(x => console.log('   ', JSON.stringify(x)));
