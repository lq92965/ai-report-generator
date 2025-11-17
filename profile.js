/*
 * ===================================================================
 * * Reportify AI (goreportify.com) - Profile Page Script
 * * FILE: profile.js
 * * PURPOSE: Handles profile updates, avatar uploads, and form logic.
 * * (This file is now cleaned of all duplicate navigation code)
 * ===================================================================
*/

// --- 全局常量 (在 DOMContentLoaded 外部定义，以便立即访问) ---
const API_BASE_URL = 'https://api.goreportify.com';
const token = localStorage.getItem('token');

// --- Page load immediate check (Protection) ---
if (!token) {
    // (!!!) Fix: Add an alert for the user before redirecting
    // alert('Please log in to access your profile.');
    // window.location.href = 'index.html'; 
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

        // 3. (!!!) Fix: Call the *Global* nav function (from nav.js)
        // We already have the 'user' object, so we pass it in 
        // to prevent nav.js from fetching it again.
        if (window.updateUserNav) {
            window.updateUserNav(user);
        }

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

        // (!!!) Fix:
        // On success, call the *Global* nav function (from nav.js)
        // We pass the 'updatedUser' object to it.
        if (window.updateUserNav) {
            window.updateUserNav(updatedUser); 
        }

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
        
        // (!!!) Fix:
        // Call the *Global* nav function (from nav.js)
        // We don't pass an object, so nav.js will auto-refetch 
        // to get the latest user data (which is correct)
        /if (window.updateUserNav) {
            window.updateUserNav();
        }

    } catch (error) {
        console.error('Error uploading avatar:', error);
        showStatusMessage(error.message, true);
    } finally {
        if(avatarUploadBtn) avatarUploadBtn.disabled = false;
    }
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
