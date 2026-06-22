import api from './api.js';

let currentUser = null;
let companySettings = {};

export function isAuthenticated() {
  return !!api.getToken();
}

export function getCurrentUser() {
  return currentUser;
}

export function getUserRole() {
  return currentUser ? currentUser.role : null;
}

export function hasRole(...roles) {
  return currentUser && roles.includes(currentUser.role);
}

export function getSettings() {
  return companySettings;
}

export async function login(username, password) {
  const data = await api.post('/auth/login', { username, password });
  api.setToken(data.token);
  currentUser = data.user;
  companySettings = data.settings;
  return data;
}

export async function registerClient(data) {
  const result = await api.post('/auth/register', data);
  api.setToken(result.token);
  currentUser = result.user;
  return result;
}

export function logout() {
  currentUser = null;
  companySettings = {};
  api.clearToken();
}

export async function loadUser() {
  if (!api.getToken()) return null;
  try {
    const data = await api.get('/auth/me');
    currentUser = data.user;
    companySettings = data.settings;
    return data;
  } catch (err) {
    api.clearToken();
    currentUser = null;
    companySettings = {};
    return null;
  }
}

export function isAdmin() { return currentUser && currentUser.role === 'admin'; }
export function isStaff() { return currentUser && currentUser.role === 'staff'; }
export function isClient() { return currentUser && currentUser.role === 'client'; }
