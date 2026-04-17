const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { execSync } = require('child_process');

const REPO_DIR = __dirname;
const posts = JSON.parse(fs.readFileSync(path.join(REPO_DIR, 'data', 'posts.json'), 'utf8'));
const templateHtml = fs.readFileSync(path.join(REPO_DIR, 'article.html'), 'utf8');

(async () => {
    const { marked } = await import('marked');

    console.log("🚀 启动时光机 V8：批量修复历史静态网页的返回按钮与文字...");
    let count = 0;

    for (const post of posts) {
        const mdPath = path.join(REPO_DIR, 'content', post.contentFile);
        if (!fs.existsSync(mdPath)) continue;

        const $ = cheerio.load(templateHtml);
        $('title').text(`${post.title} - Reportify AI`);
        $('meta[name="description"]').attr('content', post.excerpt);

        const backLink = post.type === 'news' ? 'news.html' : 'blog.html';
        const backText = post.type === 'news' ? '<i class="fas fa-arrow-left"></i> Back to News' : '<i class="fas fa-arrow-left"></i> Back to Blog';
        $('#dynamic-back-btn').attr('href', backLink).html(backText);

        const headerHtml = `<div class="flex items-center gap-3 text-sm font-bold text-blue-600 uppercase tracking-wider mb-4"><span>${post.category}</span><span class="text-gray-300">|</span><span class="text-gray-500"><i class="far fa-calendar-alt"></i> ${post.date}</span></div><h1 class="text-3xl md:text-5xl font-extrabold text-gray-900 mb-6 leading-tight">${post.title}</h1><div class="flex items-center gap-4 text-gray-600 font-medium"><div class="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-lg"><i class="fas fa-user-edit"></i></div><div><div class="text-gray-900 font-bold">${post.author || 'Reportify Editorial Team'}</div><div class="text-xs text-gray-400">Staff Writer</div></div></div>`;
        $('#article-header').html(headerHtml);
        $('#article-content').removeClass('text-center text-gray-400 py-10').html(marked.parse(fs.readFileSync(mdPath, 'utf8')));

        $('script').each((i, el) => {
            const text = $(el).html();
            if (text && text.includes('获取并渲染文章正文的逻辑')) $(el).html(text.split('// 获取并渲染文章正文的逻辑')[0]);
        });

        const staticFile = `${post.type}-${post.id}.html`;
        fs.writeFileSync(path.join(REPO_DIR, staticFile), $.html(), 'utf8');
        count++;
    }

    console.log(`🎉 历史静态化修复完毕！成功拯救 ${count} 个真实网页。`);
    try {
        execSync('git add *.html sitemap.xml && git commit -m "fix(UX): Correct back button text and href on all historical static pages" && git pull origin main --rebase && git push origin main', { cwd: REPO_DIR });
        console.log("✅ GitHub 同步完成！您网站的返回逻辑已完美无瑕！");
    } catch (e) {
        console.error("推送报错，请检查终端", e.message);
    }
})().catch((err) => {
    console.error(err);
    process.exit(1);
});
