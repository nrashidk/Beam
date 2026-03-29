import { useState, useEffect, useRef } from "react";
import { Archive, Download, RotateCcw, AlertTriangle, CheckCircle, ShieldCheck, ShieldX, Upload } from "lucide-react";
import Sidebar from "../components/Sidebar";
import BackToDashboard from "../components/BackToDashboard";
import { apiClient } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";

export default function DataArchival() {
  const { user } = useAuth();
  const canExportArchive = user?.role === "SUPER_ADMIN" || user?.role === "COMPANY_ADMIN";
  const [archivedInvoices, setArchivedInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [archiving, setArchiving] = useState(false);
  const [restoringId, setRestoringId] = useState(null);
  const [yearsOld, setYearsOld] = useState(5);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [archivalStatus, setArchivalStatus] = useState(null);

  const [fafVerifyFile, setFafVerifyFile] = useState(null);
  const [fafVerifying, setFafVerifying] = useState(false);
  const [fafVerifyResult, setFafVerifyResult] = useState(null);
  const [fafVerifyError, setFafVerifyError] = useState(null);
  const fafFileInputRef = useRef(null);

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

  const [exporting, setExporting] = useState(false);

  const handleExportXlsx = async () => {
    setExporting(true);
    setError(null);
    try {
      const res = await apiClient.get("/invoices/archive/export", { params: { format: "xlsx" }, responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = "archived_invoices.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError("Failed to export archived invoices.");
    } finally {
      setExporting(false);
    }
  };

  const fmt = (n) =>
    typeof n === "number"
      ? n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : "0.00";

  const handleVerifyFAF = async () => {
    if (!fafVerifyFile) return;
    setFafVerifying(true);
    setFafVerifyResult(null);
    setFafVerifyError(null);
    try {
      const formData = new FormData();
      formData.append("file", fafVerifyFile);
      const res = await apiClient.post("/audit-files/verify", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setFafVerifyResult(res.data);
    } catch (err) {
      setFafVerifyError(err.response?.data?.detail || "Verification failed. Please try again.");
    } finally {
      setFafVerifying(false);
    }
  };

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

          {/* FAF Integrity Verification */}
          <div className="bg-white rounded-xl border p-5 mb-6">
            <h2 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-indigo-600" />
              Verify FAF Integrity
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Upload a previously exported FAF <strong>.zip</strong> file to confirm its SHA-256 hash matches
              the embedded checksum — ensuring the file has not been tampered with since export.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={fafFileInputRef}
                type="file"
                accept=".zip"
                className="hidden"
                onChange={(e) => {
                  setFafVerifyFile(e.target.files?.[0] || null);
                  setFafVerifyResult(null);
                  setFafVerifyError(null);
                }}
              />
              <button
                onClick={() => fafFileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                <Upload className="h-4 w-4" />
                {fafVerifyFile ? fafVerifyFile.name : "Choose FAF .zip…"}
              </button>
              <button
                onClick={handleVerifyFAF}
                disabled={!fafVerifyFile || fafVerifying}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                <ShieldCheck className="h-4 w-4" />
                {fafVerifying ? "Verifying…" : "Verify Integrity"}
              </button>
            </div>

            {fafVerifyError && (
              <div className="mt-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                <ShieldX className="h-4 w-4 flex-shrink-0 mt-0.5" />
                {fafVerifyError}
              </div>
            )}

            {fafVerifyResult && (
              <div className={`mt-4 rounded-lg border px-4 py-3 text-sm ${fafVerifyResult.valid ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"}`}>
                <div className="flex items-center gap-2 font-semibold mb-2">
                  {fafVerifyResult.valid
                    ? <><ShieldCheck className="h-4 w-4" /> Integrity Verified — File is authentic</>
                    : <><ShieldX className="h-4 w-4" /> Hash Mismatch — File may have been tampered with</>
                  }
                </div>
                <div className="space-y-1 font-mono text-xs break-all opacity-80">
                  <div><span className="font-sans font-medium not-italic">Expected:&nbsp;</span>{fafVerifyResult.expected_hash}</div>
                  <div><span className="font-sans font-medium not-italic">Computed:&nbsp;</span>{fafVerifyResult.computed_hash}</div>
                  <div><span className="font-sans font-medium not-italic">File:&nbsp;</span><span className="font-sans">{fafVerifyResult.csv_filename}</span></div>
                </div>
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
              {archivedInvoices.length > 0 && canExportArchive && (
                <button
                  onClick={handleExportXlsx}
                  disabled={exporting}
                  className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-50"
                >
                  <Download className="h-4 w-4" />
                  {exporting ? "Exporting..." : "Export XLSX"}
                </button>
              )}
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
