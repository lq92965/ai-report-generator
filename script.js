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
    const loginForm = document.getElementById('login').querySelector('form');
    const signupForm = document.getElementById('signup').querySelector('form');
    const socialLoginButtons = document.querySelectorAll('.btn-social-google');
    
    // PayPal 相關按鈕
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

    function updateUserNav() {
        headerActions.innerHTML = '';
        if (token) {
            const myAccountBtn = document.createElement('a');
            myAccountBtn.href = '#'; // Placeholder for account page
            myAccountBtn.className = 'btn btn-secondary';
            myAccountBtn.textContent = 'My Account';
            
            const logoutBtn = document.createElement('a');
            logoutBtn.href = '#';
            logoutBtn.className = 'btn btn-primary';
            logoutBtn.textContent = 'Logout';

            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                token = null;
                localStorage.removeItem('token');
                updateUserNav();
                alert('You have been logged out.');
            });

            headerActions.appendChild(myAccountBtn);
            headerActions.appendChild(logoutBtn);
        } else {
            const loginBtn = document.createElement('a');
            loginBtn.href = '#';
            loginBtn.className = 'btn btn-secondary';
            loginBtn.textContent = 'Login';
            
            const signupBtn = document.createElement('a');
            signupBtn.href = '#';
            signupBtn.className = 'btn btn-primary';
            signupBtn.textContent = 'Sign Up';

            loginBtn.addEventListener('click', (e) => {
                e.preventDefault();
                openModal('login');
            });
            signupBtn.addEventListener('click', (e) => {
                e.preventDefault();
                openModal('signup');
            });

            headerActions.appendChild(loginBtn);
            headerActions.appendChild(signupBtn);
        }
    }

    // --- Main Generation Logic with Login Check ---
    generateBtn.addEventListener('click', async () => {
        if (!token) {
            alert('Please log in or sign up to generate a report.');
            openModal('login');
            return;
        }
        const allOptions = {
            userPrompt: promptTextarea.value,
            template: templateSelect.value,
            detailLevel: detailLevelSelect.value,
            role: roleSelect.value,
            tone: toneSelect.value,
            language: languageSelect.value,
        };
        if (!allOptions.userPrompt.trim()) {
            alert('Please enter your key points first.');
            return;
        }
        generateBtn.disabled = true;
        resultBox.innerHTML = '<div class="loader"></div>';
        resultBox.style.color = 'var(--text-primary)';
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
                // Try to get error message from backend if available
                let errorMsg = `HTTP error! status: ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.error || errorMsg;
                } catch(e) { /* Ignore if response is not JSON */ }
                throw new Error(errorMsg);
            }
            const data = await response.json();
            resultBox.innerText = data.generatedText;
        } catch (error) {
            console.error('Error calling generate API:', error);
            resultBox.innerText = `Failed to generate report. ${error.message}. Please try again later.`;
            resultBox.style.color = 'red';
        } finally {
            generateBtn.disabled = false;
        }
    });

    // --- Copy Button Logic ---
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

    // --- Export Buttons Logic ---
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
                // **Important**: PDF export should ideally check user's plan status from backend
                // For now, we rely on the button class for the "Pro" check
                if (button.classList.contains('premium-feature')) { 
                    // In a real app, check if user.plan === 'pro'
                    // For demo, we just show the alert
                     alert(`PDF export is a Pro feature. Please upgrade your plan.`);
                     return; 
                     // If user *was* Pro, the code below would run:
                     // const { jsPDF } = window.jspdf;
                     // const doc = new jsPDF();
                     // const splitText = doc.splitTextToSize(text, 180);
                     // doc.text(splitText, 10, 10);
                     // doc.save(`${filename}.pdf`);
                } else {
                     // Non-pro users trying PDF (should ideally not happen if button disabled, but as fallback)
                     alert(`PDF export is a Pro feature. Please upgrade your plan.`);
                }

            } else if (format === 'Markdown') {
                const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
                downloadFile(blob, `${filename}.md`);
            } else if (format === 'Word') {
                try {
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

    // --- UI Interaction Logic (Smooth Scroll, Pricing Cards) ---
    allLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                targetElement.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });
    pricingCards.forEach(card => {
        card.addEventListener('click', () => {
            // Only add selection logic if it's not the free card's link being clicked
            if (!card.querySelector('a[href="#generator"]')) {
                pricingCards.forEach(c => c.classList.remove('selected-plan'));
                card.classList.add('selected-plan');
            }
        });
    });

    // --- Enhanced Contact Form Validation ---
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailInput) { // Check if element exists before adding listener
        emailInput.addEventListener('input', () => {
            if (emailInput.value && !emailRegex.test(emailInput.value)) {
                emailError.textContent = 'Please enter a valid email format.';
            } else {
                emailError.textContent = '';
            }
        });
    }

    if (contactForm) { // Check if element exists
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('name').value;
            const email = emailInput.value;
            const message = document.getElementById('message').value;

            formStatus.textContent = '';
            formStatus.className = '';
            if(emailError) emailError.textContent = '';

            if (!name.trim() || !email.trim() || !message.trim()) {
                formStatus.textContent = 'Please fill in all required fields.';
                formStatus.classList.add('error');
                return;
            }

            if (!emailRegex.test(email)) {
                if(emailError) emailError.textContent = 'Please enter a valid email format.';
                // Also show general error
                formStatus.textContent = 'Please correct the errors before submitting.';
                formStatus.classList.add('error');
                return;
            }

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
        if (!authModalOverlay) return; // Exit if modal doesn't exist
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
    
    // Add listeners only if elements exist
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
            const originalBtnText = submitBtn.textContent;
            
            submitBtn.disabled = true;
            submitBtn.textContent = 'Creating Account...';

            const name = document.getElementById('signup-name').value;
            const email = document.getElementById('signup-email').value;
            const password = document.getElementById('signup-password').value;
            try {
                const res = await fetch(`${API_BASE_URL}/api/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, password }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || 'Unknown error');
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
            const originalBtnText = submitBtn.textContent;

            submitBtn.disabled = true;
            submitBtn.textContent = 'Logging In...';

            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            try {
                const res = await fetch(`${API_BASE_URL}/api/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || 'Unknown error');
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
    if (choosePlanButtons) {
        choosePlanButtons.forEach(button => {
            const planId = button.dataset.planId;
            const amount = button.dataset.amount;
            const containerId = `#paypal-button-container-${planId}`;
            const containerElement = document.querySelector(containerId);

            if (!containerElement) {
                console.warn(`PayPal container ${containerId} not found.`);
                return; // Skip if container doesn't exist
            }

            // Hide original button, prepare for PayPal button
            button.style.display = 'none'; 
            
            try {
                // Ensure paypal object is available
                if (typeof paypal === 'undefined') {
                    console.error('PayPal SDK not loaded.');
                    containerElement.innerHTML = '<p style="color:red;">Error loading payment options.</p>';
                    return;
                }

                paypal.Buttons({
                    createOrder: function(data, actions) {
                        // Set up the transaction details
                        return actions.order.create({
                            purchase_units: [{
                                amount: {
                                    value: amount // Get amount from button data
                                }
                            }]
                        });
                    },
                    onApprove: function(data, actions) {
                        // Capture the funds from the transaction
                        return actions.order.capture().then(function(details) {
                            // **IMPORTANT**: Actions after successful payment
                            // Show success message, or ideally,
                            // send confirmation to your backend to verify and update user status
                            alert('Transaction completed by ' + details.payer.name.given_name + '! Payment successful.');
                            
                            // Example: Send confirmation to backend
                            // fetch(`${API_BASE_URL}/api/payment/success`, {
                            //     method: 'POST',
                            //     headers: { 
                            //        'Content-Type': 'application/json',
                            //        'Authorization': `Bearer ${token}` 
                            //     },
                            //     body: JSON.stringify({ orderId: data.orderID, plan: planId })
                            // });
                        });
                    },
                    onError: function(err) {
                        // Handle errors
                        console.error("PayPal button error:", err);
                        alert("An error occurred with the payment. Please try again or contact support.");
                    }
                }).render(containerId); // Render the button into the container div
            } catch (error) {
                 console.error("Error rendering PayPal button:", error);
                 containerElement.innerHTML = '<p style="color:red;">Could not load payment options.</p>';
            }
        });
    }


    // --- Initialization ---
    updateUserNav(); // Update nav based on initial login state
});