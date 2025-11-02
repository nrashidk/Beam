import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { ArrowLeft, CheckCircle, Info, FileText, Upload } from 'lucide-react';
import Sidebar from '../components/Sidebar';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function BackToDashboard() {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate('/dashboard')}
      className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
    >
      <ArrowLeft size={20} />
      <span>Back to Dashboard</span>
    </button>
  );
}

export default function VATSettings() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [certificateFile, setCertificateFile] = useState(null);
  const [uploadingCert, setUploadingCert] = useState(false);
  
  const [settings, setSettings] = useState({
    vat_enabled: false,
    tax_registration_number: '',
    vat_registration_date: '',
    formatted_trn: null,
    vat_certificate_uploaded: false
  });
  
  // Track if VAT is actually active (saved in database)
  const [isVatActive, setIsVatActive] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await axios.get(`${API_URL}/settings/vat`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const vatEnabled = response.data.vat_enabled || false;
      const hasTrn = !!response.data.tax_registration_number;
      
      setSettings({
        vat_enabled: vatEnabled,
        tax_registration_number: response.data.tax_registration_number || '',
        vat_registration_date: response.data.vat_registration_date || '',
        formatted_trn: response.data.formatted_trn,
        vat_certificate_uploaded: response.data.vat_certificate_uploaded || false
      });
      
      // VAT is truly active only if enabled AND has TRN saved in database
      setIsVatActive(vatEnabled && hasTrn);
    } catch (error) {
      console.error('Failed to fetch VAT settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCertificateUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type (PDF only)
    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }

    setUploadingCert(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post(`${API_URL}/settings/vat/certificate`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      setSuccess('VAT certificate uploaded successfully!');
      await fetchSettings();
      setCertificateFile(null);
    } catch (error) {
      setError(error.response?.data?.detail || 'Failed to upload certificate');
    } finally {
      setUploadingCert(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    
    try {
      const payload = {
        vat_enabled: settings.vat_enabled
      };
      
      if (settings.vat_enabled) {
        if (!settings.tax_registration_number) {
          setError('Please enter your Tax Registration Number (TRN)');
          setSaving(false);
          return;
        }

        if (settings.tax_registration_number.length !== 15) {
          setError('TRN must be exactly 15 digits');
          setSaving(false);
          return;
        }

        payload.tax_registration_number = settings.tax_registration_number;

        if (settings.vat_registration_date) {
          payload.vat_registration_date = settings.vat_registration_date;
        }
      }

      const response = await axios.put(`${API_URL}/settings/vat`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Show temporary success message
      setSuccess(response.data.message || 'VAT settings saved successfully!');
      
      // Refresh settings from database
      await fetchSettings();
      
      // Clear temporary success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.response?.data?.detail || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading VAT settings...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />
      
      <div className="flex-1 ml-64">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <BackToDashboard />
          
          <div className="space-y-6">
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="pt-6">
                <div className="flex gap-4">
                  <Info className="text-blue-600 flex-shrink-0" size={24} />
                  <div className="space-y-2">
                    <h3 className="font-semibold text-blue-900">About UAE VAT Registration</h3>
                    <p className="text-sm text-blue-800">
                      If your business is registered for VAT in the UAE, enable this setting to unlock 
                      VAT-compliant features including tax code selection, automatic invoice classification, 
                      and FTA audit file generation.
                    </p>
                    <p className="text-sm text-blue-800 font-medium">
                      Your 15-digit Tax Registration Number (TRN) will appear on all invoices when VAT is enabled.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">VAT Registration</CardTitle>
                <CardDescription>
                  Configure your business VAT registration status and TRN
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
                    <Info className="text-red-600 flex-shrink-0" size={20} />
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                )}

                {success && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
                    <CheckCircle className="text-green-600 flex-shrink-0" size={20} />
                    <p className="text-sm text-green-800">{success}</p>
                  </div>
                )}

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">My business is VAT-registered</div>
                    <div className="text-sm text-gray-600">
                      Enable this if you have a valid UAE Tax Registration Number
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={settings.vat_enabled}
                      onChange={(e) => {
                        const enabled = e.target.checked;
                        setSettings({ ...settings, vat_enabled: enabled });
                        setError('');
                        setSuccess('');
                        // Clear active state when user toggles off (banner will disappear)
                        if (!enabled) {
                          setIsVatActive(false);
                        }
                      }}
                    />
                    <div className="w-14 h-7 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {settings.vat_enabled && (
                  <div className="space-y-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Tax Registration Number (TRN) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        maxLength="15"
                        placeholder="123456789012345"
                        value={settings.tax_registration_number}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '');
                          setSettings({ ...settings, tax_registration_number: value });
                          setError('');
                          setSuccess('');
                        }}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-lg"
                      />
                      <p className="mt-2 text-sm text-gray-600">
                        Enter exactly 15 digits (e.g., 123456789012345)
                      </p>
                      {settings.formatted_trn && (
                        <p className="mt-2 text-sm text-green-700 font-medium">
                          ✓ Formatted: {settings.formatted_trn}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        VAT Registration Date (Optional)
                      </label>
                      <input
                        type="date"
                        value={settings.vat_registration_date}
                        onChange={(e) => {
                          setSettings({ ...settings, vat_registration_date: e.target.value });
                          setError('');
                          setSuccess('');
                        }}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <p className="mt-2 text-sm text-gray-600">
                        The date your business became VAT-registered with the FTA
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        VAT Registration Certificate (Optional)
                      </label>
                      <div className="flex items-center gap-3">
                        <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition-colors">
                          <Upload size={20} className="text-gray-500" />
                          <span className="text-sm text-gray-600">
                            {certificateFile ? certificateFile.name : 'Choose PDF file (max 5MB)'}
                          </span>
                          <input
                            type="file"
                            accept="application/pdf"
                            onChange={handleCertificateUpload}
                            className="hidden"
                            disabled={uploadingCert}
                          />
                        </label>
                        {uploadingCert && (
                          <span className="text-sm text-blue-600">Uploading...</span>
                        )}
                      </div>
                      {settings.vat_certificate_uploaded && (
                        <p className="mt-2 text-sm text-green-700 font-medium flex items-center gap-2">
                          <CheckCircle size={16} />
                          Certificate uploaded
                        </p>
                      )}
                      <p className="mt-2 text-sm text-gray-600">
                        Upload your FTA VAT registration certificate (PDF format only)
                      </p>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <div className="flex gap-3">
                        <FileText className="text-amber-600 flex-shrink-0" size={20} />
                        <div className="text-sm text-amber-800">
                          <p className="font-semibold mb-1">What happens when you enable VAT?</p>
                          <ul className="list-disc list-inside space-y-1">
                            <li>Your TRN will appear on all invoices</li>
                            <li>Tax code selectors will be available when creating invoices</li>
                            <li>Invoices will be classified as "Full Tax Invoice" (≥ AED 10,000) or "Simplified Tax Invoice" (&lt; AED 10,000)</li>
                            <li>VAT reports and FTA audit files will be accessible</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-4 justify-end pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => navigate('/dashboard')}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={saving || (settings.vat_enabled && !settings.tax_registration_number)}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {saving ? 'Saving...' : 'Save VAT Settings'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* VAT Registration Active Banner - Only shown after successful save */}
            {isVatActive && (
              <Card className="border-green-200 bg-green-50">
                <CardContent className="pt-6">
                  <div className="flex gap-4">
                    <CheckCircle className="text-green-600 flex-shrink-0" size={24} />
                    <div className="space-y-1">
                      <h3 className="font-semibold text-green-900">VAT Registration Active</h3>
                      <p className="text-sm text-green-800">
                        Your business is configured as VAT-registered. All invoices will include your TRN and comply with UAE Federal Tax Authority requirements.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
