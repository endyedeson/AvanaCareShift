import api from '../api.js';
import { escapeHtml, showToast, showLoading, hideLoading } from '../utils.js';

async function render() {
  const container = document.createElement('div');
  container.innerHTML = `
    <div class="grid-2">
      <div class="card" id="settings-form">
        <div class="card-header"><h3>Company Settings</h3><button class="btn btn-sm btn-primary" id="save-settings-btn">Save</button></div>
        <div class="form-group"><label>Company Name</label><input type="text" class="form-control" id="s-company_name"></div>
        <div class="form-group"><label>Address</label><input type="text" class="form-control" id="s-company_address"></div>
        <div class="form-row">
          <div class="form-group"><label>Phone</label><input type="tel" class="form-control" id="s-company_phone"></div>
          <div class="form-group"><label>Email</label><input type="email" class="form-control" id="s-company_email"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Tax Rate (%)</label><input type="number" step="0.1" class="form-control" id="s-tax_rate"></div>
          <div class="form-group"><label>Invoice Prefix</label><input type="text" class="form-control" id="s-invoice_prefix"></div>
        </div>
        <div class="form-group"><label>Business Hours</label><input type="text" class="form-control" id="s-business_hours"></div>
        <div class="form-group"><label>Currency Symbol</label><input type="text" class="form-control" id="s-currency_symbol" maxlength="3" style="width:80px"></div>
      </div>
      <div>
        <div class="card">
          <div class="card-header"><h3>Company Logo</h3></div>
          <div class="avatar-upload">
            <div class="avatar-preview" id="logo-preview" style="border-radius:var(--radius);width:120px;height:80px">
              <div id="logo-placeholder" style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-light);font-size:12px">No logo</div>
            </div>
            <div>
              <input type="file" id="logo-upload" accept="image/*" style="display:none">
              <button class="btn btn-sm btn-outline" id="upload-logo-btn">Upload Logo</button>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3>Database Backup</h3></div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-sm btn-primary" id="backup-btn">Create Backup</button>
            <button class="btn btn-sm btn-outline" id="list-backups-btn">View Backups</button>
          </div>
          <div id="backup-list" class="mt-4"></div>
        </div>
        <div class="card">
          <div class="card-header"><h3>Account</h3></div>
          <button class="btn btn-sm btn-outline btn-block" onclick="location.hash='#/profile'">Change Password</button>
        </div>
      </div>
    </div>
  `;
  return container;
}

function mount() {
  loadSettings();
  document.getElementById('save-settings-btn').addEventListener('click', saveSettings);
  document.getElementById('upload-logo-btn').addEventListener('click', () => document.getElementById('logo-upload').click());
  document.getElementById('logo-upload').addEventListener('change', uploadLogo);
  document.getElementById('backup-btn').addEventListener('click', createBackup);
  document.getElementById('list-backups-btn').addEventListener('click', listBackups);
}

async function loadSettings() {
  try {
    const settings = await api.get('/settings');
    document.getElementById('s-company_name').value = settings.company_name || '';
    document.getElementById('s-company_address').value = settings.company_address || '';
    document.getElementById('s-company_phone').value = settings.company_phone || '';
    document.getElementById('s-company_email').value = settings.company_email || '';
    document.getElementById('s-tax_rate').value = settings.tax_rate || '0';
    document.getElementById('s-invoice_prefix').value = settings.invoice_prefix || 'INV-';
    document.getElementById('s-business_hours').value = settings.business_hours || '';
    document.getElementById('s-currency_symbol').value = settings.currency_symbol || '$';

    if (settings.company_logo) {
      document.getElementById('logo-placeholder').innerHTML = `<img src="${settings.company_logo}" style="max-width:100%;max-height:100%">`;
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function saveSettings() {
  showLoading('Saving...');
  try {
    await api.put('/settings', {
      company_name: document.getElementById('s-company_name').value,
      company_address: document.getElementById('s-company_address').value,
      company_phone: document.getElementById('s-company_phone').value,
      company_email: document.getElementById('s-company_email').value,
      tax_rate: document.getElementById('s-tax_rate').value,
      invoice_prefix: document.getElementById('s-invoice_prefix').value,
      business_hours: document.getElementById('s-business_hours').value,
      currency_symbol: document.getElementById('s-currency_symbol').value
    });
    showToast('Settings saved!', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    hideLoading();
  }
}

async function uploadLogo(e) {
  const file = e.target.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('logo', file);
  try {
    const result = await api.upload('/upload/logo', formData);
    showToast('Logo uploaded!', 'success');
    document.getElementById('logo-placeholder').innerHTML = `<img src="${result.url}" style="max-width:100%;max-height:100%">`;
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function createBackup() {
  try {
    await api.post('/settings/backup');
    showToast('Backup created successfully!', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function listBackups() {
  try {
    const data = await api.get('/settings/backups');
    const container = document.getElementById('backup-list');
    if (data.backups.length === 0) {
      container.innerHTML = '<div class="text-muted text-center" style="padding:16px">No backups yet.</div>';
      return;
    }
    container.innerHTML = `
      <div class="table-container">
        <table>
          <thead><tr><th>File</th><th>Size</th><th>Date</th></tr></thead>
          <tbody>${data.backups.map(b => `<tr>
            <td>${escapeHtml(b.name)}</td>
            <td>${(b.size / 1024).toFixed(1)} KB</td>
            <td>${new Date(b.date).toLocaleString()}</td>
          </tr>`).join('')}</tbody>
        </table>
      </div>
    `;
  } catch (err) {
    showToast(err.message, 'error');
  }
}

export default { render, mount, unmount: () => {} };
