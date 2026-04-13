import { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import { apiClient } from "../lib/api";
import {
  FileText,
  ClipboardList,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  Calendar,
  Download,
  Users,
} from "lucide-react";

function fmt(val) {
  if (val === null || val === undefined) return "AED 0.00";
  return `AED ${Number(val).toLocaleString("en-AE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function BoxRow({ num, label, value, highlight }) {
  return (
    <tr className={highlight ? "bg-indigo-50 font-semibold" : "hover:bg-gray-50"}>
      <td className="px-4 py-3 text-sm text-gray-500 w-16 text-center">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">
          {num}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-gray-700">{label}</td>
      <td className="px-4 py-3 text-sm text-right font-mono text-gray-900">{fmt(value)}</td>
    </tr>
  );
}

export default function VATReturn() {
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const fmtDate = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const [periodStart, setPeriodStart] = useState(fmtDate(firstOfMonth));
  const [periodEnd, setPeriodEnd] = useState(fmtDate(today));
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [downloading, setDownloading] = useState({});
  // Gap 4: Tourist refund (Box 2) input
  const [touristRefundAmount, setTouristRefundAmount] = useState("");
  const [touristRefundLoading, setTouristRefundLoading] = useState(false);
  const [touristRefundMsg, setTouristRefundMsg] = useState("");

  useEffect(() => {
    fetchHistory();
  }, []);

  async function handleDownload(returnId, format, periodStart, periodEnd) {
    const key = `${returnId}-${format}`;
    setDownloading((prev) => ({ ...prev, [key]: true }));
    try {
      const res = await apiClient.get(`/vat-return/${returnId}/export`, {
        params: { format },
        responseType: "blob",
      });
      const ext = format === "xlsx" ? "xlsx" : "xml";
      const mime =
        format === "xlsx"
          ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          : "application/xml";
      const url = window.URL.createObjectURL(new Blob([res.data], { type: mime }));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `vat_return_${periodStart}_${periodEnd}.${ext}`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert("Export failed. Please try again.");
    } finally {
      setDownloading((prev) => ({ ...prev, [key]: false }));
    }
  }

  async function fetchHistory() {
    setHistoryLoading(true);
    try {
      const res = await apiClient.get("/vat-return");
      setHistory(res.data.vat_returns || []);
    } catch {
      // non-fatal
    } finally {
      setHistoryLoading(false);
    }
  }

  async function handleGenerate() {
    setError("");
    setResult(null);
    setGenerating(true);
    setTouristRefundMsg("");
    try {
      const res = await apiClient.post("/vat-return/generate", null, {
        params: { period_start: periodStart, period_end: periodEnd },
      });
      setResult(res.data);
      setTouristRefundAmount(String(res.data.box2_tax_refunds || "0"));
      fetchHistory();
    } catch (e) {
      setError(e.response?.data?.detail || "Failed to generate VAT return. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleTouristRefundUpdate() {
    if (!result?.return_id) return;
    const amount = parseFloat(touristRefundAmount) || 0;
    setTouristRefundLoading(true);
    setTouristRefundMsg("");
    try {
      const res = await apiClient.post(`/vat-returns/${result.return_id}/tourist-refund`, { amount });
      setResult((prev) => ({ ...prev, box2_tax_refunds: res.data.tax_refunds_provided, box13_net_vat_payable: res.data.net_vat_payable }));
      setTouristRefundMsg(`✅ Box 2 updated to ${fmt(res.data.tax_refunds_provided)}`);
      fetchHistory();
    } catch (e) {
      setTouristRefundMsg(`❌ ${e.response?.data?.detail || "Update failed"}`);
    } finally {
      setTouristRefundLoading(false);
    }
  }

  const boxes = result
    ? [
        { num: 1, label: "Standard-rated supplies (taxable amount, excl. VAT)", value: result.box1_standard_rated_sales },
        { num: 2, label: "Tax refunds provided to tourists", value: result.box2_tax_refunds },
        { num: 3, label: "Output VAT (5% on standard-rated sales)", value: result.box3_output_vat, highlight: true },
        { num: 4, label: "Zero-rated supplies", value: result.box4_zero_rated_sales },
        { num: 5, label: "Exempt supplies", value: result.box5_exempt_sales },
        { num: 6, label: "Out-of-scope / reverse-charge supplies", value: result.box6_out_of_scope_sales },
        { num: 7, label: "Total value of all supplies", value: result.box7_total_sales, highlight: true },
        { num: 8, label: "Standard-rated purchases — bills (excl. VAT)", value: result.box8_standard_rated_purchases },
        { num: 9, label: "Input VAT recoverable on bills", value: result.box9_input_vat_bills },
        { num: 10, label: "Standard-rated purchases — expenses (excl. VAT)", value: result.box10_purchase_expenses },
        { num: 11, label: "Input VAT recoverable on expenses", value: result.box11_input_vat_expenses },
        { num: 12, label: "Total input VAT (Box 9 + Box 11)", value: result.box12_total_input_vat, highlight: true },
        { num: 13, label: "Net VAT payable / (refundable)", value: result.box13_net_vat_payable, highlight: true },
      ]
    : [];

  const isPayable = result && result.box13_net_vat_payable > 0;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 ml-64 flex flex-col">
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <ClipboardList className="h-6 w-6 text-indigo-600 flex-shrink-0" />
            <div>
              <h1 className="text-xl font-semibold text-gray-900">VAT Return</h1>
              <p className="text-sm text-gray-500 mt-0.5">UAE FTA Form 201 — 13-box VAT return computation</p>
            </div>
          </div>
        </div>
        <div className="flex-1 p-6">
        <div className="max-w-4xl mx-auto">
          {/* Period Selector Card */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-indigo-500" />
              Select Period
            </h2>
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Period Start
                </label>
                <input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Period End
                </label>
                <input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium transition-colors"
              >
                {generating ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
                {generating ? "Generating…" : "Generate Return"}
              </button>
            </div>
            {error && (
              <p className="mt-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
          </div>

          {/* Results: 13-Box Table */}
          {result && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6 overflow-hidden">
              {/* Banner */}
              <div
                className={`px-6 py-4 flex items-center justify-between ${
                  isPayable ? "bg-amber-50 border-b border-amber-100" : "bg-green-50 border-b border-green-100"
                }`}
              >
                <div className="flex items-center gap-3">
                  {isPayable ? (
                    <TrendingUp className="h-6 w-6 text-amber-600" />
                  ) : (
                    <TrendingDown className="h-6 w-6 text-green-600" />
                  )}
                  <div>
                    <p className={`font-semibold text-lg ${isPayable ? "text-amber-700" : "text-green-700"}`}>
                      {isPayable ? "VAT Payable to FTA" : "VAT Refundable from FTA"}
                    </p>
                    <p className="text-sm text-gray-500">
                      Period: {result.period_start} — {result.period_end}
                    </p>
                  </div>
                </div>
                <div className={`text-2xl font-bold ${isPayable ? "text-amber-700" : "text-green-700"}`}>
                  {fmt(Math.abs(result.box13_net_vat_payable))}
                </div>
              </div>

              {/* Box table */}
              <div className="px-6 py-2 bg-gray-50 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  FTA Form 201 — Box-by-Box Breakdown
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-16">Box</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Description</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Amount (AED)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr className="bg-indigo-600">
                      <td colSpan={3} className="px-4 py-2 text-xs font-bold text-white uppercase tracking-wider">
                        Section 1 — Sales & Output Tax
                      </td>
                    </tr>
                    {boxes.slice(0, 7).map((b) => (
                      <BoxRow key={b.num} {...b} />
                    ))}
                    <tr className="bg-indigo-600">
                      <td colSpan={3} className="px-4 py-2 text-xs font-bold text-white uppercase tracking-wider">
                        Section 2 — Purchases & Input Tax
                      </td>
                    </tr>
                    {boxes.slice(7, 12).map((b) => (
                      <BoxRow key={b.num} {...b} />
                    ))}
                    <tr className="bg-indigo-600">
                      <td colSpan={3} className="px-4 py-2 text-xs font-bold text-white uppercase tracking-wider">
                        Section 3 — Net VAT
                      </td>
                    </tr>
                    {boxes.slice(12).map((b) => (
                      <BoxRow key={b.num} {...b} />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Gap 4: Box 2 Tourist Refund Input */}
              {result.return_id && (
                <div className="px-6 py-4 bg-amber-50 border-t border-amber-100">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2 text-amber-800">
                      <Users className="h-4 w-4" />
                      <span className="text-sm font-semibold">Box 2 — Tourist VAT Refunds</span>
                    </div>
                    <div className="flex items-center gap-2 flex-1 min-w-48">
                      <span className="text-xs text-amber-700">AED</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={touristRefundAmount}
                        onChange={(e) => setTouristRefundAmount(e.target.value)}
                        className="w-36 px-3 py-1.5 text-sm border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-400 bg-white"
                        placeholder="0.00"
                      />
                      <button
                        onClick={handleTouristRefundUpdate}
                        disabled={touristRefundLoading}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors"
                      >
                        {touristRefundLoading ? <RefreshCw className="h-3 w-3 animate-spin" /> : null}
                        Update Box 2
                      </button>
                    </div>
                    {touristRefundMsg && (
                      <span className={`text-xs font-medium ${touristRefundMsg.startsWith("✅") ? "text-green-700" : "text-red-600"}`}>
                        {touristRefundMsg}
                      </span>
                    )}
                    <p className="w-full text-xs text-amber-600 mt-1">
                      Enter the total AED value of VAT refunds issued to tourists during this period. Only relevant for retail businesses at tourist locations (e.g., airports).
                    </p>
                  </div>
                </div>
              )}

              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex flex-wrap items-center justify-between gap-4">
                <div className="flex gap-8 text-sm text-gray-600">
                  <span>Sales invoices processed: <strong>{result.total_sales_invoices}</strong></span>
                  <span>Purchase invoices processed: <strong>{result.total_purchase_invoices}</strong></span>
                </div>
                {result.return_id && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Download:</span>
                    <button
                      onClick={() => handleDownload(result.return_id, "xlsx", result.period_start, result.period_end)}
                      disabled={downloading[`${result.return_id}-xlsx`]}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                    >
                      {downloading[`${result.return_id}-xlsx`] ? (
                        <RefreshCw className="h-3 w-3 animate-spin" />
                      ) : (
                        <Download className="h-3 w-3" />
                      )}
                      XLSX
                    </button>
                    <button
                      onClick={() => handleDownload(result.return_id, "xml", result.period_start, result.period_end)}
                      disabled={downloading[`${result.return_id}-xml`]}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {downloading[`${result.return_id}-xml`] ? (
                        <RefreshCw className="h-3 w-3 animate-spin" />
                      ) : (
                        <Download className="h-3 w-3" />
                      )}
                      XML
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Historical Returns */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-800">Prior VAT Returns</h2>
            </div>

            {historyLoading ? (
              <div className="px-6 py-8 text-center text-gray-400 text-sm">Loading history…</div>
            ) : history.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-400 text-sm">
                No prior returns found. Generate your first return above.
              </div>
            ) : (
              <div className="divide-y divide-gray-100 max-h-[480px] overflow-y-auto">
                {history.map((r) => {
                  const expanded = expandedId === r.id;
                  const payable = r.box13_net_vat_payable > 0;
                  return (
                    <div key={r.id}>
                      <button
                        onClick={() => setExpandedId(expanded ? null : r.id)}
                        className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors text-left"
                      >
                        <div className="flex items-center gap-4">
                          <div>
                            <p className="text-sm font-medium text-gray-800">
                              {r.period_start} — {r.period_end}
                            </p>
                            <p className="text-xs text-gray-500">
                              Generated{" "}
                              {r.created_at
                                ? new Date(r.created_at).toLocaleDateString("en-AE")
                                : "—"}
                            </p>
                          </div>
                          <span
                            className={`text-xs px-2 py-1 rounded-full font-medium ${
                              payable
                                ? "bg-amber-100 text-amber-700"
                                : "bg-green-100 text-green-700"
                            }`}
                          >
                            {payable ? "Payable" : "Refundable"}
                          </span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm font-semibold text-gray-800">
                            {fmt(r.box13_net_vat_payable)}
                          </span>
                          {expanded ? (
                            <ChevronUp className="h-4 w-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                          )}
                        </div>
                      </button>
                      {expanded && (
                        <div className="px-6 pb-4">
                          <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-2 md:grid-cols-3 gap-3 text-sm mb-3">
                            <div>
                              <p className="text-gray-500 text-xs">Box 1 — Std Sales</p>
                              <p className="font-mono font-medium">{fmt(r.box1_standard_rated_sales)}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 text-xs">Box 3 — Output VAT</p>
                              <p className="font-mono font-medium">{fmt(r.box3_output_vat)}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 text-xs">Box 4 — Zero-rated</p>
                              <p className="font-mono font-medium">{fmt(r.box4_zero_rated_sales)}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 text-xs">Box 5 — Exempt</p>
                              <p className="font-mono font-medium">{fmt(r.box5_exempt_sales)}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 text-xs">Box 7 — Total Sales</p>
                              <p className="font-mono font-medium">{fmt(r.box7_total_sales)}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 text-xs">Box 8 — Std Purchases</p>
                              <p className="font-mono font-medium">{fmt(r.box8_standard_rated_purchases)}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 text-xs">Box 9 — Input VAT</p>
                              <p className="font-mono font-medium">{fmt(r.box9_input_vat_bills)}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 text-xs">Box 12 — Total Input VAT</p>
                              <p className="font-mono font-medium">{fmt(r.box12_total_input_vat)}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 text-xs">Box 13 — Net VAT</p>
                              <p className={`font-mono font-semibold ${payable ? "text-amber-700" : "text-green-700"}`}>
                                {fmt(r.box13_net_vat_payable)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Download:</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDownload(r.id, "xlsx", r.period_start, r.period_end); }}
                              disabled={downloading[`${r.id}-xlsx`]}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                            >
                              {downloading[`${r.id}-xlsx`] ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                              XLSX
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDownload(r.id, "xml", r.period_start, r.period_end); }}
                              disabled={downloading[`${r.id}-xml`]}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                            >
                              {downloading[`${r.id}-xml`] ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                              XML
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
