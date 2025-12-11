/*
 * ===================================================================
 * * Reportify AI - script.js (v16.0 完美修复版)
 * * 功能: 登录/注册, 报告生成, 导出(Word/PDF), 价格表交互, PayPal支付
 * ===================================================================
*/

// --- 1. 全局消息提示工具 (Toast) ---
// 必须放在最外面，确保任何地方都能调用
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
    
    // 3秒后自动消失
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.5s ease forwards';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
};

// --- 主程序开始 ---
document.addEventListener('DOMContentLoaded', () => {
    
    const API_BASE_URL = 'https://api.goreportify.com'; 

    // =============================================
    // 模块 A: 弹窗与导航逻辑
    // =============================================
    const authModalOverlay = document.getElementById('auth-modal-overlay');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const authTabs = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');

    // 打开弹窗
    window.openModal = function(tabToShow = 'login') {
        if (!authModalOverlay) return;
        authModalOverlay.classList.remove('hidden');
        // 切换 Tab
        authTabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        const link = document.querySelector(`.tab-link[data-tab="${tabToShow}"]`);
        const content = document.getElementById(tabToShow);
        if(link) link.classList.add('active');
        if(content) content.classList.add('active');
    };

    // 关闭弹窗
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
    // 模块 B: 登录与注册逻辑
    // =============================================
    
    // 1. 登录
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        // 克隆节点以去除旧的事件监听器
        const newLoginForm = loginForm.cloneNode(true);
        loginForm.parentNode.replaceChild(newLoginForm, loginForm);

        newLoginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = newLoginForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = 'Logging In...';
            
            const emailInput = document.getElementById('login-email');
            const passwordInput = document.getElementById('login-password');
            
            try {
                const res = await fetch(`${API_BASE_URL}/api/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: emailInput.value, password: passwordInput.value }),
                }); 
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || 'Login failed');
                
                // 保存 Token
                localStorage.setItem('token', data.token);
                window.closeModal(); 
                
                // 更新导航栏
                if (window.updateUserNav) window.updateUserNav(data.user); 
                showToast("Login Successful!", "success");
                newLoginForm.reset(); 
                
                // 如果在订阅页，刷新页面以更新状态
                if(window.location.href.includes('subscription')) location.reload();

            } catch (err) {
                showToast(err.message, "error");
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        });
    }

    // 2. 注册
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
            if (passVal.length < 6) { showToast("Password too short.", "error"); return; }

            submitBtn.disabled = true;
            submitBtn.textContent = 'Creating Account...';

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
    // 模块 C: 价格表交互与支付 (Blue Box & PayPal)
    // =============================================
    
    // 1. 蓝框点击切换 (Click Card)
    const pricingCards = document.querySelectorAll('.pricing-card');
    if (pricingCards.length > 0) {
        pricingCards.forEach(card => {
            card.addEventListener('click', (e) => {
                // 如果点的是按钮或链接，不触发卡片选中
                if (e.target.tagName === 'BUTTON' || e.target.closest('button') || e.target.tagName === 'A') return;
                
                pricingCards.forEach(c => c.classList.remove('plan-active'));
                card.classList.add('plan-active');
            });
        });
    }

    // 2. 支付按钮 (Choose Plan)
    const payButtons = document.querySelectorAll('.choose-plan-btn');
    if (payButtons.length > 0) {
        payButtons.forEach(btn => {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);

            newBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                const planType = newBtn.dataset.plan; // basic / pro
                const token = localStorage.getItem('token');

                // 未登录拦截
                if (!token) {
                    showToast('Please log in first.', 'error');
                    window.openModal('login');
                    return;
                }

                newBtn.textContent = 'Processing...';
                newBtn.disabled = true;

                // 🔴 您的 PayPal 收款邮箱
                const myPaypalEmail = "liqing92965@gmail.com"; 
                
                let paymentUrl = "";
                if (planType === 'basic') {
                    paymentUrl = `https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=${myPaypalEmail}&currency_code=USD&amount=9.90&item_name=Reportify%20Basic%20Plan&return=https://goreportify.com/success&cancel_return=https://goreportify.com/subscription`;
                } else if (planType === 'pro') {
                    paymentUrl = `https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=${myPaypalEmail}&currency_code=USD&amount=19.90&item_name=Reportify%20Professional%20Plan&return=https://goreportify.com/success&cancel_return=https://goreportify.com/subscription`;
                }

                if (paymentUrl) {
                    window.open(paymentUrl, '_blank');
                    showToast(`Opening PayPal for ${planType}...`, 'success');
                } else {
                    showToast('Payment config error', 'error');
                }

                setTimeout(() => {
                    newBtn.textContent = planType === 'basic' ? 'Select Basic' : 'Upgrade to Pro';
                    newBtn.disabled = false;
                }, 2000);
            });
        });
    }

    // 3. Free 按钮逻辑
    const freeBtns = document.querySelectorAll('button');
    freeBtns.forEach(btn => {
        // 查找所有 Start Free 按钮
        if (btn.id === 'btn-select-free' || btn.textContent.includes('Start Free') || btn.dataset.plan === 'free') {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            
            newBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                // 如果是订阅页的 Start Free，回首页
                if(window.location.href.includes('subscription')) {
                    window.location.href = 'index.html'; 
                } else {
                    // 如果是首页的，打开注册
                    window.openModal('signup');
                }
            });
        }
    });

    // =============================================
    // 模块 D: 报告生成器逻辑
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
            
            // 收集动态输入框
            const inputs = {};
            document.querySelectorAll('.dynamic-input').forEach(el => { 
                if(el.dataset.key) inputs[el.dataset.key] = el.value; 
            });

            if ((!promptEl || !promptEl.value.trim()) && Object.keys(inputs).length === 0) {
                showToast('Please enter some content.', 'error');
                return;
            }

            const originalText = newGenerateBtn.textContent;
            newGenerateBtn.disabled = true;
            newGenerateBtn.textContent = 'Generating...';
            
            if (resultBox) {
                if(resultBox.tagName === 'TEXTAREA') resultBox.value = "AI is thinking... (This may take a few seconds)";
                else resultBox.innerText = "AI is thinking...";
            }

            try {
                const res = await fetch(`${API_BASE_URL}/api/generate`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}` 
                    },
                    body: JSON.stringify({
                        userPrompt: promptEl ? promptEl.value : "",
                        role: document.getElementById('role') ? document.getElementById('role').value : "General",
                        tone: document.getElementById('tone') ? document.getElementById('tone').value : "Professional",
                        language: document.getElementById('language') ? document.getElementById('language').value : "English",
                        templateId: document.getElementById('template') ? document.getElementById('template').value : "",
                        inputs: inputs
                    }),
                });

                const data = await res.json();

                if (res.status === 403) {
                    showToast(`Limit Reached: ${data.error}`, 'error');
                    if(resultBox) resultBox.value = "Generation failed: Quota exceeded.";
                } else if (res.status === 400) {
                    showToast(`Input Error: ${data.error}`, 'error');
                } else if (!res.ok) {
                    throw new Error(data.error || 'Server Error');
                } else {
                    if (resultBox) {
                        if(resultBox.tagName === 'TEXTAREA') resultBox.value = data.generatedText;
                        else resultBox.innerText = data.generatedText;
                        
                        // 自动调整高度
                        resultBox.style.height = 'auto';
                        resultBox.style.height = resultBox.scrollHeight + 'px';
                    }
                    showToast("Report Generated Successfully!", "success");
                }

            } catch (err) {
                console.error(err);
                showToast(`Failed: ${err.message}`, 'error');
            } finally {
                newGenerateBtn.disabled = false;
                newGenerateBtn.textContent = originalText;
            }
        });
    }

    // =============================================
    // 模块 E: 导出功能 (Word/PDF)
    // =============================================
    const exportButtons = document.querySelectorAll('.export-btn');
    const resultBox = document.getElementById('generated-report');

    if (exportButtons && resultBox) {
        exportButtons.forEach(button => {
            button.addEventListener('click', () => {
                const format = button.dataset.format || button.textContent.trim();
                let text = resultBox.tagName === 'TEXTAREA' ? resultBox.value : resultBox.innerText;

                // 辅助下载函数
                const downloadFile = (blob, name) => {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = name;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                };

                if (!text || text.includes('AI is thinking') || text.length < 5) {
                    showToast('Please generate a report first.', 'error');
                    return;
                }

                const filename = `Reportify_${new Date().toISOString().slice(0,10)}`;

                if (format.includes('Word')) {
                    if (typeof docx === 'undefined') { showToast("Word library loading...", "error"); return; }
                    const lines = text.split('\n');
                    const docChildren = [
                        new docx.Paragraph({ children: [new docx.TextRun({ text: "Generated Report", bold: true, size: 32 })], spacing: { after: 400 } })
                    ];
                    lines.forEach(line => {
                        if(line.trim()) docChildren.push(new docx.Paragraph({ children: [new docx.TextRun({ text: line, size: 24 })], spacing: { after: 200 } }));
                    });
                    const doc = new docx.Document({ sections: [{ children: docChildren }] });
                    docx.Packer.toBlob(doc).then(blob => {
                        downloadFile(blob, `${filename}.docx`);
                        showToast("Word document downloaded!", "success");
                    });
                } else if (format.includes('PDF')) {
                    if (typeof html2pdf === 'undefined') { showToast("PDF library loading...", "error"); return; }
                    const element = document.createElement('div');
                    element.style.padding = '20px';
                    element.style.fontFamily = 'Arial';
                    element.innerHTML = `<h2>Reportify AI Report</h2><hr><div style="white-space: pre-wrap;">${text}</div>`;
                    html2pdf().from(element).save(`${filename}.pdf`);
                    showToast("PDF downloaded!", "success");
                } else {
                    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
                    downloadFile(blob, `${filename}.md`);
                    showToast("Markdown downloaded!", "success");
                }
            });
        });
    }

    // 复制功能
    const copyBtn = document.getElementById('copy-btn');
    if (copyBtn && resultBox) {
        copyBtn.addEventListener('click', () => {
            const text = resultBox.tagName === 'TEXTAREA' ? resultBox.value : resultBox.innerText;
            if (!text) return;
            navigator.clipboard.writeText(text).then(() => {
                showToast("Copied to clipboard!", "success");
            });
        });
    }

}); 
// End of DOMContentLoaded
