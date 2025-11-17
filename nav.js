/*
 * ===================================================================
 * * Reportify AI (goreportify.com) - 共享导航脚本 (修复版)
 * 文件: nav.js
 * 修复: 解决了“双头像”的竞态条件问题 (Race Condition)。
 * ===================================================================
*/

const API_BASE_URL_NAV = 'https://api.goreportify.com';

/**
 * (全局函数) 动态更新右上角的导航栏
 */
window.updateUserNav = async (user = null) => {
    const headerActions = document.querySelector('.header-actions');
    if (!headerActions) return;
    
    // (!!!) 移除: 不要在这里清空，否则会导致并发时的双重渲染
    // headerActions.innerHTML = ''; 

    const token = localStorage.getItem('token');

    if (token && !user) {
        try {
            const response = await fetch(`${API_BASE_URL_NAV}/api/me`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                localStorage.removeItem('token');
                throw new Error('Invalid token');
            }
            user = await response.json();
        } catch (error) {
            console.warn('Session expired:', error.message);
            localStorage.removeItem('token');
            window.showLoggedOutNav(headerActions);
            return;
        }
    }

    // (!!!) 修复点: 只有在数据准备好，准备渲染前一刻，才清空容器
    headerActions.innerHTML = ''; 

    if (user) {
        // --- 1. 用户已登录 ---
        const userName = user.displayName || user.email.split('@')[0];
        const userInitial = (userName[0] || 'U').toUpperCase();

        // 1. 创建头像
        const avatar = document.createElement('div');
        avatar.className = 'user-avatar'; 
        if (user.avatarUrl && user.avatarUrl !== 'https://via.placeholder.com/150') {
            avatar.innerHTML = `<img src="${user.avatarUrl}" alt="${userName}">`;
        } else {
            avatar.textContent = userInitial;
        }

        // 2. 创建用户名
        const userNameLink = document.createElement('a');
        userNameLink.href = 'account.html';
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

        // 4. 绑定退出
        dropdown.querySelector('#dynamic-logout-btn').addEventListener('click', () => {
            localStorage.removeItem('token');
            window.location.href = 'index.html'; 
        });

        // 5. 绑定触发器
        const toggleDropdown = (e) => {
            e.preventDefault(); // 阻止跳转
            dropdown.classList.toggle('active');
            userNameLink.classList.toggle('active');
        };
        userNameLink.addEventListener('click', toggleDropdown);
        avatar.addEventListener('click', toggleDropdown);

        // 6. 添加到 DOM
        headerActions.appendChild(avatar);
        headerActions.appendChild(userNameLink);
        headerActions.appendChild(dropdown);

        // 7. 点击外部关闭
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
 * (全局函数) 显示“未登录”状态
 */
window.showLoggedOutNav = (headerActions) => {
    if (!headerActions) return;
    // 这里第一件事就是 innerHTML = ''，所以是安全的
    headerActions.innerHTML = `
        <a href="index.html" class="btn btn-secondary">Login</a>
        <a href="index.html#generator" class="btn btn-primary">Get Started</a>
    `;
};

// --- 脚本加载时立即执行 ---
window.updateUserNav();
