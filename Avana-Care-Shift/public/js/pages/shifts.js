import api from '../api.js';
import * as auth from '../auth.js';
import { formatDate, formatTime, formatCurrency, capitalize, getStatusBadge, escapeHtml, showToast, showConfirm, showLoading, hideLoading } from '../utils.js';

let currentPage = 1;
let currentFilters = {};

async function render() {
  const container = document.createElement('div');
  container.innerHTML = `
    <div class="filter-bar">
      <div class="filter-group">
        <label>Status:</label>
        <select class="form-control" id="filter-status">
          <option value="">All</option>
          <option value="open">Open</option>
          <option value="assigned">Assigned</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>
      <div class="filter-group">
        <label>From:</label>
        <input type="date" class="form-control" id="filter-date-from">
      </div>
      <div class="filter-group">
        <label>To:</label>
        <input type="date" class="form-control" id="filter-date-to">
      </div>
      <div class="filter-group">
        <input type="text" class="form-control" id="filter-search" placeholder="Search..." style="min-width:180px">
      </div>
      <button class="btn btn-sm btn-primary" id="filter-btn">Filter</button>
      ${auth.isAdmin() ? '<button class="btn btn-sm btn-secondary" id="add-shift-btn">+ New Shift</button>' : ''}
    </div>
    <div class="card">
      <div class="table-container" id="shifts-table"></div>
      <div id="shifts-pagination"></div>
    </div>
  `;

  return container;
}

function mount() {
  loadShifts();
  document.getElementById('filter-btn').addEventListener('click', () => { currentPage = 1; loadShifts(); });
  document.getElementById('filter-search').addEventListener('keydown', (e) => { if (e.key === 'Enter') { currentPage = 1; loadShifts(); } });
  ['filter-status', 'filter-date-from', 'filter-date-to'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => { currentPage = 1; loadShifts(); });
  });

  if (auth.isAdmin()) {
    document.getElementById('add-shift-btn').addEventListener('click', showCreateModal);
  }
}

async function loadShifts() {
  showLoading('Loading shifts...');
  try {
    const params = new URLSearchParams({ page: currentPage, limit: 20 });
    const status = document.getElementById('filter-status').value;
    const dateFrom = document.getElementById('filter-date-from').value;
    const dateTo = document.getElementById('filter-date-to').value;
    const search = document.getElementById('filter-search').value;

    if (status) params.set('status', status);
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);
    if (search) params.set('search', search);

    const data = await api.get(`/shifts?${params}`);
    renderTable(data);
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    hideLoading();
  }
}

function renderTable(data) {
  const container = document.getElementById('shifts-table');
  const pagination = document.getElementById('shifts-pagination');

  if (data.shifts.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📅</div>
        <h3>No shifts found</h3>
        <p>Try adjusting your filters or create a new shift.</p>
      </div>
    `;
    pagination.innerHTML = '';
    return;
  }

  const isAdmin = auth.isAdmin();
  const isStaff = auth.isStaff();

  let html = `<table>
    <thead><tr>
      <th>Date</th><th>Client</th><th>Type</th><th>Time</th><th>Hours</th><th>Rate</th>
      ${isAdmin ? '<th>Staff</th>' : ''}
      <th>Status</th><th>Actions</th>
    </tr></thead><tbody>`;

  data.shifts.forEach(s => {
    const rateDisplay = isStaff ? formatCurrency(s.hourly_rate) : formatCurrency(s.hourly_rate);
    html += `<tr>
      <td>${formatDate(s.date)}</td>
      <td>${escapeHtml(s.client_name)}</td>
      <td>${escapeHtml(s.service_type)}</td>
      <td>${formatTime(s.start_time)}</td>
      <td>${s.hours}h</td>
      <td>${rateDisplay}</td>
      ${isAdmin ? `<td>${escapeHtml(s.staff_name || '—')}</td>` : ''}
      <td>${getStatusBadge(s.status)}</td>
      <td>
        <div class="table-actions">
          <button class="btn btn-sm btn-outline" onclick="viewShift(${s.id})">👁</button>
          ${isAdmin && s.status === 'open' ? `<button class="btn btn-sm btn-primary" onclick="showAssignModal(${s.id})">Assign</button>` : ''}
          ${isAdmin && s.status === 'open' ? `<button class="btn btn-sm btn-danger" onclick="deleteShift(${s.id})">🗑</button>` : ''}
          ${isStaff && s.status === 'open' ? `<button class="btn btn-sm btn-secondary" onclick="pickShift(${s.id})">Pick</button>` : ''}
          ${isStaff && s.status === 'assigned' && s.staff_id === auth.getCurrentUser().id ? `<button class="btn btn-sm btn-success" onclick="startShiftGPS(${s.id})">▶ Start</button>` : ''}
          ${isStaff && s.status === 'in_progress' && s.staff_id === auth.getCurrentUser().id ? `<button class="btn btn-sm btn-danger" onclick="endShiftGPS(${s.id})">⏹ End</button>` : ''}
        </div>
      </td>
    </tr>`;
  });

  html += '</tbody></table>';
  container.innerHTML = html;

  // Pagination
  const { page, pages } = data.pagination;
  if (pages > 1) {
    let phtml = '<div class="pagination">';
    phtml += `<button ${page <= 1 ? 'disabled' : ''} onclick="window.changePage(${page - 1})">‹</button>`;
    for (let i = Math.max(1, page - 4); i <= Math.min(pages, page + 4); i++) {
      phtml += `<button class="${i === page ? 'active' : ''}" onclick="window.changePage(${i})">${i}</button>`;
    }
    phtml += `<button ${page >= pages ? 'disabled' : ''} onclick="window.changePage(${page + 1})">›</button>`;
    phtml += '</div>';
    pagination.innerHTML = phtml;
  } else {
    pagination.innerHTML = '';
  }
}

// Global functions for inline onclick
window.viewShift = async (id) => {
  try {
    const data = await api.get(`/shifts/${id}`);
    const s = data.shift;
    const att = data.attendance;
    const gps = data.gpsLogs;

    const content = `
      <div class="detail-grid">
        <div class="detail-item"><div class="detail-label">Date</div><div class="detail-value">${formatDate(s.date)}</div></div>
        <div class="detail-item"><div class="detail-label">Time</div><div class="detail-value">${formatTime(s.start_time)} - ${formatTime(s.end_time)}</div></div>
        <div class="detail-item"><div class="detail-label">Client</div><div class="detail-value">${escapeHtml(s.client_name)}</div></div>
        <div class="detail-item"><div class="detail-label">Service</div><div class="detail-value">${escapeHtml(s.service_type)}</div></div>
        <div class="detail-item"><div class="detail-label">Staff</div><div class="detail-value">${escapeHtml(s.staff_name || 'Unassigned')}</div></div>
        <div class="detail-item"><div class="detail-label">Status</div><div class="detail-value">${getStatusBadge(s.status)}</div></div>
        <div class="detail-item"><div class="detail-label">Hours</div><div class="detail-value">${s.hours}h</div></div>
        <div class="detail-item"><div class="detail-label">Rate</div><div class="detail-value">${formatCurrency(s.hourly_rate)}/hr</div></div>
        ${att ? `<div class="detail-item"><div class="detail-label">Clock In</div><div class="detail-value">${formatDate(att.clock_in)} ${formatTime(att.clock_in)}</div></div>` : ''}
        ${att ? `<div class="detail-item"><div class="detail-label">Hours Worked</div><div class="detail-value">${att.hours_worked}h</div></div>` : ''}
        <div class="detail-item" style="grid-column:1/-1"><div class="detail-label">Location</div><div class="detail-value">${escapeHtml(s.location) || '—'}</div></div>
        ${s.notes ? `<div class="detail-item" style="grid-column:1/-1"><div class="detail-label">Notes</div><div class="detail-value">${escapeHtml(s.notes)}</div></div>` : ''}
      </div>
      ${gps.length > 0 ? `<div class="mt-4"><h4>GPS Tracking</h4><div id="gps-map" style="height:200px;background:var(--bg);border-radius:var(--radius);margin-top:8px"></div></div>` : ''}
    `;
    const { openModal } = await import('../utils.js');
    const modal = openModal({ title: `Shift #${id} - ${escapeHtml(s.service_type)}`, content, size: 'modal-lg' });
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.changePage = (p) => { currentPage = p; loadShifts(); };

window.pickShift = async (id) => {
  const confirmed = await showConfirm('Pick Shift', 'Are you sure you want to pick this shift?');
  if (!confirmed) return;
  try {
    await api.post(`/shifts/${id}/pick`);
    showToast('Shift picked successfully!', 'success');
    loadShifts();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.deleteShift = async (id) => {
  const confirmed = await showConfirm('Delete Shift', 'Are you sure you want to delete this shift?', 'Delete', 'Cancel', true);
  if (!confirmed) return;
  try {
    await api.delete(`/shifts/${id}`);
    showToast('Shift deleted.', 'success');
    loadShifts();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.startShiftGPS = async (id) => {
  if (!navigator.geolocation) {
    showToast('GPS not available on this device.', 'error');
    return;
  }
  navigator.geolocation.getCurrentPosition(async (pos) => {
    try {
      await api.put(`/shifts/${id}/start`, { latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      showToast('Shift started! GPS location recorded.', 'success');
      loadShifts();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }, () => {
    showToast('Could not get GPS location. Please enable location services.', 'error');
  });
};

window.endShiftGPS = async (id) => {
  if (!navigator.geolocation) {
    showToast('GPS not available.', 'error');
    return;
  }
  navigator.geolocation.getCurrentPosition(async (pos) => {
    try {
      await api.put(`/shifts/${id}/end`, { latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      showToast('Shift completed!', 'success');
      loadShifts();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }, () => {
    showToast('Could not get GPS location.', 'error');
  });
};

window.showAssignModal = async (id) => {
  try {
    const staffData = await api.get('/staff');
    const content = document.createElement('div');
    content.innerHTML = `
      <div class="form-group">
        <label>Select Staff</label>
        <select class="form-control" id="assign-staff">
          <option value="">Choose a caregiver...</option>
          ${staffData.staff.map(s => `<option value="${s.id}">${escapeHtml(s.username)} ${s.rating ? '★' + s.rating : ''}</option>`).join('')}
        </select>
      </div>
    `;
    const modal = document.createElement('div');
    modal.innerHTML = `
      <div class="modal-overlay">
        <div class="modal modal-sm">
          <div class="modal-header"><h3>Assign Staff</h3><button class="modal-close" id="modal-close">&times;</button></div>
          <div class="modal-body">${content.innerHTML}</div>
          <div class="modal-footer">
            <button class="btn btn-outline" id="modal-cancel">Cancel</button>
            <button class="btn btn-primary" id="modal-confirm">Assign</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('#modal-close').onclick = () => modal.remove();
    modal.querySelector('#modal-cancel').onclick = () => modal.remove();
    modal.querySelector('#modal-confirm').onclick = async () => {
      const staffId = document.getElementById('assign-staff').value;
      if (!staffId) { showToast('Please select a staff member.', 'error'); return; }
      try {
        await api.put(`/shifts/${id}/assign`, { staff_id: parseInt(staffId) });
        showToast('Staff assigned!', 'success');
        modal.remove();
        loadShifts();
      } catch (err) {
        showToast(err.message, 'error');
      }
    };
  } catch (err) {
    showToast(err.message, 'error');
  }
};

function showCreateModal() {
  const modal = document.createElement('div');
  modal.innerHTML = `
    <div class="modal-overlay">
      <div class="modal modal-lg">
        <div class="modal-header"><h3>Create Shift</h3><button class="modal-close" id="modal-close">&times;</button></div>
        <div class="modal-body">
          <div class="form-row">
            <div class="form-group">
              <label for="shift-client">Client *</label>
              <select class="form-control" id="shift-client" required></select>
            </div>
            <div class="form-group">
              <label for="shift-date">Date *</label>
              <input type="date" class="form-control" id="shift-date" required>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="shift-start">Start Time *</label>
              <input type="time" class="form-control" id="shift-start" required>
            </div>
            <div class="form-group">
              <label for="shift-end">End Time *</label>
              <input type="time" class="form-control" id="shift-end" required>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="shift-type">Service Type *</label>
              <select class="form-control" id="shift-type">
                <option>Personal Care</option><option>Companionship</option>
                <option>Medication Reminder</option><option>Live-In Care</option>
                <option>Overnight Care</option><option>Hospital Escort</option>
                <option>Transportation</option><option>Meal Preparation</option>
                <option>Cleaning</option><option>Shopping Assistance</option>
              </select>
            </div>
            <div class="form-group">
              <label for="shift-rate">Hourly Rate ($)</label>
              <input type="number" step="0.01" class="form-control" id="shift-rate" value="35">
            </div>
          </div>
          <div class="form-group">
            <label for="shift-location">Location</label>
            <input type="text" class="form-control" id="shift-location" placeholder="Address">
          </div>
          <div class="form-group">
            <label for="shift-notes">Notes</label>
            <textarea class="form-control" id="shift-notes" rows="2"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" id="modal-cancel">Cancel</button>
          <button class="btn btn-primary" id="modal-save">Create Shift</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const close = () => modal.remove();
  modal.querySelector('#modal-close').onclick = close;
  modal.querySelector('#modal-cancel').onclick = close;
  modal.onclick = (e) => { if (e.target === modal) close(); };

  // Load clients
  api.get('/clients').then(d => {
    const sel = document.getElementById('shift-client');
    d.clients.forEach(c => {
      sel.innerHTML += `<option value="${c.id}">${escapeHtml(c.name)}</option>`;
    });
  });

  modal.querySelector('#modal-save').onclick = async () => {
    const data = {
      client_id: parseInt(document.getElementById('shift-client').value),
      date: document.getElementById('shift-date').value,
      start_time: document.getElementById('shift-start').value,
      end_time: document.getElementById('shift-end').value,
      service_type: document.getElementById('shift-type').value,
      location: document.getElementById('shift-location').value,
      hourly_rate: parseFloat(document.getElementById('shift-rate').value) || 0,
      notes: document.getElementById('shift-notes').value
    };

    if (!data.client_id || !data.date || !data.start_time || !data.end_time) {
      showToast('Please fill in all required fields.', 'error');
      return;
    }

    try {
      await api.post('/shifts', data);
      showToast('Shift created!', 'success');
      close();
      loadShifts();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };
}

export default { render, mount, unmount: () => {} };
