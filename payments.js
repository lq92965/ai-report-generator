/**
 * Payment history — uses GET /api/payments (same data for web + Capacitor www/).
 * Prefer script.js `window.REPORTIFY_API_BASE` when present (single source of truth).
 */
/** Must not be named API_BASE_URL — script.js on the same page already declares that const. */
const PAYMENTS_API_BASE =
    (typeof window !== 'undefined' && window.REPORTIFY_API_BASE) || 'https://api.goreportify.com';

const PAYMENTS_PAGE_SIZE = 10;

let paymentsAll = [];
let paymentsPage = 1;

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

function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}

function billingAppealUrl(orderId) {
    const q = new URLSearchParams({ topic: 'Billing', orderId: orderId || '' });
    return `contact.html?${q.toString()}`;
}

function renderPaymentsTable() {
    const tbody = document.getElementById('payments-tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    const total = paymentsAll.length;
    if (total === 0) return;

    const totalPages = Math.max(1, Math.ceil(total / PAYMENTS_PAGE_SIZE));
    if (paymentsPage > totalPages) paymentsPage = totalPages;
    const start = (paymentsPage - 1) * PAYMENTS_PAGE_SIZE;
    const slice = paymentsAll.slice(start, start + PAYMENTS_PAGE_SIZE);

    for (const p of slice) {
        const st = statusLabel(p.status);
        const oid = p.paymentId || '';
        const appealUrl = billingAppealUrl(oid);
        const desktopHelp = oid
            ? `<a href="${appealUrl}" class="pay-appeal-link">Contact + prefill</a>`
            : '—';
        const copyIconBtn = oid
            ? `<button type="button" class="pay-copy-icon-btn" data-oid="${escapeHtml(oid)}" aria-label="Copy order ID" title="Copy order ID"><i class="fas fa-copy"></i></button>`
            : '';
        const tr = document.createElement('tr');
        tr.className = 'pay-row';
        tr.innerHTML = `
            <td class="pay-desktop-only">${formatWhen(p.date)}</td>
            <td class="pay-desktop-only">${planLabel(p.planId)}</td>
            <td class="pay-desktop-only">${formatMoneyUSD(p.amount)}</td>
            <td class="pay-desktop-only"><span class="pay-badge ${st.cls}">${st.text}</span></td>
            <td class="pay-desktop-only mono-small" title="PayPal order id">${escapeHtml(oid || '—')}</td>
            <td class="pay-desktop-only pay-actions-cell">${desktopHelp}</td>
            <td class="pay-mobile-only" colspan="6">
                <div class="pay-mobile-card">
                    <div class="pay-mobile-line1">
                        <span class="pay-mobile-meta">${formatWhen(p.date)}</span>
                        <span class="pay-mobile-meta pay-mobile-dot" aria-hidden="true">·</span>
                        <span class="pay-mobile-order mono-small">${escapeHtml(oid || '—')}</span>
                        ${copyIconBtn}
                    </div>
                    <div class="pay-mobile-line2">
                        <span class="pay-mobile-plan">${planLabel(p.planId)}</span>
                        <span class="pay-mobile-amount">${formatMoneyUSD(p.amount)}</span>
                        <span class="pay-mobile-status"><span class="pay-badge ${st.cls}">${st.text}</span></span>
                    </div>
                    <div class="pay-mobile-line3">
                        <a href="${appealUrl}" class="pay-mobile-help">Help — payment issue</a>
                    </div>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    }

    tbody.querySelectorAll('.pay-copy-icon-btn').forEach((btn) => {
        btn.addEventListener('click', () => copyOrderIdForEmail(btn.getAttribute('data-oid') || ''));
    });

    renderPagination(total, totalPages, start, slice.length);
}

function renderPagination(total, totalPages, startIdx, sliceLen) {
    const el = document.getElementById('payments-pagination');
    if (!el) return;

    /* 有条目就始终显示分页（含仅 1 页 / ≤10 条），避免「翻页没做」的误解 */
    if (total === 0) {
        el.className = 'payments-pagination';
        el.innerHTML = '';
        el.setAttribute('aria-hidden', 'true');
        return;
    }

    el.className = 'payments-pagination is-visible';
    el.setAttribute('aria-hidden', 'false');
    const from = startIdx + 1;
    const to = startIdx + sliceLen;
    el.innerHTML = `
        <button type="button" id="payments-prev" ${paymentsPage <= 1 ? 'disabled' : ''} aria-label="Previous page">Prev</button>
        <span id="payments-page-info">Page ${paymentsPage} / ${totalPages} · ${from}–${to} of ${total}</span>
        <button type="button" id="payments-next" ${paymentsPage >= totalPages ? 'disabled' : ''} aria-label="Next page">Next</button>
    `;

    const prev = document.getElementById('payments-prev');
    const next = document.getElementById('payments-next');
    if (prev) prev.addEventListener('click', () => goPaymentsPage(paymentsPage - 1));
    if (next) next.addEventListener('click', () => goPaymentsPage(paymentsPage + 1));
}

function goPaymentsPage(p) {
    const totalPages = Math.max(1, Math.ceil(paymentsAll.length / PAYMENTS_PAGE_SIZE));
    if (p < 1 || p > totalPages) return;
    paymentsPage = p;
    renderPaymentsTable();
    const wrap = document.getElementById('payments-table-wrap');
    if (wrap) wrap.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
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
    const refreshBtn = document.getElementById('payments-refresh');
    const pagEl = document.getElementById('payments-pagination');

    if (tbody) tbody.innerHTML = '';
    if (pagEl) {
        pagEl.className = 'payments-pagination';
        pagEl.innerHTML = '';
    }
    if (emptyEl) emptyEl.style.display = 'none';
    if (errEl) errEl.style.display = 'none';
    if (tableWrap) tableWrap.style.display = '';
    if (refreshBtn) {
        refreshBtn.disabled = true;
        refreshBtn.style.opacity = '0.7';
    }

    paymentsAll = [];
    paymentsPage = 1;

    try {
        const url = `${PAYMENTS_API_BASE}/api/payments?t=${Date.now()}`;
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store'
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(data.message || `HTTP ${res.status}`);
        }
        const list = data.payments || [];

        if (list.length === 0) {
            if (emptyEl) {
                emptyEl.innerHTML = `
                    <i class="fas fa-receipt" style="font-size: 2rem; margin-bottom: 12px; opacity: 0.6;"></i>
                    <p style="margin: 0; font-size: 1rem;">No payments found for this account.</p>
                    <p style="margin: 12px 0 0; font-size: 0.88rem; color: #64748b; line-height: 1.5; max-width: 520px; margin-left: auto; margin-right: auto;">
                        Records appear after a successful checkout and server upgrade. If you paid but see nothing:
                        hard-refresh this page (Ctrl+F5), sign out and sign in again, and confirm the site is using the latest <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;">server.js</code>.
                        API in use: <strong>${escapeHtml(PAYMENTS_API_BASE)}</strong>.
                        You can still use <strong>Contact (Billing)</strong> with your PayPal Order ID from the PayPal receipt.
                    </p>`;
                emptyEl.style.display = 'block';
            }
            if (tableWrap) tableWrap.style.display = 'none';
            return;
        }

        paymentsAll = list;
        renderPaymentsTable();
    } catch (e) {
        console.error(e);
        if (tableWrap) tableWrap.style.display = 'none';
        if (errEl) {
            errEl.textContent = e.message || 'Failed to load payments.';
            errEl.style.display = 'block';
        }
    } finally {
        if (refreshBtn) {
            refreshBtn.disabled = false;
            refreshBtn.style.opacity = '1';
        }
    }
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
