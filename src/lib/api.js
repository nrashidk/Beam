import axios from "axios";

// In production, use same origin (empty string for relative URLs)
// In development, use VITE_API_URL or fallback to localhost:8000
const API_URL = import.meta.env.PROD
  ? ""
  : import.meta.env.VITE_API_URL || "http://localhost:8000";
console.log("API URL:", API_URL || "(same origin)");

export const getApiBaseUrl = () => API_URL;

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Add response interceptor to handle 401 errors globally

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Don't try to refresh if this is the refresh endpoint itself
    if (originalRequest.url === "/auth/refresh") {
      localStorage.clear();
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
      return Promise.reject(error);
    }

    if (
      error.response &&
      error.response.status === 401 &&
      !originalRequest._retry
    ) {
      if (isRefreshing) {
        return new Promise(function (resolve, reject) {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers["Authorization"] = "Bearer " + token;
            return apiClient(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }
      originalRequest._retry = true;
      isRefreshing = true;
      try {
        const data = await refreshAccessToken();
        if (data && data.access_token) {
          processQueue(null, data.access_token);
          originalRequest.headers["Authorization"] =
            "Bearer " + data.access_token;
          isRefreshing = false;
          return apiClient(originalRequest);
        } else {
          processQueue("Refresh failed", null);
          isRefreshing = false;
          localStorage.clear();
          if (window.location.pathname !== "/login") {
            window.location.href = "/login";
          }
          return Promise.reject(error);
        }
      } catch (err) {
        processQueue(err, null);
        isRefreshing = false;
        localStorage.clear();
        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  },
);

// Refresh access token using refresh token (from localStorage)
export const refreshAccessToken = async () => {
  try {
    const refreshToken = localStorage.getItem("refresh_token");
    if (!refreshToken) return null;
    const response = await apiClient.post("/auth/refresh", {
      refresh_token: refreshToken,
    });
    // Optionally update access_token if new one is returned
    if (response.data && response.data.access_token) {
      localStorage.setItem("token", response.data.access_token);
    }
    return response.data;
  } catch (error) {
    return null;
  }
};

export const authAPI = {
  login: async (email, password) => {
    const response = await apiClient.post("/auth/login", { email, password });
    // If refresh_token is present in response, store it
    if (response.data && response.data.refresh_token) {
      localStorage.setItem("refresh_token", response.data.refresh_token);
    }
    if (response.data && response.data.access_token) {
      localStorage.setItem("token", response.data.access_token);
    }
    return response;
  },
  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
    return apiClient.post("/auth/logout");
  },
  refresh: refreshAccessToken,
  resetPassword: (token, new_password) =>
    apiClient.post("/auth/reset-password", { token, new_password }),
};

export const mfaAPI = {
  enrollTOTP: () => apiClient.post("/auth/mfa/enroll/totp"),
  verifyEnrollment: (code) =>
    apiClient.post("/auth/mfa/enroll/verify", { code }),
  verifyMFA: (tempToken, code, method) =>
    apiClient.post("/auth/mfa/verify", { temp_token: tempToken, code, method }),
  sendEmailOTP: (email) => apiClient.post("/auth/mfa/send-otp", { email }),
  getStatus: () => apiClient.get("/auth/mfa/status"),
  disable: (code) => apiClient.post("/auth/mfa/disable", { code }),
  regenerateBackupCodes: (code) =>
    apiClient.post("/auth/mfa/regenerate-codes", { code }),
};

export const companiesAPI = {
  getCompanyById: (companyId) => apiClient.get(`/companies/${companyId}`),
  getSubscription: (companyId) =>
    apiClient.get(`/companies/${companyId}/subscription`),
  getInvoices: (companyId) => apiClient.get(`/companies/${companyId}/invoices`),
};

export const apAPI = {
  getInwardInvoices: (params) => apiClient.get("/inward-invoices", { params }),
  approveInvoice: (invoiceId, data) =>
    apiClient.post(`/inward-invoices/${invoiceId}/approve`, data),
  rejectInvoice: (invoiceId, data) =>
    apiClient.post(`/inward-invoices/${invoiceId}/reject`, data),
  getPurchaseOrder: (poId) => apiClient.get(`/purchase-orders/${poId}`),
  sendPurchaseOrder: (poId) => apiClient.post(`/purchase-orders/${poId}/send`),
  cancelPurchaseOrder: (poId) =>
    apiClient.post(`/purchase-orders/${poId}/cancel`),
  createPurchaseOrder: (formData) =>
    apiClient.post("/purchase-orders", formData),
  getPurchaseOrders: (params) => apiClient.get("/purchase-orders", { params }),
  deletePurchaseOrder: (poId) => apiClient.delete(`/purchase-orders/${poId}`),
};

export const bulkImportAPI = {
  downloadInvoiceTemplate: (format) =>
    apiClient.get(`/api/bulk/template/invoices?format=${format}`, {
      responseType: "blob",
    }),
  downloadVendorTemplate: (format) =>
    apiClient.get(`/api/bulk/template/vendors?format=${format}`, {
      responseType: "blob",
    }),
  uploadInvoices: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiClient.post("/api/bulk/import/invoices", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  uploadVendors: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiClient.post("/api/bulk/import/vendors", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};

export const adminAPI = {
  getAllCompanies: (status) =>
    apiClient.get("/admin/companies", { params: { status } }),
  getCompany: (companyId) => apiClient.get(`/admin/companies/${companyId}`),
  approveCompany: (companyId, config) =>
    apiClient.post(`/admin/companies/${companyId}/approve`, config),
  rejectCompany: (companyId) =>
    apiClient.post(`/admin/companies/${companyId}/reject`),
  getStats: () => apiClient.get("/admin/stats"),
  getFeaturedBusinesses: () => apiClient.get("/admin/featured-businesses"),
  addFeaturedBusiness: (payload) =>
    apiClient.post("/admin/featured-businesses", payload),
  updateFeaturedBusiness: (featuredId, payload) =>
    apiClient.put(`/admin/featured-businesses/${featuredId}`, payload),
  removeFeaturedBusiness: (featuredId) =>
    apiClient.delete(`/admin/featured-businesses/${featuredId}`),
};

export const auditFileAPI = {
  getAuditFiles: () => apiClient.get("/analytics/audit-files"),
  generateAuditFile: (params) =>
    apiClient.post("/analytics/audit-files/generate", params),
  downloadAuditFile: (auditFileId) =>
    apiClient.get(`/analytics/audit-files/${auditFileId}/download`, {
      responseType: "blob",
    }),
};

export const billingAPI = {
  getPaymentMethods: () => apiClient.get("/billing/payment-methods"),
  addPaymentMethod: (payload) =>
    apiClient.post("/billing/payment-methods", payload),
  deletePaymentMethod: (paymentMethodId) =>
    apiClient.delete(`/billing/payment-methods/${paymentMethodId}`),
  subscribe: (payload) => apiClient.post("/billing/subscribe", payload),
  getSubscription: () => apiClient.get("/billing/subscription"),
  getTrialStatus: () => apiClient.get("/billing/trial-status"),
};

export const companyAPI = {
  getCompanyById: (companyId) => apiClient.get(`/companies/${companyId}`),
  getSubscription: () => apiClient.get("/company/subscription"),
  getInvoices: (companyId) => apiClient.get(`/companies/${companyId}/invoices`),
  updateCompanyProfile: (payload) => apiClient.put("/company/profile", payload),
  uploadLogo: (formData) =>
    apiClient.post("/company/upload-logo", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  uploadStamp: (formData) =>
    apiClient.post("/company/upload-stamp", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  deleteLogo: () => apiClient.delete("/company/logo"),
  deleteStamp: () => apiClient.delete("/company/stamp"),
};

export const settingsAPI = {
  getVATSettings: () => apiClient.get("/settings/vat"),
  updateVATSettings: (payload) => apiClient.put("/settings/vat", payload),
  uploadVatCertificate: (formData) =>
    apiClient.post("/settings/vat/certificate", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  downloadVatCertificate: () =>
    apiClient.get("/settings/vat/certificate", { responseType: "blob" }),
  getPeppolSettings: () => apiClient.get("/settings/peppol"),
  updatePeppolSettings: (payload) => apiClient.put("/settings/peppol", payload),
  testPeppolConnection: () => apiClient.post("/settings/peppol/test"),
};

export const contentAPI = {
  getContent: () => apiClient.get("/content"),
  updateContent: (key, payload) => apiClient.put(`/content/${key}`, payload),
};

export const platformAPI = {
  getPlatformStats: () => apiClient.get("/admin/platform-stats"),
};

export const usersAPI = {
  getTeamMembers: () => apiClient.get("/users/teams"),
  inviteUser: (payload) => apiClient.post("/company/users/invite", payload),
  removeUser: (userId) => apiClient.delete(`/company/users/${userId}`),
};

export const paymentAPI = {
  verifyPayment: (invoiceId, payload) =>
    apiClient.post(`/invoices/${invoiceId}/verify-payment`, payload),
};

export const publicAPI = {
  getFeaturedBusinesses: () => apiClient.get("/content/featured-businesses"),
  getPublicContent: () => apiClient.get("/content/public"),
  getPublicStats: () => apiClient.get("/content/stats"),
  getPublicInvoice: (shareToken) =>
    apiClient.get(`/invoices/view/${shareToken}`),
};

export const analyticsAPI = {
  getRevenueAnalytics: (params) =>
    apiClient.get("/analytics/revenue", { params }),
  getCustomerAnalytics: () => apiClient.get("/analytics/customers"),
  getProfitabilityMetrics: () => apiClient.get("/analytics/profitability"),
  getCashFlowAnalytics: () => apiClient.get("/analytics/cash-flow"),
};

export { apiClient };

export default apiClient;
