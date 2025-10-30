import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from './input';
import { 
  validatePhone, 
  validateEmail, 
  validatePassword,
  validateTRN,
  formatPhone, 
  formatEmail,
  VALIDATION_PATTERNS,
  VALIDATION_TITLES
} from '../../utils/validation';

/**
 * Phone Input with built-in validation
 */
export function PhoneInput({ value, onChange, required = false, className = '', ...props }) {
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const formatted = formatPhone(e.target.value);
    
    if (formatted.length > 0) {
      const validation = validatePhone(formatted);
      setError(validation.error);
    } else {
      setError('');
    }
    
    onChange({ target: { value: formatted, name: e.target.name } });
  };

  return (
    <div>
      <Input
        type="text"
        required={required}
        placeholder="0501234567"
        pattern={VALIDATION_PATTERNS.phone}
        maxLength={10}
        title={VALIDATION_TITLES.phone}
        value={value}
        onChange={handleChange}
        className={className}
        {...props}
      />
      {error && (
        <small className="text-xs text-red-500">{error}</small>
      )}
    </div>
  );
}

/**
 * Email Input with built-in validation
 */
export function EmailInput({ value, onChange, required = false, className = '', ...props }) {
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const formatted = formatEmail(e.target.value);
    
    if (formatted.length > 0) {
      const validation = validateEmail(formatted);
      setError(validation.error);
    } else {
      setError('');
    }
    
    onChange({ target: { value: formatted, name: e.target.name } });
  };

  return (
    <div>
      <Input
        type="email"
        required={required}
        placeholder="you@company.com"
        pattern={VALIDATION_PATTERNS.email}
        title={VALIDATION_TITLES.email}
        value={value}
        onChange={handleChange}
        className={className}
        {...props}
      />
      {error && (
        <small className="text-xs text-red-500">{error}</small>
      )}
    </div>
  );
}

/**
 * Password Input with built-in validation and visibility toggle
 */
export function PasswordInput({ value, onChange, required = false, className = '', placeholder = 'Enter strong password', ...props }) {
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    const newValue = e.target.value;
    
    if (newValue.length > 0) {
      const validation = validatePassword(newValue);
      setError(validation.error);
    } else {
      setError('');
    }
    
    onChange(e);
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div>
      <div className="relative">
        <Input
          type={showPassword ? 'text' : 'password'}
          required={required}
          placeholder={placeholder}
          minLength={8}
          pattern={VALIDATION_PATTERNS.password}
          title={VALIDATION_TITLES.password}
          value={value}
          onChange={handleChange}
          className={className}
          {...props}
        />
        <button
          type="button"
          onClick={togglePasswordVisibility}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
          aria-label={showPassword ? 'Hide password' : 'Show password'}
        >
          {showPassword ? (
            <EyeOff className="h-5 w-5" />
          ) : (
            <Eye className="h-5 w-5" />
          )}
        </button>
      </div>
      {error && (
        <small className="text-xs text-red-500">{error}</small>
      )}
    </div>
  );
}

/**
 * TRN Input with built-in validation
 */
export function TRNInput({ value, onChange, required = false, className = '', ...props }) {
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const formatted = e.target.value.replace(/[^0-9]/g, '');
    
    if (formatted.length > 0) {
      const validation = validateTRN(formatted);
      setError(validation.error);
    } else {
      setError('');
    }
    
    onChange({ target: { value: formatted, name: e.target.name } });
  };

  return (
    <div>
      <Input
        type="text"
        required={required}
        placeholder="123456789012345"
        pattern={VALIDATION_PATTERNS.trn}
        maxLength={15}
        title={VALIDATION_TITLES.trn}
        value={value}
        onChange={handleChange}
        className={className}
        {...props}
      />
      {error && (
        <small className="text-xs text-red-500">{error}</small>
      )}
    </div>
  );
}
