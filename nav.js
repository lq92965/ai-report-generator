// nav.js - 极简修复版 (只负责显示 My Account / Logout)
document.addEventListener('DOMContentLoaded', () => {
    // 暴露全局函数，给 script.js 用
    window.updateUserNav = checkLoginState;
    // 自动运行一次
    checkLoginState();
});

function checkLoginState() {
    const token = localStorage.getItem('token');
    const headerActions = document.querySelector('.header-actions');
    
    // 防御性编程：如果没有这个元素，直接跳过
    if (!headerActions) return;

    // 清空，防止重复显示
    headerActions.innerHTML = ''; 

    if (token) {
        // === 已登录 ===
        // 1. 显示 My Account
        const label = document.createElement('span');
        label.textContent = 'My Account';
        label.style.fontWeight = 'bold';
        label.style.marginRight = '15px';
        label.style.color = '#333';

        // 2. 显示 Logout 按钮
        const logoutBtn = document.createElement('button');
        logoutBtn.textContent = 'Logout';
        logoutBtn.style.padding = '5px 15px';
        logoutBtn.style.cursor = 'pointer';
        logoutBtn.style.backgroundColor = '#fff';
        logoutBtn.style.border = '1px solid #ccc';
        logoutBtn.style.borderRadius = '4px';
        
        logoutBtn.onclick = () => {
            localStorage.removeItem('token');
            window.location.reload();
        };

        headerActions.appendChild(label);
        headerActions.appendChild(logoutBtn);

    } else {
        // === 未登录 ===
        // 1. 显示 Login
        const loginBtn = document.createElement('a');
        loginBtn.className = 'btn btn-secondary';
        loginBtn.textContent = 'Login';
        loginBtn.href = '#';
        loginBtn.style.marginRight = '10px';
        loginBtn.onclick = (e) => { e.preventDefault(); window.openModal('login'); };

        // 2. 显示 Get Started
        const startBtn = document.createElement('a');
        startBtn.className = 'btn btn-primary';
        startBtn.textContent = 'Get Started';
        startBtn.href = '#';
        startBtn.onclick = (e) => { e.preventDefault(); window.openModal('signup'); };

        headerActions.appendChild(loginBtn);
        headerActions.appendChild(startBtn);
    }
}
