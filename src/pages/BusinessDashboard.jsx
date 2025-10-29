import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { companiesAPI } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { LogOut, FileText, CreditCard, TrendingUp, Calendar, Palette, Users, Shield, Inbox, ShoppingCart, Upload, FileCheck, Network } from 'lucide-react';
import { format } from 'date-fns';

export default function BusinessDashboard() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const [company, setCompany] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    if (!user?.company_id) return;

    try {
      const [companyRes, subRes, invoicesRes] = await Promise.all([
        companiesAPI.getCompany(user.company_id),
        companiesAPI.getSubscription(user.company_id),
        companiesAPI.getInvoices(user.company_id),
      ]);

      setCompany(companyRes.data);
      setSubscription(subRes.data);
      setInvoices(invoicesRes.data || []);
    } catch (error) {
      console.error('Failed to fetch dashboard data', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2 text-xl font-bold">
            <span className="text-2xl">🔗</span>
            <span>InvoLinks</span>
          </div>
          <div className="flex items-center gap-4">
            <Button 
              onClick={() => navigate('/invoices')}
              className="gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
            >
              <FileText size={16} />
              Invoices
            </Button>
            <Button 
              onClick={() => navigate('/ap/inbox')}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Inbox size={16} />
              AP Inbox
            </Button>
            <Button 
              onClick={() => navigate('/ap/purchase-orders')}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <ShoppingCart size={16} />
              Purchase Orders
            </Button>
            <Button 
              onClick={() => navigate('/bulk-import')}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Upload size={16} />
              Bulk Import
            </Button>
            <Button 
              onClick={() => navigate('/audit-files')}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <FileCheck size={16} />
              FTA Audit
            </Button>
            <Button 
              onClick={() => navigate('/settings/peppol')}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Network size={16} />
              PEPPOL
            </Button>
            <Button 
              onClick={() => navigate('/settings/branding')}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Palette size={16} />
              Branding
            </Button>
            <Button 
              onClick={() => navigate('/billing')}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <CreditCard size={16} />
              Billing
            </Button>
            <Button 
              onClick={() => navigate('/settings/team')}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Users size={16} />
              Team
            </Button>
            <Button 
              onClick={() => navigate('/settings/security')}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Shield size={16} />
              Security
            </Button>
            <div className="text-sm">
              <Badge variant="info">{user?.role}</Badge>
              <span className="ml-2 text-gray-600">{user?.company_name || company?.legal_name}</span>
            </div>
            <Button variant="outline" size="sm" onClick={logout} className="gap-2">
              <LogOut size={16} />
              Logout
            </Button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Business Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Welcome back, {company?.legal_name || 'Business User'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total Invoices
              </CardTitle>
              <FileText className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{invoices.length}</div>
              <p className="text-xs text-gray-500 mt-1">All time</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                This Month
              </CardTitle>
              <Calendar className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {invoices.filter(inv => {
                  const invDate = new Date(inv.created_at);
                  const now = new Date();
                  return invDate.getMonth() === now.getMonth();
                }).length}
              </div>
              <p className="text-xs text-gray-500 mt-1">Current month</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Revenue (AED)
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {invoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0).toLocaleString()}
              </div>
              <p className="text-xs text-green-600 mt-1">+12% from last month</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Subscription
              </CardTitle>
              <CreditCard className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {subscription?.plan_name || 'Free'}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {subscription?.status || 'Active'}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Company Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="text-sm text-gray-600">Legal Name</div>
                <div className="font-medium">{company?.legal_name || 'N/A'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Status</div>
                <Badge variant={company?.status === 'ACTIVE' ? 'success' : 'warning'}>
                  {company?.status || 'Unknown'}
                </Badge>
              </div>
              <div>
                <div className="text-sm text-gray-600">Email</div>
                <div className="font-medium">{company?.email || 'N/A'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Phone</div>
                <div className="font-medium">{company?.phone || 'N/A'}</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              {invoices.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No invoices yet
                </div>
              ) : (
                <div className="space-y-3">
                  {invoices.slice(0, 5).map((invoice) => (
                    <div key={invoice.id} className="border rounded-lg p-3 hover:bg-gray-50">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium">{invoice.invoice_number}</div>
                          <div className="text-sm text-gray-600">
                            {invoice.created_at && format(new Date(invoice.created_at), 'MMM d, yyyy')}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">
                            AED {(invoice.total_amount || 0).toFixed(2)}
                          </div>
                          <Badge variant="success" className="mt-1">Paid</Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
