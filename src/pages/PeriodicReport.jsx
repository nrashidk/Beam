import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  Download,
  FileText,
  TrendingUp,
  FileSpreadsheet,
} from "lucide-react";
import Sidebar from "../components/Sidebar";
import BackToDashboard from "../components/BackToDashboard";
import { apiClient } from "../lib/api";

const MONTHS = [
  "January", "February", "March", "April",
  "May", "June", "July", "August",
  "September", "October", "November", "December",
];

const QUARTERS = ["Q1 (Jan–Mar)", "Q2 (Apr–Jun)", "Q3 (Jul–Sep)", "Q4 (Oct–Dec)"];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - i);

/**
 * Returns { isoYear, isoWeek } for a given Date using the standard
 * ISO 8601 definition: week 1 contains the year's first Thursday;
 * Monday is day 1.  Works correctly for all year-boundary dates.
 */
function getISOWeekData(d) {
  // Copy to avoid mutating the original
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  // Thursday in current week decides the year (ISO rule)
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const isoWeek = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return { isoYear: date.getUTCFullYear(), isoWeek };
}

function getISOWeeksInYear(year) {
  // Dec 28 is always in the last ISO week of the year
  return getISOWeekData(new Date(year, 11, 28)).isoWeek;
}

function currentISOWeek() {
  return getISOWeekData(new Date()).isoWeek;
}

function currentISOYear() {
  return getISOWeekData(new Date()).isoYear;
}

export default function PeriodicReport() {
  const navigate = useNavigate();
  const [periodType, setPeriodType] = useState("monthly");
  const [year, setYear] = useState(currentYear);
  const [period, setPeriod] = useState(new Date().getMonth() + 1);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(null);

  const weeksInYear = getISOWeeksInYear(year);
  const WEEKS = Array.from({ length: weeksInYear }, (_, i) => i + 1);

  useEffect(() => {
    if (periodType === "monthly") {
      setPeriod(new Date().getMonth() + 1);
    } else if (periodType === "quarterly") {
      setPeriod(Math.floor(new Date().getMonth() / 3) + 1);
    } else if (periodType === "weekly") {
      // Use correct ISO year for the year selector too
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
      setError(
        err.response?.data?.detail || "Failed to load report. Please try again."
      );
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
      [
        "TOTAL",
        report.summary.count,
        report.summary.subtotal,
        report.summary.tax_amount,
        report.summary.total_amount,
      ],
    ];
    const csvContent =
      "data:text/csv;charset=utf-8," +
      rows.map((r) => r.join(",")).join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute(
      "download",
      `periodic_report_${report.period_label.replace(/\s/g, "_")}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportFile = async (fmt) => {
    setExporting(fmt);
    try {
      const params = { period_type: periodType, year, format: fmt };
      if (periodType !== "annual") params.period = period;
      const res = await apiClient.get("/reports/periodic/export", {
        params,
        responseType: "blob",
      });
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
    if (periodType === "monthly")
      return MONTHS.map((m, i) => ({ value: i + 1, label: m }));
    if (periodType === "quarterly")
      return QUARTERS.map((q, i) => ({ value: i + 1, label: q }));
    if (periodType === "weekly")
      return WEEKS.map((w) => ({ value: w, label: `Week ${w}` }));
    return [];
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BackToDashboard />
            <div>
              <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-600" />
                Periodic Invoice Report
              </h1>
              <p className="text-sm text-gray-500">
                Weekly, monthly, quarterly &amp; annual invoice summaries for FTA compliance
              </p>
            </div>
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
                {exporting === "xlsx" ? "Exporting…" : "Download XLSX"}
              </button>
              <button
                onClick={() => handleExportFile("pdf")}
                disabled={exporting === "pdf"}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
              >
                <FileText className="h-4 w-4" />
                {exporting === "pdf" ? "Exporting…" : "Download PDF"}
              </button>
            </div>
          )}
        </div>

        <div className="p-6 max-w-5xl mx-auto w-full">
          {/* Filter controls */}
          <div className="bg-white rounded-xl border p-5 mb-6 flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Period Type
              </label>
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
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Year
              </label>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                {YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            {periodType !== "annual" && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  {periodLabel()}
                </label>
                <select
                  value={period}
                  onChange={(e) => setPeriod(Number(e.target.value))}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  {periodOptions().map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
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

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700 text-sm">
              {error}
            </div>
          )}

          {report && (
            <>
              {/* Header */}
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

              {/* Summary cards */}
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

              {/* Breakdown table */}
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
          )}
        </div>
      </div>
    </div>
  );
}
