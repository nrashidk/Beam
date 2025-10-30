import { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, TrendingUp, TrendingDown, DollarSign, Calendar, Tag, X } from 'lucide-react';

const ExpenseTracker = () => {
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [summary, setSummary] = useState(null);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  const [newExpense, setNewExpense] = useState({
    expense_date: new Date().toISOString().slice(0, 10),
    category: '',
    amount: '',
    vat_amount: '',
    description: '',
    supplier_name: ''
  });

  const [newCategory, setNewCategory] = useState({
    name: '',
    description: ''
  });

  const token = localStorage.getItem('token');
  const API_URL = 'http://localhost:8000';

  useEffect(() => {
    loadCategories();
    loadExpenses();
    loadSummary();
  }, [selectedMonth]);

  const loadCategories = async () => {
    try {
      const res = await axios.get(`${API_URL}/expense-categories`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCategories(res.data.categories || []);
    } catch (err) {
      console.error('Error loading categories:', err);
    }
  };

  const loadExpenses = async () => {
    try {
      const res = await axios.get(`${API_URL}/expenses?month=${selectedMonth}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setExpenses(res.data.expenses || []);
    } catch (err) {
      console.error('Error loading expenses:', err);
    }
  };

  const loadSummary = async () => {
    try {
      const res = await axios.get(`${API_URL}/expenses/summary?month=${selectedMonth}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSummary(res.data);
    } catch (err) {
      console.error('Error loading summary:', err);
    }
  };

  const createExpense = async (e) => {
    e.preventDefault();
    
    const formData = new URLSearchParams();
    Object.keys(newExpense).forEach(key => {
      if (newExpense[key]) formData.append(key, newExpense[key]);
    });

    try {
      await axios.post(`${API_URL}/expenses`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      
      setShowExpenseForm(false);
      setNewExpense({
        expense_date: new Date().toISOString().slice(0, 10),
        category: '',
        amount: '',
        vat_amount: '',
        description: '',
        supplier_name: ''
      });
      loadExpenses();
      loadSummary();
    } catch (err) {
      alert('Error creating expense: ' + (err.response?.data?.detail || err.message));
    }
  };

  const createCategory = async (e) => {
    e.preventDefault();
    
    const formData = new URLSearchParams();
    formData.append('name', newCategory.name);
    if (newCategory.description) formData.append('description', newCategory.description);

    try {
      await axios.post(`${API_URL}/expense-categories`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      
      setShowCategoryForm(false);
      setNewCategory({ name: '', description: '' });
      loadCategories();
    } catch (err) {
      alert('Error creating category: ' + (err.response?.data?.detail || err.message));
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Expense Tracking</h1>
        <div className="flex gap-3">
          <button
            onClick={() => setShowCategoryForm(true)}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2"
          >
            <Tag className="h-4 w-4" />
            New Category
          </button>
          <button
            onClick={() => setShowExpenseForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Record Expense
          </button>
        </div>
      </div>

      {/* Month Selector */}
      <div className="mb-6">
        <label className="text-sm font-medium text-gray-700 mb-2 block">Select Month</label>
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg"
        />
      </div>

      {/* Financial Summary */}
      {summary && (
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Revenue</span>
              <TrendingUp className="h-5 w-5 text-green-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">AED {summary.revenue?.total?.toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">{summary.revenue?.invoice_count} invoices</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Expenses</span>
              <TrendingDown className="h-5 w-5 text-red-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">AED {summary.expenses?.total?.toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">{summary.expenses?.expense_count} expenses</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Net Income</span>
              <DollarSign className="h-5 w-5 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-blue-600">AED {summary.summary?.net_income?.toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">{summary.summary?.profit_margin_percent}% margin</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Net VAT {summary.vat_details?.vat_status}</span>
              <Calendar className="h-5 w-5 text-purple-500" />
            </div>
            <p className="text-2xl font-bold text-purple-600">AED {summary.vat_details?.net_vat?.toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">Output: {summary.vat_details?.output_vat} | Input: {summary.vat_details?.input_vat}</p>
          </div>
        </div>
      )}

      {/* Expenses List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Expense Records ({expenses.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">VAT</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {expenses.map((expense) => (
                <tr key={expense.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">{expense.expense_date}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                      {expense.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{expense.description || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{expense.supplier_name || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-900 text-right">AED {expense.amount?.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 text-right">AED {expense.vat_amount?.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 text-right">AED {expense.total_amount?.toLocaleString()}</td>
                </tr>
              ))}
              {expenses.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                    No expenses recorded for this month
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Expense Modal */}
      {showExpenseForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Record Expense</h3>
              <button onClick={() => setShowExpenseForm(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={createExpense} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={newExpense.expense_date}
                  onChange={(e) => setNewExpense({ ...newExpense, expense_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={newExpense.category}
                  onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                >
                  <option value="">Select category...</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (excl. VAT)</label>
                <input
                  type="number"
                  step="0.01"
                  value={newExpense.amount}
                  onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">VAT Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={newExpense.vat_amount}
                  onChange={(e) => setNewExpense({ ...newExpense, vat_amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={newExpense.description}
                  onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Supplier Name</label>
                <input
                  type="text"
                  value={newExpense.supplier_name}
                  onChange={(e) => setNewExpense({ ...newExpense, supplier_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowExpenseForm(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Category Modal */}
      {showCategoryForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">New Category</h3>
              <button onClick={() => setShowCategoryForm(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={createCategory} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category Name</label>
                <input
                  type="text"
                  value={newCategory.name}
                  onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="e.g., Laundry Services"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={newCategory.description}
                  onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Optional description"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCategoryForm(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Create Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpenseTracker;
