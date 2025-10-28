import React, { useState, useEffect } from 'react';
import { apAPI } from '../lib/api';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { X, FileText, Calendar, MapPin, Mail, Building2, CheckCircle, Send, Trash2 } from 'lucide-react';

export default function PODetailModal({ poId, isOpen, onClose, onUpdate }) {
  const [po, setPO] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && poId) {
      fetchPODetails();
    }
  }, [poId, isOpen]);

  const fetchPODetails = async () => {
    try {
      setLoading(true);
      const response = await apAPI.getPurchaseOrder(poId);
      setPO(response.data);
    } catch (err) {
      setError('Failed to load PO details');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const getStatusBadge = (status) => {
    const statusConfig = {
      DRAFT: { color: 'bg-gray-100 text-gray-800', icon: FileText, label: 'Draft' },
      SENT: { color: 'bg-blue-100 text-blue-800', icon: Send, label: 'Sent' },
      ACKNOWLEDGED: { color: 'bg-purple-100 text-purple-800', icon: CheckCircle, label: 'Acknowledged' },
      FULFILLED: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Fulfilled' },
      CANCELLED: { color: 'bg-red-100 text-red-800', icon: X, label: 'Cancelled' }
    };
    
    const config = statusConfig[status] || statusConfig.DRAFT;
    const Icon = config.icon;
    
    return (
      <Badge className={`${config.color} flex items-center gap-1`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  const formatCurrency = (amount, currency = 'AED') => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-AE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-5xl max-h-[95vh] overflow-y-auto">
        <CardContent className="p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="text-gray-600 mt-4">Loading purchase order...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-600 font-semibold mb-4">{error}</p>
              <Button onClick={onClose}>Close</Button>
            </div>
          ) : po ? (
            <>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Purchase Order: {po.po_number}
                  </h2>
                  {getStatusBadge(po.status)}
                </div>
                <Button onClick={onClose} variant="ghost" size="sm">
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* PO Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg">
                <div>
                  <p className="text-sm text-gray-600 flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Order Date
                  </p>
                  <p className="text-lg font-semibold text-gray-900">{formatDate(po.order_date)}</p>
                </div>
                {po.expected_delivery_date && (
                  <div>
                    <p className="text-sm text-gray-600 flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      Expected Delivery
                    </p>
                    <p className="text-lg font-semibold text-gray-900">{formatDate(po.expected_delivery_date)}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-600">Total Amount</p>
                  <p className="text-2xl font-bold text-indigo-600">
                    {formatCurrency(po.expected_total, po.currency_code)}
                  </p>
                </div>
              </div>

              {/* Supplier Information */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-indigo-600" />
                  Supplier Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm text-gray-600">Supplier Name</p>
                    <p className="font-semibold text-gray-900">{po.supplier_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">TRN</p>
                    <p className="font-medium text-gray-900">{po.supplier_trn}</p>
                  </div>
                  {po.supplier_contact_email && (
                    <div>
                      <p className="text-sm text-gray-600 flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        Contact Email
                      </p>
                      <p className="font-medium text-gray-900">{po.supplier_contact_email}</p>
                    </div>
                  )}
                  {po.supplier_peppol_id && (
                    <div>
                      <p className="text-sm text-gray-600">PEPPOL ID</p>
                      <p className="font-medium text-gray-900">{po.supplier_peppol_id}</p>
                    </div>
                  )}
                  {po.supplier_address && (
                    <div className="md:col-span-2">
                      <p className="text-sm text-gray-600 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        Address
                      </p>
                      <p className="font-medium text-gray-900">{po.supplier_address}</p>
                    </div>
                  )}
                  {po.delivery_address && (
                    <div className="md:col-span-2">
                      <p className="text-sm text-gray-600 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        Delivery Address
                      </p>
                      <p className="font-medium text-gray-900">{po.delivery_address}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Line Items */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-600" />
                  Line Items
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Quantity</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Tax %</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {po.line_items && po.line_items.length > 0 ? (
                        po.line_items.map((item) => (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-900">{item.line_number}</td>
                            <td className="px-4 py-3">
                              <div>
                                <p className="font-medium text-gray-900">{item.item_name}</p>
                                {item.item_description && (
                                  <p className="text-xs text-gray-500">{item.item_description}</p>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">{item.item_code || '-'}</td>
                            <td className="px-4 py-3 text-sm text-gray-900 text-right">
                              {item.quantity_ordered} {item.unit_code}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 text-right">
                              {formatCurrency(item.unit_price, po.currency_code)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 text-right">
                              {item.tax_percent}%
                            </td>
                            <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
                              {formatCurrency(item.line_total * (1 + item.tax_percent / 100), po.currency_code)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                            No line items found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Financial Summary */}
              <div className="mb-6">
                <div className="flex justify-end">
                  <div className="w-full md:w-1/3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Subtotal:</span>
                      <span className="font-semibold text-gray-900">
                        {formatCurrency(po.expected_subtotal, po.currency_code)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Tax:</span>
                      <span className="font-semibold text-gray-900">
                        {formatCurrency(po.expected_tax, po.currency_code)}
                      </span>
                    </div>
                    <div className="flex justify-between text-lg border-t pt-2">
                      <span className="font-semibold text-gray-900">Total:</span>
                      <span className="font-bold text-indigo-600">
                        {formatCurrency(po.expected_total, po.currency_code)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Invoice Tracking */}
              {po.received_invoice_count > 0 && (
                <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Invoice Tracking</h3>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Invoices Received</p>
                      <p className="font-semibold text-gray-900">{po.received_invoice_count}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Amount Received</p>
                      <p className="font-semibold text-gray-900">
                        {formatCurrency(po.received_amount_total, po.currency_code)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Variance</p>
                      <p className={`font-semibold ${po.variance_amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(po.variance_amount, po.currency_code)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              {po.notes && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Notes / Terms</h3>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{po.notes}</p>
                  </div>
                </div>
              )}

              {/* Additional Info */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  {po.reference_number && (
                    <div>
                      <p className="text-gray-500">Reference</p>
                      <p className="font-medium text-gray-900">{po.reference_number}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-gray-500">Created</p>
                    <p className="font-medium text-gray-900">{formatDate(po.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Last Updated</p>
                    <p className="font-medium text-gray-900">{formatDate(po.updated_at)}</p>
                  </div>
                  {po.approved_at && (
                    <div>
                      <p className="text-gray-500">Approved</p>
                      <p className="font-medium text-gray-900">{formatDate(po.approved_at)}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3">
                <Button onClick={onClose} variant="outline">
                  Close
                </Button>
                {onUpdate && po.status === 'DRAFT' && (
                  <Button
                    onClick={() => {
                      onUpdate(po);
                      onClose();
                    }}
                    variant="outline"
                  >
                    Edit
                  </Button>
                )}
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
