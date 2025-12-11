/*
 * ===================================================================
 * * Reportify AI - script.js (v17.0 终极全功能版)
 * * 包含: 动态模板, 智能表单, 登录注册, 支付跳转, 蓝框交互, 导出功能
 * * 修复: 解决了重复粘贴导致的语法错误 (Unexpected end of input)
 * ===================================================================
*/

// --- 1. 全局消息提示工具 (Toast) ---
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

document.addEventListener('DOMContentLoaded', () => {
    
    const API_BASE_URL = 'https://api.goreportify.com'; 
    let allTemplates = []; 
    let currentUserPlan = 'basic'; 

    // =============================================
    // 模块 A: 弹窗与导航
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
    if (authTabs) {
        authTabs.forEach(t => t.addEventListener('click', () => window.openModal(t.dataset.tab)));
    }

    // =============================================
    // 模块 B: 登录注册与密码强度
    // =============================================
    
    // 密码强度
    const passInput = document.getElementById('signup-password');
    if (passInput) {
        passInput.addEventListener('input', function() {
            const val = this.value;
            const reqLen = document.getElementById('req-length');
            const reqNum = document.getElementById('req-number');
            const reqUp = document.getElementById('req-upper');
            if(reqLen) reqLen.className = val.length >= 8 ? 'valid' : 'invalid';
            if(reqNum) reqNum.className = /[0-9]/.test(val) ? 'valid' : 'invalid';
            if(reqUp) reqUp.className = /[A-Z]/.test(val) ? 'valid' : 'invalid';
        });
    }

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
                window.closeModal(); 
                if (window.updateUserNav) window.updateUserNav(data.user); 
                
                // 登录成功后重新加载模板和计划
                fetchUserPlan();
                loadTemplates();
                showToast("Login Successful!", "success");
                newLoginForm.reset(); 
                
            } catch (err) {
                showToast(err.message, "error");
            } finally {
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
    // 模块 C: 模板加载与动态表单 (恢复的功能!)
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
        // 如果没有容器，创建一个
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

    // 初始化加载
    fetchUserPlan();
    loadTemplates();

    // =============================================
    // 模块 D: 报告生成器
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

            const promptEl = document.getElementById('key-points');
            const resultBox = document.getElementById('generated-report');
            
            // 收集动态输入
            const inputs = {};
            document.querySelectorAll('.dynamic-input').forEach(el => { 
                if(el.dataset.key) inputs[el.dataset.key] = el.value; 
            });

            if ((!promptEl || !promptEl.value.trim()) && Object.keys(inputs).length === 0) {
                showToast('Please enter content.', 'error');
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
                        userPrompt: promptEl ? promptEl.value : "",
                        role: document.getElementById('role') ? document.getElementById('role').value : "General",
                        tone: document.getElementById('tone') ? document.getElementById('tone').value : "Professional",
                        language: document.getElementById('language') ? document.getElementById('language').value : "English",
                        templateId: templateSelect ? templateSelect.value : "",
                        inputs: inputs
                    }),
                });

                const data = await res.json();

                if (res.status === 403) {
                    showToast(`Limit Reached: ${data.error}`, 'error');
                    if(resultBox) resultBox.value = "Quota exceeded.";
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
                showToast(`Failed: ${err.message}`, 'error');
            } finally {
                newGenerateBtn.disabled = false;
                newGenerateBtn.textContent = originalText;
            }
        });
    }

    // =============================================
    // 模块 E: 导出 & 支付 & 交互
    // =============================================
    
    // 导出
    const exportButtons = document.querySelectorAll('.export-btn');
    const resultBox = document.getElementById('generated-report');
    if (exportButtons && resultBox) {
        exportButtons.forEach(button => {
            button.addEventListener('click', () => {
                const format = button.dataset.format || button.textContent.trim();
                let text = resultBox.tagName === 'TEXTAREA' ? resultBox.value : resultBox.innerText;
                if (!text || text.includes('AI is thinking') || text.length < 5) return showToast('No report to export.', 'error');
                
                const filename = `Report_${new Date().toISOString().slice(0,10)}`;
                const downloadFile = (blob, name) => {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a'); a.href = url; a.download = name;
                    document.body.appendChild(a); a.click(); document.body.removeChild(a);
                };

                if (format.includes('Word')) {
                    if (typeof docx !== 'undefined') {
                        const doc = new docx.Document({ sections: [{ children: [new docx.Paragraph({ children: [new docx.TextRun(text)] })] }] });
                        docx.Packer.toBlob(doc).then(blob => downloadFile(blob, `${filename}.docx`));
                        showToast("Word downloaded.", "success");
                    }
                } else if (format.includes('PDF')) {
                    if (typeof html2pdf !== 'undefined') {
                        const el = document.createElement('div'); el.innerHTML = text.replace(/\n/g, '<br>');
                        html2pdf().from(el).save(`${filename}.pdf`);
                        showToast("PDF downloaded.", "success");
                    }
                } else {
                    downloadFile(new Blob([text], {type: 'text/markdown'}), `${filename}.md`);
                }
            });
        });
    }

    // 价格卡片交互 (蓝框)
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

    // 支付按钮 (PayPal)
    const payButtons = document.querySelectorAll('.choose-plan-btn');
    if (payButtons.length > 0) {
        payButtons.forEach(btn => {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            newBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const planType = newBtn.dataset.plan; 
                const token = localStorage.getItem('token');
                if (!token) { showToast('Please log in first.', 'error'); window.openModal('login'); return; }

                newBtn.textContent = 'Processing...';
                newBtn.disabled = true;
                const myPaypalEmail = "liqing92965@gmail.com"; 
                let paymentUrl = "";
                
                if (planType === 'basic') paymentUrl = `https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=${myPaypalEmail}&currency_code=USD&amount=9.90&item_name=Reportify%20Basic`;
                else if (planType === 'pro') paymentUrl = `https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=${myPaypalEmail}&currency_code=USD&amount=19.90&item_name=Reportify%20Pro`;

                if (paymentUrl) { window.open(paymentUrl, '_blank'); showToast('Opening PayPal...', 'success'); }
                
                setTimeout(() => { newBtn.textContent = planType === 'basic' ? 'Select Basic' : 'Upgrade to Pro'; newBtn.disabled = false; }, 2000);
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
