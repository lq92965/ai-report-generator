// account.js
const API_BASE_URL = 'https://api.goreportify.com'; 
const token = localStorage.getItem('token');

document.addEventListener('DOMContentLoaded', () => {
    if (!token) {
        window.location.href = 'index.html'; 
        return;
    }

    // 绑定 DOM 元素
    const profileForm = document.getElementById('profile-form');
    const profileEmailInput = document.getElementById('profile-email');
    const profileNameInput = document.getElementById('profile-name');
    const profileStatus = document.getElementById('profile-status');
    const headerActions = document.querySelector('.header-actions'); // 获取导航栏容器

    // 1. 页面加载时，获取当前用户信息 (并更新导航栏)
    fetchUserProfile();

    // 2. 绑定“保存修改”表单
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault(); 
        const newName = profileNameInput.value.trim();

        if (!newName) {
            showStatusMessage('Display Name cannot be empty', true);
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
                throw new Error(errorData.message || 'Update failed');
            }

            const result = await response.json();
            showStatusMessage('Profile updated successfully!', false);
            profileNameInput.value = result.name; 
            
            // 【新功能】保存成功后，也立即更新右上角的名字
            updateUserNav(result); 

        } catch (error) {
            console.error('Error updating profile:', error);
            showStatusMessage(error.message, true);
        }
    });

    /**
     * (功能函数) 获取当前用户信息并填充表单和导航栏
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
                    localStorage.removeItem('token');
                    window.location.href = 'index.html';
                }
                throw new Error('Could not fetch user profile');
            }

            const user = await response.json();
            
            // 1. 填充表单
            profileEmailInput.value = user.email;
            profileNameInput.value = user.name;

            // 2. 【新功能】更新导航栏
            updateUserNav(user);

        } catch (error) {
            console.error('Error fetching user profile:', error);
            showStatusMessage('Could not load your profile', true);
        }
    }

    /**
     * 【新功能】(辅助函数) 动态更新右上角的导航栏
     * @param {object} user - 从 API 获取的用户对象 (包含 .name 和 .email)
     */
    function updateUserNav(user) {
        if (!headerActions) return;
        headerActions.innerHTML = ''; // 清空旧按钮

        // 创建新的“用户名”链接 (链接到 account.html, 标记为 'active')
        const userNameLink = document.createElement('a');
        userNameLink.href = 'account.html';
        userNameLink.className = 'btn btn-secondary active';
        userNameLink.textContent = user.name || user.email.split('@')[0];
        
        // 创建新的“退出登录”按钮
        const newLogoutBtn = document.createElement('button');
        newLogoutBtn.className = 'btn';
        newLogoutBtn.textContent = 'Logout';
        newLogoutBtn.addEventListener('click', () => {
            localStorage.removeItem('token');
            window.location.href = 'index.html';
        });

        // 将新按钮添加到导航栏
        headerActions.appendChild(userNameLink);
        headerActions.appendChild(newLogoutBtn);
    }

    /**
     * (辅助函数) 在表单下方显示状态消息
     */
    function showStatusMessage(message, isError) {
        profileStatus.textContent = message;
        profileStatus.className = isError ? 'status-message error-message' : 'status-message success-message';
        
        setTimeout(() => {
            profileStatus.textContent = '';
            profileStatus.className = 'status-message';
        }, 5000);
    }
});
