import api from '../api.js';
import * as auth from '../auth.js';
import { formatDate, formatTime, capitalize, escapeHtml, showToast, showConfirm, showLoading, hideLoading } from '../utils.js';

let currentPage = 1;

async function render() {
  const container = document.createElement('div');
  const isClient = auth.isClient();

  container.innerHTML = `
    <div class="filter-bar">
      <div class="filter-group">
        <label>Status:</label>
        <select class="form-control" id="req-filter-status">
          <option value="">All</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>
      ${isClient ? '<button class="btn btn-sm btn-secondary" id="new-request-btn">+ New Request</button>' : ''}
    </div>
    <div class="card">
      <div class="table-container" id="requests-table"></div>
      <div id="requests-pagination"></div>
    </div>
  `;

  return container;
}

function mount() {
  loadRequests();
  document.getElementById('req-filter-status').addEventListener('change', () => { currentPage = 1; loadRequests(); });
  const newBtn = document.getElementById('new-request-btn');
  if (newBtn) newBtn.addEventListener('click', showNewRequestModal);
}

async function loadRequests() {
  showLoading();
  try {
    const params = new URLSearchParams({ page: currentPage, limit: 20 });
    const status = document.getElementById('req-filter-status').value;
    if (status) params.set('status', status);
    const data = await api.get(`/shift-requests?${params}`);
    renderRequests(data);
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    hideLoading();
  }
}

function renderRequests(data) {
  const container = document.getElementById('requests-table');
  const pagination = document.getElementById('requests-pagination');

  if (data.requests.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><h3>No requests</h3><p>No shift requests found.</p></div>';
    pagination.innerHTML = '';
    return;
  }

  const isAdmin = auth.isAdmin();

  let html = `<table>
    <thead><tr><th>Date</th><th>Client</th><th>Care Type</th><th>Time</th><th>Duration</th><th>Preferred Staff</th><th>Status</th>${isAdmin ? '<th>Actions</th>' : ''}</tr></thead><tbody>`;

  data.requests.forEach(r => {
    html += `<tr>
      <td>${formatDate(r.date)}</td>
      <td>${escapeHtml(r.client_name)}</td>
      <td>${escapeHtml(r.care_type)}</td>
      <td>${formatTime(r.time)}</td>
      <td>${r.duration}h</td>
      <td>${escapeHtml(r.preferred_staff_name || 'Any')}</td>
      <td><span class="badge badge-${r.status}">${capitalize(r.status)}</span></td>
      ${isAdmin ? `<td>
        ${r.status === 'pending' ? `
          <button class="btn btn-sm btn-success" onclick="approveRequest(${r.id})">Approve</button>
          <button class="btn btn-sm btn-danger" onclick="rejectRequest(${r.id})">Reject</button>
        ` : '—'}
      </td>` : ''}
    </tr>`;
  });

  html += '</tbody></table>';
  container.innerHTML = html;

  if (data.pagination.pages > 1) {
    let phtml = '<div class="pagination">';
    for (let i = 1; i <= data.pagination.pages; i++) {
      phtml += `<button class="${i === data.pagination.page ? 'active' : ''}" onclick="window.goToReqPage(${i})">${i}</button>`;
    }
    phtml += '</div>';
    pagination.innerHTML = phtml;
  } else {
    pagination.innerHTML = '';
  }
}

window.goToReqPage = (p) => { currentPage = p; loadRequests(); };

window.approveRequest = async (id) => {
  const confirmed = await showConfirm('Approve Request', 'This will create a shift from this request. Continue?');
  if (!confirmed) return;
  try {
    await api.put(`/shift-requests/${id}`, { status: 'approved' });
    showToast('Request approved and shift created.', 'success');
    loadRequests();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.rejectRequest = async (id) => {
  const confirmed = await showConfirm('Reject Request', 'Are you sure you want to reject this request?', 'Reject', 'Cancel', true);
  if (!confirmed) return;
  try {
    await api.put(`/shift-requests/${id}`, { status: 'rejected' });
    showToast('Request rejected.', 'info');
    loadRequests();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

function showNewRequestModal() {
  const modal = document.createElement('div');
  modal.innerHTML = `
    <div class="modal-overlay">
      <div class="modal modal-lg">
        <div class="modal-header"><h3>New Shift Request</h3><button class="modal-close" id="modal-close">&times;</button></div>
        <div class="modal-body">
          <div class="form-row">
            <div class="form-group">
              <label for="req-name">Your Name *</label>
              <input type="text" class="form-control" id="req-name" required>
            </div>
            <div class="form-group">
              <label for="req-phone">Phone</label>
              <input type="tel" class="form-control" id="req-phone">
            </div>
          </div>
          <div class="form-group">
            <label for="req-address">Address</label>
            <input type="text" class="form-control" id="req-address">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="req-date">Date *</label>
              <input type="date" class="form-control" id="req-date" required>
            </div>
            <div class="form-group">
              <label for="req-time">Time *</label>
              <input type="time" class="form-control" id="req-time" required>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="req-duration">Duration (hours)</label>
              <input type="number" class="form-control" id="req-duration" value="3" step="0.5">
            </div>
            <div class="form-group">
              <label for="req-care-type">Care Type</label>
              <select class="form-control" id="req-care-type">
                <option>Personal Care</option><option>Companionship</option>
                <option>Medication Reminder</option><option>Transportation</option>
                <option>Meal Preparation</option><option>Shopping Assistance</option>
                <option>Hospital Escort</option><option>Other</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label for="req-notes">Notes</label>
            <textarea class="form-control" id="req-notes" rows="2"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" id="modal-cancel">Cancel</button>
          <button class="btn btn-secondary" id="modal-submit">Submit Request</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const close = () => modal.remove();
  modal.querySelector('#modal-close').onclick = close;
  modal.querySelector('#modal-cancel').onclick = close;
  modal.onclick = (e) => { if (e.target === modal) close(); };

  // Prefill name for clients
  if (auth.isClient()) {
    const user = auth.getCurrentUser();
    if (user.profile) document.getElementById('req-name').value = user.profile.name || '';
  }

  modal.querySelector('#modal-submit').onclick = async () => {
    const data = {
      client_name: document.getElementById('req-name').value.trim(),
      phone: document.getElementById('req-phone').value.trim(),
      address: document.getElementById('req-address').value.trim(),
      date: document.getElementById('req-date').value,
      time: document.getElementById('req-time').value,
      duration: parseFloat(document.getElementById('req-duration').value) || 3,
      care_type: document.getElementById('req-care-type').value,
      notes: document.getElementById('req-notes').value.trim()
    };

    if (!data.client_name || !data.date || !data.time) {
      showToast('Name, date, and time are required.', 'error');
      return;
    }

    try {
      await api.post('/shift-requests', data);
      showToast('Request submitted!', 'success');
      close();
      loadRequests();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };
}

export default { render, mount, unmount: () => {} };
