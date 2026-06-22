import api from '../api.js';
import * as auth from '../auth.js';
import { escapeHtml, showToast, showLoading, hideLoading } from '../utils.js';

async function render() {
  const user = auth.getCurrentUser();
  const initials = user ? user.username.charAt(0).toUpperCase() : '?';

  const container = document.createElement('div');
  container.innerHTML = `
    <div class="grid-2">
      <div class="card">
        <div class="card-header"><h3>Profile</h3></div>
        <div class="avatar-upload">
          <div class="avatar-preview" id="profile-preview" style="width:100px;height:100px">
            ${user?.avatar ? `<img src="${user.avatar}" alt="">` : `<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:32px;font-weight:bold;color:var(--primary);background:var(--secondary)">${initials}</div>`}
          </div>
          <div>
            <input type="file" id="avatar-upload" accept="image/*" style="display:none">
            <button class="btn btn-sm btn-outline" id="upload-avatar-btn">Change Photo</button>
            <p class="hint">Max 2MB, JPG or PNG</p>
          </div>
        </div>
        <div class="form-group mt-4"><label>Username</label><input type="text" class="form-control" value="${escapeHtml(user?.username || '')}" disabled></div>
        <div class="form-group"><label>Email</label><input type="email" class="form-control" value="${escapeHtml(user?.email || '')}" disabled></div>
        <div class="form-group"><label>Role</label><input type="text" class="form-control" value="${escapeHtml(user?.role || '')}" disabled></div>
      </div>
      <div class="card">
        <div class="card-header"><h3>Change Password</h3></div>
        <div class="form-group">
          <label for="pwd-current">Current Password</label>
          <input type="password" class="form-control" id="pwd-current" required>
        </div>
        <div class="form-group">
          <label for="pwd-new">New Password</label>
          <input type="password" class="form-control" id="pwd-new" required minlength="6">
        </div>
        <div class="form-group">
          <label for="pwd-confirm">Confirm New Password</label>
          <input type="password" class="form-control" id="pwd-confirm" required>
        </div>
        <button class="btn btn-primary" id="change-pwd-btn">Update Password</button>
      </div>
    </div>
  `;
  return container;
}

function mount() {
  document.getElementById('upload-avatar-btn')?.addEventListener('click', () => document.getElementById('avatar-upload').click());
  document.getElementById('avatar-upload')?.addEventListener('change', uploadAvatar);
  document.getElementById('change-pwd-btn').addEventListener('click', changePassword);
}

async function uploadAvatar(e) {
  const file = e.target.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('avatar', file);
  try {
    const result = await api.upload('/upload/profile', formData);
    showToast('Profile photo updated!', 'success');
    const preview = document.getElementById('profile-preview');
    preview.innerHTML = `<img src="${result.url}" alt="" style="width:100%;height:100%;object-fit:cover">`;
    auth.getCurrentUser().avatar = result.url;
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function changePassword() {
  const current = document.getElementById('pwd-current').value;
  const newPwd = document.getElementById('pwd-new').value;
  const confirm = document.getElementById('pwd-confirm').value;

  if (!current || !newPwd) {
    showToast('Please fill in all password fields.', 'error');
    return;
  }
  if (newPwd.length < 6) {
    showToast('New password must be at least 6 characters.', 'error');
    return;
  }
  if (newPwd !== confirm) {
    showToast('Passwords do not match.', 'error');
    return;
  }

  try {
    await api.put('/auth/password', { currentPassword: current, newPassword: newPwd });
    showToast('Password updated successfully!', 'success');
    document.getElementById('pwd-current').value = '';
    document.getElementById('pwd-new').value = '';
    document.getElementById('pwd-confirm').value = '';
  } catch (err) {
    showToast(err.message, 'error');
  }
}

export default { render, mount, unmount: () => {} };
