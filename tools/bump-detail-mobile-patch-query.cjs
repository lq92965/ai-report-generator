/**
 * 给 news-*.html / blog-*.html / article.html 的 mobile-patch 资源加 ?v=，避免 WebView / SW 长期缓存旧 CSS/JS。
 * 发版改顶栏时递增 MPATCH_VER 后运行：node tools/bump-detail-mobile-patch-query.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MPATCH_VER = '10';

function shouldPatch(name) {
    return /^(news|blog)-.+\.html$/i.test(name) || name.toLowerCase() === 'article.html';
}

let n = 0;
for (const name of fs.readdirSync(ROOT)) {
    if (!shouldPatch(name)) continue;
    const fp = path.join(ROOT, name);
    if (!fs.statSync(fp).isFile()) continue;
    let t = fs.readFileSync(fp, 'utf8');
    const next = t
        .replace(/href="mobile-patch\.css(\?[^"]*)?"/g, `href="mobile-patch.css?v=${MPATCH_VER}"`)
        .replace(/src="mobile-patch\.js(\?[^"]*)?"/g, `src="mobile-patch.js?v=${MPATCH_VER}"`);
    if (next !== t) {
        fs.writeFileSync(fp, next, 'utf8');
        n += 1;
        console.log('[bump]', name);
    }
}
console.log('[bump-detail-mobile-patch-query] Updated', n, 'files. VER=', MPATCH_VER);
