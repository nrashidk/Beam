import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { apiClient } from "../lib/api";
import {
  BookOpen,
  List,
  BarChart3,
  Search,
  RefreshCw,
} from "lucide-react";

function fmt(val) {
  const n = Number(val) || 0;
  return `AED ${n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const ACCOUNT_TYPE_COLORS = {
  ASSET: "bg-blue-100 text-blue-700",
  LIABILITY: "bg-red-100 text-red-700",
  EQUITY: "bg-purple-100 text-purple-700",
  REVENUE: "bg-green-100 text-green-700",
  EXPENSE: "bg-orange-100 text-orange-700",
};

function Badge({ type }) {
  const cls = ACCOUNT_TYPE_COLORS[type] || "bg-gray-100 text-gray-600";
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>
      {type}
    </span>
  );
}

function GLSubnav({ current }) {
  const navigate = useNavigate();
  const tabs = [
    { path: "/gl/accounts", label: "Chart of Accounts", icon: List },
    { path: "/gl/journal-entries", label: "Journal Entries", icon: BookOpen },
    { path: "/gl/trial-balance", label: "Trial Balance", icon: BarChart3 },
  ];
  return (
    <div className="border-b border-gray-200 mb-6">
      <nav className="flex gap-1">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = current === t.path;
          return (
            <button
              key={t.path}
              onClick={() => navigate(t.path)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                active
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export default function GLAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [balanceMap, setBalanceMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const today = new Date().toISOString().slice(0, 10);
      const [acctRes, summaryRes] = await Promise.all([
        apiClient.get("/accounts"),
        apiClient.get("/gl-summary", { params: { from_date: "2000-01-01", to_date: today } }),
      ]);
      setAccounts(acctRes.data.accounts || []);
      const map = {};
      for (const a of summaryRes.data.accounts || []) {
        map[a.account_code] = a.net_balance;
      }
      setBalanceMap(map);
    } catch (e) {
      setError(e.response?.data?.detail || "Failed to load chart of accounts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const types = ["ALL", ...Array.from(new Set(accounts.map((a) => a.account_type)))];

  const filtered = accounts.filter((a) => {
    const matchType = typeFilter === "ALL" || a.account_type === typeFilter;
    const matchSearch =
      !search ||
      a.account_code.toLowerCase().includes(search.toLowerCase()) ||
      a.account_name.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  const TYPE_ORDER = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"];
  const grouped = {};
  filtered
    .slice()
    .sort((a, b) => a.account_code.localeCompare(b.account_code))
    .forEach((a) => {
      const t = a.account_type;
      if (!grouped[t]) grouped[t] = [];
      grouped[t].push(a);
    });

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 ml-64 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <BookOpen className="h-8 w-8 text-indigo-600" />
              <h1 className="text-3xl font-bold text-gray-900">General Ledger</h1>
            </div>
            <p className="text-gray-500">Chart of accounts, double-entry journal entries, and trial balance</p>
          </div>

          <GLSubnav current="/gl/accounts" />

          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search accounts…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {types.map((t) => (
                <option key={t} value={t}>
                  {t === "ALL" ? "All Types" : t}
                </option>
              ))}
            </select>
            <button
              onClick={load}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>

          {error && (
            <p className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          {loading ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center text-gray-400 text-sm">
              Loading accounts…
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm text-center py-12 text-gray-400">
              <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No accounts found.</p>
            </div>
          ) : (
            TYPE_ORDER.filter((t) => grouped[t]).map((type) => {
              const accts = grouped[type];
              return (
                <div key={type} className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <Badge type={type} />
                  <span className="text-xs text-gray-400 font-medium">{accts.length} accounts</span>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Code</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Account Name</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">System</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {accts.map((a) => (
                          <tr key={a.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-mono text-indigo-700 font-medium">{a.account_code}</td>
                            <td className="px-4 py-3">
                              <p className="text-sm text-gray-900 font-medium">{a.account_name}</p>
                              {a.account_name_ar && (
                                <p className="text-xs text-gray-400" dir="rtl">{a.account_name_ar}</p>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {a.is_system ? (
                                <span className="text-xs text-gray-400">System</span>
                              ) : (
                                <span className="text-xs text-indigo-500">Custom</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-sm">
                              {typeof balanceMap[a.account_code] === "number" ? (
                                <span className={balanceMap[a.account_code] < 0 ? "text-red-600 font-semibold" : "text-gray-700"}>
                                  {fmt(balanceMap[a.account_code])}
                                </span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ))
          )}

          <div className="mt-2 text-xs text-gray-400">
            Showing {filtered.length} of {accounts.length} accounts
          </div>
        </div>
      </div>
    </div>
  );
}
