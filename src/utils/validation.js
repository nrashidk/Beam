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
 * Minimum 8 characters with uppercase, lowercase, and special character
 */
export const validatePassword = (value) => {
  if (!value) return { isValid: true, error: '' };
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/;
  const isValid = passwordRegex.test(value);
  return {
    isValid,
    error: isValid ? '' : 'Min 8 chars: Uppercase, lowercase & special char'
  };
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
  password: 'Password must contain at least 8 characters, including uppercase, lowercase, and special character',
  trn: 'TRN must be exactly 15 numeric digits'
};
