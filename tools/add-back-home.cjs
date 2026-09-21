/**
 * Add a visible "Back to Home" button to blog.html and news.html headers.
 * The existing .unified-back-btn is `hidden` on these pages; we make it
 * point to index.html and remove the hidden class.
 */
const fs = require('fs');
const path = require('path');
const ROOT = '/root/ai-report-generator';

const targets = [
  { file: 'blog.html', label: 'Back to Home' },
  { file: 'news.html', label: 'Back to Home' },
];

for (const { file, label } of targets) {
  const p = path.join(ROOT, file);
  let html = fs.readFileSync(p, 'utf8');

  const oldPattern = /<a id="(blog|news)-list-back" href="[^"]*" class="unified-back-btn hidden" aria-hidden="true"><span class="back-arrow">←<\/span><span class="back-text">[^<]*<\/span><\/a>/;
  const newBtn = `<a id="${file.replace('.html','')}-list-back" href="index.html" class="unified-back-btn" aria-label="${label}"><span class="back-arrow">←</span><span class="back-text">${label}</span></a>`;

  if (oldPattern.test(html)) {
    html = html.replace(oldPattern, newBtn);
    fs.writeFileSync(p, html, 'utf8');
    console.log(`UPDATED ${file}: added visible "${label}" button`);
  } else {
    console.log(`SKIP ${file}: pattern not found`);
  }
}
