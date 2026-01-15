<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reportify Admin Console</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        .nav-item.active { background-color: #2563EB; color: white; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
        .nav-item { color: #94a3b8; transition: all 0.2s; }
        .nav-item:hover:not(.active) { background-color: #1e293b; color: white; }
        .hide-scroll::-webkit-scrollbar { width: 6px; }
        .hide-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
    </style>
</head>
<body class="bg-gray-100 font-sans text-gray-800">

    <div id="auth-check" class="fixed inset-0 bg-white z-50 flex items-center justify-center">
        <div class="animate-spin text-4xl text-blue-600"><i class="fas fa-circle-notch"></i></div>
    </div>

    <div class="flex h-screen overflow-hidden">
        
        <aside class="w-64 bg-slate-900 text-white flex-shrink-0 flex flex-col transition-all duration-300">
            <div class="p-6 flex items-center gap-3 border-b border-slate-800">
                <div class="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold">R</div>
                <h1 class="text-lg font-bold tracking-wide">Reportify Admin</h1>
            </div>
            
            <nav class="flex-1 p-4 space-y-2 mt-4">
                <button onclick="switchView('dashboard')" id="nav-dashboard" class="nav-item active w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left">
                    <i class="fas fa-chart-pie w-5 text-center"></i> Dashboard
                </button>
                <button onclick="switchView('users')" id="nav-users" class="nav-item w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left">
                    <i class="fas fa-users w-5 text-center"></i> Users Management
                </button>
                <button onclick="switchView('feedback')" id="nav-feedback" class="nav-item w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left">
                    <i class="fas fa-inbox w-5 text-center"></i> Feedback & Inbox
                </button>
            </nav>

            <div class="p-4 border-t border-slate-800">
                <div class="flex items-center gap-3 px-4 py-3 mb-2">
                    <div class="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs">AD</div>
                    <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium truncate text-white">Administrator</p>
                        <p class="text-xs text-slate-400 truncate">Super User</p>
                    </div>
                </div>
                <button onclick="logout()" class="w-full flex items-center justify-center gap-2 px-4 py-2 text-red-400 hover:bg-red-900/20 rounded transition text-sm">
                    <i class="fas fa-sign-out-alt"></i> Logout
                </button>
            </div>
        </aside>

        <div class="flex-1 flex flex-col overflow-hidden relative">
            
            <header class="bg-white shadow-sm h-16 flex items-center justify-between px-8 z-10">
                <h2 class="text-xl font-bold text-gray-800" id="page-title">Dashboard Overview</h2>
                <div class="flex items-center gap-4">
                    <span class="text-sm text-gray-500" id="current-date"></span>
                    <button onclick="initData()" class="p-2 text-gray-400 hover:text-blue-600 transition" title="Refresh Data">
                        <i class="fas fa-sync-alt"></i>
                    </button>
                </div>
            </header>

            <main class="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 p-8 hide-scroll">
                
                <div id="view-dashboard" class="view-section animate-fade-in">
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                        <div class="bg-white p-6 rounded-xl shadow-sm border-b-4 border-blue-500">
                            <p class="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Users</p>
                            <h3 class="text-3xl font-extrabold text-gray-800 mt-2" id="stat-users">-</h3>
                        </div>
                        <div class="bg-white p-6 rounded-xl shadow-sm border-b-4 border-green-500">
                            <p class="text-xs font-bold text-gray-400 uppercase tracking-wider">Basic Plan ($9.9)</p>
                            <h3 class="text-3xl font-extrabold text-gray-800 mt-2" id="stat-basic">-</h3>
                        </div>
                        <div class="bg-white p-6 rounded-xl shadow-sm border-b-4 border-purple-600">
                            <p class="text-xs font-bold text-gray-400 uppercase tracking-wider">Pro Plan ($19.9)</p>
                            <h3 class="text-3xl font-extrabold text-gray-800 mt-2" id="stat-pros">-</h3>
                        </div>
                        <div class="bg-white p-6 rounded-xl shadow-sm border-b-4 border-yellow-500">
                            <p class="text-xs font-bold text-gray-400 uppercase tracking-wider">Pending Feedback</p>
                            <h3 class="text-3xl font-extrabold text-gray-800 mt-2" id="stat-unread">-</h3>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div class="bg-white p-6 rounded-xl shadow-sm lg:col-span-1">
                            <h3 class="font-bold text-gray-700 mb-4">User Distribution</h3>
                            <div class="relative h-64">
                                <canvas id="userChart"></canvas>
                            </div>
                        </div>
                        <div class="bg-white p-6 rounded-xl shadow-sm lg:col-span-2">
                            <h3 class="font-bold text-gray-700 mb-4">Recent Feedback Activity</h3>
                            <div id="dash-recent-list" class="space-y-3">
                                <div class="text-gray-400 text-sm">Loading...</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div id="view-users" class="view-section hidden">
                    <div class="bg-white rounded-xl shadow-sm overflow-hidden">
                        <div class="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                            <h3 class="font-bold text-gray-800">All Registered Users</h3>
                            <span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full" id="user-count-badge">0</span>
                        </div>
                        <div class="overflow-x-auto">
                            <table class="w-full text-left text-sm">
                                <thead class="bg-gray-50 text-gray-500 uppercase font-semibold">
                                    <tr>
                                        <th class="px-6 py-4">Name</th>
                                        <th class="px-6 py-4">Email</th>
                                        <th class="px-6 py-4">Plan</th>
                                        <th class="px-6 py-4">Joined Date</th>
                                    </tr>
                                </thead>
                                <tbody id="table-users" class="divide-y divide-gray-100"></tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div id="view-feedback" class="view-section hidden">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="font-bold text-gray-800 text-lg">Message Inbox</h3>
                    </div>
                    <div class="grid grid-cols-1 gap-4" id="feedback-grid">
                        </div>
                </div>

            </main>
        </div>
    </div>

    <script>
        const API_BASE = 'https://api.goreportify.com';
        const token = localStorage.getItem('token');

        // Display Date
        document.getElementById('current-date').innerText = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

        // 1. Auth Check
        if (!token) {
            window.location.href = 'index.html?error=admin_required';
        } else {
            setTimeout(() => document.getElementById('auth-check').style.display = 'none', 500);
            initData();
        }

        // 2. Fetch Data
        async function initData() {
            try {
                const headers = { 'Authorization': `Bearer ${token}` };
                
                const [statsRes, msgsRes, usersRes] = await Promise.all([
                    fetch(`${API_BASE}/api/admin/stats`, { headers }),
                    fetch(`${API_BASE}/api/admin/feedbacks`, { headers }),
                    fetch(`${API_BASE}/api/admin/users`, { headers })
                ]);

                if (statsRes.status === 403) {
                    alert("Access Denied: You are not an Admin.");
                    window.location.href = 'index.html';
                    return;
                }

                if (!statsRes.ok) throw new Error("Backend Connection Failed");

                const stats = await statsRes.json();
                const msgs = await msgsRes.json();
                const users = await usersRes.json();

                renderDashboard(stats);
                renderUserTable(users);
                renderFeedbackList(msgs);
                renderCharts(stats);

            } catch (err) {
                console.error(err);
                if(document.getElementById('stat-users').innerText === '-') {
                    alert("Error: Cannot connect to server. Please ensure you have run 'pm2 restart backend'.");
                }
            }
        }

        // 3. View Switcher
        window.switchView = function(viewName) {
            // Hide all views
            document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
            // Show target view
            document.getElementById(`view-${viewName}`).classList.remove('hidden');
            
            // Update Nav State
            document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
            document.getElementById(`nav-${viewName}`).classList.add('active');

            // Update Title
            const titles = { 'dashboard': 'Dashboard Overview', 'users': 'User Database', 'feedback': 'Feedback & Inbox' };
            document.getElementById('page-title').innerText = titles[viewName];
        }

        // 4. Render Functions
        function renderDashboard(data) {
            document.getElementById('stat-users').innerText = data.users;
            document.getElementById('stat-basic').innerText = data.basic;
            document.getElementById('stat-pros').innerText = data.pros;
            document.getElementById('stat-unread').innerText = data.unread;
        }

        function renderUserTable(users) {
            const tbody = document.getElementById('table-users');
            tbody.innerHTML = '';
            document.getElementById('user-count-badge').innerText = users.length;

            users.forEach(u => {
                let badge = '<span class="px-2 py-1 rounded text-xs bg-gray-100 text-gray-500 font-bold">Free</span>';
                if(u.plan === 'basic') badge = '<span class="px-2 py-1 rounded text-xs bg-green-100 text-green-700 font-bold">Basic</span>';
                if(u.plan === 'pro') badge = '<span class="px-2 py-1 rounded text-xs bg-purple-100 text-purple-700 font-bold">PRO</span>';
                
                tbody.innerHTML += `
                    <tr class="hover:bg-gray-50 border-b border-gray-50 last:border-0">
                        <td class="px-6 py-4 font-medium text-gray-900">${u.name || 'User'}</td>
                        <td class="px-6 py-4 text-gray-500">${u.email}</td>
                        <td class="px-6 py-4">${badge}</td>
                        <td class="px-6 py-4 text-gray-400">${new Date(u.createdAt).toLocaleDateString()}</td>
                    </tr>
                `;
            });
        }

        function renderFeedbackList(msgs) {
            const container = document.getElementById('feedback-grid');
            const dashList = document.getElementById('dash-recent-list');
            
            container.innerHTML = '';
            dashList.innerHTML = '';

            if(msgs.length === 0) {
                const empty = '<div class="text-center py-10 text-gray-400">No feedback messages yet.</div>';
                container.innerHTML = empty;
                dashList.innerHTML = empty;
                return;
            }

            msgs.forEach((msg, index) => {
                // Colors
                const tagColor = msg.type === 'Bug' ? 'bg-red-100 text-red-800' : (msg.type === 'Priority' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800');
                const isVIP = msg.isVIP ? '<span class="ml-2 bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs font-bold">VIP</span>' : '';
                const repliedBadge = msg.status === 'replied' ? '<span class="ml-auto text-green-600 text-xs font-bold"><i class="fas fa-check"></i> Replied</span>' : '';

                // Full Card (Inbox View)
                const card = `
                    <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition">
                        <div class="flex justify-between items-start mb-3">
                            <div class="flex items-center gap-2">
                                <span class="font-bold text-gray-800">${msg.name}</span>
                                ${isVIP}
                            </div>
                            <div class="flex items-center gap-3">
                                ${repliedBadge}
                                <span class="text-xs text-gray-400">${new Date(msg.submittedAt).toLocaleString()}</span>
                            </div>
                        </div>
                        <div class="text-xs text-gray-500 mb-4 flex items-center gap-2">
                            <span class="bg-gray-100 px-2 py-1 rounded">${msg.email}</span>
                            <span class="${tagColor} px-2 py-1 rounded font-bold uppercase tracking-wide text-[10px]">${msg.type || 'General'}</span>
                        </div>
                        <p class="text-gray-700 text-sm bg-gray-50 p-4 rounded mb-4 leading-relaxed border border-gray-100">${msg.message}</p>
                        
                        <div class="flex justify-end border-t pt-4 border-gray-50">
                            <button onclick="openReplyModal('${msg._id}', '${msg.name}')" class="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition shadow-sm flex items-center gap-2">
                                <i class="fas fa-reply"></i> Reply via Email
                            </button>
                        </div>
                    </div>
                `;
                container.innerHTML += card;

                // Mini Item (Dashboard View) - Limit to 5
                if(index < 5) {
                    dashList.innerHTML += `
                        <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm border border-gray-100">
                            <div class="flex items-center gap-3 overflow-hidden">
                                <span class="w-2 h-2 rounded-full ${msg.type === 'Bug' ? 'bg-red-500' : 'bg-blue-500'} flex-shrink-0"></span>
                                <span class="font-medium text-gray-700 truncate">${msg.name}</span>
                                <span class="text-xs text-gray-400 truncate hidden sm:block">- ${msg.message.substring(0, 30)}...</span>
                            </div>
                            <span class="text-xs text-gray-400 whitespace-nowrap">${new Date(msg.submittedAt).toLocaleDateString()}</span>
                        </div>
                    `;
                }
            });
        }

        // 🟢 Reply Logic
        async function openReplyModal(id, name) {
            const reply = prompt(`Reply to ${name} (This will be sent to their email):`, "");
            
            if (reply) {
                try {
                    const res = await fetch(`${API_BASE}/api/admin/reply`, {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}` 
                        },
                        body: JSON.stringify({ feedbackId: id, replyContent: reply })
                    });
                    
                    if(res.ok) {
                        alert("✅ Reply Sent Successfully!");
                        initData(); // Refresh to show "Replied" status
                    } else {
                        const err = await res.json();
                        alert("❌ Failed: " + err.message);
                    }
                } catch(e) {
                    console.error(e);
                    alert("Network Error");
                }
            }
        }

        function renderCharts(data) {
            const ctx = document.getElementById('userChart').getContext('2d');
            if (window.myChart) window.myChart.destroy();
            const free = data.users - data.basic - data.pros;
            
            window.myChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Free Users', 'Basic', 'Pro'],
                    datasets: [{
                        data: [free, data.basic, data.pros],
                        backgroundColor: ['#e2e8f0', '#22c55e', '#9333ea'],
                        borderWidth: 0
                    }]
                },
                options: {
                    cutout: '70%',
                    plugins: { legend: { position: 'bottom' } }
                }
            });
        }

        window.logout = function() {
            localStorage.removeItem('token');
            window.location.href = 'index.html';
        }
    </script>
</body>
</html>
