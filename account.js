// account.js

// -----------------------------------------------------------------
// 全局变量和 API 基本 URL
// -----------------------------------------------------------------

// 确保我们使用和 templates.js 相同的 API 基础
const API_BASE_URL = 'https://api.goreportify.com'; 
const token = localStorage.getItem('token');

// -----------------------------------------------------------------
// 页面加载时执行的主函数
// -----------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    // 检查用户是否登录
    if (!token) {
        // 如果没有 token，立即重定向到主页（或登录页）
        window.location.href = 'index.html'; 
        return;
    }

    // 绑定 DOM 元素
    const logoutBtn = document.getElementById('logout-btn');
    const profileForm = document.getElementById('profile-form');
    const profileEmailInput = document.getElementById('profile-email');
    const profileNameInput = document.getElementById('profile-name');
    const profileStatus = document.getElementById('profile-status');

    // 1. 绑定“退出登录”按钮
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('token'); // 清除 token
        window.location.href = 'index.html'; // 重定向到主页
    });

    // 2. 页面加载时，获取当前用户信息
    fetchUserProfile();

    // 3. 绑定“保存修改”表单
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // 阻止表单默认提交
        const newName = profileNameInput.value.trim();

        if (!newName) {
            showStatusMessage('显示名称不能为空', true);
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/user/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ name: newName })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || '更新失败');
            }

            const result = await response.json();
            showStatusMessage('个人资料已成功更新！', false);
            // 可选：更新输入框的值（虽然它已经是新值了）
            profileNameInput.value = result.name; 

        } catch (error) {
            console.error('Error updating profile:', error);
            showStatusMessage(error.message, true);
        }
    });

    /**
     * (功能函数) 获取当前用户信息并填充表单
     */
    async function fetchUserProfile() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/user/profile`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    // Token 无效或过期
                    localStorage.removeItem('token');
                    window.location.href = 'index.html';
                }
                throw new Error('无法获取用户信息');
            }

            const user = await response.json();
            
            // 填充表单
            profileEmailInput.value = user.email;
            profileNameInput.value = user.name;

        } catch (error) {
            console.error('Error fetching user profile:', error);
            showStatusMessage('无法加载您的个人资料', true);
        }
    }

    /**
     * (辅助函数) 在表单下方显示状态消息
     * @param {string} message - 要显示的消息
     * @param {boolean} isError - 是不是一个错误消息 (红色)
     */
    function showStatusMessage(message, isError) {
        profileStatus.textContent = message;
        profileStatus.className = isError ? 'status-message error-message' : 'status-message success-message';
        
        // 5秒后自动清除消息
        setTimeout(() => {
            profileStatus.textContent = '';
            profileStatus.className = 'status-message';
        }, 5000);
    }
});