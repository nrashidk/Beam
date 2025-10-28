import React, { useState } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { X, Plus, Trash2 } from 'lucide-react';

export default function POFormModal({ isOpen, onClose, onSubmit, initialData = null }) {
  const [formData, setFormData] = useState(initialData || {
    po_number: '',
    supplier_trn: '',
    supplier_name: '',
    supplier_contact_email: '',
    supplier_address: '',
    supplier_peppol_id: '',
    order_date: new Date().toISOString().split('T')[0],
    expected_delivery_date: '',
    delivery_address: '',
    currency_code: 'AED',
    reference_number: '',
    notes: '',
    line_items: [
      {
        line_number: 1,
        item_name: '',
        item_description: '',
        item_code: '',
        quantity_ordered: 1,
        unit_code: 'C62',
        unit_price: 0,
        tax_category: 'STANDARD',
        tax_percent: 5.0
      }
    ]
  });

  const [errors, setErrors] = useState({});

  if (!isOpen) return null;

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const handleLineItemChange = (index, field, value) => {
    setFormData(prev => {
      const newLineItems = [...prev.line_items];
      newLineItems[index] = { ...newLineItems[index], [field]: value };
      return { ...prev, line_items: newLineItems };
    });
  };

  const addLineItem = () => {
    const newLineNumber = formData.line_items.length + 1;
    setFormData(prev => ({
      ...prev,
      line_items: [
        ...prev.line_items,
        {
          line_number: newLineNumber,
          item_name: '',
          item_description: '',
          item_code: '',
          quantity_ordered: 1,
          unit_code: 'C62',
          unit_price: 0,
          tax_category: 'STANDARD',
          tax_percent: 5.0
        }
      ]
    }));
  };

  const removeLineItem = (index) => {
    if (formData.line_items.length === 1) {
      alert('At least one line item is required');
      return;
    }
    setFormData(prev => {
      const newLineItems = prev.line_items.filter((_, i) => i !== index);
      return {
        ...prev,
        line_items: newLineItems.map((item, i) => ({ ...item, line_number: i + 1 }))
      };
    });
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let tax = 0;

    formData.line_items.forEach(item => {
      const lineTotal = item.quantity_ordered * item.unit_price;
      const lineTax = lineTotal * (item.tax_percent / 100);
      subtotal += lineTotal;
      tax += lineTax;
    });

    return {
      subtotal: subtotal.toFixed(2),
      tax: tax.toFixed(2),
      total: (subtotal + tax).toFixed(2)
    };
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.po_number.trim()) newErrors.po_number = 'PO number is required';
    if (!formData.supplier_trn.trim()) newErrors.supplier_trn = 'Supplier TRN is required';
    if (!formData.supplier_name.trim()) newErrors.supplier_name = 'Supplier name is required';
    if (!formData.order_date) newErrors.order_date = 'Order date is required';

    formData.line_items.forEach((item, index) => {
      if (!item.item_name.trim()) {
        newErrors[`line_item_${index}_name`] = 'Item name is required';
      }
      if (item.quantity_ordered <= 0) {
        newErrors[`line_item_${index}_quantity`] = 'Quantity must be greater than 0';
      }
      if (item.unit_price < 0) {
        newErrors[`line_item_${index}_price`] = 'Price cannot be negative';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) {
      alert('Please fix the errors in the form');
      return;
    }

    onSubmit(formData);
  };

  const totals = calculateTotals();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-6xl max-h-[95vh] overflow-y-auto">
        <CardContent className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              {initialData ? 'Edit Purchase Order' : 'Create Purchase Order'}
            </h2>
            <Button onClick={onClose} variant="ghost" size="sm">
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Supplier Information */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Supplier Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Supplier TRN <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  value={formData.supplier_trn}
                  onChange={(e) => handleInputChange('supplier_trn', e.target.value)}
                  placeholder="123456789012345"
                  className={errors.supplier_trn ? 'border-red-500' : ''}
                />
                {errors.supplier_trn && <p className="text-red-500 text-xs mt-1">{errors.supplier_trn}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Supplier Name <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  value={formData.supplier_name}
                  onChange={(e) => handleInputChange('supplier_name', e.target.value)}
                  placeholder="Acme Corporation"
                  className={errors.supplier_name ? 'border-red-500' : ''}
                />
                {errors.supplier_name && <p className="text-red-500 text-xs mt-1">{errors.supplier_name}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Email
                </label>
                <Input
                  type="email"
                  value={formData.supplier_contact_email}
                  onChange={(e) => handleInputChange('supplier_contact_email', e.target.value)}
                  placeholder="supplier@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  PEPPOL ID
                </label>
                <Input
                  type="text"
                  value={formData.supplier_peppol_id}
                  onChange={(e) => handleInputChange('supplier_peppol_id', e.target.value)}
                  placeholder="0195:123456789"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Supplier Address
                </label>
                <textarea
                  value={formData.supplier_address}
                  onChange={(e) => handleInputChange('supplier_address', e.target.value)}
                  placeholder="Full supplier address"
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                  rows="2"
                />
              </div>
            </div>
          </div>

          {/* PO Details */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Purchase Order Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  PO Number <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  value={formData.po_number}
                  onChange={(e) => handleInputChange('po_number', e.target.value)}
                  placeholder="PO-2025-001"
                  className={errors.po_number ? 'border-red-500' : ''}
                />
                {errors.po_number && <p className="text-red-500 text-xs mt-1">{errors.po_number}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Order Date <span className="text-red-500">*</span>
                </label>
                <Input
                  type="date"
                  value={formData.order_date}
                  onChange={(e) => handleInputChange('order_date', e.target.value)}
                  className={errors.order_date ? 'border-red-500' : ''}
                />
                {errors.order_date && <p className="text-red-500 text-xs mt-1">{errors.order_date}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expected Delivery
                </label>
                <Input
                  type="date"
                  value={formData.expected_delivery_date}
                  onChange={(e) => handleInputChange('expected_delivery_date', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reference Number
                </label>
                <Input
                  type="text"
                  value={formData.reference_number}
                  onChange={(e) => handleInputChange('reference_number', e.target.value)}
                  placeholder="REF-123"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Delivery Address
                </label>
                <Input
                  type="text"
                  value={formData.delivery_address}
                  onChange={(e) => handleInputChange('delivery_address', e.target.value)}
                  placeholder="Delivery address"
                />
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Line Items</h3>
              <Button onClick={addLineItem} size="sm" className="bg-indigo-600 hover:bg-indigo-700">
                <Plus className="w-4 h-4 mr-2" />
                Add Item
              </Button>
            </div>

            <div className="space-y-4">
              {formData.line_items.map((item, index) => (
                <div key={index} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-medium text-gray-700">Item #{item.line_number}</span>
                    {formData.line_items.length > 1 && (
                      <Button
                        onClick={() => removeLineItem(index)}
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Item Name <span className="text-red-500">*</span>
                      </label>
                      <Input
                        type="text"
                        value={item.item_name}
                        onChange={(e) => handleLineItemChange(index, 'item_name', e.target.value)}
                        placeholder="Product/Service name"
                        className={errors[`line_item_${index}_name`] ? 'border-red-500' : ''}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Item Code/SKU
                      </label>
                      <Input
                        type="text"
                        value={item.item_code}
                        onChange={(e) => handleLineItemChange(index, 'item_code', e.target.value)}
                        placeholder="SKU-123"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Unit Code
                      </label>
                      <select
                        value={item.unit_code}
                        onChange={(e) => handleLineItemChange(index, 'unit_code', e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      >
                        <option value="C62">Unit</option>
                        <option value="MTR">Meter</option>
                        <option value="KGM">Kilogram</option>
                        <option value="LTR">Liter</option>
                        <option value="HUR">Hour</option>
                        <option value="DAY">Day</option>
                      </select>
                    </div>
                    <div className="md:col-span-4">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Description
                      </label>
                      <Input
                        type="text"
                        value={item.item_description}
                        onChange={(e) => handleLineItemChange(index, 'item_description', e.target.value)}
                        placeholder="Item description"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Quantity <span className="text-red-500">*</span>
                      </label>
                      <Input
                        type="number"
                        value={item.quantity_ordered}
                        onChange={(e) => handleLineItemChange(index, 'quantity_ordered', parseFloat(e.target.value) || 0)}
                        min="0"
                        step="0.01"
                        className={errors[`line_item_${index}_quantity`] ? 'border-red-500' : ''}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Unit Price (AED) <span className="text-red-500">*</span>
                      </label>
                      <Input
                        type="number"
                        value={item.unit_price}
                        onChange={(e) => handleLineItemChange(index, 'unit_price', parseFloat(e.target.value) || 0)}
                        min="0"
                        step="0.01"
                        className={errors[`line_item_${index}_price`] ? 'border-red-500' : ''}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Tax %
                      </label>
                      <Input
                        type="number"
                        value={item.tax_percent}
                        onChange={(e) => handleLineItemChange(index, 'tax_percent', parseFloat(e.target.value) || 0)}
                        min="0"
                        max="100"
                        step="0.1"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Line Total
                      </label>
                      <div className="flex items-center h-10 px-3 py-2 bg-gray-100 rounded-md border border-gray-300">
                        <span className="text-sm font-semibold text-gray-900">
                          {((item.quantity_ordered * item.unit_price) * (1 + item.tax_percent / 100)).toFixed(2)} AED
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes / Terms & Conditions
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Additional notes or terms"
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              rows="3"
            />
          </div>

          {/* Totals */}
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-4 mb-6">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-sm text-gray-600">Subtotal</p>
                <p className="text-xl font-bold text-gray-900">{totals.subtotal} AED</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Tax</p>
                <p className="text-xl font-bold text-gray-900">{totals.tax} AED</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total</p>
                <p className="text-2xl font-bold text-indigo-600">{totals.total} AED</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button onClick={onClose} variant="outline">
              Cancel
            </Button>
            <Button onClick={handleSubmit} className="bg-indigo-600 hover:bg-indigo-700">
              {initialData ? 'Update Purchase Order' : 'Create Purchase Order'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
