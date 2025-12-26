/*
 * ===================================================================
 * * Reportify AI - script.js (v19.0 强制刷新版)
 * * 核心修复: 登录成功后自动刷新页面，强制UI更新为“已登录”状态
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

document.addEventListener('DOMContentLoaded', () => {
    
    const API_BASE_URL = 'https://api.goreportify.com'; 
    let allTemplates = []; 
    let currentUserPlan = 'basic'; 

    // =============================================
    // 模块 A: 导航栏逻辑
    // =============================================
    window.showLoggedOutNav = (headerActions) => {
        if (!headerActions) return;
        headerActions.innerHTML = ''; 
        
        const loginBtn = document.createElement('a');
        loginBtn.href = '#'; 
        loginBtn.className = 'btn btn-secondary';
        loginBtn.textContent = 'Login';
        loginBtn.style.marginRight = '10px';
        loginBtn.addEventListener('click', (e) => {
            e.preventDefault(); 
            window.openModal('login');
        });

        const getStartedBtn = document.createElement('a');
        getStartedBtn.href = '#';
        getStartedBtn.className = 'btn btn-primary';
        getStartedBtn.textContent = 'Get Started';
        getStartedBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.openModal('signup');
        });

        headerActions.appendChild(loginBtn);
        headerActions.appendChild(getStartedBtn);
    };

    // 尝试更新导航
    if (window.updateUserNav) {
        const token = localStorage.getItem('token');
        if (!token) window.showLoggedOutNav(document.querySelector('.header-actions'));
        else window.updateUserNav(); 
    }

    // =============================================
    // 模块 B: 弹窗控制
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
    // 模块 C: 登录与注册 (核心修复点)
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
                
                // 4. 🔴 关键修复：延迟1秒后强制刷新页面，确保 UI 变成已登录状态
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
                alert('请输入内容 (Please enter content in the box)'); // 弹窗提示更直接
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
    // 模块 F (修复版): 导出功能 (PDF/Word/Markdown)
    // =============================================
    
    const exportButtons = document.querySelectorAll('.export-btn');
    // 兼容 Textarea 和 Div
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
                
                // >>> C. PDF 下载 (修复版：移出屏幕 + 不透明) <<<
                else if (format.includes('PDF')) {
                    if (typeof html2pdf === 'undefined' || typeof marked === 'undefined') { 
                        showToast('PDF engine missing.', 'error'); return; 
                    }
                    
                    showToast('Generating PDF...', 'info');

                    // 1. 转换 Markdown 为 HTML
                    const htmlContent = marked.parse(text);

                    // 2. 创建容器
                    const container = document.createElement('div');
                    
                    // 🔴 核心修复：
                    // 1. opacity 改为 1 (必须可见，否则 PDF 是白的)
                    // 2. left 改为 -10000px (移出屏幕，用户看不见)
                    container.style.position = 'absolute';
                    container.style.top = '0';
                    container.style.left = '-10000px'; // 移到屏幕左侧外面
                    container.style.width = '800px';   // 固定宽度，确保排版一致
                    container.style.zIndex = '9999';   // 层级高一点，防止被遮挡
                    container.style.opacity = '1';     // ✅ 必须是不透明的！
                    container.style.background = '#fff';
                    container.style.padding = '40px';
                    
                    // 排版内容
                    container.innerHTML = `
                        <div style="font-family: Helvetica, Arial, sans-serif; color: #333; line-height: 1.6;">
                            <div style="text-align: center; border-bottom: 2px solid #007bff; padding-bottom: 20px; margin-bottom: 30px;">
                                <h1 style="color: #007bff; margin: 0; font-size: 28px;">Professional Report</h1>
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

                    // 3. 配置 PDF 参数
                    const opt = {
                        margin:       0.5, // 英寸
                        filename:     `${filename}.pdf`,
                        image:        { type: 'jpeg', quality: 0.98 },
                        html2canvas:  { 
                            scale: 2, 
                            useCORS: true,
                            windowWidth: 1200 // 模拟宽屏，防止手机版布局错乱
                        },
                        jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
                    };

                    // 4. 生成 -> 保存 -> 移除
                    // 给予浏览器 500ms 渲染时间，确保字体加载
                    setTimeout(() => {
                        html2pdf().set(opt).from(container).save().then(() => {
                            document.body.removeChild(container);
                            showToast("PDF downloaded.", "success");
                        }).catch(err => {
                            console.error("PDF Error:", err);
                            if(document.body.contains(container)) document.body.removeChild(container);
                            showToast("PDF generation failed.", "error");
                        });
                    }, 500);
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
// 模块 F: 支付集成 (修复版 - 粘贴到这里)
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

                // --- 替换开始 ---
                    window.paypal.Buttons({
                        // 🔴 核心修改：只允许显示 PayPal 按钮，隐藏黑色的信用卡按钮
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
                    // --- 替换结束 ---
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
