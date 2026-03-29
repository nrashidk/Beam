import { useState, useEffect, useCallback } from "react";
import Sidebar from "../components/Sidebar";
import { apiClient } from "../lib/api";
import {
  BookOpen,
  List,
  BarChart3,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Search,
  Filter,
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

function EmptyState({ message }) {
  return (
    <div className="text-center py-12 text-gray-400">
      <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

// ───────────────────────────────────────
// Tab 1: Chart of Accounts
// ───────────────────────────────────────
function ChartOfAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiClient.get("/accounts");
      setAccounts(res.data.accounts || []);
    } catch (e) {
      setError(e.response?.data?.detail || "Failed to load chart of accounts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const types = ["ALL", ...Array.from(new Set(accounts.map((a) => a.account_type)))];

  const filtered = accounts.filter((a) => {
    const matchType = typeFilter === "ALL" || a.account_type === typeFilter;
    const matchSearch =
      !search ||
      a.account_code.toLowerCase().includes(search.toLowerCase()) ||
      a.account_name.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  return (
    <div>
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

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading accounts…</div>
        ) : filtered.length === 0 ? (
          <EmptyState message="No accounts found." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Code</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Account Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">System</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-mono text-indigo-700 font-medium">{a.account_code}</td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-900 font-medium">{a.account_name}</p>
                      {a.account_name_ar && (
                        <p className="text-xs text-gray-400 font-arabic" dir="rtl">{a.account_name_ar}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge type={a.account_type} />
                    </td>
                    <td className="px-4 py-3">
                      {a.is_system ? (
                        <span className="text-xs text-gray-400">System</span>
                      ) : (
                        <span className="text-xs text-indigo-500">Custom</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-400">
              Showing {filtered.length} of {accounts.length} accounts
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ───────────────────────────────────────
// Tab 2: Journal Entries
// ───────────────────────────────────────
function JournalEntries() {
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const fmtDate = (d) => d.toISOString().slice(0, 10);

  const [fromDate, setFromDate] = useState(fmtDate(firstOfMonth));
  const [toDate, setToDate] = useState(fmtDate(today));
  const [refType, setRefType] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [entryDetail, setEntryDetail] = useState({});
  const [detailLoading, setDetailLoading] = useState({});
  const [exporting, setExporting] = useState("");

  const LIMIT = 20;

  const handleExport = useCallback(async (format) => {
    setExporting(format);
    try {
      const params = { format, from_date: fromDate, to_date: toDate };
      if (refType) params.reference_type = refType;
      const res = await apiClient.get("/reports/general-ledger/export", {
        params,
        responseType: "blob",
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `general_ledger_${fromDate}_${toDate}.${format}`;
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
  }, [fromDate, toDate, refType]);

  const load = useCallback(async (pg = 1) => {
    setLoading(true);
    setError("");
    try {
      const params = { from_date: fromDate, to_date: toDate, page: pg, limit: LIMIT };
      if (refType) params.reference_type = refType;
      if (includeArchived) params.include_archived = true;
      const res = await apiClient.get("/journal-entries", { params });
      setEntries(res.data.journal_entries || []);
      setTotal(res.data.total || 0);
      setPage(pg);
    } catch (e) {
      setError(e.response?.data?.detail || "Failed to load journal entries.");
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, refType, includeArchived]);

  useEffect(() => { load(1); }, [load]);

  async function toggleEntry(id) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (entryDetail[id]) return;
    setDetailLoading((p) => ({ ...p, [id]: true }));
    try {
      const res = await apiClient.get(`/journal-entries/${id}`);
      setEntryDetail((p) => ({ ...p, [id]: res.data }));
    } catch {
      // ignore
    } finally {
      setDetailLoading((p) => ({ ...p, [id]: false }));
    }
  }

  const totalPages = Math.ceil(total / LIMIT);
  const REF_TYPES = ["", "INVOICE", "INWARD_INVOICE", "PAYMENT", "EXPENSE"];

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">From</label>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">To</label>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Type</label>
          <select value={refType} onChange={(e) => setRefType(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            {REF_TYPES.map((t) => (
              <option key={t} value={t}>{t || "All Types"}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600 select-none">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            Include Archived
          </label>
        </div>
        <div className="flex items-end gap-2">
          <button onClick={() => load(1)} disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">
            {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Filter className="h-3.5 w-3.5" />}
            Apply
          </button>
          <button onClick={() => handleExport("xlsx")} disabled={!!exporting || loading}
            className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
            title="Export as Excel spreadsheet">
            {exporting === "xlsx" ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
            Export XLSX
          </button>
          <button onClick={() => handleExport("pdf")} disabled={!!exporting || loading}
            className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50"
            title="Export as PDF">
            {exporting === "pdf" ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
            Export PDF
          </button>
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading && entries.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading entries…</div>
        ) : entries.length === 0 ? (
          <EmptyState message="No journal entries found for this period." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-8"></th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Reference</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Description</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Posted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {entries.map((e) => (
                    <>
                      <tr key={e.id}
                        className={`cursor-pointer ${e.is_archived ? "bg-gray-50 opacity-60 hover:opacity-80" : "hover:bg-gray-50"}`}
                        onClick={() => toggleEntry(e.id)}>
                        <td className="px-4 py-3 text-gray-400">
                          {expandedId === e.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{e.entry_date}</td>
                        <td className="px-4 py-3 text-sm font-mono text-indigo-700">{e.reference_number || e.reference_id || "—"}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium">
                            {e.reference_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{e.description || "—"}</td>
                        <td className="px-4 py-3 flex items-center gap-2">
                          {e.is_posted ? (
                            <span className="text-xs text-green-600 font-medium">Posted</span>
                          ) : (
                            <span className="text-xs text-amber-500">Draft</span>
                          )}
                          {e.is_archived && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-gray-200 text-gray-500 font-medium">Archived</span>
                          )}
                        </td>
                      </tr>
                      {expandedId === e.id && (
                        <tr key={`${e.id}-detail`}>
                          <td colSpan={6} className="px-6 py-4 bg-indigo-50 border-t border-indigo-100">
                            {detailLoading[e.id] ? (
                              <p className="text-sm text-gray-400">Loading lines…</p>
                            ) : entryDetail[e.id] ? (
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="text-xs text-gray-500 uppercase">
                                    <th className="text-left pb-1">Account Code</th>
                                    <th className="text-left pb-1">Account Name</th>
                                    <th className="text-left pb-1">Description</th>
                                    <th className="text-right pb-1">Debit (AED)</th>
                                    <th className="text-right pb-1">Credit (AED)</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-indigo-100">
                                  {entryDetail[e.id].lines?.map((l) => (
                                    <tr key={l.id}>
                                      <td className="py-1 font-mono text-indigo-700">{l.account_code}</td>
                                      <td className="py-1">{l.account_name}</td>
                                      <td className="py-1 text-gray-500">{l.description || "—"}</td>
                                      <td className="py-1 text-right font-mono">
                                        {l.debit_amount > 0 ? fmt(l.debit_amount) : "—"}
                                      </td>
                                      <td className="py-1 text-right font-mono">
                                        {l.credit_amount > 0 ? fmt(l.credit_amount) : "—"}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : (
                              <p className="text-sm text-gray-400">No lines available.</p>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
              <span>
                Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total} entries
              </span>
              <div className="flex gap-2">
                <button onClick={() => load(page - 1)} disabled={page <= 1 || loading}
                  className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-40">
                  Prev
                </button>
                <span className="px-2 py-1">Page {page} of {totalPages}</span>
                <button onClick={() => load(page + 1)} disabled={page >= totalPages || loading}
                  className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-40">
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ───────────────────────────────────────
// Tab 3: Trial Balance (GL Summary)
// ───────────────────────────────────────
function TrialBalance() {
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
      const res = await apiClient.get("/gl-summary", { params: { from_date: fromDate, to_date: toDate } });
      setData(res.data);
    } catch (e) {
      setError(e.response?.data?.detail || "Failed to load trial balance.");
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => { load(); }, [load]);

  const accounts = data?.accounts || [];
  const types = ["ALL", ...Array.from(new Set(accounts.map((a) => a.account_type)))];
  const filtered = accounts.filter((a) => {
    const matchType = typeFilter === "ALL" || a.account_type === typeFilter;
    const hasActivity = a.total_debit !== 0 || a.total_credit !== 0;
    return matchType && hasActivity;
  });

  const totalDebits = filtered.reduce((s, a) => s + a.total_debit, 0);
  const totalCredits = filtered.reduce((s, a) => s + a.total_credit, 0);
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-4 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">From Date</label>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">To Date</label>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Account Type</label>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            {types.map((t) => (
              <option key={t} value={t}>{t === "ALL" ? "All Types" : t}</option>
            ))}
          </select>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">
          {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <BarChart3 className="h-3.5 w-3.5" />}
          Generate
        </button>
        <button onClick={() => handleExport("xlsx")} disabled={!!exporting || loading}
          className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
          title="Export as Excel spreadsheet">
          {exporting === "xlsx" ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
          Export XLSX
        </button>
        <button onClick={() => handleExport("pdf")} disabled={!!exporting || loading}
          className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50"
          title="Export as PDF">
          {exporting === "pdf" ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
          Export PDF
        </button>
      </div>

      {error && <p className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      {data && (
        <div className={`mb-4 px-4 py-3 rounded-lg flex items-center gap-3 text-sm font-medium ${
          isBalanced ? "bg-green-50 text-green-700 border border-green-200" : "bg-amber-50 text-amber-700 border border-amber-200"
        }`}>
          <ArrowUpDown className="h-4 w-4" />
          {isBalanced ? "Trial balance is balanced" : `Out of balance by ${fmt(Math.abs(totalDebits - totalCredits))}`}
          <span className="ml-auto font-normal text-xs text-gray-500">
            Showing {filtered.length} accounts with activity
          </span>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading trial balance…</div>
        ) : filtered.length === 0 ? (
          <EmptyState message="No account activity found for this period." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Code</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Account Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Total Debit</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Total Credit</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Net Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((a) => (
                  <tr key={a.account_code} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-mono text-indigo-700">{a.account_code}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{a.account_name}</td>
                    <td className="px-4 py-3"><Badge type={a.account_type} /></td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-gray-700">{fmt(a.total_debit)}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-gray-700">{fmt(a.total_credit)}</td>
                    <td className={`px-4 py-3 text-right font-mono text-sm font-semibold ${
                      a.net_balance >= 0 ? "text-gray-900" : "text-red-600"
                    }`}>
                      {fmt(a.net_balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-indigo-50 border-t-2 border-indigo-200">
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-sm font-bold text-indigo-800">Totals</td>
                  <td className="px-4 py-3 text-right font-mono text-sm font-bold text-indigo-800">{fmt(totalDebits)}</td>
                  <td className="px-4 py-3 text-right font-mono text-sm font-bold text-indigo-800">{fmt(totalCredits)}</td>
                  <td className={`px-4 py-3 text-right font-mono text-sm font-bold ${
                    isBalanced ? "text-green-700" : "text-red-600"
                  }`}>
                    {fmt(totalDebits - totalCredits)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ───────────────────────────────────────
// Main Page
// ───────────────────────────────────────
const TABS = [
  { id: "chart", label: "Chart of Accounts", icon: List },
  { id: "journal", label: "Journal Entries", icon: BookOpen },
  { id: "trial", label: "Trial Balance", icon: BarChart3 },
];

export default function GeneralLedger() {
  const [activeTab, setActiveTab] = useState("chart");

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 ml-64 p-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <BookOpen className="h-8 w-8 text-indigo-600" />
              <h1 className="text-3xl font-bold text-gray-900">General Ledger</h1>
            </div>
            <p className="text-gray-500">Chart of accounts, double-entry journal entries, and trial balance</p>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 mb-6">
            <nav className="flex gap-1">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === tab.id
                        ? "border-indigo-600 text-indigo-600"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Tab Content */}
          {activeTab === "chart" && <ChartOfAccounts />}
          {activeTab === "journal" && <JournalEntries />}
          {activeTab === "trial" && <TrialBalance />}
        </div>
      </div>
    </div>
  );
}
