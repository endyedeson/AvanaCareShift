import api from '../api.js';
import { formatDate, formatCurrency, capitalize, escapeHtml, showToast, showLoading, hideLoading, downloadCSV } from '../utils.js';

async function render() {
  const container = document.createElement('div');
  container.innerHTML = `
    <div class="filter-bar">
      <div class="filter-group">
        <label>Report Type:</label>
        <select class="form-control" id="report-type">
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="revenue">Revenue</option>
        </select>
      </div>
      <div class="filter-group">
        <label>Date:</label>
        <input type="date" class="form-control" id="report-date">
      </div>
      <button class="btn btn-sm btn-primary" id="load-report-btn">Load Report</button>
      <button class="btn btn-sm btn-outline" id="export-csv-btn">Export CSV</button>
    </div>
    <div class="card" id="report-content">
      <div class="empty-state"><div class="empty-icon">📈</div><h3>Select a report</h3><p>Choose a report type and date to view.</p></div>
    </div>
  `;
  return container;
}

function mount() {
  document.getElementById('report-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('load-report-btn').addEventListener('click', loadReport);
  document.getElementById('export-csv-btn').addEventListener('click', exportCSV);
  document.getElementById('report-type').addEventListener('change', () => loadReport());
  loadReport();
}

async function loadReport() {
  const type = document.getElementById('report-type').value;
  const date = document.getElementById('report-date').value;

  showLoading();
  try {
    let data;
    let html = '';

    if (type === 'daily') {
      data = await api.get(`/reports/daily?date=${date}`);
      html = renderDailyReport(data);
    } else if (type === 'weekly') {
      data = await api.get(`/reports/weekly?date=${date}`);
      html = renderWeeklyReport(data);
    } else if (type === 'monthly') {
      const dt = new Date(date);
      data = await api.get(`/reports/monthly?month=${dt.getMonth() + 1}&year=${dt.getFullYear()}`);
      html = renderMonthlyReport(data);
    } else if (type === 'revenue') {
      const dt = new Date(date);
      const from = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-01`;
      const to = date;
      data = await api.get(`/reports/revenue?from=${from}&to=${to}`);
      html = renderRevenueReport(data);
    }

    document.getElementById('report-content').innerHTML = html;
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    hideLoading();
  }
}

function renderDailyReport(d) {
  return `
    <div class="card-header"><h3>Daily Report — ${formatDate(d.date)}</h3></div>
    <div class="grid-4 mb-4">
      <div class="stat-card"><div class="stat-icon blue">📅</div><div class="stat-info"><div class="stat-value">${d.totalShifts}</div><div class="stat-label">Total Shifts</div></div></div>
      <div class="stat-card"><div class="stat-icon green">✓</div><div class="stat-info"><div class="stat-value">${d.completedShifts}</div><div class="stat-label">Completed</div></div></div>
      <div class="stat-card"><div class="stat-icon yellow">⏱</div><div class="stat-info"><div class="stat-value">${d.totalHours}h</div><div class="stat-label">Hours Worked</div></div></div>
      <div class="stat-card"><div class="stat-icon green">💰</div><div class="stat-info"><div class="stat-value">${formatCurrency(d.revenue)}</div><div class="stat-label">Revenue</div></div></div>
    </div>
    ${d.shiftDetails.length > 0 ? `
      <div class="table-container">
        <table><thead><tr><th>Time</th><th>Client</th><th>Staff</th><th>Service</th><th>Hours</th><th>Status</th></tr></thead><tbody>
          ${d.shiftDetails.map(s => `<tr><td>${s.start_time}-${s.end_time}</td><td>${escapeHtml(s.client_name)}</td><td>${escapeHtml(s.staff_name || '—')}</td><td>${escapeHtml(s.service_type)}</td><td>${s.hours}h</td><td><span class="badge badge-${s.status}">${capitalize(s.status)}</span></td></tr>`).join('')}
        </tbody></table>
      </div>
    ` : '<div class="text-center text-muted">No shifts on this day.</div>'}
  `;
}

function renderWeeklyReport(d) {
  return `
    <div class="card-header"><h3>Weekly Report — ${formatDate(d.weekStart)} to ${formatDate(d.weekEnd)}</h3></div>
    <div class="grid-4 mb-4">
      <div class="stat-card"><div class="stat-icon blue">📅</div><div class="stat-info"><div class="stat-value">${d.totalShifts}</div><div class="stat-label">Total Shifts</div></div></div>
      <div class="stat-card"><div class="stat-icon green">✓</div><div class="stat-info"><div class="stat-value">${d.completedShifts}</div><div class="stat-label">Completed</div></div></div>
      <div class="stat-card"><div class="stat-icon yellow">⏱</div><div class="stat-info"><div class="stat-value">${d.totalHours}h</div><div class="stat-label">Hours Worked</div></div></div>
      <div class="stat-card"><div class="stat-icon green">💰</div><div class="stat-info"><div class="stat-value">${formatCurrency(d.revenue)}</div><div class="stat-label">Revenue</div></div></div>
    </div>
    ${d.dailyBreakdown.length > 0 ? `
      <div class="table-container">
        <table><thead><tr><th>Day</th><th>Shifts</th><th>Completed</th><th>Hours</th></tr></thead><tbody>
          ${d.dailyBreakdown.map(day => `<tr><td>${formatDate(day.date)}</td><td>${day.shifts}</td><td>${day.completed}</td><td>${day.hours}h</td></tr>`).join('')}
        </tbody></table>
      </div>
    ` : ''}
  `;
}

function renderMonthlyReport(d) {
  return `
    <div class="card-header"><h3>Monthly Report — ${d.month}/${d.year}</h3></div>
    <div class="grid-4 mb-4">
      <div class="stat-card"><div class="stat-icon blue">📅</div><div class="stat-info"><div class="stat-value">${d.totalShifts}</div><div class="stat-label">Total Shifts</div></div></div>
      <div class="stat-card"><div class="stat-icon green">✓</div><div class="stat-info"><div class="stat-value">${d.completedShifts}</div><div class="stat-label">Completed</div></div></div>
      <div class="stat-card"><div class="stat-icon yellow">⏱</div><div class="stat-info"><div class="stat-value">${d.totalHours}h</div><div class="stat-label">Hours Worked</div></div></div>
      <div class="stat-card"><div class="stat-icon green">💰</div><div class="stat-info"><div class="stat-value">${formatCurrency(d.revenue)}</div><div class="stat-label">Revenue (Paid)</div></div></div>
    </div>
    <div class="grid-2 mt-4">
      <div class="card">
        <div class="card-header"><h3>Staff Hours</h3></div>
        <div class="table-container">
          <table><thead><tr><th>Staff</th><th>Shifts</th><th>Hours</th></tr></thead><tbody>
            ${d.staffHours.map(s => `<tr><td>${escapeHtml(s.username)}</td><td>${s.shifts}</td><td>${s.total_hours}h</td></tr>`).join('')}
          </tbody></table>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><h3>Client Statistics</h3></div>
        <div class="table-container">
          <table><thead><tr><th>Client</th><th>Shifts</th><th>Hours</th></tr></thead><tbody>
            ${d.clientStats.map(c => `<tr><td>${escapeHtml(c.name)}</td><td>${c.shifts}</td><td>${c.total_hours}h</td></tr>`).join('')}
          </tbody></table>
        </div>
      </div>
    </div>
  `;
}

function renderRevenueReport(d) {
  return `
    <div class="card-header"><h3>Revenue Report</h3></div>
    <div class="grid-2 mb-4">
      <div class="stat-card"><div class="stat-icon green">💰</div><div class="stat-info"><div class="stat-value">${formatCurrency(d.totals.total)}</div><div class="stat-label">Total Revenue</div></div></div>
      <div class="stat-card"><div class="stat-icon blue">📄</div><div class="stat-info"><div class="stat-value">${d.totals.count}</div><div class="stat-label">Paid Invoices</div></div></div>
    </div>
    ${d.data.length > 0 ? `
      <div class="table-container">
        <table><thead><tr><th>Date</th><th>Invoices</th><th>Revenue</th></tr></thead><tbody>
          ${d.data.map(row => `<tr><td>${formatDate(row.date)}</td><td>${row.invoices}</td><td>${formatCurrency(row.revenue)}</td></tr>`).join('')}
        </tbody></table>
      </div>
    ` : '<div class="text-center text-muted">No revenue data for this period.</div>'}
  `;
}

function exportCSV() {
  const type = document.getElementById('report-type').value;
  const date = document.getElementById('report-date').value;
  const params = new URLSearchParams({ type, from: date, to: date });
  const token = localStorage.getItem('avana_token');

  fetch(`/api/reports/export/csv?${params}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
    .then(r => r.text())
    .then(csv => downloadCSV(csv, `${type}-report.csv`))
    .catch(err => showToast(err.message, 'error'));
}

export default { render, mount, unmount: () => {} };
