document.addEventListener('DOMContentLoaded', () => {
    // --- 基本配置 ---
    const API_BASE_URL = 'https://api.goreportify.com';
    const token = localStorage.getItem('token');

    // --- 頁面元素 ---
    const createBtn = document.getElementById('create-new-template-btn');
    const modalOverlay = document.getElementById('template-modal-overlay');
    const closeModalBtn = document.getElementById('close-template-modal-btn');
    const templateForm = document.getElementById('template-form');
    const templateModalTitle = document.getElementById('template-modal-title');
    const templateIdInput = document.getElementById('template-id-input');
    const templateNameInput = document.getElementById('template-name');
    const templateContentInput = document.getElementById('template-content');
    const saveTemplateBtn = document.getElementById('save-template-btn');
    const templateListContainer = document.getElementById('template-list');
    const loadingMessage = document.getElementById('loading-templates');
    const formStatus = document.getElementById('template-form-status');
    const headerActions = document.querySelector('.header-actions');

    // --- 導航欄更新 (此頁面專用) ---
    function updateUserNav() {
        if (!headerActions) return; 
        headerActions.innerHTML = '';
        if (token) {
            const myAccountBtn = document.createElement('a');
            myAccountBtn.href = 'templates.html'; // 保持在當前頁面
            myAccountBtn.className = 'btn btn-secondary active'; // 標記為當前頁
            myAccountBtn.textContent = 'My Account';
            
            const logoutBtn = document.createElement('a');
            logoutBtn.href = '#'; // 登出按鈕
            logoutBtn.className = 'btn btn-primary';
            logoutBtn.textContent = 'Logout';

            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                localStorage.removeItem('token');
                window.location.href = 'index.html'; // 登出後返回主頁
            });

            headerActions.appendChild(myAccountBtn);
            headerActions.appendChild(logoutBtn);
        } else {
            // 如果 token 無效或不存在，強制返回主頁
            console.warn('No token found, redirecting to login.');
            window.location.href = 'index.html';
        }
    }

    // --- 檢查登錄狀態 ---
    if (!token) {
        alert('You must be logged in to manage templates.');
        window.location.href = 'index.html'; // 跳轉回主頁
        return; // 停止執行後續代碼
    }
    
    // --- 彈窗控制 ---
    const openModal = (mode = 'create', data = {}) => {
        formStatus.textContent = ''; // 清除錯誤信息
        if (mode === 'create') {
            templateModalTitle.textContent = 'Create New Template';
            templateForm.reset(); // 清空表單
            templateIdInput.value = '';
            saveTemplateBtn.textContent = 'Save Template';
        } else if (mode === 'edit') {
            templateModalTitle.textContent = 'Edit Template';
            templateIdInput.value = data._id;
            templateNameInput.value = data.templateName;
            templateContentInput.value = data.templateContent;
            saveTemplateBtn.textContent = 'Update Template';
        }
        modalOverlay.classList.remove('hidden');
    };

    const closeModal = () => {
        modalOverlay.classList.add('hidden');
    };

    if(createBtn) createBtn.addEventListener('click', () => openModal('create'));
    if(closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    if(modalOverlay) modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
    });

    // --- API 函數 ---

    // 獲取並顯示所有模板
    const fetchAndDisplayTemplates = async () => {
        try {
            if(loadingMessage) loadingMessage.textContent = 'Loading your templates...';
            const res = await fetch(`${API_BASE_URL}/api/templates`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (res.status === 401 || res.status === 403) {
                 alert('Session expired. Please log in again.');
                 localStorage.removeItem('token');
                 window.location.href = 'index.html';
                 return;
            }
            if (!res.ok) throw new Error('Failed to fetch templates. Server responded with ' + res.status);
            
            const templates = await res.json();
            templateListContainer.innerHTML = ''; // 清空列表

            if (templates.length === 0) {
                loadingMessage.textContent = 'You haven\'t created any templates yet. Click "Create New Template" to start!';
                templateListContainer.appendChild(loadingMessage);
                return;
            }

            templates.forEach(template => {
                const card = document.createElement('div');
                card.className = 'template-card'; // 需要在 CSS 中定義樣式
                card.innerHTML = `
                    <h3>${escapeHTML(template.templateName)}</h3>
                    <p>${escapeHTML(template.templateContent.substring(0, 150))}...</p>
                    <div class="template-card-actions">
                        <button class="btn btn-secondary btn-edit">Edit</button>
                        <button class="btn btn-danger btn-delete">Delete</button>
                    </div>
                `;
                
                // 添加編輯按鈕事件
                card.querySelector('.btn-edit').addEventListener('click', () => {
                    openModal('edit', template);
                });

                // 添加刪除按鈕事件
                card.querySelector('.btn-delete').addEventListener('click', async () => {
                    if (confirm(`Are you sure you want to delete "${template.templateName}"?`)) {
                        await deleteTemplate(template._id);
                    }
                });

                templateListContainer.appendChild(card);
            });

        } catch (error) {
            console.error('Error fetching templates:', error);
            if(loadingMessage) {
                loadingMessage.textContent = `Error: ${error.message}`;
                loadingMessage.style.color = 'red';
            }
        }
    };

    // 創建或更新模板
    if(templateForm) templateForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        formStatus.textContent = '';
        saveTemplateBtn.disabled = true;

        const templateId = templateIdInput.value;
        const isEditing = !!templateId;
        
        const url = isEditing 
            ? `${API_BASE_URL}/api/templates/${templateId}` 
            : `${API_BASE_URL}/api/templates`;
        
        const method = isEditing ? 'PUT' : 'POST';
        
        const body = JSON.stringify({
            templateName: templateNameInput.value,
            templateContent: templateContentInput.value
        });

        try {
            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to save template');

            closeModal();
            await fetchAndDisplayTemplates(); // 刷新列表

        } catch (error) {
            console.error('Error saving template:', error);
            formStatus.textContent = error.message;
        } finally {
            saveTemplateBtn.disabled = false;
        }
    });

    // 刪除模板
    const deleteTemplate = async (templateId) => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/templates/${templateId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to delete template');

            await fetchAndDisplayTemplates(); // 刷新列表

        } catch (error) {
            console.error('Error deleting template:', error);
            alert(`Error: ${error.message}`);
        }
    };

    // --- 輔助函數 ---
    const escapeHTML = (str) => {
        if (typeof str !== 'string') return '';
        return str.replace(/[&<>"']/g, (match) => {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            }[match];
        });
    };

    // --- 頁面初始化 ---
    updateUserNav(); // 立即更新導航欄
    fetchAndDisplayTemplates(); // 頁面加載時獲取模板
});