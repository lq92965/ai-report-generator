/*
 * ===================================================================
 * * Reportify AI - 订阅管理脚本 (修复版)
 * * 修复内容: 
 * * 1. 添加了卡片点击切换样式的逻辑。
 * * 2. 修复了 Pro 按钮无法点击的问题。
 * * 3. 增强了 PayPal 错误提示。
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
    // 1. 检查用户当前的数据库状态
    checkCurrentPlan();

    // 2. 初始化 UI 交互 (蓝框切换)
    initCardSelection();

    // 3. 初始化 PayPal 按钮
    initPayPalButtons();
});

/**
 * 1. 获取用户当前信息并显示
 */
async function checkCurrentPlan() {
    const planBadge = document.getElementById('user-plan-badge');
    if (!planBadge) return;

    try {
        const response = await fetch(`${API_BASE_URL}/api/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const user = await response.json();
        
        // 显示当前计划
        const plan = user.plan || 'basic';
        planBadge.textContent = plan.toUpperCase(); // 显示为 BASIC 或 PRO
        
        // 如果用户已经是 Pro，禁用 Pro 的购买按钮
        if (plan === 'pro') {
            const proBtn = document.querySelector('.choose-plan-btn[data-plan="pro"]');
            if (proBtn) {
                proBtn.disabled = true;
                proBtn.textContent = 'Current Plan';
                proBtn.classList.remove('btn-primary');
                proBtn.classList.add('btn-secondary');
            }
        }

    } catch (error) {
        console.error('Error fetching plan:', error);
        planBadge.textContent = 'Unknown';
    }
}

/**
 * 2. 初始化卡片选择交互 (点击变蓝)
 */
function initCardSelection() {
    const cards = document.querySelectorAll('.pricing-card');
    
    cards.forEach(card => {
        card.addEventListener('click', (e) => {
            // 如果点击的是里面的按钮，不要触发卡片样式切换（防止冲突）
            if (e.target.closest('button') || e.target.closest('.paypal-button-container')) return;

            // 移除所有卡片的选中状态
            cards.forEach(c => c.classList.remove('selected-plan'));
            
            // 给当前点击的卡片添加选中状态
            card.classList.add('selected-plan');
        });
    });
}

/**
 * 3. 初始化 PayPal 按钮
 */
function initPayPalButtons() {
    if (typeof window.paypal === 'undefined') {
        console.error('PayPal SDK not loaded');
        document.querySelectorAll('.plan-action-area').forEach(div => {
            div.innerHTML = '<p style="color:red; font-size:12px;">PayPal Failed to Load</p>';
        });
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

        // 点击“选择”按钮时
        chooseBtn.addEventListener('click', () => {
            // 1. 先让对应的卡片变蓝
            document.querySelectorAll('.pricing-card').forEach(c => c.classList.remove('selected-plan'));
            chooseBtn.closest('.pricing-card').classList.add('selected-plan');

            // 2. 隐藏当前按钮，准备显示 PayPal
            chooseBtn.style.display = 'none';
            container.innerHTML = '<p style="font-size:12px; color:#666;">Loading PayPal...</p>';

            // 3. 渲染 PayPal 按钮
            try {
                window.paypal.Buttons({
                    // 设置样式
                    style: {
                        shape: 'rect',
                        color: 'gold',
                        layout: 'vertical',
                        label: 'pay',
                    },
                    // 创建订单
                    createOrder: (data, actions) => {
                        return actions.order.create({
                            purchase_units: [{
                                description: `Reportify AI ${plan.id.toUpperCase()} Plan`,
                                amount: { 
                                    value: plan.amount 
                                }
                            }]
                        });
                    },
                    // 支付成功
                    onApprove: (data, actions) => {
                        return actions.order.capture().then(async (details) => {
                            alert(`Payment successful! Upgrading you to ${plan.id.toUpperCase()}...`);
                            await upgradeUserPlan(plan.id, details.id);
                        });
                    },
                    // 支付取消
                    onCancel: (data) => {
                        alert('Payment cancelled.');
                        chooseBtn.style.display = 'inline-block'; // 恢复按钮
                        container.innerHTML = '';
                    },
                    // 支付错误
                    onError: (err) => {
                        console.error('PayPal Error Object:', err);
                        alert('Payment Error: ' + err); // 弹出具体错误信息
                        chooseBtn.style.display = 'inline-block'; // 恢复按钮
                        container.innerHTML = '';
                    }
                }).render(plan.container).then(() => {
                    // 渲染成功后清除 Loading 文字
                    const loadingText = container.querySelector('p');
                    if(loadingText) loadingText.remove();
                });
            } catch (e) {
                console.error("Render Error:", e);
                alert("Could not load PayPal button.");
                chooseBtn.style.display = 'inline-block';
            }
        });
    });
}

/**
 * 4. 模拟后端升级 (稍后我们会写真的后端)
 */
async function upgradeUserPlan(planId, orderId) {
    console.log(`Upgrading to ${planId} with order ${orderId}`);
    // 暂时模拟成功，两秒后刷新
    setTimeout(() => {
        alert('Upgrade successful! Refreshing page...');
        window.location.reload();
    }, 1000);
}
