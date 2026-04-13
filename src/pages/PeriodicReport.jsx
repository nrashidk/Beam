import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  CalendarDays,
  Download,
  FileText,
  TrendingUp,
  FileSpreadsheet,
  Search,
} from "lucide-react";
import Sidebar from "../components/Sidebar";
import { apiClient } from "../lib/api";

const MONTHS = [
  "January", "February", "March", "April",
  "May", "June", "July", "August",
  "September", "October", "November", "December",
];

const QUARTERS = ["Q1 (Jan–Mar)", "Q2 (Apr–Jun)", "Q3 (Jul–Sep)", "Q4 (Oct–Dec)"];

const currentYear = new Date().getFullYear();

function getISOWeekData(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const isoWeek = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return { isoYear: date.getUTCFullYear(), isoWeek };
}

function getISOWeeksInYear(year) {
  return getISOWeekData(new Date(year, 11, 28)).isoWeek;
}

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function thirtyDaysAgoISO() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function ReportSummaryTable({ report, fmt }) {
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Invoices", value: report.summary.count },
          { label: "Net Amount (AED)", value: fmt(report.summary.subtotal) },
          { label: "VAT Collected (AED)", value: fmt(report.summary.tax_amount) },
          { label: "Gross Total (AED)", value: fmt(report.summary.total_amount) },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-xl border p-4">
            <p className="text-xs font-medium text-gray-500 mb-1">{card.label}</p>
            <p className="text-xl font-bold text-gray-900">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-600" />
            Breakdown by Invoice Type
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left px-5 py-3 font-medium text-gray-600">Invoice Type</th>
                <th className="text-right px-5 py-3 font-medium text-gray-600">Count</th>
                <th className="text-right px-5 py-3 font-medium text-gray-600">Net (AED)</th>
                <th className="text-right px-5 py-3 font-medium text-gray-600">VAT (AED)</th>
                <th className="text-right px-5 py-3 font-medium text-gray-600">Gross (AED)</th>
              </tr>
            </thead>
            <tbody>
              {report.breakdown_by_type.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-gray-400">
                    No invoices found for this period.
                  </td>
                </tr>
              ) : (
                report.breakdown_by_type.map((row) => (
                  <tr key={row.invoice_type_code} className="border-b hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900">
                      {row.invoice_type_label}
                      <span className="ml-2 text-xs text-gray-400">({row.invoice_type_code})</span>
                    </td>
                    <td className="px-5 py-3 text-right text-gray-700">{row.count}</td>
                    <td className="px-5 py-3 text-right text-gray-700">{fmt(row.subtotal)}</td>
                    <td className="px-5 py-3 text-right text-gray-700">{fmt(row.tax_amount)}</td>
                    <td className="px-5 py-3 text-right font-semibold text-gray-900">
                      {fmt(row.total_amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="bg-blue-50 font-semibold">
                <td className="px-5 py-3 text-gray-900">Total</td>
                <td className="px-5 py-3 text-right text-gray-900">{report.summary.count}</td>
                <td className="px-5 py-3 text-right text-gray-900">{fmt(report.summary.subtotal)}</td>
                <td className="px-5 py-3 text-right text-gray-900">{fmt(report.summary.tax_amount)}</td>
                <td className="px-5 py-3 text-right text-blue-700 text-base">{fmt(report.summary.total_amount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      <p className="text-xs text-gray-400 text-right mt-3">
        Generated at: {new Date(report.generated_at).toLocaleString()}
      </p>
    </>
  );
}

export default function PeriodicReport() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("periodic");

  const [periodType, setPeriodType] = useState("monthly");
  const [year, setYear] = useState(currentYear);
  const [period, setPeriod] = useState(new Date().getMonth() + 1);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(null);

  const [adhocFrom, setAdhocFrom] = useState(thirtyDaysAgoISO());
  const [adhocTo, setAdhocTo] = useState(todayISO());
  const [adhocType, setAdhocType] = useState("all");
  const [adhocReport, setAdhocReport] = useState(null);
  const [adhocLoading, setAdhocLoading] = useState(false);
  const [adhocError, setAdhocError] = useState(null);
  const [adhocExporting, setAdhocExporting] = useState(null);

  const weeksInYear = getISOWeeksInYear(year);
  const WEEKS = Array.from({ length: weeksInYear }, (_, i) => i + 1);

  const isoCurrentYear = getISOWeekData(new Date()).isoYear;
  const baseYears = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const YEARS =
    periodType === "weekly" && !baseYears.includes(isoCurrentYear)
      ? [isoCurrentYear, ...baseYears].sort((a, b) => b - a)
      : baseYears;

  useEffect(() => {
    if (periodType === "monthly") {
      setPeriod(new Date().getMonth() + 1);
    } else if (periodType === "quarterly") {
      setPeriod(Math.floor(new Date().getMonth() / 3) + 1);
    } else if (periodType === "weekly") {
      const { isoYear, isoWeek } = getISOWeekData(new Date());
      setYear(isoYear);
      setPeriod(isoWeek);
    } else {
      setPeriod(1);
    }
  }, [periodType]);

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { period_type: periodType, year };
      if (periodType !== "annual") params.period = period;
      const res = await apiClient.get("/reports/periodic", { params });
      setReport(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load report. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const fmt = (n) =>
    typeof n === "number"
      ? n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : "0.00";

  const handleExportCSV = () => {
    if (!report) return;
    const rows = [
      ["Period", report.period_label],
      ["Generated At", report.generated_at],
      [],
      ["Invoice Type", "Count", "Net (AED)", "VAT (AED)", "Gross (AED)"],
      ...report.breakdown_by_type.map((row) => [
        row.invoice_type_label,
        row.count,
        row.subtotal,
        row.tax_amount,
        row.total_amount,
      ]),
      [],
      ["TOTAL", report.summary.count, report.summary.subtotal, report.summary.tax_amount, report.summary.total_amount],
    ];
    const csvContent =
      "data:text/csv;charset=utf-8," + rows.map((r) => r.join(",")).join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `periodic_report_${report.period_label.replace(/\s/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportFile = async (fmt) => {
    setExporting(fmt);
    try {
      const params = { period_type: periodType, year, format: fmt };
      if (periodType !== "annual") params.period = period;
      const res = await apiClient.get("/reports/periodic/export", { params, responseType: "blob" });
      const mimeType =
        fmt === "xlsx"
          ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          : "application/pdf";
      const blob = new Blob([res.data], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const label = report?.period_label?.replace(/[\s,]/g, "_") || "report";
      link.href = url;
      link.download = `periodic_report_${label}.${fmt}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(`Failed to export ${fmt.toUpperCase()}. Please try again.`);
    } finally {
      setExporting(null);
    }
  };

  const periodLabel = () => {
    if (periodType === "monthly") return "Month";
    if (periodType === "quarterly") return "Quarter";
    if (periodType === "weekly") return "ISO Week";
    return null;
  };

  const periodOptions = () => {
    if (periodType === "monthly") return MONTHS.map((m, i) => ({ value: i + 1, label: m }));
    if (periodType === "quarterly") return QUARTERS.map((q, i) => ({ value: i + 1, label: q }));
    if (periodType === "weekly") return WEEKS.map((w) => ({ value: w, label: `Week ${w}` }));
    return [];
  };

  const fetchAdhocReport = async () => {
    if (!adhocFrom || !adhocTo) {
      setAdhocError("Please select both a start date and end date.");
      return;
    }
    setAdhocLoading(true);
    setAdhocError(null);
    try {
      const res = await apiClient.get("/reports/adhoc", {
        params: { from_date: adhocFrom, to_date: adhocTo, type: adhocType },
      });
      setAdhocReport(res.data);
    } catch (err) {
      setAdhocError(err.response?.data?.detail || "Failed to load report. Please try again.");
    } finally {
      setAdhocLoading(false);
    }
  };

  const handleAdhocExport = async (format) => {
    if (!adhocFrom || !adhocTo) return;
    setAdhocExporting(format);
    try {
      const res = await apiClient.get("/reports/adhoc/export", {
        params: { from_date: adhocFrom, to_date: adhocTo, type: adhocType, format },
        responseType: "blob",
      });
      let mimeType = "text/csv";
      if (format === "xlsx") mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      if (format === "pdf") mimeType = "application/pdf";
      const blob = new Blob([res.data], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `adhoc_report_${adhocFrom}_${adhocTo}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setAdhocError(`Failed to export ${format.toUpperCase()}. Please try again.`);
    } finally {
      setAdhocExporting(null);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 ml-64 flex flex-col">
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <CalendarDays className="h-6 w-6 text-indigo-600 flex-shrink-0" />
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Periodic Report</h1>
              <p className="text-sm text-gray-500 mt-0.5">Periodic &amp; ad hoc invoice summaries for FTA compliance</p>
            </div>
          </div>
        </div>

        <div className="p-6 max-w-5xl mx-auto w-full">
          {/* Tabs */}
          <div className="flex border-b mb-6">
            <button
              onClick={() => setActiveTab("periodic")}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === "periodic"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Periodic Report
            </button>
            <button
              onClick={() => setActiveTab("adhoc")}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${
                activeTab === "adhoc"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <Search className="h-3.5 w-3.5" />
              Custom Date Range
            </button>
          </div>

          {/* ── PERIODIC TAB ── */}
          {activeTab === "periodic" && (
            <>
              <div className="bg-white rounded-xl border p-5 mb-6 flex flex-wrap gap-4 items-end justify-between">
                <div className="flex flex-wrap gap-4 items-end">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Period Type</label>
                    <select
                      value={periodType}
                      onChange={(e) => setPeriodType(e.target.value)}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    >
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="annual">Annual</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Year</label>
                    <select
                      value={year}
                      onChange={(e) => setYear(Number(e.target.value))}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    >
                      {YEARS.map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>

                  {periodType !== "annual" && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">{periodLabel()}</label>
                      <select
                        value={period}
                        onChange={(e) => setPeriod(Number(e.target.value))}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      >
                        {periodOptions().map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <button
                    onClick={fetchReport}
                    disabled={loading}
                    className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
                  >
                    {loading ? "Loading..." : "Generate Report"}
                  </button>
                </div>

                {report && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleExportCSV}
                      className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium border border-gray-300"
                    >
                      <Download className="h-4 w-4" />
                      CSV
                    </button>
                    <button
                      onClick={() => handleExportFile("xlsx")}
                      disabled={exporting === "xlsx"}
                      className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-50"
                    >
                      <FileSpreadsheet className="h-4 w-4" />
                      {exporting === "xlsx" ? "Exporting…" : "XLSX"}
                    </button>
                    <button
                      onClick={() => handleExportFile("pdf")}
                      disabled={exporting === "pdf"}
                      className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
                    >
                      <FileText className="h-4 w-4" />
                      {exporting === "pdf" ? "Exporting…" : "PDF"}
                    </button>
                  </div>
                )}
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700 text-sm">
                  {error}
                </div>
              )}

              {report && (
                <>
                  <div className="bg-blue-600 text-white rounded-xl p-5 mb-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-blue-200 text-sm">Reporting Period</p>
                        <h2 className="text-2xl font-bold mt-1">{report.period_label}</h2>
                        <p className="text-blue-200 text-sm mt-1">
                          {report.start_date} to {report.end_date}
                        </p>
                      </div>
                      <FileText className="h-12 w-12 text-blue-300 opacity-50" />
                    </div>
                  </div>
                  <ReportSummaryTable report={report} fmt={fmt} />
                </>
              )}
            </>
          )}

          {/* ── AD HOC TAB ── */}
          {activeTab === "adhoc" && (
            <>
              <div className="bg-white rounded-xl border p-5 mb-6">
                <h2 className="text-sm font-semibold text-gray-700 mb-4">
                  Custom Date Range Report
                </h2>
                <div className="flex flex-wrap gap-4 items-end">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">From Date</label>
                    <input
                      type="date"
                      value={adhocFrom}
                      onChange={(e) => setAdhocFrom(e.target.value)}
                      max={adhocTo || todayISO()}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">To Date</label>
                    <input
                      type="date"
                      value={adhocTo}
                      onChange={(e) => setAdhocTo(e.target.value)}
                      min={adhocFrom}
                      max={todayISO()}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Invoice Type</label>
                    <select
                      value={adhocType}
                      onChange={(e) => setAdhocType(e.target.value)}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    >
                      <option value="all">All (Sales + Purchases)</option>
                      <option value="sales">Sales Only</option>
                      <option value="purchases">Purchases Only</option>
                    </select>
                  </div>

                  <button
                    onClick={fetchAdhocReport}
                    disabled={adhocLoading}
                    className="px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <Search className="h-4 w-4" />
                    {adhocLoading ? "Loading..." : "Generate Report"}
                  </button>

                  {adhocReport && (
                    <div className="flex items-center gap-2 ml-auto">
                      <button
                        onClick={() => handleAdhocExport("csv")}
                        disabled={!!adhocExporting}
                        className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium border border-gray-300 disabled:opacity-50"
                      >
                        <Download className="h-4 w-4" />
                        {adhocExporting === "csv" ? "Exporting…" : "CSV"}
                      </button>
                      <button
                        onClick={() => handleAdhocExport("xlsx")}
                        disabled={!!adhocExporting}
                        className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-50"
                      >
                        <FileSpreadsheet className="h-4 w-4" />
                        {adhocExporting === "xlsx" ? "Exporting…" : "XLSX"}
                      </button>
                      <button
                        onClick={() => handleAdhocExport("pdf")}
                        disabled={!!adhocExporting}
                        className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium disabled:opacity-50"
                      >
                        <FileText className="h-4 w-4" />
                        {adhocExporting === "pdf" ? "Exporting…" : "PDF"}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {adhocError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700 text-sm">
                  {adhocError}
                </div>
              )}

              {adhocReport && (
                <>
                  <div className="bg-indigo-600 text-white rounded-xl p-5 mb-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-indigo-200 text-sm">Custom Reporting Period</p>
                        <h2 className="text-2xl font-bold mt-1">
                          {adhocReport.start_date} — {adhocReport.end_date}
                        </h2>
                        <p className="text-indigo-200 text-sm mt-1 capitalize">
                          Type: {adhocReport.report_type}
                        </p>
                      </div>
                      <Search className="h-12 w-12 text-indigo-300 opacity-50" />
                    </div>
                  </div>
                  <ReportSummaryTable report={adhocReport} fmt={fmt} />
                </>
              )}

              {!adhocReport && !adhocLoading && !adhocError && (
                <div className="bg-white rounded-xl border p-10 text-center text-gray-400">
                  <Search className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Select a date range and click "Generate Report" to view your ad hoc report.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
