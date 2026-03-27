import { useState, useEffect } from "react";
import { Archive, RotateCcw, AlertTriangle, CheckCircle } from "lucide-react";
import Sidebar from "../components/Sidebar";
import BackToDashboard from "../components/BackToDashboard";
import { apiClient } from "../lib/api";

export default function DataArchival() {
  const [archivedInvoices, setArchivedInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [archiving, setArchiving] = useState(false);
  const [restoringId, setRestoringId] = useState(null);
  const [yearsOld, setYearsOld] = useState(5);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [archivalStatus, setArchivalStatus] = useState(null);

  const fetchArchived = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get("/invoices/archived");
      setArchivedInvoices(res.data);
    } catch (err) {
      setError(
        err.response?.data?.detail || "Failed to load archived invoices."
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchStatus = async () => {
    try {
      const res = await apiClient.get("/invoices/archive/status", { params: { years_old: 5 } });
      setArchivalStatus(res.data);
    } catch (_) {}
  };

  useEffect(() => {
    fetchArchived();
    fetchStatus();
  }, []);

  const handleArchive = async () => {
    if (
      !window.confirm(
        `This will archive all paid/cancelled invoices issued more than ${yearsOld} year(s) ago. Continue?`
      )
    )
      return;
    setArchiving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await apiClient.post(`/invoices/archive?years_old=${yearsOld}`);
      setMessage(res.data.message);
      await Promise.all([fetchArchived(), fetchStatus()]);
    } catch (err) {
      setError(
        err.response?.data?.detail || "Failed to run archival. Please try again."
      );
    } finally {
      setArchiving(false);
    }
  };

  const handleRestore = async (invoiceId, invoiceNumber) => {
    if (!window.confirm(`Restore invoice ${invoiceNumber}?`)) return;
    setRestoringId(invoiceId);
    setMessage(null);
    setError(null);
    try {
      const res = await apiClient.post(`/invoices/${invoiceId}/restore`);
      setMessage(res.data.message);
      setArchivedInvoices((prev) => prev.filter((inv) => inv.id !== invoiceId));
    } catch (err) {
      setError(
        err.response?.data?.detail || "Failed to restore invoice."
      );
    } finally {
      setRestoringId(null);
    }
  };

  const fmt = (n) =>
    typeof n === "number"
      ? n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : "0.00";

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <div className="bg-white border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <BackToDashboard />
            <div>
              <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <Archive className="h-5 w-5 text-amber-600" />
                Data Archival & Restoration
              </h1>
              <p className="text-sm text-gray-500">
                Archive old invoices for FTA compliance; restore them for audit access
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 max-w-5xl mx-auto w-full">
          {/* Archival status banner */}
          {archivalStatus && archivalStatus.eligible_for_archival > 0 && (
            <div className="mb-5 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <span className="font-semibold">{archivalStatus.eligible_for_archival} invoice(s)</span> issued before{" "}
                <span className="font-medium">{archivalStatus.cutoff_date}</span> are eligible for archival (FTA 5-year
                retention policy). Run archival below to comply.
              </div>
            </div>
          )}
          {archivalStatus && archivalStatus.eligible_for_archival === 0 && (
            <div className="mb-5 flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
              <p className="text-sm text-green-800">
                Archival is up to date — no invoices older than 5 years require archiving.
              </p>
            </div>
          )}

          {/* Archive action */}
          <div className="bg-white rounded-xl border p-5 mb-6">
            <h2 className="font-semibold text-gray-900 mb-1">Run Archival</h2>
            <p className="text-sm text-gray-500 mb-4">
              Moves all <strong>paid</strong> or <strong>cancelled</strong>{" "}
              invoices older than the specified age to the archive. Archived invoices
              are hidden from daily lists but remain accessible here for audit.
            </p>
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700">Archive invoices older than</label>
              <select
                value={yearsOld}
                onChange={(e) => setYearsOld(Number(e.target.value))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
              >
                {[1, 2, 3, 4, 5, 7, 10].map((y) => (
                  <option key={y} value={y}>
                    {y} year{y !== 1 ? "s" : ""}
                  </option>
                ))}
              </select>
              <button
                onClick={handleArchive}
                disabled={archiving}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-medium disabled:opacity-50"
              >
                <Archive className="h-4 w-4" />
                {archiving ? "Archiving..." : "Run Archival"}
              </button>
            </div>

            {message && (
              <div className="mt-4 flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm">
                <CheckCircle className="h-4 w-4 flex-shrink-0" />
                {message}
              </div>
            )}
            {error && (
              <div className="mt-4 flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}
          </div>

          {/* Archived invoices list */}
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">
                Archived Invoices
                {archivedInvoices.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    ({archivedInvoices.length})
                  </span>
                )}
              </h3>
            </div>

            {loading ? (
              <div className="text-center py-10 text-gray-400 text-sm">Loading...</div>
            ) : archivedInvoices.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Archive className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No archived invoices yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="text-left px-5 py-3 font-medium text-gray-600">Invoice #</th>
                      <th className="text-left px-5 py-3 font-medium text-gray-600">Type</th>
                      <th className="text-left px-5 py-3 font-medium text-gray-600">Customer</th>
                      <th className="text-left px-5 py-3 font-medium text-gray-600">Issue Date</th>
                      <th className="text-right px-5 py-3 font-medium text-gray-600">Total (AED)</th>
                      <th className="text-left px-5 py-3 font-medium text-gray-600">Archived At</th>
                      <th className="px-5 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {archivedInvoices.map((inv) => (
                      <tr key={inv.id} className="border-b hover:bg-gray-50">
                        <td className="px-5 py-3 font-mono text-gray-900">{inv.invoice_number}</td>
                        <td className="px-5 py-3 text-gray-600">{inv.invoice_type}</td>
                        <td className="px-5 py-3 text-gray-700">{inv.customer_name}</td>
                        <td className="px-5 py-3 text-gray-600">{inv.issue_date}</td>
                        <td className="px-5 py-3 text-right text-gray-900">{fmt(inv.total_amount)}</td>
                        <td className="px-5 py-3 text-gray-500 text-xs">
                          {inv.archived_at ? new Date(inv.archived_at).toLocaleDateString() : "-"}
                        </td>
                        <td className="px-5 py-3">
                          <button
                            onClick={() => handleRestore(inv.id, inv.invoice_number)}
                            disabled={restoringId === inv.id}
                            className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-blue-700 border border-blue-300 rounded-lg hover:bg-blue-50 disabled:opacity-50"
                          >
                            <RotateCcw className="h-3 w-3" />
                            {restoringId === inv.id ? "Restoring..." : "Restore"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
