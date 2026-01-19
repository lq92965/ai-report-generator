/*
 * ===================================================================
 * * Reportify AI - script.js (v26.0 终极全功能完整版)
 * * 包含：严格验证、支付集成、历史记录、头像上传、消息中心、性能优化
 * ===================================================================
 */

const API_BASE_URL = 'https://api.goreportify.com'; // 如果你在本地调试，请改为 http://localhost:5000
let allTemplates = [];
let currentUser = null;
let currentUserPlan = 'basic';

// =================================================
// 1. 全局工具函数 (Toast, SaveAs, Modal)
// =================================================

window.showToast = function(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    let icon = type === 'success' ? 'fa-check-circle' : (type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle');
    toast.innerHTML = `<i class="fas ${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.5s ease forwards';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
};

window.saveAs = function(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
};

// 弹窗控制 (挂载在 window 上以便 HTML onclick 调用)
const authModalOverlay = document.getElementById('auth-modal-overlay');

window.openModal = function(tabToShow = 'login') {
    const overlay = document.getElementById('auth-modal-overlay');
    if (overlay) overlay.classList.remove('hidden');

    // 1. 切换 Tab 样式
    document.querySelectorAll('.tab-link').forEach(btn => {
        if (btn.dataset.tab === tabToShow) {
            btn.classList.add('text-blue-600', 'border-blue-600', 'bg-white');
            btn.classList.remove('text-gray-500', 'border-transparent');
        } else {
            btn.classList.remove('text-blue-600', 'border-blue-600', 'bg-white');
            btn.classList.add('text-gray-500', 'border-transparent');
        }
    });

    // 2. 切换内容显示 (确保 ID 存在)
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.add('hidden');
    });
    const target = document.getElementById(tabToShow);
    if (target) target.classList.remove('hidden');
};

window.closeModal = function() {
    const overlay = document.getElementById('auth-modal-overlay');
    if (overlay) overlay.classList.add('hidden');
};

// =================================================
// 2. 初始化流程 (DOMContentLoaded)
// =================================================

// Google 回调处理 (最优先)
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');
    const errorFromUrl = urlParams.get('error');

    if (tokenFromUrl) {
        localStorage.setItem('token', tokenFromUrl);
        window.history.replaceState({}, document.title, window.location.pathname);
        showToast('Login Successful!', 'success');
        setTimeout(() => window.location.href = 'index.html', 500);
        return;
    }
    if (errorFromUrl) {
        showToast('Google Login Failed', 'error');
        window.history.replaceState({}, document.title, window.location.pathname);
    }
});

// 主初始化逻辑
document.addEventListener('DOMContentLoaded', async () => {
    await fetchUserProfile(); // 等待用户信息获取完毕

    setupAuthUI();          // 认证弹窗 & 严格验证
    setupUserDropdown();    // 用户菜单
    setupMessageCenter();   // 消息中心 (小铃铛)
    setupGenerator();       // 核心生成器
    setupTemplates();       // 模板加载
    setupExport();          // 导出功能
    setupPayment();         // 支付功能 (已补全)
    setupContactForm();     // 联系表单
    setupHistoryLoader();   // 历史记录 (已补全)
    setupAvatarUpload();    // 头像上传 (已增强)

    console.log("Reportify AI v26.0 (Full) Initialized");
});

// =================================================
// 3. 模块详解
// =================================================

// --- 模块 A: 用户信息获取 ---
async function fetchUserProfile() {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
        const res = await fetch(`${API_BASE_URL}/api/me`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) {
            currentUser = await res.json();
            currentUserPlan = currentUser.plan || 'basic';
        } else {
            // Token 失效，清理掉
            localStorage.removeItem('token');
            currentUser = null;
        }
    } catch (e) { console.error("Profile Fetch Error:", e); }
}

// --- 模块 B: 用户菜单 (Dropdown) ---
function setupUserDropdown() {
    const headerRight = document.getElementById('auth-container');
    if (!headerRight) return;

    if (!currentUser) {
        // 未登录
        headerRight.innerHTML = `
            <button class="text-gray-600 hover:text-blue-600 font-medium px-3 py-2 mr-2" onclick="openModal('login')">Login</button>
            <button class="bg-blue-600 text-white px-5 py-2 rounded-full font-bold shadow-lg hover:bg-blue-700" onclick="openModal('signup')">Get Started</button>
        `;
    } else {
        // 已登录
        const initial = currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U';
        const avatarHTML = currentUser.picture 
            ? `<img src="${currentUser.picture}" class="w-10 h-10 rounded-full border-2 border-white shadow-md cursor-pointer hover:opacity-90 object-cover" onclick="toggleUserMenu()">`
            : `<button onclick="toggleUserMenu()" class="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold shadow-md cursor-pointer border-2 border-white">${initial}</button>`;

        headerRight.innerHTML = `
            <div class="relative flex items-center gap-3">
                <span class="text-sm font-medium text-gray-700 hidden md:block">Hi, ${currentUser.name}</span>
                ${avatarHTML}
                
                <div id="user-dropdown" class="hidden absolute right-0 top-14 w-56 bg-white rounded-xl shadow-2xl border border-gray-100 z-[9999] overflow-hidden animate-fade-in">
                    <div class="px-4 py-3 border-b border-gray-50 bg-gray-50">
                        <p class="text-xs text-gray-500 font-semibold uppercase">Account</p>
                        <p class="text-sm font-bold text-gray-800 truncate">${currentUser.email}</p>
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

window.toggleUserMenu = function() {
    const menu = document.getElementById('user-dropdown');
    if (menu) menu.classList.toggle('hidden');
};
window.logout = function() {
    localStorage.removeItem('token');
    window.location.href = 'index.html';
};
// 点击空白关闭菜单
window.onclick = function(event) {
    if (!event.target.closest('#auth-container')) {
        const menu = document.getElementById('user-dropdown');
        if (menu && !menu.classList.contains('hidden')) menu.classList.add('hidden');
    }
};

// --- 模块 C: 头像上传 (增强版) ---
function setupAvatarUpload() {
    const uploadInput = document.getElementById('upload-avatar');
    if (!uploadInput) return; 

    uploadInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // 1. 大小限制 (2MB)
        if (file.size > 2 * 1024 * 1024) {
            showToast('Image too large (Max 2MB)', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('avatar', file);
        const token = localStorage.getItem('token');
        
        showToast('Uploading avatar...', 'info');

        try {
            const res = await fetch(`${API_BASE_URL}/api/upload-avatar`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }, // 浏览器自动设置 Content-Type
                body: formData
            });

            if (res.ok) {
                showToast('Avatar updated!', 'success');
                setTimeout(() => window.location.reload(), 1000);
            } else {
                showToast('Upload failed', 'error');
            }
        } catch (err) {
            showToast('Network error', 'error');
        }
    });
}

// --- 模块 D: 认证 UI (带严格验证) ---
function setupAuthUI() {
    const closeModalBtn = document.getElementById('close-modal-btn');
    if (closeModalBtn) closeModalBtn.addEventListener('click', window.closeModal);
    
    // Tab 切换
    document.querySelectorAll('.tab-link').forEach(t => {
        t.addEventListener('click', () => window.openModal(t.dataset.tab));
    });

    // 1. 登录表单
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        const newForm = loginForm.cloneNode(true);
        loginForm.parentNode.replaceChild(newForm, loginForm);
        newForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = newForm.querySelector('button[type="submit"]');
            const oldText = btn.innerText;
            btn.innerText = 'Logging in...'; btn.disabled = true;
            try {
                const email = document.getElementById('login-email').value;
                const password = document.getElementById('login-password').value;
                const res = await fetch(`${API_BASE_URL}/api/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message);
                
                localStorage.setItem('token', data.token);
                showToast('Login Success!', 'success');
                window.closeModal();
                setTimeout(() => window.location.reload(), 500);
            } catch (err) {
                showToast(err.message, 'error');
                btn.disabled = false; btn.innerText = oldText;
            }
        });
    }

    // 2. 注册表单 (严格验证)
    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        const newForm = signupForm.cloneNode(true);
        signupForm.parentNode.replaceChild(newForm, signupForm);
        
        const nameInput = document.getElementById('signup-name');
        const emailInput = document.getElementById('signup-email');
        const passInput = document.getElementById('signup-password');
        const strengthBox = document.getElementById('password-strength-box');

        // 实时校验
        if(passInput) {
            passInput.addEventListener('focus', () => { if(strengthBox) strengthBox.classList.remove('hidden'); });
            passInput.addEventListener('input', () => {
                const val = passInput.value;
                const rules = {
                    length: val.length >= 8,
                    upper: /[A-Z]/.test(val) && /[a-z]/.test(val),
                    number: /[0-9]/.test(val),
                    special: /[!@#$%^&*(),.?":{}|<>]/.test(val)
                };
                const updateItem = (id, isValid) => {
                    const el = document.getElementById(id);
                    if(el) {
                        el.className = isValid ? 'text-green-600 font-bold text-xs' : 'text-gray-400 text-xs';
                        el.innerHTML = isValid ? `<i class="fas fa-check-circle mr-1"></i> ${el.innerText.replace(/^[○✓] /, '')}` : `<i class="far fa-circle mr-1"></i> ${el.innerText.replace(/^[✓] /, '')}`;
                    }
                };
                updateItem('req-length', rules.length);
                updateItem('req-upper', rules.upper);
                updateItem('req-number', rules.number);
                updateItem('req-special', rules.special);
            });
        }

        newForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn-signup-submit');
            
            // 最终校验
            const passRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            
            if (nameInput.value.length > 10) { showToast('Name too long (max 10)', 'error'); return; }
            if (!emailRegex.test(emailInput.value)) { showToast('Invalid Email', 'error'); return; }
            if (!passRegex.test(passInput.value)) { showToast('Password too weak', 'error'); return; }

            const oldText = btn.innerText;
            btn.innerText = 'Creating...'; btn.disabled = true;
            try {
                const res = await fetch(`${API_BASE_URL}/api/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ displayName: nameInput.value, email: emailInput.value, password: passInput.value })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message);
                showToast('Account Created!', 'success');
                window.openModal('login');
            } catch (err) {
                showToast(err.message, 'error');
                btn.disabled = false; btn.innerText = oldText;
            }
        });
    }

    // 3. Google 按钮修复 (防止提交表单)
    const googleBtns = document.querySelectorAll('button');
    googleBtns.forEach(btn => {
        if ((btn.textContent && btn.textContent.toLowerCase().includes('google')) || btn.classList.contains('google-btn')) {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            newBtn.type = 'button'; // 关键修复
            newBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                try {
                    const res = await fetch(`${API_BASE_URL}/auth/google`);
                    const data = await res.json();
                    if (data.url) window.location.href = data.url;
                } catch (err) { showToast('Connection Error', 'error'); }
            });
        }
    });

    // 4. Free 按钮
    document.querySelectorAll('button').forEach(btn => {
        if (btn.id === 'btn-select-free' || btn.textContent.includes('Start Free')) {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            newBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (window.location.href.includes('subscription')) window.location.href = 'index.html';
                else window.openModal('signup');
            });
        }
    });
}

// --- 模块 E: 消息中心 (优化版) ---
function setupMessageCenter() {
    const bellBtn = document.querySelector('button[title="My Messages"]') || document.getElementById('btn-message-center');
    if(bellBtn) {
        const newBtn = bellBtn.cloneNode(true);
        bellBtn.parentNode.replaceChild(newBtn, bellBtn);
        newBtn.addEventListener('click', window.openMessageCenter);
    }
    checkNotifications();
    setInterval(checkNotifications, 30000);
}

window.openMessageCenter = function() {
    const token = localStorage.getItem('token');
    if (!token) { showToast("Please login first.", "warning"); return; }
    const modal = document.getElementById('message-modal');
    if(modal) {
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        loadMessages(true);
    }
};
window.closeMessageCenter = function() {
    const modal = document.getElementById('message-modal');
    if(modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
    }
};
window.checkNotifications = async function() {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
        const res = await fetch(`${API_BASE_URL}/api/my-messages`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) return;
        const msgs = await res.json();
        const currentReplied = msgs.filter(m => m.status === 'replied').length;
        const lastSeen = parseInt(localStorage.getItem('seen_reply_count') || '0');
        if (currentReplied > lastSeen) {
            const badge = document.getElementById('notif-badge');
            if(badge) badge.classList.remove('hidden');
        }
    } catch (e) {}
};

async function loadMessages(markAsRead = false) {
    const container = document.getElementById('msg-list-container');
    const token = localStorage.getItem('token');
    container.innerHTML = '<div class="flex flex-col items-center justify-center h-full text-gray-400 gap-3"><i class="fas fa-spinner fa-spin text-3xl text-blue-500"></i><span>Loading...</span></div>';

    try {
        const res = await fetch(`${API_BASE_URL}/api/my-messages`, { headers: { 'Authorization': `Bearer ${token}` } });
        const msgs = await res.json();

        if (markAsRead) {
            const repliedCount = msgs.filter(m => m.status === 'replied').length;
            localStorage.setItem('seen_reply_count', repliedCount);
            const badge = document.getElementById('notif-badge');
            if(badge) badge.classList.add('hidden');
        }

        container.innerHTML = '';
        if (msgs.length === 0) {
            container.innerHTML = '<div class="flex flex-col items-center justify-center h-64 text-gray-300"><i class="far fa-folder-open text-5xl mb-4"></i><p>No feedback history found.</p></div>';
            return;
        }

        // 性能优化：一次性插入 HTML
        let htmlBuffer = '';
        msgs.forEach(msg => {
            const dateStr = new Date(msg.submittedAt).toLocaleDateString();
            let adminReplyContent = '';
            if (msg.conversation && msg.conversation.length > 0) {
                const adminMsgs = msg.conversation.filter(c => c.role === 'admin');
                if(adminMsgs.length > 0) {
                    adminReplyContent = adminMsgs.map(c => `
                        <div class="mb-4 pb-4 border-b border-blue-100 last:border-0 last:mb-0 last:pb-0">
                            <p class="text-xs text-blue-500 font-bold mb-1 flex items-center gap-1"><i class="fas fa-headset"></i> Support:</p>
                            <p class="text-gray-800 leading-relaxed">${c.message}</p>
                        </div>
                    `).join('');
                }
            } else if (msg.reply) {
                adminReplyContent = `<p class="text-gray-800 leading-relaxed">${msg.reply}</p>`;
            }

            const rightSide = adminReplyContent 
                ? `<div class="bg-blue-50 border-l-4 border-blue-500 p-5 rounded-r-lg h-full overflow-y-auto max-h-60">${adminReplyContent}</div>`
                : `<div class="bg-gray-50 border-l-4 border-gray-300 p-5 rounded-r-lg h-full flex flex-col justify-center items-center text-gray-400">
                     <i class="fas fa-clock text-3xl mb-2 text-yellow-400"></i>
                     <p class="font-medium text-sm">Review in progress...</p>
                   </div>`;

            htmlBuffer += `
                <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-4 flex-shrink-0">
                    <div class="bg-gray-50 px-6 py-3 border-b border-gray-100 flex justify-between items-center">
                        <div class="flex items-center gap-3">
                            <span class="bg-gray-200 text-gray-600 text-xs px-2 py-1 rounded font-bold uppercase tracking-wide">${msg.type || 'Feedback'}</span>
                            <span class="text-xs text-gray-400 font-mono">ID: ${msg._id.slice(-6)}</span>
                        </div>
                        <span class="text-xs text-gray-500 font-medium">${dateStr}</span>
                    </div>
                    <div class="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100">
                        <div class="p-6">
                            <p class="text-xs text-gray-400 font-bold uppercase mb-2">My Inquiry:</p>
                            <p class="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">${msg.message}</p>
                        </div>
                        <div class="p-0">${rightSide}</div>
                    </div>
                </div>
            `;
        });
        container.innerHTML = htmlBuffer;
    } catch (err) {
        container.innerHTML = '<p class="text-center text-red-400 mt-10">Load failed.</p>';
    }
}

// --- 模块 F: 生成器与模板 ---
async function setupTemplates() {
    const templateSelect = document.getElementById('template');
    if (!templateSelect) return;
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_BASE_URL}/api/templates`, { headers: token ? { 'Authorization': `Bearer ${token}` } : {} });
        if(res.ok) {
            allTemplates = await res.json();
            templateSelect.innerHTML = '<option value="" disabled selected>Select a Report Type...</option>';
            // 分组逻辑
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
            
            // 动态输入框
            templateSelect.addEventListener('change', () => {
                const t = allTemplates.find(x => x._id === templateSelect.value);
                const container = document.getElementById('dynamic-inputs-container');
                const textarea = document.getElementById('key-points');
                if(container) container.innerHTML = '';
                if(t && t.variables) {
                    if(textarea) textarea.placeholder = "Additional notes...";
                    t.variables.forEach(v => {
                        const div = document.createElement('div');
                        div.className = 'input-wrapper mb-3';
                        div.innerHTML = `<label class="block text-sm font-bold mb-1">${v.label}</label><input class="dynamic-input w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" data-key="${v.id}" placeholder="${v.placeholder||''}">`;
                        container.appendChild(div);
                    });
                } else if(textarea) {
                    textarea.placeholder = "Enter key points here...";
                }
            });
        }
    } catch(e) {}
}

function setupGenerator() {
    const btn = document.getElementById('generate-btn');
    if(btn) {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', async () => {
            const token = localStorage.getItem('token');
            if(!token) { window.openModal('login'); return; }
            
            const promptEl = document.getElementById('key-points');
            const resultBox = document.getElementById('generated-report');
            const inputs = {};
            document.querySelectorAll('.dynamic-input').forEach(i => inputs[i.dataset.key] = i.value);
            
            const userPromptText = promptEl ? promptEl.value.trim() : "";
            if (!userPromptText && Object.keys(inputs).length === 0) {
                alert('Please enter content.');
                if (promptEl) promptEl.focus();
                return;
            }

            const oldText = newBtn.innerText;
            newBtn.innerText = 'Generating...'; newBtn.disabled = true;
            if(resultBox) resultBox.innerText = "AI is thinking...";

            try {
                const res = await fetch(`${API_BASE_URL}/api/generate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({
                        userPrompt: userPromptText,
                        templateId: document.getElementById('template').value,
                        inputs: inputs,
                        role: document.getElementById('role')?.value || 'General',
                        tone: document.getElementById('tone')?.value || 'Professional',
                        language: document.getElementById('language')?.value || 'English'
                    })
                });
                const data = await res.json();
                if(res.ok && resultBox) {
                    resultBox.innerText = data.generatedText;
                    showToast('Generated!', 'success');
                } else {
                    if(resultBox) resultBox.innerText = "Error: " + (data.error || "Failed");
                }
            } catch(e) {
                if(resultBox) resultBox.innerText = "Network Error";
            } finally {
                newBtn.innerText = oldText; newBtn.disabled = false;
            }
        });
    }
}

// --- 模块 G: 导出与复制 ---
function setupExport() {
    document.querySelectorAll('.export-btn').forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', () => {
            const content = document.getElementById('generated-report')?.innerText;
            if(!content || content.length < 5 || content.includes('AI is thinking')) { showToast('Generate report first', 'warning'); return; }
            const format = newBtn.dataset.format || newBtn.innerText.trim();
            const filename = `Report_${new Date().toISOString().slice(0,10)}`;
            
            if(format === 'Markdown') {
                saveAs(new Blob([content], {type: 'text/plain'}), filename + '.md');
            } else if (format.includes('Word') && typeof docx !== 'undefined') {
                const doc = new docx.Document({ sections: [{ children: content.split('\n').map(t=>new docx.Paragraph(t)) }]});
                docx.Packer.toBlob(doc).then(b => saveAs(b, filename + '.docx'));
            } else if (format.includes('PDF') && typeof html2pdf !== 'undefined') {
                const el = document.createElement('div');
                el.innerHTML = marked ? marked.parse(content) : content;
                html2pdf().from(el).save(filename + '.pdf');
            }
        });
    });

    const copyBtn = document.getElementById('copy-btn');
    if(copyBtn) {
        const newCopy = copyBtn.cloneNode(true);
        copyBtn.parentNode.replaceChild(newCopy, copyBtn);
        newCopy.addEventListener('click', () => {
            const t = document.getElementById('generated-report')?.innerText;
            if(t && !t.includes('AI is thinking')) { 
                navigator.clipboard.writeText(t); 
                const original = newCopy.innerHTML;
                newCopy.innerHTML = '<i class="fas fa-check"></i>';
                setTimeout(() => newCopy.innerHTML = original, 2000);
            }
        });
    }
}

// --- 模块 H: 支付 (已完全恢复) ---
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

    if (closePaymentBtn && paymentModal) {
        closePaymentBtn.addEventListener('click', () => {
             paymentModal.style.display = 'none';
             if (paypalContainer) paypalContainer.innerHTML = '';
        });
        paymentModal.addEventListener('click', (e) => { if (e.target === paymentModal) paymentModal.style.display = 'none'; });
    }

    payButtons.forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const token = localStorage.getItem('token');
            if (!token) { window.openModal('login'); return; }
            
            const planType = newBtn.dataset.plan;
            const amount = planType === 'basic' ? '9.90' : '19.90';
            const planName = planType === 'basic' ? 'Basic Plan' : 'Pro Plan';

            if (paymentModal) paymentModal.style.display = 'flex';
            const label = document.getElementById('payment-plan-name');
            if(label) label.textContent = planName;

            if (window.paypal && paypalContainer) {
                paypalContainer.innerHTML = '';
                window.paypal.Buttons({
                    createOrder: (data, actions) => actions.order.create({ purchase_units: [{ description: planName, amount: { value: amount } }] }),
                    onApprove: (data, actions) => actions.order.capture().then(async () => {
                        paymentModal.style.display = 'none';
                        try {
                            const res = await fetch(`${API_BASE_URL}/api/upgrade-plan`, {
                                method: 'POST', 
                                headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`},
                                body: JSON.stringify({ plan: planType })
                            });
                            if(res.ok) {
                                showToast('Upgraded Successfully!', 'success');
                                setTimeout(() => window.location.href = 'usage.html', 1500);
                            } else {
                                showToast('Upgrade failed', 'error');
                            }
                        } catch(e) { showToast('Network Error', 'error'); }
                    })
                }).render('#paypal-button-container');
            }
        });
    });
}

// --- 模块 I: 历史记录加载 (已完全恢复) ---
async function setupHistoryLoader() {
    const container = document.getElementById('report-list');
    if (!container) return; // 不在历史页

    const token = localStorage.getItem('token');
    if (!token) { container.innerHTML = '<div class="text-center py-10">Please login.</div>'; return; }
    
    container.innerHTML = '<div class="text-center py-10">Loading...</div>';
    
    try {
        const res = await fetch(`${API_BASE_URL}/api/reports`, { headers: { 'Authorization': `Bearer ${token}` } });
        const reports = await res.json();
        
        if(reports.length === 0) {
            container.innerHTML = '<div class="text-center py-10 text-gray-500">No reports found.</div>';
            return;
        }
        
        container.innerHTML = '';
        reports.forEach(report => {
            const card = document.createElement('div');
            card.className = "bg-white p-6 rounded-lg shadow hover:shadow-md transition border border-gray-100 mb-4";
            const preview = report.content.replace(/[#*`]/g, '').slice(0, 100) + '...';
            card.innerHTML = `
                <div class="flex justify-between items-start">
                    <div>
                        <h4 class="text-lg font-bold text-gray-800 mb-1">${report.title || 'Untitled'}</h4>
                        <div class="flex items-center gap-2 mb-3">
                            <span class="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">${report.type || 'General'}</span>
                            <span class="text-xs text-gray-400">📅 ${new Date(report.createdAt).toLocaleDateString()}</span>
                        </div>
                        <p class="text-gray-600 text-sm mb-4">${preview}</p>
                    </div>
                    <button class="px-4 py-2 border rounded hover:bg-gray-50 text-sm font-medium">View</button>
                </div>
            `;
            // 点击逻辑（简单弹窗示例）
            card.querySelector('button').addEventListener('click', () => {
                alert("Detailed view would open here.\n\n" + report.content.slice(0, 200) + "...");
            });
            container.appendChild(card);
        });
    } catch(e) {
        container.innerHTML = '<div class="text-center text-red-500">Error loading reports.</div>';
    }
}

// --- 模块 J: 联系表单 ---
function setupContactForm() {
    const form = document.getElementById('contact-form');
    // 自动填充
    if(currentUser) {
        const n = document.getElementById('name');
        const e = document.getElementById('email');
        if(n) n.value = currentUser.name;
        if(e) e.value = currentUser.email;
    }

    if(form) {
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);
        newForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = newForm.querySelector('button');
            const oldText = btn.innerText;
            btn.disabled = true; btn.innerText = 'Sending...';
            try {
                await fetch(`${API_BASE_URL}/api/contact`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        name: document.getElementById('name').value,
                        email: document.getElementById('email').value,
                        message: document.getElementById('message').value,
                        type: document.getElementById('contact-type')?.value || 'General'
                    })
                });
                showToast('Message sent!', 'success');
                newForm.reset();
            } catch(e) { showToast('Error sending', 'error'); }
            finally { btn.disabled = false; btn.innerText = oldText; }
        });
    }
}
