/**
 * Add an always-visible "Home" button in the header leading area of
 * blog.html and news.html, independent of the pagination back button.
 *
 * Rationale: #blog-list-back / #news-list-back are repurposed as
 * "Previous Page" controls and are JS-hidden on page 1. We want a
 * permanent way back to the homepage, so we add a dedicated button
 * that no JS touches.
 *
 * Also restores the pagination back button's own label ("Previous Page")
 * so the two controls do not duplicate text.
 */
const fs = require('fs');
const path = require('path');
const ROOT = '/root/ai-report-generator';

const HOME_BTN = (id) =>
  `<a id="${id}" href="index.html" class="home-btn" title="Back to Home" aria-label="Back to Home">` +
  `<i class="fas fa-home"></i><span class="home-btn-text">Home</span></a>`;

for (const { file, backId }
       of [{ file: 'blog.html', backId: 'blog-list-back' },
           { file: 'news.html', backId: 'news-list-back' }]) {
  const p = path.join(ROOT, file);
  let html = fs.readFileSync(p, 'utf8');

  // 1. Reset the pagination back button to its real purpose.
  const resetRe = new RegExp(
    `<a id="${backId}" href="index.html" class="unified-back-btn" aria-label="Back to Home">` +
    `<span class="back-arrow">←</span><span class="back-text">Back to Home</span></a>`
  );
  if (!resetRe.test(html)) {
    console.log(`WARN ${file}: back button markup not in expected state`);
  }
  html = html.replace(resetRe,
    `<a id="${backId}" href="${file}" class="unified-back-btn hidden" aria-hidden="true">` +
    `<span class="back-arrow">←</span><span class="back-text">Previous Page</span></a>`);

  // 2. Insert the dedicated Home button right after the logo anchor.
  const homeId = backId.replace('-list-back', '-home-btn');
  const logoEndRe = /(<a id="pwa-header-logo"[\s\S]*?<\/a>)/;
  if (!logoEndRe.test(html)) {
    console.log(`WARN ${file}: logo anchor not found`);
    continue;
  }
  if (html.includes(`id="${homeId}"`)) {
    console.log(`SKIP ${file}: home button already present`);
  } else {
    html = html.replace(logoEndRe, `$1\n                ${HOME_BTN(homeId)}`);
    console.log(`UPDATED ${file}: inserted #${homeId}`);
  }

  fs.writeFileSync(p, html, 'utf8');
}

// 3. Styles for the new button, appended to style.css.
const cssPath = path.join(ROOT, 'style.css');
let css = fs.readFileSync(cssPath, 'utf8');
const marker = '/* --- home-btn (list pages) --- */';
if (!css.includes(marker)) {
  css += `

${marker}
.home-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-left: 10px;
    padding: 5px 12px;
    font-size: 0.8125rem;
    font-weight: 600;
    color: #2563eb;
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    border-radius: 999px;
    text-decoration: none !important;
    white-space: nowrap;
    flex-shrink: 0;
    transition: background .15s ease, color .15s ease, border-color .15s ease;
}
.home-btn:hover {
    background: #2563eb;
    border-color: #2563eb;
    color: #ffffff;
}
.home-btn i {
    font-size: 0.8125rem;
    line-height: 1;
}
@media (max-width: 480px) {
    .home-btn { padding: 5px 9px; margin-left: 6px; }
    .home-btn .home-btn-text { display: none; }
}
`;
  fs.writeFileSync(cssPath, css, 'utf8');
  console.log('UPDATED style.css: appended .home-btn styles');
} else {
  console.log('SKIP style.css: styles already present');
}
