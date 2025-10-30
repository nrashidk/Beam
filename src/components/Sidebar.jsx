import { useNavigate, useLocation } from 'react-router-dom';
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
  FileSpreadsheet
} from 'lucide-react';

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  // Navigation items in alphabetical order
  const navItems = [
    { path: '/ap/inbox', icon: Inbox, label: 'AP Inbox' },
    { path: '/billing', icon: CreditCard, label: 'Billing' },
    { path: '/settings/branding', icon: Palette, label: 'Branding' },
    { path: '/bulk-import', icon: Upload, label: 'Bulk Import' },
    { path: '/finance', icon: BarChart3, label: 'Finance' },
    { path: '/audit-files', icon: FileCheck, label: 'FTA Audit' },
    { path: '/invoices', icon: FileText, label: 'Invoices' },
    { path: '/payment-verification', icon: CheckCircle, label: 'Payment Verification' },
    { path: '/settings/peppol', icon: Network, label: 'PEPPOL' },
    { path: '/ap/purchase-orders', icon: ShoppingCart, label: 'Purchase Orders' },
    { path: '/reconciliation', icon: FileSpreadsheet, label: 'Reconciliation' },
    { path: '/settings/security', icon: Shield, label: 'Security' },
    { path: '/settings/team', icon: Users, label: 'Team' },
    { path: '/settings/vat', icon: Percent, label: 'VAT Settings' },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <div className="fixed left-0 top-0 h-screen w-64 bg-white border-r border-gray-200 shadow-sm flex flex-col z-40">
      {/* Logo */}
      <div 
        className="p-6 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => navigate('/dashboard')}
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
                className={`
                  w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all
                  ${active 
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' 
                    : 'text-gray-700 hover:bg-gray-50 hover:text-indigo-600'
                  }
                `}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Dashboard Link at Bottom */}
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={() => navigate('/dashboard')}
          className={`
            w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all
            ${location.pathname === '/dashboard'
              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
              : 'text-gray-700 hover:bg-gray-50 hover:text-indigo-600'
            }
          `}
        >
          <TrendingUp className="w-5 h-5" />
          <span>Dashboard</span>
        </button>
      </div>
    </div>
  );
}
