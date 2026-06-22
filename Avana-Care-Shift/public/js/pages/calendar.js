import api from '../api.js';
import { formatDate, formatTime, capitalize, escapeHtml } from '../utils.js';

let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let shiftsData = [];

async function render() {
  const container = document.createElement('div');
  container.innerHTML = `
    <div class="card">
      <div class="calendar-header">
        <button class="btn btn-sm btn-outline" id="cal-prev">‹</button>
        <h3 id="cal-title">${getMonthName(currentMonth)} ${currentYear}</h3>
        <button class="btn btn-sm btn-outline" id="cal-next">›</button>
      </div>
      <div class="calendar-grid" id="calendar-grid"></div>
    </div>
    <div class="card mt-4" id="cal-detail">
      <div class="empty-state"><div class="empty-icon">📆</div><h3>Select a day</h3><p>Click on a date to see shift details.</p></div>
    </div>
  `;
  return container;
}

function mount() {
  loadShifts();
  document.getElementById('cal-prev').addEventListener('click', () => { currentMonth--; if (currentMonth < 0) { currentMonth = 11; currentYear--; } loadShifts(); });
  document.getElementById('cal-next').addEventListener('click', () => { currentMonth++; if (currentMonth > 11) { currentMonth = 0; currentYear++; } loadShifts(); });
}

async function loadShifts() {
  try {
    const monthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    const data = await api.get(`/shifts?date_from=${monthStr}-01&date_to=${monthStr}-31&limit=100`);
    shiftsData = data.shifts;
    renderCalendar();
  } catch (err) {
    console.error('Failed to load shifts for calendar:', err);
  }
}

function renderCalendar() {
  document.getElementById('cal-title').textContent = `${getMonthName(currentMonth)} ${currentYear}`;
  const grid = document.getElementById('calendar-grid');

  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const today = new Date();

  let html = '';
  const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  dayHeaders.forEach(d => { html += `<div class="calendar-day-header">${d}</div>`; });

  // Empty cells
  for (let i = 0; i < firstDay; i++) {
    html += '<div class="calendar-day other-month"></div>';
  }

  // Day cells
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayShifts = shiftsData.filter(s => s.date === dateStr);
    const isToday = today.getFullYear() === currentYear && today.getMonth() === currentMonth && today.getDate() === day;

    html += `<div class="calendar-day ${isToday ? 'today' : ''}" data-date="${dateStr}">
      <div class="day-number">${day}</div>
      ${dayShifts.length > 0 ? `<div class="day-events">${dayShifts.map(s => `<span class="day-event ${s.status}" title="${s.service_type} - ${capitalize(s.status)}"></span>`).join('')}</div>` : ''}
    </div>`;
  }

  grid.innerHTML = html;

  grid.querySelectorAll('.calendar-day[data-date]').forEach(el => {
    el.addEventListener('click', () => {
      showDayDetails(el.dataset.date);
    });
  });
}

function showDayDetails(dateStr) {
  const container = document.getElementById('cal-detail');
  const dayShifts = shiftsData.filter(s => s.date === dateStr);
  const formatted = formatDate(dateStr);

  if (dayShifts.length === 0) {
    container.innerHTML = `
      <div class="card-header"><h3>${formatted}</h3></div>
      <div class="empty-state"><div class="empty-icon">📅</div><h3>No shifts</h3><p>No shifts scheduled for this day.</p></div>
    `;
    return;
  }

  let html = `<div class="card-header"><h3>${formatted} — ${dayShifts.length} shift(s)</h3></div>
    <div class="table-container"><table>
      <thead><tr><th>Time</th><th>Client</th><th>Service</th><th>Staff</th><th>Hours</th><th>Status</th></tr></thead><tbody>`;

  dayShifts.forEach(s => {
    html += `<tr>
      <td>${formatTime(s.start_time)} - ${formatTime(s.end_time)}</td>
      <td>${escapeHtml(s.client_name)}</td>
      <td>${escapeHtml(s.service_type)}</td>
      <td>${escapeHtml(s.staff_name || '—')}</td>
      <td>${s.hours}h</td>
      <td><span class="badge badge-${s.status}">${capitalize(s.status)}</span></td>
    </tr>`;
  });

  html += '</tbody></table></div>';
  container.innerHTML = html;
}

function getMonthName(m) {
  return ['January','February','March','April','May','June','July','August','September','October','November','December'][m];
}

export default { render, mount, unmount: () => {} };
