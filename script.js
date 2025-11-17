/*
 * ===================================================================
 * * Reportify AI - script.js (主页完整版)
 * * 修复内容: 删除了所有重复的 updateUserNav 函数，解决双头像问题。
 * ===================================================================
*/
document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = 'https://api.goreportify.com'; 

    // --- 1. DOM 元素选择器 (已修复 ID) ---
    const generateBtn = document.getElementById('generate-btn');
    const copyBtn = document.getElementById('copy-btn');
    const resultBox = document.getElementById('result');
    const exportButtons = document.querySelectorAll('.export-btn');
    const promptTextarea = document.getElementById('prompt');
    const templateSelect = document.getElementById('template');
    const detailLevelSelect = document.getElementById('detail-level');
    const roleSelect = document.getElementById('role');
    const toneSelect = document.getElementById('tone');
    const languageSelect = document.getElementById('language');
    const allLinks = document.querySelectorAll('a[href^="#"]');
    const contactForm = document.getElementById('contact-form');
    const pricingCards = document.querySelectorAll('.pricing-card');
    const formStatus = document.getElementById('form-status');
    const emailInput = document.getElementById('email');
    const emailError = document.getElementById('email-error');
    const authModalOverlay = document.getElementById('auth-modal-overlay');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const authTabs = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');
    // (!!!) 确保这里使用的是 index.html 中修正后的 ID
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const socialLoginButtons = document.querySelectorAll('.btn-social-google');
    const choosePlanButtons = document.querySelectorAll('.choose-plan-btn');

    // --- 2. 辅助函数 ---
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

    // --- 3. 覆盖导航栏逻辑 (只针对主页) ---
    // nav.js 负责画导航栏，但主页点击“登录”需要打开弹窗，而不是跳转。
    // 所以我们在这里覆盖 showLoggedOutNav 函数。
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

    // (!!!) 关键: 再次调用全局导航，以应用上面的覆盖
    if (window.updateUserNav) window.updateUserNav();

    // --- 4. AI 生成器逻辑 ---
    if (generateBtn) {
        generateBtn.addEventListener('click', async () => {
            const token = localStorage.getItem('token'); 
            if (!token) {
                alert('Please log in or sign up to generate a report.');
                openModal('login');
                return;
            }
            const allOptions = {
                userPrompt: promptTextarea?.value || '',
                template: templateSelect?.value || '',
                detailLevel: detailLevelSelect?.value || '',
                role: roleSelect?.value || '',
                tone: toneSelect?.value || '',
                language: languageSelect?.value || '',
            };
            if (!allOptions.userPrompt.trim()) {
                alert('Please enter your key points first.');
                return;
            }
            generateBtn.disabled = true;
            if (resultBox) {
                resultBox.innerHTML = '<div class="loader"></div>';
                resultBox.style.color = 'var(--text-primary)';
            }
            try {
                const response = await fetch(`${API_BASE_URL}/api/generate`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(allOptions),
                });
                if (!response.ok) {
                    let errorMsg = `HTTP error! status: ${response.status}`;
                    try { const errorData = await response.json(); errorMsg = errorData.error || errorData.message || errorMsg; } catch (e) {}
                    throw new Error(errorMsg);
                }
                const data = await response.json();
                if(resultBox) resultBox.innerText = data.generatedText;
            } catch (error) {
                console.error('Error calling generate API:', error);
                if (resultBox) {
                    resultBox.innerText = `Failed to generate report. ${error.message}. Please try again later.`;
                    resultBox.style.color = 'red';
                }
            } finally {
                generateBtn.disabled = false;
            }
        });
    }

    // --- 5. 复制 / 导出 / UI 逻辑 ---
    if (copyBtn && resultBox) {
        copyBtn.addEventListener('click', () => {
            const textToCopy = resultBox.innerText;
            navigator.clipboard.writeText(textToCopy).then(() => {
                const originalText = copyBtn.innerText;
                copyBtn.innerText = 'Copied!';
                setTimeout(() => { copyBtn.innerText = originalText; }, 2000);
            });
        });
    }

    if (exportButtons && resultBox) {
        exportButtons.forEach(button => {
            button.addEventListener('click', () => {
                const token = localStorage.getItem('token');
                if (!token) {
                    alert('Please log in or sign up to export a report.');
                    openModal('login');
                    return;
                }
                const format = button.dataset.format;
                const text = resultBox.innerText;
                const filename = `report-${new Date().toISOString().split('T')[0]}`;

                if (!text || text.includes('The generated report will appear here')) {
                    alert('Please generate a valid report first before exporting.');
                    return;
                }

                if (format === 'PDF') {
                    alert(`PDF export is a Pro feature. Please upgrade your plan.`);
                } else if (format === 'Markdown') {
                    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
                    downloadFile(blob, `${filename}.md`);
                } else if (format === 'Word') {
                    if (typeof docx === 'undefined') {
                        alert("Word export library not loaded."); return;
                    }
                    const paragraphs = text.split('\n').map(p => new docx.Paragraph({ children: [new docx.TextRun(p)] }));
                    const doc = new docx.Document({ sections: [{ children: paragraphs }] });
                    docx.Packer.toBlob(doc).then(blob => { downloadFile(blob, `${filename}.docx`); });
                }
            });
        });
    }

    // 平滑滚动
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

    // 联系表单
    if (contactForm && formStatus) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            formStatus.textContent = 'Thank you! Message sent.';
            formStatus.className = 'success';
            contactForm.reset();
            setTimeout(() => { formStatus.textContent = ''; }, 4000);
        });
    }

    // --- 6. 登录/注册 弹窗逻辑 ---
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
            tab.addEventListener('click', () => {
                const tabToShow = tab.dataset.tab;
                openModal(tabToShow);
            });
        });
    }
    
    // --- 7. 注册 API 调用 ---
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = signupForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = 'Creating Account...';
            
            // 这里的 ID 必须与 index.html 中的 input id 匹配
            const nameInput = document.getElementById('signup-name');
            const emailInput = document.getElementById('signup-email');
            const passwordInput = document.getElementById('signup-password');
            
            try {
                const res = await fetch(`${API_BASE_URL}/api/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ displayName: nameInput.value, email: emailInput.value, password: passwordInput.value }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || 'Error');
                alert('Registration successful! Please log in.');
                openModal('login');
                signupForm.reset(); 
            } catch (err) {
                alert(`Registration failed: ${err.message}`);
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = originalBtnText;
            }
        });
    }

    // --- 8. 登录 API 调用 ---
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
                
                // 保存 token
                localStorage.setItem('token', data.token);
                closeModal(); 
                
                // (!!!) 登录成功后，立即刷新导航栏
                if (window.updateUserNav) window.updateUserNav(data.user); 
                
                loginForm.reset(); 
            } catch (err) {
                alert(`Login failed: ${err.message}`);
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = originalBtnText;
            }
        });
    }

    // PayPal 错误处理占位
    if (typeof window.paypal === 'undefined') {
        document.querySelectorAll('.paypal-button-container').forEach(el => el.innerHTML = '<p style="color:orange; font-size: small;">Payment gateway loading error.</p>');
    }
});
