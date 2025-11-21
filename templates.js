/* templates.js v6.0 - 支持热门推荐与分类 */
const API_BASE_URL = 'https://api.goreportify.com'; 
const token = localStorage.getItem('token');

(function() { if (!token) window.location.href = 'index.html'; })();

// DOM
const popularGrid = document.getElementById('popular-grid');
const mainGrid = document.getElementById('template-grid');
const sidebarLinks = document.querySelectorAll('#category-filter li, [data-filter="Custom"]');
const listTitle = document.getElementById('list-title');
// 弹窗 DOM
const createBtn = document.getElementById('create-new-template-btn');
const modalOverlay = document.getElementById('template-modal-overlay');
const templateForm = document.getElementById('template-form');
const closeModalBtn = document.getElementById('close-template-modal-btn');
// 表单输入
const nameInput = document.getElementById('template-name');
const contentInput = document.getElementById('template-content');
const idInput = document.getElementById('template-id-input');

let allTemplates = [];
let userPlan = 'basic';

document.addEventListener('DOMContentLoaded', () => {
    fetchUserPlan();
    fetchTemplates();

    // 筛选点击
    sidebarLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            // 样式切换
            document.querySelectorAll('.template-sidebar li').forEach(l => l.classList.remove('active'));
            e.currentTarget.classList.add('active');
            
            const filter = e.currentTarget.dataset.filter;
            renderView(filter);
        });
    });

    // 弹窗事件
    createBtn.addEventListener('click', () => openModal());
    closeModalBtn.addEventListener('click', closeModal);
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
        renderView('all');
    } catch(e) {
        mainGrid.innerHTML = '<p>Error loading templates.</p>';
    }
}

// 核心渲染视图
function renderView(filter) {
    mainGrid.innerHTML = '';
    popularGrid.innerHTML = '';
    
    // 1. 如果是 "All"，则显示热门板块
    const popularSection = document.getElementById('popular-section');
    if (filter === 'all') {
        popularSection.style.display = 'block';
        const populars = allTemplates.filter(t => t.isPopular);
        populars.forEach(t => popularGrid.appendChild(createCard(t)));
        listTitle.textContent = 'All Categories';
    } else {
        popularSection.style.display = 'none'; // 筛选时隐藏热门
        listTitle.textContent = filter === 'Custom' ? 'My Custom Templates' : `${filter} Templates`;
    }

    // 2. 渲染主列表
    const filtered = allTemplates.filter(t => {
        if (filter === 'all') return true; // 显示所有（不包括热门？通常这里重复显示也无所谓）
        if (filter === 'Custom') return !t.isSystem;
        return t.category === filter;
    });

    if (filtered.length === 0) {
        mainGrid.innerHTML = '<p>No templates found.</p>';
        return;
    }

    filtered.forEach(t => {
        mainGrid.appendChild(createCard(t));
    });
}

function createCard(t) {
    const card = document.createElement('div');
    card.className = 'template-card';
    
    let badgeHtml = `<span class="badge ${t.category}">${t.category || 'Custom'}</span>`;
    if (t.isPro) badgeHtml += `<span class="badge pro">PRO</span>`;

    card.innerHTML = `
        <div class="card-header">${badgeHtml}</div>
        <h3>${t.title}</h3>
        <p>${t.description || 'Custom template'}</p>
        <div class="card-footer">
             ${!t.isSystem ? `<button class="btn-text edit-btn">Edit</button>` : ''}
            <button class="btn btn-primary use-btn" style="${t.isSystem ? 'width:100%' : ''}">Use Template</button>
             ${!t.isSystem ? `<button class="btn-icon delete-btn">&times;</button>` : ''}
        </div>
    `;

    // 绑定事件
    card.querySelector('.use-btn').addEventListener('click', () => {
        if (t.isPro && userPlan !== 'pro') return alert('Please upgrade to Pro.');
        localStorage.setItem('autoSelectTemplate', t._id);
        window.location.href = 'index.html#generator';
    });
    
    if (!t.isSystem) {
        card.querySelector('.edit-btn').addEventListener('click', () => openModal(t));
        card.querySelector('.delete-btn').addEventListener('click', () => deleteTemplate(t._id));
    }

    return card;
}

// --- CRUD 逻辑 (简写) ---
function openModal(t=null) {
    modalOverlay.classList.remove('hidden');
    if(t) {
        idInput.value = t._id; nameInput.value = t.title; contentInput.value = t.content || t.structure;
    } else {
        templateForm.reset(); idInput.value = '';
    }
}
function closeModal() { modalOverlay.classList.add('hidden'); }

async function handleSave(e) {
    e.preventDefault();
    const id = idInput.value;
    const url = id ? `${API_BASE_URL}/api/templates/${id}` : `${API_BASE_URL}/api/templates`;
    const method = id ? 'PUT' : 'POST';
    // 简单保存逻辑，稍后会升级为"向导式"
    await fetch(url, {
        method, 
        headers: {'Content-Type':'application/json', 'Authorization':`Bearer ${token}`},
        body: JSON.stringify({ title: nameInput.value, content: contentInput.value, category: 'Custom' })
    });
    closeModal();
    fetchTemplates();
}

async function deleteTemplate(id) {
    if(!confirm('Delete?')) return;
    await fetch(`${API_BASE_URL}/api/templates/${id}`, { method: 'DELETE', headers: {'Authorization':`Bearer ${token}`} });
    fetchTemplates();
}
