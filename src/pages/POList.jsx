import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apAPI } from '../lib/api';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import POFormModal from '../components/POFormModal';
import PODetailModal from '../components/PODetailModal';
import { 
  FileText, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertCircle,
  Search,
  Filter,
  Eye,
  Plus,
  Send,
  Trash2
} from 'lucide-react';

export default function POList() {
  const { user } = useAuth();
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPOId, setSelectedPOId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  const [filters, setFilters] = useState({
    status: '',
    supplier_name: '',
    po_number: '',
  });

  useEffect(() => {
    fetchPurchaseOrders();
  }, []);

  const fetchPurchaseOrders = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.status) params.status = filters.status;
      if (filters.supplier_name) params.supplier_name = filters.supplier_name;
      if (filters.po_number) params.po_number = filters.po_number;
      
      const response = await apAPI.getPurchaseOrders(params);
      setPurchaseOrders(response.data.results || []);
    } catch (err) {
      setError('Failed to load purchase orders');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (poId) => {
    if (!window.confirm('Send this purchase order to the supplier?')) return;
    
    try {
      await apAPI.sendPurchaseOrder(poId);
      alert('Purchase order sent successfully');
      fetchPurchaseOrders();
    } catch (err) {
      alert('Failed to send PO: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleCancel = async (poId) => {
    if (!window.confirm('Cancel this purchase order? This action cannot be undone.')) return;
    
    try {
      await apAPI.cancelPurchaseOrder(poId);
      alert('Purchase order cancelled');
      fetchPurchaseOrders();
    } catch (err) {
      alert('Failed to cancel PO: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleCreatePO = async (formData) => {
    try {
      await apAPI.createPurchaseOrder(formData);
      alert('Purchase order created successfully!');
      setShowCreateModal(false);
      fetchPurchaseOrders();
    } catch (err) {
      alert('Failed to create PO: ' + (err.response?.data?.detail || err.message));
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      DRAFT: { color: 'bg-gray-100 text-gray-800', icon: FileText, label: 'Draft' },
      SENT: { color: 'bg-blue-100 text-blue-800', icon: Send, label: 'Sent' },
      ACKNOWLEDGED: { color: 'bg-purple-100 text-purple-800', icon: CheckCircle, label: 'Acknowledged' },
      FULFILLED: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Fulfilled' },
      CANCELLED: { color: 'bg-red-100 text-red-800', icon: XCircle, label: 'Cancelled' }
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

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const applyFilters = () => {
    fetchPurchaseOrders();
  };

  const clearFilters = () => {
    setFilters({ status: '', supplier_name: '', po_number: '' });
    setTimeout(() => fetchPurchaseOrders(), 100);
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
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Purchase Orders</h1>
            <p className="text-gray-600 mt-1">Manage purchase orders to suppliers</p>
          </div>
          <Button 
            onClick={() => setShowCreateModal(true)}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create PO
          </Button>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-center gap-4 mb-4">
              <Filter className="w-5 h-5 text-gray-500" />
              <h3 className="font-semibold text-gray-700">Filters</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                >
                  <option value="">All Statuses</option>
                  <option value="DRAFT">Draft</option>
                  <option value="SENT">Sent</option>
                  <option value="ACKNOWLEDGED">Acknowledged</option>
                  <option value="FULFILLED">Fulfilled</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Supplier Name
                </label>
                <Input
                  type="text"
                  placeholder="Search supplier..."
                  value={filters.supplier_name}
                  onChange={(e) => handleFilterChange('supplier_name', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  PO Number
                </label>
                <Input
                  type="text"
                  placeholder="Search PO number..."
                  value={filters.po_number}
                  onChange={(e) => handleFilterChange('po_number', e.target.value)}
                />
              </div>
              <div className="flex items-end gap-2">
                <Button onClick={applyFilters} className="flex-1">
                  <Search className="w-4 h-4 mr-2" />
                  Search
                </Button>
                <Button onClick={clearFilters} variant="outline">
                  Clear
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Purchase Orders List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="text-gray-600 mt-4">Loading purchase orders...</p>
          </div>
        ) : error ? (
          <Card>
            <CardContent className="p-12 text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <p className="text-red-600 font-semibold">{error}</p>
              <Button onClick={fetchPurchaseOrders} className="mt-4">
                Try Again
              </Button>
            </CardContent>
          </Card>
        ) : purchaseOrders.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No Purchase Orders Found
              </h3>
              <p className="text-gray-600 mb-4">
                {filters.status || filters.supplier_name || filters.po_number
                  ? 'No purchase orders match your filter criteria. Try adjusting your filters.'
                  : 'Create your first purchase order to get started.'}
              </p>
              {!filters.status && !filters.supplier_name && !filters.po_number && (
                <Button onClick={() => setShowCreateModal(true)} className="mt-2">
                  <Plus className="w-4 h-4 mr-2" />
                  Create First PO
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {purchaseOrders.map((po) => (
              <Card key={po.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    {/* PO Info */}
                    <div className="lg:col-span-3">
                      <div className="flex items-start gap-3">
                        <FileText className="w-5 h-5 text-indigo-600 mt-1" />
                        <div>
                          <p className="font-semibold text-gray-900">{po.po_number}</p>
                          <p className="text-sm text-gray-500">
                            {formatDate(po.order_date)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Supplier Info */}
                    <div className="lg:col-span-3">
                      <p className="text-sm text-gray-500">Supplier</p>
                      <p className="font-medium text-gray-900">{po.supplier_name}</p>
                      <p className="text-xs text-gray-500">TRN: {po.supplier_trn}</p>
                    </div>

                    {/* Amount Info */}
                    <div className="lg:col-span-2">
                      <p className="text-sm text-gray-500">Expected Total</p>
                      <p className="font-semibold text-gray-900">
                        {formatCurrency(po.expected_total, po.currency_code)}
                      </p>
                      {po.received_invoice_count > 0 && (
                        <p className="text-xs text-gray-500">
                          {po.received_invoice_count} invoice(s) received
                        </p>
                      )}
                    </div>

                    {/* Status & Delivery */}
                    <div className="lg:col-span-2">
                      <div className="space-y-2">
                        {getStatusBadge(po.status)}
                        {po.expected_delivery_date && (
                          <p className="text-xs text-gray-500">
                            Delivery: {formatDate(po.expected_delivery_date)}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="lg:col-span-2 flex items-center justify-end gap-2">
                      <Button
                        onClick={() => setSelectedPOId(po.id)}
                        size="sm"
                        variant="outline"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      {po.status === 'DRAFT' && (
                        <>
                          <Button
                            onClick={() => handleSend(po.id)}
                            size="sm"
                            className="bg-indigo-600 hover:bg-indigo-700"
                          >
                            <Send className="w-4 h-4" />
                          </Button>
                          <Button
                            onClick={() => handleCancel(po.id)}
                            size="sm"
                            variant="outline"
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                      {po.status === 'SENT' && (
                        <Button
                          onClick={() => handleCancel(po.id)}
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create/Edit PO Modal */}
        <POFormModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreatePO}
        />

        {/* PO Detail Modal */}
        <PODetailModal
          poId={selectedPOId}
          isOpen={Boolean(selectedPOId)}
          onClose={() => setSelectedPOId(null)}
          onUpdate={() => {
            setSelectedPOId(null);
            fetchPurchaseOrders();
          }}
        />
      </div>
    </div>
  );
}
