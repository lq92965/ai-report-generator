/*
 * ===================================================================
 * * Reportify AI (goreportify.com) - 共享导航脚本 (新文件)
 * 文件: nav.js
 * 职责: 
 * 1. 为网站的 *每一个* 页面提供统一的“登录/登出”状态导航栏。
 * 2. 暴露 window.updateUserNav() 函数，以便其他脚本(如 profile.js) 
 * 在更新用户信息后可以调用它来刷新导航栏。
 * ===================================================================
*/

// (!!!) 注意: 此脚本不使用 'DOMContentLoaded'
// 它会立即运行，以尽快构建导航栏

const API_BASE_URL_NAV = 'https://api.goreportify.com';

/**
 * (全局函数) 动态更新右上角的导航栏
 * @param {object | null} user - (可选) 如果已获取用户对象，直接传入
 */
window.updateUserNav = async (user = null) => {
    const headerActions = document.querySelector('.header-actions');
    if (!headerActions) {
        console.error('Navigation Error: ".header-actions" element not found.');
        return;
    }
    headerActions.innerHTML = ''; // 清空所有旧按钮

    const token = localStorage.getItem('token');

    if (token && !user) {
        // 如果有 token 但没有传入 user 对象，我们自己去获取
        try {
            const response = await fetch(`${API_BASE_URL_NAV}/api/me`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                // 令牌无效
                localStorage.removeItem('token');
                throw new Error('Invalid token');
            }
            user = await response.json();
        } catch (error) {
            console.warn('Session expired or invalid:', error.message);
            localStorage.removeItem('token');
            window.showLoggedOutNav(headerActions); // (!!!) 调用下面的“登出”函数
            return;
        }
    }

    if (user) {
        // --- 1. 用户已登录 ---
        const userName = user.displayName || user.email.split('@')[0];

        // 1. 创建头像 (已修复圆形 CSS)
        const avatar = document.createElement('div');
        avatar.className = 'user-avatar'; // (!!!) CSS 将通过这个 class 修复样式
        if (user.avatarUrl && user.avatarUrl !== 'https://via.placeholder.com/150') {
            avatar.innerHTML = `<img src="${user.avatarUrl}" alt="${userName}">`;
        } else {
            const userInitial = (userName[0] || 'U').toUpperCase();
            avatar.textContent = userInitial;
        }

        // 2. 创建用户名 (作为触发器)
        const userNameLink = document.createElement('a');
        userNameLink.href = 'account.html'; // 始终指向“我的账户”
        userNameLink.className = 'nav-user-name';
        userNameLink.textContent = userName;

        // 3. 创建下拉菜单
        const dropdown = document.createElement('div');
        dropdown.className = 'nav-user-dropdown';
        dropdown.innerHTML = `
            <a href="account.html">My Account</a>
            <a href="templates.html">My Templates</a>
            <a href="profile.html">Settings</a>
            <hr>
            <button id="dynamic-logout-btn">Logout</button>
        `;

        // 4. 绑定下拉菜单的“退出”按钮
        dropdown.querySelector('#dynamic-logout-btn').addEventListener('click', () => {
            localStorage.removeItem('token');
            // (!!!) 修复 Bug #3 和 #4: 登出后，*必须*跳转到主页
            window.location.href = 'index.html'; 
        });

        // 5. 绑定触发器
        const toggleDropdown = (e) => {
            // (!!!) 修复 Bug #3: 阻止 Logo 链接的默认跳转行为
            if (e.currentTarget.href && e.currentTarget.href.includes('account.html')) {
                // 如果是点击用户名，正常跳转
            } else {
                // 如果是点击头像，阻止跳转
                e.preventDefault();
            }
            dropdown.classList.toggle('active');
            userNameLink.classList.toggle('active');
        };
        userNameLink.addEventListener('click', toggleDropdown);
        avatar.addEventListener('click', toggleDropdown);

        // 6. 添加到 header
        headerActions.appendChild(avatar);
        headerActions.appendChild(userNameLink);
        headerActions.appendChild(dropdown);

        // 7. (新) 点击菜单外部时，关闭菜单
        document.addEventListener('click', (e) => {
            if (!headerActions.contains(e.target) && dropdown.classList.contains('active')) {
                dropdown.classList.remove('active');
                userNameLink.classList.remove('active');
            }
        });

    } else {
        // --- 2. 用户未登录 ---
        window.showLoggedOutNav(headerActions);
    }
};

/**
 * (全局函数) 显示“未登录”状态的按钮
 * (!!!) 这是在 *非主页* 上的版本
 */
window.showLoggedOutNav = (headerActions) => {
    if (!headerActions) return;

    // 修复 Bug #3: 在 *任何* 页面上点击“登录”或“开始”，都应返回主页
    headerActions.innerHTML = `
        <a href="index.html" class="btn btn-secondary">Login</a>
        <a href="index.html#generator" class="btn btn-primary">Get Started</a>
    `;
};


// --- (!!!) 脚本加载时立即执行 ---
// 这将确保 *每个* 加载了此脚本的页面都会立即尝试更新导航栏
window.updateUserNav();
