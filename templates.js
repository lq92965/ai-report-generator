/*
 * ===================================================================
 * * Reportify AI - templates.js (v5.0 - 模板库最终版)
 * * 功能: 
 * * 1. 加载并渲染所有模板 (官方 + 自定义)。
 * * 2. 支持侧边栏分类筛选 (Sales, PM, Daily, etc.)。
 * * 3. 区分显示 PRO 标签和 System 标签。
 * * 4. 处理自定义模板的 CRUD。
 * ===================================================================
*/

const API_BASE_URL = 'https://api.goreportify.com'; 
const token = localStorage.getItem('token');

// (!!!) 页面保护
(function() {
    if (!token) {
        alert('Please log in to access the library.');
        window.location.href = 'index.html'; 
    }
})();

// --- DOM 元素 ---
const templateGrid = document.getElementById('template-grid');
const sidebarLinks = document.querySelectorAll('.template-sidebar li');
const createBtn = document.getElementById('create-new-template-btn');

// 弹窗相关
const templateModal = document.getElementById('template-modal-overlay');
const templateModalTitle = document.getElementById('template-modal-title');
const templateForm = document.getElementById('template-form');
const templateIdInput = document.getElementById('template-id-input');
const templateNameInput = document.getElementById('template-name');
const templateContentInput = document.getElementById('template-content');
const saveTemplateBtn = document.getElementById('save-template-btn');
const closeModalBtn = document.getElementById('close-template-modal-btn');

// 状态
let allTemplates = [];
let currentFilter = 'all'; // 默认显示所有
let userPlan = 'basic';

document.addEventListener('DOMContentLoaded', () => {
    // 1. 获取用户计划 (为了显示 Pro 锁)
    fetchUserPlan();

    // 2. 加载模板数据
    fetchTemplates();

    // 3. 绑定侧边栏筛选点击
    sidebarLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            // UI 切换 active 状态
            sidebarLinks.forEach(l => l.classList.remove('active'));
            e.currentTarget.classList.add('active');
            
            // 获取筛选条件
            currentFilter = e.currentTarget.dataset.filter;
            renderTemplates(); // 重新渲染
        });
    });

    // 4. 绑定 CRUD 事件
    if(createBtn) createBtn.addEventListener('click', () => openModal(false));
    if(closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    if(templateForm) templateForm.addEventListener('submit', handleFormSubmit);
});

/**
 * 获取用户 Plan
 */
async function fetchUserPlan() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const user = await res.json();
        userPlan = user.plan || 'basic';
    } catch(e) { console.error(e); }
}

/**
 * 从后端获取所有模板
 */
async function fetchTemplates() {
    templateGrid.innerHTML = '<p>Loading templates...</p>';
    try {
        const response = await fetch(`${API_BASE_URL}/api/templates`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to load');
        
        allTemplates = await response.json();
        renderTemplates(); // 数据回来后，执行渲染

    } catch (error) {
        console.error(error);
        templateGrid.innerHTML = '<p style="color:red">Error loading templates.</p>';
    }
}

/**
 * 核心渲染逻辑
 */
function renderTemplates() {
    templateGrid.innerHTML = '';

    // 1. 筛选数据
    const filtered = allTemplates.filter(t => {
        if (currentFilter === 'all') return true;
        // 检查 Category 或 Frequency 是否匹配
        return (t.category === currentFilter) || (t.frequency === currentFilter);
    });

    if (filtered.length === 0) {
        templateGrid.innerHTML = '<p>No templates found in this category.</p>';
        return;
    }

    // 2. 生成卡片 HTML
    filtered.forEach(t => {
        const card = document.createElement('div');
        card.className = 'template-card';
        
        // 标签逻辑
        let tagsHtml = '';
        if (t.category) tagsHtml += `<span class="template-tag">${t.category}</span>`;
        if (t.isPro) tagsHtml += `<span class="template-tag tag-pro">PRO</span>`;
        if (!t.isSystem) tagsHtml += `<span class="template-tag" style="background:#e3f2fd;color:#0d47a1">Custom</span>`;

        // 描述逻辑 (如果没有描述，截取内容)
        const desc = t.description || (t.content ? t.content.substring(0, 80) + '...' : 'No description');

        card.innerHTML = `
            <div style="margin-bottom:10px;">${tagsHtml}</div>
            <h3>${t.title}</h3>
            <p>${desc}</p>
            <div class="template-card-actions" style="margin-top:auto; display:flex; gap:10px;">
                ${renderCardButtons(t)}
            </div>
        `;
        
        // 绑定按钮事件 (Use, Edit, Delete)
        bindCardEvents(card, t);

        templateGrid.appendChild(card);
    });
}

/**
 * 根据模板类型生成不同的按钮
 */
function renderCardButtons(t) {
    // 如果是官方模板：只显示 "Use" (跳转主页)
    if (t.isSystem) {
        return `<button class="btn btn-primary btn-use" style="width:100%">Use Template</button>`;
    }
    // 如果是自定义模板：显示 "Edit" 和 "Delete"
    return `
        <button class="btn btn-secondary btn-edit" style="flex:1">Edit</button>
        <button class="btn btn-danger btn-delete" style="flex:1">Delete</button>
    `;
}

/**
 * 绑定卡片按钮事件
 */
function bindCardEvents(card, t) {
    const useBtn = card.querySelector('.btn-use');
    const editBtn = card.querySelector('.btn-edit');
    const deleteBtn = card.querySelector('.btn-delete');

    // "Use" 按钮: 暂时简单跳转回主页 (未来可升级为自动选中)
    if (useBtn) {
        useBtn.addEventListener('click', () => {
            if (t.isPro && userPlan !== 'pro') {
                alert('This is a Pro template. Please upgrade.');
                return;
            }
            // 将模板ID存入 localStorage，以便主页读取并自动选中
            localStorage.setItem('autoSelectTemplate', t._id);
            window.location.href = 'index.html';
        });
    }

    // "Edit" 按钮
    if (editBtn) {
        editBtn.addEventListener('click', () => openModal(true, t));
    }

    // "Delete" 按钮
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => handleDelete(t._id));
    }
}

// --- 以下是 CRUD 弹窗逻辑 (保持不变) ---

function openModal(isEditing = false, template = null) {
    templateModal.classList.remove('hidden');
    if (isEditing && template) {
        templateModalTitle.textContent = 'Edit Template';
        saveTemplateBtn.textContent = 'Update';
        templateIdInput.value = template._id;
        templateNameInput.value = template.title;
        templateContentInput.value = template.content || ''; // 兼容新旧数据
    } else {
        templateModalTitle.textContent = 'Create New Template';
        saveTemplateBtn.textContent = 'Create';
        templateForm.reset();
        templateIdInput.value = '';
    }
}

function closeModal() {
    templateModal.classList.add('hidden');
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const id = templateIdInput.value;
    const isEditing = !!id;
    
    const payload = {
        title: templateNameInput.value,
        content: templateContentInput.value,
        // 自定义模板默认为 Custom 分类
        category: 'Custom' 
    };

    saveTemplateBtn.disabled = true;
    saveTemplateBtn.textContent = 'Saving...';

    try {
        const url = isEditing ? `${API_BASE_URL}/api/templates/${id}` : `${API_BASE_URL}/api/templates`;
        const method = isEditing ? 'PUT' : 'POST';
        
        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload)
        });
        
        if (!res.ok) throw new Error('Failed to save');
        
        closeModal();
        fetchTemplates(); // 刷新列表

    } catch (err) {
        alert(err.message);
    } finally {
        saveTemplateBtn.disabled = false;
    }
}

async function handleDelete(id) {
    if(!confirm('Delete this template?')) return;
    try {
        const res = await fetch(`${API_BASE_URL}/api/templates/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to delete');
        fetchTemplates();
    } catch (err) {
        alert(err.message);
    }
}
