import api from '../api.js';
import * as auth from '../auth.js';
import router from '../router.js';
import { formatCurrency, formatDate, formatTime, capitalize, getStatusBadge, escapeHtml } from '../utils.js';

async function render() {
  const user = auth.getCurrentUser();
  const container = document.createElement('div');

  try {
    let data;
    if (auth.isAdmin()) {
      data = await api.get('/dashboard/admin');
      container.innerHTML = renderAdminDashboard(data);
    } else if (auth.isStaff()) {
      data = await api.get('/dashboard/staff');
      container.innerHTML = renderStaffDashboard(data);
    } else if (auth.isClient()) {
      data = await api.get('/dashboard/client');
      container.innerHTML = renderClientDashboard(data);
    }
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><h3>Error loading dashboard</h3><p>${escapeHtml(err.message)}</p></div>`;
  }

  return container;
}

function renderAdminDashboard(d) {
  return `
    <div class="grid-4">
      <div class="stat-card">
        <div class="stat-icon blue">📅</div>
        <div class="stat-info">
          <div class="stat-value">${d.todayShifts}</div>
          <div class="stat-label">Today's Shifts</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green">✓</div>
        <div class="stat-info">
          <div class="stat-value">${d.completedShifts}</div>
          <div class="stat-label">Completed</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon yellow">⏳</div>
        <div class="stat-info">
          <div class="stat-value">${d.openShifts}</div>
          <div class="stat-label">Open Shifts</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon purple">👥</div>
        <div class="stat-info">
          <div class="stat-value">${d.totalStaff}</div>
          <div class="stat-label">Staff Working</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green">💰</div>
        <div class="stat-info">
          <div class="stat-value">${formatCurrency(d.monthlyIncome)}</div>
          <div class="stat-label">Monthly Income</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon blue">👤</div>
        <div class="stat-info">
          <div class="stat-value">${d.totalClients}</div>
          <div class="stat-label">Total Clients</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon yellow">📋</div>
        <div class="stat-info">
          <div class="stat-value">${d.pendingRequests}</div>
          <div class="stat-label">Pending Requests</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon red">⚠️</div>
        <div class="stat-info">
          <div class="stat-value">${formatCurrency(d.pendingInvoiceTotal)}</div>
          <div class="stat-label">Pending Invoices</div>
        </div>
      </div>
    </div>
    <div class="grid-2 mt-4">
      <div class="card">
        <div class="card-header">
          <h3>Recent Shifts</h3>
          <button class="btn btn-sm btn-primary" onclick="location.hash='#/shifts'">View All</button>
        </div>
        <div class="table-container">
          <table>
            <thead><tr><th>Date</th><th>Client</th><th>Type</th><th>Staff</th><th>Status</th></tr></thead>
            <tbody>
              ${d.recentShifts.length === 0 ? '<tr><td colspan="5" class="text-center text-muted">No shifts yet</td></tr>' :
                d.recentShifts.map(s => `<tr>
                  <td>${formatDate(s.date)}</td>
                  <td>${escapeHtml(s.client_name)}</td>
                  <td>${escapeHtml(s.service_type)}</td>
                  <td>${escapeHtml(s.staff_name || '—')}</td>
                  <td>${getStatusBadge(s.status)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <h3>Recent Requests</h3>
          <button class="btn btn-sm btn-primary" onclick="location.hash='#/shift-requests'">View All</button>
        </div>
        <div class="table-container">
          <table>
            <thead><tr><th>Client</th><th>Care Type</th><th>Date</th><th>Status</th></tr></thead>
            <tbody>
              ${d.recentRequests.length === 0 ? '<tr><td colspan="4" class="text-center text-muted">No requests yet</td></tr>' :
                d.recentRequests.map(r => `<tr>
                  <td>${escapeHtml(r.client_name)}</td>
                  <td>${escapeHtml(r.care_type)}</td>
                  <td>${formatDate(r.date)}</td>
                  <td>${getStatusBadge(r.status)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function renderStaffDashboard(d) {
  return `
    <div class="grid-3">
      <div class="stat-card">
        <div class="stat-icon blue">📅</div>
        <div class="stat-info">
          <div class="stat-value">${d.completedShifts}</div>
          <div class="stat-label">Completed Shifts</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green">💰</div>
        <div class="stat-info">
          <div class="stat-value">${formatCurrency(d.totalEarnings)}</div>
          <div class="stat-label">Total Earnings</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon yellow">📊</div>
        <div class="stat-info">
          <div class="stat-value">${d.thisMonth}</div>
          <div class="stat-label">Shifts This Month (${d.thisMonthHours}h)</div>
        </div>
      </div>
    </div>
    ${d.todayShift ? `
      <div class="card mt-4">
        <div class="card-header">
          <h3>Today's Shift</h3>
          <span class="badge badge-${d.todayShift.status}">${capitalize(d.todayShift.status)}</span>
        </div>
        <div class="detail-grid">
          <div class="detail-item"><div class="detail-label">Client</div><div class="detail-value">${escapeHtml(d.todayShift.client_name)}</div></div>
          <div class="detail-item"><div class="detail-label">Time</div><div class="detail-value">${formatTime(d.todayShift.start_time)} - ${formatTime(d.todayShift.end_time)}</div></div>
          <div class="detail-item"><div class="detail-label">Service</div><div class="detail-value">${escapeHtml(d.todayShift.service_type)}</div></div>
          <div class="detail-item"><div class="detail-label">Location</div><div class="detail-value">${escapeHtml(d.todayShift.client_address)}</div></div>
        </div>
      </div>
    ` : '<div class="card mt-4"><div class="empty-state"><div class="empty-icon">📅</div><h3>No shift today</h3><p>You have no shifts scheduled for today.</p></div></div>'}
    <div class="grid-2 mt-4">
      <div class="card">
        <div class="card-header"><h3>Upcoming Shifts</h3></div>
        <div class="table-container">
          <table>
            <thead><tr><th>Date</th><th>Client</th><th>Time</th><th>Status</th></tr></thead>
            <tbody>
              ${d.upcomingShifts.length === 0 ? '<tr><td colspan="4" class="text-center text-muted">No upcoming shifts</td></tr>' :
                d.upcomingShifts.map(s => `<tr>
                  <td>${formatDate(s.date)}</td>
                  <td>${escapeHtml(s.client_name)}</td>
                  <td>${formatTime(s.start_time)}</td>
                  <td>${getStatusBadge(s.status)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><h3>Open Shifts</h3><button class="btn btn-sm btn-primary" onclick="location.hash='#/shifts'">Browse</button></div>
        <div class="table-container">
          <table>
            <thead><tr><th>Date</th><th>Client</th><th>Type</th><th>Hours</th></tr></thead>
            <tbody>
              ${d.openShifts.length === 0 ? '<tr><td colspan="4" class="text-center text-muted">No open shifts</td></tr>' :
                d.openShifts.map(s => `<tr onclick="location.hash='#/shifts'" style="cursor:pointer">
                  <td>${formatDate(s.date)}</td>
                  <td>${escapeHtml(s.client_name)}</td>
                  <td>${escapeHtml(s.service_type)}</td>
                  <td>${s.hours}h</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    <div class="card mt-4">
      <div class="card-header"><h3>Notifications</h3></div>
      ${d.notifications.length === 0 ? '<div class="text-center text-muted py-2">No new notifications</div>' :
        d.notifications.map(n => `<div class="notification-item ${n.is_read ? '' : 'unread'}"><div class="notif-title">${escapeHtml(n.title)}</div><div class="notif-message">${escapeHtml(n.message)}</div><div class="notif-time">${formatDate(n.created_at)}</div></div>`).join('')}
    </div>
  `;
}

function renderClientDashboard(d) {
  return `
    <div class="grid-3">
      <div class="stat-card">
        <div class="stat-icon blue">📅</div>
        <div class="stat-info">
          <div class="stat-value">${d.upcomingShifts.length}</div>
          <div class="stat-label">Upcoming Shifts</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green">✓</div>
        <div class="stat-info">
          <div class="stat-value">${d.completedShifts}</div>
          <div class="stat-label">Completed</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon yellow">💰</div>
        <div class="stat-info">
          <div class="stat-value">${formatCurrency(d.pendingAmount)}</div>
          <div class="stat-label">Pending Payment</div>
        </div>
      </div>
    </div>
    <div class="grid-2 mt-4">
      <div class="card">
        <div class="card-header"><h3>Upcoming Shifts</h3></div>
        <div class="table-container">
          <table>
            <thead><tr><th>Date</th><th>Time</th><th>Caregiver</th><th>Type</th><th>Status</th></tr></thead>
            <tbody>
              ${d.upcomingShifts.length === 0 ? '<tr><td colspan="5" class="text-center text-muted">No upcoming shifts</td></tr>' :
                d.upcomingShifts.map(s => `<tr>
                  <td>${formatDate(s.date)}</td>
                  <td>${formatTime(s.start_time)}</td>
                  <td>${escapeHtml(s.staff_name || 'TBD')}</td>
                  <td>${escapeHtml(s.service_type)}</td>
                  <td>${getStatusBadge(s.status)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <h3>Quick Actions</h3>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px">
          <button class="btn btn-secondary btn-lg btn-block" onclick="location.hash='#/shift-requests'">📋 Request a New Shift</button>
          <button class="btn btn-primary btn-lg btn-block" onclick="location.hash='#/invoices'">💰 View Invoices</button>
          <button class="btn btn-outline btn-lg btn-block" onclick="location.hash='#/shifts'">📅 My Shifts</button>
        </div>
      </div>
    </div>
  `;
}

function mount() {}
function unmount() {}

export default { render, mount, unmount };
