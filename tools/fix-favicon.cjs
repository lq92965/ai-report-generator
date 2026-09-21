/**
 * fix-favicon.cjs
 *
 * Problem (confirmed 2026-09-21): no page declares a standard
 * `<link rel="icon">`. Pages only carry an `apple-touch-icon` (and only 12 of
 * 20 top-level files even have that). Browsers therefore request
 * /favicon.ico, which 404s — so every page shows a blank/broken tab icon and
 * logs a console 404.
 *
 * Fix:
 *   1. Insert `<link rel="icon" ...>` + `<link rel="shortcut icon" ...>`
 *      + apple-touch-icon immediately after <head> on every page that lacks it.
 *   2. Optionally emit a real /favicon.ico at the web root.
 *
 * Idempotent.
 *
 * Usage:
 *   node tools/fix-favicon.cjs           # dry run
 *   node tools/fix-favicon.cjs --apply
 */
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const APPLY = process.argv.includes('--apply');

const TAGS = [
    '<link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192.png">',
    '<link rel="icon" type="image/png" sizes="512x512" href="icons/icon-512.png">',
    '<link rel="shortcut icon" href="icons/icon-192.png">',
    '<link rel="apple-touch-icon" href="icons/icon-192.png">',
].join('\n    ');

function collectHtml(dir, out = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name === 'node_modules' || e.name === '.git') continue;
        const full = path.join(dir, e.name);
        if (e.isDirectory()) collectHtml(full, out);
        else if (e.name.endsWith('.html')) out.push(full);
    }
    return out;
}

function main() {
    const files = collectHtml(REPO).filter((f) => !f.includes('node_modules'));
    let changed = 0, already = 0;

    for (const f of files) {
        let html = fs.readFileSync(f, 'utf8');
        if (/<link[^>]+rel=["']icon["']/i.test(html)) { already += 1; continue; }

        // Insert right after the opening <head> tag.
        const m = html.match(/<head[^>]*>/i);
        if (!m) continue;

        // Drop the now-duplicated bare apple-touch-icon if present, we re-add it.
        html = html.replace(/\s*<link[^>]*rel=["']apple-touch-icon["'][^>]*>\s*/gi, '\n');

        const idx = m.index + m[0].length;
        html = html.slice(0, idx) + '\n    ' + TAGS + '\n' + html.slice(idx);

        if (APPLY) fs.writeFileSync(f, html, 'utf8');
        changed += 1;
    }

    console.log(`[fix-favicon] html files: ${files.length}`);
    console.log(`  already had rel=icon: ${already}`);
    console.log(`  to update: ${changed}`);
    console.log(APPLY ? '  ✅ WRITTEN' : '  (dry run — pass --apply)');
}

main();
