/*
 * ===================================================================
 * * Reportify AI - script.js (v22.0 增强验证版)
 * * 状态: 修复表单显示逻辑，增加严格密码/用户校验，修复Google跳转
 * ===================================================================
 */

// --- 1. 全局配置与状态 ---
const API_BASE_URL = 'https://api.goreportify.com';
let allTemplates = [];
let currentUser = null; 
let currentUserPlan = 'basic'; 

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

// --- 3. 弹窗与 Tab 控制 (修复表单不显示的问题) ---
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

    // 2. 切换表单内容显示 (关键修复)
    // 假设 HTML 结构是: <div id="login" class="tab-content">...</div>
    document.querySelectorAll('.tab-content').forEach(content => {
        // 先隐藏所有内容
        content.classList.add('hidden');
        content.style.display = 'none'; // 双重保险
    });

    const targetContent = document.getElementById(tabToShow);
    if (targetContent) {
        targetContent.classList.remove('hidden');
        targetContent.style.display = 'block'; // 强制显示
    }
};

window.closeModal = function() {
    const overlay = document.getElementById('auth-modal-overlay');
    if (overlay) overlay.classList.add('hidden');
};

// --- 4. 初始化流程 ---
document.addEventListener('DOMContentLoaded', async () => {
    handleGoogleCallback();
    await fetchUserProfile();
    
    setupAuthUI();          // 登录/注册/Google逻辑
    setupGenerator();       
    setupTemplates();       
    setupExport();          
    setupPayment();         
    setupContactForm();     
    setupHistoryLoader();   
    setupMessageCenter();   
    setupUserDropdown();    
    setupAvatarUpload();
    console.log("Reportify AI v22.0 Initialized");

    // 🟢 新增：如果在 usage.html 页面，加载数据
    // --- 新增：用量页面加载逻辑 ---
if (window.location.pathname.includes('usage.html')) {
    loadRealUsageData();
}

async function loadRealUsageData() {
    const usedEl = document.getElementById('usage-used');
    const totalEl = document.getElementById('usage-total');
    const planEl = document.getElementById('usage-plan');

    try {
        const token = localStorage.getItem('token');
        // 强制请求后端最新的 /api/me 数据
        const res = await fetch('/api/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            const user = await res.json();

            // 填充页面数据
            if (planEl) planEl.innerText = (user.plan || 'Free').toUpperCase();

            // 获取后端算出来的 usageCount
            const count = user.usageCount || 0;
            const limit = user.plan === 'pro' ? 'Unlimited' : 10; // 假设免费版限制10次

            if (usedEl) usedEl.innerText = count;
            if (totalEl) totalEl.innerText = limit;
        }
    } catch (e) {
        console.error("加载用量数据失败", e);
    }
}

// =================================================
//  模块详情
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

// --- 模块 C: 认证 UI (含验证与 Google 修复) ---
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

    // 4. 注册表单处理 (含严格验证)
    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        const newSignupForm = signupForm.cloneNode(true);
        signupForm.parentNode.replaceChild(newSignupForm, signupForm);
        
        // 启动验证监听
        setupStrictValidation();

        newSignupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = newSignupForm.querySelector('button[type="submit"]');
            
            // 再次进行最终校验，防止通过开发者工具启用按钮
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
    // 查找所有 Google 按钮，并重新绑定
    const googleBtns = document.querySelectorAll('button');
    googleBtns.forEach(btn => {
        // 通过内容或类名识别 Google 按钮
        if ((btn.textContent && btn.textContent.toLowerCase().includes('google')) || btn.classList.contains('google-btn')) {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            
            // 关键：防止它是 form 里的 submit 按钮
            newBtn.type = 'button'; 

            newBtn.addEventListener('click', async (e) => {
                e.preventDefault(); // 阻止任何表单提交
                e.stopPropagation();
                
                const originalText = newBtn.innerHTML;
                newBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
                
                try {
                    // 请求后端获取 Google 授权跳转链接
                    const res = await fetch(`${API_BASE_URL}/auth/google`);
                    if (!res.ok) throw new Error("Auth server unreachable");
                    
                    const data = await res.json();
                    if (data.url) {
                        window.location.href = data.url; // 这里进行真正的跳转
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

    // 错误提示容器 (如果没有就动态创建)
    const getErrorSpan = (input) => {
        let span = input.nextElementSibling;
        if (!span || !span.classList.contains('validation-msg')) {
            span = document.createElement('div');
            span.className = 'validation-msg text-xs mt-1 text-left';
            input.parentNode.insertBefore(span, input.nextSibling);
        }
        return span;
    };

    // 1. 用户名校验 (不超过 10 字符)
    const checkName = () => {
        const val = nameInput.value.trim();
        const span = getErrorSpan(nameInput);
        if (val.length === 0) {
            span.innerHTML = ''; return false;
        }
        if (val.length > 10) {
            span.innerHTML = '<span class="text-red-500">❌ 最多10个字符 (Max 10 chars)</span>';
            return false;
        }
        span.innerHTML = '<span class="text-green-600">✅ OK</span>';
        return true;
    };

    // 2. 邮箱校验 (正则)
    const checkEmail = () => {
        const val = emailInput.value.trim();
        const span = getErrorSpan(emailInput);
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (val.length === 0) {
            span.innerHTML = ''; return false;
        }
        if (!emailRegex.test(val)) {
            span.innerHTML = '<span class="text-red-500">❌ 格式错误 (Invalid Email)</span>';
            return false;
        }
        span.innerHTML = '<span class="text-green-600">✅ OK</span>';
        return true;
    };

    // 3. 密码校验 (8位 + 大小写 + 数字 + 特殊字符)
    const checkPass = () => {
        const val = passInput.value;
        const span = getErrorSpan(passInput);
        
        // 四个硬性条件
        const hasUpper = /[A-Z]/.test(val);
        const hasLower = /[a-z]/.test(val);
        const hasNumber = /[0-9]/.test(val);
        const hasSpecial = /[\W_]/.test(val); // \W 匹配非单词字符，包括特殊符号
        const isLongEnough = val.length >= 8;

        if (val.length === 0) {
            span.innerHTML = ''; return false;
        }

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

    // 统一检查并控制按钮
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
    
    // 初始化时先禁用
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }
}

// 暴露给提交事件使用
function validateAllFields() {
    const nameInput = document.getElementById('signup-name');
    const emailInput = document.getElementById('signup-email');
    const passInput = document.getElementById('signup-password');
    if(!nameInput || !emailInput || !passInput) return false;

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const pass = passInput.value;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    // 严格密码正则：至少8位，包含大小写、数字、特殊字符
    const passRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;

    return (name.length > 0 && name.length <= 10) && 
           emailRegex.test(email) && 
           passRegex.test(pass);
}

// --- 新增函数：处理头像上传 ---
function setupAvatarUpload() {
    // 获取刚才在 HTML 里加的那个 input
    const fileInput = document.getElementById('upload-avatar');
    const avatarImg = document.getElementById('profile-avatar');

    // 如果页面上没找到这两个元素，就不执行（防止报错）
    if (!fileInput || !avatarImg) return; 

    // 1. 点击头像图片时，触发文件选择框的点击
    avatarImg.onclick = () => fileInput.click();

    // 2. 当用户选好文件后
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('avatar', file);

        try {
            alert('正在上传，请稍候...');
            const token = localStorage.getItem('token');
            const res = await fetch('/api/upload-avatar', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            const data = await res.json();
            if (res.ok) {
                alert('头像修改成功！');
                avatarImg.src = data.avatarUrl; // 立即刷新显示的图片

                // 更新本地缓存
                if (currentUser) {
                    currentUser.avatar = data.avatarUrl;
                    localStorage.setItem('user', JSON.stringify(currentUser));
                }
            } else {
                alert('上传失败: ' + data.message);
            }
        } catch (err) {
            console.error(err);
            alert('网络错误');
        }
    });
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

// --- 模块 E: 生成器 ---
function setupGenerator() {
    const generateBtn = document.getElementById('generate-btn');
    if (!generateBtn) return;
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
        const resultBox = document.getElementById('generated-report') || document.getElementById('result');
        const templateSelect = document.getElementById('template');
        const roleSelect = document.getElementById('role');
        const toneSelect = document.getElementById('tone');
        const langSelect = document.getElementById('language');
        const inputs = {};
        document.querySelectorAll('.dynamic-input').forEach(el => {
            if (el.dataset.key) inputs[el.dataset.key] = el.value;
        });

        const userPromptText = promptEl ? promptEl.value.trim() : "";
        if (!userPromptText && Object.keys(inputs).length === 0) {
            alert('Please enter content.');
            if (promptEl) promptEl.focus();
            return;
        }

        const originalText = newGenerateBtn.textContent;
        newGenerateBtn.disabled = true;
        newGenerateBtn.textContent = 'Generating...';
        if (resultBox) {
            if (resultBox.tagName === 'TEXTAREA') resultBox.value = "AI is thinking...";
            else resultBox.innerText = "AI is thinking...";
        }

        try {
            const res = await fetch(`${API_BASE_URL}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    userPrompt: userPromptText,
                    role: roleSelect ? roleSelect.value : "General",
                    tone: toneSelect ? toneSelect.value : "Professional",
                    language: langSelect ? langSelect.value : "English",
                    templateId: templateSelect ? templateSelect.value : "daily_summary",
                    inputs: inputs
                }),
            });
            const data = await res.json();
            if (res.status === 403) {
                showToast(`Limit Reached: ${data.error}`, 'error');
                if (resultBox) resultBox.value = "Quota exceeded.";
            } else if (res.status === 401) {
                showToast('Session expired.', 'warning');
                localStorage.removeItem('token');
            } else if (!res.ok) {
                throw new Error(data.error || 'Server Error');
            } else {
                if (resultBox) {
                    if (resultBox.tagName === 'TEXTAREA') {
                        resultBox.value = data.generatedText;
                        resultBox.style.height = 'auto';
                        resultBox.style.height = resultBox.scrollHeight + 'px';
                    } else {
                        resultBox.innerText = data.generatedText;
                    }
                }
                showToast("Report Generated!", "success");
            }
        } catch (err) {
            showToast(`Failed: ${err.message}`, 'error');
        } finally {
            newGenerateBtn.disabled = false;
            newGenerateBtn.textContent = originalText;
        }
    });

    // 复制按钮
    const copyBtn = document.getElementById('copy-btn');
    if (copyBtn) {
        const newCopyBtn = copyBtn.cloneNode(true);
        copyBtn.parentNode.replaceChild(newCopyBtn, copyBtn);
        newCopyBtn.onclick = async (e) => {
            e.preventDefault();
            const resultBox = document.getElementById('generated-report') || document.getElementById('result');
            const textToCopy = resultBox ? (resultBox.value || resultBox.innerText) : "";
            if (!textToCopy || textToCopy.includes('AI is thinking')) return;
            try {
                await navigator.clipboard.writeText(textToCopy);
                newCopyBtn.innerHTML = '<i class="fas fa-check"></i> Copied';
                setTimeout(() => newCopyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy', 2000);
            } catch (err) { alert('Copy failed.'); }
        };
    }
}

// --- 模块 F: 导出 ---
function setupExport() {
    const exportButtons = document.querySelectorAll('.export-btn');
    const getResultContent = () => {
        const box = document.getElementById('generated-report') || document.getElementById('result');
        return box ? (box.tagName === 'TEXTAREA' ? box.value : box.innerText) : "";
    };
    exportButtons.forEach(button => {
        const newBtn = button.cloneNode(true);
        button.parentNode.replaceChild(newBtn, button);
        newBtn.addEventListener('click', () => {
            const format = newBtn.dataset.format || newBtn.textContent.trim();
            const text = getResultContent();
            if (!text || text.length < 5) { showToast('Generate report first.', 'warning'); return; }
            const filename = `Report_${new Date().toISOString().slice(0,10)}`;

            if (format === 'Markdown') {
                saveAs(new Blob([text], {type: 'text/markdown;charset=utf-8'}), `${filename}.md`);
                showToast("Markdown downloaded.", "success");
            } else if (format.includes('Word')) {
                exportToWord(text, filename);
            } else if (format.includes('PDF')) {
                exportToPDF(text, filename);
            }
        });
    });
}
// Word/PDF 导出函数保持不变，此处简化展示
function exportToWord(text, filename) {
    if (typeof docx === 'undefined') { showToast('Engine loading...', 'info'); return; }
    const doc = new docx.Document({ sections: [{ children: text.split('\n').map(l => new docx.Paragraph({text: l})) }] });
    docx.Packer.toBlob(doc).then(b => saveAs(b, `${filename}.docx`));
}
function exportToPDF(text, filename) {
    if (typeof html2pdf === 'undefined' || typeof marked === 'undefined') { showToast('Engine missing.', 'error'); return; }
    const div = document.createElement('div');
    div.innerHTML = marked.parse(text);
    html2pdf().from(div).save(`${filename}.pdf`);
}

// --- 模块 G: 支付 ---
function setupPayment() {
    const payButtons = document.querySelectorAll('.choose-plan-btn');
    const paymentModal = document.getElementById('payment-modal-overlay');
    const closePaymentBtn = document.getElementById('close-payment-btn');
    const paypalContainer = document.getElementById('paypal-button-container');

    document.querySelectorAll('.pricing-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('button')) return;
            document.querySelectorAll('.pricing-card').forEach(c => c.classList.remove('plan-active'));
            card.classList.add('plan-active');
        });
    });

    if (closePaymentBtn && paymentModal) {
        closePaymentBtn.addEventListener('click', () => paymentModal.style.display = 'none');
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
            if (paymentModal) paymentModal.style.display = 'flex';
            if (window.paypal && paypalContainer) {
                paypalContainer.innerHTML = '';
                window.paypal.Buttons({
                    createOrder: (data, actions) => actions.order.create({ purchase_units: [{ amount: { value: amount } }] }),
                    onApprove: (data, actions) => actions.order.capture().then(async () => {
                        paymentModal.style.display = 'none';
                        await fetch(`${API_BASE_URL}/api/upgrade-plan`, {
                            method: 'POST', 
                            headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`},
                            body: JSON.stringify({ plan: planType })
                        });
                        showToast('Upgraded!', 'success');
                        setTimeout(() => window.location.reload(), 1500);
                    })
                }).render('#paypal-button-container');
            }
        });
    });
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

// --- 模块 I: 历史与消息 ---
function setupHistoryLoader() { /* 与之前逻辑一致，略以节省篇幅 */ }
// --- 修复版：消息中心完整逻辑 ---
function setupMessageCenter() {
    // 1. 绑定右下角悬浮按钮
    const bellBtn = document.querySelector('button[title="My Messages"]');
    if(bellBtn) {
        const newBtn = bellBtn.cloneNode(true);
        bellBtn.parentNode.replaceChild(newBtn, bellBtn);
        newBtn.addEventListener('click', window.openMessageCenter);
    }
    // 2. 启动自动检查
    checkNotifications();
    setInterval(checkNotifications, 30000);
}

// 必须确保这三个函数在全局作用域中存在
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
        // 如果有回复，显示红点
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

        // 渲染消息卡片
        msgs.forEach(msg => {
            const dateStr = new Date(msg.submittedAt).toLocaleDateString();
            let replyHtml = msg.reply 
                ? `<div class="bg-blue-50 p-3 mt-3 rounded text-sm text-gray-800 border-l-4 border-blue-500">
                     <strong>Admin:</strong> ${msg.reply}
                   </div>` 
                : `<div class="text-xs text-gray-400 mt-2 italic">Pending reply...</div>`;
                
            // 如果有对话记录（新版）
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

// --- 模块 K: 用户菜单 ---
function setupUserDropdown() {
    const headerRight = document.getElementById('auth-container');
    if (!headerRight) return;
    if (!currentUser) {
        headerRight.innerHTML = `
            <button class="text-gray-600 hover:text-blue-600 font-medium px-3 py-2 mr-2" onclick="openModal('login')">Login</button>
            <button class="bg-blue-600 text-white px-5 py-2 rounded-full font-bold shadow-lg hover:bg-blue-700" onclick="openModal('signup')">Get Started</button>
        `;
    } else {
        const initial = currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U';
        const avatar = currentUser.picture 
            ? `<img src="${currentUser.picture}" class="w-10 h-10 rounded-full border-2 border-white shadow-md cursor-pointer" onclick="toggleUserMenu()">`
            : `<button onclick="toggleUserMenu()" class="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold shadow-md cursor-pointer">${initial}</button>`;
        headerRight.innerHTML = `
            <div class="relative flex items-center gap-3">
                <span class="text-sm font-medium text-gray-700 hidden md:block">Hi, ${currentUser.name}</span>
                ${avatar}
                <div id="user-dropdown" class="hidden absolute right-0 top-14 w-56 bg-white rounded-xl shadow-2xl border border-gray-100 z-[9999] overflow-hidden">
                     <div class="px-4 py-3 border-b bg-gray-50"><p class="text-sm font-bold truncate">${currentUser.email}</p></div>
                     <a href="account.html" class="block px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 border-b border-gray-50 flex items-center gap-2">
                         <i class="fas fa-user-circle text-blue-500"></i> My Account 
                     </a>
                     <a href="usage.html" class="block px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 border-b border-gray-50 flex items-center gap-2">
                         <i class="fas fa-chart-pie text-green-500"></i> Usage Stats 
                     </a>
                     <a href="#" onclick="logout()" class="block px-4 py-3 text-sm text-red-600 hover:bg-red-50">Logout</a>
                </div>
            </div>account
        `;
    }
}
window.toggleUserMenu = function() { const m = document.getElementById('user-dropdown'); if(m) m.classList.toggle('hidden'); };
window.logout = function() { localStorage.removeItem('token'); window.location.reload(); };
window.onclick = function(e) { if(!e.target.closest('#auth-container')) { const m = document.getElementById('user-dropdown'); if(m) m.classList.add('hidden'); }};
