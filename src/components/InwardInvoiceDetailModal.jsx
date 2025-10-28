import React, { useState, useEffect } from 'react';
import { apAPI } from '../lib/api';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { 
  X, 
  FileText, 
  Calendar, 
  User, 
  CreditCard,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Package,
  DollarSign
} from 'lucide-react';

export default function InwardInvoiceDetailModal({ invoiceId, onClose, onUpdate }) {
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (invoiceId) {
      fetchInvoiceDetails();
    }
  }, [invoiceId]);

  const fetchInvoiceDetails = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await apAPI.getInwardInvoice(invoiceId);
      setInvoice(response.data);
    } catch (err) {
      setError('Failed to load invoice details');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusConfig = (status) => {
    const configs = {
      RECEIVED: { color: 'bg-blue-100 text-blue-800', icon: Clock, label: 'Received' },
      PENDING_REVIEW: { color: 'bg-yellow-100 text-yellow-800', icon: AlertCircle, label: 'Pending Review' },
      MATCHED: { color: 'bg-purple-100 text-purple-800', icon: FileText, label: 'Matched' },
      APPROVED: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Approved' },
      REJECTED: { color: 'bg-red-100 text-red-800', icon: XCircle, label: 'Rejected' },
      PAID: { color: 'bg-emerald-100 text-emerald-800', icon: CheckCircle, label: 'Paid' },
      DISPUTED: { color: 'bg-orange-100 text-orange-800', icon: AlertCircle, label: 'Disputed' },
      CANCELLED: { color: 'bg-gray-100 text-gray-800', icon: XCircle, label: 'Cancelled' }
    };
    return configs[status] || configs.RECEIVED;
  };

  if (!invoiceId) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Invoice Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-gray-600">Loading invoice details...</div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-red-600">{error}</div>
            </div>
          ) : invoice ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    {invoice.supplier_invoice_number}
                  </h3>
                  <p className="text-sm text-gray-600">Invoice Type: {invoice.invoice_type}</p>
                </div>
                {(() => {
                  const config = getStatusConfig(invoice.status);
                  const StatusIcon = config.icon;
                  return (
                    <Badge className={`${config.color} flex items-center gap-1 text-sm px-3 py-1`}>
                      <StatusIcon className="w-4 h-4" />
                      {config.label}
                    </Badge>
                  );
                })()}
              </div>

              <div className="grid grid-cols-2 gap-6 bg-gray-50 p-4 rounded-lg">
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Supplier Information
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-600">Name:</span>
                      <p className="font-medium text-gray-900">{invoice.supplier_name}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">TRN:</span>
                      <p className="font-medium text-gray-900">{invoice.supplier_trn}</p>
                    </div>
                    {invoice.supplier_address && (
                      <div>
                        <span className="text-gray-600">Address:</span>
                        <p className="font-medium text-gray-900">{invoice.supplier_address}</p>
                      </div>
                    )}
                    {invoice.supplier_peppol_id && (
                      <div>
                        <span className="text-gray-600">PEPPOL ID:</span>
                        <p className="font-medium text-gray-900">{invoice.supplier_peppol_id}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Dates &amp; Timeline
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-600">Invoice Date:</span>
                      <p className="font-medium text-gray-900">
                        {new Date(invoice.invoice_date).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600">Due Date:</span>
                      <p className="font-medium text-gray-900">
                        {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600">Received At:</span>
                      <p className="font-medium text-gray-900">
                        {new Date(invoice.received_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Financial Summary
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <span className="text-xs text-gray-600">Subtotal</span>
                    <p className="text-lg font-semibold text-gray-900">
                      {invoice.currency_code} {invoice.subtotal_amount.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-600">Tax Amount</span>
                    <p className="text-lg font-semibold text-gray-900">
                      {invoice.currency_code} {invoice.tax_amount.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-600">Total Amount</span>
                    <p className="text-lg font-bold text-indigo-600">
                      {invoice.currency_code} {invoice.total_amount.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-600">Amount Due</span>
                    <p className="text-lg font-bold text-orange-600">
                      {invoice.currency_code} {invoice.amount_due.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {invoice.line_items && invoice.line_items.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Line Items
                  </h4>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left p-3 font-semibold text-gray-700">Description</th>
                          <th className="text-right p-3 font-semibold text-gray-700">Quantity</th>
                          <th className="text-right p-3 font-semibold text-gray-700">Unit Price</th>
                          <th className="text-right p-3 font-semibold text-gray-700">Tax</th>
                          <th className="text-right p-3 font-semibold text-gray-700">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {invoice.line_items.map((item, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="p-3">
                              <div>
                                <p className="font-medium text-gray-900">{item.description}</p>
                                {item.item_code && (
                                  <p className="text-xs text-gray-500">Code: {item.item_code}</p>
                                )}
                              </div>
                            </td>
                            <td className="text-right p-3">{item.quantity} {item.unit_of_measure}</td>
                            <td className="text-right p-3">{item.unit_price.toFixed(2)}</td>
                            <td className="text-right p-3">{item.tax_amount.toFixed(2)}</td>
                            <td className="text-right p-3 font-semibold">{item.line_total.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {invoice.matching_status && (
                <div className="bg-purple-50 p-4 rounded-lg">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Matching Information</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Matching Status:</span>
                      <p className="font-medium text-gray-900">
                        <Badge className={
                          invoice.matching_status === 'MATCHED' 
                            ? 'bg-green-100 text-green-800' 
                            : invoice.matching_status === 'PARTIALLY_MATCHED'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }>
                          {invoice.matching_status}
                        </Badge>
                      </p>
                    </div>
                    {invoice.po_id && (
                      <div>
                        <span className="text-gray-600">PO ID:</span>
                        <p className="font-medium text-gray-900">{invoice.po_id}</p>
                      </div>
                    )}
                    {invoice.po_match_score !== undefined && (
                      <div>
                        <span className="text-gray-600">PO Match Score:</span>
                        <p className="font-medium text-gray-900">{invoice.po_match_score.toFixed(1)}%</p>
                      </div>
                    )}
                    {invoice.amount_variance !== undefined && invoice.amount_variance !== 0 && (
                      <div>
                        <span className="text-gray-600">Amount Variance:</span>
                        <p className={`font-medium ${invoice.amount_variance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {invoice.currency_code} {invoice.amount_variance.toFixed(2)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {(invoice.approval_notes || invoice.rejection_reason) && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Approval Information</h4>
                  {invoice.approval_notes && (
                    <div className="mb-2">
                      <span className="text-xs text-gray-600">Approval Notes:</span>
                      <p className="text-sm text-gray-900">{invoice.approval_notes}</p>
                    </div>
                  )}
                  {invoice.rejection_reason && (
                    <div>
                      <span className="text-xs text-gray-600">Rejection Reason:</span>
                      <p className="text-sm text-red-600">{invoice.rejection_reason}</p>
                    </div>
                  )}
                  {invoice.approved_at && (
                    <div className="mt-2">
                      <span className="text-xs text-gray-600">Approved At:</span>
                      <p className="text-sm text-gray-900">{new Date(invoice.approved_at).toLocaleString()}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {invoice && (invoice.status === 'RECEIVED' || invoice.status === 'PENDING_REVIEW' || invoice.status === 'MATCHED') && (
            <>
              <Button 
                className="bg-red-600 hover:bg-red-700"
                onClick={() => {
                  if (onUpdate) onUpdate('reject', invoice.id);
                  onClose();
                }}
              >
                <XCircle className="w-4 h-4 mr-2" />
                Reject
              </Button>
              <Button 
                className="bg-green-600 hover:bg-green-700"
                onClick={() => {
                  if (onUpdate) onUpdate('approve', invoice.id);
                  onClose();
                }}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Approve
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
