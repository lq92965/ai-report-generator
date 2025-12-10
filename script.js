/*
 * ===================================================================
 * * Reportify AI - script.js (v5.0 完整旗舰版)
 * * 包含: 
 * * 1. 动态模板加载与分类 (Sales, PM, etc.)
 * * 2. 智能表单构建器 (根据变量生成输入框)
 * * 3. 完整的登录/注册/导出/UI交互逻辑
 * ===================================================================
*/
// --- 全局消息提示工具 (替代 alert) ---
window.showToast = function(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'fa-info-circle';
    if (type === 'success') icon = 'fa-check-circle';
    if (type === 'error') icon = 'fa-exclamation-circle';

    toast.innerHTML = `<i class="fas ${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);

    // 3秒后自动消失
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.5s ease forwards';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
};
document.addEventListener('DOMContentLoaded', () => {
    // --- 密码强度实时校验 ---
    const passInput = document.getElementById('signup-password');
    if (passInput) {
        passInput.addEventListener('input', function() {
            const val = this.value;
            const reqLen = document.getElementById('req-length');
            const reqNum = document.getElementById('req-number');
            const reqUp = document.getElementById('req-upper');

            if (val.length >= 8) reqLen.className = 'valid'; else reqLen.className = 'invalid';
            if (/[0-9]/.test(val)) reqNum.className = 'valid'; else reqNum.className = 'invalid';
            if (/[A-Z]/.test(val)) reqUp.className = 'valid'; else reqUp.className = 'invalid';
        });
    }

    // --- 注册提交拦截校验 ---
    const signupFormEl = document.getElementById('signup-form');
    if (signupFormEl) {
        // 移除旧的监听器不容易，我们直接用 onsubmit 覆盖
        signupFormEl.onsubmit = function(e) {
            const pw = document.getElementById('signup-password').value;
            // 简单校验
            if (pw.length < 8 || !/[0-9]/.test(pw) || !/[A-Z]/.test(pw)) {
                e.preventDefault(); // 阻止提交
                alert("Password implies safety rules: 8+ chars, 1 number, 1 uppercase.");
                return false;
            }
            // 如果通过，让它继续执行原本的 addEventListener 逻辑，或者您可以在这里直接调用 fetch 注册
        };
    }
    const API_BASE_URL = 'https://api.goreportify.com'; 

    // --- DOM 元素选择器 ---
    const generateBtn = document.getElementById('generate-btn');
    const copyBtn = document.getElementById('copy-btn');
    const resultBox = document.getElementById('result');
    const exportButtons = document.querySelectorAll('.export-btn');
    const promptTextarea = document.getElementById('prompt'); // 大文本框
    const templateSelect = document.getElementById('template'); // 下拉菜单
    
    // 筛选器
    const detailLevelSelect = document.getElementById('detail-level');
    const roleSelect = document.getElementById('role');
    const toneSelect = document.getElementById('tone');
    const languageSelect = document.getElementById('language');
    
    // 弹窗与表单
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const authModalOverlay = document.getElementById('auth-modal-overlay');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const authTabs = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');
    const pricingCards = document.querySelectorAll('.pricing-card');
    const formStatus = document.getElementById('form-status');
    const contactForm = document.getElementById('contact-form');
    const allLinks = document.querySelectorAll('a[href^="#"]');
    const socialLoginButtons = document.querySelectorAll('.btn-social-google');
    const choosePlanButtons = document.querySelectorAll('.choose-plan-btn');

    // (!!!) 动态输入框的容器
    // 尝试获取，如果没有则动态创建插入
    let dynamicInputsContainer = document.getElementById('dynamic-inputs-container');
    if (!dynamicInputsContainer && templateSelect) {
        dynamicInputsContainer = document.createElement('div');
        dynamicInputsContainer.id = 'dynamic-inputs-container';
        dynamicInputsContainer.className = 'settings-grid'; 
        dynamicInputsContainer.style.marginBottom = '20px';
        // 插入到 templateSelect 所在的 form-group 后面
        templateSelect.closest('.form-group').after(dynamicInputsContainer);
    }
    
    // 全局状态
    let allTemplates = []; 
    let currentUserPlan = 'basic'; 

    // --- 1. 辅助函数 ---
    function downloadFile(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // --- 2. 导航栏逻辑覆盖 ---
    // 覆盖 nav.js 的默认行为，让主页的“登录”按钮打开弹窗
    window.showLoggedOutNav = (headerActions) => {
        if (!headerActions) return;
        headerActions.innerHTML = ''; 
        
        const loginBtn = document.createElement('a');
        loginBtn.href = '#'; 
        loginBtn.className = 'btn btn-secondary';
        loginBtn.textContent = 'Login';
        loginBtn.addEventListener('click', (e) => {
            e.preventDefault(); 
            openModal('login'); 
        });

        const getStartedBtn = document.createElement('a');
        getStartedBtn.href = '#generator';
        getStartedBtn.className = 'btn btn-primary';
        getStartedBtn.textContent = 'Get Started';

        headerActions.appendChild(loginBtn);
        headerActions.appendChild(getStartedBtn);
    }
    // 重新触发导航更新
    if (window.updateUserNav) window.updateUserNav();


    // --- 3. 模板系统初始化 ---
    
    // 获取用户 Plan (用于判断 Pro 锁)
    async function fetchUserPlan() {
        const token = localStorage.getItem('token');
        if (!token) return;
        try {
            const res = await fetch(`${API_BASE_URL}/api/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const user = await res.json();
                currentUserPlan = user.plan || 'basic';
            }
        } catch (e) { console.error(e); }
    }

    // --- 强力模板加载函数 (修复下拉菜单空白) ---
async function loadTemplates() {
    const templateSelect = document.getElementById('template'); // 确保 HTML 里这个 ID 对
    if (!templateSelect) return;

    // 先清空，给一个“加载中”的状态
    templateSelect.innerHTML = '<option value="" disabled selected>Loading templates...</option>';

    try {
        const token = localStorage.getItem('token');
        // 注意：如果您的模板是公开的，后端应该允许不带 Token 访问，或者这里必须确保已登录
        // 这里假设获取所有模板（包含系统默认）
        const API_URL = 'https://api.goreportify.com';
        
        const response = await fetch(`${API_URL}/api/templates`, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {} 
        });

        if (!response.ok) throw new Error('Failed to fetch templates');

        const templates = await response.json();
        
        // 调试：在浏览器控制台打印出来，看看有没有数据
        console.log("从后台获取到的模板:", templates);

        // 如果数组为空，手动加几个备用选项（防止空白）
        if (templates.length === 0) {
             templateSelect.innerHTML = `
                <option value="" disabled selected>No templates in DB</option>
                <option value="daily">Daily Report (Backup)</option>
                <option value="weekly">Weekly Report (Backup)</option>
             `;
             return;
        }

        // 正常渲染
        templateSelect.innerHTML = '<option value="" disabled selected>Select a Report Type...</option>';
        
        // 简单的按 title 排序
        templates.forEach(t => {
            const option = document.createElement('option');
            option.value = t._id; // 这里的 ID 传给后端
            option.textContent = t.title; // 显示给用户看
            if (t.isPro) option.textContent += " (Pro)";
            templateSelect.appendChild(option);
        });

    } catch (error) {
        console.error('Template Load Error:', error);
        templateSelect.innerHTML = '<option value="" disabled selected>Error loading templates</option>';
    }
}

    // 渲染下拉菜单 (支持分组)
    function renderTemplateDropdown(templates) {
        if (!templateSelect) return;
        templateSelect.innerHTML = '<option value="" disabled selected>Select a Report Type...</option>';
        
        // 分组逻辑
        const groups = {};
        templates.forEach(t => {
            const cat = t.category || 'Custom'; // 默认 Custom
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(t);
        });

        // 渲染分组
        for (const [category, items] of Object.entries(groups)) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = category; 
            
            items.forEach(t => {
                const option = document.createElement('option');
                option.value = t._id;
                // Pro 锁图标
                const lock = (t.isPro && currentUserPlan !== 'pro') ? '🔒 ' : '';
                option.textContent = `${lock}${t.title}`;
                optgroup.appendChild(option);
            });
            templateSelect.appendChild(optgroup);
        }
    }

    // 页面加载时执行初始化
    (async () => {
        await fetchUserPlan();
        await loadTemplates();
    })();


    // --- 4. 动态表单构建器 (核心) ---
    if (templateSelect) {
        templateSelect.addEventListener('change', () => {
            if (!dynamicInputsContainer) return;
            
            const selectedId = templateSelect.value;
            const template = allTemplates.find(t => t._id === selectedId);
            
            // 清空
            dynamicInputsContainer.innerHTML = '';
            if(promptTextarea) promptTextarea.value = '';
            
            if (!template) return;

            // 权限提示
            if (template.isPro && currentUserPlan !== 'pro') {
                alert(`This is a PRO template. Please upgrade to use it.`);
            }

            // 生成输入框
            if (template.variables && template.variables.length > 0) {
                // 修改大文本框提示
                const mainLabel = document.querySelector('label[for="prompt"]');
                if(mainLabel) mainLabel.textContent = "Additional Notes (Optional)";
                if(promptTextarea) promptTextarea.placeholder = "Any extra details...";

                template.variables.forEach(variable => {
                    const wrapper = document.createElement('div');
                    wrapper.className = 'input-wrapper';
                    wrapper.style.marginBottom = '15px';
                    
                    const label = document.createElement('label');
                    label.textContent = variable.label || variable.id;
                    label.style.display = 'block';
                    label.style.fontWeight = '500';
                    label.style.marginBottom = '5px';

                    let input;
                    if (variable.type === 'textarea') {
                        input = document.createElement('textarea');
                        input.rows = 3;
                    } else {
                        input = document.createElement('input');
                        input.type = 'text';
                    }
                    input.className = 'dynamic-input'; // 用于收集数据
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
                // 普通模板恢复
                const mainLabel = document.querySelector('label[for="prompt"]');
                if(mainLabel) mainLabel.textContent = "Key points for the report";
                if(promptTextarea) promptTextarea.placeholder = "Enter your details here...";
            }
        });
    }


  // --- 🟢 [修改] 生成报告核心逻辑 (修复版 + Toast) ---
    if (generateBtn) {
        // 使用 cloneNode 移除旧监听器，防止冲突
        const newGenerateBtn = generateBtn.cloneNode(true);
        generateBtn.parentNode.replaceChild(newGenerateBtn, generateBtn);

        newGenerateBtn.addEventListener('click', async () => {
            const token = localStorage.getItem('token'); 
            if (!token) {
                showToast('Please log in first.', 'error'); 
                if (typeof openModal === 'function') openModal('login'); 
                return;
            }

            // 收集数据
            const inputs = {};
            const dynamicEls = document.querySelectorAll('.dynamic-input');
            dynamicEls.forEach(el => { if(el.dataset.key) inputs[el.dataset.key] = el.value; });

            const mainPrompt = promptTextarea ? promptTextarea.value.trim() : "";
            if (dynamicEls.length === 0 && !mainPrompt) {
                showToast('Please enter some content.', 'error');
                return;
            }

            // UI 加载状态
            const originalText = newGenerateBtn.textContent;
            newGenerateBtn.disabled = true;
            newGenerateBtn.textContent = 'Generating...';
            if (resultBox) {
                if (resultBox.tagName === 'TEXTAREA') resultBox.value = "AI is thinking... (This may take a few seconds)";
                else resultBox.innerText = "AI is thinking... (This may take a few seconds)";
            }

            try {
                // 构建 Payload (注意: userPrompt 对应后端 v16)
                const payload = {
                    userPrompt: mainPrompt, 
                    role: roleSelect ? roleSelect.value : "General",
                    tone: toneSelect ? toneSelect.value : "Professional",
                    language: languageSelect ? languageSelect.value : "English",
                    detailLevel: detailLevelSelect ? detailLevelSelect.value : "Standard",
                    templateId: templateSelect ? templateSelect.value : "",
                    inputs: inputs
                };

                const API_URL = 'https://api.goreportify.com'; 
                const res = await fetch(`${API_URL}/api/generate`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}` 
                    },
                    body: JSON.stringify(payload),
                });

                const data = await res.json();

                // 错误拦截 (使用 Toast 替代 alert)
                if (res.status === 403) {
                    showToast(`🚫 Limit Reached: ${data.error}`, 'error');
                    if(resultBox) resultBox.value = "Generation failed: Quota exceeded.";
                    return;
                }
                if (res.status === 400) {
                    showToast(`⚠️ Input Error: ${data.error}`, 'error');
                    if(resultBox) resultBox.value = "Generation failed: Input error.";
                    return;
                }
                if (!res.ok) throw new Error(data.error || 'Server Internal Error');

                // 成功
                if (resultBox) {
                    if (resultBox.tagName === 'TEXTAREA') {
                        resultBox.value = data.generatedText;
                        resultBox.style.height = 'auto'; 
                        resultBox.style.height = resultBox.scrollHeight + 'px';
                    } else {
                        resultBox.innerText = data.generatedText;
                    }
                }
                showToast("Report Generated Successfully!", "success");

            } catch (err) {
                console.error("Generate Error:", err);
                showToast(`Generation Failed: ${err.message}`, 'error');
                if(resultBox) resultBox.value = "Error occurred.";
            } finally {
                newGenerateBtn.disabled = false;
                newGenerateBtn.textContent = originalText;
            }
        });
    }


    // --- 6. 复制 / 导出 / UI 交互 (原样保留) ---
    if (copyBtn && resultBox) {
        copyBtn.addEventListener('click', () => {
            const textToCopy = resultBox.innerText;
            if (!textToCopy) return;
            navigator.clipboard.writeText(textToCopy).then(() => {
                const original = copyBtn.innerText;
                copyBtn.innerText = 'Copied!';
                setTimeout(() => { copyBtn.innerText = original; }, 2000);
            });
        });
    }

    // --- 🟢 [修改] 导出功能 (Word/PDF 增强版 + Toast) ---
    if (exportButtons && resultBox) {
        exportButtons.forEach(button => {
            button.addEventListener('click', () => {
                const format = button.dataset.format || button.textContent.trim();
                let text = resultBox.tagName === 'TEXTAREA' ? resultBox.value : resultBox.innerText;

                if (!text || text.includes('AI is thinking') || text.length < 5) {
                    showToast('Please generate a report first.', 'error');
                    return;
                }

                const filename = `Reportify_${new Date().toISOString().slice(0,10)}`;

                // 1. Word 导出
                if (format.includes('Word')) {
                    if (typeof docx === 'undefined') { showToast("Word library loading...", "error"); return; }
                    const lines = text.split('\n');
                    const docChildren = [
                        new docx.Paragraph({ 
                            children: [new docx.TextRun({ text: "Generated Report", bold: true, size: 32 })],
                            spacing: { after: 400 }
                        })
                    ];
                    lines.forEach(line => {
                        if(line.trim()) {
                            docChildren.push(new docx.Paragraph({
                                children: [new docx.TextRun({ text: line, size: 24 })],
                                spacing: { after: 200 }
                            }));
                        }
                    });
                    const doc = new docx.Document({ sections: [{ children: docChildren }] });
                    docx.Packer.toBlob(doc).then(blob => {
                        downloadFile(blob, `${filename}.docx`);
                        showToast("Word document downloaded!", "success");
                    });
                }
                // 2. PDF 导出
                else if (format.includes('PDF')) {
                    if (typeof html2pdf === 'undefined') { showToast("PDF library loading...", "error"); return; }
                    const element = document.createElement('div');
                    element.style.padding = '20px';
                    element.style.fontFamily = 'Arial';
                    element.innerHTML = `<h2>Reportify AI Report</h2><hr><div style="white-space: pre-wrap;">${text}</div>`;
                    html2pdf().from(element).save(`${filename}.pdf`);
                    showToast("PDF downloaded!", "success");
                } 
                // 3. Markdown 导出
                else {
                    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
                    downloadFile(blob, `${filename}.md`);
                    showToast("Markdown downloaded!", "success");
                }
            });
        });
    }

    if (allLinks) {
        allLinks.forEach(link => {
            link.addEventListener('click', function (e) {
                const targetId = this.getAttribute('href');
                if (targetId && targetId.startsWith('#')) {
                    e.preventDefault();
                    const targetElement = document.querySelector(targetId);
                    if (targetElement) targetElement.scrollIntoView({ behavior: 'smooth' });
                }
            });
        });
    }

    if (contactForm && formStatus) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            formStatus.textContent = 'Thank you! Message sent.';
            formStatus.className = 'success';
            contactForm.reset();
            setTimeout(() => { formStatus.textContent = ''; }, 4000);
        });
    }


    // --- 7. 弹窗与登录注册逻辑 ---
    function openModal(tabToShow = 'login') {
        if (!authModalOverlay) return; 
        authModalOverlay.classList.remove('hidden');
        authTabs.forEach(tab => tab.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        const activeTabLink = document.querySelector(`.tab-link[data-tab="${tabToShow}"]`);
        const activeTabContent = document.getElementById(tabToShow);
        if(activeTabLink) activeTabLink.classList.add('active');
        if(activeTabContent) activeTabContent.classList.add('active');
    }
    function closeModal() {
        if (!authModalOverlay) return;
        authModalOverlay.classList.add('hidden');
    }
    
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    if (authModalOverlay) {
        authModalOverlay.addEventListener('click', (e) => {
            if (e.target === authModalOverlay) closeModal();
        });
    }
    if (authTabs) {
        authTabs.forEach(tab => {
            tab.addEventListener('click', () => openModal(tab.dataset.tab));
        });
    }

   // --- 新版注册逻辑 (包含强力校验) ---
    // 重新获取元素，确保 ID 对应正确
    const signupFormNew = document.getElementById('signup-form');

    if (signupFormNew) {
        // 使用 cloneNode 移除所有旧的监听器，防止冲突
        const newForm = signupFormNew.cloneNode(true);
        signupFormNew.parentNode.replaceChild(newForm, signupFormNew);

        newForm.addEventListener('submit', async (e) => {
            // 1. 阻止默认提交 (最关键的一步)
            e.preventDefault();
            
            const submitBtn = newForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.textContent;

            // 获取输入值
            const nameVal = document.getElementById('signup-name').value;
            const emailVal = document.getElementById('signup-email').value;
            const passVal = document.getElementById('signup-password').value;

            // --- 校验 A: 姓名 (2-50位，允许空格) ---
            if (nameVal.length < 2 || nameVal.length > 50) {
                alert("Name Format Error: Name must be between 2 and 50 characters.");
                return; // ⛔ 停止运行
            }

            // --- 校验 B: 邮箱 (必须包含 @ 和 .) ---
            // 比如 '2222@sadsa. d' 会因为有空格或者格式不对被拦截
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(emailVal)) {
                alert("Invalid Email Format:\nPlease check for spaces and ensure it looks like 'user@domain.com'.");
                return; // ⛔ 停止运行
            }

            // --- 校验 C: 密码 (8位以上，含数字和大写) ---
            const isStrong = /[A-Z]/.test(passVal) && /[0-9]/.test(passVal) && passVal.length >= 8;
            if (!isStrong) {
                alert("Weak Password:\n- At least 8 characters\n- One Uppercase letter (A-Z)\n- One Number (0-9)");
                return; // ⛔ 停止运行
            }

            // --- 校验通过，发送请求 ---
            submitBtn.disabled = true;
            submitBtn.textContent = 'Creating Account...';

            try {
                // 确保 API 地址正确
                const API_URL = 'https://api.goreportify.com'; 

                const res = await fetch(`${API_URL}/api/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        displayName: nameVal,
                        email: emailVal,
                        password: passVal
                    }),
                });

                const data = await res.json();
                
                if (!res.ok) {
                    throw new Error(data.message || 'Registration failed');
                }

                alert('✅ Account Created Successfully! Please Login.');
                
                // 自动切换到登录页面
                const authModal = document.getElementById('auth-modal-overlay');
                if(authModal && !authModal.classList.contains('hidden')) {
                    // 如果在弹窗里，切换 Tab
                    const loginTab = document.querySelector('.tab-link[data-tab="login"]');
                    if(loginTab) loginTab.click();
                }
                newForm.reset();

            } catch (err) {
                alert(`Registration Error: ${err.message}`);
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = originalBtnText;
            }
        });
    }

    // 登录
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.textContent;
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
                if (!res.ok) throw new Error(data.message || 'Error');
                if (!data.token) throw new Error('No token received');
                
                localStorage.setItem('token', data.token);
                closeModal(); 
                
                // 登录成功后，刷新导航并加载模板
                if (window.updateUserNav) window.updateUserNav(data.user); 
                loadTemplates(); 
                fetchUserPlan(); // 刷新 Plan 状态
                
                loginForm.reset(); 
            } catch (err) {
                alert(`Login failed: ${err.message}`);
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = originalBtnText;
            }
        });
    }

    // Google 登录占位
    if (socialLoginButtons) {
        socialLoginButtons.forEach(btn => {
            btn.addEventListener('click', () => alert('Google login coming soon!'));
        });
    }

    // PayPal 错误占位
    if (typeof window.paypal === 'undefined') {
        document.querySelectorAll('.paypal-button-container').forEach(el => el.innerHTML = '<p style="color:orange; font-size: small;">Payment gateway loading error.</p>');
    }
});

// --- [修复版] 交互：点击切换蓝色边框 (放在 script.js 最底部) ---
document.addEventListener('DOMContentLoaded', () => {
    const pricingCards = document.querySelectorAll('.pricing-card');
    if (pricingCards.length > 0) {
        pricingCards.forEach(card => {
            card.addEventListener('click', (e) => {
                // 如果点的是按钮或链接，不触发卡片选中效果
                if (e.target.closest('button') || e.target.closest('a')) return;
                
                // 1. 移除所有卡片的激活状态
                pricingCards.forEach(c => c.classList.remove('plan-active'));
                
                // 2. 给当前点击的卡片加上激活状态
                card.classList.add('plan-active');
            });
        });
    }
});
