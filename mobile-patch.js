/* 文件名：mobile-patch.js */
/* 作用：全站统一返回按钮管理 & 修复移动端图片缓存问题 */

document.addEventListener('DOMContentLoaded', function() {
    // -----------------------------------------
    // 第一步：雷霆扫穴 - 删除所有多余的旧返回按钮和文字
    // -----------------------------------------
    const oldButtons = document.querySelectorAll(
        '.pwa-page-back-icon, .mobile-back-btn, #dynamic-back-btn, a[href*="history.back"], .back-btn-container'
    );
    oldButtons.forEach(btn => btn.remove());

    // -----------------------------------------
    // 第二步：智能判断当前页面类型，设定统一文字
    // -----------------------------------------
    const currentPath = window.location.pathname;
    let btnText = '';
    let showButton = false;

    // 判断是否为具体的详情页 (例如 news-123.html, blog-456.html)
    const isDetailPage = (currentPath.includes('news-') && !currentPath.includes('news.html')) || 
                         (currentPath.includes('blog-') && !currentPath.includes('blog.html')) ||
                         currentPath.includes('/detail/');

    if (isDetailPage) {
        // 要求 3：详情页统一显示 Previous Page
        btnText = 'Previous Page';
        showButton = true;
    } else if (currentPath.includes('news.html')) {
        // 要求 2：news 板块首页显示 Back to News
        btnText = 'Back to News';
        showButton = true;
    } else if (currentPath.includes('blog.html')) {
        // 要求 2：blog 板块首页显示 Back to Blog
        btnText = 'Back to Blog';
        showButton = true;
    }

    // -----------------------------------------
    // 第三步：注入全站统一的全新返回按钮
    // -----------------------------------------
    if (showButton) {
        const backBtn = document.createElement('a');
        backBtn.href = 'javascript:history.back()';
        backBtn.className = 'unified-back-btn';
        
        // 统一使用内嵌的高清 SVG 箭头，确保全站大小和颜色绝对一致
        backBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="m15 18-6-6 6-6"/>
            </svg>
            <span>${btnText}</span>
        `;
        
        // 安全插入：找到页面的主内容区 (main)，如果没有 main 则放在 body 最前面，但避开 header
        const mainContent = document.querySelector('main') || document.body;
        if (mainContent.tagName.toLowerCase() === 'body') {
            const header = document.querySelector('header');
            if (header && header.nextSibling) {
                mainContent.insertBefore(backBtn, header.nextSibling);
            } else {
                mainContent.insertBefore(backBtn, mainContent.firstChild);
            }
        } else {
            mainContent.insertBefore(backBtn, mainContent.firstChild);
        }
    }

    // -----------------------------------------
    // 第四步：强制刷新用户头像缓存 (解决头像不更新)
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
});