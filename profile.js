/* * Reportify AI - profile.js (已根据您的代码调整修复) */
document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = 'https://api.goreportify.com'; 
    const token = localStorage.getItem('token');

    // DOM 元素 (保持您的选择器不变)
    const avatarImg = document.querySelector('.profile-avatar img') || document.querySelector('.profile-avatar'); 
    const uploadBtn = document.querySelector('.upload-btn'); 
    const nameInput = document.getElementById('profile-name') || document.getElementById('display-name'); 
    const bioInput = document.getElementById('profile-bio'); 
    const jobInput = document.getElementById('profile-job'); 
    const saveBtn = document.querySelector('.save-btn'); 
    const emailInput = document.getElementById('profile-email') || document.getElementById('account-email');

    // 创建隐藏的文件输入框
    let fileInput = document.getElementById('hidden-avatar-input');
    if (!fileInput) {
        fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.id = 'hidden-avatar-input';
        fileInput.accept = 'image/*';
        fileInput.style.display = 'none';
        document.body.appendChild(fileInput);
    }

    // 1. 加载用户资料
    async function loadProfile() {
        if (!token) {
            window.location.href = './index.html'; 
            return;
        }
        try {
            const res = await fetch(`${API_BASE_URL}/api/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to load profile');
            
            const user = await res.json();
            
            // 填充表单
            // 数据库里通常存的是 name，这里做个兼容
            if (nameInput) nameInput.value = user.name || user.displayName || ''; 
            if (emailInput) emailInput.value = user.email || '';
            if (bioInput) bioInput.value = user.bio || ''; 
            if (jobInput) jobInput.value = user.jobTitle || ''; 
            
            // 显示头像 (关键修复：加上域名)
            if (avatarImg && user.avatarUrl) {
                // 如果已经是完整链接(如谷歌头像)就不加，否则加上后端域名
                const fullUrl = user.avatarUrl.startsWith('http') ? user.avatarUrl : `${API_BASE_URL}${user.avatarUrl}`;
                avatarImg.src = fullUrl;
            }
        } catch (e) {
            console.error("加载资料错误:", e);
        }
    }

    // 2. 绑定上传按钮
    if (uploadBtn) {
        uploadBtn.addEventListener('click', (e) => {
            e.preventDefault();
            fileInput.click(); 
        });
    }

    // 3. 监听文件选择变化 (上传逻辑)
    fileInput.addEventListener('change', async () => {
        const file = fileInput.files[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
             alert("File is too large (Max 2MB).");
             return;
        }

        const formData = new FormData();
        formData.append('avatar', file);

        const originalText = uploadBtn.textContent;
        uploadBtn.textContent = 'Uploading...';
        uploadBtn.disabled = true;

        try {
            // 🔴 修正点：使用服务器已有的接口 /api/upload-avatar
            const res = await fetch(`${API_BASE_URL}/api/upload-avatar`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }, 
                body: formData
            });
            
            const data = await res.json();
            if (res.ok) {
                // 🔴 修正点：显示新头像时加上域名
                const newAvatarUrl = `${API_BASE_URL}${data.avatarUrl}`;
                if (avatarImg) avatarImg.src = newAvatarUrl;
                
                // 顺便刷新导航栏头像
                if(window.updateUserNav) window.updateUserNav();
                
                alert('Avatar updated successfully!');
            } else {
                alert('Upload failed: ' + (data.message || 'Error'));
            }
        } catch (err) {
            console.error(err);
            alert('Network error while uploading.');
        } finally {
            uploadBtn.textContent = originalText;
            uploadBtn.disabled = false;
            fileInput.value = ''; 
        }
    });

    // 4. 保存文字资料 (Bio/Job)
    if (saveBtn) {
        saveBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            saveBtn.textContent = 'Saving...';
            saveBtn.disabled = true;

            try {
                // 🔴 注意：为了让这个保存功能生效，你需要在 server.js 添加 /api/update-profile 接口
                // (见下文的操作步骤)
                const res = await fetch(`${API_BASE_URL}/api/update-profile`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        name: nameInput.value,
                        bio: bioInput ? bioInput.value : '',
                        jobTitle: jobInput ? jobInput.value : ''
                    })
                });
                
                if (res.ok) {
                    alert('Profile saved!');
                    if(window.updateUserNav) window.updateUserNav(); // 刷新导航栏名字
                } else {
                    alert('Failed to save profile.');
                }
            } catch (err) {
                alert('Error saving profile.');
            } finally {
                saveBtn.textContent = 'Save Changes';
                saveBtn.disabled = false;
            }
        });
    }

    loadProfile();
});
