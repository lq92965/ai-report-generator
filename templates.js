const API_BASE_URL = 'https://api.goreportify.com'; 
const token = localStorage.getItem('token');

(function() {
    if (!token) { window.location.href = 'index.html'; }
})();

// DOM
const templateGrid = document.getElementById('template-grid');
const sidebarLinks = document.querySelectorAll('#category-filter li');
const createBtn = document.getElementById('create-new-template-btn');
const modalOverlay = document.getElementById('template-modal-overlay');
const modalTitle = document.querySelector('#template-modal h3'); // 修正选择器
const templateForm = document.getElementById('template-form');
const nameInput = document.getElementById('template-name');
const contentInput = document.getElementById('template-content');
const idInput = document.getElementById('template-id-input');
const closeBtn = document.getElementById('close-template-modal-btn');
const viewTitle = document.getElementById('current-view-title');

let allTemplates = [];
let userPlan = 'basic';

document.addEventListener('DOMContentLoaded', () => {
    fetchUserPlan();
    fetchTemplates();

    // 筛选逻辑
    sidebarLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            sidebarLinks.forEach(l => l.classList.remove('active'));
            e.currentTarget.classList.add('active');
            const filter = e.currentTarget.dataset.filter;
            viewTitle.textContent = e.currentTarget.textContent;
            renderTemplates(filter);
        });
    });

    // 弹窗逻辑
    createBtn.addEventListener('click', () => openModal());
    closeBtn.addEventListener('click', closeModal);
    templateForm.addEventListener('submit', handleSave);
});

async function fetchUserPlan() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/me`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        userPlan = data.plan || 'basic';
    } catch(e) {}
}

async function fetchTemplates() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/templates`, { headers: { 'Authorization': `Bearer ${token}` } });
        allTemplates = await res.json();
        renderTemplates('all');
    } catch(e) {
        templateGrid.innerHTML = '<p class="error">Failed to load templates.</p>';
    }
}

function renderTemplates(filter) {
    templateGrid.innerHTML = '';
    
    const filtered = allTemplates.filter(t => {
        if (filter === 'all') return true;
        if (filter === 'Custom') return !t.isSystem; // Custom = 非系统模板
        return t.category === filter;
    });

    if (filtered.length === 0) {
        templateGrid.innerHTML = '<div class="empty-state">No templates found. Create one!</div>';
        return;
    }

    filtered.forEach(t => {
        const card = document.createElement('div');
        card.className = 'template-card';
        
        let badges = `<span class="badge ${t.category}">${t.category || 'Custom'}</span>`;
        if (t.isPro) badges += `<span class="badge pro">PRO</span>`;

        card.innerHTML = `
            <div class="card-header">
                ${badges}
                ${!t.isSystem ? '<button class="btn-icon delete-btn" title="Delete">&times;</button>' : ''}
            </div>
            <h3>${t.title}</h3>
            <p>${t.description || 'Custom template'}</p>
            <div class="card-footer">
                ${!t.isSystem ? '<button class="btn-text edit-btn">Edit</button>' : ''}
                <button class="btn btn-primary use-btn">Use Template</button>
            </div>
        `;

        // 绑定事件
        card.querySelector('.use-btn').addEventListener('click', () => useTemplate(t));
        if (!t.isSystem) {
            card.querySelector('.edit-btn').addEventListener('click', () => openModal(t));
            card.querySelector('.delete-btn').addEventListener('click', () => deleteTemplate(t._id));
        }

        templateGrid.appendChild(card);
    });
}

// (!!!) 核心逻辑：跳转并激活
function useTemplate(t) {
    if (t.isPro && userPlan !== 'pro') {
        alert('Upgrade to PRO to use this template.');
        return;
    }
    // 存入 ID
    localStorage.setItem('autoSelectTemplate', t._id);
    // 跳转到主页的生成器部分
    window.location.href = 'index.html#generator';
}

function openModal(template = null) {
    modalOverlay.classList.remove('hidden');
    if (template) {
        modalTitle.textContent = 'Edit Template';
        idInput.value = template._id;
        nameInput.value = template.title;
        contentInput.value = template.content || template.structure || ''; // 兼容字段
    } else {
        modalTitle.textContent = 'Create New Template';
        templateForm.reset();
        idInput.value = '';
    }
}

function closeModal() {
    modalOverlay.classList.add('hidden');
}

async function handleSave(e) {
    e.preventDefault();
    const id = idInput.value;
    const payload = {
        title: nameInput.value,
        content: contentInput.value,
        category: 'General', // 默认为 General，避免后端校验失败
        isSystem: false
    };
    
    const url = id ? `${API_BASE_URL}/api/templates/${id}` : `${API_BASE_URL}/api/templates`;
    const method = id ? 'PUT' : 'POST';

    try {
        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Failed');
        
        closeModal();
        fetchTemplates(); // 刷新
    } catch(e) { alert(e.message); }
}

async function deleteTemplate(id) {
    if(!confirm('Delete this template?')) return;
    await fetch(`${API_BASE_URL}/api/templates/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
    fetchTemplates();
}
