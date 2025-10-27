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
    
    // **新增: PayPal 相關按鈕**
    const choosePlanButtons = document.querySelectorAll('.choose-plan-btn');

    // --- Helper Functions ---
    // ... (downloadFile, updateUserNav 保持不變) ...
    function downloadFile(blob, filename) { /* ... */ }
    function updateUserNav() { /* ... */ }

    // --- Main Generation Logic with Login Check ---
    // ... (保持不變) ...
    generateBtn.addEventListener('click', async () => { /* ... */ });

    // --- 其他按鈕邏輯 (Copy, Export, Scroll, Pricing Selection, Contact) ---
    // ... (保持不變) ...
    copyBtn.addEventListener('click', () => { /* ... */ });
    exportButtons.forEach(button => { /* ... */ });
    allLinks.forEach(link => { /* ... */ });
    pricingCards.forEach(card => { /* ... */ });
    contactForm.addEventListener('submit', (e) => { /* ... */ });
    emailInput.addEventListener('input', () => { /* ... */ });


    // --- Login/Signup Modal Logic ---
    // ... (保持不變) ...
    function openModal(tabToShow = 'login') { /* ... */ }
    function closeModal() { /* ... */ }
    closeModalBtn.addEventListener('click', closeModal);
    authModalOverlay.addEventListener('click', (e) => { if (e.target === authModalOverlay) closeModal(); });
    authTabs.forEach(tab => { /* ... */ });
    signupForm.addEventListener('submit', async (e) => { /* ... */ });
    loginForm.addEventListener('submit', async (e) => { /* ... */ });
    socialLoginButtons.forEach(button => { /* ... */ });

    // --- **新增：PayPal 按鈕渲染邏輯** ---
    choosePlanButtons.forEach(button => {
        const planId = button.dataset.planId;
        const amount = button.dataset.amount;
        const containerId = `#paypal-button-container-${planId}`;

        // 隱藏原始按鈕，準備顯示 PayPal 按鈕
        button.style.display = 'none'; 
        
        paypal.Buttons({
            createOrder: function(data, actions) {
                // 設置交易詳情
                return actions.order.create({
                    purchase_units: [{
                        amount: {
                            value: amount // 從按鈕獲取金額
                        }
                    }]
                });
            },
            onApprove: function(data, actions) {
                // 捕獲資金
                return actions.order.capture().then(function(details) {
                    // **重要**: 支付成功後的操作
                    // 在這裡，您可以彈出成功提示，或者
                    // 向您的後端發送請求，記錄用戶已付款，更新會員等級等
                    alert('Transaction completed by ' + details.payer.name.given_name + '! Payment successful.');
                    
                    // 示例：可以向後端發送確認信息
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
                // 處理錯誤
                console.error("PayPal button error:", err);
                alert("An error occurred with the payment. Please try again.");
            }
        }).render(containerId); // 將按鈕渲染到對應的 div
    });

    // --- 初始化 ---
    updateUserNav();
});