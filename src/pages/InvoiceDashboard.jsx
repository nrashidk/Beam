import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/api';
import { FileText, Plus, Eye, Send, X, CheckCircle, Clock, XCircle } from 'lucide-react';

export default function InvoiceDashboard() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const navigate = useNavigate();

  useEffect(() => {
    loadInvoices();
  }, [filter]);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const params = filter !== 'all' ? `?status=${filter}` : '';
      const response = await apiClient.get(`/invoices${params}`);
      setInvoices(response.data);
    } catch (error) {
      console.error('Failed to load invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'DRAFT': return <Clock className="w-4 h-4 text-gray-400" />;
      case 'ISSUED': return <CheckCircle className="w-4 h-4 text-blue-500" />;
      case 'SENT': return <Send className="w-4 h-4 text-green-500" />;
      case 'PAID': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'CANCELLED': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return null;
    }
  };

  const getStatusBadge = (status) => {
    const colors = {
      DRAFT: 'bg-gray-100 text-gray-700',
      ISSUED: 'bg-blue-100 text-blue-700',
      SENT: 'bg-green-100 text-green-700',
      PAID: 'bg-green-100 text-green-800',
      CANCELLED: 'bg-red-100 text-red-700',
      OVERDUE: 'bg-orange-100 text-orange-700'
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Invoices</h1>
              <p className="text-gray-600 mt-1">Create and manage UAE-compliant e-invoices</p>
            </div>
            <button
              onClick={() => navigate('/invoices/create')}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl"
            >
              <Plus className="w-5 h-5" />
              Create Invoice
            </button>
          </div>

          {/* Filters */}
          <div className="flex gap-3 mt-6">
            {['all', 'DRAFT', 'ISSUED', 'SENT', 'PAID', 'CANCELLED'].map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  filter === status
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                {status === 'all' ? 'All' : status.charAt(0) + status.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Invoice List */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            <p className="text-gray-600 mt-4">Loading invoices...</p>
          </div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl shadow-sm">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No invoices found</h3>
            <p className="text-gray-600 mb-6">
              {filter === 'all' 
                ? 'Create your first UAE-compliant e-invoice'
                : `No invoices with status: ${filter}`}
            </p>
            <button
              onClick={() => navigate('/invoices/create')}
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-all"
            >
              <Plus className="w-5 h-5" />
              Create Invoice
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-all border border-gray-100 cursor-pointer"
                onClick={() => navigate(`/invoices/${invoice.id}`)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="p-3 bg-indigo-50 rounded-xl">
                      <FileText className="w-6 h-6 text-indigo-600" />
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-lg font-bold text-gray-900">
                          {invoice.invoice_number}
                        </h3>
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadge(invoice.status)}`}>
                          {getStatusIcon(invoice.status)}
                          {invoice.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span className="font-medium">{invoice.customer_name}</span>
                        <span>•</span>
                        <span>{new Date(invoice.issue_date).toLocaleDateString('en-AE')}</span>
                        <span>•</span>
                        <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                          Type: {invoice.invoice_type === '380' ? 'Tax Invoice' : 
                                 invoice.invoice_type === '381' ? 'Credit Note' : 
                                 'Commercial'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-2xl font-bold text-gray-900">
                      {invoice.currency_code} {invoice.total_amount.toFixed(2)}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      Created {new Date(invoice.created_at).toLocaleDateString('en-AE')}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
