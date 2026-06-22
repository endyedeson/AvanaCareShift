import api from '../api.js';
import * as auth from '../auth.js';
import { formatDate, escapeHtml, showToast, showConfirm, showLoading, hideLoading } from '../utils.js';

let currentPage = 1;

async function render() {
  const container = document.createElement('div');
  container.innerHTML = `
    <div class="filter-bar">
      <div class="filter-group" style="flex:1">
        <input type="text" class="form-control" id="client-search" placeholder="Search clients..." style="min-width:200px">
      </div>
      <button class="btn btn-sm btn-primary" id="filter-btn">Search</button>
      <button class="btn btn-sm btn-secondary" id="add-client-btn">+ Add Client</button>
    </div>
    <div class="card">
      <div class="table-container" id="clients-table"></div>
      <div id="clients-pagination"></div>
    </div>
  `;
  return container;
}

function mount() {
  loadClients();
  document.getElementById('filter-btn').addEventListener('click', () => { currentPage = 1; loadClients(); });
  document.getElementById('client-search').addEventListener('keydown', (e) => { if (e.key === 'Enter') { currentPage = 1; loadClients(); } });
  document.getElementById('add-client-btn').addEventListener('click', showCreateModal);
}

async function loadClients() {
  showLoading();
  try {
    const params = new URLSearchParams({ page: currentPage, limit: 20 });
    const search = document.getElementById('client-search').value;
    if (search) params.set('search', search);
    const data = await api.get(`/clients?${params}`);
    renderClients(data);
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    hideLoading();
  }
}

function renderClients(data) {
  const container = document.getElementById('clients-table');
  const pagination = document.getElementById('clients-pagination');

  if (data.clients.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">👥</div><h3>No clients</h3><p>No clients found. Add your first client.</p></div>';
    pagination.innerHTML = '';
    return;
  }

  let html = `<table>
    <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Preferred Caregiver</th><th>Status</th><th>Actions</th></tr></thead><tbody>`;

  data.clients.forEach(c => {
    html += `<tr>
      <td><strong>${escapeHtml(c.name)}</strong></td>
      <td>${escapeHtml(c.email || '—')}</td>
      <td>${escapeHtml(c.phone || '—')}</td>
      <td>${escapeHtml(c.preferred_caregiver_name || '—')}</td>
      <td><span class="badge badge-${c.status}">${escapeHtml(c.status)}</span></td>
      <td>
        <div class="table-actions">
          <button class="btn btn-sm btn-outline" onclick="viewClient(${c.id})">👁</button>
          <button class="btn btn-sm btn-primary" onclick="editClient(${c.id})">✎</button>
          <button class="btn btn-sm btn-danger" onclick="deleteClient(${c.id})">🗑</button>
        </div>
      </td>
    </tr>`;
  });

  html += '</tbody></table>';
  container.innerHTML = html;

  if (data.pagination.pages > 1) {
    let phtml = '<div class="pagination">';
    for (let i = 1; i <= data.pagination.pages; i++) {
      phtml += `<button class="${i === data.pagination.page ? 'active' : ''}" onclick="window.clientPage(${i})">${i}</button>`;
    }
    phtml += '</div>';
    pagination.innerHTML = phtml;
  }
}

window.clientPage = (p) => { currentPage = p; loadClients(); };

window.viewClient = async (id) => {
  try {
    const data = await api.get(`/clients/${id}`);
    const c = data.client;
    const content = `
      <div class="detail-grid">
        <div class="detail-item"><div class="detail-label">Name</div><div class="detail-value">${escapeHtml(c.name)}</div></div>
        <div class="detail-item"><div class="detail-label">Email</div><div class="detail-value">${escapeHtml(c.email)}</div></div>
        <div class="detail-item"><div class="detail-label">Phone</div><div class="detail-value">${escapeHtml(c.phone)}</div></div>
        <div class="detail-item"><div class="detail-label">Address</div><div class="detail-value">${escapeHtml(c.address)}</div></div>
        <div class="detail-item"><div class="detail-label">Emergency Contact</div><div class="detail-value">${escapeHtml(c.emergency_contact || '—')} ${c.emergency_phone ? '(' + c.emergency_phone + ')' : ''}</div></div>
        <div class="detail-item"><div class="detail-label">Medical Notes</div><div class="detail-value">${escapeHtml(c.medical_notes || '—')}</div></div>
        <div class="detail-item"><div class="detail-label">Preferred Caregiver</div><div class="detail-value">${escapeHtml(c.preferred_caregiver_name || '—')}</div></div>
        <div class="detail-item"><div class="detail-label">Member Since</div><div class="detail-value">${formatDate(c.created_at)}</div></div>
      </div>
      ${data.recentShifts.length > 0 ? `
        <h4 class="mt-4">Recent Shifts</h4>
        <div class="table-container">
          <table>
            <thead><tr><th>Date</th><th>Staff</th><th>Service</th><th>Status</th></tr></thead>
            <tbody>${data.recentShifts.map(s => `<tr><td>${formatDate(s.date)}</td><td>${escapeHtml(s.staff_name)}</td><td>${escapeHtml(s.service_type)}</td><td><span class="badge badge-${s.status}">${escapeHtml(s.status)}</span></td></tr>`).join('')}</tbody>
          </table>
        </div>
      ` : ''}
    `;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `<div class="modal modal-lg"><div class="modal-header"><h3>${escapeHtml(c.name)}</h3><button class="modal-close">&times;</button></div><div class="modal-body">${content}</div></div>`;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.querySelector('.modal-close').onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.editClient = async (id) => {
  try {
    const data = await api.get(`/clients/${id}`);
    const c = data.client;
    const modal = document.createElement('div');
    modal.innerHTML = `
      <div class="modal-overlay">
        <div class="modal modal-lg">
          <div class="modal-header"><h3>Edit Client</h3><button class="modal-close">&times;</button></div>
          <div class="modal-body">
            <div class="form-row">
              <div class="form-group"><label>Name</label><input type="text" class="form-control" id="e-name" value="${escapeHtml(c.name || '')}"></div>
              <div class="form-group"><label>Phone</label><input type="tel" class="form-control" id="e-phone" value="${escapeHtml(c.phone || '')}"></div>
            </div>
            <div class="form-group"><label>Address</label><input type="text" class="form-control" id="e-address" value="${escapeHtml(c.address || '')}"></div>
            <div class="form-row">
              <div class="form-group"><label>Emergency Contact</label><input type="text" class="form-control" id="e-emergency" value="${escapeHtml(c.emergency_contact || '')}"></div>
              <div class="form-group"><label>Emergency Phone</label><input type="tel" class="form-control" id="e-emergency-phone" value="${escapeHtml(c.emergency_phone || '')}"></div>
            </div>
            <div class="form-group"><label>Medical Notes</label><textarea class="form-control" id="e-medical">${escapeHtml(c.medical_notes || '')}</textarea></div>
            <div class="form-group"><label>Status</label><select class="form-control" id="e-status"><option value="active" ${c.status === 'active' ? 'selected' : ''}>Active</option><option value="inactive" ${c.status === 'inactive' ? 'selected' : ''}>Inactive</option></select></div>
          </div>
          <div class="modal-footer"><button class="btn btn-outline" id="e-cancel">Cancel</button><button class="btn btn-primary" id="e-save">Save</button></div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector('.modal-close').onclick = close;
    modal.querySelector('#e-cancel').onclick = close;
    modal.querySelector('#e-save').onclick = async () => {
      const updates = {
        name: document.getElementById('e-name').value,
        phone: document.getElementById('e-phone').value,
        address: document.getElementById('e-address').value,
        emergency_contact: document.getElementById('e-emergency').value,
        emergency_phone: document.getElementById('e-emergency-phone').value,
        medical_notes: document.getElementById('e-medical').value,
        status: document.getElementById('e-status').value
      };
      try {
        await api.put(`/clients/${id}`, updates);
        showToast('Client updated!', 'success');
        close();
        loadClients();
      } catch (err) {
        showToast(err.message, 'error');
      }
    };
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.deleteClient = async (id) => {
  const confirmed = await showConfirm('Delete Client', 'This will permanently delete this client and their user account. Continue?', 'Delete', 'Cancel', true);
  if (!confirmed) return;
  try {
    await api.delete(`/clients/${id}`);
    showToast('Client deleted.', 'success');
    loadClients();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

function showCreateModal() {
  const modal = document.createElement('div');
  modal.innerHTML = `
    <div class="modal-overlay">
      <div class="modal modal-lg">
        <div class="modal-header"><h3>Add Client</h3><button class="modal-close">&times;</button></div>
        <div class="modal-body">
          <div class="form-row">
            <div class="form-group"><label>Full Name *</label><input type="text" class="form-control" id="c-name" required></div>
            <div class="form-group"><label>Username *</label><input type="text" class="form-control" id="c-username" required></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Email *</label><input type="email" class="form-control" id="c-email" required></div>
            <div class="form-group"><label>Password *</label><input type="password" class="form-control" id="c-password" required></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Phone</label><input type="tel" class="form-control" id="c-phone"></div>
            <div class="form-group"><label>Address</label><input type="text" class="form-control" id="c-address"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Emergency Contact</label><input type="text" class="form-control" id="c-ec"></div>
            <div class="form-group"><label>Emergency Phone</label><input type="tel" class="form-control" id="c-ec-phone"></div>
          </div>
          <div class="form-group"><label>Medical Notes</label><textarea class="form-control" id="c-medical" rows="2"></textarea></div>
        </div>
        <div class="modal-footer"><button class="btn btn-outline" id="c-cancel">Cancel</button><button class="btn btn-primary" id="c-save">Create Client</button></div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelector('.modal-close').onclick = close;
  modal.querySelector('#c-cancel').onclick = close;
  modal.querySelector('#c-save').onclick = async () => {
    const data = {
      name: document.getElementById('c-name').value.trim(),
      username: document.getElementById('c-username').value.trim(),
      email: document.getElementById('c-email').value.trim(),
      password: document.getElementById('c-password').value,
      phone: document.getElementById('c-phone').value.trim(),
      address: document.getElementById('c-address').value.trim(),
      emergency_contact: document.getElementById('c-ec').value.trim(),
      emergency_phone: document.getElementById('c-ec-phone').value.trim(),
      medical_notes: document.getElementById('c-medical').value.trim()
    };
    if (!data.name || !data.username || !data.email || !data.password) {
      showToast('Name, username, email, and password are required.', 'error');
      return;
    }
    try {
      await api.post('/clients', data);
      showToast('Client created!', 'success');
      close();
      loadClients();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };
}

export default { render, mount, unmount: () => {} };
