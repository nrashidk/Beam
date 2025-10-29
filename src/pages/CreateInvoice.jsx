import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/api';
import { EmailInput, TRNInput } from '../components/ui/validated-input';
import { ArrowLeft, Plus, Trash2, Save, FileText } from 'lucide-react';

export default function CreateInvoice() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    invoice_type: '380',
    issue_date: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    currency_code: 'AED',
    customer_name: '',
    customer_email: '',
    customer_trn: '',
    customer_address: '',
    customer_city: '',
    payment_due_days: 30,
    invoice_notes: '',
    reference_number: '',
    line_items: [
      { item_name: '', item_description: '', quantity: 1, unit_price: 0, tax_category: 'S', tax_percent: 5.0 }
    ]
  });

  const addLineItem = () => {
    setFormData({
      ...formData,
      line_items: [
        ...formData.line_items,
        { item_name: '', item_description: '', quantity: 1, unit_price: 0, tax_category: 'S', tax_percent: 5.0 }
      ]
    });
  };

  const removeLineItem = (index) => {
    if (formData.line_items.length > 1) {
      setFormData({
        ...formData,
        line_items: formData.line_items.filter((_, i) => i !== index)
      });
    }
  };

  const updateLineItem = (index, field, value) => {
    const newItems = [...formData.line_items];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({ ...formData, line_items: newItems });
  };

  const calculateTotal = () => {
    return formData.line_items.reduce((total, item) => {
      const subtotal = item.quantity * item.unit_price;
      const tax = item.tax_category === 'S' ? subtotal * (item.tax_percent / 100) : 0;
      return total + subtotal + tax;
    }, 0);
  };

  const calculateSubtotal = () => {
    return formData.line_items.reduce((total, item) => {
      return total + (item.quantity * item.unit_price);
    }, 0);
  };

  const calculateTax = () => {
    return formData.line_items.reduce((total, item) => {
      const subtotal = item.quantity * item.unit_price;
      return total + (item.tax_category === 'S' ? subtotal * (item.tax_percent / 100) : 0);
    }, 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('Form submitted, starting invoice creation...');
    console.log('Form data:', formData);
    setLoading(true);

    try {
      console.log('Sending POST request to /invoices...');
      const response = await apiClient.post('/invoices', formData);
      console.log('Invoice created successfully:', response.data);
      alert(`Invoice ${response.data.invoice_number} created successfully!`);
      navigate(`/invoices/${response.data.id}`);
    } catch (error) {
      console.error('Failed to create invoice - Full error:', error);
      console.error('Error response:', error.response);
      console.error('Error message:', error.message);
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to create invoice';
      alert(`Error: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <button
          onClick={() => navigate('/invoices')}
          className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-medium mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Invoices
        </button>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-indigo-50 rounded-xl">
              <FileText className="w-8 h-8 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Create New Invoice</h1>
              <p className="text-gray-600">UAE PINT-AE compliant e-invoice</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Invoice Details */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Invoice Details</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Invoice Type</label>
                  <select
                    value={formData.invoice_type}
                    onChange={(e) => setFormData({ ...formData, invoice_type: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="380">Tax Invoice (380)</option>
                    <option value="381">Credit Note (381)</option>
                    <option value="480">Commercial Invoice (480)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Currency</label>
                  <input
                    type="text"
                    value={formData.currency_code}
                    onChange={(e) => setFormData({ ...formData, currency_code: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Issue Date</label>
                  <input
                    type="date"
                    value={formData.issue_date}
                    onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Due Date</label>
                  <input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Customer Details */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Customer Details</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Customer Name *</label>
                  <input
                    type="text"
                    value={formData.customer_name}
                    onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Customer Email</label>
                  <EmailInput
                    value={formData.customer_email}
                    onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Customer TRN (15 digits)</label>
                  <TRNInput
                    value={formData.customer_trn}
                    onChange={(e) => setFormData({ ...formData, customer_trn: e.target.value })}
                    placeholder="100123456700003"
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                  <input
                    type="text"
                    value={formData.customer_city}
                    onChange={(e) => setFormData({ ...formData, customer_city: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                  <input
                    type="text"
                    value={formData.customer_address}
                    onChange={(e) => setFormData({ ...formData, customer_address: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Line Items */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Line Items</h2>
                <button
                  type="button"
                  onClick={addLineItem}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Add Item
                </button>
              </div>

              {formData.line_items.map((item, index) => (
                <div key={index} className="bg-gray-50 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-gray-700">Item #{index + 1}</span>
                    {formData.line_items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeLineItem(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <input
                        type="text"
                        placeholder="Item name *"
                        value={item.item_name}
                        onChange={(e) => updateLineItem(index, 'item_name', e.target.value)}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>

                    <div className="col-span-2">
                      <input
                        type="text"
                        placeholder="Description (optional)"
                        value={item.item_description}
                        onChange={(e) => updateLineItem(index, 'item_description', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>

                    <input
                      type="number"
                      placeholder="Quantity"
                      value={item.quantity}
                      onChange={(e) => updateLineItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                      step="0.01"
                      required
                      className="px-3 py-2 border border-gray-300 rounded-lg"
                    />

                    <input
                      type="number"
                      placeholder="Unit Price (AED)"
                      value={item.unit_price}
                      onChange={(e) => updateLineItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                      step="0.01"
                      required
                      className="px-3 py-2 border border-gray-300 rounded-lg"
                    />

                    <select
                      value={item.tax_category}
                      onChange={(e) => updateLineItem(index, 'tax_category', e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="S">Standard (5%)</option>
                      <option value="Z">Zero Rated</option>
                      <option value="E">Exempt</option>
                      <option value="O">Out of Scope</option>
                    </select>

                    <div className="text-right">
                      <span className="text-sm text-gray-600">Line Total: </span>
                      <span className="font-semibold">AED {((item.quantity * item.unit_price) * (1 + (item.tax_category === 'S' ? item.tax_percent / 100 : 0))).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="bg-indigo-50 rounded-xl p-6">
              <div className="space-y-2 text-right max-w-md ml-auto">
                <div className="flex justify-between text-gray-700">
                  <span>Subtotal:</span>
                  <span className="font-semibold">AED {calculateSubtotal().toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-700">
                  <span>VAT (5%):</span>
                  <span className="font-semibold">AED {calculateTax().toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-2xl font-bold text-indigo-900 pt-2 border-t-2 border-indigo-200">
                  <span>Total:</span>
                  <span>AED {calculateTotal().toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Invoice Notes</label>
              <textarea
                value={formData.invoice_notes}
                onChange={(e) => setFormData({ ...formData, invoice_notes: e.target.value })}
                rows="3"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Additional notes or terms..."
              />
            </div>

            {/* Submit */}
            <div className="flex gap-4 justify-end">
              <button
                type="button"
                onClick={() => navigate('/invoices')}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              >
                <Save className="w-5 h-5" />
                {loading ? 'Creating...' : 'Create Invoice'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
