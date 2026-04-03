/* 文件名：mobile-patch.js */
/* 作用：头像缓存刷新 + News/Blog 列表与详情页统一返回按钮逻辑 */

document.addEventListener('DOMContentLoaded', function () {
    window.addEventListener('pageshow', function () {
        const avatarImages = document.querySelectorAll('img.rounded-full, img[src*="avatar"]');
        avatarImages.forEach((img) => {
            if (!img.src.includes('logo') && !img.src.includes('icon')) {
                const originalSrc = img.src.split('?')[0];
                img.src = originalSrc + '?v=' + new Date().getTime();
            }
        });
    });

    /**
     * 详情页若存在两行返回（pwa-page-back-row + 下方重复的 container 块），只保留第一行。
     */
    (function dedupeNewsBlogDetailBackDom() {
        const file = (location.pathname.split('/').pop() || '').toLowerCase();
        if (!/^(news|blog)-\d+\.html$/.test(file)) return;

        document.querySelectorAll('.pwa-page-back-row').forEach((row, idx) => {
            if (idx > 0) row.remove();
        });

        document.querySelectorAll('a#dynamic-back-btn').forEach((a) => {
            if (a.closest('.pwa-page-back-row')) return;
            const wrap = a.closest('div.container');
            if (wrap && /mb-2\s+mt-8|mt-8\s+mb-2/.test(wrap.className)) {
                wrap.remove();
                return;
            }
            a.remove();
        });

        const row = document.querySelector('.pwa-page-back-row');
        if (!row) return;
        const links = row.querySelectorAll('a');
        links.forEach((a, idx) => {
            if (idx > 0) a.remove();
        });
    })();

    /**
     * 静态详情页 news-*.html / blog-*.html：根据 URL 参数 lp（列表页码）设置文案与跳转。
     * lp 缺省或 ≤1：← Back to News / Back to Blog → 对应列表首页
     * lp ≥2：← Previous Page → 对应列表的该页 news.html?p=lp
     */
    (function applyNewsBlogDetailBackFromLp() {
        const file = (location.pathname.split('/').pop() || '').toLowerCase();
        const m = file.match(/^(news|blog)-(\d+)\.html$/);
        if (!m) return;

        const kind = m[1];
        const listFile = kind === 'news' ? 'news.html' : 'blog.html';
        const params = new URLSearchParams(window.location.search);
        const lp = parseInt(params.get('lp'), 10) || 1;

        const a = document.querySelector('.pwa-page-back-row a');
        if (!a) return;

        a.classList.add('unified-back-btn');
        a.classList.remove('pwa-page-back-link');
        a.removeAttribute('id');

        if (lp <= 1) {
            a.setAttribute('href', listFile);
            a.innerHTML =
                '<span class="back-arrow">←</span><span class="back-text">Back to ' +
                (kind === 'news' ? 'News' : 'Blog') +
                '</span>';
        } else {
            a.setAttribute('href', listFile + '?p=' + encodeURIComponent(String(lp)));
            a.innerHTML =
                '<span class="back-arrow">←</span><span class="back-text">Previous Page</span>';
        }
    })();

    // 旧模板：Lucide / FontAwesome 返回链，统一为 unified-back-btn（非 news/blog 详情时按 href 推断文案）
    const candidates = document.querySelectorAll('a#dynamic-back-btn, a.pwa-page-back-link');
    const fileLower = (location.pathname.split('/').pop() || '').toLowerCase();
    const isNewsBlogDetail = /^(news|blog)-\d+\.html$/.test(fileLower);

    const toSectionName = (href, rawText) => {
        const txt = (rawText || '').trim();
        const m = txt.match(/Back to\s+(.+)$/i);
        if (m) return m[1].trim();
        if (txt.toLowerCase().includes('previous')) {
            if ((href || '').includes('news.html')) return 'News';
            if ((href || '').includes('blog.html')) return 'Blog';
            if ((href || '').includes('account.html')) return 'Account Hub';
        }
        if ((href || '').includes('news.html')) return 'News';
        if ((href || '').includes('blog.html')) return 'Blog';
        if ((href || '').includes('account.html')) return 'Account Hub';
        return null;
    };

    candidates.forEach((a) => {
        if (isNewsBlogDetail) return;

        const href = a.getAttribute('href') || '';
        const sectionName = toSectionName(href, a.textContent);
        if (!sectionName) return;

        const row = a.closest('.pwa-page-back-row');
        if (row) {
            const unified = Array.from(row.querySelectorAll('a.unified-back-btn'));
            if (unified.length > 1) {
                unified.slice(1).forEach((el) => el.remove());
            }
        }

        a.className = 'unified-back-btn';
        a.removeAttribute('id');
        a.innerHTML =
            '<span class="back-arrow">←</span><span class="back-text">Back to ' + sectionName + '</span>';
    });

    document.querySelectorAll('.pwa-page-back-row').forEach((row) => {
        const links = Array.from(row.querySelectorAll('a.unified-back-btn'));
        if (links.length <= 1) return;
        links.slice(1).forEach((el) => el.remove());
    });
});
