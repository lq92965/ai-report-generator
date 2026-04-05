/**
 * Ensures every news-*.html / blog-*.html detail page has exactly
 * one unified back button in the header .pwa-header-leading (matches article.html).
 * Run: node tools/fix-detail-back-row.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const BLOCK = {
  news: `            <div class="pwa-header-leading flex items-center min-w-0 flex-shrink-0 max-w-[60%]">
                <a href="news.html" class="unified-back-btn"><span class="back-arrow">←</span><span class="back-text">Back to News</span></a>
            </div>
`,
  blog: `            <div class="pwa-header-leading flex items-center min-w-0 flex-shrink-0 max-w-[60%]">
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

  // Legacy: back row under header
  if (text.includes('pwa-page-back-row')) {
    text = text.replace(/<div class="pwa-page-back-row[^"]*"[^>]*>[\s\S]*?<\/div>\s*/g, '');
    changed = true;
  }

  const headerMatch = text.match(/<header[\s\S]*?<\/header>/);
  const hasBackInHeader = headerMatch && headerMatch[0].includes('unified-back-btn');

  if (!hasBackInHeader) {
    const block = BLOCK[kind];
    const logoAnchor = /<a[^>]*id="pwa-header-logo"[^>]*>[\s\S]*?<\/a>/;
    if (logoAnchor.test(text)) {
      text = text.replace(logoAnchor, block.trimEnd());
      changed = true;
    } else {
      const innerOpen = /<div class="container mx-auto px-6 pwa-header-inner">/;
      if (innerOpen.test(text)) {
        text = text.replace(innerOpen, (m) => `${m}\n${block}`);
        changed = true;
      } else {
        console.warn('[skip] no pwa-header-inner / logo to replace:', base);
      }
    }
  }

  if (!text.includes('lucide@latest') && !text.includes('lucide.min.js')) {
    const headEnd = text.indexOf('</head>');
    if (headEnd !== -1) {
      text = text.slice(0, headEnd) + LUCIDE_TAG + text.slice(headEnd);
      changed = true;
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
