import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, TrendingDown, DollarSign, FileText, Users, 
  Calendar, ArrowUpRight, ArrowDownRight, CreditCard, Wallet,
  PieChart, BarChart3, Receipt, ShoppingCart, Package
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { LineChart, Line, BarChart, Bar, PieChart as RePieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import Sidebar from '../components/Sidebar';
import BackToDashboard from '../components/BackToDashboard';

export default function FinanceDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [financialData, setFinancialData] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('30days');

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  useEffect(() => {
    fetchFinancialData();
  }, [selectedPeriod]);

  const fetchFinancialData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      // In production, these would be real API calls
      // For now, using mock data to demonstrate the UI
      const mockData = {
        summary: {
          totalRevenue: 125450.50,
          totalExpenses: 67890.25,
          netProfit: 57560.25,
          profitMargin: 45.9,
          invoicesSent: 87,
          invoicesReceived: 34,
          outstandingAR: 23450.00,
          outstandingAP: 12890.50
        },
        revenueByMonth: [
          { month: 'Jan', revenue: 18200, expenses: 9400 },
          { month: 'Feb', revenue: 22100, expenses: 11200 },
          { month: 'Mar', revenue: 19800, expenses: 10100 },
          { month: 'Apr', revenue: 25300, expenses: 12800 },
          { month: 'May', revenue: 21050, expenses: 13200 },
          { month: 'Jun', revenue: 19000, expenses: 11190 }
        ],
        cashFlow: [
          { date: 'Week 1', inflow: 15000, outflow: 8000 },
          { date: 'Week 2', inflow: 12000, outflow: 9500 },
          { date: 'Week 3', inflow: 18000, outflow: 7200 },
          { date: 'Week 4', inflow: 14000, outflow: 10500 }
        ],
        expenseBreakdown: [
          { name: 'Salaries', value: 35000, color: '#3b82f6' },
          { name: 'Operations', value: 15200, color: '#8b5cf6' },
          { name: 'Marketing', value: 8900, color: '#10b981' },
          { name: 'Supplies', value: 5790, color: '#f59e0b' },
          { name: 'Other', value: 3000, color: '#6b7280' }
        ],
        recentInvoices: [
          { id: '1', type: 'sent', number: 'INV-202506-0087', customer: 'ABC Trading LLC', amount: 4500, status: 'paid', date: '2025-06-28' },
          { id: '2', type: 'sent', number: 'INV-202506-0086', customer: 'XYZ Services', amount: 2800, status: 'pending', date: '2025-06-27' },
          { id: '3', type: 'received', number: 'SUPP-1234', supplier: 'Office Supplies Co', amount: 1200, status: 'pending', date: '2025-06-26' },
          { id: '4', type: 'sent', number: 'INV-202506-0085', customer: 'Global Corp', amount: 8900, status: 'overdue', date: '2025-06-20' }
        ],
        topCustomers: [
          { name: 'ABC Trading LLC', revenue: 45200, invoices: 12 },
          { name: 'Global Corp', revenue: 38900, invoices: 8 },
          { name: 'XYZ Services', revenue: 23400, invoices: 15 },
          { name: 'Dubai Retail', revenue: 18050, invoices: 6 }
        ]
      };

      setFinancialData(mockData);
    } catch (error) {
      console.error('Failed to fetch financial data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading financial dashboard...</div>
      </div>
    );
  }

  const { summary, revenueByMonth, cashFlow, expenseBreakdown, recentInvoices, topCustomers } = financialData;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />
      
      <div className="flex-1 ml-64">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <BackToDashboard />
          
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Finance Dashboard</h1>
              <p className="text-gray-600 mt-2">Comprehensive view of your business financial health</p>
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
            <div className="text-2xl font-bold text-gray-900">AED {summary.totalRevenue.toLocaleString()}</div>
            <div className="text-sm text-gray-600 mt-1">Total Revenue</div>
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
            <div className="text-2xl font-bold text-gray-900">AED {summary.totalExpenses.toLocaleString()}</div>
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
            <div className="text-2xl font-bold text-gray-900">AED {summary.netProfit.toLocaleString()}</div>
            <div className="text-sm text-gray-600 mt-1">Net Profit</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-purple-100 rounded-lg">
                <PieChart className="h-6 w-6 text-purple-600" />
              </div>
              <div className="text-sm text-gray-600">Healthy</div>
            </div>
            <div className="text-2xl font-bold text-gray-900">{summary.profitMargin}%</div>
            <div className="text-sm text-gray-600 mt-1">Profit Margin</div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          {/* Revenue vs Expenses */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900">Revenue vs Expenses</h3>
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
                <Line type="monotone" dataKey="inflow" stroke="#10b981" strokeWidth={2} name="Inflow" />
                <Line type="monotone" dataKey="outflow" stroke="#f59e0b" strokeWidth={2} name="Outflow" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Expense Breakdown & AR/AP */}
        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-6">Expense Breakdown</h3>
            <ResponsiveContainer width="100%" height={250}>
              <RePieChart>
                <Pie
                  data={expenseBreakdown}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
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
          </div>

          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-6">Accounts Receivable & Payable</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-green-100 rounded-lg">
                    <Receipt className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Accounts Receivable</div>
                    <div className="text-2xl font-bold text-gray-900">AED {summary.outstandingAR.toLocaleString()}</div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Invoices Sent</span>
                    <span className="font-medium">{summary.invoicesSent}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Average Days</span>
                    <span className="font-medium">28 days</span>
                  </div>
                  <button
                    onClick={() => navigate('/invoices')}
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
                    <div className="text-sm text-gray-600">Accounts Payable</div>
                    <div className="text-2xl font-bold text-gray-900">AED {summary.outstandingAP.toLocaleString()}</div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Bills Received</span>
                    <span className="font-medium">{summary.invoicesReceived}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Average Days</span>
                    <span className="font-medium">22 days</span>
                  </div>
                  <button
                    onClick={() => navigate('/ap/inbox')}
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
            <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Transactions</h3>
            <div className="space-y-3">
              {recentInvoices.map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${invoice.type === 'sent' ? 'bg-green-100' : 'bg-orange-100'}`}>
                      {invoice.type === 'sent' ? (
                        <ArrowUpRight className="h-4 w-4 text-green-600" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4 text-orange-600" />
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-sm text-gray-900">{invoice.number}</div>
                      <div className="text-xs text-gray-600">{invoice.customer || invoice.supplier}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-sm text-gray-900">AED {invoice.amount.toLocaleString()}</div>
                    <div className={`text-xs ${
                      invoice.status === 'paid' ? 'text-green-600' :
                      invoice.status === 'overdue' ? 'text-red-600' :
                      'text-yellow-600'
                    }`}>
                      {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Top Customers</h3>
            <div className="space-y-4">
              {topCustomers.map((customer, index) => (
                <div key={index}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium text-sm text-gray-900">{customer.name}</div>
                    <div className="text-sm font-medium text-gray-900">AED {customer.revenue.toLocaleString()}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${(customer.revenue / topCustomers[0].revenue) * 100}%` }}
                      />
                    </div>
                    <div className="text-xs text-gray-600">{customer.invoices} invoices</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
