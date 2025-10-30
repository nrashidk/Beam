import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { EmailInput } from '../components/ui/validated-input';
import { ArrowLeft, UserPlus, Trash2, Shield, User, Mail, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';

export default function TeamManagement() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: '',
    full_name: '',
    role: 'FINANCE_USER'
  });
  const [inviteResult, setInviteResult] = useState(null);
  const [error, setError] = useState(null);
  const [tierLimits, setTierLimits] = useState(null);

  useEffect(() => {
    fetchTeamMembers();
    fetchTierLimits();
  }, []);

  const fetchTeamMembers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/users/team');
      setTeamMembers(response.data);
    } catch (error) {
      console.error('Failed to fetch team members:', error);
      setError('Failed to load team members');
    } finally {
      setLoading(false);
    }
  };

  const fetchTierLimits = async () => {
    try {
      const response = await api.get('/subscription/current');
      setTierLimits(response.data.plan);
    } catch (error) {
      console.error('Failed to fetch tier limits:', error);
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    setError(null);
    setInviteResult(null);

    // Validate tier limits before submission
    if (!canInviteRole(inviteForm.role)) {
      setError(
        `Tier limit reached! Your ${tierLimits?.name || 'current'} plan allows ${
          inviteForm.role === 'BUSINESS_ADMIN' 
            ? `${tierLimits?.max_business_admins || 0} Business Admins` 
            : `${tierLimits?.max_finance_users || 0} Finance Users`
        }. Please upgrade your plan to invite more team members.`
      );
      return;
    }

    try {
      const response = await api.post('/users/invite', inviteForm);
      setInviteResult(response.data);
      setInviteForm({ email: '', full_name: '', role: 'FINANCE_USER' });
      setShowInviteForm(false);
      fetchTeamMembers();
    } catch (error) {
      console.error('Failed to invite user:', error);
      setError(error.response?.data?.detail || 'Failed to invite user');
    }
  };

  const handleRemoveUser = async (userId, userName) => {
    if (!confirm(`Are you sure you want to remove ${userName} from the team?`)) {
      return;
    }

    try {
      await api.delete(`/users/${userId}`);
      fetchTeamMembers();
    } catch (error) {
      console.error('Failed to remove user:', error);
      setError(error.response?.data?.detail || 'Failed to remove user');
    }
  };

  const getRoleBadge = (role) => {
    const roleMap = {
      'SUPER_ADMIN': { label: 'Super Admin', className: 'bg-purple-600' },
      'COMPANY_ADMIN': { label: 'Company Admin', className: 'bg-blue-600' },
      'BUSINESS_ADMIN': { label: 'Business Admin', className: 'bg-indigo-600' },
      'FINANCE_USER': { label: 'Finance User', className: 'bg-green-600' }
    };
    const config = roleMap[role] || { label: role, className: 'bg-gray-600' };
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const getCurrentRoleCounts = () => {
    const businessAdmins = teamMembers.filter(m => m.role === 'BUSINESS_ADMIN').length;
    const financeUsers = teamMembers.filter(m => m.role === 'FINANCE_USER').length;
    return { businessAdmins, financeUsers };
  };

  const canInviteRole = (role) => {
    if (!tierLimits) return true;
    const counts = getCurrentRoleCounts();
    
    if (role === 'BUSINESS_ADMIN') {
      return counts.businessAdmins < tierLimits.max_business_admins;
    }
    if (role === 'FINANCE_USER') {
      return counts.financeUsers < tierLimits.max_finance_users;
    }
    return true;
  };

  const getRoleLimit = (role) => {
    if (!tierLimits) return null;
    const counts = getCurrentRoleCounts();
    
    if (role === 'BUSINESS_ADMIN') {
      return `${counts.businessAdmins} / ${tierLimits.max_business_admins}`;
    }
    if (role === 'FINANCE_USER') {
      return `${counts.financeUsers} / ${tierLimits.max_finance_users}`;
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex">
      <Sidebar />
      
      <div className="flex-1 ml-64">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <BackToDashboard />

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Team Management</h1>
          <p className="text-gray-600 mt-2">
            Manage team members and their access levels
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {inviteResult && (
          <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg mb-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold">User invited successfully!</p>
                <p className="text-sm mt-1">Email: {inviteResult.email}</p>
                <p className="text-sm mt-1">
                  Temporary password: <code className="bg-green-100 px-2 py-1 rounded">{inviteResult.temporary_password}</code>
                </p>
                <p className="text-xs text-green-700 mt-2">
                  ⚠️ Please share this password securely with the user. They should change it immediately after first login.
                </p>
              </div>
              <button onClick={() => setInviteResult(null)} className="text-green-600 hover:text-green-800">
                ×
              </button>
            </div>
          </div>
        )}

        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Team Members ({teamMembers.length})</CardTitle>
            <Button onClick={() => setShowInviteForm(!showInviteForm)} className="gap-2">
              <UserPlus size={16} />
              Invite Team Member
            </Button>
          </CardHeader>
          <CardContent>
            {showInviteForm && (
              <form onSubmit={handleInvite} className="mb-6 p-4 bg-gray-50 rounded-lg space-y-4">
                <h3 className="font-semibold text-gray-900">Invite New Team Member</h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name
                  </label>
                  <Input
                    type="text"
                    value={inviteForm.full_name}
                    onChange={(e) => setInviteForm({ ...inviteForm, full_name: e.target.value })}
                    placeholder="John Doe"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <EmailInput
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                    placeholder="john@example.com"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role {tierLimits && <span className="text-xs text-gray-500 font-normal">(Current Tier: {tierLimits.name})</span>}
                  </label>
                  <Select value={inviteForm.role} onValueChange={(value) => setInviteForm({ ...inviteForm, role: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FINANCE_USER" disabled={!canInviteRole('FINANCE_USER')}>
                        <div className="flex items-center justify-between w-full">
                          <span>Finance User</span>
                          {tierLimits && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              {getRoleLimit('FINANCE_USER')}
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                      <SelectItem value="BUSINESS_ADMIN" disabled={!canInviteRole('BUSINESS_ADMIN')}>
                        <div className="flex items-center justify-between w-full">
                          <span>Business Admin</span>
                          {tierLimits && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              {getRoleLimit('BUSINESS_ADMIN')}
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                      <SelectItem value="COMPANY_ADMIN">Company Admin (Owner-level)</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="text-xs text-gray-500 mt-2 space-y-1">
                    <p><strong>Finance User:</strong> Can create invoices, manage expenses, view financial data</p>
                    <p><strong>Business Admin:</strong> Can manage invoices, expenses, inventory, suppliers, and team members</p>
                    <p><strong>Company Admin:</strong> Full access including billing, branding, and settings</p>
                    {tierLimits && (
                      <p className="text-blue-600 mt-2">
                        <strong>Your Plan:</strong> {tierLimits.name} - {tierLimits.max_business_admins} Business Admins, {tierLimits.max_finance_users} Finance Users
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button 
                    type="submit" 
                    disabled={!canInviteRole(inviteForm.role)}
                  >
                    Send Invitation
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowInviteForm(false)}>
                    Cancel
                  </Button>
                </div>
                {!canInviteRole(inviteForm.role) && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 rounded-lg text-sm">
                    <strong>Tier limit reached!</strong> Upgrade your plan to invite more {inviteForm.role === 'BUSINESS_ADMIN' ? 'Business Admins' : 'Finance Users'}.
                  </div>
                )}
              </form>
            )}

            {loading ? (
              <div className="text-center py-8 text-gray-500">Loading team members...</div>
            ) : teamMembers.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <UserPlus size={48} className="mx-auto mb-4 opacity-50" />
                <p>No team members yet</p>
                <p className="text-sm">Click "Invite Team Member" to add your first team member</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Name</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Email</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Role</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Joined</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Last Login</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamMembers.map((member) => (
                      <tr key={member.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <User size={16} className="text-gray-400" />
                            <span className="font-medium">
                              {member.full_name || member.email.split('@')[0]}
                            </span>
                            {member.is_owner && (
                              <Badge variant="outline" className="text-xs gap-1">
                                <Shield size={12} />
                                Owner
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2 text-gray-600">
                            <Mail size={14} className="text-gray-400" />
                            {member.email}
                          </div>
                        </td>
                        <td className="py-3 px-4">{getRoleBadge(member.role)}</td>
                        <td className="py-3 px-4 text-gray-600 text-sm">
                          {member.created_at ? (
                            <div className="flex items-center gap-2">
                              <Calendar size={14} className="text-gray-400" />
                              {format(new Date(member.created_at), 'MMM d, yyyy')}
                            </div>
                          ) : '—'}
                        </td>
                        <td className="py-3 px-4 text-gray-600 text-sm">
                          {member.last_login ? format(new Date(member.last_login), 'MMM d, yyyy') : 'Never'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {!member.is_owner && member.id !== user?.id && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRemoveUser(member.id, member.full_name || member.email)}
                              className="text-red-600 hover:bg-red-50 gap-2"
                            >
                              <Trash2 size={14} />
                              Remove
                            </Button>
                          )}
                          {member.is_owner && (
                            <span className="text-xs text-gray-500">Cannot remove owner</span>
                          )}
                          {member.id === user?.id && !member.is_owner && (
                            <span className="text-xs text-gray-500">You</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Role Permissions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Badge className="bg-purple-600 mt-1">Super Admin</Badge>
                <div>
                  <p className="font-medium text-gray-900">Platform Administrator</p>
                  <p className="text-sm text-gray-600">
                    Full platform access, can approve companies, view all analytics, manage all users
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Badge className="bg-blue-600 mt-1">Admin</Badge>
                <div>
                  <p className="font-medium text-gray-900">Company Administrator</p>
                  <p className="text-sm text-gray-600">
                    Full company access, can invite/remove team members, manage all invoices, branding, and settings
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Badge className="bg-green-600 mt-1">Finance User</Badge>
                <div>
                  <p className="font-medium text-gray-900">Finance Team Member</p>
                  <p className="text-sm text-gray-600">
                    Can create, view, and manage invoices. Cannot invite users or change company settings
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  );
}
