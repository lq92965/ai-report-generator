/* 文件名：mobile-patch.js */
/* 作用：自动检测页面，如果是新闻或博客详情页，则动态注入左上角返回按钮 */

document.addEventListener('DOMContentLoaded', function() {
    // 获取当前网页的 URL 路径
    const currentPath = window.location.pathname;
    
    // 判断当前页面是否为新闻或博客的具体详情页 (排除主页)
    const isDetailPage = currentPath.includes('news-') || 
                         currentPath.includes('blog-') || 
                         currentPath.includes('/news/') || 
                         currentPath.includes('/blog/');

    // 如果是详情页，并且页面上还没有返回按钮
    if (isDetailPage && !document.querySelector('.mobile-back-btn')) {
        // 创建一个带有返回历史记录功能的 <a> 标签
        const backBtn = document.createElement('a');
        backBtn.href = 'javascript:history.back()';
        backBtn.className = 'mobile-back-btn';
        
        // 写入一个优雅的左箭头符号 (←)
        backBtn.innerHTML = '&#8592;'; 
        
        // 将按钮强行插入到页面 <body> 的最前面
        document.body.insertBefore(backBtn, document.body.firstChild);
    }
});