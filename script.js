/*
 * ===================================================================
 * * Reportify AI - script.js (v21.0 Unified & Fixed)
 * * 状态: 已重构架构，修复 Modal 冲突，统一状态管理，优化 PDF 导出
 * ===================================================================
 */

// --- 1. 全局配置与状态 (Global State) ---
const API_BASE_URL = 'https://api.goreportify.com';
let allTemplates = [];
let currentUser = null; // 存储完整的用户信息
let currentUserPlan = 'basic'; // 默认为 basic

// --- 2. 全局工具函数 (Utilities) ---

/**
 * Toast 提示框
 */
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
    
    // 动画进入
    setTimeout(() => toast.style.opacity = '1', 10);

    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.5s ease forwards';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
};

/**
 * 通用文件下载辅助函数
 */
window.saveAs = function(blob, filename) {
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
};

/**
 * 弹窗控制 (核心修复：统一管理)
 */
const authModalOverlay = document.getElementById('auth-modal-overlay');

window.openModal = function(tabToShow = 'login') {
    if (!authModalOverlay) {
        // 尝试重新获取，防止 DOM 加载延迟
        const overlay = document.getElementById('auth-modal-overlay');
        if(!overlay) return;
        overlay.classList.remove('hidden');
    } else {
        authModalOverlay.classList.remove('hidden');
    }

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

    // 2. 切换内容区域
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.add('hidden');
    });
    const targetContent = document.getElementById(tabToShow);
    if (targetContent) {
        targetContent.classList.remove('hidden');
    }
};

window.closeModal = function() {
    const overlay = document.getElementById('auth-modal-overlay');
    if (overlay) overlay.classList.add('hidden');
};

// --- 3. 核心初始化流程 (Main Initialization) ---
document.addEventListener('DOMContentLoaded', async () => {
    
    // A. 处理 Google 登录回调 (优先处理)
    handleGoogleCallback();

    // B. 获取当前用户信息 (全局状态)
    await fetchUserProfile();

    // C. 初始化各个功能模块
    setupAuthUI();          // 登录/注册弹窗交互
    setupGenerator();       // 报告生成逻辑
    setupTemplates();       // 加载模板
    setupExport();          // 导出功能
    setupPayment();         // 支付功能
    setupContactForm();     // 联系表单
    setupHistoryLoader();   // 历史记录 (如果在历史页)
    setupMessageCenter();   // 站内信
    setupGoogleLoginBtn();  // Google 登录按钮
    setupUserDropdown();    // 用户下拉菜单

    console.log("Reportify AI v21.0 Initialized");
});


// =================================================
//  功能模块实现细节
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
        // 延迟刷新以确保 Token 写入
        setTimeout(() => window.location.href = 'index.html', 500);
    }
    if (errorFromUrl) {
        showToast('Google Login Failed', 'error');
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

// --- 模块 B: 用户信息获取 ---
async function fetchUserProfile() {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
        const res = await fetch(`${API_BASE_URL}/api/me`, { 
            headers: { 'Authorization': `Bearer ${token}` } 
        });
        if (res.ok) {
            currentUser = await res.json();
            currentUserPlan = currentUser.plan || 'basic';
            console.log("User Plan:", currentUserPlan);
        } else if (res.status === 401) {
            // Token 过期，不强制登出，但在 UI 上表现为未登录
            localStorage.removeItem('token');
            currentUser = null;
        }
    } catch (e) {
        console.error("Fetch profile error:", e);
    }
}

// --- 模块 C: 认证 UI (弹窗/表单) ---
function setupAuthUI() {
    const closeModalBtn = document.getElementById('close-modal-btn');
    const authTabs = document.querySelectorAll('.tab-link');

    // 绑定关闭按钮
    if (closeModalBtn) closeModalBtn.addEventListener('click', window.closeModal);
    
    // 绑定遮罩层点击关闭
    const overlay = document.getElementById('auth-modal-overlay');
    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) window.closeModal();
        });
    }

    // 绑定 Tab 切换
    authTabs.forEach(t => t.addEventListener('click', () => window.openModal(t.dataset.tab)));

    // 绑定 Login 表单
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        // 使用 cloneNode 清除旧事件 (保留用户之前的做法以防 Nav 冲突)
        const newForm = loginForm.cloneNode(true);
        loginForm.parentNode.replaceChild(newForm, loginForm);
        
        newForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = newForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = 'Logging In...';

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
                showToast("Login Successful!", "success");
                window.closeModal();
                setTimeout(() => window.location.reload(), 800);
            } catch (err) {
                showToast(err.message, "error");
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        });
    }

    // 绑定 Signup 表单
    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        const newForm = signupForm.cloneNode(true);
        signupForm.parentNode.replaceChild(newForm, signupForm);
        
        // 实时校验逻辑
        setupSignupValidation();

        newForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = newForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            
            const name = document.getElementById('signup-name').value;
            const email = document.getElementById('signup-email').value;
            const password = document.getElementById('signup-password').value;

            if (password.length < 8) { showToast("Password needs 8 chars.", "error"); return; }

            submitBtn.disabled = true;
            submitBtn.textContent = 'Creating...';

            try {
                const res = await fetch(`${API_BASE_URL}/api/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ displayName: name, email, password }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || 'Registration failed');

                showToast('Account Created! Please Login.', 'success');
                window.openModal('login');
                newForm.reset();
            } catch (err) {
                showToast(err.message, "error");
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        });
    }

    // Free 按钮绑定
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

// 辅助：注册表单验证
function setupSignupValidation() {
    const passInput = document.getElementById('signup-password');
    const strengthBox = document.getElementById('password-strength-box');
    
    if (passInput && strengthBox) {
        passInput.addEventListener('focus', () => strengthBox.classList.remove('hidden'));
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
                    el.classList.add('text-green-600', 'font-medium');
                    el.innerHTML = '<i class="fas fa-check-circle mr-1"></i> ' + el.innerText.replace(/^[✓○]\s/, '');
                } else {
                    el.classList.remove('text-green-600', 'font-medium');
                    el.classList.add('text-gray-400');
                    el.innerHTML = '<i class="far fa-circle mr-1"></i> ' + el.innerText.replace(/^[✓○]\s/, '');
                }
            };
            updateItem('req-length', rules.length);
            updateItem('req-upper', rules.upper);
            updateItem('req-number', rules.number);
            updateItem('req-special', rules.special);
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
                // 如果是 Pro 模板且用户是 basic，加锁
                const isLocked = t.isPro && currentUserPlan !== 'pro';
                const lockIcon = isLocked ? '🔒 ' : '';
                option.textContent = `${lockIcon}${t.title}`;
                optgroup.appendChild(option);
            });
            templateSelect.appendChild(optgroup);
        }

        setupDynamicInputs(templateSelect);

    } catch (error) {
        console.error('Template Load Error:', error);
    }
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

        if (template.isPro && currentUserPlan !== 'pro') {
            showToast('This template requires a PRO plan.', 'error');
        }

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

// --- 模块 E: 生成器逻辑 ---
function setupGenerator() {
    const generateBtn = document.getElementById('generate-btn');
    if (!generateBtn) return;

    // Clone to remove old listeners
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

        // 收集动态输入
        const inputs = {};
        document.querySelectorAll('.dynamic-input').forEach(el => {
            if (el.dataset.key) inputs[el.dataset.key] = el.value;
        });

        const userPromptText = promptEl ? promptEl.value.trim() : "";
        if (!userPromptText && Object.keys(inputs).length === 0) {
            alert('Please enter content or fill out the form.');
            if (promptEl) promptEl.focus();
            return;
        }

        // UI 状态更新
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
                setTimeout(() => window.location.reload(), 1000);
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
            console.error(err);
            showToast(`Failed: ${err.message}`, 'error');
            if (resultBox) resultBox.value = "Generation Failed.";
        } finally {
            newGenerateBtn.disabled = false;
            newGenerateBtn.textContent = originalText;
        }
    });

    // 绑定“复制结果”按钮
    const copyBtn = document.getElementById('copy-btn') || 
                    Array.from(document.querySelectorAll('button')).find(el => el.textContent.trim().includes('复制结果'));
    
    if (copyBtn) {
        // Clone to remove old listeners
        const newCopyBtn = copyBtn.cloneNode(true);
        copyBtn.parentNode.replaceChild(newCopyBtn, copyBtn);
        
        newCopyBtn.onclick = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const resultBox = document.getElementById('generated-report') || document.getElementById('result');
            const textToCopy = resultBox ? (resultBox.value || resultBox.innerText) : "";

            if (!textToCopy || textToCopy.includes('AI is thinking')) {
                showToast("No content to copy.", "warning");
                return;
            }
            try {
                await navigator.clipboard.writeText(textToCopy);
                const original = newCopyBtn.innerHTML;
                newCopyBtn.innerHTML = '<i class="fas fa-check"></i> Copied';
                newCopyBtn.classList.add('bg-green-500', 'text-white', 'border-green-500');
                setTimeout(() => {
                    newCopyBtn.innerHTML = original;
                    newCopyBtn.classList.remove('bg-green-500', 'text-white', 'border-green-500');
                }, 2000);
            } catch (err) {
                alert('Copy failed, please select and copy manually.');
            }
        };
    }
}

// --- 模块 F: 导出功能 ---
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
                exportToWord(text, filename);
            } 
            else if (format.includes('PDF')) {
                exportToPDF(text, filename);
            }
        });
    });
}

function exportToWord(text, filename) {
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
                    size = 32; isBold = true;
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

function exportToPDF(text, filename) {
    if (typeof html2pdf === 'undefined' || typeof marked === 'undefined') { 
        showToast('PDF engine missing.', 'error'); return; 
    }
    showToast('Generating PDF...', 'info');
    
    // 渲染临时容器
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    
    const htmlContent = marked.parse(text);
    container.innerHTML = `
        <div id="pdf-source" style="width: 800px; padding: 40px; font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
             <h1 style="color:#007bff; border-bottom:1px solid #ddd; padding-bottom:10px;">Report</h1>
             <div class="markdown-body">${htmlContent}</div>
             <div style="margin-top:50px; text-align:center; color:#999; font-size:12px;">Generated by Reportify AI</div>
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

    html2pdf().set(opt).from(container.querySelector('#pdf-source')).save().then(() => {
        document.body.removeChild(container);
        showToast("PDF downloaded.", "success");
    }).catch(err => {
        console.error(err);
        document.body.removeChild(container);
        showToast("PDF Failed.", "error");
    });
}

// --- 模块 G: 支付功能 ---
function setupPayment() {
    const payButtons = document.querySelectorAll('.choose-plan-btn');
    const paymentModal = document.getElementById('payment-modal-overlay');
    const closePaymentBtn = document.getElementById('close-payment-btn');
    const paypalContainer = document.getElementById('paypal-button-container');

    // 价格卡片交互
    document.querySelectorAll('.pricing-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('button') || e.target.tagName === 'A') return;
            document.querySelectorAll('.pricing-card').forEach(c => c.classList.remove('plan-active'));
            card.classList.add('plan-active');
        });
    });

    if (closePaymentBtn && paymentModal) {
        const close = () => {
            paymentModal.style.display = 'none';
            if (paypalContainer) paypalContainer.innerHTML = '';
        };
        closePaymentBtn.addEventListener('click', close);
        paymentModal.addEventListener('click', (e) => { if (e.target === paymentModal) close(); });
    }

    payButtons.forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);

        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const token = localStorage.getItem('token');
            if (!token) {
                showToast('Please log in first.', 'error');
                window.openModal('login');
                return;
            }

            const planType = newBtn.dataset.plan;
            let amount = (planType === 'basic') ? '9.90' : '19.90';
            let planName = (planType === 'basic') ? 'Basic Plan' : 'Pro Plan';

            const paymentPlanLabel = document.getElementById('payment-plan-name');
            if (paymentPlanLabel) paymentPlanLabel.textContent = `${planName} ($${amount}/mo)`;
            if (paymentModal) paymentModal.style.display = 'flex';

            if (window.paypal && paypalContainer) {
                paypalContainer.innerHTML = '';
                window.paypal.Buttons({
                    style: { shape: 'rect', color: 'blue', layout: 'vertical', label: 'pay' },
                    createOrder: (data, actions) => {
                        return actions.order.create({
                            purchase_units: [{ description: planName, amount: { value: amount } }]
                        });
                    },
                    onApprove: (data, actions) => {
                        return actions.order.capture().then(async (details) => {
                            paymentModal.style.display = 'none';
                            try {
                                const res = await fetch(`${API_BASE_URL}/api/upgrade-plan`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                                    body: JSON.stringify({ plan: planType })
                                });
                                if (res.ok) {
                                    showToast(`Upgrade Successful!`, 'success');
                                    setTimeout(() => window.location.href = 'usage.html', 1500);
                                } else {
                                    showToast('Update failed. Contact support.', 'warning');
                                }
                            } catch (err) {
                                showToast('Network error.', 'error');
                            }
                        });
                    },
                    onError: (err) => {
                        console.error(err);
                        showToast('Payment Error.', 'error');
                    }
                }).render('#paypal-button-container');
            } else {
                showToast('PayPal SDK not loaded.', 'error');
            }
        });
    });
}

// --- 模块 H: 联系表单 ---
function setupContactForm() {
    const contactForm = document.getElementById('contact-form');
    // 自动填充
    if (currentUser) {
        const emailInput = document.getElementById('email');
        const nameInput = document.getElementById('name');
        const typeSelect = document.getElementById('contact-type');
        if (emailInput) emailInput.value = currentUser.email || '';
        if (nameInput) nameInput.value = currentUser.name || '';
        if (typeSelect && currentUser.plan === 'pro') typeSelect.value = 'Priority';
    }

    if (contactForm) {
        const newForm = contactForm.cloneNode(true);
        contactForm.parentNode.replaceChild(newForm, contactForm);

        newForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = newForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = "Sending...";

            try {
                const name = document.getElementById('name').value;
                const email = document.getElementById('email').value;
                const message = document.getElementById('message').value;
                const type = document.getElementById('contact-type') ? document.getElementById('contact-type').value : 'General';

                const res = await fetch(`${API_BASE_URL}/api/contact`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, message, type })
                });

                if (res.ok) {
                    showToast("Message sent!", "success");
                    newForm.reset();
                } else {
                    throw new Error("Failed to send");
                }
            } catch (err) {
                showToast("Error sending message.", "error");
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        });
    }
}

// --- 模块 I: 历史记录加载 ---
async function setupHistoryLoader() {
    const reportListContainer = document.getElementById('report-list');
    if (!reportListContainer) return;

    const token = localStorage.getItem('token');
    if (!token) {
        reportListContainer.innerHTML = '<div class="text-center py-10 text-red-500">Please log in.</div>';
        return;
    }

    reportListContainer.innerHTML = '<div class="text-center py-10">Loading...</div>';

    try {
        const res = await fetch(`${API_BASE_URL}/api/reports`, { headers: { 'Authorization': `Bearer ${token}` } });
        const reports = await res.json();

        if (reports.length === 0) {
            reportListContainer.innerHTML = '<div class="text-center py-10 text-gray-500">No reports found.</div>';
            return;
        }

        reportListContainer.innerHTML = '';
        reports.forEach(report => {
            const card = document.createElement('div');
            card.className = "bg-white p-6 rounded-lg shadow hover:shadow-md transition border border-gray-100 mb-4";
            const preview = report.content.replace(/[#*`]/g, '').slice(0, 100) + '...';
            card.innerHTML = `
                <div class="flex justify-between items-start">
                    <div>
                        <h4 class="text-lg font-bold text-gray-800 mb-1">${report.title || 'Untitled Report'}</h4>
                        <div class="flex items-center gap-2 mb-3">
                            <span class="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">${report.type || 'General'}</span>
                            <span class="text-xs text-gray-400">📅 ${new Date(report.createdAt).toLocaleDateString()}</span>
                        </div>
                        <p class="text-gray-600 text-sm mb-4">${preview}</p>
                    </div>
                    <button class="view-detail-btn px-4 py-2 border rounded hover:bg-gray-50 text-sm">View</button>
                </div>
            `;
            // 点击查看详情的逻辑（可扩展）
            card.querySelector('.view-detail-btn').addEventListener('click', () => {
                // 简单的 Alert 或者调用之前的 showReportDetail (如果需要保留)
                alert("Detail view to be implemented or reused from Module I code.");
            });
            reportListContainer.appendChild(card);
        });
    } catch (e) {
        reportListContainer.innerHTML = '<div class="text-center text-red-500">Error loading reports.</div>';
    }
}

// --- 模块 J: 站内信与 Google 按钮 ---
function setupGoogleLoginBtn() {
    const googleBtns = document.querySelectorAll('button');
    googleBtns.forEach(btn => {
        if (btn.textContent && btn.textContent.includes('Google')) {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            newBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                try {
                    const res = await fetch(`${API_BASE_URL}/auth/google`);
                    const data = await res.json();
                    if (data.url) window.location.href = data.url;
                } catch (err) {
                    showToast('Connection error', 'error');
                }
            });
        }
    });
}

function setupMessageCenter() {
    // 检查通知
    const checkNotifications = async () => {
        const token = localStorage.getItem('token');
        if (!token) return;
        try {
            const res = await fetch(`${API_BASE_URL}/api/my-messages`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (!res.ok) return;
            const msgs = await res.json();
            const currentReplied = msgs.filter(m => m.status === 'replied').length;
            const lastSeen = parseInt(localStorage.getItem('seen_reply_count') || '0');
            
            const badge = document.getElementById('notif-badge');
            if (badge && currentReplied > lastSeen) badge.classList.remove('hidden');
        } catch (e) { console.error(e); }
    };
    checkNotifications();
    setInterval(checkNotifications, 60000); // 每分钟检查一次
}

// --- 模块 K: 用户下拉菜单 ---
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
        const avatarHTML = currentUser.picture 
            ? `<img src="${currentUser.picture}" class="w-10 h-10 rounded-full border-2 border-white shadow-md cursor-pointer" onclick="toggleUserMenu()">`
            : `<button onclick="toggleUserMenu()" class="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold shadow-md cursor-pointer">${initial}</button>`;

        headerRight.innerHTML = `
            <div class="relative flex items-center gap-3">
                <span class="text-sm font-medium text-gray-700 hidden md:block">Hi, ${currentUser.name || 'User'}</span>
                ${avatarHTML}
                <div id="user-dropdown" class="hidden absolute right-0 top-14 w-56 bg-white rounded-xl shadow-2xl border border-gray-100 z-[9999] overflow-hidden">
                     <div class="px-4 py-3 border-b bg-gray-50">
                        <p class="text-xs text-gray-500 uppercase">Signed in as</p>
                        <p class="text-sm font-bold truncate">${currentUser.email}</p>
                     </div>
                     <a href="usage.html" class="block px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 border-b border-gray-50"><i class="fas fa-chart-pie text-blue-500"></i> My Account</a>
                     <a href="subscription.html" class="block px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 border-b border-gray-50"><i class="fas fa-credit-card text-green-500"></i> Subscription</a>
                     <a href="#" onclick="logout()" class="block px-4 py-3 text-sm text-red-600 hover:bg-red-50"><i class="fas fa-sign-out-alt"></i> Logout</a>
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
    showToast("Logged out successfully");
    setTimeout(() => window.location.reload(), 500);
};

// 点击空白关闭菜单
window.onclick = function(event) {
    if (!event.target.closest('#auth-container')) {
        const menu = document.getElementById('user-dropdown');
        if (menu && !menu.classList.contains('hidden')) menu.classList.add('hidden');
    }
};

// End of script.js
