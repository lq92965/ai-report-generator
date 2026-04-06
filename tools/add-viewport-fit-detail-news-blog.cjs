/**
 * news-*.html / blog-*.html / article.html：与首页一致加上 viewport-fit=cover，便于安全区与顶栏高度一致。
 * Run: node tools/add-viewport-fit-detail-news-blog.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
/* 兼容引号、可选自闭合 */
const RE =
    /<meta\s+name=["']viewport["']\s+content=["']width=device-width,\s*initial-scale=1\.0["']\s*\/?>/gi;

function touchFile(name) {
    if (!/^(news|blog)-.+\.html$/i.test(name) && name.toLowerCase() !== 'article.html') return false;
    const fp = path.join(ROOT, name);
    if (!fs.statSync(fp).isFile()) return false;
    let t = fs.readFileSync(fp, 'utf8');
    if (t.includes('viewport-fit=cover')) return false;
    const n = t.replace(
        RE,
        '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">'
    );
    if (n === t) return false;
    fs.writeFileSync(fp, n, 'utf8');
    return true;
}

let n = 0;
for (const name of fs.readdirSync(ROOT)) {
    if (touchFile(name)) {
        n += 1;
        console.log('[viewport-fit]', name);
    }
}
console.log('[add-viewport-fit-detail-news-blog] Updated', n, 'files.');
