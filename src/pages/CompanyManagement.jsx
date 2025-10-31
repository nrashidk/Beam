import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { LogOut, RefreshCcw, ArrowLeft, User, Settings, Search } from 'lucide-react';
import { format } from 'date-fns';
import AdminLayout from '../components/AdminLayout';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';

const STATUS_CONFIG = {
  approved: {
    title: 'Approved Registrations',
    description: 'Companies that have been approved for registration',
    badgeClass: 'bg-green-100 text-green-800',
    apiStatus: 'ACTIVE'
  },
  rejected: {
    title: 'Rejected Registrations',
    description: 'Companies that have been rejected during review',
    badgeClass: 'bg-red-100 text-red-800',
    apiStatus: 'REJECTED'
  },
  active: {
    title: 'Active Companies',
    description: 'Currently active companies on the platform',
    badgeClass: 'bg-emerald-100 text-emerald-800',
    apiStatus: 'ACTIVE'
  },
  inactive: {
    title: 'Inactive Companies',
    description: 'Suspended or inactive companies',
    badgeClass: 'bg-gray-100 text-gray-800',
    apiStatus: 'INACTIVE'
  }
};

export default function CompanyManagement() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const { status } = useParams();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const config = STATUS_CONFIG[status] || STATUS_CONFIG.active;

  useEffect(() => {
    fetchCompanies();
  }, [status]);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/admin/companies?status=${config.apiStatus}`);
      setCompanies(response.data);
    } catch (error) {
      console.error('Failed to fetch companies', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCompanies = companies.filter(c => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      c.legal_name?.toLowerCase().includes(query) ||
      c.email?.toLowerCase().includes(query) ||
      c.trn?.toLowerCase().includes(query)
    );
  });

  const navigationButtons = (
    <>
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
    </>
  );

  return (
    <AdminLayout navigation={navigationButtons}>
      <div className="bg-gradient-to-br from-indigo-50 via-white to-purple-50 max-w-7xl mx-auto px-6 py-8 space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => navigate('/admin')} className="gap-2">
              <ArrowLeft size={16} />
              Back to Dashboard
            </Button>
            <div>
              <h1 className="text-3xl font-bold">{config.title}</h1>
              <p className="text-sm text-gray-600 mt-1">{config.description}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchCompanies} className="gap-2">
            <RefreshCcw size={16} />
            Refresh
          </Button>
        </div>

        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                {filteredCompanies.length} {filteredCompanies.length === 1 ? 'Company' : 'Companies'}
              </CardTitle>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search companies..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-64"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-gray-500">Loading companies...</div>
            ) : filteredCompanies.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No companies found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr className="text-left">
                      <th className="px-4 py-3 font-medium">Company</th>
                      <th className="px-4 py-3 font-medium">Email</th>
                      <th className="px-4 py-3 font-medium">TRN</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Registered</th>
                      <th className="px-4 py-3 font-medium">Plan</th>
                      <th className="px-4 py-3 font-medium">Invoices</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCompanies.map((company) => (
                      <tr key={company.id} className="border-t hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{company.legal_name || '—'}</td>
                        <td className="px-4 py-3">{company.email}</td>
                        <td className="px-4 py-3">{company.trn || '—'}</td>
                        <td className="px-4 py-3">
                          <Badge className={config.badgeClass}>
                            {company.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          {company.created_at ? format(new Date(company.created_at), 'MMM d, yyyy') : '—'}
                        </td>
                        <td className="px-4 py-3">{company.plan || 'Free'}</td>
                        <td className="px-4 py-3">{company.invoices_generated || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
