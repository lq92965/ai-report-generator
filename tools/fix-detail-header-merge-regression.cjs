/**
 * 合并冲突后部分 news-/blog- 详情恢复成：顶栏 logo + 单独 pwa-page-back-row。
 * 还原为：app-header-shell + pwa-header-leading 内 unified-back-btn，去掉第二行返回区。
 * Run: node tools/fix-detail-header-merge-regression.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

/* 返回链可能是 unified-back-btn，也可能是 pwa-page-back-link + dynamic-back-btn */
const BLOCK_RE =
    /<header class="main-header pwa-app-header[^"]*">\s*<div class="container mx-auto px-6 pwa-header-inner">\s*<a href="index.html" class="logo"[\s\S]*?<\/a>\s*(<nav class="main-nav pwa-desktop-nav[\s\S]*?<\/nav>\s*<div class="pwa-header-actions"[\s\S]*?<\/div>)\s*<\/div>\s*<\/header>\s*<div class="pwa-page-back-row[^"]*"[^>]*>\s*(<a[\s\S]*?<\/a>)\s*<\/div>/i;

const REPLACEMENT = (navBlock, backA) => `    <header class="main-header pwa-app-header">
        <div class="app-header-shell pwa-header-inner flex flex-row flex-nowrap items-center justify-between w-full gap-3 md:gap-6">
                <div class="pwa-header-leading flex items-center min-w-0 flex-shrink-0 max-w-[60%]">
            ${backA.trim()}
        </div>
${navBlock.trim()}
        </div>
    </header>

`;

function isDetail(name) {
    return /^(news|blog)-.+\.html$/i.test(name);
}

let fixed = 0;
for (const name of fs.readdirSync(ROOT)) {
    if (!isDetail(name)) continue;
    const fp = path.join(ROOT, name);
    if (!fs.statSync(fp).isFile()) continue;
    let text = fs.readFileSync(fp, 'utf8');
    const m = text.match(BLOCK_RE);
    if (!m) continue;
    const next = text.replace(BLOCK_RE, REPLACEMENT(m[1], m[2]));
    if (next === text) continue;
    fs.writeFileSync(fp, next, 'utf8');
    fixed += 1;
    console.log('[fix-detail-header]', name);
}
console.log('[fix-detail-header-merge-regression] Done. Fixed', fixed, 'files.');
