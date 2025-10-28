import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Homepage from './pages/Homepage';
import Login from './pages/Login';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import SuperAdminApprovals from './pages/SuperAdminApprovals';
import BusinessDashboard from './pages/BusinessDashboard';
import InvoiceDashboard from './pages/InvoiceDashboard';
import CreateInvoice from './pages/CreateInvoice';
import InvoiceDetail from './pages/InvoiceDetail';
import CompanyBranding from './pages/CompanyBranding';
import TeamManagement from './pages/TeamManagement';
import MFASettings from './pages/MFASettings';
import APInbox from './pages/APInbox';
import POList from './pages/POList';

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function DashboardRouter() {
  const { isSuperAdmin, isCompanyAdmin } = useAuth();

  if (isSuperAdmin) {
    return <SuperAdminDashboard />;
  }

  if (isCompanyAdmin) {
    return <BusinessDashboard />;
  }

  return <div className="min-h-screen flex items-center justify-center">
    <div className="text-center">
      <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
      <p className="text-gray-600">You don't have permission to access this dashboard.</p>
    </div>
  </div>;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Homepage />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardRouter />
              </ProtectedRoute>
            }
          />
          <Route
            path="/invoices"
            element={
              <ProtectedRoute>
                <InvoiceDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/invoices/create"
            element={
              <ProtectedRoute>
                <CreateInvoice />
              </ProtectedRoute>
            }
          />
          <Route
            path="/invoices/:id"
            element={
              <ProtectedRoute>
                <InvoiceDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ap/inbox"
            element={
              <ProtectedRoute>
                <APInbox />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ap/purchase-orders"
            element={
              <ProtectedRoute>
                <POList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings/branding"
            element={
              <ProtectedRoute>
                <CompanyBranding />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings/team"
            element={
              <ProtectedRoute>
                <TeamManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings/security"
            element={
              <ProtectedRoute>
                <MFASettings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <SuperAdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/approvals"
            element={
              <ProtectedRoute>
                <SuperAdminApprovals />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
