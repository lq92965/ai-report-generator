/* * Reportify AI - nav.js (完整功能版)
 * 包含：用户头像、下拉菜单、移动端适配
 */

const API_BASE_URL_NAV = 'https://api.goreportify.com';

document.addEventListener('DOMContentLoaded', () => {
    // 暴露全局函数，确保 script.js 可以调用
    window.updateUserNav = loadUserNav;
    // 页面加载完毕自动执行一次
    loadUserNav();
});

async function loadUserNav() {
    const token = localStorage.getItem('token');
    const headerActions = document.querySelector('.header-actions');
    
    // 如果找不到导航栏容器，直接停止
    if (!headerActions) return;

    // 1. 如果没有 Token，显示登录/注册按钮
    if (!token) {
        showLoggedOut(headerActions);
        return;
    }

    // 2. 如果有 Token，尝试从后端获取用户详情
    try {
        const res = await fetch(`${API_BASE_URL_NAV}/api/me`, {
            method: 'GET',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (res.ok) {
            const user = await res.json();
            showLoggedIn(headerActions, user);
        } else {
            // Token 可能过期了，强制登出
            console.warn('Session expired or invalid.');
            localStorage.removeItem('token');
            showLoggedOut(headerActions);
        }
    } catch (err) {
        console.error('Nav Error:', err);
        // 网络错误时，为了安全起见，显示登出状态
        showLoggedOut(headerActions);
    }
}

// --- 渲染：未登录状态 ---
function showLoggedOut(container) {
    container.innerHTML = ''; // 清空
    
    const loginBtn = document.createElement('a');
    loginBtn.href = '#';
    loginBtn.className = 'btn btn-secondary';
    loginBtn.textContent = 'Login';
    loginBtn.style.marginRight = '10px';
    loginBtn.onclick = (e) => { e.preventDefault(); window.openModal('login'); };

    const startBtn = document.createElement('a');
    startBtn.href = '#';
    startBtn.className = 'btn btn-primary';
    startBtn.textContent = 'Get Started';
    startBtn.onclick = (e) => { e.preventDefault(); window.openModal('signup'); };

    container.appendChild(loginBtn);
    container.appendChild(startBtn);
}

// --- 渲染：已登录状态 (带头像和下拉菜单) ---
function showLoggedIn(container, user) {
    container.innerHTML = ''; // 清空

    // 获取显示名称和首字母
    const displayName = user.name || user.email.split('@')[0];
    const initial = displayName.charAt(0).toUpperCase();

    // 创建头像容器
    const navWrapper = document.createElement('div');
    navWrapper.className = 'user-nav-wrapper';
    navWrapper.style.cssText = 'position: relative; display: flex; align-items: center; cursor: pointer; gap: 8px;';

    // 生成 HTML 结构
    navWrapper.innerHTML = `
        <div style="width: 36px; height: 36px; background-color: #007bff; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 16px;">
            ${initial}
        </div>
        
        <span class="user-name" style="font-weight: 500; color: #333; font-size: 14px;">
            ${displayName}
        </span>
        
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 9l6 6 6-6"/>
        </svg>

        <div class="nav-dropdown" style="display: none; position: absolute; top: 120%; right: 0; background: white; border: 1px solid #eee; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); width: 180px; z-index: 1000; overflow: hidden;">
            <div style="padding: 12px 15px; border-bottom: 1px solid #f0f0f0; background: #fafafa;">
                <div style="font-size: 12px; color: #888;">Signed in as</div>
                <div style="font-weight: 600; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${user.email}</div>
            </div>
            
            <a href="account.html" class="nav-item" style="display: block; padding: 10px 15px; color: #333; text-decoration: none; transition: background 0.2s;">
                My Reports (我的报告)
            </a>
            
            <a href="profile.html" class="nav-item" style="display: block; padding: 10px 15px; color: #333; text-decoration: none; transition: background 0.2s;">
                Settings (设置)
            </a>
            
            <div style="border-top: 1px solid #f0f0f0;"></div>
            <a href="#" id="logout-btn" style="display: block; padding: 10px 15px; color: #dc3545; text-decoration: none; transition: background 0.2s;">Logout</a>
        </div>
    `;

    // --- 交互逻辑 ---
    
    // 1. 点击头像切换下拉菜单
    navWrapper.addEventListener('click', (e) => {
        e.stopPropagation(); 
        const dropdown = navWrapper.querySelector('.nav-dropdown');
        const isHidden = dropdown.style.display === 'none';
        document.querySelectorAll('.nav-dropdown').forEach(el => el.style.display = 'none');
        dropdown.style.display = isHidden ? 'block' : 'none';
    });

    // 2. 鼠标悬停高亮
    navWrapper.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('mouseenter', () => item.style.background = '#f8f9fa');
        item.addEventListener('mouseleave', () => item.style.background = 'white');
    });

    // 3. 点击 Logout
    const logoutBtn = navWrapper.querySelector('#logout-btn');
    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('token');
        if(window.showToast) window.showToast('Logged out successfully');
        setTimeout(() => window.location.reload(), 500);
    });

    // 4. 点击空白关闭
    document.addEventListener('click', () => {
        const dropdown = navWrapper.querySelector('.nav-dropdown');
        if (dropdown) dropdown.style.display = 'none';
    });

    container.appendChild(navWrapper);
}
