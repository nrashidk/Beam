import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { apiClient } from "../lib/api";
import {
  BookOpen,
  List,
  BarChart3,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Filter,
} from "lucide-react";

function fmt(val) {
  const n = Number(val) || 0;
  return `AED ${n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

const REF_TYPES = ["", "INVOICE", "INWARD_INVOICE", "PAYMENT", "EXPENSE"];
const LIMIT = 20;

export default function GLJournalEntries() {
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const fmtDate = (d) => d.toISOString().slice(0, 10);

  const [fromDate, setFromDate] = useState(fmtDate(firstOfMonth));
  const [toDate, setToDate] = useState(fmtDate(today));
  const [refType, setRefType] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [entryDetail, setEntryDetail] = useState({});
  const [detailLoading, setDetailLoading] = useState({});

  const load = useCallback(
    async (pg = 1) => {
      setLoading(true);
      setError("");
      try {
        const params = { from_date: fromDate, to_date: toDate, page: pg, limit: LIMIT };
        if (refType) params.reference_type = refType;
        const res = await apiClient.get("/journal-entries", { params });
        setEntries(res.data.journal_entries || []);
        setTotal(res.data.total || 0);
        setPage(pg);
      } catch (e) {
        setError(e.response?.data?.detail || "Failed to load journal entries.");
      } finally {
        setLoading(false);
      }
    },
    [fromDate, toDate, refType],
  );

  useEffect(() => {
    load(1);
  }, [load]);

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

          <GLSubnav current="/gl/journal-entries" />

          <div className="flex flex-wrap gap-3 mb-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">From</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">To</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Reference Type</label>
              <select
                value={refType}
                onChange={(e) => setRefType(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {REF_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t || "All Types"}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => load(1)}
                disabled={loading}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Filter className="h-3.5 w-3.5" />
                )}
                Apply
              </button>
            </div>
          </div>

          {error && (
            <p className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {loading && entries.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">Loading entries…</div>
            ) : entries.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No journal entries found for this period.</p>
              </div>
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
                          <tr
                            key={e.id}
                            className="hover:bg-gray-50 cursor-pointer"
                            onClick={() => toggleEntry(e.id)}
                          >
                            <td className="px-4 py-3 text-gray-400">
                              {expandedId === e.id ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700">{e.entry_date}</td>
                            <td className="px-4 py-3 text-sm font-mono text-indigo-700">
                              {e.reference_number || e.reference_id || "—"}
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium">
                                {e.reference_type}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                              {e.description || "—"}
                            </td>
                            <td className="px-4 py-3">
                              {e.is_posted ? (
                                <span className="text-xs text-green-600 font-medium">Posted</span>
                              ) : (
                                <span className="text-xs text-amber-500">Draft</span>
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
                    Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total}{" "}
                    entries
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => load(page - 1)}
                      disabled={page <= 1 || loading}
                      className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-40"
                    >
                      Prev
                    </button>
                    <span className="px-2 py-1">
                      Page {page} of {totalPages}
                    </span>
                    <button
                      onClick={() => load(page + 1)}
                      disabled={page >= totalPages || loading}
                      className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
