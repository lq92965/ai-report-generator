/* * Reportify AI - profile.js 
 * 修复：头像上传与显示
 */
document.addEventListener('DOMContentLoaded', () => {
    // 务必确保这个地址是您服务器的地址
    const API_BASE_URL = 'https://api.goreportify.com'; 
    const token = localStorage.getItem('token');

    // DOM 元素
    const avatarImg = document.querySelector('.profile-avatar img'); 
    const uploadBtn = document.querySelector('.upload-btn'); // 对应 "Upload New Picture" 按钮
    const nameInput = document.getElementById('profile-name'); // 对应 Display Name 输入框
    const bioInput = document.getElementById('profile-bio');   // 对应 Bio 输入框
    const jobInput = document.getElementById('profile-job');   // 对应 Job Title 输入框
    const saveBtn = document.querySelector('.save-btn');       // 对应 Save Changes 按钮
    const emailInput = document.getElementById('profile-email'); // 对应 Email (只读)

    // 创建一个隐藏的文件输入框用于上传
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
            window.location.href = 'index.html'; // 没登录踢回首页
            return;
        }
        try {
            const res = await fetch(`${API_BASE_URL}/api/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to load profile');
            
            const user = await res.json();
            
            // 填充表单
            if (nameInput) nameInput.value = user.displayName || '';
            if (emailInput) emailInput.value = user.email || '';
            if (bioInput) bioInput.value = user.bio || ''; // 需要后端支持 bio
            if (jobInput) jobInput.value = user.jobTitle || ''; // 需要后端支持 jobTitle
            
            // 显示头像
            if (avatarImg) {
                // 如果 user.avatarUrl 有值就用，没有就用默认图
                avatarImg.src = user.avatarUrl || 'https://via.placeholder.com/150';
            }
        } catch (e) {
            console.error("加载资料错误:", e);
        }
    }

    // 2. 绑定上传按钮点击事件
    if (uploadBtn) {
        uploadBtn.addEventListener('click', (e) => {
            e.preventDefault();
            fileInput.click(); // 触发文件选择
        });
    }

    // 3. 监听文件选择变化，立即上传
    fileInput.addEventListener('change', async () => {
        const file = fileInput.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('avatar', file);

        // 更改按钮状态
        const originalText = uploadBtn.textContent;
        uploadBtn.textContent = 'Uploading...';
        uploadBtn.disabled = true;

        try {
            const res = await fetch(`${API_BASE_URL}/api/user/avatar`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }, 
                // 注意：Fetch 会自动设置 Content-Type 为 multipart/form-data
                body: formData
            });
            
            const data = await res.json();
            if (res.ok) {
                // 立即更新页面头像
                if (avatarImg) avatarImg.src = data.avatarUrl;
                alert('Avatar updated successfully!');
            } else {
                alert('Upload failed: ' + (data.message || 'Unknown error'));
            }
        } catch (err) {
            console.error(err);
            alert('Network error while uploading.');
        } finally {
            uploadBtn.textContent = originalText;
            uploadBtn.disabled = false;
            fileInput.value = ''; // 清空选择
        }
    });

    // 4. 保存文字资料
    if (saveBtn) {
        saveBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            saveBtn.textContent = 'Saving...';
            saveBtn.disabled = true;

            try {
                const res = await fetch(`${API_BASE_URL}/api/user/profile`, {
                    method: 'PUT',
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
                    alert('Profile saved successfully!');
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

    // 初始化
    loadProfile();
});
