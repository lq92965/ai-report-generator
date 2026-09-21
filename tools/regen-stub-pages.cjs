/**
 * Regenerate article-pages + posts.json excerpts for articles whose markdown
 * was just repaired (previously stub / cover-image-only bodies).
 * Only touches posts whose content file is now substantial but whose static
 * page is still an old stub.
 */
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const REPO = '/root/ai-report-generator';
const POSTS_PATH = path.join(REPO, 'data', 'posts.json');
const TEMPLATE_PATH = path.join(REPO, 'article.html');
const CONTENT_DIR = path.join(REPO, 'content');
const OUT_DIR = path.join(REPO, 'article-pages');

function cleanupTemplateRuntimeScripts($) {
    $('script').each((i, el) => {
        const txt = $(el).html();
        if (txt && txt.includes('获取并渲染文章正文的逻辑')) {
            $(el).html(txt.split('// 获取并渲染文章正文的逻辑')[0]);
        }
    });
}

function plainText(md) {
    return String(md)
        .replace(/<figure[\s\S]*?<\/figure>/gi, ' ')
        .replace(/<[^>]*>/g, ' ')
        .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
        .replace(/[#*`>_|\[\]()]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

(async () => {
    const { marked } = await import('marked');
    const posts = JSON.parse(fs.readFileSync(POSTS_PATH, 'utf8'));
    const templateHtml = fs.readFileSync(TEMPLATE_PATH, 'utf8');

    // Targets: markdown body is now healthy AND the static page is still tiny/stub.
    const targets = posts.filter((post) => {
        if (!post.contentFile) return false;
        const mdPath = path.join(CONTENT_DIR, post.contentFile);
        if (!fs.existsSync(mdPath)) return false;
        const md = fs.readFileSync(mdPath, 'utf8');
        const words = plainText(md).split(' ').filter(Boolean).length;
        if (words < 150) return false;
        const pagePath = path.join(OUT_DIR, `${post.type}-${post.id}.html`);
        if (!fs.existsSync(pagePath)) return true;
        const page = fs.readFileSync(pagePath, 'utf8');
        // A stub page renders almost no body text inside #article-content.
        return page.length < 12000;
    });

    let updated = 0;
    for (const post of targets) {
        const mdPath = path.join(CONTENT_DIR, post.contentFile);
        const md = fs.readFileSync(mdPath, 'utf8');

        // Refresh excerpt from the repaired body.
        const text = plainText(md);
        const excerpt = text.slice(0, 150).trim() + '...';
        post.excerpt = excerpt;

        const $ = cheerio.load(templateHtml, { decodeEntities: false });
        $('title').text(`${post.title} - Reportify AI`);
        $('meta[name="description"]').attr('content', excerpt);

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

        fs.writeFileSync(path.join(OUT_DIR, `${post.type}-${post.id}.html`), $.html(), 'utf8');
        console.log(`UPDATED ${post.type}-${post.id}.html  excerpt="${excerpt.slice(0, 60)}..."`);
        updated += 1;
    }

    fs.writeFileSync(POSTS_PATH, JSON.stringify(posts, null, 2), 'utf8');
    console.log(`[regen-stub-pages] updated ${updated} article pages; posts.json rewritten`);
})();
