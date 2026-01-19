/*
 * ===================================================================
 * * Reportify AI - script.js (v24.0 最终纯净整合版)
 * * 状态: 已彻底清理冲突代码，修复登录/注册界面显示问题
 * ===================================================================
*/

const API_BASE_URL = 'https://api.goreportify.com'; 

// =================================================
// 1. 全局工具: Toast 提示
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

// =================================================
// 2. Google 登录回调处理
// =================================================
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');
    const errorFromUrl = urlParams.get('error');

    if (tokenFromUrl) {
        console.log("Saving Token:", tokenFromUrl);
        localStorage.setItem('token', tokenFromUrl);
        window.history.replaceState({}, document.title, window.location.pathname);
        showToast('Login Successful!', 'success');
        setTimeout(() => { window.location.href = 'index.html'; }, 500);
        return; 
    }

    if (errorFromUrl) {
        showToast('Google Login Failed', 'error');
        window.history.replaceState({}, document.title, window.location.pathname);
    }
});

// =================================================
// 3. 核心业务逻辑 (模板、生成、支付、导出、表单)
// =================================================
document.addEventListener('DOMContentLoaded', () => {
    
    let allTemplates = []; 
    let currentUserPlan = 'basic'; 

    // --- 模板加载 ---
    async function fetchUserPlan() {
        const token = localStorage.getItem('token');
        if (!token) return;
        try {
            const res = await fetch(`${API_BASE_URL}/api/me`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) {
                const user = await res.json();
                currentUserPlan = user.plan || 'basic';
            }
        } catch (e) { console.error(e); }
    }

    async function loadTemplates() {
        const templateSelect = document.getElementById('template');
        if (!templateSelect) return;
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/templates`, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {} 
            });
            if (!response.ok) return; 
            allTemplates = await response.json();
            if(allTemplates.length === 0) return;

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
                    const lock = (t.isPro && currentUserPlan !== 'pro') ? '🔒 ' : '';
                    option.textContent = `${lock}${t.title}`;
                    optgroup.appendChild(option);
                });
                templateSelect.appendChild(optgroup);
            }
        } catch (error) { console.error('Template Load Error:', error); }
    }

    // --- 动态表单监听 ---
    const templateSelect = document.getElementById('template');
    let dynamicInputsContainer = document.getElementById('dynamic-inputs-container');
    
    if (templateSelect) {
        if (!dynamicInputsContainer) {
            dynamicInputsContainer = document.createElement('div');
            dynamicInputsContainer.id = 'dynamic-inputs-container';
            dynamicInputsContainer.className = 'settings-grid'; 
            dynamicInputsContainer.style.marginBottom = '20px';
            if(templateSelect.closest('.form-group')) templateSelect.closest('.form-group').after(dynamicInputsContainer);
        }

        templateSelect.addEventListener('change', () => {
            const selectedId = templateSelect.value;
            const template = allTemplates.find(t => t._id === selectedId);
            const promptTextarea = document.getElementById('key-points');
            
            dynamicInputsContainer.innerHTML = '';
            if(promptTextarea) promptTextarea.value = ''; 
            
            if (!template) return;
            if (template.isPro && currentUserPlan !== 'pro') {
                showToast('This template requires a PRO plan.', 'error');
            }
            if (template.variables && template.variables.length > 0) {
                if(promptTextarea) promptTextarea.placeholder = "Additional notes...";
                template.variables.forEach(variable => {
                    const wrapper = document.createElement('div');
                    wrapper.className = 'input-wrapper';
                    wrapper.style.marginBottom = '15px';
                    const label = document.createElement('label');
                    label.textContent = variable.label || variable.id;
                    label.style.fontWeight = '600';
                    label.style.display = 'block';
                    label.style.marginBottom = '5px';
                    
                    let input;
                    if (variable.type === 'textarea') {
                        input = document.createElement('textarea');
                        input.rows = 3;
                    } else {
                        input = document.createElement('input');
                        input.type = 'text';
                    }
                    input.className = 'dynamic-input'; 
                    input.dataset.key = variable.id;
                    input.placeholder = variable.placeholder || '';
                    input.style.width = '100%';
                    input.style.padding = '10px';
                    input.style.border = '1px solid #ddd';
                    input.style.borderRadius = '6px';
                    
                    wrapper.appendChild(label);
                    wrapper.appendChild(input);
                    dynamicInputsContainer.appendChild(wrapper);
                });
            } else {
                if(promptTextarea) promptTextarea.placeholder = "Enter key points here...";
            }
        });
    }

    fetchUserPlan();
    loadTemplates();

    // --- 报告生成器 ---
    const generateBtn = document.getElementById('generate-btn');
    if (generateBtn) {
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
                if(el.dataset.key) inputs[el.dataset.key] = el.value; 
            });

            const userPromptText = promptEl ? promptEl.value.trim() : "";
            if (!userPromptText && Object.keys(inputs).length === 0) {
                alert('请输入内容 (Please enter content in the box)'); 
                if(promptEl) promptEl.focus();
                return;
            }

            const originalText = newGenerateBtn.textContent;
            newGenerateBtn.disabled = true;
            newGenerateBtn.textContent = 'Generating...';
            if (resultBox) resultBox.innerText = "AI is thinking...";

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
                    if(resultBox) resultBox.innerText = "Quota exceeded (配额已用完).";
                } else if (res.status === 401) {
                    showToast('Session expired. Please re-login.', 'warning');
                } else if (!res.ok) {
                    throw new Error(data.error || 'Server Error');
                } else {
                    if (resultBox) {
                        resultBox.innerText = data.generatedText;
                        resultBox.style.height = 'auto';
                        resultBox.style.height = resultBox.scrollHeight + 'px';
                    }
                    showToast("Report Generated!", "success");
                    if(window.updateUserNav) window.updateUserNav();
                }
            } catch (err) {
                showToast(`Failed: ${err.message}`, 'error');
                if (resultBox) resultBox.innerText = "生成失败，请重试 (Network Error)";
            } finally {
                newGenerateBtn.disabled = false;
                newGenerateBtn.textContent = originalText;
            }
        });
    }

    // --- 导出功能 ---
    const exportButtons = document.querySelectorAll('.export-btn');
    const getResultContent = () => {
        const box = document.getElementById('generated-report') || document.getElementById('result');
        return box ? (box.tagName === 'TEXTAREA' ? box.value : box.innerText) : "";
    };

    if (exportButtons.length > 0) {
        exportButtons.forEach(button => {
            const newBtn = button.cloneNode(true);
            button.parentNode.replaceChild(newBtn, button);

            newBtn.addEventListener('click', () => {
                const format = newBtn.dataset.format || newBtn.textContent.trim();
                const text = getResultContent();

                if (!text || text.length < 5 || text.includes('AI is thinking')) {
                    showToast('Please generate a report first.', 'warning');
                    return;
                }
                const dateStr = new Date().toISOString().slice(0,10);
                const filename = `Report_${dateStr}`;

                if (format === 'Markdown') {
                    const blob = new Blob([text], {type: 'text/markdown;charset=utf-8'});
                    saveAs(blob, `${filename}.md`);
                    showToast("Markdown downloaded.", "success");
                } else if (format.includes('Word')) {
                    if (typeof docx === 'undefined') { showToast('Word engine loading...', 'info'); return; }
                    const doc = new docx.Document({
                        sections: [{
                            children: text.split('\n').map(line => new docx.Paragraph({text: line.trim()}))
                        }]
                    });
                    docx.Packer.toBlob(doc).then(blob => {
                        saveAs(blob, `${filename}.docx`);
                        showToast("Word downloaded.", "success");
                    });
                } else if (format.includes('PDF')) {
                    if (typeof html2pdf === 'undefined' || typeof marked === 'undefined') { showToast('PDF engine missing.', 'error'); return; }
                    showToast('Generating PDF...', 'info');
                    const htmlContent = marked.parse(text);
                    const container = document.createElement('div');
                    container.innerHTML = `<div id="pdf-content" style="padding:20px; font-family:sans-serif;">${htmlContent}</div>`;
                    document.body.appendChild(container);
                    html2pdf().from(container.querySelector('#pdf-content')).save(`${filename}.pdf`).then(() => {
                        document.body.removeChild(container);
                        showToast("PDF downloaded.", "success");
                    });
                }
            });
        });
    }

    function saveAs(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
    }

    // --- 支付集成 (PayPal) ---
    const payButtons = document.querySelectorAll('.choose-plan-btn');
    const paymentModal = document.getElementById('payment-modal-overlay');
    const closePaymentBtn = document.getElementById('close-payment-btn');
    const paymentPlanLabel = document.getElementById('payment-plan-name');
    const paypalContainer = document.getElementById('paypal-button-container');

    if (closePaymentBtn && paymentModal) {
        closePaymentBtn.addEventListener('click', () => { paymentModal.style.display = 'none'; paypalContainer.innerHTML = ''; });
    }

    if (payButtons.length > 0) {
        payButtons.forEach(btn => {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            newBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const token = localStorage.getItem('token');
                if (!token) { showToast('Please log in first.', 'error'); window.openModal('login'); return; }
                const planType = newBtn.dataset.plan;
                if(planType === 'free') return; // Skip free
                
                let amount = planType === 'basic' ? '9.90' : '19.90';
                paymentPlanLabel.textContent = planType === 'basic' ? 'Basic Plan' : 'Pro Plan';
                paymentModal.style.display = 'flex';
                paypalContainer.innerHTML = '';

                if (window.paypal) {
                    window.paypal.Buttons({
                        createOrder: (data, actions) => actions.order.create({ purchase_units: [{ amount: { value: amount } }] }),
                        onApprove: (data, actions) => actions.order.capture().then(async () => {
                            paymentModal.style.display = 'none';
                            await fetch(`${API_BASE_URL}/api/upgrade-plan`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                                body: JSON.stringify({ plan: planType })
                            });
                            showToast('Upgrade Successful!', 'success');
                            setTimeout(() => window.location.href = 'usage.html', 1500);
                        })
                    }).render('#paypal-button-container');
                }
            });
        });
    }

    // Free 按钮
    document.querySelectorAll('button').forEach(btn => {
        if (btn.id === 'btn-select-free' || (btn.textContent && btn.textContent.includes('Start Free'))) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if(window.location.href.includes('subscription')) window.location.href = 'index.html'; 
                else window.openModal('signup');
            });
        }
    });

    // --- 复制按钮 ---
    const copyBtn = document.getElementById('copy-btn');
    if (copyBtn) {
        const newCopy = copyBtn.cloneNode(true);
        copyBtn.parentNode.replaceChild(newCopy, copyBtn);
        newCopy.addEventListener('click', () => {
            const text = document.getElementById('generated-report').innerText;
            if(text && !text.includes('thinking')) {
                navigator.clipboard.writeText(text);
                showToast("Copied!", "success");
            }
        });
    }

    // --- 联系我们表单 ---
    const contactForm = document.getElementById('contact-form');
    if (contactForm) {
        const newContactForm = contactForm.cloneNode(true);
        contactForm.parentNode.replaceChild(newContactForm, contactForm);
        newContactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = newContactForm.querySelector('button');
            const oldText = btn.textContent;
            btn.textContent = "Sending...";
            btn.disabled = true;
            try {
                const res = await fetch(`${API_BASE_URL}/api/contact`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: document.getElementById('name').value,
                        email: document.getElementById('email').value,
                        message: document.getElementById('message').value,
                        type: document.getElementById('contact-type').value
                    })
                });
                if (res.ok) { alert("Message sent!"); newContactForm.reset(); }
                else throw new Error();
            } catch (err) { alert("Failed to send."); }
            finally { btn.textContent = oldText; btn.disabled = false; }
        });
    }
    
    // 自动填充联系表单
    const token = localStorage.getItem('token');
    if (token) {
        fetch(`${API_BASE_URL}/api/me`, { headers: { 'Authorization': `Bearer ${token}` } })
            .then(res => res.json())
            .then(user => {
                if(document.getElementById('email')) document.getElementById('email').value = user.email || '';
                if(document.getElementById('name')) document.getElementById('name').value = user.name || '';
            }).catch(() => {});
    }

    // --- 登录/注册表单处理 (API 调用) ---
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        const newLoginForm = loginForm.cloneNode(true);
        loginForm.parentNode.replaceChild(newLoginForm, loginForm);
        newLoginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = newLoginForm.querySelector('button');
            const oldText = btn.textContent;
            btn.textContent = 'Logging In...'; btn.disabled = true;
            try {
                const res = await fetch(`${API_BASE_URL}/api/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: document.getElementById('login-email').value,
                        password: document.getElementById('login-password').value
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message);
                localStorage.setItem('token', data.token);
                showToast("Login Successful!", "success");
                setTimeout(() => window.location.reload(), 500);
            } catch (err) {
                showToast(err.message, "error");
                btn.disabled = false;
                btn.textContent = oldText;
            }
        });
    }

    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        const newSignupForm = signupForm.cloneNode(true);
        signupForm.parentNode.replaceChild(newSignupForm, signupForm);
        newSignupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn-signup-submit');
            const oldText = btn.textContent;
            btn.textContent = 'Creating...'; btn.disabled = true;
            try {
                const res = await fetch(`${API_BASE_URL}/api/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        displayName: document.getElementById('signup-name').value,
                        email: document.getElementById('signup-email').value,
                        password: document.getElementById('signup-password').value
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message);
                showToast('Account Created! Please Login.', 'success');
                window.openModal('login');
                newSignupForm.reset();
            } catch (err) {
                showToast(err.message, "error");
            } finally {
                btn.disabled = false;
                btn.textContent = oldText;
            }
        });
    }
});

// =================================================
// 4. 界面交互逻辑 (弹窗、菜单、状态) - 放在最后确保覆盖
// =================================================

// 切换菜单显示/隐藏
window.toggleUserMenu = function() {
    const menu = document.getElementById('user-dropdown');
    if (menu) menu.classList.toggle('hidden');
}

// 点击空白关闭菜单
window.onclick = function(event) {
    if (!event.target.closest('#auth-container')) {
        const menu = document.getElementById('user-dropdown');
        if (menu && !menu.classList.contains('hidden')) menu.classList.add('hidden');
    }
}

// 检查登录状态
async function checkLoginState() {
    const token = localStorage.getItem('token');
    const headerRight = document.getElementById('auth-container');
    if (!headerRight) return;

    if (!token) {
        headerRight.innerHTML = `
            <button class="text-gray-600 hover:text-blue-600 font-medium px-3 py-2 mr-2 transition" onclick="openModal('login')">Login</button>
            <button class="bg-blue-600 text-white px-5 py-2 rounded-full font-bold shadow-lg hover:bg-blue-700 transition" onclick="openModal('signup')">Get Started</button>
        `;
        return;
    }

    try {
        const res = await fetch(`${API_BASE_URL}/api/me`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) throw new Error("Token invalid");
        const user = await res.json();

        let avatarHTML = user.picture 
            ? `<img src="${user.picture}" class="w-10 h-10 rounded-full border-2 border-white shadow-md cursor-pointer hover:opacity-90" onclick="toggleUserMenu()">`
            : `<button onclick="toggleUserMenu()" class="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold shadow-md hover:bg-blue-700 transition focus:outline-none cursor-pointer border-2 border-white">${user.name ? user.name.charAt(0).toUpperCase() : 'U'}</button>`;

        headerRight.innerHTML = `
            <div class="relative flex items-center gap-3">
                <span class="text-sm font-medium text-gray-700 hidden md:block">Hi, ${user.name || 'User'}</span>
                ${avatarHTML}
                <div id="user-dropdown" class="hidden absolute right-0 top-14 w-56 bg-white rounded-xl shadow-2xl border border-gray-100 z-[9999] overflow-hidden animate-fade-in">
                    <div class="px-4 py-3 border-b border-gray-50 bg-gray-50">
                        <p class="text-xs text-gray-500 font-semibold uppercase">Account</p>
                        <p class="text-sm font-bold text-gray-800 truncate">${user.email}</p>
                    </div>
                    <a href="usage.html" class="block px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 border-b border-gray-50"><i class="fas fa-chart-pie text-blue-500 mr-2"></i> My Usage</a>
                    <a href="subscription.html" class="block px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 border-b border-gray-50"><i class="fas fa-credit-card text-green-500 mr-2"></i> Subscription</a>
                    <a href="profile.html" class="block px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 border-b border-gray-50"><i class="fas fa-cog text-gray-500 mr-2"></i> Settings</a>
                    ${user.role === 'admin' ? `<a href="admin.html" class="block px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 border-b border-gray-50"><i class="fas fa-shield-alt text-purple-500 mr-2"></i> Admin Panel</a>` : ''}
                    <a href="#" onclick="logout()" class="block px-4 py-3 text-sm text-red-600 hover:bg-red-50"><i class="fas fa-sign-out-alt mr-2"></i> Logout</a>
                </div>
            </div>
        `;
    } catch (e) {
        localStorage.removeItem('token');
        headerRight.innerHTML = `
            <button class="text-gray-600 hover:text-blue-600 font-medium px-3 py-2 mr-2" onclick="openModal('login')">Login</button>
            <button class="btn btn-primary px-5 py-2 rounded-full font-bold shadow-lg" onclick="openModal('signup')">Get Started</button>
        `;
    }
}

// 登出
window.logout = function() {
    localStorage.removeItem('token');
    showToast("Logged out successfully");
    setTimeout(() => window.location.reload(), 500);
}

// Tab 切换逻辑 (确保正确显示/隐藏内容)
window.openModal = function(tabName) {
    const modal = document.getElementById('auth-modal-overlay');
    if(modal) modal.classList.remove('hidden');
    
    // 切换 Tab 样式
    document.querySelectorAll('.tab-link').forEach(btn => {
        if(btn.dataset.tab === tabName) {
            btn.classList.add('text-blue-600', 'border-blue-600', 'bg-white');
            btn.classList.remove('text-gray-500', 'border-transparent');
        } else {
            btn.classList.remove('text-blue-600', 'border-blue-600', 'bg-white');
            btn.classList.add('text-gray-500', 'border-transparent');
        }
    });

    // 切换内容 (移除 hidden 类)
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.add('hidden');
    });
    const target = document.getElementById(tabName);
    if(target) target.classList.remove('hidden');
}

window.closeModal = function() {
    const modal = document.getElementById('auth-modal-overlay');
    if(modal) modal.classList.add('hidden');
}

// 自动初始化
document.addEventListener('DOMContentLoaded', () => {
    checkLoginState();
    checkNotifications();
    setInterval(checkNotifications, 30000);
    
    // 初始化弹窗状态 (默认选中 Login)
    const loginTab = document.querySelector('.tab-link[data-tab="login"]');
    if(loginTab) {
        // 模拟点击以应用样式，然后关闭弹窗防止自动弹出
        window.openModal('login');
        window.closeModal();
    }
});

// =================================================
// 5. 消息中心 & 表单验证
// =================================================

// 消息中心 (加载 & 渲染)
async function loadMessages(markAsRead = false) {
    const container = document.getElementById('msg-list-container');
    const token = localStorage.getItem('token');
    
    container.innerHTML = '<div class="flex flex-col items-center justify-center h-full text-gray-400 gap-3"><i class="fas fa-spinner fa-spin text-3xl text-blue-500"></i><span>Loading...</span></div>';

    try {
        const res = await fetch(`${API_BASE_URL}/api/my-messages`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) throw new Error("Failed");
        const msgs = await res.json();

        if (markAsRead) {
            const repliedCount = msgs.filter(m => m.status === 'replied').length;
            localStorage.setItem('seen_reply_count', repliedCount);
            if(document.getElementById('notif-badge')) document.getElementById('notif-badge').classList.add('hidden');
        }

        container.innerHTML = '';
        if (msgs.length === 0) {
            container.innerHTML = '<div class="flex flex-col items-center justify-center h-64 text-gray-300"><i class="far fa-folder-open text-5xl mb-4"></i><p>No feedback history.</p></div>';
            return;
        }

        msgs.forEach(msg => {
            const dateStr = new Date(msg.submittedAt).toLocaleDateString();
            let adminReplyContent = '';
            if (msg.conversation && msg.conversation.length > 0) {
                const adminMsgs = msg.conversation.filter(c => c.role === 'admin');
                adminReplyContent = adminMsgs.map(c => `<div class="mb-4 pb-4 border-b border-blue-100 last:border-0"><p class="text-xs text-blue-500 font-bold mb-1"><i class="fas fa-headset"></i> Support:</p><p class="text-gray-800 text-sm">${c.message}</p></div>`).join('');
            } else if (msg.reply) {
                adminReplyContent = `<p class="text-gray-800 text-sm">${msg.reply}</p>`;
            }

            const rightSide = adminReplyContent 
                ? `<div class="bg-blue-50 border-l-4 border-blue-500 p-5 rounded-r-lg h-full overflow-y-auto max-h-60">${adminReplyContent}</div>`
                : `<div class="bg-gray-50 border-l-4 border-gray-300 p-5 rounded-r-lg h-full flex flex-col justify-center items-center text-gray-400"><i class="fas fa-clock text-2xl mb-2"></i><p class="text-xs">Pending...</p></div>`;

            container.innerHTML += `
                <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-4 flex-shrink-0">
                    <div class="bg-gray-50 px-6 py-3 border-b border-gray-100 flex justify-between items-center">
                        <span class="bg-gray-200 text-gray-600 text-xs px-2 py-1 rounded font-bold uppercase">${msg.type || 'Feedback'}</span>
                        <span class="text-xs text-gray-500 font-mono">${dateStr}</span>
                    </div>
                    <div class="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100">
                        <div class="p-6">
                            <p class="text-xs text-gray-400 font-bold uppercase mb-2">My Inquiry:</p>
                            <p class="text-gray-700 text-sm whitespace-pre-wrap">${msg.message}</p>
                        </div>
                        <div class="p-0">${rightSide}</div>
                    </div>
                </div>
            `;
        });
    } catch (err) {
        container.innerHTML = '<p class="text-center text-red-400 mt-10">Load failed.</p>';
    }
}

// 检查通知
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
            if(document.getElementById('notif-badge')) document.getElementById('notif-badge').classList.remove('hidden');
            const audio = document.getElementById('notification-sound');
            if(audio) { audio.volume = 0.5; audio.play().catch(() => {}); }
        }
    } catch (e) {}
};

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

// 注册表单校验
document.addEventListener('DOMContentLoaded', () => {
    const nameInput = document.getElementById('signup-name');
    const emailInput = document.getElementById('signup-email');
    const passInput = document.getElementById('signup-password');
    const strengthBox = document.getElementById('password-strength-box');

    if (nameInput) {
        nameInput.addEventListener('input', () => {
            const val = nameInput.value.trim();
            const feedback = document.getElementById('name-feedback');
            if(feedback) {
                feedback.classList.remove('hidden');
                if (val.length < 2) {
                    feedback.innerHTML = '<i class="fas fa-times-circle"></i> Too short';
                    feedback.className = 'text-xs mt-1 text-red-500 font-medium';
                } else {
                    feedback.innerHTML = '<i class="fas fa-check-circle"></i> Looks good';
                    feedback.className = 'text-xs mt-1 text-green-600 font-medium';
                }
            }
        });
    }

    if (emailInput) {
        emailInput.addEventListener('input', () => {
            const val = emailInput.value.trim();
            const feedback = document.getElementById('email-feedback');
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if(feedback) {
                feedback.classList.remove('hidden');
                if (!emailRegex.test(val)) {
                    feedback.innerHTML = '<i class="fas fa-exclamation-circle"></i> Invalid format';
                    feedback.className = 'text-xs mt-1 text-red-500 font-medium';
                } else {
                    feedback.innerHTML = '<i class="fas fa-check-circle"></i> Valid format';
                    feedback.className = 'text-xs mt-1 text-green-600 font-medium';
                }
            }
        });
    }

    if (passInput) {
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
                if (!el) return;
                if (isValid) {
                    el.classList.remove('text-gray-400');
                    el.classList.add('text-green-600', 'font-bold');
                    el.innerHTML = '<i class="fas fa-check-circle mr-1"></i> ' + el.innerText.replace('✓ ', '').replace('○ ', '');
                } else {
                    el.classList.remove('text-green-600', 'font-bold');
                    el.classList.add('text-gray-400');
                    el.innerHTML = '<i class="far fa-circle mr-1 text-[10px]"></i> ' + el.innerText.replace('✓ ', '').replace('○ ', '');
                }
            };
            updateItem('req-length', rules.length);
            updateItem('req-upper', rules.upper);
            updateItem('req-number', rules.number);
            updateItem('req-special', rules.special);
        });
    }
});
