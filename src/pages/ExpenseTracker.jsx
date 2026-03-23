import { useState, useEffect, useMemo } from "react";
import apiClient from "../lib/api";
import Sidebar from "../components/Sidebar";
import {
  Plus,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Tag,
  X,
  Search,
  } from "lucide-react";
import { Edit3, Trash2 } from "lucide-react";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

const ExpenseTracker = () => {
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [summary, setSummary] = useState(null);
  const [q, setQ] = useState("");
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7),
  );
  const [categoryFilter, setCategoryFilter] = useState("_all");

  const [newExpense, setNewExpense] = useState({
    expense_date: new Date().toISOString().slice(0, 10),
    category: "",
    amount: "",
    vat_amount: "",
    description: "",
    supplier_name: "",
  });

  const [newCategory, setNewCategory] = useState({
    name: "",
    description: "",
  });
  const [showManageCategories, setShowManageCategories] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingExpense, setEditingExpense] = useState(null);

  useEffect(() => {
    loadCategories();
    loadExpenses(categoryFilter);
    loadSummary();
  }, [selectedMonth]);

  const loadCategories = async () => {
    try {
      const res = await apiClient.get("/expense-categories");
      setCategories(res.data.categories || []);
    } catch (err) {
      console.error("Error loading categories:", err);
    }
  };

  const loadExpenses = async (category = "_all") => {
    try {
      const params = { month: selectedMonth };
      if (category && category !== "_all") params.category = category;

      const res = await apiClient.get("/expenses", { params });
      setExpenses(res.data.expenses || []);
    } catch (err) {
      console.error("Error loading expenses:", err);
    }
  };

  const loadSummary = async () => {
    try {
      const res = await apiClient.get("/expenses/summary", {
        params: { month: selectedMonth },
      });
      setSummary(res.data);
    } catch (err) {
      console.error("Error loading summary:", err);
    }
  };

  // Reload expenses when categoryFilter changes
  useEffect(() => {
    loadExpenses(categoryFilter);
  }, [categoryFilter, selectedMonth]);

  // Client-side filtered view by supplier or description
  const filteredExpenses = useMemo(() => {
    const term = (q || "").trim().toLowerCase();
    if (!term) return expenses;
    return expenses.filter((exp) => {
      const supplier = (exp.supplier_name || "").toLowerCase();
      const desc = (exp.description || "").toLowerCase();
      return supplier.includes(term) || desc.includes(term);
    });
  }, [expenses, q]);

  const createExpense = async (e) => {
    e.preventDefault();

    const formData = new URLSearchParams();
    Object.keys(newExpense).forEach((key) => {
      if (newExpense[key]) formData.append(key, newExpense[key]);
    });

    try {
      if (editingExpense) {
        await apiClient.put(`/expenses/${editingExpense.id}`, formData, {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });
      } else {
        await apiClient.post("/expenses", formData, {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });
      }

      setShowExpenseForm(false);
      setEditingExpense(null);
      setNewExpense({
        expense_date: new Date().toISOString().slice(0, 10),
        category: "",
        amount: "",
        vat_amount: "",
        description: "",
        supplier_name: "",
      });
      loadExpenses(categoryFilter);
      loadSummary();
    } catch (err) {
      alert(
        "Error creating expense: " +
          (err.response?.data?.detail || err.message),
      );
    }
  };

  const createCategory = async (e) => {
    e.preventDefault();

    const formData = new URLSearchParams();
    formData.append("name", newCategory.name);
    if (newCategory.description)
      formData.append("description", newCategory.description);

    try {
      if (editingCategory) {
        await apiClient.put(`/expense-categories/${editingCategory.id}`, formData, {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });
      } else {
        await apiClient.post("/expense-categories", formData, {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });
      }

      setShowCategoryForm(false);
      setEditingCategory(null);
      setNewCategory({ name: "", description: "" });
      loadCategories();
    } catch (err) {
      alert(
        "Error creating category: " +
          (err.response?.data?.detail || err.message),
      );
    }
  };

  // Category management helpers
  const openEditCategory = (cat) => {
    setEditingCategory(cat);
    setNewCategory({ name: cat.name, description: cat.description || "" });
    // Close manage modal so the edit modal appears on top
    setShowManageCategories(false);
    setShowCategoryForm(true);
  };

  const deleteCategory = async (cat) => {
    if (!confirm(`Delete category '${cat.name}'? This cannot be undone.`)) return;
    try {
      await apiClient.delete(`/expense-categories/${cat.id}`);
      loadCategories();
      setCategoryFilter("_all");
      loadExpenses("_all");
    } catch (err) {
      alert("Failed to delete category: " + (err.response?.data?.detail || err.message));
    }
  };

  // Expense edit/delete helpers
  const openEditExpense = (expense) => {
    setEditingExpense(expense);
    setNewExpense({
      expense_date: expense.expense_date,
      category: expense.category,
      amount: expense.amount,
      vat_amount: expense.vat_amount,
      description: expense.description,
      supplier_name: expense.supplier_name,
    });
    setShowExpenseForm(true);
  };

  const deleteExpense = async (expense) => {
    if (!confirm(`Delete expense on ${expense.expense_date}?`)) return;
    try {
      await apiClient.delete(`/expenses/${expense.id}`);
      loadExpenses(categoryFilter);
      loadSummary();
    } catch (err) {
      alert("Failed to delete expense: " + (err.response?.data?.detail || err.message));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />
      <div className="flex-1 ml-64">
        <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Expense Tracking</h1>
        <div className="flex gap-3">
          <button
            onClick={() => { setEditingCategory(null); setNewCategory({ name: "", description: "" }); setShowCategoryForm(true); }}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2"
          >
            <Tag className="h-4 w-4" />
            New Category
          </button>
          <button
            onClick={() => setShowManageCategories(true)}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 flex items-center gap-2"
          >
            <Edit3 className="h-4 w-4" />
            Manage Categories
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
        <label className="text-sm font-medium text-gray-700 mb-2 block">
          Select Month
        </label>
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg"
        />
      </div>

      {/* Search & Filter */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:gap-4">
        <div className="flex-1 flex items-center gap-2">
          <Search className="text-gray-400" />
          <Input
            placeholder="Search supplier or description..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="max-w-lg"
          />
          {q && (
            <button
              onClick={() => setQ("")}
              className="ml-2 text-sm text-gray-500 hover:text-gray-700"
            >
              Clear
            </button>
          )}
        </div>

        <div className="w-64 mt-3 md:mt-0">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.name}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Financial Summary */}
      {/* {summary && (
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Revenue</span>
              <TrendingUp className="h-5 w-5 text-green-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              AED {summary.revenue?.total?.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {summary.revenue?.invoice_count} invoices
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Expenses</span>
              <TrendingDown className="h-5 w-5 text-red-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              AED {summary.summary?.total_costs?.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {summary.expenses?.expense_count} expenses | Base AED {summary.expenses?.total?.toLocaleString()} + VAT AED {summary.expenses?.vat_paid?.toLocaleString()}
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Net Income</span>
              <DollarSign className="h-5 w-5 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-blue-600">
              AED {summary.summary?.net_income?.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {summary.summary?.profit_margin_percent}% margin
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">
                Net VAT {summary.vat_details?.vat_status}
              </span>
              <Calendar className="h-5 w-5 text-purple-500" />
            </div>
            <p className="text-2xl font-bold text-purple-600">
              AED {summary.vat_details?.net_vat?.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Output: {summary.vat_details?.output_vat} | Input:{" "}
              {summary.vat_details?.input_vat}
            </p>
          </div>
        </div>
      )} */}

      {/* Expenses List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">
            Expense Records ({filteredExpenses.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Supplier
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Amount
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  VAT
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Total
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredExpenses.map((expense) => (
                <tr key={expense.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {expense.expense_date}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                      {expense.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {expense.description || "-"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {expense.supplier_name || "-"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 text-right">
                    AED {expense.amount?.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 text-right">
                    AED {expense.vat_amount?.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 text-right">
                    AED {expense.total_amount?.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEditExpense(expense)} className="p-2 rounded hover:bg-gray-100">
                        <Edit3 className="h-4 w-4 text-gray-600" />
                      </button>
                      <button onClick={() => deleteExpense(expense)} className="p-2 rounded hover:bg-gray-100">
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredExpenses.length === 0 && (
                <tr>
                  <td
                    colSpan="8"
                    className="px-6 py-12 text-center text-gray-500"
                  >
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
              <h3 className="text-lg font-bold text-gray-900">
                Record Expense
              </h3>
              <button
                onClick={() => setShowExpenseForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={createExpense} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={newExpense.expense_date}
                  onChange={(e) =>
                    setNewExpense({
                      ...newExpense,
                      expense_date: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  value={newExpense.category}
                  onChange={(e) =>
                    setNewExpense({ ...newExpense, category: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                >
                  <option value="">Select category...</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.name}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount (excl. VAT)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={newExpense.amount}
                  onChange={(e) =>
                    setNewExpense({ ...newExpense, amount: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  VAT Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={newExpense.vat_amount}
                  onChange={(e) =>
                    setNewExpense({ ...newExpense, vat_amount: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={newExpense.description}
                  onChange={(e) =>
                    setNewExpense({
                      ...newExpense,
                      description: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Supplier Name
                </label>
                <input
                  type="text"
                  value={newExpense.supplier_name}
                  onChange={(e) =>
                    setNewExpense({
                      ...newExpense,
                      supplier_name: e.target.value,
                    })
                  }
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

      {/* New / Edit Category Modal */}
      {showCategoryForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">{editingCategory ? 'Edit Category' : 'New Category'}</h3>
              <button
                onClick={() => setShowCategoryForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={createCategory} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category Name
                </label>
                <input
                  type="text"
                  value={newCategory.name}
                  onChange={(e) =>
                    setNewCategory({ ...newCategory, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="e.g., Laundry Services"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={newCategory.description}
                  onChange={(e) =>
                    setNewCategory({
                      ...newCategory,
                      description: e.target.value,
                    })
                  }
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
                  {editingCategory ? 'Save Category' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Manage Categories Modal */}
      {showManageCategories && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Manage Categories</h3>
              <button onClick={() => setShowManageCategories(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-3">
              {categories.length === 0 && (
                <div className="text-sm text-gray-500">No categories found</div>
              )}
              {categories.map((cat) => (
                <div key={cat.id} className="flex items-center justify-between p-2 border rounded">
                  <div>
                    <div className="font-medium">{cat.name}</div>
                    {cat.description && <div className="text-xs text-gray-500">{cat.description}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEditCategory(cat)} className="p-2 rounded hover:bg-gray-100">
                      <Edit3 className="h-4 w-4 text-gray-600" />
                    </button>
                    <button onClick={() => deleteCategory(cat)} className="p-2 rounded hover:bg-gray-100">
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
  );
};

export default ExpenseTracker;
