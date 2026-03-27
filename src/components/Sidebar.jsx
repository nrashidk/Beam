import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  FileText,
  Inbox,
  ShoppingCart,
  Upload,
  FileCheck,
  Network,
  Palette,
  Users,
  Shield,
  CreditCard,
  TrendingUp,
  BarChart3,
  Percent,
  CheckCircle,
  FileSpreadsheet,
  LineChart,
  Receipt,
  CalendarDays,
  Archive,
  ClipboardList,
  BookOpen,
  ShieldCheck,
  List,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  const isGLPath = location.pathname.startsWith("/gl/") || location.pathname === "/general-ledger";
  const [glOpen, setGlOpen] = useState(isGLPath);

  useEffect(() => {
    if (isGLPath) setGlOpen(true);
  }, [isGLPath]);

  const isActive = (path) => location.pathname === path;
  const isGroupActive = (paths) => paths.some((p) => location.pathname === p || location.pathname.startsWith(p));

  const navItems = [
    { path: "/analytics", icon: LineChart, label: "Advanced Analytics" },
    { path: "/ap/inbox", icon: Inbox, label: "AP Inbox" },
    { path: "/billing", icon: CreditCard, label: "Billing" },
    { path: "/settings/branding", icon: Palette, label: "Branding" },
    { path: "/bulk-import", icon: Upload, label: "Bulk Import" },
    { path: "/expense-tracker", icon: Receipt, label: "Expense Tracker" },
    { path: "/finance", icon: BarChart3, label: "Finance" },
    { path: "/audit-files", icon: FileCheck, label: "FTA Audit" },
    { path: "/invoices", icon: FileText, label: "Invoices" },
    { path: "/payment-verification", icon: CheckCircle, label: "Payment Verification" },
    { path: "/settings/peppol", icon: Network, label: "PEPPOL" },
    { path: "/ap/purchase-orders", icon: ShoppingCart, label: "Purchase Orders" },
    { path: "/reconciliation", icon: FileSpreadsheet, label: "Reconciliation" },
    { path: "/reports/periodic", icon: CalendarDays, label: "Periodic Report" },
    { path: "/data-archival", icon: Archive, label: "Data Archival" },
    { path: "/audit-trail", icon: ShieldCheck, label: "Audit Trail" },
    { path: "/settings/security", icon: Shield, label: "Security" },
    { path: "/settings/team", icon: Users, label: "Team" },
    { path: "/vat-return", icon: ClipboardList, label: "VAT Return" },
    { path: "/settings/vat", icon: Percent, label: "VAT Settings" },
  ];

  const glSubItems = [
    { path: "/gl/accounts", icon: List, label: "Chart of Accounts" },
    { path: "/gl/journal-entries", icon: BookOpen, label: "Journal Entries" },
    { path: "/gl/trial-balance", icon: BarChart3, label: "Trial Balance" },
  ];

  const glGroupActive = isGroupActive(["/gl/accounts", "/gl/journal-entries", "/gl/trial-balance", "/general-ledger"]);

  return (
    <div className="fixed left-0 top-0 h-screen w-64 bg-white border-r border-gray-200 shadow-sm flex flex-col z-40">
      {/* Logo */}
      <div
        className="p-6 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => navigate("/dashboard")}
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="h-8 w-8 text-indigo-600" />
          <span className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            InvoLinks
          </span>
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <div className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                    : "text-gray-700 hover:bg-gray-50 hover:text-indigo-600"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </button>
            );
          })}

          {/* General Ledger Group */}
          <div>
            <button
              onClick={() => setGlOpen((o) => !o)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                glGroupActive
                  ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                  : "text-gray-700 hover:bg-gray-50 hover:text-indigo-600"
              }`}
            >
              <BookOpen className="w-5 h-5" />
              <span className="flex-1 text-left">General Ledger</span>
              {glOpen ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>

            {glOpen && (
              <div className="ml-4 mt-1 space-y-0.5 border-l-2 border-indigo-100 pl-3">
                {glSubItems.map((sub) => {
                  const Icon = sub.icon;
                  const active = isActive(sub.path);
                  return (
                    <button
                      key={sub.path}
                      onClick={() => navigate(sub.path)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                        active
                          ? "bg-indigo-50 text-indigo-700 font-medium"
                          : "text-gray-600 hover:bg-gray-50 hover:text-indigo-600"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{sub.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Dashboard Link at Bottom */}
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={() => navigate("/dashboard")}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
            location.pathname === "/dashboard"
              ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
              : "text-gray-700 hover:bg-gray-50 hover:text-indigo-600"
          }`}
        >
          <TrendingUp className="w-5 h-5" />
          <span>Profile</span>
        </button>
      </div>
    </div>
  );
}
