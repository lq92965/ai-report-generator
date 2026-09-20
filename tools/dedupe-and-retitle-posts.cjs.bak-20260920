/**
 * One-off / maintenance: dedupe posts.json (same title+date+excerpt), then
 * assign unique titles for remaining collisions using the first paragraph of content/*.md.
 * Updates: data/posts.json, content/*.md (cover alt), article-pages/type-id.html (title/h1), sitemap.xml, rss.xml
 *
 * Usage: node tools/dedupe-and-retitle-posts.cjs [--dry-run] [--no-delete]
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const REPO = path.join(__dirname, '..');
const POSTS_PATH = path.join(REPO, 'data', 'posts.json');
const CONTENT_DIR = path.join(REPO, 'content');
const ARTICLE_PAGES_DIR = path.join(REPO, 'article-pages');

function norm(s) {
    return String(s || '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

function exactKey(p) {
    return `${p.type}|${norm(p.title)}|${norm(p.date)}|${norm(p.excerpt)}`;
}

function dedupeExactTriples(posts) {
    const best = new Map();
    for (const p of posts) {
        const k = exactKey(p);
        const id = BigInt(p.id);
        if (!best.has(k) || BigInt(best.get(k).id) < id) best.set(k, p);
    }
    const kept = [...best.values()];
    const keptIds = new Set(kept.map((p) => p.id));
    const removed = posts.filter((p) => !keptIds.has(p.id));
    return { kept, removed };
}

function hookSentence(md) {
    const withoutFigure = String(md || '')
        .replace(/<figure[\s\S]*?<\/figure>\s*/gi, '')
        .replace(/<img[^>]*>\s*/gi, '')
        .trim();
    const firstBlock = withoutFigure.split(/\n\n+/)[0] || '';
    const text = firstBlock
        .replace(/^#+\s+/gm, '')
        .replace(/\*\*/g, '')
        .replace(/[#*`]/g, '')
        .replace(/\[[^\]]*\]/g, '')
        .trim();
    let m = text.match(/^([^.!?。！？]{8,200}[.!?。！？])/);
    let hook = m ? m[1] : text.slice(0, 160);
    hook = hook.replace(/\s+/g, ' ').trim();
    if (hook.length > 88) hook = hook.slice(0, 85) + '…';
    return hook || 'Further angle';
}

function escAttr(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function makeUniqueTitle(baseTitle, md, id, assignedNorm) {
    const hook = hookSentence(md);
    const baseShort = baseTitle.length > 58 ? baseTitle.slice(0, 55) + '…' : baseTitle;
    let candidate = `${baseShort} · ${hook}`;
    if (candidate.length > 128) candidate = candidate.slice(0, 125) + '…';
    let n = 0;
    while (assignedNorm.has(norm(candidate))) {
        n += 1;
        candidate = `${baseShort} · ${hook.slice(0, 42)} (${n})`;
        if (candidate.length > 128) candidate = candidate.slice(0, 125) + '…';
    }
    assignedNorm.add(norm(candidate));
    return candidate;
}

function retitleType(postsOfType) {
    const sorted = [...postsOfType].sort((a, b) => (BigInt(b.id) > BigInt(a.id) ? 1 : BigInt(b.id) < BigInt(a.id) ? -1 : 0));
    const assignedNorm = new Set();
    const changes = [];
    for (const post of sorted) {
        const nt = norm(post.title);
        if (!assignedNorm.has(nt)) {
            assignedNorm.add(nt);
            continue;
        }
        const mdPath = path.join(CONTENT_DIR, post.contentFile);
        let md = '';
        try {
            md = fs.readFileSync(mdPath, 'utf8');
        } catch (e) {
            md = post.excerpt || '';
        }
        const oldTitle = post.title;
        const newTitle = makeUniqueTitle(post.title, md, post.id, assignedNorm);
        post.title = newTitle;
        changes.push({ post, oldTitle, newTitle, mdPath, md });
    }
    return changes;
}

function writeSitemapAndRss(posts) {
    let sitemap =
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>https://www.goreportify.com/</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n';
    let rss =
        '<?xml version="1.0" encoding="UTF-8" ?>\n<rss version="2.0">\n<channel>\n  <title>Reportify AI Insights</title>\n  <link>https://www.goreportify.com</link>\n  <description>Latest tech insights and PM strategies</description>\n';
    posts.forEach((p) => {
        sitemap += `  <url>\n    <loc>https://www.goreportify.com/article-pages/${p.type}-${p.id}.html</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
        const pubDate = new Date(parseInt(p.id, 10)).toUTCString();
        rss += `  <item>\n    <title><![CDATA[${p.title}]]></title>\n    <link>https://www.goreportify.com/article-pages/${p.type}-${p.id}.html</link>\n    <description><![CDATA[${p.excerpt}]]></description>\n    <pubDate>${pubDate}</pubDate>\n  </item>\n`;
    });
    sitemap += '</urlset>';
    rss += '</channel>\n</rss>';
    fs.writeFileSync(path.join(REPO, 'sitemap.xml'), sitemap, 'utf8');
    fs.writeFileSync(path.join(REPO, 'rss.xml'), rss, 'utf8');
    const robots = `User-agent: *\nAllow: /\nAllow: /images/\nAllow: /content/\nAllow: /article-pages/\nSitemap: https://www.goreportify.com/sitemap.xml\n`;
    fs.writeFileSync(path.join(REPO, 'robots.txt'), robots, 'utf8');
}

function updateMarkdownAlt(mdPath, newTitle) {
    if (!fs.existsSync(mdPath)) return false;
    let md = fs.readFileSync(mdPath, 'utf8');
    const ea = escAttr(newTitle);
    const next = md.replace(/alt="[^"]*"/, `alt="${ea}"`);
    if (next !== md) {
        fs.writeFileSync(mdPath, next, 'utf8');
        return true;
    }
    return false;
}

function updateStaticHtml(htmlPath, newTitle) {
    if (!fs.existsSync(htmlPath)) return false;
    const html = fs.readFileSync(htmlPath, 'utf8');
    const $ = cheerio.load(html, { decodeEntities: false });
    $('title').first().text(`${newTitle} - Reportify AI`);
    $('#article-header h1').first().text(newTitle);
    $('figure.article-cover img').attr('alt', newTitle);
    $('#article-content img').first().attr('alt', newTitle);
    fs.writeFileSync(htmlPath, $.html(), 'utf8');
    return true;
}

function main() {
    const dry = process.argv.includes('--dry-run');
    const noDelete = process.argv.includes('--no-delete');
    let posts = JSON.parse(fs.readFileSync(POSTS_PATH, 'utf8'));

    const { kept, removed } = dedupeExactTriples(posts);
    console.log(`[dedupe] exact triple duplicates removed: ${posts.length - kept.length} (remaining ${kept.length})`);

    const news = kept.filter((p) => p.type === 'news');
    const blog = kept.filter((p) => p.type === 'blog');
    const other = kept.filter((p) => p.type !== 'news' && p.type !== 'blog');

    const changesNews = retitleType(news);
    const changesBlog = retitleType(blog);
    console.log(`[retitle] news titles adjusted: ${changesNews.length}, blog: ${changesBlog.length}`);

    const merged = [...news, ...blog, ...other].sort((a, b) => {
        const ba = BigInt(a.id);
        const bb = BigInt(b.id);
        if (bb > ba) return 1;
        if (bb < ba) return -1;
        return 0;
    });

    if (dry) {
        console.log('[dry-run] no files written.');
        return;
    }

    fs.writeFileSync(POSTS_PATH, JSON.stringify(merged, null, 4), 'utf8');
    writeSitemapAndRss(merged);

    for (const c of [...changesNews, ...changesBlog]) {
        updateMarkdownAlt(c.mdPath, c.newTitle);
        const htmlPath = path.join(ARTICLE_PAGES_DIR, `${c.post.type}-${c.post.id}.html`);
        updateStaticHtml(htmlPath, c.newTitle);
    }

    if (!noDelete && removed.length) {
        for (const p of removed) {
            const md = path.join(REPO, 'content', p.contentFile);
            const html = path.join(ARTICLE_PAGES_DIR, `${p.type}-${p.id}.html`);
            try {
                if (fs.existsSync(md)) fs.unlinkSync(md);
            } catch (e) {}
            try {
                if (fs.existsSync(html)) fs.unlinkSync(html);
            } catch (e) {}
        }
        console.log(`[delete] removed ${removed.length} orphan content/html pairs`);
    }

    console.log('[done] posts.json + sitemap/rss updated.');
}

main();
