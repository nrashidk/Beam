import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const getApiBaseUrl = () => API_URL;

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authAPI = {
  login: (email, password) => apiClient.post('/auth/login', { email, password }),
  logout: () => apiClient.post('/auth/logout'),
};

export const mfaAPI = {
  enrollTOTP: () => apiClient.post('/auth/mfa/enroll/totp'),
  verifyEnrollment: (code) => apiClient.post('/auth/mfa/enroll/verify', { code }),
  verifyMFA: (tempToken, code, method) => 
    apiClient.post('/auth/mfa/verify', { temp_token: tempToken, code, method }),
  sendEmailOTP: (email) => apiClient.post('/auth/mfa/send-otp', { email }),
  getStatus: () => apiClient.get('/auth/mfa/status'),
  disable: (code) => apiClient.post('/auth/mfa/disable', { code }),
  regenerateBackupCodes: (code) => apiClient.post('/auth/mfa/regenerate-codes', { code }),
};

export const companiesAPI = {
  getCompanyById: (companyId) => apiClient.get(`/companies/${companyId}`),
  getSubscription: (companyId) => apiClient.get(`/companies/${companyId}/subscription`),
  getInvoices: (companyId) => apiClient.get(`/companies/${companyId}/invoices`),
};

export const apAPI = {
  getInwardInvoices: (params) => apiClient.get('/inward-invoices', { params }),
  approveInvoice: (invoiceId, data) => apiClient.post(`/inward-invoices/${invoiceId}/approve`, data),
  rejectInvoice: (invoiceId, data) => apiClient.post(`/inward-invoices/${invoiceId}/reject`, data),
  getPurchaseOrder: (poId) => apiClient.get(`/purchase-orders/${poId}`),
  sendPurchaseOrder: (poId) => apiClient.post(`/purchase-orders/${poId}/send`),
  cancelPurchaseOrder: (poId) => apiClient.post(`/purchase-orders/${poId}/cancel`),
  createPurchaseOrder: (formData) => apiClient.post('/purchase-orders', formData),
};

export const bulkImportAPI = {
  downloadInvoiceTemplate: (format) => 
    apiClient.get(`/api/bulk/template/invoices?format=${format}`, { responseType: 'blob' }),
  downloadVendorTemplate: (format) => 
    apiClient.get(`/api/bulk/template/vendors?format=${format}`, { responseType: 'blob' }),
  uploadInvoices: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post('/api/bulk/import/invoices', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  uploadVendors: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post('/api/bulk/import/vendors', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
};

export const adminAPI = {
  getAllCompanies: (status) => apiClient.get('/admin/companies', { params: { status } }),
  getCompany: (companyId) => apiClient.get(`/admin/companies/${companyId}`),
  approveCompany: (companyId, config) => apiClient.post(`/admin/companies/${companyId}/approve`, config),
  rejectCompany: (companyId) => apiClient.post(`/admin/companies/${companyId}/reject`),
  getFeaturedBusinesses: () => apiClient.get('/admin/featured-businesses'),
  addFeaturedBusiness: (payload) => apiClient.post('/admin/featured-businesses', payload),
  updateFeaturedBusiness: (featuredId, payload) => 
    apiClient.put(`/admin/featured-businesses/${featuredId}`, payload),
  removeFeaturedBusiness: (featuredId) => apiClient.delete(`/admin/featured-businesses/${featuredId}`),
};

export const auditFileAPI = {
  getAuditFiles: () => apiClient.get('/analytics/audit-files'),
  generateAuditFile: (params) => apiClient.post('/analytics/audit-files/generate', params),
  downloadAuditFile: (auditFileId) => 
    apiClient.get(`/analytics/audit-files/${auditFileId}/download`, { responseType: 'blob' }),
};

export const billingAPI = {
  getPaymentMethods: () => apiClient.get('/billing/payment-methods'),
  addPaymentMethod: (payload) => apiClient.post('/billing/payment-methods', payload),
  deletePaymentMethod: (paymentMethodId) => 
    apiClient.delete(`/billing/payment-methods/${paymentMethodId}`),
  subscribe: (payload) => apiClient.post('/billing/subscribe', payload),
  getSubscription: () => apiClient.get('/billing/subscription'),
  getTrialStatus: () => apiClient.get('/billing/trial-status'),
};

export const companyAPI = {
  getCompanyById: (companyId) => apiClient.get(`/companies/${companyId}`),
  getSubscription: () => apiClient.get('/company/subscription'),
  getInvoices: (companyId) => apiClient.get(`/companies/${companyId}/invoices`),
  updateCompanyProfile: (payload) => apiClient.put('/company/profile', payload),
  uploadLogo: (formData) => 
    apiClient.post('/company/upload-logo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
  uploadStamp: (formData) => 
    apiClient.post('/company/upload-stamp', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
  deleteLogo: () => apiClient.delete('/company/logo'),
  deleteStamp: () => apiClient.delete('/company/stamp'),
};

export const settingsAPI = {
  updateVATSettings: (payload) => apiClient.put('/settings/vat', payload),
  uploadVatCertificate: (formData) => 
    apiClient.post('/settings/vat/certificate', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
  downloadVatCertificate: () => 
    apiClient.get('/settings/vat/certificate', { responseType: 'blob' }),
  updatePeppolSettings: (payload) => apiClient.put('/settings/peppol', payload),
  testPeppolConnection: () => apiClient.post('/settings/peppol/test'),
};

export const contentAPI = {
  getContent: () => apiClient.get('/content'),
  updateContent: (key, payload) => apiClient.put(`/content/${key}`, payload),
};

export const platformAPI = {
  getPlatformStats: () => apiClient.get('/admin/platform-stats'),
};

export const usersAPI = {
  inviteUser: (payload) => apiClient.post('/company/users/invite', payload),
  removeUser: (userId) => apiClient.delete(`/company/users/${userId}`),
};

export const paymentAPI = {
  verifyPayment: (invoiceId, payload) => 
    apiClient.post(`/invoices/${invoiceId}/verify-payment`, payload),
};

export const publicAPI = {
  getFeaturedBusinesses: () => apiClient.get('/content/featured-businesses'),
  getPublicContent: () => apiClient.get('/content/public'),
  getPublicStats: () => apiClient.get('/content/stats'),
};

export const analyticsAPI = {
  getRevenueAnalytics: (params) => apiClient.get('/analytics/revenue', { params }),
  getCustomerAnalytics: () => apiClient.get('/analytics/customers'),
  getProfitabilityMetrics: () => apiClient.get('/analytics/profitability'),
  getCashFlowAnalytics: () => apiClient.get('/analytics/cash-flow'),
};

export { apiClient };

export default apiClient;
