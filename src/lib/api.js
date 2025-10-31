import axios from 'axios';

// Base API URL - use environment variable or default to localhost:8000
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Create a base axios instance with default configuration
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token to all requests
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle common errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle 401 errors (unauthorized)
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Redirect to login if not already there
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Authentication API
export const authAPI = {
  login: (email, password) => {
    return apiClient.post('/auth/login', { email, password });
  },

  logout: () => {
    return apiClient.post('/auth/logout');
  },

  register: (data) => {
    return apiClient.post('/register', data);
  },

  forgotPassword: (email) => {
    return apiClient.post('/auth/forgot-password', { email });
  },

  resetPassword: (token, newPassword) => {
    return apiClient.post('/auth/reset-password', { token, new_password: newPassword });
  },
};

// MFA (Multi-Factor Authentication) API
export const mfaAPI = {
  verifyMFA: (tempToken, code, method) => {
    return apiClient.post('/auth/mfa/verify', {
      temp_token: tempToken,
      code,
      method,
    });
  },

  enrollMFA: (method, phoneNumber = null) => {
    return apiClient.post('/auth/mfa/enroll', {
      method,
      phone_number: phoneNumber,
    });
  },

  confirmEnrollment: (secret, code, method) => {
    return apiClient.post('/auth/mfa/confirm-enrollment', {
      secret,
      code,
      method,
    });
  },

  disableMFA: () => {
    return apiClient.post('/auth/mfa/disable');
  },

  getStatus: () => {
    return apiClient.get('/auth/mfa/status');
  },
};

// Accounts Payable (AP) API
export const apAPI = {
  getInwardInvoices: (params = {}) => {
    return apiClient.get('/inward-invoices', { params });
  },

  getInwardInvoiceById: (id) => {
    return apiClient.get(`/inward-invoices/${id}`);
  },

  approveInvoice: (id, data) => {
    return apiClient.post(`/inward-invoices/${id}/approve`, data);
  },

  rejectInvoice: (id, data) => {
    return apiClient.post(`/inward-invoices/${id}/reject`, data);
  },

  getPurchaseOrders: (params = {}) => {
    return apiClient.get('/purchase-orders', { params });
  },

  getPurchaseOrderById: (id) => {
    return apiClient.get(`/purchase-orders/${id}`);
  },

  acknowledgePurchaseOrder: (id, data) => {
    return apiClient.post(`/purchase-orders/${id}/acknowledge`, data);
  },

  getVendors: (params = {}) => {
    return apiClient.get('/vendors', { params });
  },
};

// Admin API
export const adminAPI = {
  getCompanies: (params = {}) => {
    return apiClient.get('/admin/companies', { params });
  },

  getCompanyById: (id) => {
    return apiClient.get(`/admin/companies/${id}`);
  },

  approveCompany: (id, data) => {
    return apiClient.post(`/admin/companies/${id}/approve`, data);
  },

  rejectCompany: (id, data) => {
    return apiClient.post(`/admin/companies/${id}/reject`, data);
  },

  updateCompany: (id, data) => {
    return apiClient.put(`/admin/companies/${id}`, data);
  },

  deleteCompany: (id) => {
    return apiClient.delete(`/admin/companies/${id}`);
  },

  getTiers: () => {
    return apiClient.get('/admin/tiers');
  },

  createTier: (data) => {
    return apiClient.post('/admin/tiers', data);
  },

  updateTier: (id, data) => {
    return apiClient.put(`/admin/tiers/${id}`, data);
  },

  deleteTier: (id) => {
    return apiClient.delete(`/admin/tiers/${id}`);
  },

  getStats: (params = {}) => {
    return apiClient.get('/admin/stats', { params });
  },

  getPendingApprovals: (params = {}) => {
    return apiClient.get('/admin/approvals', { params });
  },

  getContent: (params = {}) => {
    return apiClient.get('/admin/content', { params });
  },

  updateContent: (id, data) => {
    return apiClient.put(`/admin/content/${id}`, data);
  },

  createContent: (data) => {
    return apiClient.post('/admin/content', data);
  },

  deleteContent: (id) => {
    return apiClient.delete(`/admin/content/${id}`);
  },
};

// Companies API
export const companiesAPI = {
  getCompanies: (params = {}) => {
    return apiClient.get('/companies', { params });
  },

  getCompanyById: (id) => {
    return apiClient.get(`/companies/${id}`);
  },

  updateCompany: (id, data) => {
    return apiClient.put(`/companies/${id}`, data);
  },

  getBranding: (id) => {
    return apiClient.get(`/companies/${id}/branding`);
  },

  uploadLogo: (id, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post(`/companies/${id}/branding/logo`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  uploadStamp: (id, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post(`/companies/${id}/branding/stamp`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  deleteLogo: (id) => {
    return apiClient.delete(`/companies/${id}/branding/logo`);
  },

  deleteStamp: (id) => {
    return apiClient.delete(`/companies/${id}/branding/stamp`);
  },
};

// Bulk Import API
export const bulkImportAPI = {
  uploadInvoices: (file, options = {}) => {
    const formData = new FormData();
    formData.append('file', file);
    if (options.validate_only) {
      formData.append('validate_only', 'true');
    }
    return apiClient.post('/bulk-import/invoices', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  getImportHistory: (params = {}) => {
    return apiClient.get('/bulk-import/history', { params });
  },

  getImportStatus: (id) => {
    return apiClient.get(`/bulk-import/status/${id}`);
  },
};

// Export the base client for direct use
export { apiClient };

// Default export for convenience
export default {
  apiClient,
  authAPI,
  mfaAPI,
  apAPI,
  adminAPI,
  companiesAPI,
  bulkImportAPI,
};
