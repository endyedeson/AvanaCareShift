import api from './api.js';
import router from './router.js';
import * as auth from './auth.js';
import * as utils from './utils.js';

const APP = document.getElementById('app');

// Page modules
import loginPage from './pages/login.js';
import dashboardPage from './pages/dashboard.js';
import shiftsPage from './pages/shifts.js';
import calendarPage from './pages/calendar.js';
import clientsPage from './pages/clients.js';
import staffPage from './pages/staff.js';
import invoicesPage from './pages/invoices.js';
import reportsPage from './pages/reports.js';
import availabilityPage from './pages/availability.js';
import settingsPage from './pages/settings.js';
import shiftRequestsPage from './pages/shiftRequests.js';
import profilePage from './pages/profile.js';

function renderLayout(content) {
  APP.innerHTML = `
    <aside class="sidebar" id="sidebar"></aside>
    <div class="main-content">
      <header class="topbar">
        <div class="topbar-left">
          <button class="hamburger" id="hamburger">☰</button>
          <h1 id="page-title">Dashboard</h1>
        </div>
        <div class="topbar-right">
          <button class="theme-toggle" id="theme-toggle" title="Toggle Dark Mode">🌓</button>
          <button class="notification-btn" id="notification-btn" title="Notifications">
            🔔 <span class="badge hidden" id="notif-badge">0</span>
          </button>
        </div>
      </header>
      <div class="page-content" id="page-content">${content}</div>
      <div class="footer">Developed by Endy Edeson</div>
    </div>
    <div class="notification-panel" id="notification-panel">
      <div class="notification-panel-header">
        <h3>Notifications</h3>
        <button class="modal-close" id="notif-close">&times;</button>
      </div>
      <div class="notification-list" id="notification-list"></div>
    </div>
  `;

  renderSidebar();
  bindSidebarEvents();
  bindThemeToggle();
  bindNotificationEvents();
}

function renderSidebar() {
  const user = auth.getCurrentUser();
  const sidebar = document.getElementById('sidebar');
  const role = user ? user.role : '';

  const navItems = getNavItems(role);
  const initials = utils.getInitials(user?.username || 'U');

  sidebar.innerHTML = `
    <div class="sidebar-brand">
      <div class="logo-icon">AC</div>
      <div>
        <h2>Avana Care</h2>
        <small>Shift Management</small>
      </div>
    </div>
    <nav class="sidebar-nav">
      <div class="nav-section">Main</div>
      ${navItems.map(item => `
        <a class="nav-item ${isActive(item.path) ? 'active' : ''}" data-nav="${item.path}">
          <span class="nav-icon">${item.icon}</span>
          ${item.label}
          ${item.badge ? `<span class="nav-badge" id="nav-badge-${item.id}">${item.badge}</span>` : ''}
        </a>
      `).join('')}
    </nav>
    <div class="sidebar-footer">
      <div class="user-info">
        <div class="user-avatar">
          ${user?.avatar ? `<img src="${user.avatar}" alt="">` : initials}
        </div>
        <div class="user-details">
          <div class="user-name">${utils.escapeHtml(user?.username || 'User')}</div>
          <div class="user-role">${role}</div>
        </div>
      </div>
    </div>
  `;
}

function getNavItems(role) {
  const items = [];

  if (role === 'admin') {
    items.push({ id: 'dashboard', path: '/dashboard', icon: '📊', label: 'Dashboard' });
    items.push({ id: 'shifts', path: '/shifts', icon: '📅', label: 'Shifts' });
    items.push({ id: 'calendar', path: '/calendar', icon: '📆', label: 'Calendar' });
    items.push({ id: 'shift-requests', path: '/shift-requests', icon: '📋', label: 'Requests', badge: 0 });
    items.push({ id: 'clients', path: '/clients', icon: '👥', label: 'Clients' });
    items.push({ id: 'staff', path: '/staff', icon: '👤', label: 'Staff' });
    items.push({ id: 'invoices', path: '/invoices', icon: '💰', label: 'Invoices' });
    items.push({ id: 'reports', path: '/reports', icon: '📈', label: 'Reports' });
    items.push({ id: 'settings', path: '/settings', icon: '⚙️', label: 'Settings' });
  } else if (role === 'staff') {
    items.push({ id: 'dashboard', path: '/dashboard', icon: '📊', label: 'Dashboard' });
    items.push({ id: 'shifts', path: '/shifts', icon: '📅', label: 'My Shifts' });
    items.push({ id: 'calendar', path: '/calendar', icon: '📆', label: 'Calendar' });
    items.push({ id: 'availability', path: '/availability', icon: '✓', label: 'Availability' });
    items.push({ id: 'invoices', path: '/invoices', icon: '💰', label: 'My Earnings' });
    items.push({ id: 'profile', path: '/profile', icon: '👤', label: 'Profile' });
  } else if (role === 'client') {
    items.push({ id: 'dashboard', path: '/dashboard', icon: '📊', label: 'Dashboard' });
    items.push({ id: 'shifts', path: '/shifts', icon: '📅', label: 'My Shifts' });
    items.push({ id: 'shift-requests', path: '/shift-requests', icon: '📋', label: 'Requests' });
    items.push({ id: 'invoices', path: '/invoices', icon: '💰', label: 'Invoices' });
    items.push({ id: 'profile', path: '/profile', icon: '👤', label: 'Profile' });
  }

  items.push({ id: 'logout', path: '/logout', icon: '🚪', label: 'Logout' });
  return items;
}

function isActive(path) {
  const current = router.getCurrentPath();
  if (path === '/dashboard') return current === '/dashboard' || current === '/';
  return current.startsWith(path);
}

function bindSidebarEvents() {
  document.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const path = el.dataset.nav;
      if (path === '/logout') {
        handleLogout();
        return;
      }
      router.navigate(path);
      document.getElementById('sidebar').classList.remove('open');
    });
  });

  document.getElementById('hamburger').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });
}

function handleLogout() {
  utils.showConfirm('Logout', 'Are you sure you want to logout?').then(confirm => {
    if (confirm) {
      auth.logout();
      router.navigate('/login');
    }
  });
}

function bindThemeToggle() {
  const toggle = document.getElementById('theme-toggle');
  const html = document.documentElement;
  const saved = localStorage.getItem('avana_theme') || 'light';
  html.setAttribute('data-theme', saved);

  toggle.addEventListener('click', () => {
    const current = html.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('avana_theme', next);
  });
}

function bindNotificationEvents() {
  const btn = document.getElementById('notification-btn');
  const panel = document.getElementById('notification-panel');
  const close = document.getElementById('notif-close');

  btn.addEventListener('click', () => {
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) {
      loadNotifications();
    }
  });

  close.addEventListener('click', () => panel.classList.remove('open'));
  document.addEventListener('click', (e) => {
    if (!panel.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
      panel.classList.remove('open');
    }
  });
}

async function loadNotifications() {
  try {
    const data = await api.get('/notifications');
    const list = document.getElementById('notification-list');
    if (data.notifications.length === 0) {
      list.innerHTML = '<div class="empty-state" style="padding:40px"><div class="empty-icon">🔔</div><h3>No notifications</h3><p>You have no notifications yet.</p></div>';
      return;
    }
    list.innerHTML = data.notifications.map(n => `
      <div class="notification-item ${n.is_read ? '' : 'unread'}" data-id="${n.id}">
        <div class="notif-title">${utils.escapeHtml(n.title)}</div>
        <div class="notif-message">${utils.escapeHtml(n.message)}</div>
        <div class="notif-time">${utils.formatDateTime(n.created_at)}</div>
      </div>
    `).join('');

    list.querySelectorAll('.notification-item').forEach(el => {
      el.addEventListener('click', async () => {
        await api.put(`/notifications/${el.dataset.id}/read`);
        el.classList.remove('unread');
        updateNotifBadge();
      });
    });
  } catch (err) {
    console.error('Failed to load notifications:', err);
  }
}

async function updateNotifBadge() {
  try {
    const data = await api.get('/notifications/unread');
    const badge = document.getElementById('notif-badge');
    if (data.count > 0) {
      badge.textContent = data.count;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  } catch (err) {}
}

// Auto-update notification badge every 30s
setInterval(updateNotifBadge, 30000);

// Router setup
router.addBeforeHook((path, route) => {
  if (path === '/login' || path === '/register') {
    if (auth.isAuthenticated()) {
      router.navigate('/dashboard');
      return false;
    }
    return true;
  }

  if (!auth.isAuthenticated()) {
    router.navigate('/login');
    return false;
  }

  if (route.roles && route.roles.length > 0) {
    if (!route.roles.includes(auth.getUserRole())) {
      router.navigate('/dashboard');
      utils.showToast('Access denied. Insufficient permissions.', 'error');
      return false;
    }
  }

  return true;
});

// Page title mapping
const pageTitles = {
  '/dashboard': 'Dashboard',
  '/shifts': 'Shifts',
  '/calendar': 'Calendar',
  '/clients': 'Clients',
  '/staff': 'Staff',
  '/invoices': 'Invoices',
  '/reports': 'Reports',
  '/availability': 'Availability',
  '/settings': 'Settings',
  '/shift-requests': 'Shift Requests',
  '/profile': 'Profile',
  '/login': 'Login',
  '/register': 'Register'
};

async function renderPage(pageModule, title) {
  document.title = `${title} | Avana Care Shift`;
  if (title === 'Login' || title === 'Register') {
    const el = await pageModule.render();
    APP.innerHTML = '';
    APP.appendChild(el);
    if (pageModule.mount) pageModule.mount();
    return pageModule;
  }

  renderLayout('<div id="page-content-inner"></div>');
  document.getElementById('page-title').textContent = title;

  const container = document.getElementById('page-content-inner');
  const el = await pageModule.render();
  if (typeof el === 'string') container.innerHTML = el;
  else if (el instanceof HTMLElement) { container.innerHTML = ''; container.appendChild(el); }

  updateNotifBadge();
  if (pageModule.mount) pageModule.mount();

  return pageModule;
}

// Route definitions
router.addRoute('/login', async () => renderPage(loginPage, 'Login'), false);
router.addRoute('/register', async () => renderPage(loginPage, 'Register'), false);
router.addRoute('/dashboard', async () => renderPage(dashboardPage, 'Dashboard'));
router.addRoute('/shifts', async () => renderPage(shiftsPage, 'Shifts'));
router.addRoute('/calendar', async () => renderPage(calendarPage, 'Calendar'));
router.addRoute('/clients', async () => renderPage(clientsPage, 'Clients'));
router.addRoute('/staff', async () => renderPage(staffPage, 'Staff'));
router.addRoute('/invoices', async () => renderPage(invoicesPage, 'Invoices'));
router.addRoute('/reports', async () => renderPage(reportsPage, 'Reports'));
router.addRoute('/availability', async () => renderPage(availabilityPage, 'Availability'));
router.addRoute('/settings', async () => renderPage(settingsPage, 'Settings'));
router.addRoute('/profile', async () => renderPage(profilePage, 'Profile'));
router.addRoute('/shift-requests', async () => renderPage(shiftRequestsPage, 'Shift Requests'));

// Boot
async function boot() {
  if (auth.isAuthenticated()) {
    await auth.loadUser();
    if (auth.isAuthenticated()) {
      if (router.getCurrentPath() === '/login' || router.getCurrentPath() === '/') {
        router.navigate('/dashboard');
        return;
      }
    }
  }
  router.start();
}

boot();
