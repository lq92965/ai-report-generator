/**
 * Moves unified back link into header left (replaces logo block) and removes
 * the standalone .pwa-page-back-row on static news-*.html / blog-*.html.
 * Run: node tools/move-back-to-header-detail-pages.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function isDetail(name) {
  return /^news-\d+\.html$/.test(name) || /^blog-\d+\.html$/.test(name);
}

function transform(text, kind) {
  const listFile = kind === 'news' ? 'news.html' : 'blog.html';
  const label = kind === 'news' ? 'Back to News' : 'Back to Blog';

  const leading = `    <div class="pwa-header-leading flex items-center min-w-0 flex-shrink-0 max-w-[60%]">
            <a href="${listFile}" class="unified-back-btn"><span class="back-arrow">←</span><span class="back-text">${label}</span></a>
        </div>
`;

  const logoRe = /<a href="index\.html" class="logo"[^>]*>[\s\S]*?<\/a>\s*/i;
  if (!logoRe.test(text)) return null;

  text = text.replace(logoRe, leading);

  const rowRe = /\s*<div class="pwa-page-back-row[^>]*>[\s\S]*?<\/div>\s*/gi;
  text = text.replace(rowRe, '\n');

  return text;
}

let n = 0;
for (const f of fs.readdirSync(ROOT)) {
  if (!isDetail(f)) continue;
  const kind = f.startsWith('news-') ? 'news' : 'blog';
  const p = path.join(ROOT, f);
  const orig = fs.readFileSync(p, 'utf8');
  const next = transform(orig, kind);
  if (next == null || next === orig) continue;
  fs.writeFileSync(p, next, 'utf8');
  console.log('OK', f);
  n++;
}
console.log('Done.', n, 'file(s) updated.');
