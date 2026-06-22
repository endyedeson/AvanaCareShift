import api from '../api.js';
import { escapeHtml, showToast, showConfirm, showLoading, hideLoading } from '../utils.js';

let currentPage = 1;

async function render() {
  const container = document.createElement('div');
  container.innerHTML = `
    <div class="filter-bar">
      <div class="filter-group" style="flex:1">
        <input type="text" class="form-control" id="staff-search" placeholder="Search staff..." style="min-width:200px">
      </div>
      <button class="btn btn-sm btn-primary" id="filter-btn">Search</button>
      <button class="btn btn-sm btn-secondary" id="add-staff-btn">+ Add Staff</button>
    </div>
    <div class="card">
      <div class="table-container" id="staff-table"></div>
      <div id="staff-pagination"></div>
    </div>
  `;
  return container;
}

function mount() {
  loadStaff();
  document.getElementById('filter-btn').addEventListener('click', () => { currentPage = 1; loadStaff(); });
  document.getElementById('staff-search').addEventListener('keydown', (e) => { if (e.key === 'Enter') { currentPage = 1; loadStaff(); } });
  document.getElementById('add-staff-btn').addEventListener('click', showCreateModal);
}

async function loadStaff() {
  showLoading();
  try {
    const params = new URLSearchParams({ page: currentPage, limit: 20 });
    const search = document.getElementById('staff-search').value;
    if (search) params.set('search', search);
    const data = await api.get(`/staff?${params}`);
    renderStaff(data);
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    hideLoading();
  }
}

function renderStaff(data) {
  const container = document.getElementById('staff-table');
  const pagination = document.getElementById('staff-pagination');

  if (data.staff.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">👤</div><h3>No staff</h3><p>No staff members found.</p></div>';
    pagination.innerHTML = '';
    return;
  }

  let html = `<table>
    <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Skills</th><th>Rating</th><th>Shifts</th><th>Status</th><th>Actions</th></tr></thead><tbody>`;

  data.staff.forEach(s => {
    html += `<tr>
      <td><strong>${escapeHtml(s.username)}</strong></td>
      <td>${escapeHtml(s.email)}</td>
      <td>${escapeHtml(s.phone || '—')}</td>
      <td><span style="font-size:12px">${escapeHtml((s.skills || '').slice(0, 40))}</span></td>
      <td>${s.rating ? '★'.repeat(Math.round(s.rating)) : '—'}</td>
      <td>${s.completed_shifts || 0}</td>
      <td><span class="badge badge-${s.status}">${escapeHtml(s.status)}</span></td>
      <td>
        <div class="table-actions">
          <button class="btn btn-sm btn-outline" onclick="viewStaff(${s.id})">👁</button>
          <button class="btn btn-sm btn-primary" onclick="editStaff(${s.id})">✎</button>
          <button class="btn btn-sm btn-danger" onclick="deleteStaff(${s.id})">🗑</button>
        </div>
      </td>
    </tr>`;
  });

  html += '</tbody></table>';
  container.innerHTML = html;

  if (data.pagination.pages > 1) {
    let phtml = '<div class="pagination">';
    for (let i = 1; i <= data.pagination.pages; i++) {
      phtml += `<button class="${i === data.pagination.page ? 'active' : ''}" onclick="window.staffPage(${i})">${i}</button>`;
    }
    phtml += '</div>';
    pagination.innerHTML = phtml;
  }
}

window.staffPage = (p) => { currentPage = p; loadStaff(); };

window.viewStaff = async (id) => {
  try {
    const data = await api.get(`/staff/${id}`);
    const s = data.staff;
    const content = `
      <div class="detail-grid">
        <div class="detail-item"><div class="detail-label">Name</div><div class="detail-value">${escapeHtml(s.username)}</div></div>
        <div class="detail-item"><div class="detail-label">Email</div><div class="detail-value">${escapeHtml(s.email)}</div></div>
        <div class="detail-item"><div class="detail-label">Phone</div><div class="detail-value">${escapeHtml(s.phone || '—')}</div></div>
        <div class="detail-item"><div class="detail-label">Skills</div><div class="detail-value">${escapeHtml(s.skills || '—')}</div></div>
        <div class="detail-item"><div class="detail-label">Qualifications</div><div class="detail-value">${escapeHtml(s.qualifications || '—')}</div></div>
        <div class="detail-item"><div class="detail-label">Rating</div><div class="detail-value">${s.rating ? '★'.repeat(Math.round(s.rating)) + ' ' + s.rating : '—'}</div></div>
        <div class="detail-item"><div class="detail-label">Completed Shifts</div><div class="detail-value">${s.completed_shifts || 0}</div></div>
        <div class="detail-item"><div class="detail-label">Bio</div><div class="detail-value">${escapeHtml(s.bio || '—')}</div></div>
      </div>
      ${data.availability.length > 0 ? `
        <h4 class="mt-4">Availability</h4>
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:8px">
          ${data.availability.map(a => `<span class="badge badge-active">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][a.day_of_week]} - ${a.time_slot}</span>`).join('')}
        </div>
      ` : ''}
    `;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `<div class="modal modal-lg"><div class="modal-header"><h3>${escapeHtml(s.username)}</h3><button class="modal-close">&times;</button></div><div class="modal-body">${content}</div></div>`;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.querySelector('.modal-close').onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.editStaff = async (id) => {
  try {
    const data = await api.get(`/staff/${id}`);
    const s = data.staff;
    const modal = document.createElement('div');
    modal.innerHTML = `
      <div class="modal-overlay">
        <div class="modal modal-lg">
          <div class="modal-header"><h3>Edit Staff</h3><button class="modal-close">&times;</button></div>
          <div class="modal-body">
            <div class="form-row">
              <div class="form-group"><label>Username</label><input type="text" class="form-control" id="e-username" value="${escapeHtml(s.username || '')}"></div>
              <div class="form-group"><label>Email</label><input type="email" class="form-control" id="e-email" value="${escapeHtml(s.email || '')}"></div>
            </div>
            <div class="form-row">
              <div class="form-group"><label>Phone</label><input type="tel" class="form-control" id="e-phone" value="${escapeHtml(s.phone || '')}"></div>
              <div class="form-group"><label>Address</label><input type="text" class="form-control" id="e-address" value="${escapeHtml(s.address || '')}"></div>
            </div>
            <div class="form-group"><label>Skills</label><input type="text" class="form-control" id="e-skills" value="${escapeHtml(s.skills || '')}"></div>
            <div class="form-group"><label>Qualifications</label><input type="text" class="form-control" id="e-qualifications" value="${escapeHtml(s.qualifications || '')}"></div>
            <div class="form-group"><label>Bio</label><textarea class="form-control" id="e-bio">${escapeHtml(s.bio || '')}</textarea></div>
            <div class="form-group"><label>Status</label><select class="form-control" id="e-status"><option value="active" ${s.status === 'active' ? 'selected' : ''}>Active</option><option value="inactive" ${s.status === 'inactive' ? 'selected' : ''}>Inactive</option></select></div>
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
      const updates = {};
      if (document.getElementById('e-username').value !== s.username) updates.username = document.getElementById('e-username').value;
      if (document.getElementById('e-email').value !== s.email) updates.email = document.getElementById('e-email').value;
      updates.phone = document.getElementById('e-phone').value;
      updates.address = document.getElementById('e-address').value;
      updates.skills = document.getElementById('e-skills').value;
      updates.qualifications = document.getElementById('e-qualifications').value;
      updates.bio = document.getElementById('e-bio').value;
      updates.status = document.getElementById('e-status').value;
      try {
        await api.put(`/staff/${id}`, updates);
        showToast('Staff updated!', 'success');
        close();
        loadStaff();
      } catch (err) {
        showToast(err.message, 'error');
      }
    };
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.deleteStaff = async (id) => {
  const confirmed = await showConfirm('Delete Staff', 'This will permanently delete this staff member. Continue?', 'Delete', 'Cancel', true);
  if (!confirmed) return;
  try {
    await api.delete(`/staff/${id}`);
    showToast('Staff deleted.', 'success');
    loadStaff();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

function showCreateModal() {
  const modal = document.createElement('div');
  modal.innerHTML = `
    <div class="modal-overlay">
      <div class="modal modal-lg">
        <div class="modal-header"><h3>Add Staff</h3><button class="modal-close">&times;</button></div>
        <div class="modal-body">
          <div class="form-row">
            <div class="form-group"><label>Username *</label><input type="text" class="form-control" id="s-username" required></div>
            <div class="form-group"><label>Email *</label><input type="email" class="form-control" id="s-email" required></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Password *</label><input type="password" class="form-control" id="s-password" required></div>
            <div class="form-group"><label>Phone</label><input type="tel" class="form-control" id="s-phone"></div>
          </div>
          <div class="form-group"><label>Address</label><input type="text" class="form-control" id="s-address"></div>
          <div class="form-group"><label>Skills</label><input type="text" class="form-control" id="s-skills" placeholder="e.g., Personal Care, Companionship, Medication Reminder"></div>
          <div class="form-group"><label>Qualifications</label><input type="text" class="form-control" id="s-qualifications" placeholder="e.g., CNA, CPR Certified"></div>
          <div class="form-group"><label>Bio</label><textarea class="form-control" id="s-bio" rows="2"></textarea></div>
        </div>
        <div class="modal-footer"><button class="btn btn-outline" id="s-cancel">Cancel</button><button class="btn btn-primary" id="s-save">Create Staff</button></div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelector('.modal-close').onclick = close;
  modal.querySelector('#s-cancel').onclick = close;
  modal.querySelector('#s-save').onclick = async () => {
    const data = {
      username: document.getElementById('s-username').value.trim(),
      email: document.getElementById('s-email').value.trim(),
      password: document.getElementById('s-password').value,
      phone: document.getElementById('s-phone').value.trim(),
      address: document.getElementById('s-address').value.trim(),
      skills: document.getElementById('s-skills').value.trim(),
      qualifications: document.getElementById('s-qualifications').value.trim(),
      bio: document.getElementById('s-bio').value.trim()
    };
    if (!data.username || !data.email || !data.password) {
      showToast('Username, email, and password are required.', 'error');
      return;
    }
    try {
      await api.post('/staff', data);
      showToast('Staff created!', 'success');
      close();
      loadStaff();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };
}

export default { render, mount, unmount: () => {} };
