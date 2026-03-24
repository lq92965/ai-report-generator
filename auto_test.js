document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = 'index.html'; return; }

    const API_BASE_URL = 'https://api.goreportify.com';
    
    // DOM 元素
    const displayNameInput = document.getElementById('display-name');
    const emailInput = document.getElementById('email');
    const planBadge = document.getElementById('plan-badge');
    const avatarUpload = document.getElementById('avatar-upload');
    const avatarPreview = document.getElementById('avatar-preview');

    // 1. 加载用户信息 (用于显示初始头像)
    try {
        const res = await fetch(`${API_BASE_URL}/api/me`, { headers: { 'Authorization': `Bearer ${token}` } });
        const user = await res.json();
        
        displayNameInput.value = user.displayName || '';
        emailInput.value = user.email;
        planBadge.textContent = user.plan.toUpperCase();
        planBadge.className = `badge ${user.plan}`; // 加上 basic/pro 类名

        // 如果有头像，就显示；没有就用默认占位图
        if (user.avatarUrl) {
            avatarPreview.src = user.avatarUrl;
        }

    } catch (err) { console.error(err); }

    // 2. 监听头像上传
    if (avatarUpload) {
        avatarUpload.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            // 创建 FormData 对象来发送文件
            const formData = new FormData();
            formData.append('avatar', file); // 'avatar' 必须和后端 upload.single('avatar') 一致

            try {
                // 显示上传中状态
                avatarPreview.style.opacity = '0.5';
                
                const res = await fetch(`${API_BASE_URL}/api/upload-avatar`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }, // 不设置 Content-Type，让浏览器自动设置
                    body: formData
                });
                
                const data = await res.json();
                if (!res.ok) throw new Error(data.message);
                
                // 上传成功，更新页面
                avatarPreview.src = data.avatarUrl; // 更新预览图
                alert('Avatar updated successfully!');

                // (可选) 尝试更新顶部导航栏的头像
                if (window.updateUserNav) window.updateUserNav();

            } catch (err) {
                alert('Upload failed: ' + err.message);
            } finally {
                avatarPreview.style.opacity = '1';
            }
        });
    }
});
