import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";
import {
  TrendingUp,
  Users,
  DollarSign,
  Activity,
  Calendar,
  ArrowUp,
  ArrowDown
} from "lucide-react";

const AdvancedAnalytics = () => {
  const navigate = useNavigate();
  const [revenueData, setRevenueData] = useState(null);
  const [customerData, setCustomerData] = useState(null);
  const [profitabilityData, setProfitabilityData] = useState(null);
  const [cashFlowData, setCashFlowData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timePeriod, setTimePeriod] = useState(12);

  const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#6366f1'];

  useEffect(() => {
    fetchAnalyticsData();
  }, [timePeriod]);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      const [revenue, customers, profitability, cashFlow] = await Promise.all([
        axios.get(`${import.meta.env.VITE_API_URL || "http://localhost:8000"}/analytics/revenue?months=${timePeriod}`, { headers }),
        axios.get(`${import.meta.env.VITE_API_URL || "http://localhost:8000"}/analytics/customers?limit=10`, { headers }),
        axios.get(`${import.meta.env.VITE_API_URL || "http://localhost:8000"}/analytics/profitability?months=${timePeriod}`, { headers }),
        axios.get(`${import.meta.env.VITE_API_URL || "http://localhost:8000"}/analytics/cash-flow?months=${timePeriod}`, { headers })
      ]);

      setRevenueData(revenue.data);
      setCustomerData(customers.data);
      setProfitabilityData(profitability.data);
      setCashFlowData(cashFlow.data);
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
      setError("Failed to load analytics data. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl text-gray-600">Loading analytics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 bg-gray-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <div className="text-red-600 text-xl font-semibold mb-2">Unable to Load Analytics</div>
            <p className="text-red-700 mb-4">{error}</p>
            <button
              onClick={fetchAnalyticsData}
              className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const hasNoData = !revenueData?.total_revenue && !customerData?.total_customers && !profitabilityData?.total_revenue;

  if (hasNoData) {
    return (
      <div className="p-8 bg-gray-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Advanced Analytics</h1>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-8 text-center">
            <Activity className="w-16 h-16 text-blue-600 mx-auto mb-4" />
            <div className="text-blue-900 text-xl font-semibold mb-2">No Analytics Data Available</div>
            <p className="text-blue-700 mb-4">
              Start issuing and receiving payments on invoices to see your business analytics and insights here.
            </p>
            <button
              onClick={() => navigate('/invoices')}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go to Invoices
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Advanced Analytics</h1>
            <p className="text-gray-600 mt-2">Comprehensive business insights and trends</p>
          </div>
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">Time Period:</label>
            <select
              value={timePeriod}
              onChange={(e) => setTimePeriod(Number(e.target.value))}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value={3}>Last 3 Months</option>
              <option value={6}>Last 6 Months</option>
              <option value={12}>Last 12 Months</option>
              <option value={24}>Last 24 Months</option>
            </select>
          </div>
        </div>

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <TrendingUp className="w-8 h-8 text-emerald-600" />
              <span className="text-xs font-medium text-gray-500">REVENUE</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {formatCurrency(revenueData?.total_revenue || 0)}
            </div>
            <div className="text-sm text-gray-600 mt-1">
              Avg: {formatCurrency(revenueData?.average_monthly_revenue || 0)}/mo
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <Users className="w-8 h-8 text-blue-600" />
              <span className="text-xs font-medium text-gray-500">CUSTOMERS</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {customerData?.total_customers || 0}
            </div>
            <div className="text-sm text-gray-600 mt-1">
              Avg Value: {formatCurrency(customerData?.average_customer_lifetime_value || 0)}
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <DollarSign className="w-8 h-8 text-purple-600" />
              <span className="text-xs font-medium text-gray-500">GROSS PROFIT</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {formatCurrency(profitabilityData?.gross_profit || 0)}
            </div>
            <div className="text-sm text-gray-600 mt-1">
              Margin: {profitabilityData?.gross_margin?.toFixed(1)}%
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <Activity className="w-8 h-8 text-orange-600" />
              <span className="text-xs font-medium text-gray-500">NET CASH</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {formatCurrency(cashFlowData?.net_cash_position || 0)}
            </div>
            <div className={`text-sm mt-1 flex items-center gap-1 ${
              (cashFlowData?.net_cash_position || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'
            }`}>
              {(cashFlowData?.net_cash_position || 0) >= 0 ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
              {(cashFlowData?.net_cash_position || 0) >= 0 ? 'Positive' : 'Negative'}
            </div>
          </div>
        </div>

        {/* Revenue Trend Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Revenue Trend</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={revenueData?.revenue_trend || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="revenue" 
                stroke="#10b981" 
                strokeWidth={3}
                name="Revenue (AED)"
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-4 grid grid-cols-3 gap-4">
            {revenueData?.revenue_trend?.slice(-3).map((month, idx) => (
              <div key={idx} className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-xs text-gray-500 mb-1">{month.month}</div>
                <div className="text-lg font-bold text-gray-900">{formatCurrency(month.revenue)}</div>
                <div className={`text-xs mt-1 flex items-center justify-center gap-1 ${
                  month.growth_rate >= 0 ? 'text-emerald-600' : 'text-red-600'
                }`}>
                  {month.growth_rate >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                  {Math.abs(month.growth_rate).toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Customers */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Top Customers by Revenue</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Customer</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Total Revenue</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Invoices</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Avg Invoice Value</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Last Payment</th>
                </tr>
              </thead>
              <tbody>
                {customerData?.top_customers?.map((customer, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-900">{customer.customer_name}</div>
                      <div className="text-xs text-gray-500">{customer.customer_email}</div>
                    </td>
                    <td className="text-right py-3 px-4 font-semibold text-gray-900">
                      {formatCurrency(customer.total_revenue)}
                    </td>
                    <td className="text-right py-3 px-4 text-gray-600">
                      {customer.invoice_count}
                    </td>
                    <td className="text-right py-3 px-4 text-gray-600">
                      {formatCurrency(customer.average_invoice_value)}
                    </td>
                    <td className="text-right py-3 px-4 text-gray-600 text-sm">
                      {customer.last_payment_date ? new Date(customer.last_payment_date).toLocaleDateString() : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Profitability & Cash Flow - Side by Side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Profitability Chart */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Monthly Profitability</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={profitabilityData?.monthly_breakdown || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Legend />
                <Bar dataKey="revenue" fill="#10b981" name="Revenue" />
                <Bar dataKey="expenses" fill="#ef4444" name="Expenses" />
                <Bar dataKey="profit" fill="#3b82f6" name="Profit" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Cash Flow Chart */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Cash Flow Analysis</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={cashFlowData?.monthly_cash_flow || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Legend />
                <Bar dataKey="inflows" fill="#10b981" name="Inflows" />
                <Bar dataKey="outflows" fill="#ef4444" name="Outflows" />
                <Bar dataKey="net_cash_flow" fill="#3b82f6" name="Net Cash Flow" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Profitability Summary */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Financial Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
              <div className="text-sm text-emerald-700 mb-2">Total Revenue</div>
              <div className="text-2xl font-bold text-emerald-900">
                {formatCurrency(profitabilityData?.total_revenue || 0)}
              </div>
            </div>
            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <div className="text-sm text-red-700 mb-2">Total Expenses</div>
              <div className="text-2xl font-bold text-red-900">
                {formatCurrency(profitabilityData?.total_expenses || 0)}
              </div>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-sm text-blue-700 mb-2">Net Profit</div>
              <div className="text-2xl font-bold text-blue-900">
                {formatCurrency(profitabilityData?.gross_profit || 0)}
              </div>
              <div className="text-xs text-blue-600 mt-1">
                {profitabilityData?.gross_margin?.toFixed(1)}% Margin
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdvancedAnalytics;
