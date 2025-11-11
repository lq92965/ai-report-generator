// templates.js
const API_BASE_URL = 'https://api.goreportify.com'; 
const token = localStorage.getItem('token');

// --- DOM 元素 ---
const headerActions = document.querySelector('.header-actions');
const loadingMessage = document.getElementById('loading-templates');
const templateListContainer = document.getElementById('template-list-container');
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
    // 动态更新导航栏 (显示用户名)
    updateUserNav();
    
    // 获取并显示模板
    fetchAndDisplayTemplates();

    // 绑定事件
    createBtn.addEventListener('click', () => openModal(false));
    closeModalBtn.addEventListener('click', closeModal);
    templateModal.addEventListener('click', (e) => {
        if (e.target === templateModal) closeModal();
    });
    
    // 绑定表单提交
    templateForm.addEventListener('submit', handleFormSubmit);
});

/**
 * 动态更新导航栏 (模板页版本)
 */
async function updateUserNav() {
  if (!headerActions) return;
  headerActions.innerHTML = ''; // 清空旧按鈕

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
        window.location.href = 'index.html';
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
      window.location.href = 'index.html'; 
    }
  } else {
    // 如果沒有 token，強制跳轉回主頁
    console.warn('No token found, redirecting to login.');
    window.location.href = 'index.html';
  }
}

/**
 * 【已恢复】获取并显示模板
 */
async function fetchAndDisplayTemplates() {
    if (!token) {
        loadingMessage.textContent = 'Please log in to view templates.';
        loadingMessage.style.color = 'red';
        return;
    }
    loadingMessage.textContent = 'Loading your templates...';
    templateListContainer.innerHTML = '';

    try {
        const response = await fetch(`${API_BASE_URL}/api/templates`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            if (response.status === 401) {
                 window.location.href = 'index.html'; // Token invalid
            }
            const err = await response.json();
            throw new Error(err.message || 'Server responded with error');
        }

        const templates = await response.json();

        if (templates.length === 0) {
            loadingMessage.textContent = 'You have not created any templates. Click "Create New Template" to start!';
            loadingMessage.style.display = 'block';
        } else {
            loadingMessage.style.display = 'none';
            templates.forEach(template => {
                const card = document.createElement('div');
                card.className = 'template-card';
                
                const preview = template.templateContent ? template.templateContent.substring(0, 100) : 'No content preview';
                
                card.innerHTML = `
                    <h3>${template.templateName}</h3>
                    <p>${preview}...</p>
                    <div class="template-card-actions">
                        <button class="btn-edit">Edit</button>
                        <button class="btn-delete">Delete</button>
                    </div>
                `;
                
                // 绑定编辑按钮
                card.querySelector('.btn-edit').addEventListener('click', () => {
                    openModal(true, template); 
                });
                
                // 绑定删除按钮
                card.querySelector('.btn-delete').addEventListener('click', async () => {
                    if (confirm(`Are you sure you want to delete "${template.templateName}"?`)) {
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
        loadingMessage.style.display = 'block';
    }
}

/**
 * 【已恢复】打开创建/编辑模态框
 */
function openModal(isEditing = false, template = null) {
    formStatus.textContent = '';
    if (isEditing && template) {
        templateModalTitle.textContent = 'Edit Template';
        saveTemplateBtn.textContent = 'Update Template';
        templateIdInput.value = template._id;
        templateNameInput.value = template.templateName;
        templateContentInput.value = template.templateContent;
    } else {
        templateModalTitle.textContent = 'Create New Template';
        saveTemplateBtn.textContent = 'Save Template';
        templateForm.reset();
        templateIdInput.value = ''; 
    }
    templateModal.classList.remove('hidden');
}

/**
 * 【已恢复】关闭模态框
 */
function closeModal() {
    templateModal.classList.add('hidden');
    templateForm.reset();
    formStatus.textContent = '';
}

/**
 * 【已恢复】处理表单提交 (创建或更新)
 */
async function handleFormSubmit(e) {
    e.preventDefault();
    formStatus.textContent = '';
    saveTemplateBtn.disabled = true;
    saveTemplateBtn.textContent = 'Saving...';

    const templateId = templateIdInput.value;
    const isEditing = !!templateId;
    
    const templateData = {
        templateName: templateNameInput.value,
        templateContent: templateContentInput.value
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
        fetchAndDisplayTemplates(); // 重新加载列表

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
 * 【已恢复】删除模板
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

        fetchAndDisplayTemplates(); // 重新加载列表

    } catch (error) {
        console.error('Error deleting template:', error);
        alert(`Error: ${error.message}`); 
    }
}
