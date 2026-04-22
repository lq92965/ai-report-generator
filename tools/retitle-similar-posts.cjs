/**
 * Reduce title homogeneity in existing posts.json.
 * - Detect repeated leading stems (first 4 words)
 * - Rewrite titles with content-derived keyword suffixes
 * - Sync article-pages/{type}-{id}.html <title> and H1
 */
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const REPO = path.join(__dirname, '..');
const POSTS_PATH = path.join(REPO, 'data', 'posts.json');
const CONTENT_DIR = path.join(REPO, 'content');
const PAGES_DIR = path.join(REPO, 'article-pages');

function normalize(s) {
    return String(s || '').replace(/\s+/g, ' ').trim();
}

function stem4(s) {
    return normalize(s)
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 4)
        .join(' ');
}

function titleClean(s) {
    return normalize(s).replace(/[·|].*$/g, '').replace(/\.{3,}|…/g, '').trim();
}

function keywordFromMarkdown(md) {
    const STOP = new Set([
        'the', 'and', 'with', 'from', 'that', 'this', 'these', 'those', 'into', 'over', 'under',
        'about', 'there', 'their', 'while', 'where', 'which', 'what', 'when', 'were', 'been',
        'report', 'reporting', 'project', 'projects', 'team', 'teams', 'work', 'data', 'analysis',
        'global', 'critical', 'junction', 'reaches', 'guide'
    ]);
    const text = String(md || '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/[`#*_>\[\]\(\)]/g, ' ')
        .toLowerCase();
    const words = text.split(/[^a-z0-9]+/).filter((w) => w.length >= 5 && !STOP.has(w));
    const freq = new Map();
    for (const w of words) freq.set(w, (freq.get(w) || 0) + 1);
    const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]);
    return sorted.length ? sorted[0][0] : '';
}

function cap(w) {
    return w ? w.charAt(0).toUpperCase() + w.slice(1) : '';
}

function rewriteTitle(type, base, keyword, idx) {
    const k = cap(keyword) || (type === 'news' ? 'Markets' : 'Execution');
    const clean = titleClean(base);
    const newsTpl = [
        `${k} Outlook: ${clean}`,
        `${k} Shift Watch: ${clean}`,
        `${k} Strategy Brief: ${clean}`
    ];
    const blogTpl = [
        `${k} Playbook: ${clean}`,
        `${k} Team Guide: ${clean}`,
        `${k} Workflow Fix: ${clean}`
    ];
    const tpls = type === 'news' ? newsTpl : blogTpl;
    return tpls[idx % tpls.length];
}

function syncStaticHtml(post, newTitle) {
    const htmlPath = path.join(PAGES_DIR, `${post.type}-${post.id}.html`);
    if (!fs.existsSync(htmlPath)) return;
    const html = fs.readFileSync(htmlPath, 'utf8');
    const $ = cheerio.load(html, { decodeEntities: false });
    $('title').first().text(`${newTitle} - Reportify AI`);
    $('#article-header h1').first().text(newTitle);
    $('figure.article-cover img').first().attr('alt', newTitle);
    fs.writeFileSync(htmlPath, $.html(), 'utf8');
}

function main() {
    const posts = JSON.parse(fs.readFileSync(POSTS_PATH, 'utf8'));
    const byType = { news: [], blog: [] };
    for (const p of posts) if (p.type === 'news' || p.type === 'blog') byType[p.type].push(p);

    let changed = 0;
    for (const type of ['news', 'blog']) {
        const groups = new Map();
        for (const p of byType[type]) {
            const s = stem4(p.title);
            if (!groups.has(s)) groups.set(s, []);
            groups.get(s).push(p);
        }
        for (const [s, arr] of groups.entries()) {
            if (!s || arr.length < 5) continue;
            arr.sort((a, b) => String(b.id).localeCompare(String(a.id)));
            for (let i = 0; i < arr.length; i++) {
                const post = arr[i];
                const mdPath = path.join(CONTENT_DIR, post.contentFile);
                const md = fs.existsSync(mdPath) ? fs.readFileSync(mdPath, 'utf8') : '';
                const kw = keywordFromMarkdown(md);
                const nextTitle = rewriteTitle(type, post.title, kw, i);
                if (normalize(nextTitle) !== normalize(post.title)) {
                    post.title = nextTitle;
                    syncStaticHtml(post, nextTitle);
                    changed += 1;
                }
            }
        }
    }

    fs.writeFileSync(POSTS_PATH, JSON.stringify(posts, null, 4), 'utf8');
    console.log(`[retitle-similar-posts] retitled ${changed} posts`);
}

main();
