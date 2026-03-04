// ========================================================
// 🟢 独立的 PayPal 订阅与支付核心逻辑 (完全物理隔离)
// 这是一个完整的文件，专门处理计费周期的动态切换与支付
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
window.isPayPalButtonRendered = false; 

// 轻量级 Toast 兜底函数，防止跨文件调用失败
function showSubToast(msg, type='info') {
    if(typeof showToast === 'function') {
        showToast(msg, type);
    } else {
        alert(msg);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // 🚨 核心防御：采用全新的专属 Class 和 ID，彻底切断与 script.js 旧代码的联系
    const planButtons = document.querySelectorAll('.subscribe-btn');
    const subscribeModal = document.getElementById('subscribe-modal-overlay');
    const closeSubscribeBtn = document.getElementById('close-subscribe-btn');
    const planNameDisplay = document.getElementById('subscribe-plan-name');
    const paypalContainer = document.getElementById('smart-paypal-container');

    if (!subscribeModal || !paypalContainer) return; 

    // 仅隐藏弹窗，不销毁 SDK
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

            // 1. 精准提取当前按钮对应的 唯一 Plan ID
            window.currentSelectedPlanId = PAYPAL_PLAN_IDS[planType][billingCycle];
            
            // 2. 动态更新界面上的商品名称和金额，给用户安全感
            const cycleText = billingCycle === 'yearly' ? 'Annually' : 'Monthly';
            const priceText = billingCycle === 'yearly' ? (planType === 'pro' ? '$199' : '$99') : (planType === 'pro' ? '$19.90' : '$9.90');
            const planNameCapitalized = planType.charAt(0).toUpperCase() + planType.slice(1);
            
            planNameDisplay.innerText = `${planNameCapitalized} Plan (${cycleText}) - ${priceText}`;

            // 3. 唤起支付弹窗
            subscribeModal.style.display = 'flex';

            // 4. 全局生命周期内，仅初始化渲染一次 PayPal 按钮
            if (!window.isPayPalButtonRendered && window.paypal) {
                paypalContainer.innerHTML = '';
                
                window.paypal.Buttons({
                    style: {
                        shape: 'rect',
                        color: 'blue',
                        layout: 'vertical',
                        label: 'subscribe'
                    },
                    createSubscription: function(data, actions) {
                        // 🟢 最关键的一步：用户无论怎么切换点击，真正扣款时始终读取最新的 ID
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
                        showSubToast('Payment failed or cancelled. Please try again.', 'error');
                    }
                }).render('#smart-paypal-container');
                
                window.isPayPalButtonRendered = true; 
            }
        });
    });
});
