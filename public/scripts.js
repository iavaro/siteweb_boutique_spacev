/**
 * SpaceV - Frontend JavaScript
 * ============================
 * Handles API calls, UI interactions, and dynamic functionality
 * 
 * @author SpaceV
 * @version 1.0.0
 */

// ==============================================
// API Configuration
// ==============================================
const API_BASE = '/api';

// ==============================================
// API Helper Functions
// ==============================================

/**
 * Make an API request
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  
  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include',
  };

  // Add auth token if available
  const token = localStorage.getItem('token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }

    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

// Shortcut methods
const api = {
  get: (endpoint) => apiRequest(endpoint, { method: 'GET' }),
  post: (endpoint, body) => apiRequest(endpoint, { method: 'POST', body: JSON.stringify(body) }),
  put: (endpoint, body) => apiRequest(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (endpoint) => apiRequest(endpoint, { method: 'DELETE' }),
};

// ==============================================
// Authentication
// ==============================================

const auth = {
  /**
   * Check if user is logged in
   */
  async check() {
    try {
      const data = await api.get('/auth/me');
      return data;
    } catch (error) {
      return { authenticated: false, user: null };
    }
  },

  /**
   * Login user
   */
  async login(email, password) {
    const data = await api.post('/auth/login', { email, password });
    if (data.token) {
      localStorage.setItem('token', data.token);
    }
    return data;
  },

  /**
   * Register user
   */
  async register(email, username, password) {
    const data = await api.post('/auth/register', { email, username, password });
    if (data.token) {
      localStorage.setItem('token', data.token);
    }
    return data;
  },

  /**
   * Logout user
   */
  async logout() {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      // Ignore logout errors
    }
    localStorage.removeItem('token');
    window.location.href = '/';
  },

  /**
   * Login with Discord
   */
  loginWithDiscord() {
    window.location.href = '/api/auth/discord';
  },
};

// ==============================================
// Products
// ==============================================

const products = {
  /**
   * Get all products with optional filters
   */
  async getAll(filters = {}) {
    const params = new URLSearchParams(filters).toString();
    return api.get(`/products?${params}`);
  },

  /**
   * Get featured products
   */
  async getFeatured() {
    return api.get('/products/featured');
  },

  /**
   * Get product by slug
   */
  async getBySlug(slug) {
    return api.get(`/products/${slug}`);
  },

  /**
   * Get categories
   */
  async getCategories() {
    return api.get('/products/categories');
  },

  /**
   * Get products by category
   */
  async getByCategory(categorySlug, page = 1) {
    return api.get(`/products/category/${categorySlug}?page=${page}`);
  },
};

// ==============================================
// Cart
// ==============================================

const cart = {
  /**
   * Get cart contents
   */
  async get() {
    return api.get('/orders/cart');
  },

  /**
   * Add item to cart
   */
  async addItem(productId, quantity = 1) {
    return api.post('/orders/cart', { productId, quantity });
  },

  /**
   * Update item quantity
   */
  async updateItem(productId, quantity) {
    return api.put(`/orders/cart/${productId}`, { quantity });
  },

  /**
   * Remove item from cart
   */
  async removeItem(productId) {
    return api.delete(`/orders/cart/${productId}`);
  },

  /**
   * Clear cart
   */
  async clear() {
    return api.delete('/orders/cart');
  },

  /**
   * Proceed to checkout
   */
  async checkout() {
    return api.post('/orders/checkout');
  },
};

// ==============================================
// Orders
// ==============================================

const orders = {
  /**
   * Get user's orders
   */
  async getAll(page = 1, status = null) {
    const params = new URLSearchParams({ page });
    if (status) params.append('status', status);
    return api.get(`/orders?${params}`);
  },

  /**
   * Get single order
   */
  async getById(id) {
    return api.get(`/orders/${id}`);
  },

  /**
   * Get order history
   */
  async getHistory() {
    return api.get('/orders/history');
  },
};

// ==============================================
// User
// ==============================================

const user = {
  /**
   * Get current user profile
   */
  async getProfile() {
    return api.get('/users/me');
  },

  /**
   * Update profile
   */
  async updateProfile(data) {
    return api.put('/users/me', data);
  },

  /**
   * Change password
   */
  async changePassword(currentPassword, newPassword) {
    return api.put('/users/me/password', { currentPassword, newPassword });
  },

  /**
   * Get notifications
   */
  async getNotifications(page = 1, unreadOnly = false) {
    return api.get(`/users/notifications?page=${page}&unreadOnly=${unreadOnly}`);
  },

  /**
   * Mark notification as read
   */
  async markNotificationRead(id) {
    return api.put(`/users/notifications/${id}/read`);
  },

  /**
   * Mark all notifications as read
   */
  async markAllNotificationsRead() {
    return api.put('/users/notifications/read-all');
  },
};

// ==============================================
// Invoices
// ==============================================

const invoices = {
  /**
   * Get user's invoices
   */
  async getAll(page = 1) {
    return api.get(`/invoices?page=${page}`);
  },

  /**
   * Get single invoice
   */
  async getById(id) {
    return api.get(`/invoices/${id}`);
  },

  /**
   * Download invoice PDF
   */
  downloadPdf(id) {
    const token = localStorage.getItem('token');
    window.open(`/api/invoices/${id}/pdf?token=${token}`, '_blank');
  },

  /**
   * Resend invoice email
   */
  async resendEmail(id) {
    return api.post(`/invoices/${id}/resend`);
  },
};

// ==============================================
// Admin
// ==============================================

const admin = {
  /**
   * Get dashboard stats
   */
  async getDashboard() {
    return api.get('/admin/dashboard');
  },

  /**
   * Get all users
   */
  async getUsers(page = 1, filters = {}) {
    const params = new URLSearchParams({ page, ...filters }).toString();
    return api.get(`/admin/users?${params}`);
  },

  /**
   * Update user
   */
  async updateUser(id, data) {
    return api.put(`/admin/users/${id}`, data);
  },

  /**
   * Delete user
   */
  async deleteUser(id) {
    return api.delete(`/admin/users/${id}`);
  },

  /**
   * Get all orders
   */
  async getOrders(page = 1, filters = {}) {
    const params = new URLSearchParams({ page, ...filters }).toString();
    return api.get(`/admin/orders?${params}`);
  },

  /**
   * Update order
   */
  async updateOrder(id, data) {
    return api.put(`/admin/orders/${id}`, data);
  },

  /**
   * Get analytics
   */
  async getAnalytics(period = '7d') {
    return api.get(`/admin/analytics?period=${period}`);
  },

  /**
   * Get settings
   */
  async getSettings() {
    return api.get('/admin/settings');
  },

  /**
   * Update settings
   */
  async updateSettings(settings) {
    return api.put('/admin/settings', { settings });
  },

  /**
   * Get all products (admin)
   */
  async getProducts(page = 1, filters = {}) {
    const params = new URLSearchParams({ page, ...filters }).toString();
    return api.get(`/admin/products?${params}`);
  },

  /**
   * Create product
   */
  async createProduct(data) {
    return api.post('/products', data);
  },

  /**
   * Update product
   */
  async updateProduct(id, data) {
    return api.put(`/products/${id}`, data);
  },

  /**
   * Delete product
   */
  async deleteProduct(id) {
    return api.delete(`/products/${id}`);
  },

  /**
   * Create category
   */
  async createCategory(data) {
    return api.post('/products/categories', data);
  },

  /**
   * Update category
   */
  async updateCategory(id, data) {
    return api.put(`/products/categories/${id}`, data);
  },

  /**
   * Delete category
   */
  async deleteCategory(id) {
    return api.delete(`/products/categories/${id}`);
  },
};

// ==============================================
// UI Helpers
// ==============================================

const ui = {
  /**
   * Show toast notification
   */
  showToast(message, type = 'info') {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-content">
        <span>${message}</span>
      </div>
    `;

    container.appendChild(toast);

    // Auto remove after 5 seconds
    setTimeout(() => {
      toast.style.animation = 'slideIn 0.3s ease reverse';
      setTimeout(() => toast.remove(), 300);
    }, 5000);
  },

  /**
   * Show loading spinner
   */
  showLoading(element) {
    element.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  },

  /**
   * Format currency
   */
  formatCurrency(amount, currency = 'USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  },

  /**
   * Format date
   */
  formatDate(date) {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  },

  /**
   * Format relative time
   */
  timeAgo(date) {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    
    const intervals = {
      year: 31536000,
      month: 2592000,
      week: 604800,
      day: 86400,
      hour: 3600,
      minute: 60,
    };
    
    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
      const interval = Math.floor(seconds / secondsInUnit);
      if (interval >= 1) {
        return `${interval} ${unit}${interval > 1 ? 's' : ''} ago`;
      }
    }
    
    return 'Just now';
  },

  /**
   * Get URL parameters
   */
  getParams() {
    return new URLSearchParams(window.location.search);
  },

  /**
   * Redirect with message
   */
  redirect(url, message = null, type = 'info') {
    if (message) {
      sessionStorage.setItem('toast', JSON.stringify({ message, type }));
    }
    window.location.href = url;
  },

  /**
   * Show session message
   */
  showSessionMessage() {
    const message = sessionStorage.getItem('toast');
    if (message) {
      const { message: msg, type } = JSON.parse(message);
      ui.showToast(msg, type);
      sessionStorage.removeItem('toast');
    }
  },
};

// ==============================================
// DOM Ready
// ==============================================

document.addEventListener('DOMContentLoaded', () => {
  // Show session messages
  ui.showSessionMessage();

  // Initialize mobile menu
  initMobileMenu();

  // Initialize cart counter
  initCartCounter();

  // Initialize auth state
  initAuthState();

  // Initialize forms
  initForms();

  // Initialize modals
  initModals();
});

// ==============================================
// Mobile Menu
// ==============================================

function initMobileMenu() {
  const toggle = document.querySelector('.navbar-toggle');
  const menu = document.querySelector('.navbar-menu');

  if (toggle && menu) {
    toggle.addEventListener('click', () => {
      menu.classList.toggle('active');
    });
  }
}

// ==============================================
// Cart Counter
// ==============================================

async function initCartCounter() {
  const counter = document.querySelector('.cart-count');
  if (!counter) return;

  try {
    const data = await cart.get();
    counter.textContent = data.itemCount || 0;
    counter.style.display = data.itemCount > 0 ? 'flex' : 'none';
  } catch (error) {
    // Ignore cart errors
  }
}

// ==============================================
// Auth State
// ==============================================

async function initAuthState() {
  const authButtons = document.querySelector('.auth-buttons');
  const userMenu = document.querySelector('.user-menu');

  if (!authButtons && !userMenu) return;

  try {
    const { authenticated, user } = await auth.check();

    if (authenticated && user) {
      // Show user menu, hide auth buttons
      if (authButtons) authButtons.style.display = 'none';
      if (userMenu) {
        userMenu.style.display = 'flex';
        const usernameEl = userMenu.querySelector('.username');
        if (usernameEl) usernameEl.textContent = user.username;
      }
    } else {
      // Show auth buttons, hide user menu
      if (authButtons) authButtons.style.display = 'flex';
      if (userMenu) userMenu.style.display = 'none';
    }
  } catch (error) {
    console.error('Auth check failed:', error);
  }
}

// ==============================================
// Form Handling
// ==============================================

function initForms() {
  // Login form
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }

  // Register form
  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', handleRegister);
  }

  // Contact form
  const contactForm = document.getElementById('contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', handleContact);
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const form = e.target;
  const submitBtn = form.querySelector('button[type="submit"]');
  const errorDiv = form.querySelector('.form-error');

  const email = form.email.value;
  const password = form.password.value;

  submitBtn.disabled = true;
  submitBtn.textContent = 'Logging in...';

  try {
    await auth.login(email, password);
    ui.redirect('/dashboard', 'Welcome back!', 'success');
  } catch (error) {
    if (errorDiv) {
      errorDiv.textContent = error.message;
      errorDiv.style.display = 'block';
    }
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Login';
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const form = e.target;
  const submitBtn = form.querySelector('button[type="submit"]');
  const errorDiv = form.querySelector('.form-error');

  const email = form.email.value;
  const username = form.username.value;
  const password = form.password.value;
  const confirmPassword = form.confirmPassword?.value;

  if (password !== confirmPassword) {
    if (errorDiv) {
      errorDiv.textContent = 'Passwords do not match';
      errorDiv.style.display = 'block';
    }
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Creating account...';

  try {
    await auth.register(email, username, password);
    ui.redirect('/dashboard', 'Account created successfully!', 'success');
  } catch (error) {
    if (errorDiv) {
      errorDiv.textContent = error.message;
      errorDiv.style.display = 'block';
    }
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Register';
  }
}

async function handleContact(e) {
  e.preventDefault();
  const form = e.target;
  const submitBtn = form.querySelector('button[type="submit"]');

  const name = form.name?.value;
  const email = form.email.value;
  const subject = form.subject?.value;
  const message = form.message.value;

  submitBtn.disabled = true;
  submitBtn.textContent = 'Sending...';

  try {
    // In a real app, this would send to an API endpoint
    ui.showToast('Message sent! We\'ll get back to you soon.', 'success');
    form.reset();
  } catch (error) {
    ui.showToast(error.message, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Send Message';
  }
}

// ==============================================
// Modal Handling
// ==============================================

function initModals() {
  const modalTriggers = document.querySelectorAll('[data-modal]');
  const modalCloseBtns = document.querySelectorAll('.modal-close');

  // Open modal
  modalTriggers.forEach(trigger => {
    trigger.addEventListener('click', () => {
      const modalId = trigger.dataset.modal;
      const modal = document.getElementById(modalId);
      if (modal) {
        modal.classList.add('active');
      }
    });
  });

  // Close modal
  modalCloseBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = btn.closest('.modal-overlay');
      if (modal) {
        modal.classList.remove('active');
      }
    });
  });

  // Close on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('active');
      }
    });
  });

  // Close on escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.active').forEach(modal => {
        modal.classList.remove('active');
      });
    }
  });
}

// ==============================================
// Utility: Add to Cart Button
// ==============================================

async function addToCart(productId, quantity = 1) {
  try {
    await cart.addItem(productId, quantity);
    ui.showToast('Added to cart!', 'success');
    
    // Update counter
    const counter = document.querySelector('.cart-count');
    if (counter) {
      const data = await cart.get();
      counter.textContent = data.itemCount || 0;
      counter.style.display = data.itemCount > 0 ? 'flex' : 'none';
    }
  } catch (error) {
    ui.showToast(error.message, 'error');
  }
}

// Make addToCart available globally
window.addToCart = addToCart;
window.ui = ui;
window.api = api;
window.auth = auth;
window.products = products;
window.cart = cart;
window.orders = orders;
window.user = user;
window.invoices = invoices;
window.admin = admin;

// ==============================================
// Leaderboards
// ==============================================

const leaderboards = {
  /**
   * Get all leaderboards
   */
  async getAll(limit = 10) {
    return api.get(`/leaderboards?limit=${limit}`);
  },

  /**
   * Get specific leaderboard
   */
  async getByType(type, page = 1, limit = 10) {
    return api.get(`/leaderboards/${type}?page=${page}&limit=${limit}`);
  },

  /**
   * Get richest players
   */
  async getRichest(limit = 10) {
    return this.getByType('money', 1, limit);
  },

  /**
   * Get most playtime
   */
  async getMostPlaytime(limit = 10) {
    return this.getByType('playtime', 1, limit);
  },

  /**
   * Get most kills
   */
  async getMostKills(limit = 10) {
    return this.getByType('kills', 1, limit);
  }
};

// ==============================================
// Players (RP)
// ==============================================

const rpPlayers = {
  /**
   * Get player profile
   */
  async getProfile(playerId) {
    return api.get(`/players/${playerId}`);
  },

  /**
   * Get player stats
   */
  async getStats(playerId) {
    return api.get(`/players/${playerId}/stats`);
  },

  /**
   * Get player inventory
   */
  async getInventory(playerId) {
    return api.get(`/players/${playerId}/inventory`);
  },

  /**
   * Get player assets
   */
  async getAssets(playerId, type = null) {
    const params = type ? `?type=${type}` : '';
    return api.get(`/players/${playerId}/assets${params}`);
  },

  /**
   * Search players
   */
  async search(query, page = 1, limit = 20) {
    return api.get(`/players?search=${encodeURIComponent(query)}&page=${page}&limit=${limit}`);
  }
};

// ==============================================
// Admin RP
// ==============================================

const adminRp = {
  /**
   * Get anti-cheat events
   */
  async getAnticheatEvents(filters = {}) {
    const params = new URLSearchParams(filters).toString();
    return api.get(`/admin-rp/anticheat?${params}`);
  },

  /**
   * Get anti-cheat statistics
   */
  async getAnticheatStats(days = 7) {
    return api.get(`/admin-rp/anticheat/stats?days=${days}`);
  },

  /**
   * Get flagged players
   */
  async getFlaggedPlayers() {
    return api.get('/admin-rp/anticheat/flagged');
  },

  /**
   * Resolve anti-cheat event
   */
  async resolveEvent(eventId, notes = '') {
    return api.put(`/admin-rp/anticheat/${eventId}/resolve`, { notes });
  },

  /**
   * Get RP players
   */
  async getPlayers(filters = {}) {
    const params = new URLSearchParams(filters).toString();
    return api.get(`/admin-rp/players?${params}`);
  },

  /**
   * Get RP player details
   */
  async getPlayer(playerId) {
    return api.get(`/admin-rp/players/${playerId}`);
  },

  /**
   * Ban player
   */
  async banPlayer(playerId, reason) {
    return api.put(`/admin-rp/players/${playerId}/ban`, { reason });
  },

  /**
   * Unban player
   */
  async unbanPlayer(playerId) {
    return api.put(`/admin-rp/players/${playerId}/unban`);
  },

  /**
   * Wipe player inventory
   */
  async wipeInventory(playerId) {
    return api.put(`/admin-rp/players/${playerId}/wipe-inventory`);
  },

  /**
   * Reset player stats
   */
  async resetStats(playerId) {
    return api.put(`/admin-rp/players/${playerId}/reset-stats`);
  },

  /**
   * Get FiveM servers
   */
  async getServers() {
    return api.get('/admin-rp/servers');
  },

  /**
   * Add FiveM server
   */
  async addServer(data) {
    return api.post('/admin-rp/servers', data);
  },

  /**
   * Update FiveM server
   */
  async updateServer(serverId, data) {
    return api.put(`/admin-rp/servers/${serverId}`, data);
  },

  /**
   * Delete FiveM server
   */
  async deleteServer(serverId) {
    return api.delete(`/admin-rp/servers/${serverId}`);
  },

  /**
   * Regenerate FiveM server API key
   */
  async regenerateApiKey(serverId) {
    return api.post(`/admin-rp/servers/${serverId}/regenerate-key`);
  },

  /**
   * Get Discord webhooks
   */
  async getWebhooks() {
    return api.get('/admin-rp/webhooks');
  },

  /**
   * Add Discord webhook
   */
  async addWebhook(data) {
    return api.post('/admin-rp/webhooks', data);
  },

  /**
   * Update Discord webhook
   */
  async updateWebhook(webhookId, data) {
    return api.put(`/admin-rp/webhooks/${webhookId}`, data);
  },

  /**
   * Delete Discord webhook
   */
  async deleteWebhook(webhookId) {
    return api.delete(`/admin-rp/webhooks/${webhookId}`);
  }
};

// Make functions available globally
window.leaderboards = leaderboards;
window.rpPlayers = rpPlayers;
window.adminRp = adminRp;

