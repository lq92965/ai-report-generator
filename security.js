// security.js
const API_BASE_URL = 'https://api.goreportify.com';
const token = localStorage.getItem('token');

document.addEventListener('DOMContentLoaded', () => {
    if (!token) {
        alert('Please log in to access your security settings.');
        window.location.href = 'index.html';
        return;
    }

    // 绑定 DOM 元素
    const passwordForm = document.getElementById('password-form');
    const currentPasswordInput = document.getElementById('current-password');
    const newPasswordInput = document.getElementById('new-password');
    const confirmPasswordInput = document.getElementById('confirm-password');
    const passwordStatus = document.getElementById('password-status');
    const deleteAccountBtn = document.getElementById('delete-account-btn'); // (这就是您在 图 1 添加的按钮)

    // 1. 动态更新导航栏 (显示用户名)

    // 2. 绑定“修改密码”表单
    passwordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        passwordStatus.textContent = '';

        const currentPassword = currentPasswordInput.value;
        const newPassword = newPasswordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        // 前端验证
        if (newPassword !== confirmPassword) {
            showStatusMessage('New passwords do not match.', true);
            return;
        }
        if (newPassword.length < 6) { 
            showStatusMessage('New password must be at least 6 characters long.', true);
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/security/password`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    currentPassword: currentPassword,
                    newPassword: newPassword
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Failed to update password');
            }

            showStatusMessage('Password updated successfully!', false);
            passwordForm.reset(); // 清空表单

        } catch (error) {
            console.error('Error updating password:', error);
            showStatusMessage(error.message, true);
        }
    });

    // 3. --- 【新功能】绑定“删除账户”按钮 ---
    deleteAccountBtn.addEventListener('click', async () => {

        // 1. 第一次确认
        if (!confirm('Are you absolutely sure you want to delete your account? This action cannot be undone.')) {
            return;
        }

        // 2. 第二次确认 (输入密码)
        const password = prompt('To confirm deletion, please enter your current password:');
        if (password === null) { // (用户点击了“取消”)
            return;
        }
        if (!password) {
            alert('Password is required to delete your account.');
            return;
        }

        // 3. (显示加载状态)
        deleteAccountBtn.disabled = true;
        deleteAccountBtn.textContent = 'Deleting...';
        showStatusMessage('Deleting your account...', false);

        try {
           const response = await fetch(`${API_BASE_URL}/api/account`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ password: password })
            });

            const result = await response.json();

            if (!response.ok) {
                // (例如，密码错误)
                throw new Error(result.message || 'Failed to delete account');
            }

            // 4. 成功！
            alert('Your account has been successfully deleted.');
            localStorage.removeItem('token'); // 退出登录
            window.location.href = 'index.html'; // 返回主页

        } catch (error) {
            console.error('Error deleting account:', error);
            showStatusMessage(error.message, true); // (在 security.html 页面上显示错误)
            deleteAccountBtn.disabled = false;
            deleteAccountBtn.textContent = 'Delete My Account';
        }
    });

});

/**
 * (辅助函数) 在*指定*元素中显示状态消息
 * (!!!) 修复: 现在接受 'element' 作为参数
 */
function showStatusMessage(element, message, isError) {
    if (!element) {
        console.error('showStatusMessage: element not provided');
        return;
    }

    element.textContent = message;
    element.className = isError ? 'status-message error-message' : 'status-message success-message';
    element.style.display = 'block'; // 确保可见

    setTimeout(() => {
        element.textContent = '';
        element.className = 'status-message';
        element.style.display = 'none'; // 隐藏
    }, 5000);
}
