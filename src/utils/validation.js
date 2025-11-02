/**
 * Reusable validation utilities for InvoLinks
 * Provides consistent validation across all forms
 */

/**
 * Phone number validation
 * UAE phone numbers: 10 digits (e.g., 0501234567)
 */
export const validatePhone = (value) => {
  if (!value) return { isValid: true, error: '' };
  const phoneRegex = /^[0-9]{10}$/;
  const isValid = phoneRegex.test(value);
  return {
    isValid,
    error: isValid ? '' : '10 digits only (e.g., 0501234567)'
  };
};

/**
 * Email validation
 * Standard email format validation
 */
export const validateEmail = (value) => {
  if (!value) return { isValid: true, error: '' };
  const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
  const isValid = emailRegex.test(value);
  return {
    isValid,
    error: isValid ? '' : 'Valid email format required'
  };
};

/**
 * Password validation
 * Minimum 8 characters with uppercase, lowercase, number, and special character
 */
export const validatePassword = (value) => {
  if (!value) return { isValid: true, error: '' };

  const errors = [];

  if (value.length < 8) {
    errors.push('at least 8 characters');
  }
  if (!/[A-Z]/.test(value)) {
    errors.push('one uppercase letter');
  }
  if (!/[a-z]/.test(value)) {
    errors.push('one lowercase letter');
  }
  if (!/\d/.test(value)) {
    errors.push('one number');
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(value)) {
    errors.push('one special character');
  }

  const isValid = errors.length === 0;
  return {
    isValid,
    error: isValid ? '' : `Password must contain ${errors.join(', ')}`
  };
};

/**
 * Get password strength score and feedback
 * @param {string} password - Password to evaluate
 * @returns {Object} - {score: number, strength: string, feedback: string[]}
 */
export const getPasswordStrength = (password) => {
  let score = 0;
  const feedback = [];

  if (!password) {
    return { score: 0, strength: 'none', feedback: ['Enter a password'] };
  }

  // Length scoring
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;

  // Character variety
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 1;

  // Deductions for common patterns
  if (/^[0-9]+$/.test(password)) {
    score -= 2;
    feedback.push('Avoid using only numbers');
  }
  if (/^[a-zA-Z]+$/.test(password)) {
    score -= 1;
    feedback.push('Add numbers and special characters');
  }
  if (/(.)\1{2,}/.test(password)) {
    score -= 1;
    feedback.push('Avoid repeating characters');
  }

  // Determine strength level
  let strength = 'weak';
  if (score >= 6) strength = 'strong';
  else if (score >= 4) strength = 'medium';

  // Add positive feedback
  if (score >= 6) {
    feedback.push('Strong password!');
  } else if (score >= 4) {
    feedback.push('Consider making it longer');
  }

  return { score: Math.max(0, score), strength, feedback };
};

/**
 * TRN validation (UAE Tax Registration Number)
 * Exactly 15 numeric digits
 */
export const validateTRN = (value) => {
  if (!value) return { isValid: true, error: '' };
  const trnValue = String(value).trim();
  const isValid = trnValue.length === 15 && /^\d+$/.test(trnValue);
  return {
    isValid,
    error: isValid ? '' : 'TRN must be exactly 15 numeric digits'
  };
};

/**
 * Format phone number to remove non-numeric characters
 */
export const formatPhone = (value) => {
  return value.replace(/[^0-9]/g, '');
};

/**
 * Format email to lowercase and trim
 */
export const formatEmail = (value) => {
  return value.toLowerCase().trim();
};

/**
 * Validation patterns for HTML input elements
 */
export const VALIDATION_PATTERNS = {
  phone: '[0-9]{10}',
  email: '[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}',
  password: '^(?=.*[a-z])(?=.*[A-Z])(?=.*[@$!%*?&#])[A-Za-z\\d@$!%*?&#]{8,}$',
  trn: '[0-9]{15}'
};

/**
 * Validation titles for HTML input elements
 */
export const VALIDATION_TITLES = {
  phone: 'Please enter exactly 10 digits',
  email: 'Please enter a valid email address',
  password: 'Password must contain at least 8 characters, including uppercase, lowercase, number, and special character',
  trn: 'TRN must be exactly 15 numeric digits'
};

/**
 * Sanitize input to prevent XSS attacks
 * @param {string} input - Input string to sanitize
 * @returns {string} - Sanitized string
 */
export const sanitizeInput = (input) => {
  if (!input || typeof input !== 'string') return '';

  // Remove HTML tags and dangerous characters
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

/**
 * Validate file upload
 * @param {File} file - File object to validate
 * @param {Object} options - {maxSize, allowedTypes}
 * @returns {Object} - {isValid: boolean, error: string}
 */
export const validateFile = (file, options = {}) => {
  const { maxSize = 10 * 1024 * 1024, allowedTypes = [] } = options; // Default 10MB

  if (!file) {
    return { isValid: false, error: 'No file selected' };
  }

  // Check file size
  if (file.size > maxSize) {
    const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(1);
    return { isValid: false, error: `File size exceeds ${maxSizeMB}MB limit` };
  }

  // Check file type
  if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
    return { isValid: false, error: `File type not allowed. Allowed: ${allowedTypes.join(', ')}` };
  }

  return { isValid: true, error: '' };
};

/**
 * Validate URL format
 * @param {string} url - URL to validate
 * @returns {Object} - {isValid: boolean, error: string}
 */
export const validateURL = (url) => {
  if (!url) return { isValid: true, error: '' };

  try {
    const urlObj = new URL(url);
    const isValid = urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    return {
      isValid,
      error: isValid ? '' : 'URL must start with http:// or https://'
    };
  } catch {
    return { isValid: false, error: 'Invalid URL format' };
  }
};

/**
 * Validate numeric input
 * @param {string|number} value - Value to validate
 * @param {Object} options - {min, max, allowDecimals}
 * @returns {Object} - {isValid: boolean, error: string}
 */
export const validateNumber = (value, options = {}) => {
  const { min, max, allowDecimals = true } = options;

  if (value === '' || value === null || value === undefined) {
    return { isValid: true, error: '' };
  }

  const num = Number(value);

  if (isNaN(num)) {
    return { isValid: false, error: 'Must be a valid number' };
  }

  if (!allowDecimals && !Number.isInteger(num)) {
    return { isValid: false, error: 'Decimals not allowed' };
  }

  if (min !== undefined && num < min) {
    return { isValid: false, error: `Must be at least ${min}` };
  }

  if (max !== undefined && num > max) {
    return { isValid: false, error: `Must not exceed ${max}` };
  }

  return { isValid: true, error: '' };
};

/**
 * Validate required field
 * @param {any} value - Value to validate
 * @returns {Object} - {isValid: boolean, error: string}
 */
export const validateRequired = (value) => {
  if (value === null || value === undefined) {
    return { isValid: false, error: 'This field is required' };
  }

  if (typeof value === 'string' && value.trim().length === 0) {
    return { isValid: false, error: 'This field is required' };
  }

  if (Array.isArray(value) && value.length === 0) {
    return { isValid: false, error: 'This field is required' };
  }

  return { isValid: true, error: '' };
};

/**
 * Format TRN for display (with spaces)
 * @param {string} trn - 15-digit TRN
 * @returns {string} - Formatted TRN (123 4567 8901 2345)
 */
export const formatTRN = (trn) => {
  if (!trn) return '';

  const cleaned = String(trn).replace(/\s/g, '');
  if (cleaned.length !== 15) return trn;

  return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 7)} ${cleaned.slice(7, 11)} ${cleaned.slice(11, 15)}`;
};
