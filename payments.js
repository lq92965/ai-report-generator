/**
 * Payment history — uses GET /api/payments (same data for web + Capacitor www/).
 */
const API_BASE_URL = 'https://api.goreportify.com';

function planLabel(planId) {
    if (!planId) return '—';
    const map = {
        basic: 'Basic — Monthly',
        pro: 'Pro — Monthly',
        basic_annual: 'Basic — Annual',
        pro_annual: 'Pro — Annual'
    };
    return map[planId] || String(planId);
}

function formatMoneyUSD(n) {
    if (n === undefined || n === null || Number.isNaN(Number(n))) return '—';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n));
}

function formatWhen(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function statusLabel(status) {
    const s = (status || '').toLowerCase();
    if (s === 'completed') return { text: 'Success', cls: 'pay-ok' };
    return { text: status || 'Unknown', cls: 'pay-pending' };
}

async function loadPayments() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = './index.html';
        return;
    }

    const tbody = document.getElementById('payments-tbody');
    const emptyEl = document.getElementById('payments-empty');
    const errEl = document.getElementById('payments-error');
    const tableWrap = document.getElementById('payments-table-wrap');

    if (tbody) tbody.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'none';
    if (errEl) errEl.style.display = 'none';
    if (tableWrap) tableWrap.style.display = '';

    try {
        const res = await fetch(`${API_BASE_URL}/api/payments`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(data.message || `HTTP ${res.status}`);
        }
        const list = data.payments || [];

        if (list.length === 0) {
            if (emptyEl) emptyEl.style.display = 'block';
            return;
        }

        for (const p of list) {
            const st = statusLabel(p.status);
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${formatWhen(p.date)}</td>
                <td>${planLabel(p.planId)}</td>
                <td>${formatMoneyUSD(p.amount)}</td>
                <td><span class="pay-badge ${st.cls}">${st.text}</span></td>
                <td class="mono-small" title="PayPal order id">${escapeHtml(p.paymentId || '—')}</td>
            `;
            tbody.appendChild(tr);
        }
    } catch (e) {
        console.error(e);
        if (tableWrap) tableWrap.style.display = 'none';
        if (errEl) {
            errEl.textContent = e.message || 'Failed to load payments.';
            errEl.style.display = 'block';
        }
    }
}

function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}

document.addEventListener('DOMContentLoaded', () => {
    loadPayments();
    const btn = document.getElementById('payments-refresh');
    if (btn) btn.addEventListener('click', () => loadPayments());
});

window.loadPayments = loadPayments;
