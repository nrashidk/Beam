import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apAPI } from '../lib/api';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import InwardInvoiceDetailModal from '../components/InwardInvoiceDetailModal';
import { 
  FileText, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertCircle,
  Search,
  Filter,
  Eye
} from 'lucide-react';

export default function APInbox() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
  
  const [filters, setFilters] = useState({
    status: '',
    supplier_name: '',
    invoice_number: '',
  });

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.status) params.status = filters.status;
      if (filters.supplier_name) params.supplier_name = filters.supplier_name;
      if (filters.invoice_number) params.invoice_number = filters.invoice_number;
      
      const response = await apAPI.getInwardInvoices(params);
      setInvoices(response.data);
    } catch (err) {
      setError('Failed to load invoices');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (invoiceId) => {
    try {
      await apAPI.approveInvoice(invoiceId, {
        approved_by_user_id: user.id,
        approval_notes: 'Approved via AP Inbox'
      });
      fetchInvoices();
    } catch (err) {
      alert('Failed to approve invoice: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleReject = async (invoiceId) => {
    const reason = prompt('Please enter rejection reason:');
    if (!reason) return;
    
    try {
      await apAPI.rejectInvoice(invoiceId, {
        rejected_by_user_id: user.id,
        rejection_reason: reason
      });
      fetchInvoices();
    } catch (err) {
      alert('Failed to reject invoice: ' + (err.response?.data?.detail || err.message));
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      RECEIVED: { color: 'bg-blue-100 text-blue-800', icon: Clock, label: 'Received' },
      PENDING_REVIEW: { color: 'bg-yellow-100 text-yellow-800', icon: AlertCircle, label: 'Pending Review' },
      MATCHED: { color: 'bg-purple-100 text-purple-800', icon: FileText, label: 'Matched' },
      APPROVED: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Approved' },
      REJECTED: { color: 'bg-red-100 text-red-800', icon: XCircle, label: 'Rejected' },
      PAID: { color: 'bg-emerald-100 text-emerald-800', icon: CheckCircle, label: 'Paid' },
      DISPUTED: { color: 'bg-orange-100 text-orange-800', icon: AlertCircle, label: 'Disputed' },
      CANCELLED: { color: 'bg-gray-100 text-gray-800', icon: XCircle, label: 'Cancelled' }
    };
    
    const config = statusConfig[status] || statusConfig.RECEIVED;
    const Icon = config.icon;
    
    return (
      <Badge className={`${config.color} flex items-center gap-1`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const applyFilters = () => {
    fetchInvoices();
  };

  const clearFilters = () => {
    setFilters({ status: '', supplier_name: '', invoice_number: '' });
    setTimeout(() => fetchInvoices(), 100);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">AP Invoice Inbox</h1>
            <p className="text-gray-600 mt-1">Manage received invoices from suppliers</p>
          </div>
          <Badge className="bg-blue-100 text-blue-800 text-lg px-4 py-2">
            {invoices.length} Invoice{invoices.length !== 1 ? 's' : ''}
          </Badge>
        </div>

        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-5 h-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">All Statuses</option>
                  <option value="RECEIVED">Received</option>
                  <option value="PENDING_REVIEW">Pending Review</option>
                  <option value="MATCHED">Matched</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="PAID">Paid</option>
                  <option value="DISPUTED">Disputed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Supplier Name</label>
                <Input
                  type="text"
                  placeholder="Search supplier..."
                  value={filters.supplier_name}
                  onChange={(e) => handleFilterChange('supplier_name', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Number</label>
                <Input
                  type="text"
                  placeholder="Search invoice #..."
                  value={filters.invoice_number}
                  onChange={(e) => handleFilterChange('invoice_number', e.target.value)}
                />
              </div>
              <div className="flex items-end gap-2">
                <Button onClick={applyFilters} className="flex-1">
                  <Search className="w-4 h-4 mr-2" />
                  Apply
                </Button>
                <Button onClick={clearFilters} variant="outline">
                  Clear
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="text-gray-600">Loading invoices...</div>
            </CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="text-red-600">{error}</div>
            </CardContent>
          </Card>
        ) : invoices.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Invoices Found</h3>
              <p className="text-gray-600">No supplier invoices have been received yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {invoices.map((invoice) => (
              <Card key={invoice.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {invoice.supplier_invoice_number}
                        </h3>
                        {getStatusBadge(invoice.status)}
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Supplier:</span>
                          <p className="font-medium text-gray-900">{invoice.supplier_name}</p>
                        </div>
                        <div>
                          <span className="text-gray-600">Invoice Date:</span>
                          <p className="font-medium text-gray-900">
                            {new Date(invoice.invoice_date).toLocaleDateString()}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-600">Total Amount:</span>
                          <p className="font-medium text-gray-900">
                            {invoice.currency_code} {invoice.total_amount.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-600">Due Date:</span>
                          <p className="font-medium text-gray-900">
                            {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : 'N/A'}
                          </p>
                        </div>
                      </div>

                      {invoice.matching_status && (
                        <div className="mt-3">
                          <Badge className={
                            invoice.matching_status === 'MATCHED' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                          }>
                            Matching: {invoice.matching_status}
                          </Badge>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 ml-4">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setSelectedInvoiceId(invoice.id)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>
                      {(invoice.status === 'RECEIVED' || invoice.status === 'PENDING_REVIEW' || invoice.status === 'MATCHED') && (
                        <>
                          <Button 
                            size="sm" 
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => handleApprove(invoice.id)}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Approve
                          </Button>
                          <Button 
                            size="sm" 
                            variant="destructive"
                            onClick={() => handleReject(invoice.id)}
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {selectedInvoiceId && (
          <InwardInvoiceDetailModal
            invoiceId={selectedInvoiceId}
            onClose={() => setSelectedInvoiceId(null)}
            onUpdate={(action, invoiceId) => {
              if (action === 'approve') {
                handleApprove(invoiceId);
              } else if (action === 'reject') {
                handleReject(invoiceId);
              }
            }}
          />
        )}
      </div>
    </div>
  );
}
