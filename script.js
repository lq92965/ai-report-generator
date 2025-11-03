document.addEventListener('DOMContentLoaded', () => {
    // --- 用户状态管理 ---
    let token = localStorage.getItem('token');
    const API_BASE_URL = 'https://api.goreportify.com'; 

    // --- Element Selectors ---
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
    const headerActions = document.querySelector('.header-actions');
    const authModalOverlay = document.getElementById('auth-modal-overlay');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const authTabs = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');
    const loginForm = document.getElementById('login')?.querySelector('form'); // Added safety check
    const signupForm = document.getElementById('signup')?.querySelector('form'); // Added safety check
    const socialLoginButtons = document.querySelectorAll('.btn-social-google');
    const choosePlanButtons = document.querySelectorAll('.choose-plan-btn');

    // --- Helper Functions ---
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

  // --- (确保 API_BASE_URL 和 token 在这个函数外面或顶部已经定义了) ---
// const API_BASE_URL = 'https://api.goreportify.com'; 
// const token = localStorage.getItem('token');
// -------------------------------------------------------------------

/**
 * 动态更新导航栏 (主页版本)
 * - 如果登录了，显示用户名和 "Logout"
 * - 如果没登录，显示 "Login" 和 "Get Started"
 */
async function updateUserNav() {
  const headerActions = document.querySelector('.header-actions');
  if (!headerActions) return;
  headerActions.innerHTML = ''; // 清空所有旧按钮

  const token = localStorage.getItem('token'); // 再次获取 token 状态

  if (token) {
    // --- 用户已登录 ---
    try {
      // (确保 API_BASE_URL 在这个文件的顶部已经定义了)
      const response = await fetch(`${API_BASE_URL}/api/user/profile`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch user');
      const user = await response.json();
      
      // 创建新的“用户名”链接
      const userNameLink = document.createElement('a');
      userNameLink.href = 'account.html';
      userNameLink.className = 'btn btn-secondary';
      userNameLink.textContent = user.name || user.email.split('@')[0];
      
      // 创建新的“退出登录”按钮
      const logoutBtn = document.createElement('button');
      logoutBtn.className = 'btn'; // (您的模板页用的是 .btn, 我们保持一致)
      logoutBtn.textContent = 'Logout';
      logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('token');
        updateUserNav(); // 退出登录后，立即刷新导航栏
      });

      headerActions.appendChild(userNameLink);
      headerActions.appendChild(logoutBtn);

    } catch (error) {
      // Token 无效或获取失败，当作“未登录”处理
      localStorage.removeItem('token');
      showLoggedOutNav(headerActions);
    }
  } else {
    // --- 用户未登录 ---
    showLoggedOutNav(headerActions);
  }
}

/**
 * (辅助函数) 显示“未登录”状态的按钮
 * (我们现在使用从 index.html 里找到的【正确】链接)
 */
function showLoggedOutNav(headerActions) {
  headerActions.innerHTML = `
    <a href="account.html" class="btn btn-secondary">Login</a>
    <a href="#generator" class="btn btn-primary">Get Started</a>
  `;
}
    
    // --- Main Generation Logic with Login Check ---
    if (generateBtn) {
        generateBtn.addEventListener('click', async () => {
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
                    try {
                        const errorData = await response.json();
                        errorMsg = errorData.error || errorData.message || errorMsg;
                    } catch(e) { /* Ignore if response is not JSON */ }
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


    // --- Copy Button Logic ---
    if (copyBtn && resultBox) {
        copyBtn.addEventListener('click', () => {
            const textToCopy = resultBox.innerText;
            if (textToCopy && textToCopy !== 'The generated report will appear here...' && !textToCopy.startsWith('Failed to generate report')) {
                navigator.clipboard.writeText(textToCopy).then(() => {
                    const originalText = copyBtn.innerText;
                    copyBtn.innerText = 'Copied!';
                    setTimeout(() => { copyBtn.innerText = originalText; }, 2000);
                }).catch(err => {
                    console.error('Failed to copy text: ', err);
                    alert('Failed to copy text.');
                });
            } else {
                alert('Nothing to copy yet. Please generate a report first.');
            }
        });
    }

    // --- Export Buttons Logic ---
    if (exportButtons && resultBox) {
        exportButtons.forEach(button => {
            button.addEventListener('click', () => {
                if (!token) {
                    alert('Please log in or sign up to export a report.');
                    openModal('login');
                    return;
                }

                const format = button.dataset.format;
                const text = resultBox.innerText;
                const filename = `report-${new Date().toISOString().split('T')[0]}`;

                if (!text || text === 'The generated report will appear here...' || text.startsWith('Failed to generate report')) {
                    alert('Please generate a valid report first before exporting.');
                    return;
                }

                if (format === 'PDF') {
                    if (button.classList.contains('premium-feature')) { 
                         alert(`PDF export is a Pro feature. Please upgrade your plan.`);
                         return; 
                    } else {
                         alert(`PDF export is a Pro feature. Please upgrade your plan.`);
                    }
                } else if (format === 'Markdown') {
                    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
                    downloadFile(blob, `${filename}.md`);
                } else if (format === 'Word') {
                    try {
                        // Ensure docx is loaded
                        if (typeof docx === 'undefined') {
                            alert("Word export library not loaded. Please refresh.");
                            console.error("docx library is not defined.");
                            return;
                        }
                        const paragraphs = text.split('\n').map(p => new docx.Paragraph({ children: [new docx.TextRun(p)] }));
                        const doc = new docx.Document({
                            sections: [{ children: paragraphs }],
                        });
                        docx.Packer.toBlob(doc).then(blob => {
                            downloadFile(blob, `${filename}.docx`);
                        }).catch(err => {
                             console.error("Error creating Word document:", err);
                             alert("Failed to generate Word file.");
                        });
                    } catch (err) {
                        console.error("Error with docx library:", err);
                        alert("Failed to generate Word file due to library error.");
                    }
                }
            });
        });
    }

    // --- UI Interaction Logic (Smooth Scroll, Pricing Cards) ---
    if (allLinks) {
        allLinks.forEach(link => {
            link.addEventListener('click', function(e) {
                const targetId = this.getAttribute('href');
                // Only prevent default for internal links
                if (targetId && targetId.startsWith('#')) {
                    e.preventDefault();
                    const targetElement = document.querySelector(targetId);
                    if (targetElement) {
                        targetElement.scrollIntoView({ behavior: 'smooth' });
                    }
                }
            });
        });
    }
    if (pricingCards) {
        pricingCards.forEach(card => {
            card.addEventListener('click', (e) => {
                // Prevent selection logic if clicking the button/link inside
                if (e.target.closest('a') || e.target.closest('button') || e.target.closest('.paypal-button-container')) {
                    return;
                }
                pricingCards.forEach(c => c.classList.remove('selected-plan'));
                card.classList.add('selected-plan');
            });
        });
    }

    // --- Enhanced Contact Form Validation ---
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailInput && emailError) { 
        emailInput.addEventListener('input', () => {
            if (emailInput.value && !emailRegex.test(emailInput.value)) {
                emailError.textContent = 'Please enter a valid email format.';
            } else {
                emailError.textContent = '';
            }
        });
    }

    if (contactForm && formStatus) { 
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const nameInput = document.getElementById('name');
            const messageInput = document.getElementById('message');
            
            const name = nameInput ? nameInput.value : '';
            const email = emailInput ? emailInput.value : '';
            const message = messageInput ? messageInput.value : '';

            formStatus.textContent = '';
            formStatus.className = '';
            if(emailError) emailError.textContent = '';

            let hasError = false;
            if (!name.trim() || !email.trim() || !message.trim()) {
                formStatus.textContent = 'Please fill in all required fields.';
                formStatus.classList.add('error');
                hasError = true;
            }

            if (email && !emailRegex.test(email)) {
                if(emailError) emailError.textContent = 'Please enter a valid email format.';
                if (!hasError) { // Don't overwrite the "fill all fields" message
                    formStatus.textContent = 'Please correct the errors before submitting.';
                    formStatus.classList.add('error');
                }
                hasError = true;
            }
            
            if (hasError) return;

            // --- If validation passes ---
            formStatus.textContent = 'Thank you for your feedback! Message sent successfully.';
            formStatus.classList.add('success');
            
            contactForm.reset();

            setTimeout(() => {
                formStatus.textContent = '';
                formStatus.className = '';
            }, 4000);
        });
    }


    // --- Login/Signup Modal Logic ---
    function openModal(tabToShow = 'login') {
        if (!authModalOverlay || !authTabs || !tabContents) return; // Safety check
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
    
    // --- Frontend to Backend API Calls with UI Feedback ---
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = signupForm.querySelector('button[type="submit"]');
            if (!submitBtn) return; // Safety check
            const originalBtnText = submitBtn.textContent;
            
            submitBtn.disabled = true;
            submitBtn.textContent = 'Creating Account...';

            const nameInput = document.getElementById('signup-name');
            const emailInput = document.getElementById('signup-email');
            const passwordInput = document.getElementById('signup-password');

            const name = nameInput ? nameInput.value : '';
            const email = emailInput ? emailInput.value : '';
            const password = passwordInput ? passwordInput.value : '';
            try {
                const res = await fetch(`${API_BASE_URL}/api/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, password }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || 'Unknown error during registration');
                alert('Registration successful! Please log in.');
                openModal('login');
                if(signupForm) signupForm.reset(); // Reset form on success
            } catch (err) {
                alert(`Registration failed: ${err.message}`);
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = originalBtnText;
            }
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = loginForm.querySelector('button[type="submit"]');
             if (!submitBtn) return; // Safety check
            const originalBtnText = submitBtn.textContent;

            submitBtn.disabled = true;
            submitBtn.textContent = 'Logging In...';
            
            const emailInput = document.getElementById('login-email');
            const passwordInput = document.getElementById('login-password');

            const email = emailInput ? emailInput.value : '';
            const password = passwordInput ? passwordInput.value : '';
            try {
                const res = await fetch(`${API_BASE_URL}/api/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || 'Unknown error during login');
                token = data.token;
                localStorage.setItem('token', token);
                alert(data.message);
                closeModal();
                updateUserNav();
                if(loginForm) loginForm.reset(); // Reset form on success
            } catch (err) {
                alert(`Login failed: ${err.message}`);
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = originalBtnText;
            }
        });
    }
    
    // Google Login placeholder
    if (socialLoginButtons) {
        socialLoginButtons.forEach(button => {
            button.addEventListener('click', () => {
                alert('Continue with Google feature is coming soon!');
            });
        });
    }

    // --- PayPal Button Rendering Logic ---
    if (choosePlanButtons && typeof paypal !== 'undefined') { // Check if paypal exists
        choosePlanButtons.forEach(button => {
            const planId = button.dataset.planId;
            const amount = button.dataset.amount;
            const containerId = `#paypal-button-container-${planId}`;
            const containerElement = document.querySelector(containerId);

            if (!containerElement) {
                console.warn(`PayPal container ${containerId} not found.`);
                button.style.display = 'block'; // Show original button if container missing
                return; 
            }

            // Hide original button, prepare for PayPal button
            button.style.display = 'none'; 
            
            try {
                paypal.Buttons({
                    createOrder: function(data, actions) {
                        // Check if logged in before creating order
                        if (!token) {
                            alert('Please log in or sign up before purchasing a plan.');
                            openModal('login');
                            return Promise.reject(new Error('User not logged in')); // Stop order creation
                        }
                        return actions.order.create({
                            purchase_units: [{
                                description: `Reportify AI - ${planId.charAt(0).toUpperCase() + planId.slice(1)} Plan`, // Add description
                                amount: {
                                    value: amount 
                                }
                            }]
                        });
                    },
                    onApprove: function(data, actions) {
                        return actions.order.capture().then(function(details) {
                            alert('Transaction completed by ' + details.payer.name.given_name + '! Payment successful. Your plan should be active shortly.');
                            // **TODO**: Send details.id (PayPal Order ID) and planId to your backend
                            // for verification and updating the user's subscription status.
                            console.log('Capture result', details); 
                            // Example backend call:
                            // fetch(`${API_BASE_URL}/api/paypal/capture`, {
                            //     method: 'POST',
                            //     headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                            //     body: JSON.stringify({ orderID: data.orderID, planId: planId })
                            // });
                        });
                    },
                    onError: function(err) {
                        console.error("PayPal button error:", err);
                        alert("An error occurred with the payment. Please try again or contact support.");
                    }
                }).render(containerId); 
            } catch (error) {
                 console.error("Error rendering PayPal button:", error);
                 containerElement.innerHTML = '<p style="color:red;">Could not load payment options.</p>';
                 button.style.display = 'block'; // Show original button if PayPal fails
            }
        });
    } else if (typeof paypal === 'undefined') {
        console.error('PayPal SDK script failed to load or is blocked.');
        // Optionally show original buttons if PayPal SDK fails
        choosePlanButtons.forEach(button => { button.style.display = 'block'; });
        document.querySelectorAll('.paypal-button-container').forEach(el => el.innerHTML = '<p style="color:orange; font-size: small;">Payment gateway loading error.</p>');
    }


    // --- Initialization ---
    updateUserNav(); // Update nav based on initial login state

});
