/**
 * SpaceV - Helper Utilities
 * =========================
 * Common utility functions used across the backend.
 * 
 * @author SpaceV
 * @version 1.0.0
 */

const jwt = require('jsonwebtoken');

/**
 * Generate JWT token for user
 * @param {number} userId - User ID
 * @param {string} role - User role
 * @returns {string} JWT token
 */
const generateToken = (userId, role) => {
  return jwt.sign(
    { userId, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

/**
 * Generate invoice number
 * @returns {string} Invoice number (e.g., INV-2024-001234)
 */
const generateInvoiceNumber = () => {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 999999).toString().padStart(6, '0');
  return `INV-${year}-${random}`;
};

/**
 * Generate order ID
 * @returns {string} Order ID
 */
const generateOrderId = () => {
  return `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Format currency
 * @param {number} amount - Amount
 * @param {string} currency - Currency code
 * @returns {string} Formatted currency
 */
const formatCurrency = (amount, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount);
};

/**
 * Format date
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted date
 */
const formatDate = (date) => {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
};

/**
 * Sanitize string for HTML display
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
const sanitizeHtml = (str) => {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#039;');
};

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} Is valid email
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Paginate results
 * @param {Array} items - Array of items
 * @param {number} page - Page number (1-based)
 * @param {number} limit - Items per page
 * @returns {Object} Paginated results
 */
const paginate = (items, page = 1, limit = 10) => {
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  
  const paginatedItems = items.slice(startIndex, endIndex);
  const totalPages = Math.ceil(items.length / limit);
  
  return {
    items: paginatedItems,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: items.length,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
};

/**
 * Calculate discount percentage
 * @param {number} original - Original price
 * @param {number} discounted - Discounted price
 * @returns {number} Discount percentage
 */
const calculateDiscount = (original, discounted) => {
  if (original <= 0) return 0;
  return Math.round(((original - discounted) / original) * 100);
};

/**
 * Get time ago string
 * @param {Date|string} date - Date to compare
 * @returns {string} Time ago string
 */
const timeAgo = (date) => {
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
};

/**
 * Parse user agent for device info
 * @param {string} userAgent - User agent string
 * @returns {Object} Device info
 */
const parseUserAgent = (userAgent) => {
  const info = {
    browser: 'Unknown',
    os: 'Unknown',
    device: 'Desktop',
    isMobile: false,
  };
  
  if (!userAgent) return info;
  
  // Detect OS
  if (userAgent.includes('Windows')) info.os = 'Windows';
  else if (userAgent.includes('Mac')) info.os = 'macOS';
  else if (userAgent.includes('Linux')) info.os = 'Linux';
  else if (userAgent.includes('Android')) info.os = 'Android';
  else if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) info.os = 'iOS';
  
  // Detect browser
  if (userAgent.includes('Firefox')) info.browser = 'Firefox';
  else if (userAgent.includes('Chrome')) info.browser = 'Chrome';
  else if (userAgent.includes('Safari')) info.browser = 'Safari';
  else if (userAgent.includes('Edge')) info.browser = 'Edge';
  
  // Detect mobile
  info.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  info.device = info.isMobile ? 'Mobile' : 'Desktop';
  
  return info;
};

/**
 * Generate random string
 * @param {number} length - Length of string
 * @returns {string} Random string
 */
const randomString = (length = 32) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Sleep/delay function
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} Resolves after ms
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

module.exports = {
  generateToken,
  generateInvoiceNumber,
  generateOrderId,
  formatCurrency,
  formatDate,
  sanitizeHtml,
  isValidEmail,
  paginate,
  calculateDiscount,
  timeAgo,
  parseUserAgent,
  randomString,
  sleep,
};

