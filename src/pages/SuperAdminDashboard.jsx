import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { adminAPI } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Calendar, Filter, X, LogOut, RefreshCcw, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCompanies();
  }, [filters]);

  const fetchCompanies = async () => {
    try {
      const response = await adminAPI.getPendingCompanies();
      setCompanies(response.data);
    } catch (error) {
      console.error('Failed to fetch companies', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (companyId) => {
    try {
      await adminAPI.approveCompany(companyId);
      alert('Company approved successfully!');
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
            <span className="text-2xl">⚡</span>
            <span>Beam Admin</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm">
              <Badge variant="info">{user?.role}</Badge>
              <span className="ml-2 text-gray-600">{user?.user_id}</span>
            </div>
            <Button variant="outline" size="sm" onClick={logout} className="gap-2">
              <LogOut size={16} />
              Logout
            </Button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Super Admin Dashboard</h1>
          <Button variant="outline" size="sm" onClick={fetchCompanies} className="gap-2">
            <RefreshCcw size={16} />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-gray-600">Total Companies</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{companies.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-gray-600">Pending Approval</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-600">{companies.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-gray-600">Active</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">0</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-gray-600">Rejected</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">0</div>
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
                        <div className="mt-2">
                          <Badge variant="warning">{company.status}</Badge>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          onClick={() => handleApprove(company.id)}
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
      </main>
    </div>
  );
}
