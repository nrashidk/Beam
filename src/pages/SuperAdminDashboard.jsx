import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Calendar as CalendarIcon, ArrowUpRight, ArrowDownRight, RefreshCcw, Search, LogOut, User, Settings } from 'lucide-react';
import { format } from 'date-fns';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import AdminLayout from '../components/AdminLayout';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';

function Stat({ label, value, delta, positive, onClick }) {
  const content = (
    <Card className="rounded-2xl shadow-sm h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-col gap-1">
          <div className="text-2xl font-semibold tracking-tight">{value}</div>
          {delta && (
            <div className={`flex items-center gap-1 text-xs ${positive ? 'text-emerald-600' : 'text-rose-600'}`}>
              {positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
              <span>{delta}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
  
  if (onClick) {
    return (
      <button 
        onClick={onClick} 
        className="cursor-pointer hover:opacity-80 transition-opacity w-full h-full"
      >
        {content}
      </button>
    );
  }
  
  return content;
}

function Section({ title, children, action }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function csvEscape(val) {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (/[",\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function buildCompaniesCsv(rows) {
  const header = ['Company', 'Status', 'Plan', 'ARPU', 'InvoicesMTD', 'Region', 'VATCompliant'];
  const lines = rows.map((r) => [
    csvEscape(r.name),
    csvEscape(r.status),
    csvEscape(r.plan || ''),
    csvEscape(r.arpu ?? ''),
    csvEscape(r.invoicesThisMonth),
    csvEscape(r.region || ''),
    csvEscape(r.vatCompliant ? 'Yes' : 'No'),
  ].join(','));
  return [header.join(','), ...lines].join('\n');
}

export default function SuperAdminDashboard() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [range, setRange] = useState(() => ({
    from: new Date(new Date().setDate(new Date().getDate() - 29)),
    to: new Date()
  }));
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [platformStats, setPlatformStats] = useState(null);
  const [platformLoading, setPlatformLoading] = useState(true);

  const [q, setQ] = useState('');
  const [plan, setPlan] = useState('all');
  const [status, setStatus] = useState('all');
  const [minInvoices, setMinInvoices] = useState('');
  
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [saving, setSaving] = useState(false);

  function exportCompaniesCsv(rows) {
    const csv = buildCompaniesCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `companies-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleEditCompany(company) {
    // Fetch full company details
    try {
      const response = await api.get(`/admin/companies?status=${company.status}`);
      const fullCompany = response.data.find(c => c.id === company.id);
      if (fullCompany) {
        setEditingCompany({
          id: fullCompany.id,
          legal_name: fullCompany.legal_name,
          invoices_generated: fullCompany.invoices_generated || 0,
          free_plan_invoice_limit: fullCompany.free_plan_invoice_limit || 0,
          free_plan_duration_months: fullCompany.free_plan_duration_months || 0,
          vat_enabled: fullCompany.vat_enabled || false
        });
        setShowEditModal(true);
      }
    } catch (error) {
      console.error('Failed to fetch company details:', error);
      alert('Failed to load company details');
    }
  }

  async function saveCompanyChanges() {
    if (!editingCompany) return;
    
    try {
      setSaving(true);
      
      // Parse numeric fields with fallback to 0
      const invoicesGenerated = parseInt(editingCompany.invoices_generated) || 0;
      const freePlanLimit = parseInt(editingCompany.free_plan_invoice_limit) || 0;
      const freePlanMonths = parseInt(editingCompany.free_plan_duration_months) || 0;
      
      await api.put(`/admin/companies/${editingCompany.id}`, {
        invoices_generated: invoicesGenerated,
        free_plan_invoice_limit: freePlanLimit,
        free_plan_duration_months: freePlanMonths,
        vat_enabled: editingCompany.vat_enabled
      });
      
      // Reload stats
      const response = await api.get(`/admin/stats?from=${fromISO}&to=${toISO}`);
      setStats(response.data);
      
      setShowEditModal(false);
      setEditingCompany(null);
      alert('Company updated successfully!');
    } catch (error) {
      console.error('Failed to update company:', error);
      alert('Failed to update company: ' + (error.response?.data?.detail || error.message));
    } finally {
      setSaving(false);
    }
  }

  const fromISO = useMemo(() => range.from.toISOString(), [range.from]);
  const toISO = useMemo(() => range.to.toISOString(), [range.to]);

  useEffect(() => {
    async function fetchStats() {
      try {
        setLoading(true);
        const response = await api.get(`/admin/stats?from=${fromISO}&to=${toISO}`);
        setStats(response.data);
      } catch (error) {
        console.error('Failed to fetch admin stats:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, [fromISO, toISO]);

  useEffect(() => {
    async function fetchPlatformStats() {
      try {
        setPlatformLoading(true);
        const response = await api.get('/admin/platform-stats');
        setPlatformStats(response.data);
      } catch (error) {
        console.error('Failed to fetch platform stats:', error);
      } finally {
        setPlatformLoading(false);
      }
    }
    fetchPlatformStats();
  }, []);

  const mtdDelta = useMemo(() => {
    if (!stats) return { pct: '', positive: true };
    const { monthToDate, lastMonth } = stats.invoices;
    const delta = lastMonth === 0 ? 0 : ((monthToDate - lastMonth) / lastMonth) * 100;
    return { pct: `${delta > 0 ? '+' : ''}${delta.toFixed(1)}% vs last month`, positive: delta >= 0 };
  }, [stats]);

  const filteredCompanies = useMemo(() => {
    const list = stats?.companies.all || [];
    const ql = q.trim().toLowerCase();
    return list.filter((c) => {
      if (plan !== 'all' && c.plan !== plan) return false;
      if (status !== 'all' && c.status !== status) return false;
      if (minInvoices && c.invoicesThisMonth < Number(minInvoices)) return false;
      if (ql && !`${c.name}`.toLowerCase().includes(ql)) return false;
      return true;
    });
  }, [stats, q, plan, status, minInvoices]);

  const navigationButtons = (
    <>
      <Button variant="outline" size="sm" onClick={() => navigate('/admin/tiers')}>
        Tier Management
      </Button>
      <Button variant="outline" size="sm" onClick={() => navigate('/admin/featured')}>
        Featured Businesses
      </Button>
      <Button variant="outline" size="sm" onClick={() => navigate('/admin/content')}>
        Content Manager
      </Button>
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
      <div className="bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Super Admin Overview</h1>
            <p className="text-sm text-muted-foreground">As of {stats ? format(new Date(stats.asOf), 'PPpp') : '—'}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" className="gap-2" onClick={() => setRange({ from: new Date(new Date().setDate(new Date().getDate() - 29)), to: new Date() })}>
              <RefreshCcw size={16} />
              Reset Range
            </Button>
            <Button variant="secondary" className="gap-2" disabled>
              <CalendarIcon size={16} />
              {format(range.from, 'MMM d')} – {format(range.to, 'MMM d, yyyy')}
            </Button>
          </div>
        </div>

        <Section title="Platform Statistics (Privacy-Focused)" action={
          <Badge variant="secondary" className="text-xs">Aggregated Data Only</Badge>
        }>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-4">
            <Stat 
              label="Total Companies" 
              value={platformLoading ? '—' : platformStats?.total_companies?.toLocaleString() ?? '—'} 
              onClick={() => {
                setStatus('all');
                setTimeout(() => document.querySelector('#company-explorer')?.scrollIntoView({ behavior: 'smooth' }), 100);
              }}
            />
            <Stat 
              label="Active Companies" 
              value={platformLoading ? '—' : platformStats?.active_companies?.toLocaleString() ?? '—'} 
              onClick={() => {
                setStatus('active');
                setTimeout(() => document.querySelector('#company-explorer')?.scrollIntoView({ behavior: 'smooth' }), 100);
              }}
            />
            <Stat 
              label="Pending Approvals" 
              value={platformLoading ? '—' : platformStats?.pending_companies?.toLocaleString() ?? '—'} 
              onClick={() => navigate('/admin/approvals')}
            />
            <Stat 
              label="Total Invoices" 
              value={platformLoading ? '—' : platformStats?.total_invoices?.toLocaleString() ?? '—'} 
              onClick={() => {
                setStatus('all');
                setTimeout(() => document.querySelector('#company-explorer')?.scrollIntoView({ behavior: 'smooth' }), 100);
              }}
            />
          </div>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-4 mt-3">
            <Stat 
              label="Platform Revenue (AED)" 
              value={platformLoading ? '—' : `${(platformStats?.total_revenue_aed || 0).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
              onClick={() => {
                setStatus('all');
                setTimeout(() => document.querySelector('#company-explorer')?.scrollIntoView({ behavior: 'smooth' }), 100);
              }}
            />
            <Stat 
              label="Active Subscriptions" 
              value={platformLoading ? '—' : platformStats?.active_subscriptions?.toLocaleString() ?? '—'} 
              onClick={() => {
                setStatus('ACTIVE');
                setTimeout(() => document.querySelector('#company-explorer')?.scrollIntoView({ behavior: 'smooth' }), 100);
              }}
            />
            <Stat 
              label="Free Tier Users" 
              value={platformLoading ? '—' : platformStats?.free_tier_users?.toLocaleString() ?? '—'} 
              onClick={() => {
                setPlan('Free');
                setTimeout(() => document.querySelector('#company-explorer')?.scrollIntoView({ behavior: 'smooth' }), 100);
              }}
            />
            <Stat 
              label="Paid Tier Users" 
              value={platformLoading ? '—' : platformStats?.paid_tier_users?.toLocaleString() ?? '—'} 
              onClick={() => {
                setPlan('Enterprise');
                setTimeout(() => document.querySelector('#company-explorer')?.scrollIntoView({ behavior: 'smooth' }), 100);
              }}
            />
          </div>
        </Section>

        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          <Stat 
            label="Pending registrations" 
            value={loading ? '—' : stats?.registrations.pending ?? '—'} 
            onClick={() => navigate('/admin/approvals')}
          />
          <Stat 
            label="Approved registrations" 
            value={loading ? '—' : stats?.registrations.approved ?? '—'}
            onClick={() => {
              setStatus('ACTIVE');
              setTimeout(() => document.querySelector('#company-explorer')?.scrollIntoView({ behavior: 'smooth' }), 100);
            }}
          />
          <Stat 
            label="Rejected registrations" 
            value={loading ? '—' : stats?.registrations.rejected ?? '—'}
            onClick={() => {
              setStatus('REJECTED');
              setTimeout(() => document.querySelector('#company-explorer')?.scrollIntoView({ behavior: 'smooth' }), 100);
            }}
          />
          <Stat 
            label="Active companies" 
            value={loading ? '—' : stats?.companies.active ?? '—'}
            onClick={() => {
              setStatus('ACTIVE');
              setTimeout(() => document.querySelector('#company-explorer')?.scrollIntoView({ behavior: 'smooth' }), 100);
            }}
          />
          <Stat 
            label="Inactive companies" 
            value={loading ? '—' : stats?.companies.inactive ?? '—'}
            onClick={() => {
              setStatus('SUSPENDED');
              setTimeout(() => document.querySelector('#company-explorer')?.scrollIntoView({ behavior: 'smooth' }), 100);
            }}
          />
          <Stat label="Invoices month-to-date" value={loading ? '—' : stats?.invoices.monthToDate.toLocaleString() ?? '—'} delta={mtdDelta.pct} positive={mtdDelta.positive} />
        </div>

        <div>
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Revenue summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Total MRR</p>
                  <p className="text-2xl font-semibold">{loading ? '—' : `AED ${stats?.revenue.mrr.toLocaleString()}`}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Total ARR</p>
                  <p className="text-2xl font-semibold">{loading ? '—' : `AED ${stats?.revenue.arr.toLocaleString()}`}</p>
                </div>
              </div>
              <div className="overflow-hidden rounded-2xl border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr className="text-left">
                      <th className="px-4 py-3 font-medium">Plan</th>
                      <th className="px-4 py-3 font-medium">Active companies</th>
                      <th className="px-4 py-3 font-medium">Price / company</th>
                      <th className="px-4 py-3 font-medium">MRR</th>
                      <th className="px-4 py-3 font-medium">ARR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(stats?.revenue.tiers || []).map((t) => (
                      <tr key={t.plan} className="border-t">
                        <td className="px-4 py-3">{t.plan}</td>
                        <td className="px-4 py-3">{t.activeCompanies.toLocaleString()}</td>
                        <td className="px-4 py-3">AED {t.pricePerCompany.toLocaleString()}</td>
                        <td className="px-4 py-3 font-medium">AED {t.mrr.toLocaleString()}</td>
                        <td className="px-4 py-3">AED {t.arr.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        <div id="company-explorer">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold">Company Explorer</h2>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <Input className="pl-8 w-[120px] h-9 text-sm" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <Select value={plan} onValueChange={setPlan}>
                <SelectTrigger className="w-[120px] h-9 text-sm whitespace-nowrap"><SelectValue placeholder="Plan" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All plans</SelectItem>
                  <SelectItem value="Enterprise">Enterprise</SelectItem>
                  <SelectItem value="Professional">Professional</SelectItem>
                  <SelectItem value="Starter">Starter</SelectItem>
                  <SelectItem value="Free">Free</SelectItem>
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-[120px] h-9 text-sm whitespace-nowrap"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
              <Input type="number" min={0} placeholder="Min inv." value={minInvoices} onChange={(e) => setMinInvoices(e.target.value)} className="w-[120px] h-9 text-sm" />
              <Button variant="outline" size="sm" onClick={() => exportCompaniesCsv(filteredCompanies)}>Export</Button>
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left">
                  <th className="px-4 py-3 font-medium">Company</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Plan</th>
                  <th className="px-4 py-3 font-medium">ARPU</th>
                  <th className="px-4 py-3 font-medium">Invoices (MTD)</th>
                  <th className="px-4 py-3 font-medium">VAT</th>
                  <th className="px-4 py-3 font-medium">Manage</th>
                </tr>
              </thead>
              <tbody>
                {filteredCompanies.map((c) => (
                  <tr key={c.id} className="border-t">
                    <td className="px-4 py-3">{c.name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${c.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{c.status}</span>
                    </td>
                    <td className="px-4 py-3">{c.plan || '—'}</td>
                    <td className="px-4 py-3">{c.arpu ? `AED ${c.arpu}` : '—'}</td>
                    <td className="px-4 py-3">{c.invoicesThisMonth.toLocaleString()}</td>
                    <td className="px-4 py-3">{c.vatCompliant ? <Badge className="bg-emerald-600">Compliant</Badge> : <Badge variant="secondary">Review</Badge>}</td>
                    <td className="px-4 py-3">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => handleEditCompany(c)}
                        className="text-indigo-600 hover:text-indigo-700"
                      >
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Showing {filteredCompanies.length} of {stats?.companies.all.length || 0} companies</p>
        </div>

        {/* Edit Company Modal */}
        {showEditModal && editingCompany && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-lg rounded-2xl">
              <CardHeader>
                <CardTitle>Edit Company: {editingCompany.legal_name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Invoices Generated (Total)</label>
                  <Input
                    type="number"
                    min={0}
                    value={editingCompany.invoices_generated}
                    onChange={(e) => setEditingCompany({ ...editingCompany, invoices_generated: e.target.value })}
                  />
                  <p className="text-xs text-gray-500 mt-1">Total number of invoices created by this company</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Free Plan Invoice Limit</label>
                  <Input
                    type="number"
                    min={0}
                    value={editingCompany.free_plan_invoice_limit}
                    onChange={(e) => setEditingCompany({ ...editingCompany, free_plan_invoice_limit: e.target.value })}
                  />
                  <p className="text-xs text-gray-500 mt-1">Maximum free invoices allowed</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Free Plan Duration (Months)</label>
                  <Input
                    type="number"
                    min={0}
                    value={editingCompany.free_plan_duration_months}
                    onChange={(e) => setEditingCompany({ ...editingCompany, free_plan_duration_months: e.target.value })}
                  />
                  <p className="text-xs text-gray-500 mt-1">Free plan duration in months</p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="vat-enabled"
                    checked={editingCompany.vat_enabled}
                    onChange={(e) => setEditingCompany({ ...editingCompany, vat_enabled: e.target.checked })}
                    className="rounded"
                  />
                  <label htmlFor="vat-enabled" className="text-sm font-medium">
                    VAT Enabled
                  </label>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={saveCompanyChanges}
                    disabled={saving}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowEditModal(false);
                      setEditingCompany(null);
                    }}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

      </div>
    </AdminLayout>
  );
}
