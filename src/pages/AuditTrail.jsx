import React, { useState, useEffect, useCallback } from "react";
import Sidebar from "../components/Sidebar";
import { apiClient } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import {
  Shield,
  ShieldCheck,
  RefreshCw,
  Filter,
  ChevronDown,
  ChevronUp,
  Eye,
  Edit,
  Trash2,
  LogIn,
  Download,
  Plus,
  CheckCircle,
  FileSpreadsheet,
  FileText,
} from "lucide-react";

function actionColor(action) {
  if (!action) return "bg-gray-100 text-gray-600";
  if (action.includes("ISSUED")) return "bg-green-100 text-green-700";
  if (action.includes("PAID")) return "bg-emerald-100 text-emerald-700";
  if (action.includes("CANCELLED")) return "bg-red-100 text-red-700";
  if (action.includes("UPDATED") || action.includes("ARCHIVED") || action.includes("RESTORED"))
    return "bg-blue-100 text-blue-700";
  if (action.includes("GENERATED")) return "bg-purple-100 text-purple-700";
  if (action.includes("DOWNLOADED") || action.includes("PDF")) return "bg-amber-100 text-amber-700";
  if (action.includes("LOGIN")) return "bg-indigo-100 text-indigo-700";
  if (action.includes("PASSWORD")) return "bg-orange-100 text-orange-700";
  return "bg-gray-100 text-gray-600";
}

function actionIcon(action) {
  if (!action) return Shield;
  if (action.includes("ISSUED")) return Plus;
  if (action.includes("PAID")) return CheckCircle;
  if (action.includes("CANCELLED") || action.includes("DELETE")) return Trash2;
  if (action.includes("UPDATED") || action.includes("ARCHIVED") || action.includes("RESTORED")) return Edit;
  if (action.includes("GENERATED")) return Shield;
  if (action.includes("DOWNLOADED") || action.includes("PDF")) return Download;
  if (action.includes("LOGIN")) return LogIn;
  return Eye;
}

function ActionBadge({ action }) {
  const cls = actionColor(action);
  const Icon = actionIcon(action);
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>
      <Icon className="h-3 w-3" />
      {action}
    </span>
  );
}

function JsonDiff({ label, value }) {
  if (!value) return null;
  let parsed = value;
  try {
    if (typeof value === "string") parsed = JSON.parse(value);
  } catch {
    return <div className="text-xs text-gray-500">{value}</div>;
  }
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 mb-1">{label}</p>
      <pre className="text-xs bg-gray-50 border border-gray-200 rounded p-2 overflow-x-auto max-h-40 text-gray-700">
        {JSON.stringify(parsed, null, 2)}
      </pre>
    </div>
  );
}

const RESOURCE_TYPES = [
  "", "invoice", "inward_invoice", "purchase_order", "vat_return",
  "user", "company", "payment", "expense", "audit_file",
];

const KNOWN_ACTIONS = [
  "FAF_GENERATED",
  "INVOICES_ARCHIVED",
  "INVOICE_CANCELLED",
  "INVOICE_ISSUED",
  "INVOICE_PAID",
  "INVOICE_PDF_DOWNLOADED",
  "INVOICE_RESTORED",
  "INVOICE_UPDATED",
  "PASSWORD_CHANGED",
  "BACKUP_VERIFIED",
  "USER_LOGIN",
  "VAT_RETURN_GENERATED",
];

export default function AuditTrail() {
  const { user } = useAuth();
  const isAdmin = user && ["COMPANY_ADMIN", "SUPER_ADMIN", "BUSINESS_ADMIN"].includes(user.role);

  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);
  const fmtDate = (d) => d.toISOString().slice(0, 10);

  const [fromDate, setFromDate] = useState(fmtDate(thirtyDaysAgo));
  const [toDate, setToDate] = useState(fmtDate(today));
  const [action, setAction] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [availableActions, setAvailableActions] = useState(KNOWN_ACTIONS);
  const [exporting, setExporting] = useState(null); // 'csv' | 'xlsx' | null

  const LIMIT = 25;

  // Fetch distinct action values from the backend dedicated endpoint
  useEffect(() => {
    apiClient.get("/audit-logs/actions")
      .then((res) => {
        const dynamic = res.data.actions || [];
        const merged = Array.from(new Set([...KNOWN_ACTIONS, ...dynamic])).sort();
        setAvailableActions(merged);
      })
      .catch(() => {});
  }, []);

  const load = useCallback(async (pg = 1) => {
    setLoading(true);
    setError("");
    try {
      const params = { from_date: fromDate, to_date: toDate, page: pg, limit: LIMIT };
      if (action) params.action = action;
      if (resourceType) params.resource_type = resourceType;
      const res = await apiClient.get("/audit-logs", { params });
      setLogs(res.data.audit_logs || []);
      setTotal(res.data.total || 0);
      setPage(pg);
    } catch (e) {
      setError(e.response?.data?.detail || "Failed to load audit trail.");
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, action, resourceType]);

  useEffect(() => { load(1); }, [load]);

  // Task 23: Download export file (CSV or XLSX) with current filters applied
  const downloadExport = async (fmt) => {
    setExporting(fmt);
    try {
      const params = new URLSearchParams({ format: fmt });
      if (fromDate) params.append("from_date", fromDate);
      if (toDate) params.append("to_date", toDate);
      if (action) params.append("action", action);
      if (resourceType) params.append("resource_type", resourceType);

      const response = await apiClient.get(`/audit-logs/export?${params.toString()}`, {
        responseType: "blob",
      });

      const ext = fmt === "xlsx" ? "xlsx" : "csv";
      const contentDisposition = response.headers["content-disposition"] || "";
      const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
      const filename = filenameMatch ? filenameMatch[1] : `audit_log.${ext}`;

      const url = URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      // Blob responses don't have a parsed JSON body — parse it manually
      if (e.response?.data instanceof Blob) {
        try {
          const text = await e.response.data.text();
          const parsed = JSON.parse(text);
          setError(parsed.detail || `Failed to export audit log as ${fmt.toUpperCase()}.`);
        } catch {
          setError(`Failed to export audit log as ${fmt.toUpperCase()}.`);
        }
      } else {
        setError(e.response?.data?.detail || `Failed to export audit log as ${fmt.toUpperCase()}.`);
      }
    } finally {
      setExporting(null);
    }
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 ml-64 flex flex-col">
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-6 w-6 text-indigo-600 flex-shrink-0" />
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Audit Trail</h1>
              <p className="text-sm text-gray-500 mt-0.5">Immutable log of all create, update, and delete actions — FTA compliance requirement</p>
            </div>
          </div>
        </div>
        <div className="flex-1 p-6">
        <div className="max-w-6xl mx-auto">
          {/* Filters */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
            <div className="flex flex-wrap gap-3 items-end">
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
                <label className="block text-xs text-gray-500 mb-1">Action</label>
                <select value={action} onChange={(e) => setAction(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">All Actions</option>
                  {availableActions.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Resource Type</label>
                <select value={resourceType} onChange={(e) => setResourceType(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {RESOURCE_TYPES.map((r) => (
                    <option key={r} value={r}>{r || "All Resources"}</option>
                  ))}
                </select>
              </div>
              <button onClick={() => load(1)} disabled={loading}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Filter className="h-3.5 w-3.5" />}
                Apply Filter
              </button>

              {/* Task 23: Export buttons — only shown to admin roles */}
              {isAdmin && (
                <div className="ml-auto flex items-end gap-2">
                  <button
                    onClick={() => downloadExport("csv")}
                    disabled={exporting === "csv" || loading}
                    className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 text-gray-700 bg-white rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 transition-colors"
                    title="Download filtered audit log as CSV"
                  >
                    {exporting === "csv"
                      ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      : <FileText className="h-3.5 w-3.5" />}
                    CSV
                  </button>
                  <button
                    onClick={() => downloadExport("xlsx")}
                    disabled={exporting === "xlsx" || loading}
                    className="flex items-center gap-1.5 px-4 py-2 border border-green-400 text-green-700 bg-white rounded-lg text-sm hover:bg-green-50 disabled:opacity-50 transition-colors"
                    title="Download filtered audit log as XLSX"
                  >
                    {exporting === "xlsx"
                      ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      : <FileSpreadsheet className="h-3.5 w-3.5" />}
                    XLSX
                  </button>
                </div>
              )}
            </div>
          </div>

          {error && (
            <p className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          {/* Summary */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-500">
              <span className="font-medium text-gray-800">{total}</span> log entries
            </p>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {loading && logs.length === 0 ? (
              <div className="p-10 text-center text-gray-400 text-sm">Loading audit logs…</div>
            ) : logs.length === 0 ? (
              <div className="p-10 text-center">
                <Shield className="h-10 w-10 mx-auto mb-3 text-gray-200" />
                <p className="text-sm text-gray-400">No audit events found for these filters.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-8"></th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Timestamp</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">User</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Action</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Resource</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Resource ID</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {logs.map((log) => {
                        const expanded = expandedId === log.id;
                        const hasDetails = log.old_value || log.new_value;
                        return (
                          <React.Fragment key={log.id}>
                            <tr
                              className={`hover:bg-gray-50 ${hasDetails ? "cursor-pointer" : ""}`}
                              onClick={() => hasDetails && setExpandedId(expanded ? null : log.id)}
                            >
                              <td className="px-4 py-3 text-gray-300 w-8">
                                {hasDetails && (
                                  expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                                )}
                              </td>
                              <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                                {log.created_at
                                  ? new Date(log.created_at).toLocaleString("en-AE", { dateStyle: "short", timeStyle: "medium" })
                                  : "—"}
                              </td>
                              <td className="px-4 py-3 text-xs text-gray-600 max-w-[140px] truncate" title={log.user_email || log.user_id}>
                                {log.user_email || <span className="text-gray-400">—</span>}
                              </td>
                              <td className="px-4 py-3">
                                <ActionBadge action={log.action} />
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600 capitalize">
                                {log.resource_type?.replace("_", " ") || "—"}
                              </td>
                              <td className="px-4 py-3 text-xs font-mono text-indigo-600 max-w-[120px] truncate">
                                {log.resource_id || "—"}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                                {log.description || "—"}
                              </td>
                            </tr>
                            {expanded && hasDetails && (
                              <tr>
                                <td colSpan={7} className="px-6 py-4 bg-indigo-50 border-t border-indigo-100">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <JsonDiff label="Before (old_value)" value={log.old_value} />
                                    <JsonDiff label="After (new_value)" value={log.new_value} />
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                  <span>
                    {total > 0
                      ? `Showing ${(page - 1) * LIMIT + 1}–${Math.min(page * LIMIT, total)} of ${total} events`
                      : "No events"}
                  </span>
                  <div className="flex gap-2">
                    <button onClick={() => load(page - 1)} disabled={page <= 1 || loading}
                      className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-40">
                      Prev
                    </button>
                    <span className="px-2 py-1">Page {page} of {Math.max(1, totalPages)}</span>
                    <button onClick={() => load(page + 1)} disabled={page >= totalPages || loading}
                      className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-40">
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* FTA compliance note */}
          <div className="mt-6 bg-indigo-50 rounded-xl border border-indigo-100 px-5 py-4 text-sm text-indigo-700">
            <strong>FTA Compliance:</strong> This audit trail is retained for 5 years as required by UAE VAT regulations.
            All entries are immutable — modifications are not permitted after creation.
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
