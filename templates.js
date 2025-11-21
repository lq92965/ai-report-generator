/*
 * ===================================================================
 * * Reportify AI - templates.js (修复版)
 * * 功能: 
 * * 1. 检查登录状态 (修复“自动退出”问题)
 * * 2. 更新导航栏头像
 * * 3. 加载和管理模板
 * ===================================================================
*/

const API_BASE_URL = 'https://api.goreportify.com'; 
const token = localStorage.getItem('token');

// --- 1. 页面保护与导航栏初始化 ---
document.addEventListener('DOMContentLoaded', async () => {
    // 检查是否登录
    if (!token) {
        alert('Please log in to view your templates.');
        window.location.href = 'index.html'; 
        return;
    }

    // (!!!) 关键修复: 立即更新右上角导航栏
    await updateUserNav();

    // 加载模板数据
    fetchAndDisplayTemplates();
    
    // 绑定按钮事件
    setupEventListeners();
});

// --- 2. 导航栏更新逻辑 (修复“退出”假象) ---
async function updateUserNav() {
    const headerActions = document.querySelector('.header-actions');
    if (!headerActions) return;

    try {
        // 获取用户信息
        const response = await fetch(`${API_BASE_URL}/api/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const user = await response.json();
            const userName = user.displayName || user.email.split('@')[0];
            const userInitial = (userName[0] || 'U').toUpperCase();

            // 渲染头像和下拉菜单
            headerActions.innerHTML = `
                <div class="user-profile-menu" style="position: relative; display: flex; align-items: center; gap: 10px; cursor: pointer;">
                    <div class="user-avatar" style="width: 35px; height: 35px; border-radius: 50%; background: #007bff; color: white; display: flex; justify-content: center; align-items: center; font-weight: bold;">
                        ${user.avatarUrl ? `<img src="${user.avatarUrl}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">` : userInitial}
                    </div>
                    <span style="font-weight: 500;">${userName}</span>
                    
                    <div class="dropdown-content" style="display: none; position: absolute; top: 100%; right: 0; background: white; border: 1px solid #ddd; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); min-width: 150px; z-index: 1000; margin-top: 10px;">
                        <a href="account.html" style="display: block; padding: 10px 15px; text-decoration: none; color: #333; border-bottom: 1px solid #eee;">My Account</a>
                        <a href="templates.html" style="display: block; padding: 10px 15px; text-decoration: none; color: #333; border-bottom: 1px solid #eee;">My Templates</a>
                        <a href="#" id="logout-btn" style="display: block; padding: 10px 15px; text-decoration: none; color: #d9534f;">Logout</a>
                    </div>
                </div>
            `;

            // 绑定菜单点击事件
            const menu = headerActions.querySelector('.user-profile-menu');
            const dropdown = headerActions.querySelector('.dropdown-content');
            
            menu.addEventListener('click', () => {
                dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
            });

            // 绑定登出事件
            document.getElementById('logout-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                localStorage.removeItem('token');
                window.location.href = 'index.html';
            });
        }
    } catch (error) {
        console.error('Nav update failed:', error);
    }
}

// --- 3. 模板管理逻辑 ---

// DOM 元素
const loadingMessage = document.getElementById('loading-templates');
const templateListContainer = document.getElementById('template-list');
const createBtn = document.getElementById('create-new-template-btn');
const templateModal = document.getElementById('template-modal-overlay');
const templateForm = document.getElementById('template-form');
const closeModalBtn = document.getElementById('close-template-modal-btn');

// 获取并显示模板
async function fetchAndDisplayTemplates() {
    if(!templateListContainer) return;
    templateListContainer.innerHTML = '<p>Loading...</p>';

    try {
        const response = await fetch(`${API_BASE_URL}/api/templates`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const templates = await response.json();

        templateListContainer.innerHTML = ''; // 清空 Loading

        if (templates.length === 0) {
            templateListContainer.innerHTML = '<p>You have no templates yet. Create one!</p>';
            return;
        }

        templates.forEach(template => {
            const card = document.createElement('div');
            card.className = 'template-card'; // 确保 style.css 有这个类
            // 简单的卡片样式内联 (防止样式未加载)
            card.style.cssText = 'background: #fff; border: 1px solid #ddd; padding: 20px; border-radius: 8px; margin-bottom: 20px;';
            
            card.innerHTML = `
                <h3 style="margin-top:0;">${template.title}</h3>
                <p style="color:#666; font-size:0.9em;">${template.content ? template.content.substring(0, 100) + '...' : 'No content'}</p>
                <div style="margin-top: 15px;">
                    <button class="btn-delete" style="background: #ff4d4f; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">Delete</button>
                </div>
            `;

            // 绑定删除
            card.querySelector('.btn-delete').addEventListener('click', async () => {
                if(confirm('Delete this template?')) {
                    await fetch(`${API_BASE_URL}/api/templates/${template._id}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    fetchAndDisplayTemplates(); // 刷新
                }
            });

            templateListContainer.appendChild(card);
        });

    } catch (error) {
        templateListContainer.innerHTML = `<p style="color:red">Error: ${error.message}</p>`;
    }
}

// 绑定基础事件
function setupEventListeners() {
    if(createBtn) {
        createBtn.addEventListener('click', () => {
            if(templateModal) templateModal.classList.remove('hidden');
        });
    }
    
    if(closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            if(templateModal) templateModal.classList.add('hidden');
        });
    }

    if(templateForm) {
        templateForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nameInput = document.getElementById('template-name');
            const contentInput = document.getElementById('template-content');
            
            try {
                const res = await fetch(`${API_BASE_URL}/api/templates`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}` 
                    },
                    body: JSON.stringify({
                        title: nameInput.value,
                        content: contentInput.value
                    })
                });
                
                if(res.ok) {
                    templateModal.classList.add('hidden');
                    templateForm.reset();
                    fetchAndDisplayTemplates(); // 刷新列表
                } else {
                    alert('Failed to create template');
                }
            } catch(err) {
                alert(err.message);
            }
        });
    }
}
