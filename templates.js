/*
 * ===================================================================
 * * Reportify AI - templates.js (完整修复版)
 * * 修复: 正确匹配后端字段 (title, content)，解决加载和保存问题。
 * ===================================================================
*/
const API_BASE_URL = 'https://api.goreportify.com'; 
const token = localStorage.getItem('token');

// (!!!) 页面保护：如果没有登录，直接踢回主页
(function() {
    if (!token) {
        alert('Please log in to access your templates.');
        window.location.href = 'index.html'; 
    }
})();

// --- DOM 元素 ---
const loadingMessage = document.getElementById('loading-templates');
const templateListContainer = document.getElementById('template-list'); // 注意 ID 匹配
const createBtn = document.getElementById('create-new-template-btn');
const templateForm = document.getElementById('template-form');
const templateModal = document.getElementById('template-modal-overlay');
const templateModalTitle = document.getElementById('template-modal-title');
const templateIdInput = document.getElementById('template-id-input');
const templateNameInput = document.getElementById('template-name');
const templateContentInput = document.getElementById('template-content');
const saveTemplateBtn = document.getElementById('save-template-btn');
const formStatus = document.getElementById('template-form-status');
const closeModalBtn = document.getElementById('close-template-modal-btn');

document.addEventListener('DOMContentLoaded', () => {
    // (注意：导航栏由 nav.js 自动处理，这里不需要 updateUserNav)

    // 获取并显示模板
    fetchAndDisplayTemplates();

    // 绑定事件
    if(createBtn) createBtn.addEventListener('click', () => openModal(false));
    if(closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    if(templateModal) {
        templateModal.addEventListener('click', (e) => {
            if (e.target === templateModal) closeModal();
        });
    }
    
    // 绑定表单提交
    if(templateForm) templateForm.addEventListener('submit', handleFormSubmit);
});

/**
 * 获取并显示模板
 */
async function fetchAndDisplayTemplates() {
    if (!loadingMessage || !templateListContainer) return;

    loadingMessage.textContent = 'Loading your templates...';
    templateListContainer.innerHTML = '';

    try {
        const response = await fetch(`${API_BASE_URL}/api/templates`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            if (response.status === 401) {
                 window.location.href = 'index.html'; 
            }
            throw new Error('Failed to fetch templates');
        }

        const templates = await response.json();

        if (templates.length === 0) {
            loadingMessage.textContent = 'You have not created any templates yet.';
            loadingMessage.style.display = 'block';
        } else {
            loadingMessage.style.display = 'none';
            templates.forEach(template => {
                const card = document.createElement('div');
                card.className = 'template-card'; // 确保 style.css 有这个样式
                
                // (!!!) 修复点: 使用后端正确的字段名 'content'
                const preview = template.content ? template.content.substring(0, 100) : 'No content';
                
                // (!!!) 修复点: 使用后端正确的字段名 'title'
                card.innerHTML = `
                    <h3>${template.title}</h3>
                    <p>${preview}...</p>
                    <div class="template-card-actions">
                        <button class="btn btn-secondary btn-edit">Edit</button>
                        <button class="btn btn-danger btn-delete">Delete</button>
                    </div>
                `;
                
                // 绑定编辑按钮
                card.querySelector('.btn-edit').addEventListener('click', () => {
                    openModal(true, template); 
                });
                
                // 绑定删除按钮
                card.querySelector('.btn-delete').addEventListener('click', async () => {
                    // (!!!) 修复点: 使用 'title'
                    if (confirm(`Are you sure you want to delete "${template.title}"?`)) {
                        await deleteTemplate(template._id);
                    }
                });
                
                templateListContainer.appendChild(card);
            });
        }

    } catch (error) {
        console.error('Error fetching templates:', error);
        loadingMessage.textContent = `Error: ${error.message}`;
        loadingMessage.style.color = 'red';
    }
}

/**
 * 打开创建/编辑模态框
 */
function openModal(isEditing = false, template = null) {
    if(formStatus) formStatus.textContent = '';
    
    if (isEditing && template) {
        templateModalTitle.textContent = 'Edit Template';
        saveTemplateBtn.textContent = 'Update Template';
        templateIdInput.value = template._id;
        // (!!!) 修复点: 使用 'title' 和 'content' 填充表单
        templateNameInput.value = template.title;
        templateContentInput.value = template.content;
    } else {
        templateModalTitle.textContent = 'Create New Template';
        saveTemplateBtn.textContent = 'Save Template';
        templateForm.reset();
        templateIdInput.value = ''; 
    }
    templateModal.classList.remove('hidden');
}

function closeModal() {
    templateModal.classList.add('hidden');
    templateForm.reset();
    if(formStatus) formStatus.textContent = '';
}

/**
 * 处理表单提交 (创建或更新)
 */
async function handleFormSubmit(e) {
    e.preventDefault();
    formStatus.textContent = '';
    saveTemplateBtn.disabled = true;
    saveTemplateBtn.textContent = 'Saving...';

    const templateId = templateIdInput.value;
    const isEditing = !!templateId;
    
    // (!!!) 修复点: 发送正确的 JSON 键 ('title', 'content') 给后端
    const templateData = {
        title: templateNameInput.value,
        content: templateContentInput.value
    };

    const url = isEditing 
        ? `${API_BASE_URL}/api/templates/${templateId}` 
        : `${API_BASE_URL}/api/templates`;
        
    const method = isEditing ? 'PUT' : 'POST';

    try {
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(templateData)
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.message || 'Failed to save template');
        }

        closeModal();
        fetchAndDisplayTemplates(); // 刷新列表

    } catch (error) {
        console.error('Error saving template:', error);
        formStatus.textContent = error.message;
        formStatus.style.color = 'red';
    } finally {
        saveTemplateBtn.disabled = false;
        saveTemplateBtn.textContent = isEditing ? 'Update Template' : 'Save Template';
    }
}

/**
 * 删除模板
 */
async function deleteTemplate(templateId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/templates/${templateId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.message || 'Failed to delete');
        }

        fetchAndDisplayTemplates(); // 刷新列表

    } catch (error) {
        console.error('Error deleting template:', error);
        alert(`Error: ${error.message}`); 
    }
}
