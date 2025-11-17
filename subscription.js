/*
 * ===================================================================
 * * Reportify AI - 订阅管理脚本
 * * 文件: subscription.js
 * * 职责: 处理 PayPal 支付和计划升级
 * ===================================================================
*/

const API_BASE_URL = 'https://api.goreportify.com';
const token = localStorage.getItem('token');

// (!!!) 页面保护
(function() {
    if (!token) {
        alert('Please log in to view subscription settings.');
        window.location.href = 'index.html'; 
    }
})();

document.addEventListener('DOMContentLoaded', () => {
    // 1. 检查当前用户状态 (显示当前套餐)
    checkCurrentPlan();

    // 2. 初始化 PayPal 按钮
    initPayPalButtons();
});

/**
 * 获取用户当前信息并更新 UI
 */
async function checkCurrentPlan() {
    const planBadge = document.getElementById('user-plan-badge');
    try {
        const response = await fetch(`${API_BASE_URL}/api/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const user = await response.json();
        
        // 显示当前计划 (大写首字母)
        const plan = user.plan || 'basic';
        planBadge.textContent = plan.charAt(0).toUpperCase() + plan.slice(1);

        // 如果已经是 Pro，禁用 Pro 按钮并显示状态
        if (plan === 'pro') {
            disablePlanCard('pro', 'Current Plan');
        }

    } catch (error) {
        console.error('Error fetching plan:', error);
        planBadge.textContent = 'Unknown';
    }
}

/**
 * 辅助函数：禁用已购买的套餐卡片
 */
function disablePlanCard(planName, message) {
    const btnContainer = document.getElementById(`btn-container-${planName}`);
    if (btnContainer) {
        btnContainer.innerHTML = `<button class="btn btn-secondary" disabled style="cursor: default; opacity: 0.7;">${message}</button>`;
    }
}

/**
 * 初始化 PayPal 按钮
 */
function initPayPalButtons() {
    if (typeof window.paypal === 'undefined') {
        console.error('PayPal SDK not loaded');
        return;
    }

    // 定义套餐配置
    const plans = [
        { id: 'basic', amount: '9.90', container: '#paypal-basic' },
        { id: 'pro', amount: '19.90', container: '#paypal-pro' }
    ];

    plans.forEach(plan => {
        const chooseBtn = document.querySelector(`.choose-plan-btn[data-plan="${plan.id}"]`);
        const container = document.querySelector(plan.container);

        if (!chooseBtn || !container) return;

        // 点击“选择”按钮时，显示 PayPal 按钮
        chooseBtn.addEventListener('click', () => {
            // 隐藏所有其他的 PayPal 按钮，重置界面
            document.querySelectorAll('.paypal-button-container').forEach(el => el.innerHTML = '');
            document.querySelectorAll('.choose-plan-btn').forEach(btn => btn.style.display = 'inline-block');

            // 隐藏当前按钮，显示 PayPal
            chooseBtn.style.display = 'none';
            
            // 渲染 PayPal 按钮
            window.paypal.Buttons({
                createOrder: (data, actions) => {
                    return actions.order.create({
                        purchase_units: [{
                            description: `Reportify AI ${plan.id.toUpperCase()} Plan`,
                            amount: { value: plan.amount }
                        }]
                    });
                },
                onApprove: (data, actions) => {
                    return actions.order.capture().then(async (details) => {
                        // (!!!) 支付成功，这里是关键
                        // 我们将在下一步创建后端 API 来处理这个请求
                        alert(`Payment successful! Verifying upgrade for ${details.payer.name.given_name}...`);
                        
                        await upgradeUserPlan(plan.id, details.id);
                    });
                },
                onError: (err) => {
                    console.error('PayPal Error:', err);
                    alert('Payment failed. Please try again.');
                    chooseBtn.style.display = 'inline-block'; // 恢复按钮
                    container.innerHTML = '';
                }
            }).render(plan.container);
        });
    });
}

/**
 * 调用后端 API 升级用户 (我们将在下一步实现后端)
 */
async function upgradeUserPlan(planId, orderId) {
    try {
        // 这里的 API 还没写，我们马上就要写
        // 暂时先模拟成功
        console.log(`Upgrading to ${planId} with order ${orderId}`);
        
        /* // 真实代码将是：
        const response = await fetch(`${API_BASE_URL}/api/user/upgrade`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ plan: planId, orderId: orderId })
        });
        if (!response.ok) throw new Error('Upgrade failed');
        */

        alert('Upgrade successful! Refreshing page...');
        window.location.reload();

    } catch (error) {
        alert('Error upgrading account: ' + error.message);
    }
}
