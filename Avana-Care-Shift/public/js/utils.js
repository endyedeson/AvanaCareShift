export function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${m} ${ampm}`;
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function formatCurrency(amount, symbol = '$') {
  return `${symbol}${Number(amount || 0).toFixed(2)}`;
}

export function capitalize(str) {
  if (!str) return '';
  return str.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

export function getDayName(dayNum) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayNum] || '';
}

export function getStatusBadge(status) {
  return `<span class="badge badge-${status}">${capitalize(status)}</span>`;
}

export function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// Toast notifications
let toastContainer = null;

function ensureToastContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

export function showToast(message, type = 'info', duration = 4000) {
  const container = ensureToastContainer();
  const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${icons[type] || ''}</span><span>${escapeHtml(message)}</span><button class="toast-close" onclick="this.parentElement.remove()">×</button>`;
  container.appendChild(toast);
  setTimeout(() => { if (toast.parentElement) toast.remove(); }, duration);
}

// Loading overlay
let loadingOverlay = null;

export function showLoading(message = 'Loading...') {
  if (!loadingOverlay) {
    loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'loading-overlay';
    loadingOverlay.innerHTML = `<div class="loading-spinner"></div><div class="loading-text"></div>`;
    document.body.appendChild(loadingOverlay);
  }
  loadingOverlay.querySelector('.loading-text').textContent = message;
  loadingOverlay.style.display = 'flex';
}

export function hideLoading() {
  if (loadingOverlay) {
    loadingOverlay.style.display = 'none';
  }
}

// Confirm dialog
export function showConfirm(title, message, confirmText = 'Confirm', cancelText = 'Cancel', danger = false) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
      <div class="confirm-dialog">
        <div class="confirm-icon">${danger ? '⚠️' : 'ℹ️'}</div>
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(message)}</p>
        <div class="confirm-actions">
          <button class="btn btn-outline" id="confirm-cancel">${cancelText}</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="confirm-ok">${confirmText}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#confirm-ok').onclick = () => { overlay.remove(); resolve(true); };
    overlay.querySelector('#confirm-cancel').onclick = () => { overlay.remove(); resolve(false); };
    overlay.onclick = (e) => { if (e.target === overlay) { overlay.remove(); resolve(false); } };
  });
}

// Modal helper
export function openModal(content, options = {}) {
  const { title = '', size = '', onClose } = options;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal ${size}">
      <div class="modal-header">
        <h3>${escapeHtml(title)}</h3>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-body"></div>
    </div>
  `;

  const closeBtn = overlay.querySelector('.modal-close');
  const modalBody = overlay.querySelector('.modal-body');

  if (typeof content === 'string') {
    modalBody.innerHTML = content;
  } else if (content instanceof HTMLElement) {
    modalBody.appendChild(content);
  }

  const close = () => {
    overlay.remove();
    if (onClose) onClose();
  };

  closeBtn.onclick = close;
  overlay.onclick = (e) => { if (e.target === overlay) close(); };

  document.body.appendChild(overlay);
  return { overlay, modalBody, close };
}

// Form validation
export function validateForm(form) {
  const errors = [];
  const inputs = form.querySelectorAll('[required]');
  inputs.forEach(input => {
    if (!input.value.trim()) {
      const label = form.querySelector(`label[for="${input.id}"]`);
      errors.push(`${label ? label.textContent : input.placeholder || 'This field'} is required`);
      input.classList.add('error');
    } else {
      input.classList.remove('error');
    }
  });
  return errors;
}

// CSV download
export function downloadCSV(csv, filename = 'export.csv') {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// PDF download from HTML element
export function downloadPDF(element, filename = 'document.pdf') {
  if (window.html2pdf) {
    html2pdf().set({ margin: 10, filename, html2canvas: { scale: 2 } }).from(element).save();
  }
}

// Empty state
export function createEmptyState(icon, title, message, actionText = null, actionFn = null) {
  const div = document.createElement('div');
  div.className = 'empty-state';
  div.innerHTML = `
    <div class="empty-icon">${icon}</div>
    <h3>${escapeHtml(title)}</h3>
    <p>${escapeHtml(message)}</p>
    ${actionText ? `<button class="btn btn-primary">${escapeHtml(actionText)}</button>` : ''}
  `;
  if (actionFn) {
    div.querySelector('button').onclick = actionFn;
  }
  return div;
}

// Pagination
export function createPagination(current, total, onPage) {
  const div = document.createElement('div');
  div.className = 'pagination';

  const prev = document.createElement('button');
  prev.textContent = '‹';
  prev.disabled = current <= 1;
  prev.onclick = () => onPage(current - 1);
  div.appendChild(prev);

  const maxPages = Math.min(total, 10);
  const start = Math.max(1, current - 4);
  const end = Math.min(total, start + 9);

  for (let i = start; i <= end; i++) {
    const btn = document.createElement('button');
    btn.textContent = i;
    if (i === current) btn.className = 'active';
    btn.onclick = () => onPage(i);
    div.appendChild(btn);
  }

  const next = document.createElement('button');
  next.textContent = '›';
  next.disabled = current >= total;
  next.onclick = () => onPage(current + 1);
  div.appendChild(next);

  return div;
}

// Data table helper
export function createTable(headers, rows) {
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  headers.forEach(h => {
    const th = document.createElement('th');
    th.textContent = h;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  if (rows.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = headers.length;
    cell.className = 'text-center text-muted';
    cell.textContent = 'No data found';
    row.appendChild(cell);
    tbody.appendChild(row);
  } else {
    rows.forEach(cells => {
      const row = document.createElement('tr');
      cells.forEach(c => {
        const td = document.createElement('td');
        if (typeof c === 'string') td.innerHTML = c;
        else if (c instanceof HTMLElement) td.appendChild(c);
        else td.textContent = c;
        row.appendChild(td);
      });
      tbody.appendChild(row);
    });
  }
  table.appendChild(tbody);
  return table;
}

// Today's date as YYYY-MM-DD
export function today() {
  return new Date().toISOString().split('T')[0];
}

export function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}
