/* * Reportify AI - nav.js (最终完整版)
 * 包含：用户头像、下拉菜单、会员等级徽章、移动端适配
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

// --- 渲染：已登录状态 (核心修改部分) ---
function showLoggedIn(container, user) {
    container.innerHTML = ''; 

    const displayName = user.name || user.email.split('@')[0];
    const initial = displayName.charAt(0).toUpperCase();
    const avatarSrc = user.avatarUrl ? `${API_BASE_URL_NAV}${user.avatarUrl}` : null;
    
    // 1. 头像处理
    const avatarContent = avatarSrc 
        ? `<img src="${avatarSrc}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`
        : initial;

    // 2. 会员徽章逻辑 (新增)
    let planBadge = 'FREE USER';
    let badgeColor = '#888';
    
    if (user.plan === 'basic') {
        planBadge = 'BASIC MEMBER';
        badgeColor = '#007bff'; // 蓝色
    } else if (user.plan === 'pro') {
        planBadge = 'PRO MEMBER';
        badgeColor = '#e63946'; // 红色
    }

    const navWrapper = document.createElement('div');
    navWrapper.className = 'user-nav-wrapper';
    
    // 容器样式
    navWrapper.style.cssText = `
        position: relative; 
        display: flex; 
        align-items: center; 
        cursor: pointer; 
        gap: 10px;
    `;

    navWrapper.innerHTML = `
        <div style="width: 42px; height: 42px; background-color: #007bff; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 18px; border: 2px solid #fff; box-shadow: 0 2px 5px rgba(0,0,0,0.1); overflow: hidden; flex-shrink: 0;">
            ${avatarContent}
        </div>
        
        <div style="display:flex; flex-direction:column; line-height:1.2;">
            <span class="user-name" style="font-weight: 600; color: #333; font-size: 14px;">
                ${displayName}
            </span>
            <span class="user-name" style="font-size: 10px; color: ${badgeColor}; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">
                ${planBadge}
            </span>
        </div>
        
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2" style="margin-left: 5px;">
            <path d="M6 9l6 6 6-6"/>
        </svg>

        <div class="nav-dropdown" style="display: none; position: absolute; top: 160%; right: 0; background: white; border: 1px solid #e1e4e8; border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.12); width: 220px; z-index: 1000; text-align: left;">
            <div style="padding: 12px 16px; border-bottom: 1px solid #f0f0f0; background: #fafafa;">
                <div style="font-size: 11px; color: #888; text-transform: uppercase; margin-bottom: 2px;">Signed in as</div>
                <div style="font-weight: 600; font-size: 13px; color: #333; overflow: hidden; text-overflow: ellipsis;">${user.email}</div>
            </div>
            
            <div style="padding: 6px;">
                <a href="account.html" class="nav-item" style="display: block; padding: 10px 10px; color: #444; text-decoration: none; border-radius: 6px; font-size: 14px; transition: background 0.2s;">
                    📊 My Reports
                </a>
                <a href="profile.html" class="nav-item" style="display: block; padding: 10px 10px; color: #444; text-decoration: none; border-radius: 6px; font-size: 14px; transition: background 0.2s;">
                    ⚙️ Settings
                </a>
            </div>
            
            <div style="border-top: 1px solid #f0f0f0; padding: 6px;">
                <a href="#" id="logout-btn" style="display: block; padding: 10px 10px; color: #d73a49; text-decoration: none; border-radius: 6px; font-size: 14px; transition: background 0.2s;">
                    🚪 Logout
                </a>
            </div>
        </div>
    `;

    // 交互逻辑
    navWrapper.addEventListener('click', (e) => {
        e.stopPropagation();
        const dropdown = navWrapper.querySelector('.nav-dropdown');
        const isHidden = dropdown.style.display === 'none';
        document.querySelectorAll('.nav-dropdown').forEach(el => el.style.display = 'none');
        dropdown.style.display = isHidden ? 'block' : 'none';
    });

    navWrapper.querySelectorAll('.nav-item, #logout-btn').forEach(item => {
        item.addEventListener('mouseenter', () => item.style.backgroundColor = '#f6f8fa');
        item.addEventListener('mouseleave', () => item.style.backgroundColor = 'transparent');
    });

    const logoutBtn = navWrapper.querySelector('#logout-btn');
    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('token');
        if(window.showToast) window.showToast('Logged out');
        setTimeout(() => window.location.reload(), 500);
    });

    document.addEventListener('click', () => {
        const dropdown = navWrapper.querySelector('.nav-dropdown');
        if (dropdown) dropdown.style.display = 'none';
    });

    container.appendChild(navWrapper);
}
