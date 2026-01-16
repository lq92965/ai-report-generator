/*
 * ===================================================================
 * * Reportify AI - script.js (v20.0 最终完整版)
 * * 状态: 已修复 Token 误删问题，已移除 Nav 冲突代码，保留所有功能
 * ===================================================================
*/

const API_BASE_URL = 'https://api.goreportify.com'; 

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
// 🟢 Google 登录回调处理 (仅保留 Token 保存逻辑，UI 交给 nav.js)
// =================================================
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');
    const errorFromUrl = urlParams.get('error');

    if (tokenFromUrl) {
        console.log("Saving Token:", tokenFromUrl);
        localStorage.setItem('token', tokenFromUrl);
        
        // 清理地址栏
        window.history.replaceState({}, document.title, window.location.pathname);
        
        showToast('Login Successful!', 'success');
        
        // 延迟刷新，让 nav.js 重新加载用户状态
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 500);
        return; 
    }

    if (errorFromUrl) {
        showToast('Google Login Failed', 'error');
        window.history.replaceState({}, document.title, window.location.pathname);
    }
});

// =================================================
// 🟢 核心业务逻辑 (模板、生成、支付、导出)
// =================================================
document.addEventListener('DOMContentLoaded', () => {
    
    let allTemplates = []; 
    let currentUserPlan = 'basic'; 

    // =============================================
    // 模块 B: 弹窗控制 (Login/Signup Modal)
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
    // 模块 C: 登录与注册表单处理
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
                
                // 1. 保存 Token
                localStorage.setItem('token', data.token);
                
                // 2. 提示成功
                showToast("Login Successful! Reloading...", "success");
                
                // 3. 关闭弹窗
                window.closeModal(); 
                
                // 4. 强制刷新页面，确保 nav.js 读取到最新状态
                setTimeout(() => {
                    window.location.reload();
                    console.log("登录成功，暂停刷新以进行调试");
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
    // 模块 D: 模板加载 (修复 Token 逻辑)
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
            
            // ⚠️ 修复点: 如果获取模板失败（比如401），直接返回，不要删Token，也不要报错
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
    // 模块 E: 报告生成器 (增强修复版)
    // =============================================
    const generateBtn = document.getElementById('generate-btn');
    if (generateBtn) {
        // 防止重复绑定：克隆节点
        const newGenerateBtn = generateBtn.cloneNode(true);
        generateBtn.parentNode.replaceChild(newGenerateBtn, generateBtn);

        newGenerateBtn.addEventListener('click', async () => {
            const token = localStorage.getItem('token'); 
            if (!token) {
                showToast('Please log in first.', 'error'); 
                window.openModal('login'); 
                return;
            }

            // 🔴 核心修复：双重查找，确保一定能找到输入框
            const promptEl = document.getElementById('key-points') || document.getElementById('prompt');
            const resultBox = document.getElementById('generated-report') || document.getElementById('result');
            
            // 获取下拉菜单
            const templateSelect = document.getElementById('template');
            const roleSelect = document.getElementById('role');
            const toneSelect = document.getElementById('tone');
            const langSelect = document.getElementById('language');

            // 收集动态输入框 (如果有)
            const inputs = {};
            document.querySelectorAll('.dynamic-input').forEach(el => { 
                if(el.dataset.key) inputs[el.dataset.key] = el.value; 
            });

            // 验证输入：必须有文本 或者 有动态输入
            const userPromptText = promptEl ? promptEl.value.trim() : "";
            
            if (!userPromptText && Object.keys(inputs).length === 0) {
                alert('请输入内容 (Please enter content in the box)'); 
                if(promptEl) promptEl.focus();
                return;
            }

            // 更改按钮状态
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
                        templateId: templateSelect ? templateSelect.value : "daily_summary", // 给个默认值防止为空
                        inputs: inputs
                    }),
                });

                const data = await res.json();

                if (res.status === 403) {
                    showToast(`Limit Reached: ${data.error}`, 'error');
                    if(resultBox) resultBox.innerText = "Quota exceeded (配额已用完).";
                } else if (res.status === 401) {
                    // ⚠️ 修复: 如果401，提示用户重新登录，但不要自动删Token
                    showToast('Session expired. Please re-login.', 'warning');
                } else if (!res.ok) {
                    throw new Error(data.error || 'Server Error');
                } else {
                    // 成功显示
                    if (resultBox) {
                        if(resultBox.tagName === 'TEXTAREA') resultBox.value = data.generatedText;
                        else resultBox.innerText = data.generatedText;
                        // 自动调整高度
                        resultBox.style.height = 'auto';
                        resultBox.style.height = resultBox.scrollHeight + 'px';
                    }
                    showToast("Report Generated!", "success");
                    
                    // 如果有 nav.js 的更新功能，刷新一下配额显示
                    if(window.updateUserNav) window.updateUserNav();
                }
            } catch (err) {
                console.error(err);
                showToast(`Failed: ${err.message}`, 'error');
                if (resultBox) resultBox.innerText = "生成失败，请重试 (Network Error)";
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

                // >>> A. Markdown 导出 <<<
                if (format === 'Markdown') {
                    const blob = new Blob([text], {type: 'text/markdown;charset=utf-8'});
                    saveAs(blob, `${filename}.md`);
                    showToast("Markdown downloaded.", "success");
                } 
                
                // >>> B. Word 导出 (带排版) <<<
                else if (format.includes('Word')) {
                    if (typeof docx === 'undefined') { showToast('Word engine loading...', 'info'); return; }
                    
                    const doc = new docx.Document({
                        sections: [{
                            properties: {},
                            children: text.split('\n').map(line => {
                                let cleanLine = line.trim();
                                if(!cleanLine) return new docx.Paragraph({text:""}); 

                                let isBold = false;
                                let size = 24; // 12pt

                                // 简单的 Markdown 格式转换
                                if (cleanLine.startsWith('## ')) {
                                    cleanLine = cleanLine.replace('## ', '');
                                    size = 32; // 16pt 标题
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
                
                // >>> C. PDF 下载 (修复版：智能分页，防止文字被切断) <<<
                else if (format.includes('PDF')) {
                    if (typeof html2pdf === 'undefined' || typeof marked === 'undefined') { 
                        showToast('PDF engine missing.', 'error'); return; 
                    }
                    
                    showToast('Generating PDF...', 'info');

                    // 1. 转换 Markdown 为 HTML
                    const htmlContent = marked.parse(text);

                    // 2. 创建一个“全屏覆盖”的容器
                    const container = document.createElement('div');
                    container.style.position = 'fixed';
                    container.style.top = '0';
                    container.style.left = '0';
                    container.style.width = '100%';
                    container.style.height = '100%';
                    container.style.zIndex = '999999'; 
                    container.style.background = '#ffffff';
                    container.style.overflowY = 'auto'; 
                    container.style.padding = '20px';
                    container.style.boxSizing = 'border-box';
                    
                    // 增加“生成中”提示
                    const loadingTip = document.createElement('div');
                    loadingTip.innerHTML = "⏳ Generating PDF... Please wait...";
                    loadingTip.style.position = "fixed";
                    loadingTip.style.top = "10px";
                    loadingTip.style.right = "20px";
                    loadingTip.style.color = "#007bff";
                    loadingTip.style.fontWeight = "bold";
                    loadingTip.style.zIndex = "1000000";
                    document.body.appendChild(loadingTip);

                    // 3. 排版内容 (加入智能分页 CSS)
                    container.innerHTML = `
                        <style>
                            /* 🔴 核心修复：防止元素内部断页 */
                            p, h1, h2, h3, h4, h5, li, div {
                                page-break-inside: avoid; 
                                break-inside: avoid;
                            }
                            /* 增加段落间距，让切分更容易 */
                            p { margin-bottom: 15px; }
                        </style>
                        <div id="pdf-content-source" style="max-width: 800px; margin: 0 auto; background: white; padding: 20px; font-family: Helvetica, Arial, sans-serif; color: #333; line-height: 1.6;">
                            <div style="text-align: center; border-bottom: 2px solid #007bff; padding-bottom: 15px; margin-bottom: 30px;">
                                <h1 style="color: #007bff; margin: 0; font-size: 24px;">Professional Report</h1>
                                <p style="color: #666; font-size: 12px; margin-top: 5px;">Generated by Reportify AI • ${dateStr}</p>
                            </div>
                            <div style="font-size: 14px; text-align: left;">
                                ${htmlContent}
                            </div>
                            <div style="margin-top: 50px; text-align: center; font-size: 10px; color: #aaa; border-top: 1px solid #eee; padding-top: 10px;">
                                - End of Document -
                            </div>
                        </div>
                    `;
                    
                    document.body.appendChild(container);

                    // 4. 配置 PDF 参数 (开启智能分页)
                    const opt = {
                        margin:       10, // mm
                        filename:     `${filename}.pdf`,
                        image:        { type: 'jpeg', quality: 0.98 },
                        html2canvas:  { 
                            scale: 2, 
                            useCORS: true, 
                            scrollY: 0, 
                            windowWidth: document.body.scrollWidth 
                        },
                        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
                        // 🔴 核心修复：开启智能分页模式
                        pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] } 
                    };

                    const elementToPrint = container.querySelector('#pdf-content-source');

                    setTimeout(() => {
                        html2pdf().set(opt).from(elementToPrint).save().then(() => {
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

    // 辅助函数: saveAs
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

    // =============================================
    // 模块 G: 支付集成 (保留 PayPal 逻辑)
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
                e.stopPropagation(); // 防止冒泡影响蓝框

                // 蓝框跟随逻辑
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

                    // --- PayPal 渲染 ---
                        window.paypal.Buttons({
                            fundingSource: window.paypal.FUNDING.PAYPAL,

                            style: {
                                shape: 'rect',
                                color: 'blue',      // 按钮颜色
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
                        // --- 结束 ---
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

    // =============================================
    // 模块 H: Google 登录按钮点击事件
    // =============================================
    const googleBtns = document.querySelectorAll('button');
    googleBtns.forEach(btn => {
        // 找到写着 "Google" 的按钮
        if (btn.textContent && btn.textContent.includes('Google')) {
            // 克隆按钮以清除可能存在的旧事件
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            
            newBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                const originalText = newBtn.textContent;
                newBtn.textContent = 'Wait...'; // 给点点击反馈
                
                try {
                    // 1. 找后端要 Google 的跳转链接
                    const res = await fetch('https://api.goreportify.com/auth/google');
                    const data = await res.json();
                    
                    // 2. 拿到链接，跳过去
                    if (data.url) {
                        window.location.href = data.url; 
                    } else {
                        showToast('Login server not ready', 'error');
                    }
                } catch (err) {
                    console.error(err);
                    showToast('Network error connecting to Google', 'error');
                    newBtn.textContent = originalText;
                }
            });
        }
    });
}); 

// End of Script

// =================================================
// 🟢 模块 I: 历史报告与详情弹窗 (新增功能)
// =================================================

// --- 1. 通用导出工具函数 (修复 PDF 空白和 Word 缺失) ---

// 导出 Word (支持中文和排版)
function exportHistoryToWord(content, filename) {
    const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' " +
        "xmlns:w='urn:schemas-microsoft-com:office:word' " +
        "xmlns='http://www.w3.org/TR/REC-html40'>" +
        "<head><meta charset='utf-8'><title>Export HTML to Word Document with JavaScript</title></head><body>";
    const footer = "</body></html>";
    
    // 简单的 Markdown 转 HTML 适配 Word
    // 如果你已经引入了 marked.js，可以直接用 marked.parse(content)
    // 这里做个简单的容错
    let htmlBody = content;
    if (typeof marked !== 'undefined') {
        htmlBody = marked.parse(content);
    } else {
        htmlBody = content.replace(/\n/g, "<br>");
    }

    const sourceHTML = header + htmlBody + footer;
    const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
    
    const fileDownload = document.createElement("a");
    document.body.appendChild(fileDownload);
    fileDownload.href = source;
    fileDownload.download = filename + '.doc';
    fileDownload.click();
    document.body.removeChild(fileDownload);
    window.showToast("Word document downloaded", "success");
}

// 导出 PDF (截图法 - 解决弹窗内容空白问题)
function exportHistoryToPDF(elementId, filename) {
    const element = document.getElementById(elementId);
    if (!element) {
        window.showToast("Error: Content not found", "error");
        return;
    }
    
    window.showToast("Generating PDF...", "info");

    // 配置 html2pdf 参数
    // 注意：这里需要依赖 html2pdf.js 库 (你的主页代码里似乎已经有了)
    const opt = {
        margin:       10,
        filename:     filename + '.pdf',
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, logging: false },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
    };

    // 如果 html2pdf 存在
    if (typeof html2pdf !== 'undefined') {
        html2pdf().set(opt).from(element).save().then(() => {
            window.showToast("PDF downloaded", "success");
        }).catch(err => {
            console.error(err);
            window.showToast("PDF generation failed", "error");
        });
    } else {
        alert("PDF engine (html2pdf) is missing. Please check your index.html.");
    }
}

// --- 2. 显示报告详情弹窗 (包含 Word/PDF 按钮) ---
function showReportDetail(report) {
    // 创建遮罩层
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modalOverlay.id = 'report-detail-modal';
    
    // 解析 Markdown 内容
    const htmlContent = (typeof marked !== 'undefined') ? marked.parse(report.content) : report.content;

    // 渲染弹窗 HTML
    modalOverlay.innerHTML = `
        <div class="bg-white rounded-lg w-11/12 max-w-4xl h-5/6 flex flex-col shadow-2xl animate__animated animate__fadeIn">
            <div class="flex justify-between items-center p-6 border-b">
                <div>
                    <h3 class="text-xl font-bold text-gray-800">${report.title || 'Report Details'}</h3>
                    <p class="text-sm text-gray-500">${new Date(report.createdAt).toLocaleString()}</p>
                </div>
                <button id="close-detail-btn" class="text-gray-500 hover:text-red-500 text-3xl">&times;</button>
            </div>

            <div class="flex-1 p-8 overflow-y-auto bg-gray-50">
                <div id="history-content-preview" class="markdown-body bg-white p-8 shadow-sm rounded-md text-gray-800 leading-relaxed border border-gray-100">
                    ${htmlContent}
                </div>
            </div>

            <div class="p-6 border-t bg-gray-100 flex justify-end gap-3">
                <button id="btn-history-word" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 shadow flex items-center gap-2">
                    📄 Download Word
                </button>
                <button id="btn-history-pdf" class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 shadow flex items-center gap-2">
                    📕 Download PDF
                </button>
                <button id="btn-close-bottom" class="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400">
                    Close
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modalOverlay);

    // --- 绑定事件 ---
    
    // 关闭功能
    const closeModal = () => modalOverlay.remove();
    document.getElementById('close-detail-btn').onclick = closeModal;
    document.getElementById('btn-close-bottom').onclick = closeModal;
    
    // 点击背景关闭
    modalOverlay.onclick = (e) => {
        if (e.target === modalOverlay) closeModal();
    };

    // 导出 Word
    document.getElementById('btn-history-word').onclick = () => {
        exportHistoryToWord(report.content, report.title || 'Report');
    };

    // 导出 PDF (关键：传入 ID 'history-content-preview')
    document.getElementById('btn-history-pdf').onclick = () => {
        exportHistoryToPDF('history-content-preview', report.title || 'Report');
    };
}

// --- 3. 加载报告列表 (Load Reports) ---
async function loadReports() {
    const reportListContainer = document.getElementById('report-list');
    // 如果页面上没有 report-list 这个容器，说明不在历史页，直接退出
    if (!reportListContainer) return;

    reportListContainer.innerHTML = '<div class="text-center py-10">Loading reports...</div>';

    const token = localStorage.getItem('token');
    if (!token) {
        reportListContainer.innerHTML = '<div class="text-center py-10 text-red-500">Please log in to view history.</div>';
        return;
    }

    try {
        const res = await fetch(`${API_BASE_URL}/api/reports`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error("Failed to fetch reports");

        const reports = await res.json();

        if (reports.length === 0) {
            reportListContainer.innerHTML = '<div class="text-center py-10 text-gray-500">No reports found. Generate one first!</div>';
            return;
        }

        reportListContainer.innerHTML = ''; // 清空加载提示

        // 渲染列表卡片
        reports.forEach(report => {
            const card = document.createElement('div');
            card.className = "bg-white p-6 rounded-lg shadow hover:shadow-md transition border border-gray-100 mb-4";
            
            // 简单的预览文字 (截取前100字)
            const preview = report.content.replace(/[#*`]/g, '').slice(0, 120) + '...';
            const dateStr = new Date(report.createdAt).toLocaleString();

            card.innerHTML = `
                <div class="flex justify-between items-start">
                    <div>
                        <h4 class="text-lg font-bold text-gray-800 mb-1">${report.title || 'Untitled Report'}</h4>
                        <div class="flex items-center gap-2 mb-3">
                            <span class="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">${report.type || 'General'}</span>
                            <span class="text-xs text-gray-400">🕒 ${dateStr}</span>
                        </div>
                        <p class="text-gray-600 text-sm mb-4 leading-relaxed">${preview}</p>
                    </div>
                    <button class="view-detail-btn px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 text-sm font-medium transition">
                        查看和下载
                    </button>
                </div>
            `;

            // 绑定点击事件，打开弹窗
            card.querySelector('.view-detail-btn').addEventListener('click', () => {
                showReportDetail(report);
            });

            reportListContainer.appendChild(card);
        });

    } catch (error) {
        console.error(error);
        reportListContainer.innerHTML = '<div class="text-center py-10 text-red-500">Error loading reports.</div>';
    }
}

// --- 4. 自动初始化 ---
// 当 DOM 加载完成后，检查是否需要加载历史记录
document.addEventListener('DOMContentLoaded', () => {
    loadReports();
});

// ==========================================
// 🟢 最终修复：复制结果按钮逻辑 (已修正 ID 匹配问题)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // 1. 精准找到“复制结果”按钮
    // 我们同时查找可能有 ID 的情况，或者通过文字内容查找
    const copyBtn = document.getElementById('copy-btn') || 
                    Array.from(document.querySelectorAll('button')).find(el => el.textContent.trim().includes('复制结果'));
    
    // 2. 🟢 关键修正：这里必须使用和生成报告时一样的 ID ('generated-report')
    const outputArea = document.getElementById('generated-report') || 
                       document.getElementById('result') || 
                       document.querySelector('textarea[readonly]');

    if (copyBtn) {
        // 移除旧的 onclick 属性（如果有），防止冲突
        copyBtn.removeAttribute('onclick'); 
        
        // 重新绑定点击事件
        copyBtn.onclick = async (e) => {
            e.preventDefault(); // 防止页面跳动
            e.stopPropagation();

            // 获取文本内容：支持 input/textarea 的 .value 和普通 div 的 .innerText
            const textToCopy = outputArea ? (outputArea.value || outputArea.innerText) : "";
            
            if (!textToCopy || textToCopy.includes('AI is thinking')) {
                // 如果没内容，或者是正在生成中，提示警告
                if(window.showToast) window.showToast("没有可复制的内容 (No content)", "warning");
                else alert("没有可复制的内容");
                return;
            }

            try {
                // 执行复制
                await navigator.clipboard.writeText(textToCopy);
                
                // 视觉反馈：按钮变绿，文字变成“已复制”
                const originalText = copyBtn.textContent;
                copyBtn.innerHTML = '<i class="fas fa-check"></i> 已复制';
                copyBtn.style.backgroundColor = '#10B981'; // 绿色
                copyBtn.style.color = 'white';
                copyBtn.style.borderColor = '#10B981';
                
                // 2秒后恢复原状
                setTimeout(() => {
                    copyBtn.textContent = originalText;
                    copyBtn.style.backgroundColor = ''; 
                    copyBtn.style.color = '';
                    copyBtn.style.borderColor = '';
                }, 2000);
                
            } catch (err) {
                console.error('复制失败:', err);
                alert('复制失败，请手动选中复制。');
            }
        };
    } else {
        console.warn("未找到复制按钮，请检查 HTML 中按钮文字是否为 '复制结果'");
    }
});

// ==========================================
// 🟢 新增功能：联系我们表单逻辑 (支持自动填充 + VIP检测)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const contactForm = document.getElementById('contact-form');
    const statusDiv = document.getElementById('form-status');

    // 1. 自动填充功能 (如果用户已登录)
    const token = localStorage.getItem('token');
    if (token) {
        // 这里的 API_BASE_URL 确保在你的 script.js 顶部已定义
        // 如果你的代码里没定义这个变量，请直接写 'https://api.goreportify.com'
        const baseUrl = (typeof API_BASE_URL !== 'undefined') ? API_BASE_URL : 'https://api.goreportify.com';
        
        fetch(`${baseUrl}/api/me`, { headers: { 'Authorization': `Bearer ${token}` } })
            .then(res => res.json())
            .then(user => {
                if (user.email) {
                    const emailInput = document.getElementById('email');
                    const nameInput = document.getElementById('name');
                    if(emailInput) emailInput.value = user.email;
                    if(nameInput) nameInput.value = user.name || '';
                    
                    // 🌟 如果是 Pro 用户，自动选中“优先支持”
                    if (user.plan === 'pro') {
                        const typeSelect = document.getElementById('contact-type');
                        if(typeSelect) typeSelect.value = 'Priority';
                    }
                }
            })
            .catch(err => console.log("Guest user or fetch error"));
    }

    // 2. 表单提交拦截
    if (contactForm) {
        // 克隆节点以防止重复绑定
        const newContactForm = contactForm.cloneNode(true);
        contactForm.parentNode.replaceChild(newContactForm, contactForm);

        newContactForm.addEventListener('submit', async (e) => {
            e.preventDefault(); 

            const nameInput = document.getElementById('name');
            const emailInput = document.getElementById('email');
            const typeSelect = document.getElementById('contact-type'); // 获取下拉菜单
            const msgInput = document.getElementById('message');
            const btn = newContactForm.querySelector('button');
            const baseUrl = (typeof API_BASE_URL !== 'undefined') ? API_BASE_URL : 'https://api.goreportify.com';

            // 锁定按钮
            const originalText = btn.textContent;
            btn.disabled = true;
            btn.textContent = "Sending...";
            if(statusDiv) statusDiv.innerHTML = "";

            try {
                // 发送给后端
                const res = await fetch(`${baseUrl}/api/contact`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: nameInput.value,
                        email: emailInput.value,
                        type: typeSelect ? typeSelect.value : 'General', // 带上类型
                        message: msgInput.value
                    })
                });

                const data = await res.json();

                if (res.ok) {
                    if(window.showToast) window.showToast("Message sent! Thanks for your feedback.", "success");
                    else alert("发送成功！");
                    newContactForm.reset(); 
                } else {
                    throw new Error(data.message || "Failed to send");
                }
            } catch (err) {
                console.error(err);
                if(window.showToast) window.showToast("Send failed: " + err.message, "error");
                else alert("发送失败: " + err.message);
            } finally {
                btn.disabled = false;
                btn.textContent = originalText;
            }
        });
    }
});

// ==========================================
// 🟢 Message Center Logic (English Version)
// ==========================================

// 打开弹窗
function openMessageCenter() {
    const token = localStorage.getItem('token');
    if (!token) {
        alert("Please login to view messages.");
        return;
    }

    const modal = document.getElementById('message-modal');
    modal.classList.remove('hidden'); // 显示弹窗
    loadMessages();
}

// 关闭弹窗
function closeMessageCenter() {
    document.getElementById('message-modal').classList.add('hidden');
}

// 加载数据
async function loadMessages() {
    const container = document.getElementById('msg-list-container');
    const token = localStorage.getItem('token');

    try {
        const res = await fetch('https://api.goreportify.com/api/my-messages', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) throw new Error("Failed");
        const msgs = await res.json();

        container.innerHTML = '';
        
        if (msgs.length === 0) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
                    <i class="far fa-comments text-4xl text-gray-300"></i>
                    <p class="text-sm">No messages yet.</p>
                </div>`;
            return;
        }

        msgs.forEach(msg => {
            // 样式处理：如果有回复，显示回复框
            const hasReply = msg.reply ? true : false;
            
            const replyHtml = hasReply 
                ? `<div class="mt-3 pt-3 border-t border-gray-100 bg-blue-50/50 p-3 rounded-lg text-sm text-gray-700 animate-fade-in">
                     <div class="flex items-center gap-2 mb-1 text-blue-600 font-bold text-xs uppercase tracking-wider">
                        <i class="fas fa-headset"></i> Support Team
                     </div>
                     ${msg.reply}
                   </div>` 
                : `<div class="mt-2 flex items-center gap-2 text-xs text-orange-400 italic bg-orange-50 px-2 py-1 rounded w-fit">
                     <i class="fas fa-clock"></i> Waiting for reply...
                   </div>`;

            // 消息卡片
            const card = `
                <div class="bg-white p-5 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition duration-200">
                    <div class="flex justify-between items-start mb-2">
                        <span class="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded font-bold uppercase tracking-wide">
                            ${msg.type || 'Feedback'}
                        </span>
                        <span class="text-[10px] text-gray-400 font-mono">
                            ${new Date(msg.submittedAt).toLocaleDateString()}
                        </span>
                    </div>
                    <p class="text-gray-800 text-sm leading-relaxed mb-3">${msg.message}</p>
                    ${replyHtml}
                </div>
            `;
            container.innerHTML += card;
        });

    } catch (err) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-red-400 gap-2">
                <i class="fas fa-exclamation-circle text-2xl"></i>
                <p class="text-sm">Failed to load messages.</p>
                <button onclick="loadMessages()" class="text-blue-600 underline text-xs">Retry</button>
            </div>`;
    }
}

// ==========================================
// 🟢 联系表单提交逻辑 (修复点击无反应的问题)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const submitBtn = document.querySelector('button[type="submit"]'); // 获取页面上的提交按钮
    
    // 只有当按钮存在时才运行，防止报错
    if (submitBtn) {
        submitBtn.addEventListener('click', async (e) => {
            e.preventDefault(); // 阻止页面刷新

            // 1. 抓取输入框内容 (兼容不同的ID写法)
            const name = document.querySelector('input[placeholder*="名字"]')?.value || document.getElementById('name')?.value || 'User';
            const email = document.querySelector('input[type="email"]')?.value || document.getElementById('email')?.value;
            const message = document.querySelector('textarea')?.value || document.getElementById('message')?.value;
            const type = document.querySelector('select')?.value || 'General';

            // 2. 验证
            if (!email || !message) {
                alert("请填写邮箱和内容 / Please fill in required fields");
                return;
            }

            // 3. 按钮变色提示
            const oldText = submitBtn.innerText;
            submitBtn.innerText = "发送中...";
            submitBtn.disabled = true;

            try {
                // 4. 发送给后端
                const res = await fetch('https://api.goreportify.com/api/contact', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, message, type })
                });

                if (res.ok) {
                    alert("✅ 发送成功！请点击右下角的‘消息’按钮查看回复。");
                    document.querySelector('textarea').value = ''; // 清空内容
                } else {
                    alert("❌ 发送失败，请稍后重试");
                }
            } catch (err) {
                console.error(err);
                alert("网络错误 / Network Error");
            } finally {
                submitBtn.innerText = oldText;
                submitBtn.disabled = false;
            }
        });
    }
});


// ============================================================
// 🚑 紧急补丁：找回丢失的登录与初始化逻辑
// (请粘贴到 script.js 的最末尾)
// ============================================================

// 1. 核心：检查登录状态 & 更新右上角 UI
function checkLoginState() {
    const token = localStorage.getItem('token');
    
    // 尝试找到导航栏右侧的登录区域 (根据你的截图推测的选择器)
    // 通常是 header 里的最后一个 div，或者是包含 "Login" 按钮的容器
    const headerRight = document.querySelector('header .flex.items-center.gap-4') || 
                        document.querySelector('nav .flex.items-center') ||
                        document.querySelector('header').lastElementChild;

    if (token) {
        // --- 已登录：显示头像 ---
        // 获取用户信息(可选)，这里为了快先显示默认头像
        if (headerRight) {
            // 将登录/注册按钮替换为用户头像
            headerRight.innerHTML = `
                <div class="relative group flex items-center gap-3">
                    <span class="text-sm font-medium text-gray-700 hidden md:block">Welcome</span>
                    <button class="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold shadow hover:bg-blue-700 transition">
                        <i class="fas fa-user"></i>
                    </button>
                    <div class="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 hidden group-hover:block z-50 overflow-hidden">
                        <a href="admin.html" class="block px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"><i class="fas fa-tachometer-alt mr-2"></i> Dashboard</a>
                        <div class="h-px bg-gray-100"></div>
                        <a href="#" onclick="logout()" class="block px-4 py-3 text-sm text-red-600 hover:bg-red-50"><i class="fas fa-sign-out-alt mr-2"></i> Logout</a>
                    </div>
                </div>
            `;
        }
    } else {
        // --- 未登录：保持原样 (显示登录/注册按钮) ---
        // 这里的代码不动，因为 HTML 里默认就是未登录状态
    }
}

// 2. 登出逻辑
function logout() {
    localStorage.removeItem('token');
    window.location.href = 'index.html';
}

// 3. 全局初始化监听器 (处理 Google 回调 + 自动运行登录检查)
document.addEventListener('DOMContentLoaded', () => {
    
    // A. 检查是不是刚从 Google 登录回来？
    const urlParams = new URLSearchParams(window.location.search);
    const googleToken = urlParams.get('token'); // 你的后端现在返回 ?token=...

    if (googleToken) {
        console.log("检测到 Google 登录 Token:", googleToken);
        localStorage.setItem('token', googleToken);
        
        // 清理地址栏，把 ?token=... 去掉，看起来更干净
        window.history.replaceState({}, document.title, window.location.pathname);
        
        // 强制刷新页面，让状态生效
        window.location.reload();
        return; 
    }

    // B. 运行登录检查 (让右上角变头像)
    checkLoginState();

    // C. 重新激活“消息中心”按钮 (防止它点不动)
    const msgBtn = document.querySelector('button[onclick="openMessageCenter()"]');
    if(msgBtn) {
        msgBtn.style.display = 'flex'; // 强制显示
        msgBtn.onclick = openMessageCenter; // 重新绑定事件
    }
});
