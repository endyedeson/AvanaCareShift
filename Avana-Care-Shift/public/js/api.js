const API_BASE = '/api';

const api = {
  getToken() {
    return localStorage.getItem('avana_token');
  },

  setToken(token) {
    localStorage.setItem('avana_token', token);
  },

  clearToken() {
    localStorage.removeItem('avana_token');
  },

  async request(method, path, body = null) {
    const headers = { 'Content-Type': 'application/json' };
    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const options = { method, headers };
    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(`${API_BASE}${path}`, options);
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          this.clearToken();
          window.location.hash = '#/login';
          throw new Error(data.error || 'Session expired. Please login again.');
        }
        throw new Error(data.error || 'Request failed');
      }

      return data;
    } catch (err) {
      if (err.message.includes('Failed to fetch')) {
        throw new Error('Network error. Please check your connection.');
      }
      throw err;
    }
  },

  get(path) { return this.request('GET', path); },
  post(path, body) { return this.request('POST', path, body); },
  put(path, body) { return this.request('PUT', path, body); },
  delete(path) { return this.request('DELETE', path); },

  async upload(path, formData) {
    const token = this.getToken();
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers,
        body: formData
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Upload failed');
      return data;
    } catch (err) {
      throw err;
    }
  }
};

export default api;
