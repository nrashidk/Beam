import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ContentProvider } from './contexts/ContentContext';
import Homepage from './pages/Homepage';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import SuperAdminApprovals from './pages/SuperAdminApprovals';
import TierManagement from './pages/TierManagement';
import FeaturedBusinesses from './pages/FeaturedBusinesses';
import BusinessDashboard from './pages/BusinessDashboard';
import InvoiceDashboard from './pages/InvoiceDashboard';
import CreateInvoice from './pages/CreateInvoice';
import InvoiceDetail from './pages/InvoiceDetail';
import CompanyBranding from './pages/CompanyBranding';
import TeamManagement from './pages/TeamManagement';
import MFASettings from './pages/MFASettings';
import APInbox from './pages/APInbox';
import POList from './pages/POList';
import BulkImport from './pages/BulkImport';
import FTAAuditFiles from './pages/FTAAuditFiles';
import PEPPOLSettings from './pages/PEPPOLSettings';
import VATSettings from './pages/VATSettings';
import ContentManager from './pages/ContentManager';
import Pricing from './pages/Pricing';
import BillingSettings from './pages/BillingSettings';
import FinanceDashboard from './pages/FinanceDashboard';
import SuppliersManagement from './pages/SuppliersManagement';
import PublicInvoiceView from './pages/PublicInvoiceView';
import PaymentVerification from './pages/PaymentVerification';
import DailyReconciliation from './pages/DailyReconciliation';
import AdvancedAnalytics from './pages/AdvancedAnalytics';
import CompanyManagement from './pages/CompanyManagement';
import CompanySettings from './pages/CompanySettings';

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
        <ContentProvider>
          <Routes>
          <Route path="/" element={<Homepage />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/invoices/view/:shareToken" element={<PublicInvoiceView />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
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
            path="/ap/suppliers"
            element={
              <ProtectedRoute>
                <SuppliersManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/bulk-import"
            element={
              <ProtectedRoute>
                <BulkImport />
              </ProtectedRoute>
            }
          />
          <Route
            path="/audit-files"
            element={
              <ProtectedRoute>
                <FTAAuditFiles />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings/peppol"
            element={
              <ProtectedRoute>
                <PEPPOLSettings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings/vat"
            element={
              <ProtectedRoute>
                <VATSettings />
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
            path="/settings/company"
            element={
              <ProtectedRoute>
                <CompanySettings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/billing"
            element={
              <ProtectedRoute>
                <BillingSettings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/finance"
            element={
              <ProtectedRoute>
                <FinanceDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <ProtectedRoute>
                <AdvancedAnalytics />
              </ProtectedRoute>
            }
          />
          <Route
            path="/payment-verification"
            element={
              <ProtectedRoute>
                <PaymentVerification />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reconciliation"
            element={
              <ProtectedRoute>
                <DailyReconciliation />
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
          <Route
            path="/admin/companies/:status"
            element={
              <ProtectedRoute>
                <CompanyManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/content"
            element={
              <ProtectedRoute>
                <ContentManager />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/tiers"
            element={
              <ProtectedRoute>
                <TierManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/featured"
            element={
              <ProtectedRoute>
                <FeaturedBusinesses />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ContentProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
