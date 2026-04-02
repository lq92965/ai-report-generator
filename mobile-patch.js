/* 文件名：mobile-patch.js */
/* 作用：动态注入返回按钮 & 解决移动端图片缓存不刷新问题 */

document.addEventListener('DOMContentLoaded', function() {
    // -----------------------------------------
    // 功能 1：动态注入详情页返回按钮
    // -----------------------------------------
    const currentPath = window.location.pathname;
    const isDetailPage = currentPath.includes('news-') || 
                         currentPath.includes('blog-') || 
                         currentPath.includes('/news/') || 
                         currentPath.includes('/blog/');

    if (isDetailPage && !document.querySelector('.mobile-back-btn')) {
        const backBtn = document.createElement('a');
        backBtn.href = 'javascript:history.back()';
        backBtn.className = 'mobile-back-btn';
        backBtn.innerHTML = '&#8592;'; 
        document.body.insertBefore(backBtn, document.body.firstChild);
    }

    // -----------------------------------------
    // 功能 2：强制刷新用户头像缓存 (解决头像不更新)
    // -----------------------------------------
    // 监听页面重新显示事件 (例如从相册选择完图片返回，或者页面重载)
    window.addEventListener('pageshow', function() {
        // 查找页面中所有可能是头像的 img 标签
        const avatarImages = document.querySelectorAll('img.rounded-full, img[src*="avatar"]');
        
        avatarImages.forEach(img => {
            // 排除系统 logo 或默认图标
            if (!img.src.includes('logo') && !img.src.includes('icon')) {
                // 利用时间戳 (Timestamp) 破坏浏览器缓存机制，强迫去服务器拉取最新头像
                let originalSrc = img.src.split('?')[0]; 
                img.src = originalSrc + '?v=' + new Date().getTime();
            }
        });
    });
});