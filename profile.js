// profile.js (旧的 account.js)
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
 * 动态更新导航栏 (主页版本)
 * 【新逻辑】：Avatar + Dropdown Menu
 */
async function updateUserNav() {
  const headerActions = document.querySelector('.header-actions');
  if (!headerActions) return;
  headerActions.innerHTML = ''; // 清空所有旧按钮

  const token = localStorage.getItem('token'); 

  if (token) {
    // --- 用户已登录 ---
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
      avatar.textContent = userInitial; // (未来这里可以换成 <img>)
      
      // 2. 创建用户名 (作为触发器)
      const userNameLink = document.createElement('a');
      userNameLink.href = '#'; // 它只是一个触发器
      userNameLink.className = 'nav-user-name';
      userNameLink.textContent = userName;
      
      // 3. 创建下拉菜单 (默认隐藏)
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
        updateUserNav(); // 立即刷新导航栏
      });

      // 5. 绑定触发器 (点击用户名或头像)
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
    // --- 用户未登录 ---
    showLoggedOutNav(headerActions);
  }
}

/**
 * (辅助函数) 显示“未登录”状态的按钮
 * (已修复，使用您正确的“打开弹窗”逻辑)
 */
function showLoggedOutNav(headerActions) {
  if (!headerActions) return;
  headerActions.innerHTML = ''; 

  const loginBtn = document.createElement('a');
  loginBtn.href = '#'; 
  loginBtn.className = 'btn btn-secondary';
  loginBtn.textContent = 'Login';
  loginBtn.addEventListener('click', (e) => {
    e.preventDefault(); 
    openModal('login'); // (调用您在 script.js 中已有的 openModal 函数)
  });

  const getStartedBtn = document.createElement('a');
  getStartedBtn.href = '#generator';
  getStartedBtn.className = 'btn btn-primary';
  getStartedBtn.textContent = 'Get Started';

  headerActions.appendChild(loginBtn);
  headerActions.appendChild(getStartedBtn);
}
