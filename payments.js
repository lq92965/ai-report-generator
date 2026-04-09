/**
 * Payment history — uses GET /api/payments (same data for web + Capacitor www/).
 * Prefer script.js `window.REPORTIFY_API_BASE` when present (single source of truth).
 */
const API_BASE_URL = (typeof window !== 'undefined' && window.REPORTIFY_API_BASE) || 'https://api.goreportify.com';

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
            if (tableWrap) tableWrap.style.display = 'none';
            return;
        }

        for (const p of list) {
            const st = statusLabel(p.status);
            const oid = p.paymentId || '';
            const appeal = oid
                ? `<a href="${billingAppealUrl(oid)}" class="pay-appeal-link">Contact + prefill</a>
                   <button type="button" class="pay-copy-btn" data-oid="${escapeHtml(oid)}">Copy ID</button>`
                : '—';
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${formatWhen(p.date)}</td>
                <td>${planLabel(p.planId)}</td>
                <td>${formatMoneyUSD(p.amount)}</td>
                <td><span class="pay-badge ${st.cls}">${st.text}</span></td>
                <td class="mono-small" title="PayPal order id">${escapeHtml(oid || '—')}</td>
                <td class="pay-actions-cell">${appeal}</td>
            `;
            tbody.appendChild(tr);
        }
        tbody.querySelectorAll('.pay-copy-btn').forEach((btn) => {
            btn.addEventListener('click', () => copyOrderIdForEmail(btn.getAttribute('data-oid') || ''));
        });
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

function billingAppealUrl(orderId) {
    const q = new URLSearchParams({ topic: 'Billing', orderId: orderId || '' });
    return `contact.html?${q.toString()}`;
}

async function copyOrderIdForEmail(orderId) {
    const text = `PayPal Order ID: ${orderId}\n(Account email: see your profile)`;
    try {
        await navigator.clipboard.writeText(text);
        if (window.showToast) window.showToast('Order ID copied. Paste into email or our contact form.', 'success');
        else alert('Copied to clipboard.');
    } catch (e) {
        prompt('Copy this text:', text);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadPayments();
    const btn = document.getElementById('payments-refresh');
    if (btn) btn.addEventListener('click', () => loadPayments());
});

window.loadPayments = loadPayments;
