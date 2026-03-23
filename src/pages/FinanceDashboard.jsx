import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  FileText,
  Users,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
  Wallet,
  PieChart,
  BarChart3,
  Receipt,
  ShoppingCart,
  Package,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart as RePieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import Sidebar from "../components/Sidebar";
import BackToDashboard from "../components/BackToDashboard";
import PageLoader from "../components/PageLoader";
import apiClient from "../lib/api";

export default function FinanceDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [financialData, setFinancialData] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState("30days");

  const API_URL = import.meta.env.PROD
    ? ""
    : import.meta.env.VITE_API_URL || "http://localhost:8000";

  // Map period to months for API calls
  const getMonthsFromPeriod = (period) => {
    switch (period) {
      case "7days":
        return 1;
      case "30days":
        return 1;
      case "90days":
        return 3;
      case "year":
        return 12;
      default:
        return 1;
    }
  };

  useEffect(() => {
    fetchFinancialData();
  }, [selectedPeriod]);

  const fetchFinancialData = async () => {
    try {
      setLoading(true);
      setError(null);
      const months = getMonthsFromPeriod(selectedPeriod);

      // Fetch data from multiple endpoints in parallel (including profitability for monthly expenses)
      const [
        summaryRes,
        revenueRes,
        cashFlowRes,
        profitabilityRes,
        customersRes,
        invoicesRes,
      ] = await Promise.all([
        apiClient.get("/expenses/summary"),
        apiClient.get("/analytics/revenue", { params: { months } }),
        apiClient.get("/analytics/cash-flow", { params: { months } }),
        apiClient.get("/analytics/profitability", { params: { months } }),
        apiClient.get("/analytics/customers", { params: { limit: 4 } }),
        apiClient.get("/invoices", {
          params: { limit: 4, sort_by: "issue_date", sort_order: "desc" },
        }),
      ]);

      const summary = summaryRes.data;
      const revenueData = revenueRes.data;
      const cashFlowData = cashFlowRes.data;
      const profitabilityData = profitabilityRes.data;
      const customersData = customersRes.data;
      const invoicesData = invoicesRes.data;

      // Transform expense breakdown for pie chart
      const expenseColors = {
        Salaries: "#3b82f6",
        Rent: "#8b5cf6",
        Utilities: "#10b981",
        Marketing: "#f59e0b",
        "Office Supplies": "#ef4444",
        Transportation: "#6366f1",
        Other: "#6b7280",
      };

      const expenseBreakdown = Object.entries(
        summary.expenses?.breakdown || {},
      ).map(([category, data]) => ({
        name: category,
        value: data.amount,
        color: expenseColors[category] || "#6b7280",
      }));

      // Transform revenue data for monthly chart — prefer profitability monthly breakdown (includes expenses)
      let revenueByMonth = [];
      if (profitabilityData && Array.isArray(profitabilityData.monthly_breakdown)) {
        revenueByMonth = profitabilityData.monthly_breakdown.map((item) => ({
          month: new Date(item.month + "-01").toLocaleDateString("en-US", {
            month: "short",
          }),
          revenue: item.revenue || 0,
          expenses: item.expenses || 0,
        }));
      } else {
        revenueByMonth = (revenueData.revenue_trend || []).map((item) => ({
          month: new Date(item.month + "-01").toLocaleDateString("en-US", {
            month: "short",
          }),
          revenue: item.revenue || 0,
          expenses: 0,
        }));
      }

      // Transform cash flow data from analytics endpoint
      const cashFlow = (cashFlowData.monthly_cash_flow || []).map((item) => ({
        date: new Date(item.month + "-01").toLocaleDateString("en-US", {
          month: "short",
        }),
        inflow: item.inflows || 0,
        outflow: item.outflows || 0,
      }));

      // Transform invoice data for recent transactions
      const recentInvoices = (invoicesData.invoices || [])
        .slice(0, 4)
        .map((invoice) => ({
          id: invoice.id,
          type: "sent",
          number: invoice.invoice_number,
          customer: invoice.customer_name,
          amount: invoice.total_amount,
          status: invoice.status.toLowerCase(),
          date: invoice.issue_date,
        }));

      // Transform top customers data
      const topCustomers = (customersData.top_customers || [])
        .slice(0, 4)
        .map((customer) => ({
          name: customer.customer_name,
          revenue: customer.total_revenue,
          invoices: customer.invoice_count,
        }));

      // Calculate outstanding AR (pending + sent invoices)
      const outstandingAR = (invoicesData.invoices || [])
        .filter((inv) => ["PENDING", "SENT", "ISSUED"].includes(inv.status))
        .reduce((sum, inv) => {
          const amount = inv.total_amount || 0;
          // Credit notes (381, 81) should be subtracted from AR
          const isCreditNote = inv.invoice_type === '381' || inv.invoice_type === '81';
          return sum + (isCreditNote ? -amount : amount);
        }, 0);

      setFinancialData({
        summary: {
          // Use analytics (paid-based) for displayed revenue, fall back to summary if missing
          totalRevenue: revenueData.total_revenue ?? summary.revenue?.total ?? 0,
          totalExpenses: summary.summary?.total_costs || 0,
          netProfit: summary.summary?.net_income || 0,
          profitMargin: summary.summary?.profit_margin_percent || 0,
          // Keep issued invoice counts from the summary endpoint
          invoicesIssued:
            summary.revenue?.issued_invoice_count || summary.revenue?.invoice_count || 0,
          invoicesReceived: 0,
          outstandingAR: outstandingAR,
          outstandingAP: 0,
        },
        // include raw payloads to help debug mismatches
        _raw: {
          summaryRaw: summary,
          revenueRaw: revenueData,
          cashFlowRaw: cashFlowData,
          profitabilityRaw: profitabilityData,
        },
        revenueByMonth,
        cashFlow,
        expenseBreakdown,
        recentInvoices,
        topCustomers,
      });
    } catch (error) {
      console.error("Failed to fetch financial data:", error);
      setError("Failed to load financial data. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex">
        <Sidebar />
        <div className="flex-1 ml-64">
          <PageLoader />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex">
        <Sidebar />
        <div className="flex-1 ml-64">
          <div className="max-w-7xl mx-auto px-6 py-8">
            <BackToDashboard />
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
              <div className="text-red-600 text-xl font-semibold mb-2">
                Unable to Load Financial Data
              </div>
              <p className="text-red-700 mb-4">{error}</p>
              <button
                onClick={fetchFinancialData}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!financialData) return null;

  const {
    summary,
    revenueByMonth,
    cashFlow,
    expenseBreakdown,
    recentInvoices,
    topCustomers,
    _raw,
  } = financialData;

  const showDebug = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === '1';

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />

      <div className="flex-1 ml-64">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <BackToDashboard />

          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Finance Dashboard
              </h1>
              <p className="text-gray-600 mt-2">
                Comprehensive view of your business financial health
              </p>
            </div>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
              <option value="90days">Last 90 Days</option>
              <option value="year">This Year</option>
            </select>
          </div>

          {/* Key Metrics */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-green-100 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
                <div className="flex items-center gap-1 text-green-600 text-sm font-medium">
                  <ArrowUpRight className="h-4 w-4" />
                  +12.5%
                </div>
              </div>
                  <div className="text-2xl font-bold text-gray-900">
                    AED {summary.totalRevenue.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    <div>Revenue (Received): AED {summary.totalRevenue.toLocaleString()}</div>
                    <div className="text-xs text-gray-500">Revenue (Issued): AED {(( _raw && _raw.summaryRaw && _raw.summaryRaw.revenue && _raw.summaryRaw.revenue.total) || 0).toLocaleString()}</div>
                  </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-red-100 rounded-lg">
                  <TrendingDown className="h-6 w-6 text-red-600" />
                </div>
                <div className="flex items-center gap-1 text-red-600 text-sm font-medium">
                  <ArrowUpRight className="h-4 w-4" />
                  +8.3%
                </div>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                AED {summary.totalExpenses.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600 mt-1">Total Expenses</div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <DollarSign className="h-6 w-6 text-blue-600" />
                </div>
                <div className="flex items-center gap-1 text-green-600 text-sm font-medium">
                  <ArrowUpRight className="h-4 w-4" />
                  +18.2%
                </div>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                AED {summary.netProfit.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600 mt-1">Net Profit</div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <PieChart className="h-6 w-6 text-purple-600" />
                </div>
                <div className="text-sm text-gray-600">Healthy</div>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {summary.profitMargin}%
              </div>
              <div className="text-sm text-gray-600 mt-1">Profit Margin</div>
            </div>
          </div>

          {showDebug && (
            <div className="mt-6 bg-white p-4 rounded border border-gray-200">
              <div className="text-sm font-medium mb-2">Debug: Raw API payloads</div>
              <pre className="text-xs whitespace-pre-wrap max-h-64 overflow-auto">{JSON.stringify({
                summaryRaw: _raw && _raw.summaryRaw,
                revenueRaw: _raw && _raw.revenueRaw,
                cashFlowRaw: _raw && _raw.cashFlowRaw,
              }, null, 2)}</pre>
            </div>
          )}

          {/* Charts Row */}
          <div className="grid lg:grid-cols-2 gap-6 mb-8">
            {/* Revenue vs Expenses */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-900">
                  Revenue vs Expenses
                </h3>
                <BarChart3 className="h-5 w-5 text-gray-400" />
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={revenueByMonth}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="revenue" fill="#3b82f6" name="Revenue" />
                  <Bar dataKey="expenses" fill="#ef4444" name="Expenses" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Cash Flow */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-900">Cash Flow</h3>
                <Wallet className="h-5 w-5 text-gray-400" />
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={cashFlow}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="inflow"
                    stroke="#10b981"
                    strokeWidth={2}
                    name="Inflow"
                  />
                  <Line
                    type="monotone"
                    dataKey="outflow"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    name="Outflow"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Expense Breakdown & AR/AP */}
          <div className="grid lg:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 mb-6">
                Expense Breakdown
              </h3>
              {expenseBreakdown && expenseBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <RePieChart>
                    <Pie
                      data={expenseBreakdown}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {expenseBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </RePieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-64 text-gray-400">
                  <div className="text-center">
                    <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No expense data available</p>
                  </div>
                </div>
              )}
            </div>

            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 mb-6">
                Accounts Receivable & Payable
              </h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-green-100 rounded-lg">
                      <Receipt className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">
                        Accounts Receivable
                      </div>
                      <div className="text-2xl font-bold text-gray-900">
                        AED {summary.outstandingAR.toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Invoices Issued</span>
                      <span className="font-medium">{summary.invoicesIssued}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Average Days</span>
                      <span className="font-medium">28 days</span>
                    </div>
                    <button
                      onClick={() => navigate("/invoices")}
                      className="w-full mt-4 px-4 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 text-sm font-medium"
                    >
                      View Invoices
                    </button>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-orange-100 rounded-lg">
                      <ShoppingCart className="h-6 w-6 text-orange-600" />
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">
                        Accounts Payable
                      </div>
                      <div className="text-2xl font-bold text-gray-900">
                        AED {summary.outstandingAP.toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Bills Received</span>
                      <span className="font-medium">
                        {summary.invoicesReceived}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Average Days</span>
                      <span className="font-medium">22 days</span>
                    </div>
                    <button
                      onClick={() => navigate("/ap/inbox")}
                      className="w-full mt-4 px-4 py-2 bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 text-sm font-medium"
                    >
                      View Bills
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Transactions & Top Customers */}
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                Recent Transactions
              </h3>
              {recentInvoices && recentInvoices.length > 0 ? (
                <div className="space-y-3">
                  {recentInvoices.map((invoice) => (
                    <div
                      key={invoice.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded-lg ${invoice.type === "sent" ? "bg-green-100" : "bg-orange-100"}`}
                        >
                          {invoice.type === "sent" ? (
                            <ArrowUpRight className="h-4 w-4 text-green-600" />
                          ) : (
                            <ArrowDownRight className="h-4 w-4 text-orange-600" />
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-sm text-gray-900">
                            {invoice.number}
                          </div>
                          <div className="text-xs text-gray-600">
                            {invoice.customer || invoice.supplier}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-sm text-gray-900">
                          AED {invoice.amount.toLocaleString()}
                        </div>
                        <div
                          className={`text-xs ${
                            invoice.status === "paid"
                              ? "text-green-600"
                              : invoice.status === "overdue"
                                ? "text-red-600"
                                : "text-yellow-600"
                          }`}
                        >
                          {invoice.status.charAt(0).toUpperCase() +
                            invoice.status.slice(1)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-64 text-gray-400">
                  <div className="text-center">
                    <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No recent transactions</p>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                Top Customers
              </h3>
              {topCustomers && topCustomers.length > 0 ? (
                <div className="space-y-4">
                  {topCustomers.map((customer, index) => (
                    <div key={index}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium text-sm text-gray-900">
                          {customer.name}
                        </div>
                        <div className="text-sm font-medium text-gray-900">
                          AED {customer.revenue.toLocaleString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{
                              width: `${(customer.revenue / topCustomers[0].revenue) * 100}%`,
                            }}
                          />
                        </div>
                        <div className="text-xs text-gray-600">
                          {customer.invoices} invoices
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-64 text-gray-400">
                  <div className="text-center">
                    <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No customer data available</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
