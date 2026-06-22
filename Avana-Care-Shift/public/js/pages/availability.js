import api from '../api.js';
import * as auth from '../auth.js';
import { showToast, showLoading, hideLoading } from '../utils.js';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SLOTS = ['morning', 'afternoon', 'night'];

async function render() {
  const container = document.createElement('div');
  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h3>My Weekly Availability</h3>
        <button class="btn btn-sm btn-secondary" id="save-avail-btn">Save Availability</button>
      </div>
      <p class="text-muted mb-4">Toggle your available time slots for each day of the week.</p>
      <div id="avail-grid"></div>
    </div>
  `;
  return container;
}

function mount() {
  loadAvailability();
  document.getElementById('save-avail-btn').addEventListener('click', saveAvailability);
}

async function loadAvailability() {
  showLoading();
  try {
    const data = await api.get('/availability');

    const grid = document.getElementById('avail-grid');
    let html = '<div style="overflow-x:auto"><table style="min-width:600px"><thead><tr><th style="width:100px">Day</th>';

    SLOTS.forEach(slot => {
      html += `<th style="text-align:center;text-transform:capitalize">${slot}</th>`;
    });
    html += '</tr></thead><tbody>';

    DAYS.forEach((day, dayIdx) => {
      html += `<tr><td><strong>${day}</strong></td>`;
      SLOTS.forEach(slot => {
        const existing = data.find(a => a.day_of_week === dayIdx && a.time_slot === slot);
        const active = existing ? existing.is_active : false;
        html += `<td style="text-align:center;padding:12px">
          <label style="display:inline-block;width:50px;height:28px;background:${active ? 'var(--success)' : 'var(--border)'};border-radius:14px;cursor:pointer;position:relative;transition:background 0.2s">
            <input type="checkbox" data-day="${dayIdx}" data-slot="${slot}" ${active ? 'checked' : ''} style="opacity:0;position:absolute">
            <span style="position:absolute;top:3px;left:${active ? '26px' : '3px'};width:22px;height:22px;background:white;border-radius:50%;transition:left 0.2s"></span>
          </label>
        </td>`;
      });
      html += '</tr>';
    });

    html += '</tbody></table></div>';
    grid.innerHTML = html;
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    hideLoading();
  }
}

async function saveAvailability() {
  const availability = [];
  document.querySelectorAll('[data-day]').forEach(cb => {
    if (cb.checked) {
      availability.push({
        day_of_week: parseInt(cb.dataset.day),
        time_slot: cb.dataset.slot,
        is_active: true
      });
    }
  });

  showLoading('Saving...');
  try {
    await api.post('/availability', { availability });
    showToast('Availability saved!', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    hideLoading();
  }
}

export default { render, mount, unmount: () => {} };
