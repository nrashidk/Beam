import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Download, DollarSign, TrendingUp, AlertTriangle, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import api from '../lib/api';
import Sidebar from '../components/Sidebar';

export default function DailyReconciliation() {
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState({
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchReport();
  }, []);

  const fetchReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams(dateRange);
      const response = await api.get(`/reports/daily-reconciliation?${params}`);
      setReport(response.data);
    } catch (error) {
      console.error('Failed to fetch reconciliation report:', error);
      setError('Failed to load reconciliation report');
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = () => {
    if (!report) return;

    // Create CSV content
    let csv = 'Daily Reconciliation Report\n\n';
    csv += `Report Period:,${report.report_period.start_date} to ${report.report_period.end_date}\n\n`;
    
    csv += 'SUMMARY\n';
    csv += `Total Collected:,AED ${report.summary.total_collected.toFixed(2)}\n`;
    csv += `Total Transactions:,${report.summary.total_transactions}\n`;
    csv += `Outstanding Amount:,AED ${report.summary.outstanding_amount.toFixed(2)}\n`;
    csv += `Outstanding Count:,${report.summary.outstanding_count}\n\n`;
    
    csv += 'PAYMENT BREAKDOWN\n';
    csv += 'Payment Method,Count,Total Amount\n';
    report.payment_breakdown.forEach(method => {
      csv += `${method.payment_method},${method.count},AED ${method.total_amount.toFixed(2)}\n`;
    });
    
    csv += '\n\nDETAILED TRANSACTIONS\n';
    csv += 'Payment Method,Invoice Number,Customer Name,Amount,Reference,Date\n';
    report.payment_breakdown.forEach(method => {
      method.invoices.forEach(inv => {
        csv += `${method.payment_method},${inv.invoice_number},${inv.customer_name},AED ${inv.amount.toFixed(2)},${inv.payment_reference || 'N/A'},${inv.payment_date}\n`;
      });
    });
    
    if (report.outstanding_invoices.length > 0) {
      csv += '\n\nOUTSTANDING INVOICES\n';
      csv += 'Invoice Number,Customer Name,Amount Due,Due Date,Days Overdue\n';
      report.outstanding_invoices.forEach(inv => {
        csv += `${inv.invoice_number},${inv.customer_name},AED ${inv.amount_due.toFixed(2)},${inv.due_date},${inv.days_overdue}\n`;
      });
    }

    // Download CSV
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `reconciliation_${report.report_period.start_date}_${report.report_period.end_date}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getPaymentMethodColor = (method) => {
    const colors = {
      'Cash': 'bg-green-100 text-green-800',
      'Card': 'bg-blue-100 text-blue-800',
      'POS': 'bg-purple-100 text-purple-800',
      'Bank Transfer': 'bg-indigo-100 text-indigo-800',
      'Cheque': 'bg-yellow-100 text-yellow-800',
      'Digital Wallet': 'bg-pink-100 text-pink-800'
    };
    return colors[method] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex">
      <Sidebar />
      
      <div className="flex-1 ml-64">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Daily Reconciliation Report</h1>
            <p className="text-gray-600 mt-2">
              View payment collections and outstanding invoices
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          {/* Date Range Selector */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex gap-4 items-end flex-wrap">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date
                  </label>
                  <Input
                    type="date"
                    value={dateRange.start_date}
                    onChange={(e) => setDateRange({ ...dateRange, start_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date
                  </label>
                  <Input
                    type="date"
                    value={dateRange.end_date}
                    onChange={(e) => setDateRange({ ...dateRange, end_date: e.target.value })}
                  />
                </div>
                <Button onClick={fetchReport} disabled={loading}>
                  {loading ? 'Loading...' : 'Generate Report'}
                </Button>
                {report && (
                  <Button variant="outline" onClick={exportToExcel} className="gap-2">
                    <Download size={16} />
                    Export to Excel
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {loading ? (
            <div className="text-center py-12 text-gray-500">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p>Generating report...</p>
            </div>
          ) : report ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Total Collected</p>
                        <p className="text-2xl font-bold text-green-600 mt-1">
                          AED {report.summary.total_collected.toLocaleString('en-AE', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                        <TrendingUp className="text-green-600" size={24} />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Transactions</p>
                        <p className="text-2xl font-bold text-gray-900 mt-1">{report.summary.total_transactions}</p>
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
                        <p className="text-sm text-gray-600">Outstanding</p>
                        <p className="text-2xl font-bold text-orange-600 mt-1">
                          AED {report.summary.outstanding_amount.toLocaleString('en-AE', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                        <AlertTriangle className="text-orange-600" size={24} />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Overdue Count</p>
                        <p className="text-2xl font-bold text-red-600 mt-1">{report.summary.outstanding_count}</p>
                      </div>
                      <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                        <Calendar className="text-red-600" size={24} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Payment Breakdown */}
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Payment Method Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  {report.payment_breakdown.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <DollarSign size={48} className="mx-auto mb-4 opacity-50" />
                      <p>No payments recorded for this period</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {report.payment_breakdown.map((method, index) => (
                        <div key={index} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <Badge className={getPaymentMethodColor(method.payment_method)}>
                                {method.payment_method}
                              </Badge>
                              <span className="text-sm text-gray-600">
                                {method.count} transaction{method.count !== 1 ? 's' : ''}
                              </span>
                            </div>
                            <span className="text-lg font-bold text-gray-900">
                              AED {method.total_amount.toLocaleString('en-AE', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          
                          {method.invoices.length > 0 && (
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead className="border-t">
                                  <tr className="bg-gray-50">
                                    <th className="text-left py-2 px-3 font-medium text-gray-700">Invoice #</th>
                                    <th className="text-left py-2 px-3 font-medium text-gray-700">Customer</th>
                                    <th className="text-left py-2 px-3 font-medium text-gray-700">Reference</th>
                                    <th className="text-left py-2 px-3 font-medium text-gray-700">Date</th>
                                    <th className="text-right py-2 px-3 font-medium text-gray-700">Amount</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {method.invoices.map((inv, invIndex) => (
                                    <tr key={invIndex} className="border-t">
                                      <td className="py-2 px-3 text-blue-600 font-medium">{inv.invoice_number}</td>
                                      <td className="py-2 px-3">{inv.customer_name}</td>
                                      <td className="py-2 px-3 text-gray-600">{inv.payment_reference || '—'}</td>
                                      <td className="py-2 px-3 text-gray-600">
                                        {inv.payment_date ? format(new Date(inv.payment_date), 'MMM d, yyyy') : '—'}
                                      </td>
                                      <td className="py-2 px-3 text-right font-semibold">
                                        AED {inv.amount.toLocaleString('en-AE', { minimumFractionDigits: 2 })}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Outstanding Invoices */}
              {report.outstanding_invoices && report.outstanding_invoices.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="text-red-600" size={20} />
                      Outstanding Invoices (Top 10 Overdue)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-3 px-4 font-medium text-gray-700">Invoice #</th>
                            <th className="text-left py-3 px-4 font-medium text-gray-700">Customer</th>
                            <th className="text-left py-3 px-4 font-medium text-gray-700">Due Date</th>
                            <th className="text-center py-3 px-4 font-medium text-gray-700">Days Overdue</th>
                            <th className="text-right py-3 px-4 font-medium text-gray-700">Amount Due</th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.outstanding_invoices.map((inv, index) => (
                            <tr key={index} className="border-b hover:bg-gray-50">
                              <td className="py-3 px-4 font-medium text-blue-600">{inv.invoice_number}</td>
                              <td className="py-3 px-4">{inv.customer_name}</td>
                              <td className="py-3 px-4 text-gray-600">
                                {inv.due_date ? format(new Date(inv.due_date), 'MMM d, yyyy') : '—'}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <Badge className="bg-red-600">{inv.days_overdue} days</Badge>
                              </td>
                              <td className="py-3 px-4 text-right font-semibold text-red-600">
                                AED {inv.amount_due.toLocaleString('en-AE', { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
