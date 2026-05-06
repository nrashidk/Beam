import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import { EmailInput } from "../components/ui/validated-input";
import {
  ArrowLeft,
  Users,
  UserPlus,
  Trash2,
  Shield,
  User,
  Mail,
  Calendar,
  Check,
  X,
  UserX,
  UserCheck,
} from "lucide-react";
import { format } from "date-fns";
import api, { usersAPI } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import Sidebar from "../components/Sidebar";
import PageLoader from "../components/PageLoader";
import ConfirmationModal from "../components/ConfirmationModal";

// Task 25: Permission matrix display components
const ROLE_LABELS = {
  SUPER_ADMIN:    "Super Admin",
  COMPANY_ADMIN:  "Company Admin",
  BUSINESS_ADMIN: "Business Admin",
  FINANCE_USER:   "Finance User",
  READ_ONLY:      "Read Only",
};

const RESOURCE_LABELS = {
  invoices:        "Invoices",
  inward_invoices: "Inward Invoices",
  reports:         "Reports",
  vat_return:      "VAT Return",
  audit_logs:      "Audit Logs",
  team:            "Team",
  settings:        "Settings",
  gl:              "General Ledger",
  archival:        "Archival",
};

const ACTION_LABELS = {
  view:         "View",
  create:       "Create",
  edit:         "Edit",
  delete:       "Delete",
  approve:      "Approve",
  export:       "Export",
  manage_users: "Manage Users",
};

function PermissionMatrixTable({ matrix }) {
  const roles = ["COMPANY_ADMIN", "BUSINESS_ADMIN", "FINANCE_USER", "READ_ONLY"];
  const resources = Object.keys(RESOURCE_LABELS);
  const actions = Object.keys(ACTION_LABELS);

  return (
    <div className="overflow-x-auto">
      <p className="text-xs text-gray-500 mb-3">
        This matrix shows the effective permissions for each role across all resources.
      </p>
      {resources.map((resource) => (
        <div key={resource} className="mb-6">
          <h4 className="text-sm font-semibold text-gray-800 mb-2">
            {RESOURCE_LABELS[resource] || resource}
          </h4>
          <table className="w-full text-xs border rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left py-2 px-3 font-medium text-gray-600 w-28">Action</th>
                {roles.map((role) => (
                  <th key={role} className="text-center py-2 px-3 font-medium text-gray-600">
                    {ROLE_LABELS[role] || role}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {actions.map((action) => {
                const hasAny = roles.some(
                  (role) => matrix.matrix[role]?.[resource]?.[action] !== undefined,
                );
                if (!hasAny) return null;
                return (
                  <tr key={action} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-2 px-3 text-gray-700">{ACTION_LABELS[action] || action}</td>
                    {roles.map((role) => {
                      const val = matrix.matrix[role]?.[resource]?.[action];
                      if (val === undefined) {
                        return <td key={role} className="py-2 px-3 text-center text-gray-300">—</td>;
                      }
                      return (
                        <td key={role} className="py-2 px-3 text-center">
                          {val
                            ? <Check className="h-3.5 w-3.5 text-emerald-600 mx-auto" />
                            : <X className="h-3.5 w-3.5 text-red-400 mx-auto" />}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function StaticRoleDescriptions() {
  return (
    <div className="space-y-4">
      {/* <div className="flex items-start gap-3">
        <Badge className="bg-purple-600 mt-1">Super Admin</Badge>
        <div>
          <p className="font-medium text-gray-900">Platform Administrator</p>
          <p className="text-sm text-gray-600">Full platform access, can approve companies, view all analytics, manage all users</p>
        </div>
      </div> */}
      <div className="flex items-start gap-3">
        <Badge className="bg-blue-600 mt-1 text-white ">Admin</Badge>
        <div>
          <p className="font-medium text-gray-900">Owner</p>
          <p className="text-sm text-gray-600">Full access to all features, settings, billing, and team management.</p>
        </div>
      </div>
      <div className="flex items-start gap-3">
        <Badge className="bg-indigo-600 mt-1 text-white">Business Admin</Badge>
        <div>
          <p className="font-medium text-gray-900">Manager</p>
          <p className="text-sm text-gray-600">Create, edit, and approve invoices, expenses, suppliers, and inventory.</p>
        </div>
      </div>
      <div className="flex items-start gap-3">
        <Badge className="bg-green-600 mt-1 text-white">Finance User</Badge>
        <div>
          <p className="font-medium text-gray-900">Accountant</p>
          <p className="text-sm text-gray-600">Create and manage invoices and expenses. View financial data and reports. </p>
        </div>
      </div>
      <div className="flex items-start gap-3">
        <Badge className="bg-gray-500 mt-1 text-white">Read Only</Badge>
        <div>
          <p className="font-medium text-gray-900">Viewer</p>
          <p className="text-sm text-gray-600">View-only access to invoices and reports. Cannot create or edit anything.</p>
        </div>
      </div>
    </div>
  );
}

const ROLE_PERMISSION_SUMMARY = {
  SUPER_ADMIN: {
    can: ["Full access to all resources, settings, team, and audit logs"],
    cannot: [],
  },
  COMPANY_ADMIN: {
    can: ["Invoices (all)", "Reports", "VAT Return", "Audit Logs", "Team", "Settings", "GL", "Archival"],
    cannot: [],
  },
  BUSINESS_ADMIN: {
    can: ["Invoices (no delete)", "Reports", "VAT Return (view/export)", "Audit Logs", "Team (invite)"],
    cannot: ["Settings edit", "GL edit", "Archival create", "VAT Return generate"],
  },
  FINANCE_USER: {
    can: ["Invoices (create/edit)", "Inward Invoices (create/edit)", "Reports", "VAT Return (view)", "GL (view)"],
    cannot: ["Audit Logs", "Settings", "Team", "Archival", "VAT Return generate"],
  },
  READ_ONLY: {
    can: ["Invoices (view/export)", "Inward Invoices (view)", "Reports", "VAT Return (view)", "Audit Logs (view)", "GL (view)"],
    cannot: ["Create, edit, or delete anything", "Settings", "Team management"],
  },
};

function buildSummaryFromMatrix(role, matrix) {
  const matrixData = matrix && (matrix.matrix || matrix);
  const rolePerms = matrixData && matrixData[role];
  if (!rolePerms) return null;
  const can = [];
  const cannot = [];
  const ACTION_LABELS = { view: "view", create: "create", edit: "edit", delete: "delete", approve: "approve", export: "export", manage_users: "manage users" };
  for (const [resource, actions] of Object.entries(rolePerms)) {
    const allowed = Object.entries(actions).filter(([, v]) => v).map(([a]) => ACTION_LABELS[a] || a);
    const denied = Object.entries(actions).filter(([, v]) => !v).map(([a]) => ACTION_LABELS[a] || a);
    if (allowed.length > 0) can.push(`${resource}: ${allowed.join(", ")}`);
    else if (denied.length > 0) cannot.push(resource);
  }
  return { can: can.slice(0, 4), cannot: cannot.slice(0, 2) };
}

function MemberPermissionSummary({ role, permMatrix }) {
  const summary = permMatrix
    ? buildSummaryFromMatrix(role, permMatrix)
    : ROLE_PERMISSION_SUMMARY[role];
  if (!summary) return <span className="text-gray-400 text-xs">—</span>;
  return (
    <div className="text-xs space-y-1 max-w-xs">
      {summary.can.map((item, i) => (
        <div key={i} className="flex items-start gap-1 text-green-700">
          <Check size={11} className="mt-0.5 shrink-0" />
          <span>{item}</span>
        </div>
      ))}
      {summary.cannot.slice(0, 2).map((item, i) => (
        <div key={i} className="flex items-start gap-1 text-red-600">
          <X size={11} className="mt-0.5 shrink-0" />
          <span>{item}</span>
        </div>
      ))}
    </div>
  );
}

export default function TeamManagement() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: "",
    full_name: "",
    role: "FINANCE_USER",
  });
  const [inviteResult, setInviteResult] = useState(null);
  const [error, setError] = useState(null);
  const [tierLimits, setTierLimits] = useState(null);
  const [removeLoading, setRemoveLoading] = useState(false);
  // Task 25: permission matrix
  const [permMatrix, setPermMatrix] = useState(null);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    userId: null,
    userName: "",
    title: "",
    message: "",
    confirmText: "Confirm",
    cancelText: "Cancel",
    type: "default",
  });

  useEffect(() => {
    fetchTeamMembers();
    fetchTierLimits();
    fetchPermMatrix();
  }, []);

  const fetchTeamMembers = async () => {
    try {
      setLoading(true);
      const response = await usersAPI.getTeamMembers();
      let members = response.data;
      if (!Array.isArray(members)) {
        if (members && Array.isArray(members.users)) {
          members = members.users;
        } else if (members && Array.isArray(members.data)) {
          members = members.data;
        } else if (members && typeof members === "object") {
          members = Object.values(members);
        } else {
          members = [];
        }
      }
      setTeamMembers(members || []);
    } catch (error) {
      console.error("Failed to fetch team members:", error);
      setError("Failed to load team members");
    } finally {
      setLoading(false);
    }
  };

  const fetchTierLimits = async () => {
    try {
      const response = await api.get("/subscription/current");
      setTierLimits(response.data.plan);
    } catch (error) {
      console.error("Failed to fetch tier limits:", error);
    }
  };

  // Task 25: fetch permission matrix (admins only; gracefully ignore 403)
  const fetchPermMatrix = async () => {
    try {
      const res = await api.get("/admin/permissions");
      setPermMatrix(res.data);
    } catch {
      setPermMatrix(null);
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    setError(null);
    setInviteResult(null);

    // Validate tier limits before submission
    if (!canInviteRole(inviteForm.role)) {
      setError(`Tier limit reached! ${getInviteLimitMessage(inviteForm.role)}`);
      return;
    }

    try {
      const response = await usersAPI.inviteUser(inviteForm);
      setInviteResult(response.data);
      setInviteForm({ email: "", full_name: "", role: "FINANCE_USER" });
      setShowInviteForm(false);
      fetchTeamMembers();
    } catch (error) {
      console.error("Failed to invite user:", error);
      setError(error.response?.data?.detail || "Failed to invite user");
    }
  };

  const handleRemoveUser = (userId, userName) => {
    setConfirmModal({
      isOpen: true,
      userId,
      userName,
      title: "Remove Team Member",
      message: `Are you sure you want to remove ${userName} from the team? This action cannot be undone.`,
      confirmText: "Remove",
      cancelText: "Cancel",
      type: "danger",
      action: "remove",
    });
  };

  const handleDeactivateUser = (userId, userName) => {
    setConfirmModal({
      isOpen: true,
      userId,
      userName,
      title: "Deactivate User",
      message: `Deactivating ${userName} will immediately revoke their login access. Their data and history will be preserved. You can reactivate them at any time.`,
      confirmText: "Deactivate",
      cancelText: "Cancel",
      type: "warning",
      action: "deactivate",
    });
  };

  const handleReactivateUser = (userId, userName) => {
    setConfirmModal({
      isOpen: true,
      userId,
      userName,
      title: "Reactivate User",
      message: `Reactivating ${userName} will restore their login access to the system.`,
      confirmText: "Reactivate",
      cancelText: "Cancel",
      type: "default",
      action: "reactivate",
    });
  };

  const executeRemoveAction = async () => {
    const { userId, action } = confirmModal;
    setConfirmModal({ ...confirmModal, isOpen: false });

    setRemoveLoading(true);
    try {
      if (action === "deactivate") {
        await api.patch(`/company/users/${userId}/status`, {
          is_active: false,
        });
      } else if (action === "reactivate") {
        await api.patch(`/company/users/${userId}/status`, {
          is_active: true,
        });
      } else {
        await usersAPI.removeUser(userId);
      }
      fetchTeamMembers();
    } catch (error) {
      console.error(`Failed to ${action || "remove"} user:`, error);
      setError(error.response?.data?.detail || `Failed to ${action || "remove"} user`);
    } finally {
      setRemoveLoading(false);
    }
  };

  const closeConfirmModal = () => {
    setConfirmModal({ ...confirmModal, isOpen: false });
  };

  const getRoleBadge = (role) => {
    const roleMap = {
      SUPER_ADMIN:   { label: "Super Admin",   className: "bg-purple-600" },
      COMPANY_ADMIN: { label: "Company Admin", className: "bg-blue-600" },
      BUSINESS_ADMIN:{ label: "Business Admin",className: "bg-indigo-600" },
      FINANCE_USER:  { label: "Finance User",  className: "bg-green-600" },
      READ_ONLY:     { label: "Read Only",     className: "bg-gray-500" },
    };
    const config = roleMap[role] || { label: role, className: "bg-gray-600" };
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const getActiveMembers = () =>
    teamMembers.filter((m) => m.is_active !== false);

  const getCurrentRoleCounts = () => {
    const allMembers = teamMembers;
    const businessAdmins = allMembers.filter(
      (m) => m.role === "BUSINESS_ADMIN",
    ).length;
    const financeUsers = allMembers.filter(
      (m) => m.role === "FINANCE_USER",
    ).length;
    return { businessAdmins, financeUsers };
  };

  const isBusinessAdmin = user?.role === "BUSINESS_ADMIN";
  const canManageTeamInvites = [
    "SUPER_ADMIN",
    "COMPANY_ADMIN",
    "BUSINESS_ADMIN",
  ].includes(user?.role);

  const canInviteRole = (role) => {
    if (!canManageTeamInvites) return false;
    if (isBusinessAdmin && !["FINANCE_USER", "READ_ONLY"].includes(role)) return false;
    if (!tierLimits) return true;
    const totalMemberCount = teamMembers.length;
    if (tierLimits.max_users != null && totalMemberCount >= tierLimits.max_users) {
      return false;
    }
    const counts = getCurrentRoleCounts();

    if (role === "BUSINESS_ADMIN") {
      return counts.businessAdmins < tierLimits.max_business_admins;
    }
    if (role === "FINANCE_USER") {
      return counts.financeUsers < tierLimits.max_finance_users;
    }
    return true;
  };

  const getInviteLimitMessage = (role) => {
    if (!tierLimits) {
      return "Tier limit reached. Please upgrade your plan to invite more team members.";
    }

    const totalMemberCount = teamMembers.length;
    if (tierLimits.max_users != null && totalMemberCount >= tierLimits.max_users) {
      return `Your ${tierLimits?.name || "current"} plan allows ${tierLimits.max_users} total users. Please upgrade your plan to invite more team members.`;
    }

    if (role === "BUSINESS_ADMIN") {
      return `Your ${tierLimits?.name || "current"} plan allows ${tierLimits?.max_business_admins || 0} Business Admins. Please upgrade your plan to invite more team members.`;
    }

    if (role === "FINANCE_USER") {
      return `Your ${tierLimits?.name || "current"} plan allows ${tierLimits?.max_finance_users || 0} Finance Users. Please upgrade your plan to invite more team members.`;
    }

    return "Please upgrade your plan to invite more team members.";
  };

  const getRoleLimit = (role) => {
    if (!tierLimits) return null;
    const counts = getCurrentRoleCounts();

    if (role === "BUSINESS_ADMIN") {
      return `${counts.businessAdmins} / ${tierLimits.max_business_admins}`;
    }
    if (role === "FINANCE_USER") {
      return `${counts.financeUsers} / ${tierLimits.max_finance_users}`;
    }
    return null;
  };

  const getTotalUsersUsage = () => {
    if (!tierLimits || tierLimits.max_users == null) return null;
    return `${teamMembers.length} / ${tierLimits.max_users}`;
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 ml-64">
          <PageLoader />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 ml-64 flex flex-col">
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6 text-indigo-600 flex-shrink-0" />
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Team Management</h1>
              <p className="text-sm text-gray-500 mt-0.5">Manage team members and their access levels</p>
            </div>
          </div>
        </div>
        <div className="flex-1 p-6">
          <div className="max-w-6xl mx-auto">
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
                    Temporary password:{" "}
                    <code className="bg-green-100 px-2 py-1 rounded">
                      {inviteResult.temporary_password}
                    </code>
                  </p>
                  <p className="text-xs text-green-700 mt-2">
                    ⚠️ Please share this password securely with the user. They
                    should change it immediately after first login.
                  </p>
                </div>
                <button
                  onClick={() => setInviteResult(null)}
                  className="text-green-600 hover:text-green-800"
                >
                  ×
                </button>
              </div>
            </div>
          )}

          <Card className="mb-6">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>
                Team Members ({getActiveMembers().length}
                {teamMembers.length !== getActiveMembers().length
                  ? ` active, ${teamMembers.length - getActiveMembers().length} deactivated`
                  : ""}
                )
              </CardTitle>
              <Button
                onClick={() => setShowInviteForm(!showInviteForm)}
                className="gap-2"
                disabled={!canManageTeamInvites}
              >
                <UserPlus size={16} />
                Invite Team Member
              </Button>
            </CardHeader>
            <CardContent>
              {showInviteForm && (
                <form
                  onSubmit={handleInvite}
                  className="mb-6 p-4 bg-gray-50 rounded-lg space-y-4"
                >
                  <h3 className="font-semibold text-gray-900">
                    Invite New Team Member
                  </h3>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Full Name
                    </label>
                    <Input
                      type="text"
                      value={inviteForm.full_name}
                      onChange={(e) =>
                        setInviteForm({
                          ...inviteForm,
                          full_name: e.target.value,
                        })
                      }
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
                      onChange={(e) =>
                        setInviteForm({ ...inviteForm, email: e.target.value })
                      }
                      placeholder="john@example.com"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Role{" "}
                      {tierLimits && (
                        <span className="text-xs text-gray-500 font-normal">
                          (Current Tier: {tierLimits.name})
                        </span>
                      )}
                    </label>
                    <Select
                      value={inviteForm.role}
                      onValueChange={(value) =>
                        setInviteForm({ ...inviteForm, role: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem
                          value="FINANCE_USER"
                          disabled={!canInviteRole("FINANCE_USER")}
                        >
                          <div className="flex w-full items-center justify-between gap-3 whitespace-nowrap">
                            <span className="shrink-0">Finance User</span>
                            {tierLimits && (
                              <Badge
                                variant="outline"
                                wrapperClassName="w-auto max-w-none shrink-0"
                                className="text-xs"
                              >
                                {getRoleLimit("FINANCE_USER")}
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                        {!isBusinessAdmin && (
                          <SelectItem
                            value="BUSINESS_ADMIN"
                            disabled={!canInviteRole("BUSINESS_ADMIN")}
                          >
                            <div className="flex w-full items-center justify-between gap-3 whitespace-nowrap">
                              <span className="shrink-0">Business Admin</span>
                              {tierLimits && (
                                <Badge
                                  variant="outline"
                                  wrapperClassName="w-auto max-w-none shrink-0"
                                  className="text-xs"
                                >
                                  {getRoleLimit("BUSINESS_ADMIN")}
                                </Badge>
                              )}
                            </div>
                          </SelectItem>
                        )}
                        <SelectItem
                          value="READ_ONLY"
                          disabled={!canInviteRole("READ_ONLY")}
                        >
                          Read Only (view access only)
                        </SelectItem>
                        {!isBusinessAdmin && (
                          <SelectItem
                            value="COMPANY_ADMIN"
                            disabled={!canInviteRole("COMPANY_ADMIN")}
                          >
                            Company Admin (Owner-level)
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <div className="text-xs text-gray-500 mt-2 space-y-1">
                      <p>
                        <strong>Finance User:</strong> Can create invoices,
                        manage expenses, view financial data
                      </p>
                      <p>
                        <strong>Read Only:</strong> View invoices and reports;
                        cannot create, edit, or approve anything
                      </p>
                      {!isBusinessAdmin && (
                        <p>
                          <strong>Business Admin:</strong> Can manage invoices,
                          expenses, inventory, suppliers, and team members
                        </p>
                      )}
                      {!isBusinessAdmin && (
                        <p>
                          <strong>Company Admin:</strong> Full access including
                          billing, branding, and settings
                        </p>
                      )}
                      {isBusinessAdmin && (
                        <p className="text-blue-600">
                          Business admins can invite Finance Users or Read-Only users.
                        </p>
                      )}
                      {tierLimits && (
                        <p className="text-blue-600 mt-2">
                          <strong>Your Plan:</strong> {tierLimits.name} -{" "}
                          {tierLimits.max_users ?? "Unlimited"} Total Users, {" "}
                          {tierLimits.max_business_admins} Business Admins, {" "}
                          {tierLimits.max_finance_users} Finance Users
                          {getTotalUsersUsage() ? ` (Using ${getTotalUsersUsage()})` : ""}
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
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowInviteForm(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                  {!canInviteRole(inviteForm.role) && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 rounded-lg text-sm">
                      <strong>Tier limit reached!</strong> {getInviteLimitMessage(inviteForm.role)}
                    </div>
                  )}
                </form>
              )}

              {teamMembers.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <UserPlus size={48} className="mx-auto mb-4 opacity-50" />
                  <p>No team members yet</p>
                  <p className="text-sm">
                    Click "Invite Team Member" to add your first team member
                  </p>
                </div>
              ) : (() => {
                const activeMembers = teamMembers.filter((m) => m.is_active !== false);
                const deactivatedMembers = teamMembers.filter((m) => m.is_active === false);
                const tableColHeaders = (isGrey) => (
                  <tr className={`border-b ${isGrey ? "border-gray-200 bg-gray-100" : ""}`}>
                    {["Name","Email","Role","Effective Permissions","Joined","Last Login"].map((h) => (
                      <th key={h} className={`text-left py-3 px-4 font-medium ${isGrey ? "text-gray-500" : "text-gray-700"}`}>{h}</th>
                    ))}
                    <th className={`text-right py-3 px-4 font-medium ${isGrey ? "text-gray-500" : "text-gray-700"}`}>Actions</th>
                  </tr>
                );
                const renderRow = (member, isDeactivated) => {
                  const isSelf = member.id === user?.id;
                  const displayName = member.full_name || member.email.split("@")[0];
                  return (
                  <tr
                    key={member.id}
                    className="border-b hover:bg-gray-50"
                  >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2 flex-wrap">
                              <User size={16} className={isDeactivated ? "text-gray-300" : "text-gray-400"} />
                              <span className={`font-medium ${isDeactivated ? "text-gray-400 line-through" : ""}`}>
                                {displayName}
                              </span>
                              {member.is_owner && (
                                <Badge variant="outline" className="text-xs gap-1">
                                  <Shield size={12} />
                                  Owner
                                </Badge>
                              )}
                              {isDeactivated && (
                                <Badge className="text-xs bg-gray-200 text-gray-600 hover:bg-gray-200">
                                  Deactivated
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
                          <td className="py-3 px-4">
                            {getRoleBadge(member.role)}
                          </td>
                          <td className="py-3 px-4">
                            <MemberPermissionSummary role={member.role} permMatrix={permMatrix} />
                          </td>
                          <td className="py-3 px-4 text-gray-600 text-sm">
                            {member.created_at ? (
                              <div className="flex items-center gap-2">
                                <Calendar size={14} className="text-gray-400" />
                                {format(new Date(member.created_at), "MMM d, yyyy")}
                              </div>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="py-3 px-4 text-gray-600 text-sm">
                            {member.last_login
                              ? format(new Date(member.last_login), "MMM d, yyyy")
                              : "Never"}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {member.is_owner && (
                              <span className="text-xs text-gray-500">Cannot modify owner</span>
                            )}
                            {isSelf && !member.is_owner && (
                              <span className="text-xs text-gray-500">You</span>
                            )}
                            {!member.is_owner && !isSelf && (
                              <div className="flex items-center justify-end gap-2">
                                {isDeactivated ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleReactivateUser(member.id, displayName)}
                                    className="text-green-700 hover:bg-green-50 gap-2"
                                    disabled={removeLoading}
                                  >
                                    <UserCheck size={14} />
                                    Reactivate
                                  </Button>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDeactivateUser(member.id, displayName)}
                                    className="text-amber-600 hover:bg-amber-50 gap-2"
                                    disabled={removeLoading}
                                  >
                                    <UserX size={14} />
                                    Deactivate
                                  </Button>
                                )}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleRemoveUser(member.id, displayName)}
                                  className="text-red-600 hover:bg-red-50 gap-2"
                                  disabled={removeLoading}
                                >
                                  <Trash2 size={14} />
                                  Remove
                                </Button>
                              </div>
                            )}
                          </td>
                  </tr>
                  );
                };
                return (
                  <div className="space-y-6">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>{tableColHeaders(false)}</thead>
                        <tbody>
                          {activeMembers.length === 0 ? (
                            <tr><td colSpan={7} className="py-6 text-center text-gray-400 text-sm">No active members</td></tr>
                          ) : activeMembers.map((m) => renderRow(m, false))}
                        </tbody>
                      </table>
                    </div>
                    {deactivatedMembers.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <UserX size={16} className="text-gray-400" />
                          <h3 className="text-sm font-semibold text-gray-600">
                            Deactivated Members ({deactivatedMembers.length})
                          </h3>
                        </div>
                        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-gray-50">
                          <table className="w-full opacity-75">
                            <thead>{tableColHeaders(true)}</thead>
                            <tbody>{deactivatedMembers.map((m) => renderRow(m, true))}</tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Task 25: Permission Matrix Card */}
          <Card>
            <CardHeader>
              <CardTitle>Role Permissions</CardTitle>
            </CardHeader>
            <CardContent>
              {permMatrix ? (
                <PermissionMatrixTable matrix={permMatrix} />
              ) : (
                <StaticRoleDescriptions />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        cancelText={confirmModal.cancelText}
        type={confirmModal.type}
        onConfirm={executeRemoveAction}
        onCancel={closeConfirmModal}
        isLoading={removeLoading}
      />
    </div>
  </div>
  );
}
