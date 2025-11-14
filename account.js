/*
 * ===================================================================
 * * Reportify AI - 账户中心脚本 (已清理)
 * 文件: account.js
 * 职责: 保护此页面，只允许登录用户访问。
 * (所有导航功能现在都由 nav.js 处理)
 * ===================================================================
*/

// (!!!) 立即运行检查，保护页面
(function() {
    const token = localStorage.getItem('token');
    if (!token) {
        // (!!!) 修复 Bug: 如果未登录，立即踢回主页
        alert('Please log in to access your account.'); // 提示用户
        window.location.href = 'index.html'; // 重定向到主页
    }
})();

// (此页面不需要其他 JS 逻辑，nav.js 已处理导航栏)
