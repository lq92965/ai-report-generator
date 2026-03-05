// ========================================================
// 🟢 独立的 PayPal 单次支付核心逻辑 (One-Time Checkout)
// 完美规避中国大陆账号订阅风控限制
// ========================================================

// 直接定义金额，不再使用受限的 Plan ID
const PAYPAL_PRICES = {
    basic: { monthly: '9.90', yearly: '99.00' },
    pro: { monthly: '19.90', yearly: '199.00' }
};

window.currentSelectedPrice = '0.00';
window.currentSelectedPlanType = '';
window.currentSelectedCycle = '';
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

            // 获取要收取的准确金额
            window.currentSelectedPlanType = planType;
            window.currentSelectedCycle = billingCycle;
            window.currentSelectedPrice = PAYPAL_PRICES[planType][billingCycle];
            
            // 更新 UI 文字
            const cycleText = billingCycle === 'yearly' ? 'Annually' : 'Monthly';
            const priceText = `$${window.currentSelectedPrice}`;
            const planNameCapitalized = planType.charAt(0).toUpperCase() + planType.slice(1);
            
            planNameDisplay.innerText = `${planNameCapitalized} Plan (${cycleText}) - ${priceText}`;

            // 显示弹窗
            subscribeModal.style.display = 'flex';

            // 销毁旧按钮
            if (window.currentPayPalButton) {
                window.currentPayPalButton.close().catch(err => console.log('Close btn skipped'));
            }

            // 🟢 使用单次收款 (createOrder) 取代之前的 createSubscription
            if (window.paypal) {
                window.currentPayPalButton = window.paypal.Buttons({
                    style: {
                        shape: 'rect',
                        color: 'blue',
                        layout: 'vertical',
                        label: 'pay' // 标签改为 pay
                    },
                    // 设置单次收款的金额
                    createOrder: function(data, actions) {
                        return actions.order.create({
                            purchase_units: [{
                                description: `Reportify AI ${planNameCapitalized} - ${cycleText}`,
                                amount: {
                                    currency_code: 'USD',
                                    value: window.currentSelectedPrice
                                }
                            }]
                        });
                    },
                    // 用户付款成功后的动作
                    onApprove: function(data, actions) {
                        return actions.order.capture().then(function(details) {
                            showSubToast(`Payment successful! Thank you, ${details.payer.name.given_name}.`, 'success');
                            subscribeModal.style.display = 'none';
                            
                            // 打印订单号
                            console.log("Success Order ID:", details.id);
                            
                            // 跳转到账户中心
                            setTimeout(() => {
                                window.location.href = 'account.html';
                            }, 2000);
                        });
                    },
                    onError: function(err) {
                        console.error('PayPal Checkout Error:', err);
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
