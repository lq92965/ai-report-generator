/*
 * Reportify AI - templates.js (v6.0 完整重构版)
 * 负责: 模板加载、筛选渲染、CRUD操作
 */
const API_BASE_URL = 'https://api.goreportify.com'; 
const token = localStorage.getItem('token');

// 页面保护
(function() {
    if (!token) {
        alert('Please log in to access templates.');
        window.location.href = 'index.html'; 
    }
})();

// 全局变量
let allTemplates = [];

document.addEventListener('DOMContentLoaded', () => {
    // 1. 加载模板
    fetchAndDisplayTemplates();

    // 2. 绑定侧边栏筛选
    const filters = document.querySelectorAll('#category-filter li');
    filters.forEach(li => {
        li.addEventListener('click', (e) => {
            // 移除所有 active
            filters.forEach(f => f.classList.remove('active'));
            // 激活当前
            e.currentTarget.classList.add('active');
            
            // 执行筛选
            const filterValue = e.currentTarget.getAttribute('data-filter');
            renderTemplates(filterValue);
            
            // 更新标题
            document.getElementById('list-title').textContent = e.currentTarget.textContent;
        });
    });

    // 3. 绑定创建/弹窗事件
    const createBtn = document.getElementById('create-new-template-btn');
    const closeBtn = document.getElementById('close-template-modal-btn');
    const form = document.getElementById('template-form');
    const modal = document.getElementById('template-modal-overlay');

    if(createBtn) createBtn.addEventListener('click', () => openModal());
    if(closeBtn) closeBtn.addEventListener('click', closeModal);
    if(modal) modal.addEventListener('click', (e) => { if(e.target === modal) closeModal(); });
    if(form) form.addEventListener('submit', handleFormSubmit);
});

// --- 核心功能 ---

// 获取数据
async function fetchAndDisplayTemplates() {
    const container = document.getElementById('template-list');
    container.innerHTML = '<p>Loading...</p>';
    
    try {
        const res = await fetch(`${API_BASE_URL}/api/templates`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        allTemplates = await res.json();
        renderTemplates('all'); // 默认显示全部
    } catch (err) {
        container.innerHTML = '<p style="color:red">Failed to load templates.</p>';
    }
}

// 渲染卡片 (带筛选)
function renderTemplates(filter) {
    const container = document.getElementById('template-list');
    container.innerHTML = '';
    
    // 筛选逻辑
    const filtered = allTemplates.filter(t => {
        if (filter === 'all') return true;
        if (filter === 'Custom') return !t.isSystem; // Custom = 非官方
        return t.category === filter;
    });

    if (filtered.length === 0) {
        container.innerHTML = '<p>No templates found in this category.</p>';
        return;
    }

    // 生成 HTML
    filtered.forEach(t => {
        const card = document.createElement('div');
        card.className = 'template-card';
        
        // 标签
        let badges = `<span class="badge">${t.category || 'General'}</span>`;
        if(t.isPro) badges += ` <span class="badge pro" style="background:#fff3cd;color:#856404">PRO</span>`;
        
        card.innerHTML = `
            <div style="margin-bottom:10px;">${badges}</div>
            <h3>${t.title}</h3>
            <p style="color:#666; font-size:0.9em; margin-bottom:15px;">${t.description || 'Custom template'}</p>
            
            <div style="margin-top:auto;">
                <button class="btn btn-primary use-btn" style="width:100%">Use Template</button>
                ${!t.isSystem ? '<div style="margin-top:10px;text-align:right;"><small class="btn-delete" style="cursor:pointer;color:red;">Delete</small></div>' : ''}
            </div>
        `;
        
        // 绑定使用
        card.querySelector('.use-btn').addEventListener('click', () => {
            // 简单存个ID，跳转主页
            localStorage.setItem('autoSelectTemplate', t._id);
            window.location.href = 'index.html';
        });

        // 绑定删除
        if(!t.isSystem) {
            card.querySelector('.btn-delete').addEventListener('click', () => deleteTemplate(t._id));
        }
        
        container.appendChild(card);
    });
}

// --- CRUD 操作 ---

function openModal() {
    document.getElementById('template-modal-overlay').classList.remove('hidden');
    document.getElementById('template-form').reset();
    document.getElementById('template-id-input').value = '';
}

function closeModal() {
    document.getElementById('template-modal-overlay').classList.add('hidden');
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('template-name').value;
    const content = document.getElementById('template-content').value;
    
    const saveBtn = document.getElementById('save-template-btn');
    saveBtn.textContent = 'Saving...';
    saveBtn.disabled = true;

    try {
        const res = await fetch(`${API_BASE_URL}/api/templates`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ title: name, content: content, category: 'Custom' })
        });
        if(res.ok) {
            closeModal();
            fetchAndDisplayTemplates();
        } else {
            alert('Failed to save');
        }
    } catch(err) { alert(err.message); }
    finally {
        saveBtn.textContent = 'Save Template';
        saveBtn.disabled = false;
    }
}

async function deleteTemplate(id) {
    if(!confirm('Delete this template?')) return;
    await fetch(`${API_BASE_URL}/api/templates/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    fetchAndDisplayTemplates();
}
