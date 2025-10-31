import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { adminAPI } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Calendar, Filter, X, LogOut, RefreshCcw, CheckCircle, XCircle, ArrowLeft, User, Settings } from 'lucide-react';
import { format } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';

function DateRangePicker({ range, onChange }) {
  function shiftDays(days) {
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - days);
    onChange({ from, to });
  }
  
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" size="sm" onClick={() => shiftDays(7)}>Last 7 days</Button>
      <Button variant="secondary" size="sm" onClick={() => shiftDays(30)}>Last 30 days</Button>
      <Button variant="secondary" size="sm" onClick={() => shiftDays(90)}>Last 90 days</Button>
      <div className="flex items-center text-sm text-gray-600">
        <Calendar size={16} className="mr-1" />
        {format(range.from, 'MMM d')} – {format(range.to, 'MMM d, yyyy')}
      </div>
    </div>
  );
}

export default function SuperAdminDashboard() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const [range, setRange] = useState({ 
    from: new Date(new Date().setDate(new Date().getDate() - 29)), 
    to: new Date() 
  });
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ 
    region: 'all', 
    status: 'all', 
    search: '' 
  });
  const [companies, setCompanies] = useState([]);
  const [stats, setStats] = useState({ total_companies: 0, pending_approval: 0, active: 0, rejected: 0, total_invoices: 0 });
  const [loading, setLoading] = useState(true);
  const [approvalModal, setApprovalModal] = useState(null);
  const [freePlanConfig, setFreePlanConfig] = useState({
    free_plan_type: 'INVOICE_COUNT',
    free_plan_duration_months: 1,
    free_plan_invoice_limit: 100
  });

  useEffect(() => {
    fetchData();
  }, [filters]);

  const fetchData = async () => {
    try {
      const [companiesResponse, statsResponse] = await Promise.all([
        adminAPI.getPendingCompanies(),
        adminAPI.getStats()
      ]);
      setCompanies(companiesResponse.data);
      
      const rawStats = statsResponse.data;
      setStats({
        total_companies: rawStats.total_companies || 0,
        pending_approval: rawStats.registrations?.pending || 0,
        active: rawStats.companies?.active || 0,
        rejected: rawStats.registrations?.rejected || 0,
        total_invoices: rawStats.invoices?.monthToDate || 0
      });
    } catch (error) {
      console.error('Failed to fetch data', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanies = fetchData;

  const handleApprove = async (companyId, config) => {
    try {
      await adminAPI.approveCompany(companyId, config);
      alert('Company approved successfully!');
      setApprovalModal(null);
      setFreePlanConfig({ free_plan_type: 'INVOICE_COUNT', free_plan_duration_months: 1, free_plan_invoice_limit: 100 });
      fetchCompanies();
    } catch (error) {
      alert('Failed to approve company');
    }
  };

  const handleReject = async (companyId) => {
    try {
      await adminAPI.rejectCompany(companyId);
      alert('Company rejected');
      fetchCompanies();
    } catch (error) {
      alert('Failed to reject company');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2 text-xl font-bold">
            <span className="text-2xl">🔗</span>
            <span>InvoLinks Admin</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm">
              <Badge variant="info">{user?.role}</Badge>
              <span className="ml-2 text-gray-600">{user?.email}</span>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <User size={16} />
                  Account
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/settings')}>
                  <Settings size={16} className="mr-2" />
                  Account Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/security')}>
                  <Settings size={16} className="mr-2" />
                  Security Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-red-600">
                  <LogOut size={16} className="mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => navigate('/admin')} className="gap-2">
              <ArrowLeft size={16} />
              Back to Dashboard
            </Button>
            <h1 className="text-3xl font-bold">Company Approvals</h1>
          </div>
          <Button variant="outline" size="sm" onClick={fetchCompanies} className="gap-2">
            <RefreshCcw size={16} />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card 
            className="cursor-pointer hover:opacity-80 transition-opacity" 
            onClick={() => setFilters({ ...filters, status: 'all' })}
          >
            <CardHeader>
              <CardTitle className="text-sm text-gray-600">Total Companies</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.total_companies}</div>
            </CardContent>
          </Card>
          <Card 
            className="cursor-pointer hover:opacity-80 transition-opacity" 
            onClick={() => setFilters({ ...filters, status: 'pending' })}
          >
            <CardHeader>
              <CardTitle className="text-sm text-gray-600">Pending Approval</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-600">{stats.pending_approval}</div>
            </CardContent>
          </Card>
          <Card 
            className="cursor-pointer hover:opacity-80 transition-opacity" 
            onClick={() => setFilters({ ...filters, status: 'active' })}
          >
            <CardHeader>
              <CardTitle className="text-sm text-gray-600">Active</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{stats.active}</div>
            </CardContent>
          </Card>
          <Card 
            className="cursor-pointer hover:opacity-80 transition-opacity" 
            onClick={() => setFilters({ ...filters, status: 'rejected' })}
          >
            <CardHeader>
              <CardTitle className="text-sm text-gray-600">Rejected</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">{stats.rejected}</div>
            </CardContent>
          </Card>
          <Card 
            className="cursor-pointer hover:opacity-80 transition-opacity" 
            onClick={() => setFilters({ ...filters, status: 'all' })}
          >
            <CardHeader>
              <CardTitle className="text-sm text-gray-600">Total Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{stats.total_invoices}</div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap gap-3">
          <DateRangePicker range={range} onChange={setRange} />
          <Button variant="outline" className="gap-2" onClick={() => setShowFilters(true)}>
            <Filter size={16} /> More filters
          </Button>
        </div>

        {showFilters && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md">
              <div className="flex justify-between mb-4">
                <h2 className="font-semibold text-lg">Advanced Filters</h2>
                <Button size="icon" variant="outline" onClick={() => setShowFilters(false)}>
                  <X size={16} />
                </Button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-600 block mb-1">Region</label>
                  <select 
                    className="w-full border rounded-lg px-3 py-2"
                    value={filters.region}
                    onChange={(e) => setFilters({ ...filters, region: e.target.value })}
                  >
                    <option value="all">All</option>
                    <option value="DXB">Dubai (DXB)</option>
                    <option value="AUH">Abu Dhabi (AUH)</option>
                    <option value="SHJ">Sharjah (SHJ)</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-600 block mb-1">Status</label>
                  <select 
                    className="w-full border rounded-lg px-3 py-2"
                    value={filters.status}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  >
                    <option value="all">All</option>
                    <option value="pending">Pending Review</option>
                    <option value="active">Active</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-600 block mb-1">Search</label>
                  <Input 
                    type="text" 
                    placeholder="Company name..."
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex justify-end mt-4">
                <Button onClick={() => setShowFilters(false)}>Apply</Button>
              </div>
            </div>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Pending Company Approvals</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-gray-500">Loading...</div>
            ) : companies.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No pending companies</div>
            ) : (
              <div className="space-y-4">
                {companies.map((company) => (
                  <div key={company.id} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-lg">{company.legal_name || 'Unnamed Company'}</h3>
                        <p className="text-sm text-gray-600">{company.email}</p>
                        <p className="text-sm text-gray-500">
                          {company.business_type} • {company.phone}
                        </p>
                        <div className="mt-2 flex gap-2">
                          <Badge variant="warning">{company.status}</Badge>
                          <Badge variant="secondary">
                            {company.invoices_generated || 0} invoices
                          </Badge>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          onClick={() => setApprovalModal(company)}
                          className="gap-2"
                        >
                          <CheckCircle size={16} />
                          Approve
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => handleReject(company.id)}
                          className="gap-2"
                        >
                          <XCircle size={16} />
                          Reject
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {approvalModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md">
              <div className="flex justify-between mb-4">
                <h2 className="font-semibold text-lg">Approve Company</h2>
                <Button size="icon" variant="outline" onClick={() => setApprovalModal(null)}>
                  <X size={16} />
                </Button>
              </div>
              
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <p className="font-semibold">{approvalModal.legal_name}</p>
                <p className="text-sm text-gray-600">{approvalModal.email}</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium block mb-2">Free Plan Type</label>
                  <select 
                    className="w-full border rounded-lg px-3 py-2"
                    value={freePlanConfig.free_plan_type}
                    onChange={(e) => setFreePlanConfig({ ...freePlanConfig, free_plan_type: e.target.value })}
                  >
                    <option value="INVOICE_COUNT">Invoice Count Limit</option>
                    <option value="DURATION">Duration-based (Months)</option>
                  </select>
                </div>

                {freePlanConfig.free_plan_type === 'INVOICE_COUNT' ? (
                  <div>
                    <label className="text-sm font-medium block mb-2">Invoice Limit</label>
                    <Input 
                      type="number" 
                      min="1"
                      value={freePlanConfig.free_plan_invoice_limit}
                      onChange={(e) => setFreePlanConfig({ ...freePlanConfig, free_plan_invoice_limit: parseInt(e.target.value) || 100 })}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Company can generate up to this many free invoices
                    </p>
                  </div>
                ) : (
                  <div>
                    <label className="text-sm font-medium block mb-2">Duration (Months)</label>
                    <Input 
                      type="number" 
                      min="1"
                      value={freePlanConfig.free_plan_duration_months}
                      onChange={(e) => setFreePlanConfig({ ...freePlanConfig, free_plan_duration_months: parseInt(e.target.value) || 1 })}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Free plan will be active for this many months
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <Button variant="outline" onClick={() => setApprovalModal(null)}>
                  Cancel
                </Button>
                <Button onClick={() => handleApprove(approvalModal.id, freePlanConfig)} className="gap-2">
                  <CheckCircle size={16} />
                  Approve & Configure
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
