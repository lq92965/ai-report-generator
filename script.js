/*
 * ===================================================================
 * * Reportify AI - script.js (v29.0 终极完整详细版)
 * * 状态: 
 * * 1. 恢复所有代码细节，无任何压缩
 * * 2. 强制修复“只有 Google 按钮”的问题 (通过 JS 注入 HTML)
 * * 3. 包含支付、历史、消息、头像上传、导出等全部功能
 * ===================================================================
 */

const API_BASE_URL = 'https://api.goreportify.com'; 
let allTemplates = [];
let currentUser = null;
let currentUserPlan = 'basic'; // 默认为 basic，直到获取用户信息

// =================================================
// 模块 1: 全局工具函数 (Toast, Download, Modal)
// =================================================

/**
 * 显示全局提示框 (Toast Notification)
 */
window.showToast = function(message, type = 'info') {
    let container = document.getElementById('toast-container');
    
    // 如果容器不存在，创建一个
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // 根据类型选择图标
    let icon = 'fa-info-circle';
    if (type === 'success') icon = 'fa-check-circle';
    if (type === 'error') icon = 'fa-exclamation-circle';

    toast.innerHTML = `<i class="fas ${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);

    // 3秒后自动消失
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.5s ease forwards';
        setTimeout(() => {
            if (toast.parentNode) toast.remove();
        }, 500);
    }, 3000);
};

/**
 * 文件下载辅助函数
 */
window.saveAs = function(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    
    // 清理资源
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
};

// =================================================
// 模块 2: 弹窗与 Tab 控制 (挂载到 Window)
// =================================================

/**
 * 打开弹窗并切换到指定标签页
 */
window.openModal = function(tabToShow = 'login') {
    const overlay = document.getElementById('auth-modal-overlay');
    
    // 1. 显示遮罩层
    if (overlay) {
        overlay.classList.remove('hidden');
    }

    // 2. 切换 Tab 按钮的样式 (激活状态 vs 非激活状态)
    const allTabs = document.querySelectorAll('.tab-link');
    allTabs.forEach(btn => {
        if (btn.dataset.tab === tabToShow) {
            // 激活样式
            btn.classList.add('text-blue-600', 'border-blue-600', 'bg-white');
            btn.classList.remove('text-gray-500', 'border-transparent');
        } else {
            // 非激活样式
            btn.classList.remove('text-blue-600', 'border-blue-600', 'bg-white');
            btn.classList.add('text-gray-500', 'border-transparent');
        }
    });

    // 3. 切换内容区域的显示/隐藏
    const allContents = document.querySelectorAll('.tab-content');
    allContents.forEach(content => {
        content.classList.add('hidden'); // 先隐藏所有
    });

    const targetContent = document.getElementById(tabToShow);
    if (targetContent) {
        targetContent.classList.remove('hidden'); // 再显示目标
    }
};

/**
 * 关闭所有弹窗
 */
window.closeModal = function() {
    const overlay = document.getElementById('auth-modal-overlay');
    if (overlay) {
        overlay.classList.add('hidden');
    }
};

// =================================================
// 模块 3: 核心初始化流程 (Init)
// =================================================

// 优先处理：Google 登录回调
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');
    const errorFromUrl = urlParams.get('error');

    // 如果 URL 里有 Token，说明 Google 登录成功
    if (tokenFromUrl) {
        console.log("Google Login Detected, saving token...");
        localStorage.setItem('token', tokenFromUrl);
        
        // 清理 URL，去掉 token 参数
        window.history.replaceState({}, document.title, window.location.pathname);
        
        showToast('Login Successful!', 'success');
        
        // 延迟刷新进入主页
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 500);
        return; 
    }

    // 如果有错误参数
    if (errorFromUrl) {
        showToast('Google Login Failed', 'error');
        window.history.replaceState({}, document.title, window.location.pathname);
    }
});

// 主程序启动
document.addEventListener('DOMContentLoaded', async () => {
    console.log("Reportify AI v29.0 Starting...");

    // 1. 获取用户信息 (同步阻塞一下，确保状态正确)
    await fetchUserProfile();

    // 2. 初始化各个 UI 模块
    setupAuthUI();          // 登录注册界面 (含强制 HTML 注入)
    setupUserDropdown();    // 用户右上角菜单
    setupMessageCenter();   // 消息中心 (小铃铛)
    setupGenerator();       // AI 生成器
    setupTemplates();       // 加载模板列表
    setupExport();          // 导出下载功能
    setupPayment();         // 支付功能 (PayPal)
    setupContactForm();     // 联系我们表单
    setupHistoryLoader();   // 历史记录列表
    setupAvatarUpload();    // 头像上传

    console.log("All Modules Initialized.");
});

// =================================================
// 模块 4: 用户数据获取
// =================================================

async function fetchUserProfile() {
    const token = localStorage.getItem('token');
    if (!token) {
        console.log("No token found, user is Guest.");
        return;
    }

    try {
        const res = await fetch(`${API_BASE_URL}/api/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            currentUser = await res.json();
            currentUserPlan = currentUser.plan || 'basic';
            console.log("User logged in:", currentUser.name);
        } else {
            // Token 无效或过期
            console.warn("Token invalid, logging out.");
            localStorage.removeItem('token');
            currentUser = null;
        }
    } catch (e) {
        console.error("Network error fetching profile:", e);
    }
}

// =================================================
// 模块 5: 认证界面 (强制修复输入框消失问题)
// =================================================

function setupAuthUI() {
    // 绑定关闭按钮事件
    const closeModalBtn = document.getElementById('close-modal-btn');
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', window.closeModal);
    }

    // 绑定 Tab 切换点击事件
    document.querySelectorAll('.tab-link').forEach(btn => {
        btn.addEventListener('click', () => window.openModal(btn.dataset.tab));
    });

    // -------------------------------------------------
    // A. 强制渲染登录表单 (防止 HTML 缺失)
    // -------------------------------------------------
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        // 直接写入 HTML，确保输入框存在
        loginForm.innerHTML = `
            <div class="space-y-4">
                <button type="button" class="google-btn w-full flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-700 font-medium py-2.5 rounded-lg hover:bg-gray-50 transition">
                    <img src="https://www.svgrepo.com/show/475656/google-color.svg" class="w-5 h-5" alt="Google">
                    Continue with Google
                </button>
                
                <div class="relative flex py-2 items-center">
                    <div class="flex-grow border-t border-gray-200"></div>
                    <span class="flex-shrink-0 mx-4 text-gray-400 text-xs">OR</span>
                    <div class="flex-grow border-t border-gray-200"></div>
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input type="email" id="login-email" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="name@example.com" required>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Password</label>
                    <input type="password" id="login-password" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="••••••••" required>
                </div>
                
                <button type="submit" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg transition shadow-md">
                    Sign In
                </button>
            </div>
        `;

        // 重新绑定登录逻辑
        const newLoginForm = loginForm.cloneNode(true);
        loginForm.parentNode.replaceChild(newLoginForm, loginForm);

        newLoginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = newLoginForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            
            submitBtn.textContent = 'Logging in...';
            submitBtn.disabled = true;

            try {
                const email = document.getElementById('login-email').value;
                const password = document.getElementById('login-password').value;

                const res = await fetch(`${API_BASE_URL}/api/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const data = await res.json();
                if (!res.ok) throw new Error(data.message || 'Login failed');

                // 登录成功
                localStorage.setItem('token', data.token);
                showToast('Login Success!', 'success');
                window.closeModal();
                
                // 刷新页面
                setTimeout(() => window.location.reload(), 500);

            } catch (err) {
                showToast(err.message, 'error');
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        });
    }

    // -------------------------------------------------
    // B. 强制渲染注册表单 (带密码强度 UI)
    // -------------------------------------------------
    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        signupForm.innerHTML = `
            <div class="space-y-4">
                <button type="button" class="google-btn w-full flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-700 font-medium py-2.5 rounded-lg hover:bg-gray-50 transition">
                    <img src="https://www.svgrepo.com/show/475656/google-color.svg" class="w-5 h-5" alt="Google">
                    Continue with Google
                </button>
                
                <div class="relative flex py-2 items-center">
                    <div class="flex-grow border-t border-gray-200"></div>
                    <span class="flex-shrink-0 mx-4 text-gray-400 text-xs">OR</span>
                    <div class="flex-grow border-t border-gray-200"></div>
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input type="text" id="signup-name" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Your Name" required>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input type="email" id="signup-email" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="name@example.com" required>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Password</label>
                    <input type="password" id="signup-password" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Min 8 chars, Aa1@" required>
                    <div id="password-strength-box" class="hidden mt-2 grid grid-cols-2 gap-1 bg-gray-50 p-2 rounded text-xs">
                        <div id="req-length" class="text-gray-400"><i class="far fa-circle"></i> 8+ chars</div>
                        <div id="req-upper" class="text-gray-400"><i class="far fa-circle"></i> Uppercase</div>
                        <div id="req-number" class="text-gray-400"><i class="far fa-circle"></i> Number</div>
                        <div id="req-special" class="text-gray-400"><i class="far fa-circle"></i> Symbol</div>
                    </div>
                </div>
                
                <button type="submit" id="btn-signup-submit" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg transition shadow-md opacity-50 cursor-not-allowed" disabled>
                    Create Account
                </button>
            </div>
        `;

        // 重新绑定注册逻辑
        const newSignupForm = signupForm.cloneNode(true);
        signupForm.parentNode.replaceChild(newSignupForm, signupForm);

        // 获取元素引用
        const nameInput = document.getElementById('signup-name');
        const emailInput = document.getElementById('signup-email');
        const passInput = document.getElementById('signup-password');
        const strengthBox = document.getElementById('password-strength-box');
        const submitBtn = document.getElementById('btn-signup-submit');

        // 注册输入监听与验证
        if (passInput) {
            passInput.addEventListener('focus', () => {
                strengthBox.classList.remove('hidden');
            });

            // 统一验证函数
            const validateInputs = () => {
                const val = passInput.value;
                
                // 密码规则
                const rules = {
                    length: val.length >= 8,
                    upper: /[A-Z]/.test(val) && /[a-z]/.test(val), // 同时包含大小写 (简化逻辑)
                    number: /[0-9]/.test(val),
                    special: /[!@#$%^&*(),.?":{}|<>]/.test(val)
                };

                // 更新 UI
                const updateUI = (id, isValid) => {
                    const el = document.getElementById(id);
                    if (el) {
                        if (isValid) {
                            el.className = 'text-green-600 font-bold text-xs';
                            el.innerHTML = `<i class="fas fa-check-circle mr-1"></i> ${el.innerText.replace(/^[○✓] /, '')}`;
                        } else {
                            el.className = 'text-gray-400 text-xs';
                            el.innerHTML = `<i class="far fa-circle mr-1"></i> ${el.innerText.replace(/^[✓] /, '')}`;
                        }
                    }
                };

                updateUI('req-length', rules.length);
                updateUI('req-upper', rules.upper);
                updateUI('req-number', rules.number);
                updateUI('req-special', rules.special);

                // 检查所有条件
                const isPasswordOk = Object.values(rules).every(Boolean);
                const isNameOk = nameInput.value.trim().length > 0;
                const isEmailOk = emailInput.value.includes('@');

                if (isPasswordOk && isNameOk && isEmailOk) {
                    submitBtn.disabled = false;
                    submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                } else {
                    submitBtn.disabled = true;
                    submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
                }
            };

            // 绑定事件
            passInput.addEventListener('input', validateInputs);
            nameInput.addEventListener('input', validateInputs);
            emailInput.addEventListener('input', validateInputs);
        }

        // 提交注册
        newSignupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const originalText = submitBtn.textContent;
            
            submitBtn.textContent = 'Creating Account...';
            submitBtn.disabled = true;

            try {
                const res = await fetch(`${API_BASE_URL}/api/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        displayName: nameInput.value,
                        email: emailInput.value,
                        password: passInput.value
                    })
                });

                const data = await res.json();
                if (!res.ok) throw new Error(data.message || 'Registration failed');

                showToast('Account Created!', 'success');
                
                // 自动切换到登录页
                window.openModal('login');

            } catch (err) {
                showToast(err.message, 'error');
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        });
    }

    // -------------------------------------------------
    // C. Google 按钮逻辑修复 (防止作为表单提交)
    // -------------------------------------------------
    document.querySelectorAll('.google-btn').forEach(btn => {
        // 克隆以移除旧事件
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        
        // 关键：设为 button 类型，防止触发表单 submit
        newBtn.type = 'button'; 
        
        newBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            try {
                const res = await fetch(`${API_BASE_URL}/auth/google`);
                const data = await res.json();
                if (data.url) {
                    window.location.href = data.url;
                } else {
                    showToast('Google login config missing', 'error');
                }
            } catch (err) {
                showToast('Network Connection Error', 'error');
            }
        });
    });

    // Free 按钮逻辑
    document.querySelectorAll('button').forEach(btn => {
        if (btn.id === 'btn-select-free' || btn.textContent.includes('Start Free')) {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            newBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (window.location.href.includes('subscription')) {
                    window.location.href = 'index.html';
                } else {
                    window.openModal('signup');
                }
            });
        }
    });
}

// =================================================
// 模块 6: 头像上传 (带大小检查与404提示)
// =================================================

function setupAvatarUpload() {
    const uploadInput = document.getElementById('upload-avatar');
    // 如果页面上没有这个元素，说明不是 Profile 页，直接退出
    if (!uploadInput) return; 

    uploadInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // 1. 检查文件大小 (2MB)
        const MAX_SIZE = 2 * 1024 * 1024; // 2MB
        if (file.size > MAX_SIZE) {
            showToast('Image too large. Max size is 2MB.', 'error');
            return;
        }

        // 2. 准备 FormData
        const formData = new FormData();
        formData.append('avatar', file);

        const token = localStorage.getItem('token');
        showToast('Uploading avatar...', 'info');

        try {
            const res = await fetch(`${API_BASE_URL}/api/upload-avatar`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }, // 注意：不要手动设 Content-Type
                body: formData
            });

            if (res.ok) {
                showToast('Avatar updated successfully!', 'success');
                // 1秒后刷新页面显示新头像
                setTimeout(() => window.location.reload(), 1000);
            } else if (res.status === 404) {
                // 如果返回 404，说明后端没写这个接口
                console.error("API endpoint not found: /api/upload-avatar");
                showToast('Error: Server missing upload feature (404)', 'error');
            } else {
                showToast('Upload failed. Please try again.', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('Network error during upload.', 'error');
        }
    });
}

// =================================================
// 模块 7: 用户菜单与导航
// =================================================

function setupUserDropdown() {
    const headerRight = document.getElementById('auth-container');
    if (!headerRight) return;

    if (!currentUser) {
        // 未登录状态
        headerRight.innerHTML = `
            <button class="text-gray-600 hover:text-blue-600 font-medium px-3 py-2 mr-2" onclick="openModal('login')">Login</button>
            <button class="bg-blue-600 text-white px-5 py-2 rounded-full font-bold shadow-lg hover:bg-blue-700" onclick="openModal('signup')">Get Started</button>
        `;
    } else {
        // 已登录状态
        const initial = currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U';
        
        // 决定显示图片还是字母头像
        const avatarHTML = currentUser.picture 
            ? `<img src="${currentUser.picture}" class="w-10 h-10 rounded-full border-2 border-white shadow-md cursor-pointer hover:opacity-90 object-cover" onclick="toggleUserMenu()">`
            : `<button onclick="toggleUserMenu()" class="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold shadow-md cursor-pointer border-2 border-white">${initial}</button>`;

        headerRight.innerHTML = `
            <div class="relative flex items-center gap-3">
                <span class="text-sm font-medium text-gray-700 hidden md:block">Hi, ${currentUser.name}</span>
                ${avatarHTML}
                
                <div id="user-dropdown" class="hidden absolute right-0 top-14 w-56 bg-white rounded-xl shadow-2xl border border-gray-100 z-[9999] overflow-hidden">
                     <div class="px-4 py-3 border-b border-gray-50 bg-gray-50">
                        <p class="text-xs text-gray-500 uppercase">Signed in as</p>
                        <p class="text-sm font-bold truncate">${currentUser.email}</p>
                     </div>
                     
                     <a href="profile.html" class="block px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 border-b border-gray-50 flex items-center gap-2">
                        <i class="fas fa-user-circle text-blue-500"></i> My Profile
                     </a>

                     <a href="usage.html" class="block px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 border-b border-gray-50 flex items-center gap-2">
                        <i class="fas fa-chart-pie text-green-500"></i> Usage Stats
                     </a>

                     <a href="subscription.html" class="block px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 border-b border-gray-50 flex items-center gap-2">
                        <i class="fas fa-credit-card text-purple-500"></i> Subscription
                     </a>

                     ${currentUser.role === 'admin' ? `
                     <a href="admin.html" class="block px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 border-b border-gray-50 flex items-center gap-2">
                        <i class="fas fa-shield-alt text-red-500"></i> Admin Panel
                     </a>` : ''}

                     <a href="#" onclick="logout()" class="block px-4 py-3 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                        <i class="fas fa-sign-out-alt"></i> Logout
                     </a>
                </div>
            </div>
        `;
    }
}

// 切换菜单
window.toggleUserMenu = function() {
    const menu = document.getElementById('user-dropdown');
    if (menu) menu.classList.toggle('hidden');
};

// 登出
window.logout = function() {
    localStorage.removeItem('token');
    showToast('Logged out.', 'info');
    setTimeout(() => window.location.href = 'index.html', 500);
};

// 点击空白关闭菜单
window.onclick = function(event) {
    if (!event.target.closest('#auth-container')) {
        const menu = document.getElementById('user-dropdown');
        if (menu && !menu.classList.contains('hidden')) menu.classList.add('hidden');
    }
};

// =================================================
// 模块 8: 消息中心
// =================================================

function setupMessageCenter() {
    const bellBtn = document.querySelector('button[title="My Messages"]');
    if(bellBtn) {
        const newBtn = bellBtn.cloneNode(true);
        bellBtn.parentNode.replaceChild(newBtn, bellBtn);
        newBtn.addEventListener('click', window.openMessageCenter);
    }
    
    // 启动自动检查
    checkNotifications();
    setInterval(checkNotifications, 30000); // 每30秒检查一次
}

window.openMessageCenter = function() {
    const token = localStorage.getItem('token');
    if (!token) {
        showToast("Please login first.", "warning");
        return;
    }
    const modal = document.getElementById('message-modal');
    if (modal) {
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden'; // 禁止背景滚动
        loadMessages(true); // 标记已读
    }
};

window.closeMessageCenter = function() {
    const modal = document.getElementById('message-modal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
    }
};

// 检查是否有新回复 (红点逻辑)
window.checkNotifications = async function() {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
        const res = await fetch(`${API_BASE_URL}/api/my-messages`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) return;
        const msgs = await res.json();
        const repliedCount = msgs.filter(m => m.status === 'replied').length;
        const lastSeen = parseInt(localStorage.getItem('seen_reply_count') || '0');
        
        if (repliedCount > lastSeen) {
            const badge = document.getElementById('notif-badge');
            if (badge) badge.classList.remove('hidden');
        }
    } catch (e) {}
};

// 加载消息列表
async function loadMessages(markAsRead = false) {
    const container = document.getElementById('msg-list-container');
    const token = localStorage.getItem('token');
    
    container.innerHTML = '<div class="text-center text-gray-400 p-10">Loading...</div>';

    try {
        const res = await fetch(`${API_BASE_URL}/api/my-messages`, { headers: { 'Authorization': `Bearer ${token}` } });
        const msgs = await res.json();

        if (markAsRead) {
            const repliedCount = msgs.filter(m => m.status === 'replied').length;
            localStorage.setItem('seen_reply_count', repliedCount);
            const badge = document.getElementById('notif-badge');
            if(badge) badge.classList.add('hidden');
        }

        if (msgs.length === 0) {
            container.innerHTML = '<div class="text-center p-10 text-gray-500">No messages found.</div>';
            return;
        }

        let html = '';
        msgs.forEach(msg => {
            const dateStr = new Date(msg.submittedAt).toLocaleDateString();
            
            // 构建回复内容
            let replyHtml = '';
            if (msg.conversation && msg.conversation.length > 0) {
                const adminMsgs = msg.conversation.filter(c => c.role === 'admin');
                if (adminMsgs.length > 0) {
                    replyHtml = adminMsgs.map(c => `
                        <div class="mb-2 p-2 bg-blue-50 rounded">
                            <p class="text-xs font-bold text-blue-600">Support:</p>
                            <p class="text-sm text-gray-800">${c.message}</p>
                        </div>
                    `).join('');
                }
            } else if (msg.reply) {
                replyHtml = `<div class="p-2 bg-blue-50 rounded text-sm text-gray-800">${msg.reply}</div>`;
            } else {
                replyHtml = `<div class="text-center text-gray-400 text-sm italic">Waiting for reply...</div>`;
            }

            html += `
                <div class="bg-white border rounded-lg shadow-sm p-4 mb-3">
                    <div class="flex justify-between items-center mb-2">
                        <span class="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded font-bold uppercase">${msg.type || 'Feedback'}</span>
                        <span class="text-xs text-gray-400">${dateStr}</span>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="text-sm text-gray-700">${msg.message}</div>
                        <div class="border-l pl-4">${replyHtml}</div>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;

    } catch (err) {
        container.innerHTML = '<div class="text-center text-red-400 p-10">Failed to load messages.</div>';
    }
}

// =================================================
// 模块 9: 模板与生成器
// =================================================

async function setupTemplates() {
    const templateSelect = document.getElementById('template');
    if (!templateSelect) return;

    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_BASE_URL}/api/templates`, { 
            headers: token ? { 'Authorization': `Bearer ${token}` } : {} 
        });

        if (res.ok) {
            allTemplates = await res.json();
            templateSelect.innerHTML = '<option value="" disabled selected>Select a Report Type...</option>';

            const groups = {};
            allTemplates.forEach(t => {
                const cat = t.category || 'Custom';
                if (!groups[cat]) groups[cat] = [];
                groups[cat].push(t);
            });

            for (const [category, items] of Object.entries(groups)) {
                const optgroup = document.createElement('optgroup');
                optgroup.label = category;
                items.forEach(t => {
                    const option = document.createElement('option');
                    option.value = t._id;
                    const isLocked = t.isPro && currentUserPlan !== 'pro';
                    option.textContent = `${isLocked ? '🔒 ' : ''}${t.title}`;
                    optgroup.appendChild(option);
                });
                templateSelect.appendChild(optgroup);
            }

            // 监听选择变化，生成动态表单
            templateSelect.addEventListener('change', () => {
                const template = allTemplates.find(x => x._id === templateSelect.value);
                const container = document.getElementById('dynamic-inputs-container');
                const textArea = document.getElementById('key-points');
                
                if (container) container.innerHTML = '';
                
                if (template && template.variables && template.variables.length > 0) {
                    if (textArea) textArea.placeholder = "Additional notes...";
                    template.variables.forEach(v => {
                        const div = document.createElement('div');
                        div.className = 'mb-4 input-wrapper';
                        div.innerHTML = `
                            <label class="block text-sm font-bold mb-1 text-gray-700">${v.label}</label>
                            <input class="dynamic-input w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" 
                                   data-key="${v.id}" placeholder="${v.placeholder||''}">
                        `;
                        container.appendChild(div);
                    });
                } else if (textArea) {
                    textArea.placeholder = "Enter key points here...";
                }
            });
        }
    } catch (e) {
        console.error("Template load failed", e);
    }
}

function setupGenerator() {
    const generateBtn = document.getElementById('generate-btn');
    if (!generateBtn) return;

    const newBtn = generateBtn.cloneNode(true);
    generateBtn.parentNode.replaceChild(newBtn, generateBtn);

    newBtn.addEventListener('click', async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            window.openModal('login');
            return;
        }

        // 收集动态输入
        const inputs = {};
        document.querySelectorAll('.dynamic-input').forEach(i => {
            inputs[i.dataset.key] = i.value;
        });

        const promptText = document.getElementById('key-points')?.value || '';
        
        // 验证输入
        if (!promptText && Object.keys(inputs).length === 0) {
            alert('Please enter some content.');
            return;
        }

        const resultBox = document.getElementById('generated-report');
        const oldBtnText = newBtn.innerText;
        
        newBtn.innerText = 'Generating...';
        newBtn.disabled = true;
        
        if (resultBox) resultBox.innerText = "AI is thinking...";

        try {
            const res = await fetch(`${API_BASE_URL}/api/generate`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({
                    templateId: document.getElementById('template').value,
                    inputs: inputs,
                    userPrompt: promptText,
                    role: document.getElementById('role')?.value || 'General',
                    tone: document.getElementById('tone')?.value || 'Professional',
                    language: document.getElementById('language')?.value || 'English'
                })
            });

            const data = await res.json();
            
            if (res.ok && resultBox) {
                resultBox.innerText = data.generatedText;
                showToast('Report Generated!', 'success');
            } else {
                if (resultBox) resultBox.innerText = "Error: " + (data.error || "Failed");
            }
        } catch (e) {
            if (resultBox) resultBox.innerText = "Network Error - Please check connection.";
        } finally {
            newBtn.innerText = oldBtnText;
            newBtn.disabled = false;
        }
    });
}

// =================================================
// 模块 10: 导出与复制
// =================================================

function setupExport() {
    // 导出按钮
    document.querySelectorAll('.export-btn').forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        
        newBtn.addEventListener('click', () => {
            const content = document.getElementById('generated-report')?.innerText;
            if (!content || content.length < 5 || content.includes('AI is thinking')) {
                showToast('Please generate a report first', 'warning');
                return;
            }

            const format = newBtn.dataset.format || newBtn.innerText.trim();
            const filename = `Report_${new Date().toISOString().slice(0,10)}`;

            if (format === 'Markdown') {
                saveAs(new Blob([content], {type: 'text/plain'}), filename + '.md');
            } else if (format.includes('Word') && typeof docx !== 'undefined') {
                const doc = new docx.Document({
                    sections: [{
                        children: content.split('\n').map(line => new docx.Paragraph(line))
                    }]
                });
                docx.Packer.toBlob(doc).then(blob => saveAs(blob, filename + '.docx'));
            } else if (format.includes('PDF') && typeof html2pdf !== 'undefined') {
                const element = document.createElement('div');
                element.innerHTML = marked ? marked.parse(content) : content;
                html2pdf().from(element).save(filename + '.pdf');
            }
        });
    });

    // 复制按钮
    const copyBtn = document.getElementById('copy-btn');
    if (copyBtn) {
        const newCopy = copyBtn.cloneNode(true);
        copyBtn.parentNode.replaceChild(newCopy, copyBtn);
        
        newCopy.addEventListener('click', () => {
            const text = document.getElementById('generated-report')?.innerText;
            if (text && !text.includes('AI is thinking')) {
                navigator.clipboard.writeText(text);
                showToast('Copied to clipboard!', 'success');
            }
        });
    }
}

// =================================================
// 模块 11: 支付 (PayPal) - 完全展开
// =================================================

function setupPayment() {
    const payButtons = document.querySelectorAll('.choose-plan-btn');
    const paymentModal = document.getElementById('payment-modal-overlay');
    const closePaymentBtn = document.getElementById('close-payment-btn');
    const paypalContainer = document.getElementById('paypal-button-container');

    // 价格卡片点选效果
    document.querySelectorAll('.pricing-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('button')) return;
            document.querySelectorAll('.pricing-card').forEach(c => c.classList.remove('plan-active'));
            card.classList.add('plan-active');
        });
    });

    // 关闭弹窗逻辑
    if (closePaymentBtn && paymentModal) {
        closePaymentBtn.addEventListener('click', () => {
             paymentModal.style.display = 'none';
             if (paypalContainer) paypalContainer.innerHTML = '';
        });
        paymentModal.addEventListener('click', (e) => {
             if (e.target === paymentModal) paymentModal.style.display = 'none';
        });
    }

    // 支付按钮逻辑
    payButtons.forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);

        newBtn.addEventListener('click', (e) => {
             e.preventDefault();
             const token = localStorage.getItem('token');
             if (!token) {
                 window.openModal('login');
                 return;
             }
             
             const planType = newBtn.dataset.plan;
             const amount = planType === 'basic' ? '9.90' : '19.90';
             const planName = planType === 'basic' ? 'Basic Plan' : 'Pro Plan';
             
             // 打开弹窗
             if (paymentModal) paymentModal.style.display = 'flex';
             const planLabel = document.getElementById('payment-plan-name');
             if (planLabel) planLabel.textContent = planName;
             
             // 渲染 PayPal 按钮
             if (window.paypal && paypalContainer) {
                 paypalContainer.innerHTML = ''; // 清空旧按钮
                 window.paypal.Buttons({
                     createOrder: (data, actions) => {
                         return actions.order.create({
                             purchase_units: [{
                                 description: planName,
                                 amount: { value: amount }
                             }]
                         });
                     },
                     onApprove: (data, actions) => {
                         return actions.order.capture().then(async (details) => {
                             paymentModal.style.display = 'none';
                             try {
                                 // 通知后端更新状态
                                 const res = await fetch(`${API_BASE_URL}/api/upgrade-plan`, {
                                     method: 'POST', 
                                     headers: {
                                         'Content-Type': 'application/json',
                                         'Authorization': `Bearer ${token}`
                                     },
                                     body: JSON.stringify({ plan: planType })
                                 });
                                 
                                 if (res.ok) {
                                     showToast('Upgrade Successful!', 'success');
                                     setTimeout(() => window.location.href = 'usage.html', 1500);
                                 } else {
                                     showToast('Upgrade recorded failed, contact support.', 'warning');
                                 }
                             } catch (err) {
                                 showToast('Network Error', 'error');
                             }
                         });
                     },
                     onError: (err) => {
                         console.error(err);
                         showToast('Payment Error', 'error');
                     }
                 }).render('#paypal-button-container');
             } else {
                 showToast('PayPal SDK not loaded', 'error');
             }
        });
    });
}

// =================================================
// 模块 12: 历史记录加载 - 完全展开
// =================================================

async function setupHistoryLoader() {
    const listContainer = document.getElementById('report-list');
    if (!listContainer) return; // 当前不是历史记录页

    const token = localStorage.getItem('token');
    if (!token) {
        listContainer.innerHTML = '<div class="text-center py-10 text-red-500">Please login to view history.</div>';
        return;
    }
    
    listContainer.innerHTML = '<div class="text-center py-10 text-gray-500">Loading reports...</div>';
    
    try {
        const res = await fetch(`${API_BASE_URL}/api/reports`, { 
            headers: { 'Authorization': `Bearer ${token}` } 
        });
        const reports = await res.json();
        
        if (reports.length === 0) {
            listContainer.innerHTML = '<div class="text-center py-10 text-gray-400">No reports found. Generate one now!</div>';
            return;
        }
        
        listContainer.innerHTML = '';
        reports.forEach(report => {
            const card = document.createElement('div');
            card.className = "bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition border border-gray-100 mb-4";
            
            const preview = report.content.replace(/[#*`]/g, '').slice(0, 100) + '...';
            const dateStr = new Date(report.createdAt).toLocaleDateString();

            card.innerHTML = `
                <div class="flex justify-between items-start">
                    <div>
                        <h4 class="text-lg font-bold text-gray-800 mb-1">${report.title || 'Untitled Report'}</h4>
                        <div class="flex items-center gap-2 mb-3">
                            <span class="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">${report.type || 'General'}</span>
                            <span class="text-xs text-gray-400">📅 ${dateStr}</span>
                        </div>
                        <p class="text-gray-600 text-sm mb-4 leading-relaxed">${preview}</p>
                    </div>
                    <button class="view-btn px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 text-sm font-medium transition">
                        View
                    </button>
                </div>
            `;
            
            // 简单的详情查看逻辑
            card.querySelector('.view-btn').addEventListener('click', () => {
                alert("Full Content Preview:\n\n" + report.content.slice(0, 500) + "...");
            });
            
            listContainer.appendChild(card);
        });
    } catch (e) {
        listContainer.innerHTML = '<div class="text-center text-red-500">Error loading reports.</div>';
    }
}

// =================================================
// 模块 13: 联系表单 - 完全展开
// =================================================

function setupContactForm() {
    const form = document.getElementById('contact-form');
    
    // 自动填充用户信息
    if (currentUser) {
        const nameInput = document.getElementById('name');
        const emailInput = document.getElementById('email');
        if (nameInput) nameInput.value = currentUser.name;
        if (emailInput) emailInput.value = currentUser.email;
    }

    if (form) {
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);

        newForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = newForm.querySelector('button');
            const originalText = submitBtn.innerText;
            
            submitBtn.disabled = true;
            submitBtn.innerText = 'Sending...';

            try {
                const payload = {
                    name: document.getElementById('name').value,
                    email: document.getElementById('email').value,
                    message: document.getElementById('message').value,
                    type: document.getElementById('contact-type')?.value || 'General'
                };

                const res = await fetch(`${API_BASE_URL}/api/contact`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (res.ok) {
                    showToast('Message sent successfully!', 'success');
                    newForm.reset();
                } else {
                    throw new Error('Failed to send');
                }
            } catch (err) {
                showToast('Error sending message. Try again.', 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerText = originalText;
            }
        });
    }
}
