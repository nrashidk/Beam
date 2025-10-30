import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { CheckCircle, DollarSign, Calendar, AlertCircle, Search, X } from 'lucide-react';
import { format } from 'date-fns';
import api from '../lib/api';
import Sidebar from '../components/Sidebar';

export default function PaymentVerification() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [filteredInvoices, setFilteredInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  
  // Payment verification modal
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [verificationData, setVerificationData] = useState({
    payment_method: 'Cash',
    payment_reference: '',
    payment_notes: '',
    payment_date: new Date().toISOString().split('T')[0]
  });
  const [verifying, setVerifying] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);

  useEffect(() => {
    fetchPendingInvoices();
  }, []);

  useEffect(() => {
    filterInvoices();
  }, [invoices, searchTerm, filterStatus]);

  const fetchPendingInvoices = async () => {
    try {
      setLoading(true);
      const response = await api.get('/invoices/pending-payment');
      setInvoices(response.data);
    } catch (error) {
      console.error('Failed to fetch pending invoices:', error);
      setError('Failed to load pending payments');
    } finally {
      setLoading(false);
    }
  };

  const filterInvoices = () => {
    let filtered = [...invoices];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(inv =>
        inv.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.customer_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (filterStatus === 'overdue') {
      filtered = filtered.filter(inv => inv.days_overdue > 0);
    } else if (filterStatus === 'due-soon') {
      filtered = filtered.filter(inv => inv.days_overdue <= 0 && inv.days_overdue >= -7);
    }

    setFilteredInvoices(filtered);
  };

  const handleVerifyPayment = (invoice) => {
    setSelectedInvoice(invoice);
    setVerificationData({
      payment_method: 'Cash',
      payment_reference: '',
      payment_notes: '',
      payment_date: new Date().toISOString().split('T')[0]
    });
    setShowVerifyModal(true);
  };

  const submitVerification = async () => {
    try {
      setVerifying(true);
      setError(null);
      
      await api.post(`/invoices/${selectedInvoice.id}/verify-payment`, verificationData);
      
      setSuccessMessage(`Payment verified for invoice ${selectedInvoice.invoice_number}`);
      setShowVerifyModal(false);
      setSelectedInvoice(null);
      
      // Refresh the list
      await fetchPendingInvoices();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error('Failed to verify payment:', error);
      setError(error.response?.data?.detail || 'Failed to verify payment');
    } finally {
      setVerifying(false);
    }
  };

  const getStatusBadge = (invoice) => {
    if (invoice.days_overdue > 0) {
      return <Badge className="bg-red-600">Overdue ({invoice.days_overdue}d)</Badge>;
    } else if (invoice.days_overdue >= -7) {
      return <Badge className="bg-yellow-600">Due Soon</Badge>;
    }
    return <Badge className="bg-green-600">Active</Badge>;
  };

  const totalPending = filteredInvoices.reduce((sum, inv) => sum + inv.amount_due, 0);
  const overdueCount = filteredInvoices.filter(inv => inv.days_overdue > 0).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex">
      <Sidebar />
      
      <div className="flex-1 ml-64">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Payment Verification</h1>
            <p className="text-gray-600 mt-2">
              Verify and record offline payments (Cash, POS, Bank Transfers)
            </p>
          </div>

          {successMessage && (
            <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle size={20} />
                <span>{successMessage}</span>
              </div>
              <button onClick={() => setSuccessMessage(null)} className="text-green-600 hover:text-green-800">
                <X size={20} />
              </button>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Pending Payments</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{filteredInvoices.length}</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <DollarSign className="text-blue-600" size={24} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Amount</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      AED {totalPending.toLocaleString('en-AE', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <DollarSign className="text-green-600" size={24} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Overdue Invoices</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{overdueCount}</p>
                  </div>
                  <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                    <AlertCircle className="text-red-600" size={24} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex gap-4 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <Input
                      type="text"
                      placeholder="Search by invoice # or customer name..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Invoices</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="due-soon">Due Soon (7 days)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Invoices List */}
          <Card>
            <CardHeader>
              <CardTitle>Pending Payment Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-gray-500">Loading invoices...</div>
              ) : filteredInvoices.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <DollarSign size={48} className="mx-auto mb-4 opacity-50" />
                  <p>No pending payment invoices found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Invoice #</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Customer</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Issue Date</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Due Date</th>
                        <th className="text-right py-3 px-4 font-medium text-gray-700">Amount</th>
                        <th className="text-center py-3 px-4 font-medium text-gray-700">Status</th>
                        <th className="text-right py-3 px-4 font-medium text-gray-700">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInvoices.map((invoice) => (
                        <tr key={invoice.id} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4 font-medium text-blue-600">
                            {invoice.invoice_number}
                          </td>
                          <td className="py-3 px-4">{invoice.customer_name}</td>
                          <td className="py-3 px-4 text-gray-600">
                            {format(new Date(invoice.issue_date), 'MMM d, yyyy')}
                          </td>
                          <td className="py-3 px-4 text-gray-600">
                            {invoice.due_date ? format(new Date(invoice.due_date), 'MMM d, yyyy') : '—'}
                          </td>
                          <td className="py-3 px-4 text-right font-semibold">
                            {invoice.currency_code} {invoice.amount_due.toLocaleString('en-AE', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {getStatusBadge(invoice)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Button
                              size="sm"
                              onClick={() => handleVerifyPayment(invoice)}
                              className="gap-2"
                            >
                              <CheckCircle size={16} />
                              Verify Payment
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Payment Verification Modal */}
      <Dialog open={showVerifyModal} onOpenChange={setShowVerifyModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Verify Payment</DialogTitle>
          </DialogHeader>
          
          {selectedInvoice && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Invoice Number</p>
                <p className="font-semibold">{selectedInvoice.invoice_number}</p>
                <p className="text-sm text-gray-600 mt-2">Customer</p>
                <p className="font-semibold">{selectedInvoice.customer_name}</p>
                <p className="text-sm text-gray-600 mt-2">Amount Due</p>
                <p className="text-lg font-bold text-green-600">
                  {selectedInvoice.currency_code} {selectedInvoice.amount_due.toLocaleString('en-AE', { minimumFractionDigits: 2 })}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Method <span className="text-red-500">*</span>
                </label>
                <Select
                  value={verificationData.payment_method}
                  onValueChange={(value) => setVerificationData({ ...verificationData, payment_method: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="Card">Card</SelectItem>
                    <SelectItem value="POS">POS</SelectItem>
                    <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                    <SelectItem value="Cheque">Cheque</SelectItem>
                    <SelectItem value="Digital Wallet">Digital Wallet</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Date
                </label>
                <Input
                  type="date"
                  value={verificationData.payment_date}
                  onChange={(e) => setVerificationData({ ...verificationData, payment_date: e.target.value })}
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Reference (Optional)
                </label>
                <Input
                  type="text"
                  placeholder="e.g., Receipt #, Transaction ID"
                  value={verificationData.payment_reference}
                  onChange={(e) => setVerificationData({ ...verificationData, payment_reference: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Notes (Optional)
                </label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Add any additional notes about this payment..."
                  value={verificationData.payment_notes}
                  onChange={(e) => setVerificationData({ ...verificationData, payment_notes: e.target.value })}
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                  {error}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVerifyModal(false)} disabled={verifying}>
              Cancel
            </Button>
            <Button onClick={submitVerification} disabled={verifying}>
              {verifying ? 'Verifying...' : 'Confirm Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
