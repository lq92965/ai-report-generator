/*
 * ===================================================================
 * * Reportify AI (goreportify.com) - 个人资料页脚本
 * 文件: profile.js
 * 修复日期: 2025年11月13日
 * 修复内容: 
 * 1. (架构升级) 修复了所有 API 端点以匹配新的后端 index.js。
 * 2. (Bug 修复) 修复了所有 JSON 键 (使用 displayName 替换了 name)。
 * 3. (Bug 修复) 修复了响应处理 (期望 { user: ... } 结构)。
 *
 * ===================================================================
*/

// --- 全局常量 (在 DOMContentLoaded 外部定义，以便立即访问) ---
const API_BASE_URL = 'https://api.goreportify.com';
const token = localStorage.getItem('token');

// --- 页面加载时的立即检查 ---
if (!token) {
    // 如果没有令牌，立即重定向，不执行任何操作
    window.location.href = 'index.html'; 
}

// --- DOMContentLoaded 监听器 ---
document.addEventListener('DOMContentLoaded', () => {
    
    // --- 绑定 DOM 元素 ---
    const profileForm = document.getElementById('profile-form');
    const profileEmailInput = document.getElementById('profile-email');
    const profileNameInput = document.getElementById('profile-name');
    const profileBioInput = document.getElementById('profile-bio');
    const profileJobInput = document.getElementById('profile-job');
    // const profileStatus = document.getElementById('profile-status'); // (已在 showStatusMessage 中处理)
    // const headerActions = document.querySelector('.header-actions'); // (已在 updateUserNav 中处理)

    // --- 头像 DOM 元素 ---
    const avatarPreview = document.getElementById('avatar-preview');
    const avatarUploadInput = document.getElementById('avatar-upload-input');
    const avatarUploadBtn = document.getElementById('avatar-upload-btn');

    // (安全检查) 确保我们在 profile.html 页面上
    if (!profileForm || !avatarUploadBtn) {
        console.warn('Profile form elements not found. Is this the correct page?');
        return;
    }

    // 1. 页面加载时，获取当前用户信息 (并更新导航栏)
    fetchUserProfile();

    // 2. 绑定“保存修改”表单
    profileForm.addEventListener('submit', handleProfileSubmit);

    // 3. --- 绑定头像上传按钮 ---
    avatarUploadBtn.addEventListener('click', () => {
        avatarUploadInput.click(); // 触发隐藏的文件输入框
    });

    // 4. --- 绑定文件选择事件 ---
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
        // (!!!) 修复点 1: API 路径
        const response = await fetch(`${API_BASE_URL}/api/me`, { 
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
        // (安全检查，确保元素存在)
        const profileEmailInput = document.getElementById('profile-email');
        const profileNameInput = document.getElementById('profile-name');
        const profileBioInput = document.getElementById('profile-bio');
        const profileJobInput = document.getElementById('profile-job');
        const avatarPreview = document.getElementById('avatar-preview');

        if (profileEmailInput) profileEmailInput.value = user.email;
        
        // (!!!) 修复点 2: 使用 displayName
        if (profileNameInput) profileNameInput.value = user.displayName || ''; 
        
        if (profileBioInput) profileBioInput.value = user.bio || '';
        if (profileJobInput) profileJobInput.value = user.jobTitle || '';

        // 2. 填充头像
        if (avatarPreview) {
            if (user.avatarUrl && user.avatarUrl !== 'https://via.placeholder.com/150') {
                avatarPreview.src = user.avatarUrl;
            } else {
                // (!!!) 修复点 3: 使用 displayName
                const userInitial = (user.displayName || user.email.split('@')[0])[0].toUpperCase();
                avatarPreview.src = `data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="100%" height="100%" fill="#f0f0f0"></rect><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-size="40" fill="#999">${userInitial}</text></svg>')}`;
            }
        }

        // 3. 更新导航栏
        updateUserNav(user);

    } catch (error) {
        console.error('Error fetching user profile:', error);
        showStatusMessage('Could not load your profile', true);
    }
}

/**
 * (功能函数) 处理个人资料“保存”
 */
async function handleProfileSubmit(e) {
    e.preventDefault(); 
    
    // (安全检查)
    const profileNameInput = document.getElementById('profile-name');
    const profileBioInput = document.getElementById('profile-bio');
    const profileJobInput = document.getElementById('profile-job');

    const newName = profileNameInput.value.trim();
    const newBio = profileBioInput.value.trim();
    const newJob = profileJobInput.value.trim();

    if (!newName) {
        showStatusMessage('Display Name cannot be empty', true);
        return;
    }

    try {
        // (!!!) 修复点 4: API 路径
        const response = await fetch(`${API_BASE_URL}/api/profile`, { 
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            // (!!!) 修复点 5: JSON 键
            body: JSON.stringify({ displayName: newName, bio: newBio, jobTitle: newJob })
        });
        
        // (!!!) 修复点: 
        // 捕获 HTML 错误 (例如 <!DOCTYPE)
        if (!response.headers.get("content-type")?.includes("application/json")) {
           const text = await response.text();
           throw new Error(`Server returned non-JSON response: ${text.substring(0, 100)}...`);
        }

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || 'Update failed');
        }

        // (!!!) 修复点 6: 后端返回 { message: '...', user: {...} }
        const updatedUser = result.user;

        showStatusMessage('Profile updated successfully!', false);
        profileNameInput.value = updatedUser.displayName; 
        profileBioInput.value = updatedUser.bio;
        profileJobInput.value = updatedUser.jobTitle;

        // 保存成功后，也立即更新右上角的名字
        // (!!!) 修复点: 
        // 我们不需要重新 fetch，我们已经有了 updatedUser 对象
        updateUserNav(updatedUser); 

    } catch (error) {
        console.error('Error updating profile:', error);
        // (!!!) 修复点: 向用户显示那个 <!DOCTYPE 错误
        showStatusMessage(error.message, true);
    }
}

/**
 * (功能函数) 上传头像文件
 * @param {File} file - 用户选择的图片文件
 */
async function uploadAvatar(file) {
    const formData = new FormData();
    formData.append('avatar', file); 

    showStatusMessage('Uploading new avatar...', false);
    const avatarUploadBtn = document.getElementById('avatar-upload-btn');
    if(avatarUploadBtn) avatarUploadBtn.disabled = true;

    try {
        // (!!!) 修复点 7: API 路径
        const response = await fetch(`${API_BASE_URL}/api/upload-avatar`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        // (!!!) 修复点: 捕获 HTML 错误
        if (!response.headers.get("content-type")?.includes("application/json")) {
           const text = await response.text();
           throw new Error(`Server returned non-JSON response: ${text.substring(0, 100)}...`);
        }

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || 'Upload failed');
        }

        showStatusMessage('Avatar updated successfully!', false);
        
        // (!!!) 修复点: 我们的后端返回 { message: '...', avatarUrl: '...' }
        const newAvatarUrl = result.avatarUrl;
        
        const avatarPreview = document.getElementById('avatar-preview');
        if (avatarPreview) avatarPreview.src = newAvatarUrl; 

        // 立即更新右上角的头像
        const headerAvatar = document.querySelector('.user-avatar');
        if (headerAvatar) {
            headerAvatar.innerHTML = `<img src="${newAvatarUrl}" alt="Avatar">`; // 使用 <img>
            headerAvatar.style.backgroundImage = ''; // 清除旧样式
            headerAvatar.style.backgroundSize = '';
            headerAvatar.textContent = ''; // 清除首字母
        }

    } catch (error) {
        console.error('Error uploading avatar:', error);
        showStatusMessage(error.message, true);
    } finally {
        if(avatarUploadBtn) avatarUploadBtn.disabled = false;
    }
}

/**
 * (!!!) 
 * (!!!) 导航栏 Bug (类别 A)
 * (!!!) 
 * 这是一个重复的函数。它与 script.js 中的 updateUserNav 完全相同。
 * 这是导致您的 Bug (3, 4, 6) 的根源。
 * * 我们现在修复它，使其在此页面上 (profile.html) 能够正确工作。
 * 我们的下一个任务将是创建一个“共享”的 nav.js 来一劳永逸地解决这个问题。
 * (!!!) 
 */
async function updateUserNav(user = null) {
    const headerActions = document.querySelector('.header-actions');
    if (!headerActions) return;
    headerActions.innerHTML = ''; 

    // (!!!) 修复点: 确保 token 真的存在
    const currentToken = localStorage.getItem('token');
    if (!currentToken) {
        showLoggedOutNav(headerActions);
        return;
    }

    try {
        if (!user) {
            // (!!!) 修复点: API 路径
            const res = await fetch(`${API_BASE_URL}/api/me`, { 
                method: 'GET',
                headers: { 'Authorization': `Bearer ${currentToken}` }
            });
            if (!res.ok) throw new Error('Not logged in');
            user = await res.json();
        }

        // --- 用户已登录 ---
        // (!!!) 修复点: JSON 键
        const userName = user.displayName || user.email.split('@')[0];
        const userInitial = (userName[0] || 'U').toUpperCase();

        // 1. 创建头像
        const avatar = document.createElement('div');
        avatar.className = 'user-avatar';

        // 检查是否有 avatarUrl
        if (user.avatarUrl && user.avatarUrl !== 'https://via.placeholder.com/150') {
            avatar.innerHTML = `<img src="${user.avatarUrl}" alt="${userName}">`;
        } else {
            avatar.textContent = userInitial;
        }

        // 2. 创建用户名 (作为触发器)
        const userNameLink = document.createElement('a');
        userNameLink.href = 'account.html'; 
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
            // (!!!) 修复点: 我们不应该跳转, 所以阻止默认行为
            // (但您的 userNameLink.href 是 'account.html', 这很好)
            // 让我们为头像点击也添加 e.preventDefault()
            dropdown.classList.toggle('active');
            userNameLink.classList.toggle('active');
        };
        userNameLink.addEventListener('click', toggleDropdown);
        avatar.addEventListener('click', (e) => {
             e.preventDefault(); // (!!!) 修复点: 头像点击也应阻止默认
             toggleDropdown(e);
        });


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
    
    } catch (e) {
        // 如果获取用户失败 (例如令牌过期)
        console.error("updateUserNav failed:", e.message);
        localStorage.removeItem('token');
        showLoggedOutNav(headerActions);
        return;
    }
}

/**
 * 显示“未登录”状态的按钮
 */
function showLoggedOutNav(headerActions) {
    if (!headerActions) return;
    // (!!!) 修复点: 
    // “Login” 按钮应该打开弹窗，而不是跳转到 account.html
    // 但在 profile.html 上没有弹窗。
    // 我们暂时将其指向 index.html 的登录
    headerActions.innerHTML = `
        <a href="index.html#login" class="btn btn-secondary">Login</a>
        <a href="index.html#generator" class="btn btn-primary">Get Started</a>
    `;
}

/**
 * (辅助函数) 在表单下方显示状态消息
 */
function showStatusMessage(message, isError) {
    const profileStatus = document.getElementById('profile-status');
    if (!profileStatus) {
        console.error("profile-status element not found");
        return;
    }

    profileStatus.textContent = message;
    profileStatus.className = isError ? 'status-message error-message' : 'status-message success-message';
    
    // (!!!) 修复点: 确保消息可见
    profileStatus.style.display = 'block';

    setTimeout(() => {
        profileStatus.textContent = '';
        profileStatus.className = 'status-message';
        profileStatus.style.display = 'none';
    }, 5000);
}
