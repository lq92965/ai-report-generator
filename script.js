/*
 * ===================================================================
 * * Reportify AI - script.js (v28.0 绝对完整版)
 * * 状态: 包含所有模块的完整代码，无任何省略。
 * * 修复列表:
 * * 1. 强制渲染登录/注册 HTML (解决输入框消失问题)
 * * 2. 严格密码验证 (大小写+数字+特殊字符)
 * * 3. 头像上传 (2MB限制 + 404提示)
 * * 4. 支付模块 (PayPal 完整集成)
 * * 5. 历史记录 (完整加载逻辑)
 * * 6. 消息中心 (完整轮询逻辑)
 * ===================================================================
 */

const API_BASE_URL = 'https://api.goreportify.com'; 
let allTemplates = [];
let currentUser = null;
let currentUserPlan = 'basic';

// =================================================
// 1. 全局工具函数
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

// 弹窗控制 (挂载在 window 上)
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

    // 2. 切换内容
    document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));
    const target = document.getElementById(tabToShow);
    if (target) target.classList.remove('hidden');
};

window.closeModal = function() {
    const overlay = document.getElementById('auth-modal-overlay');
    if (overlay) overlay.classList.add('hidden');
};

// =================================================
// 2. 初始化流程
// =================================================

// Google 回调优先处理
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

// 主初始化
document.addEventListener('DOMContentLoaded', async () => {
    await fetchUserProfile(); // 获取用户

    setupAuthUI();          // 强制渲染登录框 (修复空白问题)
    setupUserDropdown();    // 用户菜单
    setupMessageCenter();   // 消息中心
    setupGenerator();       // 生成器
    setupTemplates();       // 模板加载
    setupExport();          // 导出
    setupPayment();         // 支付 (完整代码已补全)
    setupContactForm();     // 联系表单 (完整代码已补全)
    setupHistoryLoader();   // 历史记录 (完整代码已补全)
    setupAvatarUpload();    // 头像上传

    console.log("Reportify AI v28.0 (Truly Full) Initialized");
});

// =================================================
// 3. 核心功能模块
// =================================================

async function fetchUserProfile() {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
        const res = await fetch(`${API_BASE_URL}/api/me`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) {
            currentUser = await res.json();
            currentUserPlan = currentUser.plan || 'basic';
        } else {
            localStorage.removeItem('token');
            currentUser = null;
        }
    } catch (e) { console.error("Profile Error", e); }
}

// --- 模块: 认证 UI (强制 HTML 注入 + 严格验证) ---
function setupAuthUI() {
    const closeModalBtn = document.getElementById('close-modal-btn');
    if (closeModalBtn) closeModalBtn.addEventListener('click', window.closeModal);
    
    // Tab 切换
    document.querySelectorAll('.tab-link').forEach(t => {
        t.addEventListener('click', () => window.openModal(t.dataset.tab));
    });

    // 1. 强制渲染 Login HTML (解决输入框不显示问题)
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
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
                if (!res.ok) throw new Error(data.message || 'Login failed');
                
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

    // 2. 强制渲染 Signup HTML (含密码强度 UI)
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

        const newForm = signupForm.cloneNode(true);
        signupForm.parentNode.replaceChild(newForm, signupForm);
        
        const nameInput = document.getElementById('signup-name');
        const emailInput = document.getElementById('signup-email');
        const passInput = document.getElementById('signup-password');
        const strengthBox = document.getElementById('password-strength-box');
        const submitBtn = document.getElementById('btn-signup-submit');

        // 实时验证逻辑
        if(passInput) {
            passInput.addEventListener('focus', () => strengthBox.classList.remove('hidden'));
            const validate = () => {
                const val = passInput.value;
                const rules = {
                    length: val.length >= 8,
                    upper: /[A-Z]/.test(val) && /[a-z]/.test(val),
                    number: /[0-9]/.test(val),
                    special: /[!@#$%^&*(),.?":{}|<>]/.test(val)
                };
                
                const update = (id, valid) => {
                    const el = document.getElementById(id);
                    if(el) {
                        el.className = valid ? 'text-green-600 font-bold text-xs' : 'text-gray-400 text-xs';
                        el.innerHTML = valid ? `<i class="fas fa-check-circle mr-1"></i> ${el.innerText.replace(/^[○✓] /, '')}` : `<i class="far fa-circle mr-1"></i> ${el.innerText.replace(/^[✓] /, '')}`;
                    }
                };
                update('req-length', rules.length);
                update('req-upper', rules.upper);
                update('req-number', rules.number);
                update('req-special', rules.special);

                const allValid = Object.values(rules).every(Boolean) && nameInput.value.length > 0 && emailInput.value.includes('@');
                if (allValid) {
                    submitBtn.disabled = false;
                    submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                } else {
                    submitBtn.disabled = true;
                    submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
                }
            };
            passInput.addEventListener('input', validate);
            nameInput.addEventListener('input', validate);
            emailInput.addEventListener('input', validate);
        }

        newForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const oldText = submitBtn.innerText;
            submitBtn.innerText = 'Creating...'; submitBtn.disabled = true;
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
                submitBtn.disabled = false; submitBtn.innerText = oldText;
            }
        });
    }

    // 3. Google 按钮修复 (防止提交表单)
    document.querySelectorAll('.google-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                const res = await fetch(`${API_BASE_URL}/auth/google`);
                const data = await res.json();
                if (data.url) window.location.href = data.url;
            } catch (err) { showToast('Connection Error', 'error'); }
        });
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

// --- 模块: 头像上传 ---
function setupAvatarUpload() {
    const uploadInput = document.getElementById('upload-avatar');
    if (!uploadInput) return; 

    uploadInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        // 限制 2MB
        if (file.size > 2 * 1024 * 1024) { showToast('Max 2MB', 'error'); return; }

        const formData = new FormData();
        formData.append('avatar', file);
        const token = localStorage.getItem('token');
        showToast('Uploading...', 'info');

        try {
            const res = await fetch(`${API_BASE_URL}/api/upload-avatar`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            if (res.ok) {
                showToast('Avatar updated!', 'success');
                setTimeout(() => window.location.reload(), 1000);
            } else if (res.status === 404) {
                showToast('Error: Server missing upload feature (404)', 'error');
            } else {
                showToast('Upload failed', 'error');
            }
        } catch (err) {
            showToast('Network error', 'error');
        }
    });
}

// --- 模块: 用户菜单 ---
function setupUserDropdown() {
    const headerRight = document.getElementById('auth-container');
    if (!headerRight) return;
    if (!currentUser) {
        headerRight.innerHTML = `
            <button class="text-gray-600 hover:text-blue-600 font-medium px-3 py-2 mr-2" onclick="openModal('login')">Login</button>
            <button class="bg-blue-600 text-white px-5 py-2 rounded-full font-bold shadow-lg hover:bg-blue-700" onclick="openModal('signup')">Get Started</button>`;
    } else {
        const avatar = currentUser.picture ? `<img src="${currentUser.picture}" class="w-10 h-10 rounded-full border-2 border-white shadow-md cursor-pointer hover:opacity-90 object-cover" onclick="toggleUserMenu()">` : `<button onclick="toggleUserMenu()" class="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold shadow-md cursor-pointer border-2 border-white">${currentUser.name.charAt(0)}</button>`;
        headerRight.innerHTML = `
            <div class="relative flex items-center gap-3">
                <span class="text-sm font-medium text-gray-700 hidden md:block">Hi, ${currentUser.name}</span>
                ${avatar}
                <div id="user-dropdown" class="hidden absolute right-0 top-14 w-56 bg-white rounded-xl shadow-2xl border border-gray-100 z-[9999] overflow-hidden">
                     <div class="px-4 py-3 border-b bg-gray-50"><p class="text-sm font-bold truncate">${currentUser.email}</p></div>
                     <a href="profile.html" class="block px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 border-b flex items-center gap-2"><i class="fas fa-user-circle text-blue-500"></i> My Profile</a>
                     <a href="usage.html" class="block px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 border-b flex items-center gap-2"><i class="fas fa-chart-pie text-green-500"></i> Usage</a>
                     <a href="subscription.html" class="block px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 border-b flex items-center gap-2"><i class="fas fa-credit-card text-purple-500"></i> Subscription</a>
                     <a href="#" onclick="logout()" class="block px-4 py-3 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"><i class="fas fa-sign-out-alt"></i> Logout</a>
                </div>
            </div>`;
    }
}

window.toggleUserMenu = function() { const m = document.getElementById('user-dropdown'); if(m) m.classList.toggle('hidden'); };
window.logout = function() { localStorage.removeItem('token'); window.location.href = 'index.html'; };
window.onclick = function(e) { if(!e.target.closest('#auth-container')) { const m = document.getElementById('user-dropdown'); if(m && !m.classList.contains('hidden')) m.classList.add('hidden'); }};

// --- 模块: 消息中心 ---
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
    if (!token) { showToast("Login first", "warning"); return; }
    const modal = document.getElementById('message-modal');
    if(modal) { modal.classList.remove('hidden'); document.body.style.overflow='hidden'; loadMessages(true); }
};
window.closeMessageCenter = function() { 
    const modal = document.getElementById('message-modal'); 
    if(modal) { modal.classList.add('hidden'); document.body.style.overflow=''; }
};
window.checkNotifications = async function() {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
        const res = await fetch(`${API_BASE_URL}/api/my-messages`, { headers: { 'Authorization': `Bearer ${token}` } });
        const msgs = await res.json();
        const replied = msgs.filter(m => m.status === 'replied').length;
        const last = parseInt(localStorage.getItem('seen_reply_count') || '0');
        if (replied > last) { const b = document.getElementById('notif-badge'); if(b) b.classList.remove('hidden'); }
    } catch (e) {}
};

async function loadMessages(read) {
    const c = document.getElementById('msg-list-container');
    const token = localStorage.getItem('token');
    c.innerHTML = '<div class="text-center text-gray-400 p-4">Loading...</div>';
    try {
        const res = await fetch(`${API_BASE_URL}/api/my-messages`, { headers: { 'Authorization': `Bearer ${token}` } });
        const msgs = await res.json();
        if(read) {
             localStorage.setItem('seen_reply_count', msgs.filter(m => m.status === 'replied').length);
             const b = document.getElementById('notif-badge'); if(b) b.classList.add('hidden');
        }
        if(msgs.length === 0) { c.innerHTML = '<div class="text-center p-4">No messages.</div>'; return; }

        let html = '';
        msgs.forEach(m => {
             const reply = m.conversation?.find(x=>x.role==='admin')?.message || m.reply || '';
             const right = reply 
                ? `<div class="bg-blue-50 p-4 rounded text-sm">${reply}</div>` 
                : `<div class="bg-gray-50 p-4 rounded text-center text-gray-400 text-sm">Waiting for reply...</div>`;
             
             html += `
                <div class="bg-white p-4 mb-4 rounded shadow border">
                    <div class="flex justify-between mb-2">
                        <span class="badge bg-gray-200 px-2 py-1 rounded text-xs font-bold">${m.type||'Feedback'}</span>
                        <span class="text-xs text-gray-400">${new Date(m.submittedAt).toLocaleDateString()}</span>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div class="text-sm text-gray-700">${m.message}</div>
                        <div>${right}</div>
                    </div>
                </div>`;
        });
        c.innerHTML = html;
    } catch(e) { c.innerHTML = 'Error loading.'; }
}

// --- 模块: 模板与生成器 ---
async function setupTemplates() {
    const s = document.getElementById('template');
    if(!s) return;
    try {
        const t = localStorage.getItem('token');
        const res = await fetch(`${API_BASE_URL}/api/templates`, { headers: t ? { 'Authorization': `Bearer ${t}` } : {} });
        if(res.ok) {
            allTemplates = await res.json();
            s.innerHTML = '<option value="" disabled selected>Select...</option>';
            const groups = {};
            allTemplates.forEach(i => {
                const c = i.category || 'Custom';
                if(!groups[c]) groups[c]=[];
                groups[c].push(i);
            });
            for(const [cat,items] of Object.entries(groups)) {
                const g = document.createElement('optgroup'); g.label = cat;
                items.forEach(i => {
                    const o = document.createElement('option');
                    o.value = i._id; 
                    o.textContent = (i.isPro && currentUserPlan!=='pro' ? '🔒 ' : '') + i.title;
                    g.appendChild(o);
                });
                s.appendChild(g);
            }
            s.addEventListener('change', () => {
                 const tmpl = allTemplates.find(x => x._id === s.value);
                 const d = document.getElementById('dynamic-inputs-container');
                 const tx = document.getElementById('key-points');
                 if(d) d.innerHTML = '';
                 if(tmpl && tmpl.variables) {
                     if(tx) tx.placeholder = "Additional notes...";
                     tmpl.variables.forEach(v => {
                         const div = document.createElement('div');
                         div.className = 'mb-3 input-wrapper';
                         div.innerHTML = `<label class="block text-sm font-bold mb-1">${v.label}</label><input class="dynamic-input w-full border p-2 rounded" data-key="${v.id}" placeholder="${v.placeholder||''}">`;
                         d.appendChild(div);
                     });
                 } else if(tx) { tx.placeholder = "Enter key points here..."; }
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
             const t = localStorage.getItem('token');
             if(!t) { window.openModal('login'); return; }
             const inputs = {};
             document.querySelectorAll('.dynamic-input').forEach(i => inputs[i.dataset.key] = i.value);
             const prompt = document.getElementById('key-points')?.value || '';
             
             if(!prompt && Object.keys(inputs).length === 0) { alert('Enter content.'); return; }
             
             const box = document.getElementById('generated-report');
             const oldText = newBtn.innerText;
             newBtn.innerText = 'Generating...'; newBtn.disabled = true;
             if(box) box.innerText = "Thinking...";
             
             try {
                 const res = await fetch(`${API_BASE_URL}/api/generate`, {
                     method: 'POST',
                     headers: {'Content-Type':'application/json', 'Authorization': `Bearer ${t}`},
                     body: JSON.stringify({
                         templateId: document.getElementById('template').value,
                         inputs: inputs,
                         userPrompt: prompt,
                         role: document.getElementById('role')?.value || 'General',
                         tone: document.getElementById('tone')?.value || 'Professional',
                         language: document.getElementById('language')?.value || 'English'
                     })
                 });
                 const d = await res.json();
                 if(box) box.innerText = res.ok ? d.generatedText : (d.error || 'Failed');
             } catch(e) { if(box) box.innerText = "Network Error"; }
             finally { newBtn.innerText = oldText; newBtn.disabled = false; }
        });
    }
}

// --- 模块: 导出 ---
function setupExport() {
    document.querySelectorAll('.export-btn').forEach(b => {
        const nb = b.cloneNode(true); b.parentNode.replaceChild(nb, b);
        nb.addEventListener('click', () => {
            const txt = document.getElementById('generated-report')?.innerText;
            if(!txt || txt.length < 5) { showToast('Generate first', 'warning'); return; }
            const fmt = nb.dataset.format || nb.innerText.trim();
            const fn = `Report_${new Date().toISOString().slice(0,10)}`;
            
            if(fmt === 'Markdown') saveAs(new Blob([txt], {type:'text/plain'}), fn+'.md');
            else if(fmt.includes('Word') && typeof docx !== 'undefined') {
                const doc = new docx.Document({sections:[{children: txt.split('\n').map(l=>new docx.Paragraph(l))}]});
                docx.Packer.toBlob(doc).then(b => saveAs(b, fn+'.docx'));
            } else if(fmt.includes('PDF') && typeof html2pdf !== 'undefined') {
                 const el = document.createElement('div');
                 el.innerHTML = marked ? marked.parse(txt) : txt;
                 html2pdf().from(el).save(fn+'.pdf');
            }
        });
    });
    const copy = document.getElementById('copy-btn');
    if(copy) {
        const nc = copy.cloneNode(true); copy.parentNode.replaceChild(nc, copy);
        nc.addEventListener('click', () => {
             const t = document.getElementById('generated-report')?.innerText;
             if(t) { navigator.clipboard.writeText(t); showToast('Copied','success'); }
        });
    }
}

// --- 模块: 支付 (完整恢复) ---
function setupPayment() {
    const btns = document.querySelectorAll('.choose-plan-btn');
    const modal = document.getElementById('payment-modal-overlay');
    const close = document.getElementById('close-payment-btn');
    const container = document.getElementById('paypal-button-container');

    document.querySelectorAll('.pricing-card').forEach(c => {
        c.addEventListener('click', (e) => {
            if(e.target.closest('button')) return;
            document.querySelectorAll('.pricing-card').forEach(x => x.classList.remove('plan-active'));
            c.classList.add('plan-active');
        });
    });

    if(close && modal) {
        close.addEventListener('click', () => { modal.style.display='none'; if(container) container.innerHTML=''; });
        modal.addEventListener('click', (e) => { if(e.target===modal) modal.style.display='none'; });
    }

    btns.forEach(b => {
        const nb = b.cloneNode(true); b.parentNode.replaceChild(nb, b);
        nb.addEventListener('click', (e) => {
             e.preventDefault();
             const t = localStorage.getItem('token');
             if(!t) { window.openModal('login'); return; }
             
             const plan = nb.dataset.plan;
             const amt = plan==='basic'?'9.90':'19.90';
             const name = plan==='basic'?'Basic Plan':'Pro Plan';
             
             if(modal) modal.style.display='flex';
             const lbl = document.getElementById('payment-plan-name');
             if(lbl) lbl.textContent = name;
             
             if(window.paypal && container) {
                 container.innerHTML = '';
                 window.paypal.Buttons({
                     createOrder: (d, a) => a.order.create({purchase_units:[{description:name, amount:{value:amt}}]}),
                     onApprove: (d, a) => a.order.capture().then(async () => {
                         modal.style.display='none';
                         try {
                             await fetch(`${API_BASE_URL}/api/upgrade-plan`, {
                                 method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${t}`},
                                 body:JSON.stringify({plan})
                             });
                             showToast('Upgraded!', 'success');
                             setTimeout(()=>window.location.href='usage.html',1500);
                         } catch(e) { showToast('Network Error','error'); }
                     })
                 }).render('#paypal-button-container');
             }
        });
    });
}

// --- 模块: 历史记录 (完整恢复) ---
async function setupHistoryLoader() {
    const list = document.getElementById('report-list');
    if(!list) return;
    const t = localStorage.getItem('token');
    if(!t) { list.innerHTML='<div class="text-center py-10">Login required.</div>'; return; }
    
    list.innerHTML = '<div class="text-center py-10">Loading...</div>';
    try {
        const res = await fetch(`${API_BASE_URL}/api/reports`, { headers: {'Authorization':`Bearer ${t}`} });
        const data = await res.json();
        if(data.length === 0) { list.innerHTML='<div class="text-center py-10">No reports.</div>'; return; }
        
        list.innerHTML = '';
        data.forEach(r => {
            const div = document.createElement('div');
            div.className = "bg-white p-6 rounded shadow mb-4 border";
            div.innerHTML = `
                <div class="flex justify-between">
                    <div>
                        <h4 class="font-bold">${r.title||'Untitled'}</h4>
                        <span class="text-xs text-gray-400">${new Date(r.createdAt).toLocaleDateString()}</span>
                        <p class="text-sm text-gray-600 mt-2">${r.content.slice(0,100)}...</p>
                    </div>
                    <button class="px-3 py-1 border rounded text-sm hover:bg-gray-50">View</button>
                </div>`;
            div.querySelector('button').addEventListener('click', () => alert(r.content));
            list.appendChild(div);
        });
    } catch(e) { list.innerHTML='<div class="text-center text-red-500">Error.</div>'; }
}

// --- 模块: 联系表单 (完整恢复) ---
function setupContactForm() {
    const f = document.getElementById('contact-form');
    if(currentUser) {
        const n = document.getElementById('name');
        const e = document.getElementById('email');
        if(n) n.value = currentUser.name;
        if(e) e.value = currentUser.email;
    }
    if(f) {
        const nf = f.cloneNode(true); f.parentNode.replaceChild(nf, f);
        nf.addEventListener('submit', async (e) => {
            e.preventDefault();
            const b = nf.querySelector('button');
            b.disabled=true; b.innerText='Sending...';
            try {
                await fetch(`${API_BASE_URL}/api/contact`, {
                    method:'POST',
                    headers:{'Content-Type':'application/json'},
                    body:JSON.stringify({
                        name: document.getElementById('name').value,
                        email: document.getElementById('email').value,
                        message: document.getElementById('message').value,
                        type: document.getElementById('contact-type')?.value||'General'
                    })
                });
                showToast('Sent!','success'); nf.reset();
            } catch(x) { showToast('Error','error'); }
            finally { b.disabled=false; b.innerText='Submit Feedback'; }
        });
    }
}
