/**
 * Backfill missing article-pages/{type}-{id}.html from data/posts.json + content/*.md.
 * Readonly-safe for existing files: only creates when missing.
 */
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const REPO = path.join(__dirname, '..');
const POSTS_PATH = path.join(REPO, 'data', 'posts.json');
const TEMPLATE_PATH = path.join(REPO, 'article.html');
const CONTENT_DIR = path.join(REPO, 'content');
const OUT_DIR = path.join(REPO, 'article-pages');

function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function cleanupTemplateRuntimeScripts($) {
    $('script').each((i, el) => {
        const txt = $(el).html();
        if (txt && txt.includes('获取并渲染文章正文的逻辑')) {
            $(el).html(txt.split('// 获取并渲染文章正文的逻辑')[0]);
        }
    });
}

(async () => {
    const { marked } = await import('marked');
    ensureDir(OUT_DIR);

    const posts = JSON.parse(fs.readFileSync(POSTS_PATH, 'utf8'));
    const templateHtml = fs.readFileSync(TEMPLATE_PATH, 'utf8');
    let created = 0;

    for (const post of posts) {
        const outName = `${post.type}-${post.id}.html`;
        const outPath = path.join(OUT_DIR, outName);
        if (fs.existsSync(outPath)) continue;

        const mdPath = path.join(CONTENT_DIR, post.contentFile);
        if (!fs.existsSync(mdPath)) continue;
        const md = fs.readFileSync(mdPath, 'utf8');

        const $ = cheerio.load(templateHtml, { decodeEntities: false });
        $('title').text(`${post.title} - Reportify AI`);
        $('meta[name="description"]').attr('content', post.excerpt || '');

        const backLink = post.type === 'news' ? 'news.html' : 'blog.html';
        const sectionName = post.type === 'news' ? 'News' : 'Blog';
        $('.unified-back-btn')
            .attr('href', backLink)
            .html(`<span class="back-arrow">←</span><span class="back-text">Back to ${sectionName}</span>`);
        $('#dynamic-back-btn').remove();
        $('.pwa-page-back-link').not('.unified-back-btn').remove();

        const headerHtml =
            `<div class="flex items-center gap-3 text-sm font-bold text-blue-600 uppercase tracking-wider mb-4">` +
            `<span>${post.category || (post.type === 'news' ? 'Tech Radar' : 'Deep Insights')}</span>` +
            `<span class="text-gray-300">|</span>` +
            `<span class="text-gray-500"><i class="far fa-calendar-alt"></i> ${post.date || ''}</span>` +
            `</div>` +
            `<h1 class="text-3xl md:text-5xl font-extrabold text-gray-900 mb-6 leading-tight">${post.title}</h1>` +
            `<div class="flex items-center gap-4 text-gray-600 font-medium">` +
            `<div class="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-lg"><i class="fas fa-user-edit"></i></div>` +
            `<div class="text-gray-900 font-bold">${post.author || 'Reportify Editorial Team'}<div class="text-xs text-gray-400">Staff Writer</div></div>` +
            `</div>`;
        $('#article-header').html(headerHtml);
        $('#article-content').removeClass('text-center text-gray-400 py-10').html(marked.parse(md));
        cleanupTemplateRuntimeScripts($);

        fs.writeFileSync(outPath, $.html(), 'utf8');
        created += 1;
    }

    console.log(`[backfill-article-pages] created ${created} missing files`);
})();
