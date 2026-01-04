/*
 * ===================================================================
 * * Reportify AI - script.js (v21.0 完美合并修复版)
 * * 修复内容: 
 * * 1. 修复了 "Unexpected end of input" 括号丢失错误
 * * 2. 整合了头像下拉菜单 (带登出功能)
 * * 3. 完整保留了 PayPal 支付逻辑
 * * 4. 统一使用 HTTPS API 地址
 * ===================================================================
*/

// --- 1. 全局工具: Toast 提示 ---
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
// 🚀 主程序开始
// =================================================
document.addEventListener('DOMContentLoaded', () => {

    // 🟢 全局配置: 你的后端地址 (必须是 HTTPS)
    const API_BASE_URL = 'https://api.goreportify.com';

    // 变量初始化
    let allTemplates = [];
    let currentUserPlan = 'basic';
    const headerActions = document.querySelector('.header-actions');

    // =================================================
    // 模块 A: 导航栏与用户状态 (头像 + 下拉菜单)
    // =================================================
    
    // 1. 默认状态：立刻显示“登录/注册”按钮
    if (headerActions) {
        headerActions.innerHTML = `
            <a href="#" class="btn btn-secondary" onclick="window.openModal('login')">Login</a>
            <a href="#" class="btn btn-primary" onclick="window.openModal('signup')">Get Started</a>
        `;
    }

    // 2. 检查登录状态并更新 UI
    const token = localStorage.getItem('token');
    if (token) {
        fetch(`${API_BASE_URL}/api/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(res => {
            if (res.ok) return res.json();
            throw new Error('Not logged in');
        })
        .then(user => {
            // 🟢 登录成功：显示头像和下拉菜单
            if (headerActions) {
                // 自动生成头像 (UI Avatars)
                const avatarUrl = user.avatarUrl || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.name || 'User') + '&background=random';

                // 写入 HTML
                headerActions.innerHTML = `
                    <div class="user-menu-container" style="position: relative; display: inline-block;">
                        <div id="user-menu-trigger" style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 5px 10px; border-radius: 20px; transition: background 0.2s;">
                            <img src="${avatarUrl}" alt="Avatar" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover; border: 2px solid #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                            <span style="font-weight: 600; color: #333;">${user.name || 'User'}</span>
                            <i class="fas fa-chevron-down" style="font-size: 12px; color: #666;"></i>
                        </div>

                        <div id="user-dropdown" class="hidden" style="position: absolute; right: 0; top: 50px; background: white; min-width: 180px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); border: 1px solid #eee; overflow: hidden; z-index: 1000; display: none;">
                            <div style="padding: 15px; border-bottom: 1px solid #f0f0f0;">
                                <div style="font-size: 12px; color: #888;">Signed in as</div>
                                <div style="font-weight: bold; color: #333; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${user.email}</div>
                            </div>
                            
                            <a href="profile.html" style="display: block; padding: 12px 15px; color: #333; text-decoration: none;">
                                <i class="fas fa-user-circle" style="margin-right: 8px;"></i> Profile
                            </a>
                            <a href="usage.html" style="display: block; padding: 12px 15px; color: #333; text-decoration: none;">
                                <i class="fas fa-chart-line" style="margin-right: 8px;"></i> My Plan
                            </a>
                            
                            <div style="border-top: 1px solid #f0f0f0;"></div>
                            
                            <a href="#" id="logout-btn" style="display: block; padding: 12px 15px; color: #dc3545; text-decoration: none;">
                                <i class="fas fa-sign-out-alt" style="margin-right: 8px;"></i> Log Out
                            </a>
                        </div>
                    </div>
                `;

                // 绑定交互事件
                const trigger = document.getElementById('user-menu-trigger');
                const dropdown = document.getElementById('user-dropdown');
                const logoutBtn = document.getElementById('logout-btn');

                if (trigger && dropdown) {
                    trigger.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const isHidden = dropdown.style.display === 'none' || dropdown.style.display === '';
                        dropdown.style.display = isHidden ? 'block' : 'none';
                    });
                    document.addEventListener('click', () => {
                        dropdown.style.display = 'none';
                    });
                }

                if (logoutBtn) {
                    logoutBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        localStorage.removeItem('token');
                        showToast('Logged out successfully', 'success');
                        setTimeout(() => window.location.reload(), 1000);
                    });
                }
            }
        })
        .catch(err => {
            console.log("Token invalid or expired:", err.message);
            // 保持未登录状态，不做额外操作
        });
    }

    // =============================================
    // 模块 B: 弹窗控制 (Modal)
    // =============================================
    const authModalOverlay = document.getElementById('auth-modal-overlay');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const authTabs = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');

    window.openModal = function(tabToShow = 'login') {
        if (!authModalOverlay) return;
        authModalOverlay.classList.remove('hidden');
        authTabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        const link = document.querySelector(`.tab-link[data-tab="${tabToShow}"]`);
        const content = document.getElementById(tabToShow);
        if(link) link.classList.add('active');
        if(content) content.classList.add('active');
    };

    window.closeModal = function() {
        if(authModalOverlay) authModalOverlay.classList.add('hidden');
    };

    if (closeModalBtn) closeModalBtn.addEventListener('click', window.closeModal);
    if (authModalOverlay) authModalOverlay.addEventListener('click', (e) => { 
        if(e.target === authModalOverlay) window.closeModal(); 
    });
    authTabs.forEach(t => t.addEventListener('click', () => window.openModal(t.dataset.tab)));


    // =============================================
    // 模块 C: 登录与注册
    // =============================================
    
    // 登录
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        const newLoginForm = loginForm.cloneNode(true);
        loginForm.parentNode.replaceChild(newLoginForm, loginForm);

        newLoginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = newLoginForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = 'Logging In...';
            
            try {
                const emailInput = document.getElementById('login-email');
                const passwordInput = document.getElementById('login-password');
                const res = await fetch(`${API_BASE_URL}/api/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: emailInput.value, password: passwordInput.value }),
                }); 
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || 'Login failed');
                
                localStorage.setItem('token', data.token);
                showToast("Login Successful! Reloading...", "success");
                window.closeModal(); 
                
                setTimeout(() => {
                    window.location.reload();
                }, 1000);

            } catch (err) {
                showToast(err.message, "error");
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        });
    }

    // 注册
    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        const newSignupForm = signupForm.cloneNode(true);
        signupForm.parentNode.replaceChild(newSignupForm, signupForm);

        newSignupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = newSignupForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;

            const nameVal = document.getElementById('signup-name').value;
            const emailVal = document.getElementById('signup-email').value;
            const passVal = document.getElementById('signup-password').value;

            if (nameVal.length < 2) { showToast("Name too short.", "error"); return; }
            if (passVal.length < 8) { showToast("Password needs 8 chars.", "error"); return; }

            submitBtn.disabled = true;
            submitBtn.textContent = 'Creating...';

            try {
                const res = await fetch(`${API_BASE_URL}/api/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ displayName: nameVal, email: emailVal, password: passVal }),
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


    // =============================================
    // 模块 D: 模板加载与动态表单
    // =============================================
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

    // 动态表单监听
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

    // 初始化调用
    fetchUserPlan();
    loadTemplates();

    // =============================================
    // 模块 E: 报告生成器
    // =============================================
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
                alert('Please enter content or fill in the form.');
                if(promptEl) promptEl.focus();
                return;
            }

            const originalText = newGenerateBtn.textContent;
            newGenerateBtn.disabled = true;
            newGenerateBtn.textContent = 'Generating...';
            
            if (resultBox) {
                if(resultBox.tagName === 'TEXTAREA') resultBox.value = "AI is thinking...";
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
                    if(resultBox) resultBox.innerText = "Quota exceeded.";
                } else if (!res.ok) {
                    throw new Error(data.error || 'Server Error');
                } else {
                    if (resultBox) {
                        if(resultBox.tagName === 'TEXTAREA') resultBox.value = data.generatedText;
                        else resultBox.innerText = data.generatedText;
                        resultBox.style.height = 'auto';
                        resultBox.style.height = resultBox.scrollHeight + 'px';
                    }
                    showToast("Report Generated!", "success");
                }
            } catch (err) {
                console.error(err);
                showToast(`Failed: ${err.message}`, 'error');
                if (resultBox) resultBox.innerText = "Generation failed. Please try again.";
            } finally {
                newGenerateBtn.disabled = false;
                newGenerateBtn.textContent = originalText;
            }
        });
    }

    // =============================================
    // 模块 F: 导出功能 (PDF/Word/Markdown)
    // =============================================
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
                } 
                else if (format.includes('Word')) {
                    if (typeof docx === 'undefined') { showToast('Word engine loading...', 'info'); return; }
                    
                    const doc = new docx.Document({
                        sections: [{
                            properties: {},
                            children: text.split('\n').map(line => {
                                let cleanLine = line.trim();
                                if(!cleanLine) return new docx.Paragraph({text:""}); 

                                let isBold = false;
                                let size = 24; 

                                if (cleanLine.startsWith('## ')) {
                                    cleanLine = cleanLine.replace('## ', '');
                                    size = 32; 
                                    isBold = true;
                                } else if (cleanLine.startsWith('**') && cleanLine.endsWith('**')) {
                                    cleanLine = cleanLine.replace(/\*\*/g, '');
                                    isBold = true;
                                } else if (cleanLine.startsWith('- ')) {
                                    cleanLine = '• ' + cleanLine.replace('- ', '');
                                }

                                return new docx.Paragraph({
                                    children: [new docx.TextRun({ text: cleanLine, bold: isBold, size: size })],
                                    spacing: { after: 120 }
                                });
                            })
                        }]
                    });

                    docx.Packer.toBlob(doc).then(blob => {
                        saveAs(blob, `${filename}.docx`);
                        showToast("Word downloaded.", "success");
                    });
                } 
                else if (format.includes('PDF')) {
                    if (typeof html2pdf === 'undefined' || typeof marked === 'undefined') { 
                        showToast('PDF engine missing.', 'error'); return; 
                    }
                    
                    showToast('Generating PDF...', 'info');
                    const htmlContent = marked.parse(text);
                    const container = document.createElement('div');
                    container.style.position = 'fixed';
                    container.style.top = '0';
                    container.style.left = '0';
                    container.style.width = '100%';
                    container.style.zIndex = '999999'; 
                    container.style.background = '#ffffff';
                    container.style.padding = '20px';
                    
                    const loadingTip = document.createElement('div');
                    loadingTip.innerHTML = "⏳ Generating PDF... Please wait...";
                    loadingTip.style.position = "fixed";
                    loadingTip.style.top = "10px";
                    loadingTip.style.right = "20px";
                    loadingTip.style.zIndex = "1000000";
                    document.body.appendChild(loadingTip);

                    container.innerHTML = `
                        <style>
                            p, h1, h2, h3, h4, h5, li, div { page-break-inside: avoid; break-inside: avoid; }
                            p { margin-bottom: 15px; }
                        </style>
                        <div id="pdf-content-source" style="max-width: 800px; margin: 0 auto; background: white; padding: 20px; font-family: Helvetica, Arial, sans-serif; color: #333; line-height: 1.6;">
                            <div style="text-align: center; border-bottom: 2px solid #007bff; padding-bottom: 15px; margin-bottom: 30px;">
                                <h1 style="color: #007bff; margin: 0; font-size: 24px;">Professional Report</h1>
                                <p style="color: #666; font-size: 12px; margin-top: 5px;">Generated by Reportify AI • ${dateStr}</p>
                            </div>
                            <div style="font-size: 14px; text-align: left;">${htmlContent}</div>
                            <div style="margin-top: 50px; text-align: center; font-size: 10px; color: #aaa; border-top: 1px solid #eee; padding-top: 10px;">- End of Document -</div>
                        </div>
                    `;
                    document.body.appendChild(container);

                    const opt = {
                        margin: 10,
                        filename: `${filename}.pdf`,
                        image: { type: 'jpeg', quality: 0.98 },
                        html2canvas: { scale: 2, useCORS: true },
                        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
                        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] } 
                    };

                    setTimeout(() => {
                        html2pdf().set(opt).from(container.querySelector('#pdf-content-source')).save().then(() => {
                            document.body.removeChild(container);
                            document.body.removeChild(loadingTip);
                            showToast("PDF downloaded.", "success");
                        }).catch(err => {
                            console.error("PDF Error:", err);
                            if(document.body.contains(container)) document.body.removeChild(container);
                            if(document.body.contains(loadingTip)) document.body.removeChild(loadingTip);
                            showToast("PDF generation failed.", "error");
                        });
                    }, 100); 
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
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    }
    
    // 价格卡片交互
    const pricingCards = document.querySelectorAll('.pricing-card');
    if (pricingCards.length > 0) {
        pricingCards.forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('button') || e.target.tagName === 'A') return;
                pricingCards.forEach(c => c.classList.remove('plan-active'));
                card.classList.add('plan-active');
            });
        });
    }

    // =============================================
    // 模块 G: PayPal 支付集成 (完整保留)
    // =============================================
    const payButtons = document.querySelectorAll('.choose-plan-btn');
    const paymentModal = document.getElementById('payment-modal-overlay');
    const closePaymentBtn = document.getElementById('close-payment-btn');
    const paymentPlanLabel = document.getElementById('payment-plan-name');
    const paypalContainer = document.getElementById('paypal-button-container');

    // 1. 关闭弹窗逻辑
    if (closePaymentBtn && paymentModal) {
        const closeModal = () => {
            paymentModal.style.display = 'none';
            if (paypalContainer) paypalContainer.innerHTML = ''; 
        };
        closePaymentBtn.addEventListener('click', closeModal);
        paymentModal.addEventListener('click', (e) => {
            if (e.target === paymentModal) closeModal();
        });
    }

    // 2. 绑定支付按钮
    if (payButtons.length > 0) {
        payButtons.forEach(btn => {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);

            newBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation(); 

                const parentCard = newBtn.closest('.pricing-card');
                if (parentCard) {
                    document.querySelectorAll('.pricing-card').forEach(c => c.classList.remove('plan-active'));
                    parentCard.classList.add('plan-active');
                }

                const token = localStorage.getItem('token');
                if (!token) { 
                    showToast('Please log in first.', 'error'); 
                    window.openModal('login'); 
                    return; 
                }

                if (!paymentModal || !paypalContainer) {
                    console.error("Missing payment modal HTML");
                    return;
                }

                const planType = newBtn.dataset.plan; 
                let amount = '0.00';
                let planName = '';

                if (planType === 'basic') {
                    amount = '9.90';
                    planName = 'Basic Plan ($9.90/mo)';
                } else if (planType === 'pro') {
                    amount = '19.90';
                    planName = 'Professional Plan ($19.90/mo)';
                } else {
                    return;
                }

                if (paymentPlanLabel) paymentPlanLabel.textContent = planName;
                paymentModal.style.display = 'flex';

                if (window.paypal) {
                    paypalContainer.innerHTML = ''; 

                    window.paypal.Buttons({
                        fundingSource: window.paypal.FUNDING.PAYPAL,
                        style: {
                            shape: 'rect',
                            color: 'blue',
                            layout: 'vertical',
                            label: 'pay',
                        },
                        createOrder: function(data, actions) {
                            return actions.order.create({
                                purchase_units: [{
                                    description: planName,
                                    amount: { value: amount }
                                }]
                            });
                        },
                        onApprove: function(data, actions) {
                            return actions.order.capture().then(async function(details) {
                                console.log(details);
                                paymentModal.style.display = 'none';
                                
                                try {
                                    const res = await fetch(`${API_BASE_URL}/api/upgrade-plan`, {
                                        method: 'POST',
                                        headers: { 
                                            'Content-Type': 'application/json',
                                            'Authorization': `Bearer ${token}` 
                                        },
                                        body: JSON.stringify({ plan: planType })
                                    });
                                    
                                    if (res.ok) {
                                        showToast(`Upgrade Successful!`, 'success');
                                        setTimeout(() => window.location.href = 'usage.html', 1500);
                                    } else {
                                        showToast('Update failed. Contact support.', 'warning');
                                    }
                                } catch (err) {
                                    console.error(err);
                                    showToast('Network error updating plan.', 'error');
                                }
                            });
                        },
                        onError: function (err) {
                            console.error(err);
                            showToast('Payment Error. Try again.', 'error');
                        }
                    }).render('#paypal-button-container');
                } else {
                    showToast('PayPal SDK not loaded.', 'error');
                }
            });
        });
    }

    // Free 按钮
    document.querySelectorAll('button').forEach(btn => {
        if (btn.id === 'btn-select-free' || btn.textContent.includes('Start Free')) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if(window.location.href.includes('subscription')) window.location.href = 'index.html'; 
                else window.openModal('signup');
            });
        }
    });

}); 
// End of Script
