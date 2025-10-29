import { useState, useEffect } from 'react';
import { FileText, Download, Calendar, AlertCircle, CheckCircle2, Clock, XCircle } from 'lucide-react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import Sidebar from '../components/Sidebar';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function FTAAuditFiles() {
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [format, setFormat] = useState('CSV');
  const [generating, setGenerating] = useState(false);
  const [auditFiles, setAuditFiles] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loadingFiles, setLoadingFiles] = useState(true);

  useEffect(() => {
    fetchAuditFiles();
  }, []);

  const fetchAuditFiles = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/audit-files`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAuditFiles(response.data.audit_files || []);
    } catch (err) {
      console.error('Failed to fetch audit files:', err);
      setError(err.response?.data?.detail || 'Failed to load audit files');
    } finally {
      setLoadingFiles(false);
    }
  };

  const handleGenerate = async () => {
    if (!periodStart || !periodEnd) {
      setError('Please select both start and end dates');
      return;
    }

    setGenerating(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_URL}/audit-files/generate`,
        null,
        {
          params: {
            period_start: periodStart,
            period_end: periodEnd,
            format: format
          },
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setSuccess(response.data.message);
      
      // Show statistics
      const stats = response.data.statistics;
      setSuccess(
        `Audit file generated successfully! Total invoices: ${stats.total_invoices}, ` +
        `Sales: ${stats.total_sales}, Purchases: ${stats.total_purchases}, ` +
        `Total Amount: AED ${stats.total_amount.toFixed(2)}, VAT: AED ${stats.total_vat.toFixed(2)}`
      );

      // Refresh list
      fetchAuditFiles();

      // Clear form
      setPeriodStart('');
      setPeriodEnd('');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to generate audit file');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (auditFileId, fileName) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API_URL}/audit-files/${auditFileId}/download`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to download file');
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'N/A';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case 'GENERATING':
        return <Clock className="w-5 h-5 text-blue-600 animate-spin" />;
      case 'FAILED':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'GENERATING':
        return 'bg-blue-100 text-blue-800';
      case 'FAILED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />
      
      <div className="flex-1 ml-64">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <BackToDashboard />
          
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">FTA Audit Files</h1>
                <p className="text-gray-600 mt-1">
                  Generate UAE Federal Tax Authority compliant audit files (FAF format)
                </p>
              </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900">Error</h3>
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <button onClick={() => setError('')} className="ml-auto">
              <XCircle className="w-5 h-5 text-red-600" />
            </button>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-green-900">Success</h3>
              <p className="text-sm text-green-700">{success}</p>
            </div>
            <button onClick={() => setSuccess('')} className="ml-auto">
              <XCircle className="w-5 h-5 text-green-600" />
            </button>
          </div>
        )}

        {/* Generate New Audit File */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Generate New Audit File
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">What is an FTA Audit File?</h4>
              <p className="text-sm text-blue-700">
                The FTA Audit File (FAF) is a comprehensive export of your company's invoice-level transactions 
                required during UAE Federal Tax Authority audits. It includes all sales and purchase invoices 
                with VAT details, customer/supplier information, and compliance categorization.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Period Start Date
                </label>
                <input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  disabled={generating}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Period End Date
                </label>
                <input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  disabled={generating}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Format
                </label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  disabled={generating}
                >
                  <option value="CSV">CSV (Comma-separated)</option>
                  <option value="TXT">TXT (Tab-delimited)</option>
                </select>
              </div>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={generating || !periodStart || !periodEnd}
              className="w-full md:w-auto"
            >
              {generating ? (
                <>
                  <Clock className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-2" />
                  Generate Audit File
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Generated Audit Files List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="w-5 h-5" />
              Generated Audit Files
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingFiles ? (
              <div className="text-center py-8 text-gray-600">
                <Clock className="w-8 h-8 mx-auto mb-2 animate-spin" />
                Loading audit files...
              </div>
            ) : auditFiles.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p>No audit files generated yet</p>
                <p className="text-sm mt-1">Generate your first audit file above</p>
              </div>
            ) : (
              <div className="space-y-3">
                {auditFiles.map((file) => (
                  <div
                    key={file.id}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {getStatusIcon(file.status)}
                          <h3 className="font-medium text-gray-900">{file.file_name}</h3>
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                              file.status
                            )}`}
                          >
                            {file.status}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-gray-600">
                          <div>
                            <span className="font-medium">Period:</span>{' '}
                            {file.period_start} to {file.period_end}
                          </div>
                          <div>
                            <span className="font-medium">Format:</span> {file.format}
                          </div>
                          <div>
                            <span className="font-medium">Invoices:</span> {file.total_invoices}
                          </div>
                          <div>
                            <span className="font-medium">Size:</span> {formatFileSize(file.file_size)}
                          </div>
                        </div>

                        {file.total_amount !== undefined && (
                          <div className="mt-2 text-sm text-gray-600">
                            <span className="font-medium">Total Amount:</span> AED{' '}
                            {file.total_amount.toFixed(2)} |{' '}
                            <span className="font-medium">VAT:</span> AED {file.total_vat.toFixed(2)}
                          </div>
                        )}

                        {file.error_message && (
                          <div className="mt-2 text-sm text-red-600">
                            <AlertCircle className="w-4 h-4 inline mr-1" />
                            {file.error_message}
                          </div>
                        )}

                        <div className="mt-2 text-xs text-gray-500">
                          Generated on {new Date(file.generated_at).toLocaleString()}
                        </div>
                      </div>

                      {file.status === 'COMPLETED' && (
                        <Button
                          onClick={() => handleDownload(file.id, file.file_name)}
                          size="sm"
                          variant="outline"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="bg-indigo-50 border-indigo-200">
          <CardContent className="pt-6">
            <h3 className="font-semibold text-indigo-900 mb-3">FTA Compliance Information</h3>
            <div className="space-y-2 text-sm text-indigo-700">
              <p>
                <strong>•</strong> Audit files are generated on-demand and contain invoice-level transaction detail
              </p>
              <p>
                <strong>•</strong> Files include sales invoices, purchase invoices, VAT amounts, and customer/supplier data
              </p>
              <p>
                <strong>•</strong> CSV format is recommended for compatibility with most accounting software
              </p>
              <p>
                <strong>•</strong> All amounts are reported in the original currency (AED for UAE transactions)
              </p>
              <p>
                <strong>•</strong> Records are retained for 5 years as per UAE FTA regulations
              </p>
            </div>
          </CardContent>
        </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
