import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/api';
import { ArrowLeft, Send, CheckCircle, XCircle, Share2, Download, FileText } from 'lucide-react';

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadInvoice();
  }, [id]);

  const loadInvoice = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/invoices/${id}`);
      setInvoice(response.data);
    } catch (error) {
      console.error('Failed to load invoice:', error);
      alert('Failed to load invoice');
    } finally {
      setLoading(false);
    }
  };

  const handleIssue = async () => {
    if (!confirm('Issue this invoice? This will generate UBL XML and increment your invoice counter.')) return;
    
    setActionLoading(true);
    try {
      await apiClient.post(`/invoices/${id}/issue`);
      alert('Invoice issued successfully! UBL XML generated.');
      loadInvoice();
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to issue invoice');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSend = async () => {
    if (!confirm('Send this invoice to customer? This will simulate ASP transmission via Peppol network.')) return;
    
    setActionLoading(true);
    try {
      const response = await apiClient.post(`/invoices/${id}/send`);
      alert(`Invoice sent successfully!\nCustomer share link: ${window.location.origin}/invoices/view/${invoice.share_token}`);
      loadInvoice();
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to send invoice');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Cancel this invoice? This action cannot be undone.')) return;
    
    setActionLoading(true);
    try {
      await apiClient.post(`/invoices/${id}/cancel`);
      alert('Invoice cancelled');
      loadInvoice();
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to cancel invoice');
    } finally {
      setActionLoading(false);
    }
  };

  const copyShareLink = () => {
    const link = `${window.location.origin}/invoices/view/${invoice.share_token}`;
    navigator.clipboard.writeText(link);
    alert('Share link copied to clipboard!');
  };

  const getStatusColor = (status) => {
    const colors = {
      DRAFT: 'bg-gray-100 text-gray-700',
      ISSUED: 'bg-blue-100 text-blue-700',
      SENT: 'bg-green-100 text-green-700',
      PAID: 'bg-green-100 text-green-800',
      CANCELLED: 'bg-red-100 text-red-700'
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const getInvoiceTypeName = (type) => {
    const types = {
      '380': 'Tax Invoice',
      '381': 'Credit Note',
      '480': 'Commercial Invoice',
      '81': 'Credit Note (Out of Scope)'
    };
    return types[type] || type;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
          <p className="text-gray-600">Loading invoice...</p>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Invoice not found</h2>
          <button
            onClick={() => navigate('/invoices')}
            className="text-indigo-600 hover:text-indigo-700 font-medium"
          >
            ← Back to Invoices
          </button>
        </div>
      </div>
    );
  }

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

        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Invoice Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-8 text-white">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                {/* Company Logo */}
                <img 
                  src={`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/companies/${invoice.company_id}/branding/logo`}
                  alt="Company Logo"
                  className="h-16 w-16 object-contain bg-white rounded-lg p-2"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-3xl font-bold">{invoice.invoice_number}</h1>
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(invoice.status)}`}>
                      {invoice.status}
                    </span>
                  </div>
                  <p className="text-indigo-100">{getInvoiceTypeName(invoice.invoice_type)}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-4xl font-bold">{invoice.currency_code} {invoice.total_amount.toFixed(2)}</div>
                <p className="text-indigo-100 mt-1">Total Amount</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="p-6 bg-gray-50 border-b flex gap-3">
            {invoice.status === 'DRAFT' && (
              <button
                onClick={handleIssue}
                disabled={actionLoading}
                className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50"
              >
                <CheckCircle className="w-5 h-5" />
                Issue Invoice
              </button>
            )}

            {invoice.status === 'ISSUED' && (
              <button
                onClick={handleSend}
                disabled={actionLoading}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 disabled:opacity-50"
              >
                <Send className="w-5 h-5" />
                Send to Customer
              </button>
            )}

            {(invoice.status === 'SENT' || invoice.status === 'ISSUED') && (
              <button
                onClick={copyShareLink}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700"
              >
                <Share2 className="w-5 h-5" />
                Copy Share Link
              </button>
            )}

            {invoice.status !== 'CANCELLED' && invoice.status !== 'PAID' && (
              <button
                onClick={handleCancel}
                disabled={actionLoading}
                className="flex items-center gap-2 px-6 py-3 bg-red-100 text-red-700 rounded-xl font-semibold hover:bg-red-200 disabled:opacity-50"
              >
                <XCircle className="w-5 h-5" />
                Cancel
              </button>
            )}
          </div>

          {/* Invoice Details */}
          <div className="p-8 space-y-8">
            {/* Parties */}
            <div className="grid grid-cols-2 gap-8">
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">From (Supplier)</h3>
                <div className="space-y-1">
                  <p className="font-bold text-gray-900">{invoice.supplier_name}</p>
                  <p className="text-gray-600 text-sm">TRN: {invoice.supplier_trn}</p>
                  {invoice.supplier_address && <p className="text-gray-600 text-sm">{invoice.supplier_address}</p>}
                  {invoice.supplier_peppol_id && <p className="text-gray-600 text-sm">Peppol ID: {invoice.supplier_peppol_id}</p>}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">To (Customer)</h3>
                <div className="space-y-1">
                  <p className="font-bold text-gray-900">{invoice.customer_name}</p>
                  {invoice.customer_trn && <p className="text-gray-600 text-sm">TRN: {invoice.customer_trn}</p>}
                  {invoice.customer_email && <p className="text-gray-600 text-sm">{invoice.customer_email}</p>}
                  {invoice.customer_address && <p className="text-gray-600 text-sm">{invoice.customer_address}</p>}
                  {invoice.customer_peppol_id && <p className="text-gray-600 text-sm">Peppol ID: {invoice.customer_peppol_id}</p>}
                </div>
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">Issue Date</p>
                <p className="font-semibold">{new Date(invoice.issue_date).toLocaleDateString('en-AE')}</p>
              </div>
              {invoice.due_date && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Due Date</p>
                  <p className="font-semibold">{new Date(invoice.due_date).toLocaleDateString('en-AE')}</p>
                </div>
              )}
              {invoice.sent_at && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Sent Date</p>
                  <p className="font-semibold">{new Date(invoice.sent_at).toLocaleDateString('en-AE')}</p>
                </div>
              )}
            </div>

            {/* Line Items */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Line Items</h3>
              <div className="border rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">#</th>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Item</th>
                      <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700">Qty</th>
                      <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700">Unit Price</th>
                      <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700">Tax</th>
                      <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {invoice.line_items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-3 text-sm">{item.line_number}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{item.item_name}</div>
                          {item.item_description && <div className="text-sm text-gray-500">{item.item_description}</div>}
                        </td>
                        <td className="px-4 py-3 text-sm text-right">{item.quantity} {item.unit_code}</td>
                        <td className="px-4 py-3 text-sm text-right">{invoice.currency_code} {item.unit_price.toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm text-right">{invoice.currency_code} {item.tax_amount.toFixed(2)}</td>
                        <td className="px-4 py-3 font-semibold text-right">{invoice.currency_code} {item.line_total_amount.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals */}
            <div className="border-t pt-6">
              <div className="space-y-2 max-w-md ml-auto">
                <div className="flex justify-between text-gray-700">
                  <span>Subtotal:</span>
                  <span className="font-semibold">{invoice.currency_code} {invoice.subtotal_amount.toFixed(2)}</span>
                </div>
                {invoice.tax_breakdowns.map((tb, idx) => (
                  <div key={idx} className="flex justify-between text-gray-700">
                    <span>VAT ({tb.tax_category} - {tb.tax_percent}%):</span>
                    <span className="font-semibold">{invoice.currency_code} {tb.tax_amount.toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-2xl font-bold text-indigo-900 pt-3 border-t-2">
                  <span>Total:</span>
                  <span>{invoice.currency_code} {invoice.total_amount.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* UBL XML Info */}
            {invoice.xml_file_path && (
              <div className="bg-indigo-50 rounded-xl p-6">
                <h3 className="text-sm font-semibold text-indigo-900 uppercase mb-2">UAE E-Invoicing Compliance</h3>
                <div className="space-y-1 text-sm">
                  <p className="text-indigo-700">✅ UBL 2.1 / PINT-AE XML Generated</p>
                  <p className="text-indigo-700">✅ SHA-256 Hash: <code className="font-mono text-xs">{invoice.xml_hash?.substring(0, 32)}...</code></p>
                  <p className="text-indigo-700">✅ Ready for ASP Transmission</p>
                </div>
              </div>
            )}

            {/* Company Stamp/Seal */}
            <div className="flex justify-end pt-8">
              <div className="text-center">
                <img 
                  src={`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/companies/${invoice.company_id}/branding/stamp`}
                  alt="Company Stamp"
                  className="h-24 w-24 object-contain mx-auto mb-2"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
                <p className="text-xs text-gray-500">Authorized Signature</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
