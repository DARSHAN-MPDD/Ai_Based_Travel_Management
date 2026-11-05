window.API_BASE = '/api';

async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  let data = {};
  try {
    data = await response.json();
  } catch (_) {
    data = {};
  }

  if (!response.ok) {
    if (response.status === 401 && token) {
      const msg = (data && data.message) || '';
      if (/invalid token|token expired|access token required|token verification failed/i.test(msg)) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        const page = (location.pathname.split('/').pop() || '').toLowerCase();
        if (page !== 'login.html' && page !== 'register.html') {
          window.location.href = 'login.html';
          return new Promise(() => {});
        }
      }
    }
    throw new Error(data.message || 'Request failed');
  }

  return data;
}

async function register(userData) {
  return apiRequest('/auth/register', {
    method: 'POST',
    body: JSON.stringify(userData)
  });
}

async function login(credentials) {
  return apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials)
  });
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = 'index.html';
}

function getCurrentUser() {
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
}

function isLoggedIn() {
  return !!localStorage.getItem('token');
}

function requireAuth() {
  if (!isLoggedIn()) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

function updateAuthUI() {
  const token = localStorage.getItem('token');
  const navLogin = document.getElementById('navLogin');
  const navRegister = document.getElementById('navRegister');
  const navDashboard = document.getElementById('navDashboard');
  const userMenu = document.getElementById('userMenu');
  
  if (token) {
    if (navLogin) navLogin.style.display = 'none';
    if (navRegister) navRegister.style.display = 'none';
    if (navDashboard) navDashboard.style.display = 'inline-block';
    if (userMenu) userMenu.style.display = 'block';
  } else {
    if (navLogin) navLogin.style.display = 'inline-block';
    if (navRegister) navRegister.style.display = 'inline-block';
    if (navDashboard) navDashboard.style.display = 'none';
    if (userMenu) userMenu.style.display = 'none';
  }
}

document.addEventListener('DOMContentLoaded', updateAuthUI);

window.Auth = {
  register,
  login,
  logout,
  getCurrentUser,
  isLoggedIn,
  requireAuth,
  updateAuthUI,
  apiRequest
};