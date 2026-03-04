// ========================================================
// 🟢 独立的 PayPal 订阅与支付核心逻辑 (完全物理隔离)
// ========================================================

const PAYPAL_PLAN_IDS = {
    basic: {
        monthly: 'P-064730007W177763FNGT24DI',
        yearly: 'P-485334104D5902934NGT26FA'
    },
    pro: {
        monthly: 'P-75G85632XU6928725NGT34OI', 
        yearly: 'P-1KU15100C4499954NNGT357I'
    }
};

window.currentSelectedPlanId = '';
// 引入全局实例变量存放旧的 PayPal 按钮，用于彻底销毁
window.currentPayPalButton = null; 

function showSubToast(msg, type='info') {
    if(typeof showToast === 'function') {
        showToast(msg, type);
    } else {
        alert(msg);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const planButtons = document.querySelectorAll('.subscribe-btn');
    const subscribeModal = document.getElementById('subscribe-modal-overlay');
    const closeSubscribeBtn = document.getElementById('close-subscribe-btn');
    const planNameDisplay = document.getElementById('subscribe-plan-name');
    const paypalContainer = document.getElementById('smart-paypal-container');

    if (!subscribeModal || !paypalContainer) return; 

    // 关闭弹窗
    closeSubscribeBtn.addEventListener('click', () => {
        subscribeModal.style.display = 'none'; 
    });

    planButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const planType = e.currentTarget.dataset.plan; 
            const billingCycle = e.currentTarget.dataset.cycle; 
            
            if (planType === 'free') {
                return showSubToast('Elite Trial activated!', 'success');
            }

            // 获取最新 ID
            window.currentSelectedPlanId = PAYPAL_PLAN_IDS[planType][billingCycle];
            
            // 更新 UI 文字
            const cycleText = billingCycle === 'yearly' ? 'Annually' : 'Monthly';
            const priceText = billingCycle === 'yearly' ? (planType === 'pro' ? '$199' : '$99') : (planType === 'pro' ? '$19.90' : '$9.90');
            const planNameCapitalized = planType.charAt(0).toUpperCase() + planType.slice(1);
            
            planNameDisplay.innerText = `${planNameCapitalized} Plan (${cycleText}) - ${priceText}`;

            // 显示弹窗
            subscribeModal.style.display = 'flex';

            // 🚨 核心防御机制：如果内存中存活着上一次点击产生的旧按钮，直接无情地摧毁它！
            if (window.currentPayPalButton) {
                window.currentPayPalButton.close().catch(err => console.log('Close btn skipped'));
            }

            // 为当前这笔交易，实时创建一个纯洁无污染的新按钮
            if (window.paypal) {
                window.currentPayPalButton = window.paypal.Buttons({
                    style: {
                        shape: 'rect',
                        color: 'blue',
                        layout: 'vertical',
                        label: 'subscribe'
                    },
                    createSubscription: function(data, actions) {
                        // 发起订阅时，PayPal 将 100% 读取这里最新的 ID
                        return actions.subscription.create({
                            'plan_id': window.currentSelectedPlanId 
                        });
                    },
                    onApprove: function(data, actions) {
                        showSubToast('Payment successful! Processing upgrade...', 'success');
                        subscribeModal.style.display = 'none';
                        console.log("Success Subscription ID:", data.subscriptionID);
                        setTimeout(() => {
                            window.location.href = 'account.html';
                        }, 2000);
                    },
                    onError: function(err) {
                        console.error('PayPal Error:', err);
                        showSubToast('Payment window closed or error occurred.', 'error');
                    }
                });

                // 渲染全新按钮
                window.currentPayPalButton.render('#smart-paypal-container');
            } else {
                showSubToast("PayPal SDK not loaded. Check your Client ID!", "error");
            }
        });
    });
});
