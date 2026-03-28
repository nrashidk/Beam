import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { apiClient } from "../lib/api";
import {
  BookOpen,
  List,
  BarChart3,
  RefreshCw,
  ArrowUpDown,
  FileSpreadsheet,
  FileText,
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

export default function GLTrialBalance() {
  const today = new Date();
  const janFirst = new Date(today.getFullYear(), 0, 1);
  const fmtDate = (d) => d.toISOString().slice(0, 10);

  const [fromDate, setFromDate] = useState(fmtDate(janFirst));
  const [toDate, setToDate] = useState(fmtDate(today));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [exporting, setExporting] = useState("");

  const handleExport = useCallback(async (format) => {
    setExporting(format);
    try {
      const params = { format, from_date: fromDate, to_date: toDate };
      if (typeFilter !== "ALL") params.account_type = typeFilter;
      const res = await apiClient.get("/reports/trial-balance/export", {
        params,
        responseType: "blob",
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `trial_balance_${fromDate}_${toDate}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      let msg = `Export failed: ${e.message}`;
      if (e.response?.data instanceof Blob) {
        try {
          const text = await e.response.data.text();
          const parsed = JSON.parse(text);
          msg = parsed.detail || msg;
        } catch (_) {}
      } else if (e.response?.data?.detail) {
        msg = e.response.data.detail;
      }
      alert(msg);
    } finally {
      setExporting("");
    }
  }, [fromDate, toDate, typeFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiClient.get("/gl-summary", {
        params: { from_date: fromDate, to_date: toDate },
      });
      setData(res.data);
    } catch (e) {
      setError(e.response?.data?.detail || "Failed to load trial balance.");
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    load();
  }, [load]);

  const accounts = data?.accounts || [];
  const types = ["ALL", ...Array.from(new Set(accounts.map((a) => a.account_type)))];

  const activeAccounts = accounts.filter((a) => a.total_debit !== 0 || a.total_credit !== 0);
  const filtered = activeAccounts.filter((a) => typeFilter === "ALL" || a.account_type === typeFilter);

  const globalTotalDebits = activeAccounts.reduce((s, a) => s + a.total_debit, 0);
  const globalTotalCredits = activeAccounts.reduce((s, a) => s + a.total_credit, 0);
  const isBalanced = Math.abs(globalTotalDebits - globalTotalCredits) < 0.01;

  const filteredTotalDebits = filtered.reduce((s, a) => s + a.total_debit, 0);
  const filteredTotalCredits = filtered.reduce((s, a) => s + a.total_credit, 0);

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

          <GLSubnav current="/gl/trial-balance" />

          <div className="flex flex-wrap gap-3 mb-4 items-end">
            <div>
              <label className="block text-xs text-gray-500 mb-1">From Date</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">To Date</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Account Type</label>
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
            </div>
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <BarChart3 className="h-3.5 w-3.5" />
              )}
              Generate
            </button>
            <button
              onClick={() => handleExport("xlsx")}
              disabled={!!exporting || loading}
              className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
              title="Export as Excel spreadsheet"
            >
              {exporting === "xlsx" ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-3.5 w-3.5" />
              )}
              Export XLSX
            </button>
            <button
              onClick={() => handleExport("pdf")}
              disabled={!!exporting || loading}
              className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50"
              title="Export as PDF"
            >
              {exporting === "pdf" ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileText className="h-3.5 w-3.5" />
              )}
              Export PDF
            </button>
          </div>

          {error && (
            <p className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          {data && (
            <div
              className={`mb-4 px-4 py-3 rounded-lg flex items-center gap-3 text-sm font-medium ${
                isBalanced
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-amber-50 text-amber-700 border border-amber-200"
              }`}
            >
              <ArrowUpDown className="h-4 w-4" />
              {isBalanced
                ? "Trial balance is balanced — total debits equal total credits"
                : `Out of balance by ${fmt(Math.abs(globalTotalDebits - globalTotalCredits))} (all accounts)`}
              <span className="ml-auto font-normal text-xs text-gray-500">
                {activeAccounts.length} accounts with activity
                {typeFilter !== "ALL" && ` (showing ${filtered.length} filtered)`}
              </span>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-gray-400 text-sm">Loading trial balance…</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No account activity found for this period.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                        Code
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                        Account Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                        Type
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                        Total Debit
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                        Total Credit
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                        Net Balance
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map((a) => (
                      <tr key={a.account_code} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-mono text-indigo-700">
                          {a.account_code}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{a.account_name}</td>
                        <td className="px-4 py-3">
                          <Badge type={a.account_type} />
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm text-gray-700">
                          {fmt(a.total_debit)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm text-gray-700">
                          {fmt(a.total_credit)}
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-mono text-sm font-semibold ${
                            a.net_balance >= 0 ? "text-gray-900" : "text-red-600"
                          }`}
                        >
                          {fmt(a.net_balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-indigo-50 border-t-2 border-indigo-200">
                    <tr>
                      <td colSpan={3} className="px-4 py-3 text-sm font-bold text-indigo-800">
                        {typeFilter === "ALL" ? "Totals (All Accounts)" : `Totals (${typeFilter})`}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm font-bold text-indigo-800">
                        {fmt(filteredTotalDebits)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm font-bold text-indigo-800">
                        {fmt(filteredTotalCredits)}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-mono text-sm font-bold ${
                          typeFilter === "ALL"
                            ? isBalanced ? "text-green-700" : "text-red-600"
                            : "text-indigo-800"
                        }`}
                      >
                        {fmt(filteredTotalDebits - filteredTotalCredits)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
