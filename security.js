// security.js
const API_BASE_URL = 'https://api.goreportify.com';
const token = localStorage.getItem('token');

document.addEventListener('DOMContentLoaded', () => {
    if (!token) {
        window.location.href = 'index.html'; 
        return;
    }

    // 绑定 DOM 元素
    const passwordForm = document.getElementById('password-form');
    const currentPasswordInput = document.getElementById('current-password');
    const newPasswordInput = document.getElementById('new-password');
    const confirmPasswordInput = document.getElementById('confirm-password');
    const passwordStatus = document.getElementById('password-status');

    // 1. 动态更新导航栏 (显示用户名)
    updateUserNav();

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
        if (newPassword.length < 6) { // (假设我们后端要求最少6位)
            showStatusMessage('New password must be at least 6 characters long.', true);
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/user/password`, {
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

});

/**
 * 动态更新导航栏 (和所有页面都一样)
 */
async function updateUserNav() {
  const headerActions = document.querySelector('.header-actions');
  if (!headerActions) return;
  headerActions.innerHTML = ''; 

  const token = localStorage.getItem('token');

  if (token) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/user/profile`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to fetch user');
      const user = await response.json();

      const userName = user.name || user.email.split('@')[0];
      const userInitial = (userName[0] || 'U').toUpperCase();

      // 1. 创建头像
      const avatar = document.createElement('div');
      avatar.className = 'user-avatar';
      avatar.textContent = userInitial;

      // 2. 创建用户名 (作为触发器)
      const userNameLink = document.createElement('a');
      userNameLink.href = '#'; 
      userNameLink.className = 'nav-user-name';
      userNameLink.textContent = userName;

      // 3. 创建下拉菜单
      const dropdown = document.createElement('div');
      dropdown.className = 'nav-user-dropdown';
      dropdown.innerHTML = `
        <a href="account.html">My Account</a>
        <a href="templates.html">My Templates</a>
        <a href="profile.html">Settings</a>
        <hr>
        <button id="dynamic-logout-btn">Logout</button>
      `;

      // 4. 绑定下拉菜单的“退出”按钮
      dropdown.querySelector('#dynamic-logout-btn').addEventListener('click', () => {
        localStorage.removeItem('token');
        window.location.href = 'index.html';
      });

      // 5. 绑定触发器
      const toggleDropdown = (e) => {
        e.preventDefault();
        dropdown.classList.toggle('active');
        userNameLink.classList.toggle('active');
      };
      userNameLink.addEventListener('click', toggleDropdown);
      avatar.addEventListener('click', toggleDropdown);

      // 6. 添加到 header
      headerActions.appendChild(avatar);
      headerActions.appendChild(userNameLink);
      headerActions.appendChild(dropdown);

      // 7. (新) 点击菜单外部时，关闭菜单
      document.addEventListener('click', (e) => {
        if (!headerActions.contains(e.target) && dropdown.classList.contains('active')) {
          dropdown.classList.remove('active');
          userNameLink.classList.remove('active');
        }
      });

    } catch (error) {
      localStorage.removeItem('token');
      showLoggedOutNav(headerActions);
    }
  } else {
    showLoggedOutNav(headerActions);
  }
}

/**
 * 显示“未登录”状态的按钮
 */
function showLoggedOutNav(headerActions) {
  if (!headerActions) return;
  headerActions.innerHTML = `
    <a href="account.html" class="btn btn-secondary">Login</a>
    <a href="#generator" class="btn btn-primary">Get Started</a>
  `;
}

/**
 * (辅助函数) 在表单下方显示状态消息
 */
function showStatusMessage(message, isError) {
    const passwordStatus = document.getElementById('password-status');
    if (!passwordStatus) return;

    passwordStatus.textContent = message;
    passwordStatus.className = isError ? 'status-message error-message' : 'status-message success-message';

    setTimeout(() => {
        passwordStatus.textContent = '';
        passwordStatus.className = 'status-message';
    }, 5000);
}
