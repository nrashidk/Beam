import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Download, FileText, Building2, Calendar, CreditCard, CheckCircle, Mail, Phone } from 'lucide-react';
import axios from 'axios';

export default function PublicInvoiceView() {
  const { shareToken } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  useEffect(() => {
    fetchInvoice();
  }, [shareToken]);

  const fetchInvoice = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/invoices/view/${shareToken}`);
      setInvoice(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Invoice not found');
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = () => {
    // In production, this would download the actual PDF
    // For now, trigger a print dialog as a fallback
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading invoice...</p>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center bg-white rounded-xl shadow-lg p-8 max-w-md">
          <FileText className="h-16 w-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Invoice Not Found</h2>
          <p className="text-gray-600">{error || 'The invoice you are looking for does not exist or has been removed.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-xl">
                <FileText className="h-8 w-8 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Invoice</h1>
                <p className="text-gray-600 text-sm">Secure invoice from {invoice.supplier_name}</p>
              </div>
            </div>
            <button
              onClick={downloadPDF}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-md"
            >
              <Download className="h-4 w-4" />
              Download PDF
            </button>
          </div>
        </div>
      </div>

      {/* Invoice Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Invoice Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-8">
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <div className="text-sm opacity-80 mb-2">From</div>
                <div className="font-bold text-xl mb-2">{invoice.supplier_name}</div>
                <div className="space-y-1 text-sm opacity-90">
                  <div>{invoice.supplier_address}</div>
                  <div>TRN: {invoice.supplier_trn}</div>
                  {invoice.supplier_peppol_id && (
                    <div>PEPPOL ID: {invoice.supplier_peppol_id}</div>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm opacity-80 mb-2">Invoice Details</div>
                <div className="font-bold text-2xl mb-2">{invoice.invoice_number}</div>
                <div className="space-y-1 text-sm opacity-90">
                  <div>Issue Date: {new Date(invoice.issue_date).toLocaleDateString('en-AE')}</div>
                  {invoice.due_date && (
                    <div>Due Date: {new Date(invoice.due_date).toLocaleDateString('en-AE')}</div>
                  )}
                  <div className="mt-2">
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${
                      invoice.status === 'PAID' ? 'bg-green-500' : 
                      invoice.status === 'SENT' ? 'bg-blue-500' :
                      'bg-yellow-500'
                    }`}>
                      {invoice.status === 'PAID' && <CheckCircle className="h-3 w-3" />}
                      {invoice.status}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bill To */}
          <div className="p-8 bg-gray-50 border-b border-gray-200">
            <div className="text-sm text-gray-600 mb-2">Bill To</div>
            <div className="font-bold text-lg text-gray-900 mb-1">{invoice.customer_name}</div>
            <div className="text-gray-700">
              {invoice.customer_address}
            </div>
            {invoice.customer_trn && (
              <div className="text-gray-600 text-sm mt-1">TRN: {invoice.customer_trn}</div>
            )}
            {invoice.customer_email && (
              <div className="flex items-center gap-2 text-gray-600 text-sm mt-1">
                <Mail className="h-4 w-4" />
                {invoice.customer_email}
              </div>
            )}
          </div>

          {/* Line Items */}
          <div className="p-8">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 text-sm font-semibold text-gray-600">Item</th>
                  <th className="text-center py-3 text-sm font-semibold text-gray-600">Qty</th>
                  <th className="text-right py-3 text-sm font-semibold text-gray-600">Unit Price</th>
                  <th className="text-right py-3 text-sm font-semibold text-gray-600">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.line_items && invoice.line_items.map((item) => (
                  <tr key={item.id} className="border-b border-gray-100">
                    <td className="py-4">
                      <div className="font-medium text-gray-900">{item.item_name}</div>
                      {item.item_description && (
                        <div className="text-sm text-gray-600">{item.item_description}</div>
                      )}
                    </td>
                    <td className="text-center py-4 text-gray-700">
                      {item.quantity} {item.unit_code}
                    </td>
                    <td className="text-right py-4 text-gray-700">
                      {invoice.currency_code} {item.unit_price.toFixed(2)}
                    </td>
                    <td className="text-right py-4 font-medium text-gray-900">
                      {invoice.currency_code} {item.line_extension_amount.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="mt-8 flex justify-end">
              <div className="w-full md:w-1/2 space-y-3">
                <div className="flex justify-between text-gray-700">
                  <span>Subtotal</span>
                  <span className="font-medium">{invoice.currency_code} {invoice.subtotal_amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-700">
                  <span>VAT (5%)</span>
                  <span className="font-medium">{invoice.currency_code} {invoice.tax_amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xl font-bold text-gray-900 pt-3 border-t-2 border-gray-300">
                  <span>Total Amount</span>
                  <span>{invoice.currency_code} {invoice.total_amount.toFixed(2)}</span>
                </div>
                {invoice.status !== 'PAID' && (
                  <div className="flex justify-between text-lg font-semibold text-blue-600 pt-2">
                    <span>Amount Due</span>
                    <span>{invoice.currency_code} {invoice.amount_due.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 p-6 border-t border-gray-200">
            <div className="text-center text-sm text-gray-600">
              <p className="mb-2">This is a UAE-compliant tax invoice generated by InvoLinks</p>
              <p>For questions about this invoice, please contact {invoice.supplier_name}</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 text-center space-y-3">
          <button
            onClick={downloadPDF}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all shadow-lg"
          >
            <Download className="h-5 w-5" />
            Save as PDF
          </button>
          <p className="text-sm text-gray-600">
            Invoice viewed {invoice.viewed_at ? 'on ' + new Date(invoice.viewed_at).toLocaleDateString('en-AE') : 'for the first time'}
          </p>
        </div>
      </div>
    </div>
  );
}
