// --- 1. 核心配置 (手动管理) ---
// 如果你在本地开发，请用 http://localhost:3000
// 如果上线，请改为 https://goreportify.com
const API_BASE_URL = 'https://api.goreportify.com';


// 全局状态
let allTemplates = [];
let currentUser = null; 
let currentUserPlan = 'basic'; 

// [新增] 图片地址处理工具 (必须加在这里，否则后面会报错)
function getFullImageUrl(path) {
    // 1. 定义默认头像 (Base64灰色圆底图)，防止图片裂开
    const DEFAULT_ICON = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2UzZTNlMyI+PHBhdGggZD0iTTAgMGgyNHYyNEgwVjB6IiBmaWxsPSJub25lIi8+PGNpcmNsZSBjeD0iMTIiIGN5PSI4IiByPSI0IiBmaWxsPSIjOWNhM2FmIi8+PHBhdGggZD0iTTEyIDE0Yy02LjEgMC04IDQtOCA0djJoMTZ2LTJzLTEuOS00LTgtNHoiIGZpbGw9IiM5Y2EzYWYiLz48L3N2Zz4=';

    // 2. 拦截脏数据 (如果数据库存的是那个打不开的国外网站，强制用默认图)
    if (!path || path.includes('via.placeholder.com')) return DEFAULT_ICON;

    // 3. 如果已经是完整链接 (比如 Base64 或 http)，直接返回
    if (path.startsWith('data:') || path.startsWith('http')) return path;

    // 4. 如果是本地路径，拼接 API 地址
    const cleanPath = path.startsWith('/') ? path : '/' + path;
    return `${API_BASE_URL}${cleanPath}`;
}

// --- 2. 全局工具函数 ---

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
    setTimeout(() => toast.style.opacity = '1', 10);
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

// --- 3. 弹窗与 Tab 控制 ---
const authModalOverlay = document.getElementById('auth-modal-overlay');

window.openModal = function(tabToShow = 'login') {
    const overlay = document.getElementById('auth-modal-overlay');
    if (overlay) overlay.classList.remove('hidden');

    // 1. 切换 Tab 按钮样式
    document.querySelectorAll('.tab-link').forEach(btn => {
        if (btn.dataset.tab === tabToShow) {
            btn.classList.add('text-blue-600', 'border-blue-600', 'bg-white');
            btn.classList.remove('text-gray-500', 'border-transparent');
        } else {
            btn.classList.remove('text-blue-600', 'border-blue-600', 'bg-white');
            btn.classList.add('text-gray-500', 'border-transparent');
        }
    });

    // 2. 切换表单内容显示
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.add('hidden');
        content.style.display = 'none';
    });

    const targetContent = document.getElementById(tabToShow);
    if (targetContent) {
        targetContent.classList.remove('hidden');
        targetContent.style.display = 'block';
    }
};

window.closeModal = function() {
    const overlay = document.getElementById('auth-modal-overlay');
    if (overlay) overlay.classList.add('hidden');
};

// --- 4. 初始化流程 (Main Logic) ---
document.addEventListener('DOMContentLoaded', async () => {
    handleGoogleCallback();
    await fetchUserProfile();
    
    setupAuthUI();          // 登录/注册/Google逻辑
    setupGenerator();       
    setupTemplates();       
    setupExport();          
    setupPayment();      
    setupCopyBtn();   
    setupContactForm();     
    setupHistoryLoader();   
    setupMessageCenter();   
    setupUserDropdown();    
    setupAvatarUpload();
    console.log("Reportify AI v22.1 Initialized");

    // ... 现有的代码 ...
    if (window.location.pathname.includes('profile')) {
        loadProfilePageData();
        setupProfileForm();
    }

    // 修改：只要路径里包含 'account' 就执行
    if (window.location.pathname.includes('account')) {
        loadAccountPageAvatar();
    }
    
    // 同理，用量页也建议改一下，防止以后出问题
    if (window.location.pathname.includes('usage')) {
        loadRealUsageData(); // 假设你有这个函数
    }

    // --- [重写] 加载用量数据 (修复链接 + 补充底部数据) ---
async function loadRealUsageData() {
    // 1. 获取页面上的元素 ID
    const usedEl = document.getElementById('usage-used');
    const totalEl = document.getElementById('usage-total');
    const planEl = document.getElementById('usage-plan');
    
    // 获取底部三个卡片的 ID (请确保 usage.html 里有这些 ID)
    // 建议你把 usage.html 里的数字 span 分别加上 id="usage-remaining", id="usage-days", id="usage-active"
    // 如果没有 ID，我们尝试用 querySelector 获取
    const remainingEl = document.getElementById('usage-remaining') || document.querySelector('.card-remaining h3') || document.querySelectorAll('.stat-card h3')[0];
    const daysEl = document.getElementById('usage-days') || document.querySelector('.card-days h3') || document.querySelectorAll('.stat-card h3')[1];
    const activeEl = document.getElementById('usage-active') || document.querySelector('.card-active h3') || document.querySelectorAll('.stat-card h3')[2];

    try {
        const token = localStorage.getItem('token');
        if (!token) return;

        // 🟢 关键修复：必须使用 API_BASE_URL，不能直接写 '/api/...'
        // 并且我们改用刚才新写的 /api/usage 接口，数据更全
        const res = await fetch(`${API_BASE_URL}/api/usage`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            const data = await res.json();

            // 2. 填充数据
            if (planEl) planEl.innerText = data.plan;
            if (usedEl) usedEl.innerText = data.used;
            if (totalEl) totalEl.innerText = data.limit;

            // 3. 填充底部三个数据
            if (remainingEl) remainingEl.innerText = data.remaining;
            if (daysEl) daysEl.innerText = data.daysLeft;
            if (activeEl) activeEl.innerText = data.activeDays;
            
            console.log("用量数据加载成功:", data);
        } else {
            console.error("加载用量失败，后端返回:", res.status);
        }
    } catch (e) {
        console.error("加载用量网络错误", e);
    }
}

}); // <--- 【修复关键点】这里之前少了这个闭合标签，导致整个文件报错！


// =================================================
//  模块详情 (Functions)
// =================================================

// --- 模块 A: Google 回调 ---
function handleGoogleCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');
    const errorFromUrl = urlParams.get('error');

    if (tokenFromUrl) {
        localStorage.setItem('token', tokenFromUrl);
        window.history.replaceState({}, document.title, window.location.pathname);
        showToast('Login Successful!', 'success');
        setTimeout(() => window.location.href = 'index.html', 500);
    }
    if (errorFromUrl) {
        showToast('Google Login Failed', 'error');
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

// --- 模块 B: 用户信息 ---
async function fetchUserProfile() {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
        const res = await fetch(`${API_BASE_URL}/api/me`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) {
            currentUser = await res.json();
            currentUserPlan = currentUser.plan || 'basic';
        } else if (res.status === 401) {
            localStorage.removeItem('token');
            currentUser = null;
        }
    } catch (e) { console.error(e); }
}

// --- 模块 C: 认证 UI ---
function setupAuthUI() {
    // 1. 绑定关闭按钮
    const closeModalBtn = document.getElementById('close-modal-btn');
    if (closeModalBtn) closeModalBtn.addEventListener('click', window.closeModal);
    const overlay = document.getElementById('auth-modal-overlay');
    if (overlay) overlay.addEventListener('click', (e) => { if (e.target === overlay) window.closeModal(); });

    // 2. 绑定 Tab 切换
    document.querySelectorAll('.tab-link').forEach(t => {
        t.addEventListener('click', () => window.openModal(t.dataset.tab));
    });

    // 3. 登录表单处理
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        const newForm = loginForm.cloneNode(true);
        loginForm.parentNode.replaceChild(newForm, loginForm);
        newForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = newForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = 'Verifying...';

            try {
                const email = document.getElementById('login-email').value;
                const password = document.getElementById('login-password').value;
                const res = await fetch(`${API_BASE_URL}/api/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || 'Login failed');

                localStorage.setItem('token', data.token);
                showToast("Welcome back!", "success");
                window.closeModal();
                setTimeout(() => window.location.reload(), 800);
            } catch (err) {
                showToast(err.message, "error");
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        });
    }

    // 4. 注册表单处理
    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        const newSignupForm = signupForm.cloneNode(true);
        signupForm.parentNode.replaceChild(newSignupForm, signupForm);
        
        setupStrictValidation();

        newSignupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = newSignupForm.querySelector('button[type="submit"]');
            
            if (!validateAllFields()) {
                showToast("Please fix the errors in the form.", "error");
                return;
            }

            const originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = 'Creating...';

            try {
                const name = document.getElementById('signup-name').value;
                const email = document.getElementById('signup-email').value;
                const password = document.getElementById('signup-password').value;

                const res = await fetch(`${API_BASE_URL}/api/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ displayName: name, email, password }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || 'Registration failed');

                showToast('Account Created! Please Login.', 'success');
                window.openModal('login');
                newSignupForm.reset();
            } catch (err) {
                showToast(err.message, "error");
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        });
    }

    // 5. Google 登录按钮修复
    const googleBtns = document.querySelectorAll('button');
    googleBtns.forEach(btn => {
        if ((btn.textContent && btn.textContent.toLowerCase().includes('google')) || btn.classList.contains('google-btn')) {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            newBtn.type = 'button'; 
            newBtn.addEventListener('click', async (e) => {
                e.preventDefault(); 
                e.stopPropagation();
                
                const originalText = newBtn.innerHTML;
                newBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
                
                try {
                    const res = await fetch(`${API_BASE_URL}/auth/google`);
                    if (!res.ok) throw new Error("Auth server unreachable");
                    
                    const data = await res.json();
                    if (data.url) {
                        window.location.href = data.url; 
                    } else {
                        throw new Error("Invalid response from server");
                    }
                } catch (err) {
                    console.error("Google Auth Error:", err);
                    showToast('Cannot connect to Google Login.', 'error');
                    newBtn.innerHTML = originalText;
                }
            });
        }
    });

    // 6. Free 按钮逻辑
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

// --- 模块 C-2: 严格验证逻辑 ---
function setupStrictValidation() {
    const nameInput = document.getElementById('signup-name');
    const emailInput = document.getElementById('signup-email');
    const passInput = document.getElementById('signup-password');
    const submitBtn = document.querySelector('#signup-form button[type="submit"]');

    const getErrorSpan = (input) => {
        let span = input.nextElementSibling;
        if (!span || !span.classList.contains('validation-msg')) {
            span = document.createElement('div');
            span.className = 'validation-msg text-xs mt-1 text-left';
            input.parentNode.insertBefore(span, input.nextSibling);
        }
        return span;
    };

    const checkName = () => {
        const val = nameInput.value.trim();
        const span = getErrorSpan(nameInput);
        if (val.length === 0) { span.innerHTML = ''; return false; }
        if (val.length > 10) {
            span.innerHTML = '<span class="text-red-500">❌ 最多10个字符 (Max 10 chars)</span>';
            return false;
        }
        span.innerHTML = '<span class="text-green-600">✅ OK</span>';
        return true;
    };

    const checkEmail = () => {
        const val = emailInput.value.trim();
        const span = getErrorSpan(emailInput);
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (val.length === 0) { span.innerHTML = ''; return false; }
        if (!emailRegex.test(val)) {
            span.innerHTML = '<span class="text-red-500">❌ 格式错误 (Invalid Email)</span>';
            return false;
        }
        span.innerHTML = '<span class="text-green-600">✅ OK</span>';
        return true;
    };

    const checkPass = () => {
        const val = passInput.value;
        const span = getErrorSpan(passInput);
        
        const hasUpper = /[A-Z]/.test(val);
        const hasLower = /[a-z]/.test(val);
        const hasNumber = /[0-9]/.test(val);
        const hasSpecial = /[\W_]/.test(val); 
        const isLongEnough = val.length >= 8;

        if (val.length === 0) { span.innerHTML = ''; return false; }

        if (hasUpper && hasLower && hasNumber && hasSpecial && isLongEnough) {
            span.innerHTML = '<span class="text-green-600">✅ 密码强度合格 (Strong)</span>';
            return true;
        } else {
            span.innerHTML = `
                <div class="text-red-500 flex flex-col gap-1">
                    <span>${isLongEnough ? '✅' : '❌'} 至少8位 (Min 8 chars)</span>
                    <span>${hasUpper ? '✅' : '❌'} 大写字母 (Uppercase)</span>
                    <span>${hasLower ? '✅' : '❌'} 小写字母 (Lowercase)</span>
                    <span>${hasNumber ? '✅' : '❌'} 数字 (Number)</span>
                    <span>${hasSpecial ? '✅' : '❌'} 特殊字符 (Special char)</span>
                </div>
            `;
            return false;
        }
    };

    const validateForm = () => {
        const isNameOk = checkName();
        const isEmailOk = checkEmail();
        const isPassOk = checkPass();
        
        if (submitBtn) {
            if (isNameOk && isEmailOk && isPassOk) {
                submitBtn.disabled = false;
                submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            } else {
                submitBtn.disabled = true;
                submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
            }
        }
    };

    if (nameInput) nameInput.addEventListener('input', validateForm);
    if (emailInput) emailInput.addEventListener('input', validateForm);
    if (passInput) passInput.addEventListener('input', validateForm);
    
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }
}

function validateAllFields() {
    const nameInput = document.getElementById('signup-name');
    const emailInput = document.getElementById('signup-email');
    const passInput = document.getElementById('signup-password');
    if(!nameInput || !emailInput || !passInput) return false;

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const pass = passInput.value;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const passRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;

    return (name.length > 0 && name.length <= 10) && 
           emailRegex.test(email) && 
           passRegex.test(pass);
}

// --- 修改点 B：头像上传逻辑 ---

function setupAvatarUpload() {
    const fileInput = document.getElementById('upload-avatar');
    const avatarImg = document.getElementById('profile-avatar');
    const triggerBtn = document.getElementById('btn-trigger-upload');

    if (!fileInput) return;

    const triggerUpload = (e) => { e.stopPropagation(); fileInput.click(); };
    if (avatarImg) avatarImg.onclick = triggerUpload;
    if (triggerBtn) triggerBtn.onclick = triggerUpload;

    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('avatar', file);

        // 使用 showToast 显示 "正在上传..."
        showToast('Uploading...', 'info'); 

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_BASE_URL}/api/upload-avatar`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            const data = await res.json();

            if (res.ok) {
                // 成功：只显示轻提示，不弹窗
                showToast('Success!', 'success');
                
                if (avatarImg) avatarImg.src = getFullImageUrl(data.avatarUrl);
                if (currentUser) {
                    currentUser.picture = data.avatarUrl;
                    localStorage.setItem('user', JSON.stringify(currentUser));
                    setupUserDropdown(); // 立即更新右上角
                }
            } else {
                showToast(data.message || 'Upload failed', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('Network error', 'error');
        } finally {
            fileInput.value = '';
        }
    });
}

// --- 新增：处理个人资料表单提交 ---
function setupProfileForm() {
    const saveBtn = document.querySelector('.save-btn');
    // 防止重复绑定，先克隆
    if(saveBtn) {
        const newBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newBtn, saveBtn);
        
        newBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            
            const name = document.getElementById('profile-name').value;
            const job = document.getElementById('profile-job').value; // 确保HTML有 id="profile-job"
            const bio = document.getElementById('profile-bio').value; // 确保HTML有 id="profile-bio"

            const originalText = newBtn.innerText;
            newBtn.innerText = 'Saving...';
            newBtn.disabled = true;

            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`${API_BASE_URL}/api/update-profile`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}` 
                    },
                    body: JSON.stringify({ name, job, bio })
                });

                if (res.ok) {
                    showToast('Profile saved successfully!', 'success');
                    // 更新本地缓存
                    if(currentUser) {
                        currentUser.name = name;
                        currentUser.job = job;
                        currentUser.bio = bio;
                        localStorage.setItem('user', JSON.stringify(currentUser));
                        setupUserDropdown(); // 更新右上角名字
                    }
                } else {
                    showToast('Failed to save', 'error');
                }
            } catch (err) {
                console.error(err);
                showToast('Network error', 'error');
            } finally {
                newBtn.innerText = originalText;
                newBtn.disabled = false;
            }
        });
    }
}

// --- 模块 D: 模板加载 ---
async function setupTemplates() {
    const templateSelect = document.getElementById('template');
    if (!templateSelect) return;
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/templates`, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        if (!response.ok) return;
        allTemplates = await response.json();
        if (allTemplates.length === 0) return;

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
        setupDynamicInputs(templateSelect);
    } catch (error) { console.error('Template Load Error:', error); }
}

function setupDynamicInputs(templateSelect) {
    let dynamicContainer = document.getElementById('dynamic-inputs-container');
    if (!dynamicContainer) {
        dynamicContainer = document.createElement('div');
        dynamicContainer.id = 'dynamic-inputs-container';
        dynamicContainer.className = 'settings-grid';
        dynamicContainer.style.marginBottom = '20px';
        if (templateSelect.closest('.form-group')) templateSelect.closest('.form-group').after(dynamicContainer);
    }
    templateSelect.addEventListener('change', () => {
        const template = allTemplates.find(t => t._id === templateSelect.value);
        const promptTextarea = document.getElementById('key-points');
        dynamicContainer.innerHTML = '';
        if (promptTextarea) promptTextarea.value = '';
        if (!template) return;

        if (template.variables && template.variables.length > 0) {
            if (promptTextarea) promptTextarea.placeholder = "Additional notes...";
            template.variables.forEach(variable => {
                const wrapper = document.createElement('div');
                wrapper.className = 'input-wrapper mb-4';
                const label = document.createElement('label');
                label.className = 'block font-semibold mb-1 text-sm text-gray-700';
                label.textContent = variable.label || variable.id;
                let input;
                if (variable.type === 'textarea') {
                    input = document.createElement('textarea');
                    input.rows = 3;
                } else {
                    input = document.createElement('input');
                    input.type = 'text';
                }
                input.className = 'dynamic-input w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none';
                input.dataset.key = variable.id;
                input.placeholder = variable.placeholder || '';
                wrapper.appendChild(label);
                wrapper.appendChild(input);
                dynamicContainer.appendChild(wrapper);
            });
        } else {
            if (promptTextarea) promptTextarea.placeholder = "Enter key points here...";
        }
    });
}

// ========================================================
// 🟢 核心修复模块：生成器、渲染引擎、导出引擎
// ========================================================

// 1. 生成器逻辑 (含自动样式应用)
function setupGenerator() {
    const generateBtn = document.getElementById('generate-btn');
    if (!generateBtn) return;

    // 克隆按钮防止重复绑定
    const newGenerateBtn = generateBtn.cloneNode(true);
    generateBtn.parentNode.replaceChild(newGenerateBtn, generateBtn);

    newGenerateBtn.addEventListener('click', async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            showToast('Please log in first.', 'error');
            window.openModal('login');
            return;
        }

        const promptEl = document.getElementById('key-points') || document.getElementById('prompt');
        const templateSelect = document.getElementById('template');
        const roleSelect = document.getElementById('role');
        const toneSelect = document.getElementById('tone');
        const resultBox = document.getElementById('generated-report');

        if (!promptEl || !promptEl.value.trim()) {
            showToast('Please enter report details.', 'warning');
            return;
        }

        // UI 进入加载状态
        const originalText = newGenerateBtn.innerHTML;
        newGenerateBtn.disabled = true;
        newGenerateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
        
        // 预先清空并显示加载动画
        resultBox.innerHTML = `
            <div class="flex flex-col items-center justify-center h-64 text-gray-400">
                <i class="fas fa-magic fa-spin fa-2x mb-4 text-blue-500"></i>
                <p>Analyzing structure...</p>
            </div>
        `;

        try {
            const res = await fetch(`${API_BASE_URL}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    userPrompt: promptEl.value.trim(),
                    role: roleSelect ? roleSelect.value : "General",
                    tone: toneSelect ? toneSelect.value : "Professional",
                    templateId: templateSelect ? templateSelect.value : "general",
                    language: document.getElementById('language')?.value || "English"
                }),
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Generation failed');

            // 🟢 [核心优化]：渲染 Markdown + 应用专业皮肤
            if (typeof marked !== 'undefined') {
                const htmlContent = marked.parse(data.generatedText);
                resultBox.innerHTML = htmlContent;
                
                // 根据角色/模板应用 CSS 皮肤
                resultBox.className = "w-full p-8 border border-gray-300 rounded-lg bg-white shadow-sm overflow-y-auto prose max-w-none text-gray-800"; // 重置基础类
                
                const role = roleSelect ? roleSelect.value : "";
                const template = templateSelect ? templateSelect.value : "";

                if (role === 'Management' || toneSelect.value === 'Professional') {
                    resultBox.classList.add('theme-corporate'); // 商务风
                } else if (role === 'Marketing' || toneSelect.value === 'Persuasive') {
                    resultBox.classList.add('theme-creative'); // 创意风
                } else {
                    resultBox.classList.add('theme-modern'); // 默认现代风
                }

            } else {
                resultBox.innerText = data.generatedText; // 降级处理
            }

            showToast("Report Generated Successfully!", "success");

        } catch (err) {
            console.error(err);
            resultBox.innerHTML = `<p class="text-red-500 text-center mt-10">Error: ${err.message}</p>`;
            showToast(err.message, 'error');
        } finally {
            newGenerateBtn.disabled = false;
            newGenerateBtn.innerHTML = originalText;
        }
    });
}

// 2. 导出功能初始化 (解决了 setupExport is not defined)
function setupExport() {
    // 绑定 Word 按钮
    const wordBtn = document.querySelector('button[data-format="Word"]');
    if(wordBtn) {
        // 克隆去除旧事件
        const newBtn = wordBtn.cloneNode(true);
        wordBtn.parentNode.replaceChild(newBtn, wordBtn);
        newBtn.addEventListener('click', () => doExport('word'));
    }

    // 绑定 PDF 按钮
    const pdfBtn = document.querySelector('button[data-format="PDF"]');
    if(pdfBtn) {
        const newBtn = pdfBtn.cloneNode(true);
        pdfBtn.parentNode.replaceChild(newBtn, pdfBtn);
        newBtn.addEventListener('click', () => doExport('pdf'));
    }

    // 绑定 Markdown 按钮
    const mdBtn = document.querySelector('button[data-format="Markdown"]');
    if(mdBtn) {
        const newBtn = mdBtn.cloneNode(true);
        mdBtn.parentNode.replaceChild(newBtn, mdBtn);
        newBtn.addEventListener('click', () => doExport('markdown'));
    }
}

// 🟢 [升级版] 复制按钮 (支持复制 格式/Rich Text)
function setupCopyBtn() {
    const copyBtn = document.getElementById('copy-btn');
    const resultBox = document.getElementById('generated-report');

    if (copyBtn && resultBox) {
        // 克隆按钮防止重复绑定
        const newCopyBtn = copyBtn.cloneNode(true);
        copyBtn.parentNode.replaceChild(newCopyBtn, copyBtn);

        newCopyBtn.addEventListener('click', async () => {
            // 防空检查
            if (!resultBox.innerText || resultBox.innerText.includes('AI 生成的精美报告')) {
                showToast('没有什么可复制的', 'warning');
                return;
            }

            try {
                // 💎 核心升级：同时写入 纯文本 和 HTML
                // 这样粘贴到记事本是文本，粘贴到 Word/微信 就是带格式的
                const textPlain = new Blob([resultBox.innerText], { type: 'text/plain' });
                const textHtml = new Blob([resultBox.innerHTML], { type: 'text/html' });
                
                const clipboardItem = new ClipboardItem({
                    'text/plain': textPlain,
                    'text/html': textHtml
                });

                await navigator.clipboard.write([clipboardItem]);
                
                // 按钮反馈动画
                const originalText = newCopyBtn.innerHTML;
                newCopyBtn.innerHTML = '<i class="fas fa-check"></i> 已复制格式';
                newCopyBtn.classList.add('bg-green-600', 'text-white');
                
                setTimeout(() => {
                    newCopyBtn.innerHTML = originalText;
                    newCopyBtn.classList.remove('bg-green-600', 'text-white');
                }, 2000);
                
                showToast('内容(含格式)已复制!', 'success');

            } catch (err) {
                console.error('高级复制失败，尝试普通复制:', err);
                // 降级处理：如果浏览器不支持高级复制，只复制文本
                navigator.clipboard.writeText(resultBox.innerText);
                showToast('已复制纯文本', 'success');
            }
        });
    }
}

// 🟢 [修复版] 统一导出处理函数
function doExport(type) {
    const reportBox = document.getElementById('generated-report');
    
    // 检查是否为空
    if (!reportBox || reportBox.innerText.length < 5 || reportBox.innerText.includes('AI 生成的精美报告')) {
        showToast('Please generate a report first.', 'warning');
        return;
    }

    const filename = `Report_${new Date().toISOString().slice(0,10)}`;

    if (type === 'word') {
        exportToWord(reportBox.innerHTML, filename);
    } 
    else if (type === 'pdf') {
        // ❌ 错误写法: exportToPDF(reportBox, filename); 
        // ✅ 正确写法: 传入 innerHTML (字符串)
        exportToPDF(reportBox.innerHTML, filename); 
    } 
    else if (type === 'markdown') {
        const text = reportBox.innerText; 
        const blob = new Blob([text], {type: 'text/markdown;charset=utf-8'});
        saveAs(blob, `${filename}.md`);
        showToast("Markdown Downloaded", "success");
    }
}

// 4. [修复版] Word 导出 (解决了 exportToWord is not defined)
function exportToWord(htmlContent, filename) {
    showToast("Preparing Word document...", "info");
    
    // 包装完整的 HTML 结构，确保 Word 能识别格式
    const header = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' 
              xmlns:w='urn:schemas-microsoft-com:office:word' 
              xmlns='http://www.w3.org/TR/REC-html40'>
        <head><meta charset='utf-8'><title>${filename}</title>
        <style>
            body { font-family: 'Calibri', sans-serif; font-size: 11pt; line-height: 1.5; }
            h1 { font-size: 18pt; color: #2e74b5; border-bottom: 1px solid #2e74b5; padding-bottom: 10px; margin-bottom: 20px; }
            h2 { font-size: 14pt; color: #1f4d78; margin-top: 20px; }
            p { margin-bottom: 10px; text-align: justify; }
            ul { margin-bottom: 10px; }
            blockquote { border-left: 4px solid #ccc; padding-left: 10px; color: #666; font-style: italic; }
        </style>
        </head><body>
    `;
    const footer = "</body></html>";
    const sourceHTML = header + htmlContent + footer;

    const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
    
    const fileDownload = document.createElement("a");
    document.body.appendChild(fileDownload);
    fileDownload.href = source;
    fileDownload.download = `${filename}.doc`;
    fileDownload.click();
    document.body.removeChild(fileDownload);
    
    showToast("Word Downloaded!", "success");
}
// 🟢 [终极融合版] PDF 导出：双核引擎 + 专业公文排版 (SimSun/SimHei)
function exportToPDF(content, filename) {
    if (typeof html2pdf === 'undefined') {
        showToast('PDF 引擎未加载，请刷新页面', 'error');
        return;
    }

    // 1. 准备内容
    let htmlContent = content;
    if (typeof marked !== 'undefined' && !content.trim().startsWith('<')) {
        htmlContent = marked.parse(content);
    }

    // ============================================================
    // 🎨 定义专业样式表 (这是核心！让预览和打印都用这套漂亮皮肤)
    // ============================================================
    const professionalStyle = `
        <style>
            /* --- 1. 字体系统 (公文标准) --- */
            /* 标题：黑体 / 微软雅黑 (Windows) / STHeiti (Mac) */
            h1, h2, h3, h4, strong, b {
                font-family: "SimHei", "Microsoft YaHei", "STHeiti", sans-serif !important;
                color: #000; /* 纯黑标题，严肃专业 */
            }
            
            /* 正文：宋体 (Windows) / 仿宋 / STSong (Mac) */
            /* 这种字体打印出来最有质感，像书本一样 */
            body, p, li, div, blockquote, span {
                font-family: "SimSun", "FangSong", "STSong", "Songti SC", serif !important;
                font-size: 12pt; /* 标准字号 */
                line-height: 1.6; /* 舒适行距 */
                text-align: justify; /* 两端对齐，整齐划一 */
                letter-spacing: 0.5px;
            }

            /* --- 2. 版式细节 --- */
            /* 大标题：居中，下划线 */
            h1 { 
                font-size: 24pt; 
                font-weight: 800;
                text-align: center; 
                border-bottom: 3px solid #000; 
                padding-bottom: 15px; 
                margin-bottom: 30px; 
                margin-top: 10px;
            }
            
            /* 二级标题：左侧粗线条装饰，浅灰背景条 */
            h2 { 
                font-size: 16pt; 
                font-weight: 700;
                border-left: 8px solid #2563EB; /* 蓝色引导线 */
                padding-left: 12px; 
                margin-top: 30px; 
                margin-bottom: 15px; 
                background: #f8f9fa; /* 极淡的灰色背景条，增加层次感 */
                padding-top: 8px;
                padding-bottom: 8px;
                border-radius: 0 4px 4px 0;
            }
            
            /* 三级标题：加粗 */
            h3 { 
                font-size: 14pt; 
                font-weight: 600;
                margin-top: 20px; 
                margin-bottom: 10px; 
                padding-left: 5px;
            }

            /* 段落与列表 */
            p { margin-bottom: 12px; }
            ul, ol { padding-left: 2em; margin-bottom: 12px; }
            li { margin-bottom: 6px; }

            /* 引用块：公文备注风格 */
            blockquote {
                border: 1px solid #eee;
                border-left: 4px solid #999;
                background-color: #fcfcfc;
                padding: 15px 20px;
                margin: 20px 0;
                font-family: "KaiTi", "楷体", serif !important; /* 引用内容用楷体，区分度高 */
                color: #555;
                font-style: italic;
            }

            /* 代码块：简约风 */
            code { 
                background: #f3f4f6; 
                padding: 2px 6px; 
                border-radius: 4px; 
                font-family: Consolas, monospace !important; 
                font-size: 0.9em; 
                color: #c7254e;
            }

            /* --- 3. 智能分页控制 (防止文字腰斩) --- */
            p, blockquote, li { page-break-inside: avoid; }
            h1, h2, h3 { page-break-after: avoid; }
            img, table { page-break-inside: avoid; }
        </style>
    `;

    // 组装最终的 HTML 内容 (加上封面头和 CSS)
    const finalHTML = `
        ${professionalStyle}
        <div class="markdown-body">
            <div style="text-align: center; margin-bottom: 50px;">
                <h1 style="border:none; margin-bottom: 5px;">${filename.replace(/_/g, ' ')}</h1>
                <p style="font-size: 10pt; color: #666; font-family: sans-serif;">
                    Generated by Reportify AI • ${new Date().toLocaleDateString()}
                </p>
                <hr style="border: 0; border-top: 1px solid #000; margin-top: 20px;">
            </div>
            ${htmlContent}
        </div>
    `;

    // ============================================================
    // 🎨 第一步：创建“视觉预览层” (给用户看，带滚动条)
    // ============================================================
    const previewOverlay = document.createElement('div');
    Object.assign(previewOverlay.style, {
        position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
        backgroundColor: 'rgba(50, 50, 50, 0.98)', // 深色背景
        zIndex: '9999999', 
        overflowY: 'auto', // 允许用户滚动查看
        display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '20px'
    });

    // 顶部提示栏
    previewOverlay.innerHTML = `
        <div style="color:white; font-family:sans-serif; margin-bottom:15px; text-align:center; flex-shrink: 0;">
            <i class="fas fa-print fa-spin" style="font-size:24px; margin-bottom:10px;"></i><br>
            <span style="font-weight:bold; font-size:16px;">正在生成专业排版...</span><br>
            <span style="font-size:12px; opacity:0.8;">(所见即所得，自动处理长文分页)</span>
        </div>
        <div id="preview-paper" style="width:794px; min-height:1123px; background:white; padding:50px; color:#000; box-shadow:0 0 20px rgba(0,0,0,0.5); margin-bottom:50px;">
            </div>
    `;
    document.body.appendChild(previewOverlay);

    // ============================================================
    // 🖨️ 第二步：创建“打印专用层” (给程序看，无限制，绝对完整)
    // ============================================================
    const printContainer = document.createElement('div');
    Object.assign(printContainer.style, {
        position: 'absolute', 
        top: '0', 
        left: '0', 
        width: '794px', // 锁定A4宽度
        zIndex: '-9999', // 藏在最底下
        backgroundColor: 'white',
        padding: '50px', // 内边距 (和预览层保持一致)
        margin: '0'
    });

    // 填充内容
    // 1. 填充预览层
    previewOverlay.querySelector('#preview-paper').innerHTML = finalHTML;
    // 2. 填充打印层
    printContainer.innerHTML = finalHTML;
    document.body.appendChild(printContainer);

    // ============================================================
    // 🚀 第三步：启动打印引擎
    // ============================================================
    setTimeout(() => {
        // 强制计算打印容器的真实高度
        const totalHeight = printContainer.scrollHeight;

        const opt = {
            margin:       [15, 15, 15, 15], // 上右下左 (mm)
            filename:     `${filename}.pdf`,
            image:        { type: 'jpeg', quality: 1 }, // 最高画质
            html2canvas:  { 
                scale: 2, // 2倍清晰度
                useCORS: true, 
                logging: false,
                scrollY: 0,
                width: 794,
                windowWidth: 794, 
                height: totalHeight, // 🔴 核心：强制全高度截取
                windowHeight: totalHeight
            },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak:    { mode: ['css', 'legacy'] }
        };

        html2pdf().set(opt).from(printContainer).save()
            .then(() => {
                document.body.removeChild(previewOverlay);
                document.body.removeChild(printContainer);
                showToast("PDF 下载成功!", "success");
            })
            .catch(err => {
                console.error("PDF Error:", err);
                document.body.removeChild(previewOverlay);
                document.body.removeChild(printContainer);
                showToast("PDF 生成出错", "error");
            });
    }, 1500); // 1.5秒缓冲
}


// --- 模块 G: 支付与卡片交互逻辑 (全能修复版) ---
function setupPayment() {
    const cards = document.querySelectorAll('.pricing-card');
    const paymentModal = document.getElementById('payment-modal-overlay');
    const closePaymentBtn = document.getElementById('close-payment-btn');
    const paypalContainer = document.getElementById('paypal-button-container');

    // 1. 样式定义 (用于切换蓝色框)
    const activeCardClasses = ['border-blue-600', 'ring-2', 'ring-blue-500', 'shadow-xl', 'scale-105', 'z-10'];
    const inactiveCardClasses = ['border-gray-200', 'shadow-sm'];
    const activeBtnClasses = ['bg-blue-600', 'text-white', 'border-transparent', 'hover:bg-blue-700'];
    const inactiveBtnClasses = ['bg-white', 'text-blue-600', 'border-gray-200', 'hover:bg-gray-50'];

    // 2. 激活卡片视觉效果的函数
    const activateCard = (targetCard) => {
        // 重置所有卡片
        cards.forEach(c => {
            c.classList.remove(...activeCardClasses);
            c.classList.add(...inactiveCardClasses);
            c.classList.remove('transform'); // 移除放大效果基础类，防止冲突

            // 重置按钮
            const btn = c.querySelector('.choose-plan-btn');
            if (btn) {
                btn.classList.remove(...activeBtnClasses);
                btn.classList.add(...inactiveBtnClasses);
            }
        });

        // 激活当前卡片
        targetCard.classList.remove(...inactiveCardClasses);
        targetCard.classList.add(...activeCardClasses);
        targetCard.classList.add('transform'); // 加回放大

        // 激活当前按钮
        const targetBtn = targetCard.querySelector('.choose-plan-btn');
        if (targetBtn) {
            targetBtn.classList.remove(...inactiveBtnClasses);
            targetBtn.classList.add(...activeBtnClasses);
        }
    };

    // 3. 绑定卡片点击事件 (视觉切换)
    cards.forEach(card => {
        card.addEventListener('click', (e) => {
            // 只要点的不是按钮本身(按钮有自己的逻辑)，就切换视觉
            // 但为了体验，点按钮同时也切换视觉，所以直接调用
            activateCard(card);
        });
    });

    // 4. 绑定按钮点击事件 (核心业务逻辑)
    const payButtons = document.querySelectorAll('.choose-plan-btn');
    payButtons.forEach(btn => {
        // 克隆节点防止重复绑定
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);

        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation(); // 防止触发卡片点击(虽然上面处理了，保险起见)
            
            // 确保视觉同步
            const card = newBtn.closest('.pricing-card');
            if(card) activateCard(card);

            const planType = newBtn.dataset.plan; // 获取 plan: free, basic, pro
            const token = localStorage.getItem('token');

            // --- 逻辑 A: 免费版 ---
            if (planType === 'free') {
                if (token) {
                    // 已登录：跳转到生成器或使用页
                    window.location.href = 'usage.html'; 
                } else {
                    // 未登录：弹窗注册
                    window.openModal('signup');
                }
                return;
            }

            // --- 逻辑 B: 付费版 (Basic / Pro) ---
            if (!token) {
                // 未登录：先登录
                showToast('Please login to upgrade.', 'info');
                window.openModal('login');
                return;
            }

            // 已登录：直接弹出支付窗口 (这是你想要的逻辑)
            const amount = planType === 'basic' ? '9.90' : '19.90';
            
            if (paymentModal) paymentModal.style.display = 'flex';
            if (window.paypal && paypalContainer) {
                paypalContainer.innerHTML = ''; // 清空旧按钮
                window.paypal.Buttons({
                    createOrder: (data, actions) => actions.order.create({ purchase_units: [{ amount: { value: amount } }] }),
                    onApprove: (data, actions) => actions.order.capture().then(async () => {
                        paymentModal.style.display = 'none';
                        // 调用后端升级接口
                        try {
                            await fetch(`${API_BASE_URL}/api/upgrade-plan`, {
                                method: 'POST', 
                                headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`},
                                body: JSON.stringify({ plan: planType })
                            });
                            showToast('Upgraded Successfully!', 'success');
                            setTimeout(() => window.location.reload(), 1500);
                        } catch(err) {
                            showToast('Upgrade failed, contact support.', 'error');
                        }
                    })
                }).render('#paypal-button-container');
            }
        });
    });

    // 绑定关闭支付弹窗
    if (closePaymentBtn && paymentModal) {
        closePaymentBtn.addEventListener('click', () => paymentModal.style.display = 'none');
        paymentModal.addEventListener('click', (e) => { if (e.target === paymentModal) paymentModal.style.display = 'none'; });
    }
}

// --- 模块 H: 联系表单 ---
function setupContactForm() {
    const contactForm = document.getElementById('contact-form');
    if (currentUser) {
        const emailInput = document.getElementById('email');
        const nameInput = document.getElementById('name');
        if (emailInput) emailInput.value = currentUser.email || '';
        if (nameInput) nameInput.value = currentUser.name || '';
    }
    if (contactForm) {
        const newForm = contactForm.cloneNode(true);
        contactForm.parentNode.replaceChild(newForm, contactForm);
        newForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = newForm.querySelector('button');
            const original = btn.textContent;
            btn.disabled = true; btn.textContent = 'Sending...';
            try {
                const data = {
                    name: document.getElementById('name').value,
                    email: document.getElementById('email').value,
                    message: document.getElementById('message').value,
                    type: document.getElementById('contact-type')?.value || 'General'
                };
                const res = await fetch(`${API_BASE_URL}/api/contact`, {
                    method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)
                });
                if (res.ok) { showToast("Sent!", "success"); newForm.reset(); }
            } catch(e) { showToast("Error", "error"); }
            finally { btn.disabled = false; btn.textContent = original; }
        });
    }
}

// --- 模块 I: 历史记录加载器 (增强版：带下载功能) ---
function setupHistoryLoader() {
    // 1. 只有在历史页才执行
    if (!window.location.pathname.includes('history')) return;

    // 定义一个全局变量存数据，方便下载时提取内容
    window.currentHistoryData = [];

    // 2. 加载数据的主函数
    window.loadHistoryData = async function() {
        const container = document.getElementById('history-container');
        if (!container) return;

        container.innerHTML = `
            <div style="text-align: center; padding: 50px; color: #888;">
                <i class="fas fa-spinner fa-spin fa-2x"></i>
                <p style="margin-top: 10px;">Loading...</p>
            </div>`;

        try {
            const token = localStorage.getItem('token');
            if (!token) {
                container.innerHTML = `<div style="text-align:center; padding:40px;">Please login.</div>`;
                return;
            }

            const res = await fetch(`${API_BASE_URL}/api/history`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) throw new Error("Failed to fetch history");

            const reports = await res.json();
            window.currentHistoryData = reports; // 保存数据供下载用

            if (reports.length === 0) {
                container.innerHTML = `<div style="text-align:center; padding:40px; color:#666;">No reports found.</div>`;
                return;
            }

            // 3. 渲染列表 (这里把下载按钮加回来！)
            container.innerHTML = reports.map(item => {
                const date = new Date(item.createdAt).toLocaleDateString();
                const preview = (item.content || "").substring(0, 120) + "...";
                
                return `
                <div style="background: white; border: 1px solid #eee; border-radius: 12px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); transition: transform 0.2s;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 10px; align-items: center;">
                        <span style="font-weight: bold; color: #333; font-size: 1.1em;">${item.title || 'Report'}</span>
                        <span style="font-size: 0.8em; color: #999;">${date}</span>
                    </div>
                    <div style="font-size: 0.9em; color: #666; line-height: 1.6; margin-bottom: 15px; height: 4.8em; overflow: hidden;">
                        ${preview}
                    </div>
                    
                    <div style="display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid #f0f0f0; padding-top: 10px;">
                        <button onclick="downloadHistoryItem('${item._id}', 'md')" title="Markdown" style="color: #444; background: #f3f4f6; border: none; width: 32px; height: 32px; border-radius: 50%; cursor: pointer;">
                            <i class="fab fa-markdown"></i>
                        </button>
                        <button onclick="downloadHistoryItem('${item._id}', 'word')" title="Word" style="color: #2b579a; background: #e8f0fe; border: none; width: 32px; height: 32px; border-radius: 50%; cursor: pointer;">
                            <i class="fas fa-file-word"></i>
                        </button>
                        <button onclick="downloadHistoryItem('${item._id}', 'pdf')" title="PDF" style="color: #b30b00; background: #fee2e2; border: none; width: 32px; height: 32px; border-radius: 50%; cursor: pointer;">
                            <i class="fas fa-file-pdf"></i>
                        </button>
                        
                        <div style="width: 1px; background: #ddd; margin: 0 5px;"></div>

                        <button onclick="viewReport('${item._id}')" style="color: #2563eb; background: none; border: none; cursor: pointer; font-weight: 500;">
                            View
                        </button>
                        <button onclick="deleteReport('${item._id}')" style="color: #ef4444; background: none; border: none; cursor: pointer;">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </div>
                `;
            }).join('');

        } catch (err) {
            console.error(err);
            container.innerHTML = `<div style="text-align:center;">Load failed.</div>`;
        }
    };

    // 3. 实现下载功能的具体逻辑
    window.downloadHistoryItem = function(id, type) {
        // 从缓存中找到这条报告
        const item = window.currentHistoryData.find(r => r._id === id);
        if (!item || !item.content) {
            showToast("Content not found", "error");
            return;
        }

        const filename = (item.title || "Report").replace(/[^a-z0-9]/gi, '_') + `_${new Date().toISOString().slice(0,10)}`;

        if (type === 'md') {
            const blob = new Blob([item.content], { type: 'text/markdown;charset=utf-8' });
            saveAs(blob, `${filename}.md`);
            showToast("Markdown downloaded", "success");
        } 
        else if (type === 'word') {
            if (typeof docx === 'undefined') { showToast("Word engine loading...", "info"); return; }
            // 复用简单的 Word 导出逻辑
            const doc = new docx.Document({
                sections: [{ children: item.content.split('\n').map(line => new docx.Paragraph({ text: line })) }]
            });
            docx.Packer.toBlob(doc).then(blob => saveAs(blob, `${filename}.docx`));
            showToast("Word downloaded", "success");
        } 
        else if (type === 'pdf') {
            if (typeof html2pdf === 'undefined') { showToast("PDF engine loading...", "info"); return; }
            // 临时创建一个隐藏的 div 用来生成 PDF
            const element = document.createElement('div');
            // 如果有 marked 库就转 HTML，没有就直接放文本
            element.innerHTML = (typeof marked !== 'undefined') ? marked.parse(item.content) : item.content.replace(/\n/g, '<br>');
            element.style.padding = '20px';
            
            html2pdf().from(element).save(`${filename}.pdf`);
            showToast("PDF downloaded", "success");
        }
    };

    // 启动加载
    loadHistoryData();
}

// 补充 View 和 Delete (保持你原来的，不用变，这里为了完整性列出)
window.deleteReport = async function(id) {
    if(!confirm("Delete this report?")) return;
    try {
        const token = localStorage.getItem('token');
        await fetch(`${API_BASE_URL}/api/history/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
        loadHistoryData();
        showToast("Deleted", "success");
    } catch(e) { showToast("Error", "error"); }
};

// --- 🟢 [重写] 漂亮的查看报告逻辑 ---
window.viewReport = function(id) {
    // 1. 找到数据
    const item = window.currentHistoryData.find(r => r._id === id);
    if (!item) return;

    // 2. 获取弹窗元素
    const modal = document.getElementById('report-view-modal');
    const titleEl = document.getElementById('modal-title');
    const bodyEl = document.getElementById('modal-body');
    const copyBtn = document.getElementById('modal-copy-btn');

    if (!modal) return;

    // 3. 填充内容
    titleEl.innerText = item.title || 'Generated Report';
    
    // 关键：使用 marked 库把 Markdown 变成漂亮的 HTML
    // 如果没有 marked 库，就退化成普通文本
    if (typeof marked !== 'undefined') {
        bodyEl.innerHTML = marked.parse(item.content);
    } else {
        bodyEl.innerHTML = item.content.replace(/\n/g, '<br>');
    }

    // 4. 绑定复制按钮功能
    copyBtn.onclick = function() {
        navigator.clipboard.writeText(item.content).then(() => {
            const originalText = copyBtn.innerText;
            copyBtn.innerText = 'Copied!';
            setTimeout(() => copyBtn.innerText = originalText, 2000);
        });
    };

    // 5. 显示弹窗 (使用 Flex 布局以保证居中)
    modal.style.display = 'flex';
    // 禁止背景滚动
    document.body.style.overflow = 'hidden';
};

// 关闭弹窗的函数
window.closeViewModal = function() {
    const modal = document.getElementById('report-view-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = ''; // 恢复滚动
    }
};

// 点击遮罩层也能关闭
window.onclick = function(event) {
    const modal = document.getElementById('report-view-modal');
    if (event.target == modal) {
        closeViewModal();
    }
    // (保留原本的用户菜单关闭逻辑)
    if(!event.target.closest('#auth-container')) { 
        const m = document.getElementById('user-dropdown'); 
        if(m) m.classList.add('hidden'); 
    }
};

function setupMessageCenter() {
    const bellBtn = document.querySelector('button[title="My Messages"]');
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
    if(modal) { modal.classList.add('hidden'); document.body.style.overflow = ''; }
};

window.checkNotifications = async function() {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
        const res = await fetch(`${API_BASE_URL}/api/my-messages`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) return;
        const msgs = await res.json();
        const currentRepliedCount = msgs.filter(m => m.status === 'replied').length;
        const lastSeenCount = parseInt(localStorage.getItem('seen_reply_count') || '0');
        if (currentRepliedCount > lastSeenCount) {
            const badge = document.getElementById('notif-badge');
            if(badge) badge.classList.remove('hidden');
        }
    } catch (e) {}
};

async function loadMessages(markAsRead = false) {
    const container = document.getElementById('msg-list-container');
    const token = localStorage.getItem('token');
    
    container.innerHTML = '<div class="text-center text-gray-400 mt-10">Loading...</div>';

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
            container.innerHTML = '<div class="text-center text-gray-400 mt-10">No messages found.</div>';
            return;
        }

        msgs.forEach(msg => {
            const dateStr = new Date(msg.submittedAt).toLocaleDateString();
            let replyHtml = msg.reply 
                ? `<div class="bg-blue-50 p-3 mt-3 rounded text-sm text-gray-800 border-l-4 border-blue-500">
                      <strong>Admin:</strong> ${msg.reply}
                   </div>` 
                : `<div class="text-xs text-gray-400 mt-2 italic">Pending reply...</div>`;
                
            if(msg.conversation && msg.conversation.length > 0) {
                 const adminMsgs = msg.conversation.filter(c => c.role === 'admin');
                 if(adminMsgs.length > 0) {
                    replyHtml = adminMsgs.map(c => 
                        `<div class="bg-blue-50 p-3 mt-3 rounded text-sm text-gray-800 border-l-4 border-blue-500">
                             <strong>Admin:</strong> ${c.message}
                         </div>`).join('');
                 }
            }

            container.innerHTML += `
                <div class="bg-white p-5 rounded-lg shadow-sm border border-gray-200 mb-4">
                    <div class="flex justify-between mb-2">
                        <span class="font-bold text-gray-700">${msg.type}</span>
                        <span class="text-xs text-gray-400">${dateStr}</span>
                    </div>
                    <p class="text-gray-600 text-sm">${msg.message}</p>
                    ${replyHtml}
                </div>
            `;
        });
    } catch (err) {
        container.innerHTML = '<p class="text-center text-red-400">Load failed.</p>';
    }
}

// --- 模块 K: 用户菜单 (修复版：已加入管理员入口) ---
function setupUserDropdown() {
    const headerRight = document.getElementById('auth-container');
    if (!headerRight) return;
    
    // 1. 如果没有登录
    if (!currentUser) {
        headerRight.innerHTML = `
            <div style="display: flex; gap: 10px; align-items: center;">
                <button onclick="openModal('login')" style="background:none; border:none; cursor:pointer; font-weight:500; color:#555;">Login</button>
                <button onclick="openModal('signup')" style="background:#2563eb; color:white; border:none; padding:8px 20px; border-radius:20px; cursor:pointer; font-weight:bold;">Get Started</button>
            </div>
        `;
    } else {
        // 2. 获取显示名称
        const displayName = currentUser.name || currentUser.displayName || currentUser.email.split('@')[0] || 'User';
        
        // 3. 获取头像链接
        const picUrl = currentUser.picture ? getFullImageUrl(currentUser.picture) : null;
        const initial = displayName.charAt(0).toUpperCase();

        // 4. 生成头像 HTML
        const avatarHtml = picUrl
            ? `<img src="${picUrl}" alt="Avatar" 
                   style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 2px solid #fff; box-shadow: 0 2px 5px rgba(0,0,0,0.1); cursor: pointer;" 
                   onclick="toggleUserMenu()">`
            : `<div onclick="toggleUserMenu()" 
                   style="width: 40px; height: 40px; border-radius: 50%; background-color: #2563eb; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; cursor: pointer; border: 2px solid #fff; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                   ${initial}
               </div>`;

        // 🟢 [关键新增] 如果是管理员，生成这个红色的按钮HTML
        const adminLinkHtml = (currentUser.role === 'admin') ? `
            <a href="admin.html" style="display: block; padding: 10px 16px; color: #dc2626; text-decoration: none; font-size: 14px; font-weight: bold; transition: background 0.2s; border-top: 1px solid #f3f4f6;" onmouseover="this.style.background='#fef2f2'" onmouseout="this.style.background='white'">
                <i class="fas fa-shield-alt" style="margin-right: 8px;"></i> Admin Dashboard
            </a>
        ` : '';

        // 6. 渲染菜单
        headerRight.innerHTML = `
            <div style="position: relative; display: flex; align-items: center; gap: 12px;">
                <span style="font-size: 14px; font-weight: 500; color: #333;">${displayName}</span>
                ${avatarHtml}
                
                <div id="user-dropdown" class="hidden" 
                     style="position: absolute; right: 0; top: 55px; width: 200px; background: white; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); border: 1px solid #eee; z-index: 9999; overflow: hidden; text-align: left;">
                     
                     <div style="padding: 12px 16px; border-bottom: 1px solid #f3f4f6; background-color: #f9fafb;">
                        <p style="font-size: 12px; color: #6b7280; margin: 0;">Signed in as</p>
                        <p style="font-size: 14px; font-weight: bold; color: #111; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${currentUser.email}</p>
                     </div>

                     <a href="account.html" style="display: block; padding: 10px 16px; color: #374151; text-decoration: none; font-size: 14px; transition: background 0.2s;" onmouseover="this.style.background='#f3f4f6'" onmouseout="this.style.background='white'">
                        <i class="fas fa-user-circle" style="margin-right: 8px; color: #3b82f6;"></i> My Account
                     </a>
                     
                     <a href="usage.html" style="display: block; padding: 10px 16px; color: #374151; text-decoration: none; font-size: 14px; transition: background 0.2s;" onmouseover="this.style.background='#f3f4f6'" onmouseout="this.style.background='white'">
                        <i class="fas fa-chart-pie" style="margin-right: 8px; color: #10b981;"></i> Usage Stats
                     </a>

                     ${adminLinkHtml}

                     <a href="#" onclick="logout()" style="display: block; padding: 10px 16px; color: #ef4444; text-decoration: none; font-size: 14px; border-top: 1px solid #f3f4f6; transition: background 0.2s;" onmouseover="this.style.background='#fef2f2'" onmouseout="this.style.background='white'">
                        <i class="fas fa-sign-out-alt" style="margin-right: 8px;"></i> Logout
                     </a>
                </div>
            </div>
        `;
    }
}

window.toggleUserMenu = function() { const m = document.getElementById('user-dropdown'); if(m) m.classList.toggle('hidden'); };
window.logout = function() { localStorage.removeItem('token'); window.location.reload(); };
window.onclick = function(e) { 
    if(!e.target.closest('#auth-container')) { 
        const m = document.getElementById('user-dropdown'); 
        if(m) m.classList.add('hidden'); 
    }
};

// --- 修改点 A：加载个人资料页数据 ---
async function loadProfilePageData() {
    // 1. 确保拿到用户信息
    if (!currentUser) await fetchUserProfile();
    if (!currentUser) return;

    // 2. 填充头像 (关键：这里使用了 getFullImageUrl 来修补链接)
    const avatarImg = document.getElementById('profile-avatar');
    if (avatarImg) {
        avatarImg.src = getFullImageUrl(currentUser.picture);
    }

    // 3. 填充名字和邮箱
    const nameInput = document.getElementById('profile-name');
    const emailInput = document.getElementById('profile-email');
    
    // 防止页面上没有这些 ID 导致报错
    if (nameInput) nameInput.value = currentUser.name || '';
    if (emailInput) emailInput.value = currentUser.email || '';
}

// --- [重写] 账户页头像加载 (强制圆框版) ---
async function loadAccountPageAvatar() {
    console.log("正在加载账户页头像...");
    const bigAvatar = document.getElementById('account-hub-avatar');
    
    // 如果页面上没这个元素（比如在首页），直接退出
    if (!bigAvatar) return;

    // 1. 确保有用户信息
    if (!currentUser) await fetchUserProfile();

    // 2. 计算图片地址
    let finalUrl;
    if (currentUser && currentUser.picture) {
        finalUrl = getFullImageUrl(currentUser.picture);
    } else {
        finalUrl = getFullImageUrl(null); // 获取默认图
    }

    // 3. [关键] 强制应用样式 (解决大方块问题)
    // 不管 HTML/CSS 怎么写，这里强制把它变成圆的
    bigAvatar.style.width = '100px';
    bigAvatar.style.height = '100px';
    bigAvatar.style.borderRadius = '50%'; // 变圆
    bigAvatar.style.objectFit = 'cover';  // 裁剪防变形
    bigAvatar.style.border = '4px solid #fff';
    bigAvatar.style.boxShadow = '0 4px 10px rgba(0,0,0,0.1)';

    // 4. 设置图片与错误处理
    bigAvatar.src = finalUrl;
    
    // 如果加载失败（被墙或404），自动切回默认图
    bigAvatar.onerror = function() {
        console.warn("头像加载失败，已切换为默认图");
        this.src = getFullImageUrl(null);
    };
}
