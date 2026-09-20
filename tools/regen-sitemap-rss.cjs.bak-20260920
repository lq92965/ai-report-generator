/**
 * Regenerate sitemap.xml + rss.xml + robots.txt from data/posts.json.
 * URLs use /article-pages/{type}-{id}.html (standalone SEO pages).
 */
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const posts = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'posts.json'), 'utf8'));

let sitemap =
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>https://www.goreportify.com/</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n';

let rss =
    '<?xml version="1.0" encoding="UTF-8" ?>\n<rss version="2.0">\n<channel>\n  <title>Reportify AI Insights</title>\n  <link>https://www.goreportify.com</link>\n  <description>Latest tech insights and PM strategies</description>\n';

for (const p of posts) {
    sitemap += `  <url>\n    <loc>https://www.goreportify.com/article-pages/${p.type}-${p.id}.html</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
    const pubDate = new Date(parseInt(p.id, 10)).toUTCString();
    rss += `  <item>\n    <title><![CDATA[${p.title}]]></title>\n    <link>https://www.goreportify.com/article-pages/${p.type}-${p.id}.html</link>\n    <description><![CDATA[${p.excerpt}]]></description>\n    <pubDate>${pubDate}</pubDate>\n  </item>\n`;
}

sitemap += '</urlset>';
rss += '</channel>\n</rss>';

fs.writeFileSync(path.join(REPO, 'sitemap.xml'), sitemap, 'utf8');
fs.writeFileSync(path.join(REPO, 'rss.xml'), rss, 'utf8');

const robots = `User-agent: *\nAllow: /\nAllow: /images/\nAllow: /content/\nAllow: /article-pages/\nSitemap: https://www.goreportify.com/sitemap.xml\n`;
fs.writeFileSync(path.join(REPO, 'robots.txt'), robots, 'utf8');

console.log('[regen-sitemap-rss] wrote sitemap.xml, rss.xml, robots.txt');
