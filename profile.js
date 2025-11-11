// profile.js (最终版本，包含头像上传)
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
    const headerActions = document.querySelector('.header-actions');

    // --- 【新】头像 DOM 元素 ---
    const avatarPreview = document.getElementById('avatar-preview');
    const avatarUploadInput = document.getElementById('avatar-upload-input');
    const avatarUploadBtn = document.getElementById('avatar-upload-btn');

    // 1. 页面加载时，获取当前用户信息 (并更新导航栏)
    fetchUserProfile();

    // 2. 绑定“保存修改”表单
    profileForm.addEventListener('submit', handleProfileSubmit);

    // 3. --- 【新】绑定头像上传按钮 ---
    avatarUploadBtn.addEventListener('click', () => {
        avatarUploadInput.click(); // 触发隐藏的文件输入框
    });

    // 4. --- 【新】绑定文件选择事件 ---
    avatarUploadInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return; // 用户取消了选择

        // 1. 显示本地预览
        const reader = new FileReader();
        reader.onload = (event) => {
            avatarPreview.src = event.target.result;
        };
        reader.readAsDataURL(file);

        // 2. 立即上传文件
        uploadAvatar(file);
    });
});

/**
 * (功能函数) 获取当前用户信息并填充表单和导航栏
 */
async function fetchUserProfile() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/user/profile`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
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
        profileNameInput.value = user.name || ''; // (确保是 '' 而不是 null)

        // 2. 【新】填充头像
        if (user.avatarUrl) {
            avatarPreview.src = user.avatarUrl;
        } else {
            // (如果用户没有头像, 我们可以在 JS 里创建一个默认首字母头像)
            const userInitial = (user.name || user.email.split('@')[0])[0].toUpperCase();
            avatarPreview.src = `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="100%" height="100%" fill="#f0f0f0"></rect><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-size="40" fill="#999">${userInitial}</text></svg>`)}`;
        }

        // 3. 更新导航栏
        updateUserNav(user);

    } catch (error) {
        console.error('Error fetching user profile:', error);
        showStatusMessage('Could not load your profile', true);
    }
}

/**
 * (功能函数) 处理个人资料“保存” (只保存名字)
 */
async function handleProfileSubmit(e) {
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

        // 保存成功后，也立即更新右上角的名字
        updateUserNav(result); // (result 此时只包含 { message, name })

    } catch (error) {
        console.error('Error updating profile:', error);
        showStatusMessage(error.message, true);
    }
}

/**
 * 【新功能】(功能函数) 上传头像文件
 * @param {File} file - 用户选择的图片文件
 */
async function uploadAvatar(file) {
    const formData = new FormData();
    formData.append('avatar', file); // (这里的 'avatar' 必须和后端 multer 的 'upload.single('avatar')' 匹配)

    showStatusMessage('Uploading new avatar...', false);
    avatarUploadBtn.disabled = true;

    try {
        const response = await fetch(`${API_BASE_URL}/api/user/avatar`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
                // (注意: 发送 FormData 时【不要】设置 'Content-Type', 浏览器会自动处理)
            },
            body: formData
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || 'Upload failed');
        }

        showStatusMessage('Avatar updated successfully!', false);
        avatarPreview.src = result.avatarUrl; // (使用 Cloudinary 返回的安全 URL)

        // 立即更新右上角的头像
        const headerAvatar = document.querySelector('.user-avatar');
        if (headerAvatar) {
            // (我们将用背景图替换掉首字母)
            headerAvatar.textContent = '';
            headerAvatar.style.backgroundImage = \`url(${result.avatarUrl})\`;
            headerAvatar.style.backgroundSize = 'cover';
        }

    } catch (error) {
        console.error('Error uploading avatar:', error);
        showStatusMessage(error.message, true);
    } finally {
        avatarUploadBtn.disabled = false;
    }
}

/**
 * 动态更新右上角的导航栏
 */
async function updateUserNav(user = null) {
  const headerActions = document.querySelector('.header-actions');
  if (!headerActions) return;
  headerActions.innerHTML = ''; 

  // (如果 user 对象没有被传入, 我们就去 fetch 一次)
  if (!user) {
      try {
          const res = await fetch(`${API_BASE_URL}/api/user/profile`, {
              method: 'GET',
              headers: { 'Authorization': `Bearer ${token}` }
          });
          if (!res.ok) throw new Error('Not logged in');
          user = await res.json();
      } catch (e) {
          // (获取失败，显示登录按钮)
          showLoggedOutNav(headerActions);
          return;
      }
  }

  // --- 用户已登录 ---
  const userName = user.name || user.email.split('@')[0];
  const userInitial = (userName[0] || 'U').toUpperCase();

  // 1. 创建头像
  const avatar = document.createElement('div');
  avatar.className = 'user-avatar';

  // 【新】检查是否有 avatarUrl
  if (user.avatarUrl) {
      avatar.style.backgroundImage = \`url(${user.avatarUrl})\`;
      avatar.style.backgroundSize = 'cover';
  } else {
      avatar.textContent = userInitial;
  }

  // 2. 创建用户名 (作为触发器)
  const userNameLink = document.createElement('a');
  userNameLink.href = 'account.html'; // 链接回 Hub
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
    const profileStatus = document.getElementById('profile-status');
    if (!profileStatus) return;

    profileStatus.textContent = message;
    profileStatus.className = isError ? 'status-message error-message' : 'status-message success-message';

    setTimeout(() => {
        profileStatus.textContent = '';
        profileStatus.className = 'status-message';
    }, 5000);
}
