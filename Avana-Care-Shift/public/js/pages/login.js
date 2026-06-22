import api from '../api.js';
import * as auth from '../auth.js';
import router from '../router.js';
import { showToast, showLoading, hideLoading } from '../utils.js';

let isRegisterMode = false;

function render() {
  const page = document.createElement('div');
  page.className = 'login-page';

  page.innerHTML = `
    <div class="login-card">
      <div class="login-logo">
        <h1>Avana Care</h1>
        <p>Shift Management System</p>
      </div>
      <div id="login-form">
        <div class="form-group">
          <label for="login-username">Username</label>
          <input type="text" id="login-username" class="form-control" placeholder="Enter your username" required autocomplete="username">
        </div>
        <div class="form-group">
          <label for="login-password">Password</label>
          <input type="password" id="login-password" class="form-control" placeholder="Enter your password" required autocomplete="current-password">
        </div>
        <button class="btn btn-primary btn-lg btn-block" id="login-btn">Sign In</button>
        <p class="text-center mt-4" style="font-size:13px;color:var(--text-secondary)">
          Client? <a href="#" id="show-register">Create an account</a>
        </p>
        <div class="text-center mt-4" style="font-size:12px;color:var(--text-light)">
          <p>Demo: <strong>admin</strong> / <strong>admin123</strong></p>
          <p>Staff: <strong>sarah.chen</strong> / <strong>staff123</strong></p>
          <p>Client: <strong>robert.wilson</strong> / <strong>client123</strong></p>
        </div>
      </div>
      <div id="register-form" style="display:none">
        <div class="form-row">
          <div class="form-group">
            <label for="reg-name">Full Name</label>
            <input type="text" id="reg-name" class="form-control" placeholder="Your name" required>
          </div>
          <div class="form-group">
            <label for="reg-username">Username</label>
            <input type="text" id="reg-username" class="form-control" placeholder="Choose username" required>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="reg-email">Email</label>
            <input type="email" id="reg-email" class="form-control" placeholder="Your email" required>
          </div>
          <div class="form-group">
            <label for="reg-password">Password</label>
            <input type="password" id="reg-password" class="form-control" placeholder="Choose password" required>
          </div>
        </div>
        <div class="form-group">
          <label for="reg-phone">Phone</label>
          <input type="tel" id="reg-phone" class="form-control" placeholder="Your phone number">
        </div>
        <div class="form-group">
          <label for="reg-address">Address</label>
          <input type="text" id="reg-address" class="form-control" placeholder="Your address">
        </div>
        <button class="btn btn-secondary btn-lg btn-block" id="register-btn">Create Account</button>
        <p class="text-center mt-4" style="font-size:13px;color:var(--text-secondary)">
          Already have an account? <a href="#" id="show-login">Sign in</a>
        </p>
      </div>
    </div>
  `;

  return page;
}

function mount() {
  document.getElementById('login-btn').addEventListener('click', handleLogin);
  document.getElementById('login-password').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleLogin();
  });

  document.getElementById('show-register').addEventListener('click', (e) => {
    e.preventDefault();
    toggleMode(true);
  });

  document.getElementById('show-login').addEventListener('click', (e) => {
    e.preventDefault();
    toggleMode(false);
  });

  document.getElementById('register-btn').addEventListener('click', handleRegister);
}

function toggleMode(register) {
  isRegisterMode = register;
  document.getElementById('login-form').style.display = register ? 'none' : 'block';
  document.getElementById('register-form').style.display = register ? 'block' : 'none';
}

async function handleLogin() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;

  if (!username || !password) {
    showToast('Please enter username and password.', 'error');
    return;
  }

  showLoading('Signing in...');
  try {
    await auth.login(username, password);
    showToast('Welcome back!', 'success');
    router.navigate('/dashboard');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    hideLoading();
  }
}

async function handleRegister() {
  const data = {
    name: document.getElementById('reg-name').value.trim(),
    username: document.getElementById('reg-username').value.trim(),
    email: document.getElementById('reg-email').value.trim(),
    password: document.getElementById('reg-password').value,
    phone: document.getElementById('reg-phone').value.trim(),
    address: document.getElementById('reg-address').value.trim()
  };

  if (!data.name || !data.username || !data.email || !data.password) {
    showToast('Please fill in all required fields.', 'error');
    return;
  }

  showLoading('Creating account...');
  try {
    await auth.registerClient(data);
    showToast('Account created successfully!', 'success');
    router.navigate('/dashboard');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    hideLoading();
  }
}

export default { render, mount, unmount: () => {} };
