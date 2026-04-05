/* 文件名：mobile-patch.js */
/* 作用：原生 App 文件下载拦截与分享、强刷头像缓存 */

/* News/Blog 静态详情 + article.html：html 根类用于顶栏对齐（见 mobile-patch.css）；Capacitor / 缓存场景下 pathname 可能异常，DOM 就绪后再兜底一次 */
(function markNewsBlogDetailLayout() {
    function byUrl() {
        var raw = (location.pathname || '').replace(/^\/+/, '');
        try {
            raw = decodeURIComponent(raw);
        } catch (e) {}
        var f = (raw.split('/').pop() || '').split('?')[0].split('#')[0].toLowerCase();
        var href = (location.href || '').toLowerCase();
        if (/^(news|blog)-.+\.html$/i.test(f) || f === 'article.html') return true;
        if (/[\\/](news|blog)-[^/?#\\]+\.html/i.test(href)) return true;
        return false;
    }
    if (byUrl()) document.documentElement.classList.add('pwa-nb-detail-layout');
})();

document.addEventListener('DOMContentLoaded', function() {
    if (
        !document.documentElement.classList.contains('pwa-nb-detail-layout') &&
        document.querySelector('body.has-app-nav main.flex-grow > article.max-w-4xl.mx-auto')
    ) {
        document.documentElement.classList.add('pwa-nb-detail-layout');
    }

    // 检查是否在 Capacitor 原生 App 环境中
    const isNative = window.Capacitor && window.Capacitor.isNative;

    // -----------------------------------------
    // 拦截原生环境下的文件下载 (Word, PPT, Markdown)
    // -----------------------------------------
    if (isNative) {
        document.addEventListener('click', async function(e) {
            const target = e.target.closest('a');
            if (target && target.hasAttribute('download')) {
                e.preventDefault(); 

                const url = target.href;
                const filename = target.getAttribute('download') || 'Reportify_Document';

                try {
                    const { Filesystem, Directory } = window.Capacitor.Plugins.Filesystem;
                    const { Share } = window.Capacitor.Plugins.Share;
                    let base64Data;

                    if (url.startsWith('blob:')) {
                        const response = await fetch(url);
                        const blob = await response.blob();
                        base64Data = await new Promise((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                                resolve(reader.result.split(',')[1]);
                            };
                            reader.onerror = reject;
                            reader.readAsDataURL(blob);
                        });
                    } else if (url.startsWith('data:')) {
                        base64Data = url.split(',')[1];
                    } else {
                        window.open(url, '_system');
                        return;
                    }

                    // 写入手机系统文件
                    const savedFile = await Filesystem.writeFile({
                        path: filename,
                        data: base64Data,
                        directory: Directory.Documents
                    });

                    // 唤起手机底层的保存/分享弹窗
                    await Share.share({
                        title: filename,
                        text: 'Here is your Reportify document',
                        url: savedFile.uri,
                        dialogTitle: 'Save or Share Document'
                    });

                } catch (error) {
                    console.error('App download error:', error);
                    alert('Save failed. Please check permissions.');
                }
            }
        });
    }

    // -----------------------------------------
    // 头像缓存：仅在当前页 DOM 就绪时 bust 一次（pageshow 每次返回都改 src 会闪动、顶栏跳动）
    // -----------------------------------------
    (function bustAvatarCacheOnce() {
        const avatarImages = document.querySelectorAll('img.rounded-full, img[src*="avatar"]');
        avatarImages.forEach(img => {
            if (!img.src.includes('logo') && !img.src.includes('icon')) {
                const originalSrc = img.src.split('?')[0];
                img.src = originalSrc + '?v=' + Date.now();
            }
        });
    })();

    // -----------------------------------------
    // News/Blog 静态详情页：列表链接带 ?lp=当前页
    // lp≤1：← Back to News / Back to Blog → news.html / blog.html
    // lp≥2：← Previous Page → news.html?p=lp / blog.html?p=lp（回到进入详情前的那一页）
    // （样式沿用页面上的 .unified-back-btn，不在此改字体颜色）
    // -----------------------------------------
    (function applyNewsBlogDetailBackFromLp() {
        const file = (location.pathname.split('/').pop() || '').toLowerCase();
        const m = file.match(/^(news|blog)-(\d+)\.html$/);
        if (!m) return;

        const kind = m[1];
        const listFile = kind === 'news' ? 'news.html' : 'blog.html';
        const params = new URLSearchParams(window.location.search);
        const lp = parseInt(params.get('lp'), 10) || 1;

        const a =
            document.querySelector('.pwa-header-leading .unified-back-btn') ||
            document.querySelector('.pwa-header-leading a#dynamic-back-btn') ||
            document.querySelector('.pwa-header-leading a.pwa-page-back-link') ||
            document.querySelector('.pwa-page-back-row a');
        if (!a) return;

        a.classList.add('unified-back-btn');
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
});

// 同站多页 HTML 跳转：支持时用 View Transition，减轻白屏闪一下（Chrome / 部分 WebView）
(function setupAppViewTransitions() {
    if (typeof document.startViewTransition !== 'function') return;
    document.addEventListener(
        'click',
        function (e) {
            if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            var a = e.target.closest && e.target.closest('a[href]');
            if (!a || a.target === '_blank' || a.getAttribute('download')) return;
            var href = a.getAttribute('href');
            if (!href || href.charAt(0) === '#' || href.indexOf('javascript:') === 0) return;
            var url;
            try {
                url = new URL(a.href, window.location.href);
            } catch (err) {
                return;
            }
            if (url.origin !== window.location.origin) return;
            if (url.pathname === window.location.pathname && url.search === window.location.search) return;
            e.preventDefault();
            document.startViewTransition(function () {
                window.location.href = url.href;
            });
        },
        true
    );
})();