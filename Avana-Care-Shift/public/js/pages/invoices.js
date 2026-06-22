import api from '../api.js';
import * as auth from '../auth.js';
import { formatDate, formatCurrency, capitalize, escapeHtml, showToast, showConfirm, showLoading, hideLoading } from '../utils.js';

let currentPage = 1;

async function render() {
  const container = document.createElement('div');
  container.innerHTML = `
    <div class="filter-bar">
      <div class="filter-group">
        <label>Status:</label>
        <select class="form-control" id="inv-filter-status">
          <option value="">All</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
        </select>
      </div>
      <div class="filter-group" style="flex:1">
        <input type="text" class="form-control" id="inv-search" placeholder="Search invoice # or client..." style="min-width:200px">
      </div>
      <button class="btn btn-sm btn-primary" id="filter-btn">Filter</button>
      ${auth.isAdmin() ? '<button class="btn btn-sm btn-secondary" id="gen-invoice-btn">+ Generate Invoice</button>' : ''}
    </div>
    <div class="card">
      <div class="table-container" id="invoices-table"></div>
      <div id="invoices-pagination"></div>
    </div>
  `;
  return container;
}

function mount() {
  loadInvoices();
  document.getElementById('filter-btn').addEventListener('click', () => { currentPage = 1; loadInvoices(); });
  document.getElementById('inv-search').addEventListener('keydown', (e) => { if (e.key === 'Enter') { currentPage = 1; loadInvoices(); } });
  document.getElementById('inv-filter-status').addEventListener('change', () => { currentPage = 1; loadInvoices(); });
  const genBtn = document.getElementById('gen-invoice-btn');
  if (genBtn) genBtn.addEventListener('click', showGenerateModal);
}

async function loadInvoices() {
  showLoading();
  try {
    const params = new URLSearchParams({ page: currentPage, limit: 20 });
    const status = document.getElementById('inv-filter-status').value;
    const search = document.getElementById('inv-search').value;
    if (status) params.set('status', status);
    if (search) params.set('search', search);
    const data = await api.get(`/invoices?${params}`);
    renderInvoices(data);
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    hideLoading();
  }
}

function renderInvoices(data) {
  const container = document.getElementById('invoices-table');
  const pagination = document.getElementById('invoices-pagination');

  if (data.invoices.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">💰</div><h3>No invoices</h3><p>No invoices found.</p></div>';
    pagination.innerHTML = '';
    return;
  }

  const isAdmin = auth.isAdmin();

  let html = `<table>
    <thead><tr><th>Invoice #</th><th>Client</th><th>Staff</th><th>Hours</th><th>Total</th><th>Status</th><th>Due Date</th><th>Actions</th></tr></thead><tbody>`;

  data.invoices.forEach(inv => {
    html += `<tr>
      <td><strong>${escapeHtml(inv.invoice_number)}</strong></td>
      <td>${escapeHtml(inv.client_name)}</td>
      <td>${escapeHtml(inv.staff_name || '—')}</td>
      <td>${inv.hours_worked}h</td>
      <td>${formatCurrency(inv.total)}</td>
      <td><span class="badge badge-${inv.status}">${capitalize(inv.status)}</span></td>
      <td>${formatDate(inv.due_date)}</td>
      <td>
        <div class="table-actions">
          <button class="btn btn-sm btn-outline" onclick="viewInvoice(${inv.id})">👁</button>
          <button class="btn btn-sm btn-info" onclick="downloadInvoicePDF(${inv.id})">📄</button>
          ${isAdmin && inv.status !== 'paid' ? `<button class="btn btn-sm btn-success" onclick="payInvoice(${inv.id})">Pay</button>` : ''}
        </div>
      </td>
    </tr>`;
  });

  html += '</tbody></table>';
  container.innerHTML = html;

  if (data.pagination.pages > 1) {
    let phtml = '<div class="pagination">';
    for (let i = 1; i <= data.pagination.pages; i++) {
      phtml += `<button class="${i === data.pagination.page ? 'active' : ''}" onclick="window.invPage(${i})">${i}</button>`;
    }
    phtml += '</div>';
    pagination.innerHTML = phtml;
  }
}

window.invPage = (p) => { currentPage = p; loadInvoices(); };

window.viewInvoice = async (id) => {
  try {
    const data = await api.get(`/invoices/${id}`);
    const inv = data.invoice;
    const content = `
      <div class="detail-grid">
        <div class="detail-item"><div class="detail-label">Invoice #</div><div class="detail-value">${escapeHtml(inv.invoice_number)}</div></div>
        <div class="detail-item"><div class="detail-label">Client</div><div class="detail-value">${escapeHtml(inv.client_name)}</div></div>
        <div class="detail-item"><div class="detail-label">Staff</div><div class="detail-value">${escapeHtml(inv.staff_name || '—')}</div></div>
        <div class="detail-item"><div class="detail-label">Status</div><div class="detail-value"><span class="badge badge-${inv.status}">${capitalize(inv.status)}</span></div></div>
        <div class="detail-item"><div class="detail-label">Hours</div><div class="detail-value">${inv.hours_worked}h @ ${formatCurrency(inv.hourly_rate)}/hr</div></div>
        <div class="detail-item"><div class="detail-label">Subtotal</div><div class="detail-value">${formatCurrency(inv.subtotal)}</div></div>
        <div class="detail-item"><div class="detail-label">Tax (${inv.tax_rate}%)</div><div class="detail-value">${formatCurrency(inv.tax)}</div></div>
        <div class="detail-item"><div class="detail-label">Total</div><div class="detail-value" style="font-size:18px;font-weight:700">${formatCurrency(inv.total)}</div></div>
        <div class="detail-item"><div class="detail-label">Due Date</div><div class="detail-value">${formatDate(inv.due_date)}</div></div>
        <div class="detail-item"><div class="detail-label">Created</div><div class="detail-value">${formatDate(inv.created_at)}</div></div>
      </div>
      <div class="mt-4 flex gap-2">
        <button class="btn btn-sm btn-info" onclick="downloadInvoicePDF(${id})">📄 Download PDF</button>
      </div>
    `;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `<div class="modal modal-lg"><div class="modal-header"><h3>Invoice ${escapeHtml(inv.invoice_number)}</h3><button class="modal-close">&times;</button></div><div class="modal-body">${content}</div></div>`;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.querySelector('.modal-close').onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.downloadInvoicePDF = async (id) => {
  try {
    const token = api.getToken();
    const response = await fetch(`/api/invoices/${id}/pdf`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to download PDF');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoice-${id}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.payInvoice = async (id) => {
  const confirmed = await showConfirm('Mark as Paid', 'Mark this invoice as paid?');
  if (!confirmed) return;
  try {
    await api.put(`/invoices/${id}/pay`);
    showToast('Invoice marked as paid!', 'success');
    loadInvoices();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

function showGenerateModal() {
  const modal = document.createElement('div');
  modal.innerHTML = `
    <div class="modal-overlay">
      <div class="modal modal-lg">
        <div class="modal-header"><h3>Generate Invoice</h3><button class="modal-close">&times;</button></div>
        <div class="modal-body">
          <div class="form-row">
            <div class="form-group">
              <label>Client *</label>
              <select class="form-control" id="inv-client"></select>
            </div>
            <div class="form-group">
              <label>Staff</label>
              <select class="form-control" id="inv-staff"><option value="">—</option></select>
            </div>
          </div>
          <div class="form-row-3">
            <div class="form-group"><label>Hours</label><input type="number" step="0.5" class="form-control" id="inv-hours" value="3"></div>
            <div class="form-group"><label>Rate ($/hr)</label><input type="number" step="0.01" class="form-control" id="inv-rate" value="35"></div>
            <div class="form-group"><label>Tax Rate (%)</label><input type="number" step="0.1" class="form-control" id="inv-tax" value="10"></div>
          </div>
          <div class="form-group"><label>Notes</label><textarea class="form-control" id="inv-notes" rows="2"></textarea></div>
        </div>
        <div class="modal-footer"><button class="btn btn-outline" id="g-cancel">Cancel</button><button class="btn btn-primary" id="g-save">Generate</button></div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelector('.modal-close').onclick = close;
  modal.querySelector('#g-cancel').onclick = close;

  // Load clients & staff
  api.get('/clients').then(d => {
    const sel = document.getElementById('inv-client');
    d.clients.forEach(c => { sel.innerHTML += `<option value="${c.id}">${escapeHtml(c.name)}</option>`; });
  });
  api.get('/staff').then(d => {
    const sel = document.getElementById('inv-staff');
    d.staff.forEach(s => { sel.innerHTML += `<option value="${s.id}">${escapeHtml(s.username)}</option>`; });
  });

  modal.querySelector('#g-save').onclick = async () => {
    const data = {
      client_id: parseInt(document.getElementById('inv-client').value),
      staff_id: parseInt(document.getElementById('inv-staff').value) || null,
      hours_worked: parseFloat(document.getElementById('inv-hours').value) || 0,
      hourly_rate: parseFloat(document.getElementById('inv-rate').value) || 0,
      tax_rate: parseFloat(document.getElementById('inv-tax').value) || 0,
      notes: document.getElementById('inv-notes').value
    };
    if (!data.client_id) { showToast('Please select a client.', 'error'); return; }
    try {
      await api.post('/invoices', data);
      showToast('Invoice generated!', 'success');
      close();
      loadInvoices();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };
}

export default { render, mount, unmount: () => {} };
