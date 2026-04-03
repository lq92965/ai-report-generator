/* 文件名：mobile-patch.js */
/* 作用：原生 App 文件下载拦截与分享、强刷头像缓存 */

document.addEventListener('DOMContentLoaded', function() {
    
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
    // 强刷头像缓存
    // -----------------------------------------
    window.addEventListener('pageshow', function() {
        const avatarImages = document.querySelectorAll('img.rounded-full, img[src*="avatar"]');
        avatarImages.forEach(img => {
            if (!img.src.includes('logo') && !img.src.includes('icon')) {
                let originalSrc = img.src.split('?')[0]; 
                img.src = originalSrc + '?v=' + new Date().getTime();
            }
        });
    });

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