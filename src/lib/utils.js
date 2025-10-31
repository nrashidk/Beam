import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combines class names using clsx and tailwind-merge
 * This utility function merges Tailwind CSS classes intelligently,
 * handling conflicts and deduplication properly.
 *
 * @param {...any} inputs - Class names to merge
 * @returns {string} - Merged class string
 *
 * @example
 * cn('px-2 py-1', 'px-4') // => 'py-1 px-4' (px-2 is overridden)
 * cn('text-red-500', condition && 'text-blue-500') // => conditionally applies classes
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Format currency with proper symbol and decimal places
 * @param {number} amount - The amount to format
 * @param {string} currency - Currency code (default: AED)
 * @returns {string} - Formatted currency string
 */
export function formatCurrency(amount, currency = 'AED') {
  return new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format date to readable string
 * @param {string|Date} date - Date to format
 * @param {string} format - Format style ('short', 'long', 'medium')
 * @returns {string} - Formatted date string
 */
export function formatDate(date, format = 'medium') {
  const d = new Date(date);

  const formats = {
    short: { year: 'numeric', month: '2-digit', day: '2-digit' },
    medium: { year: 'numeric', month: 'short', day: 'numeric' },
    long: { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' },
  };

  return d.toLocaleDateString('en-US', formats[format] || formats.medium);
}

/**
 * Truncate text to specified length
 * @param {string} text - Text to truncate
 * @param {number} length - Maximum length
 * @returns {string} - Truncated text with ellipsis
 */
export function truncate(text, length = 50) {
  if (!text || text.length <= length) return text || '';
  return text.slice(0, length) + '...';
}

/**
 * Debounce function to limit function call frequency
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} - Debounced function
 */
export function debounce(func, wait = 300) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Get initials from name
 * @param {string} name - Full name
 * @returns {string} - Initials (max 2 characters)
 */
export function getInitials(name) {
  if (!name) return '';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} - True if valid email format
 */
export function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Sleep/delay function for async operations
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} - Promise that resolves after delay
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default {
  cn,
  formatCurrency,
  formatDate,
  truncate,
  debounce,
  getInitials,
  isValidEmail,
  sleep,
};
