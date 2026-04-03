/**
 * Ensures every news-*.html / blog-*.html detail page has exactly
 * one unified back button (matches article.html).
 * Run: node tools/fix-detail-back-row.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const BLOCK = {
  news: `    <div class="pwa-page-back-row max-w-4xl mx-auto px-6 mt-4">
        <a href="news.html" class="unified-back-btn"><span class="back-arrow">←</span><span class="back-text">Back to News</span></a>
    </div>
`,
  blog: `    <div class="pwa-page-back-row max-w-4xl mx-auto px-6 mt-4">
        <a href="blog.html" class="unified-back-btn"><span class="back-arrow">←</span><span class="back-text">Back to Blog</span></a>
    </div>
`,
};

const LUCIDE_TAG = '    <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>\n';

function isDetail(name) {
  return /^news-\d+\.html$/.test(name) || /^blog-\d+\.html$/.test(name);
}

function fixFile(filePath) {
  const base = path.basename(filePath);
  if (!isDetail(base)) return false;

  const kind = base.startsWith('news-') ? 'news' : 'blog';
  const listHref = kind === 'news' ? 'news.html' : 'blog.html';
  let text = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  if (text.includes('javascript:history.back()')) {
    text = text.replace(/href="javascript:history\.back\(\)"/g, `href="${listHref}"`);
    changed = true;
  }

  if (!text.includes('pwa-page-back-row')) {
    const marker = '</header>';
    const idx = text.indexOf(marker);
    if (idx === -1) {
      console.warn('[skip] no </header>:', base);
      return false;
    }
    const insertAt = idx + marker.length;
    text = text.slice(0, insertAt) + '\n' + BLOCK[kind] + text.slice(insertAt);
    changed = true;

    if (!text.includes('lucide@latest') && !text.includes('lucide.min.js')) {
      const headEnd = text.indexOf('</head>');
      if (headEnd !== -1) {
        text = text.slice(0, headEnd) + LUCIDE_TAG + text.slice(headEnd);
      }
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, text, 'utf8');
    return true;
  }
  return false;
}

const files = fs.readdirSync(ROOT).filter((f) => isDetail(f));
let n = 0;
for (const f of files) {
  if (fixFile(path.join(ROOT, f))) {
    console.log('OK', f);
    n++;
  }
}
console.log('Done. Updated', n, 'file(s).');
