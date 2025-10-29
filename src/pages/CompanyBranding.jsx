import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../lib/api';
import { ArrowLeft, Upload, X, CheckCircle, AlertCircle, Image as ImageIcon } from 'lucide-react';
import Sidebar from '../components/Sidebar';

export default function CompanyBranding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [branding, setBranding] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [stampPreview, setStampPreview] = useState(null);
  const [uploading, setUploading] = useState({ logo: false, stamp: false });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadBranding();
  }, []);

  const loadBranding = async () => {
    if (!user?.company_id) return;

    try {
      setLoading(true);
      const response = await apiClient.get(`/companies/${user.company_id}/branding`);
      setBranding(response.data);
      
      // Set preview URLs
      if (response.data.logo_file_name) {
        setLogoPreview(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/companies/${user.company_id}/branding/logo?t=${Date.now()}`);
      }
      if (response.data.stamp_file_name) {
        setStampPreview(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/companies/${user.company_id}/branding/stamp?t=${Date.now()}`);
      }
    } catch (error) {
      if (error.response?.status !== 404) {
        console.error('Failed to load branding:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!['image/png', 'image/svg+xml'].includes(file.type)) {
      setError('Only PNG and SVG files are allowed');
      return;
    }

    // Validate file size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      setError('File size must be less than 2MB');
      return;
    }

    setError('');
    setUploading({ ...uploading, logo: true });

    try {
      const formData = new FormData();
      formData.append('logo', file);

      await apiClient.post(`/companies/${user.company_id}/branding/logo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setSuccess('Logo uploaded successfully!');
      setTimeout(() => setSuccess(''), 3000);
      
      // Reload branding data
      await loadBranding();
    } catch (error) {
      setError(error.response?.data?.detail || 'Failed to upload logo');
    } finally {
      setUploading({ ...uploading, logo: false });
    }
  };

  const handleStampUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!['image/png', 'image/svg+xml'].includes(file.type)) {
      setError('Only PNG and SVG files are allowed');
      return;
    }

    // Validate file size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      setError('File size must be less than 2MB');
      return;
    }

    setError('');
    setUploading({ ...uploading, stamp: true });

    try {
      const formData = new FormData();
      formData.append('stamp', file);

      await apiClient.post(`/companies/${user.company_id}/branding/stamp`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setSuccess('Stamp uploaded successfully!');
      setTimeout(() => setSuccess(''), 3000);
      
      // Reload branding data
      await loadBranding();
    } catch (error) {
      setError(error.response?.data?.detail || 'Failed to upload stamp');
    } finally {
      setUploading({ ...uploading, stamp: false });
    }
  };

  const handleDeleteLogo = async () => {
    if (!confirm('Are you sure you want to delete the company logo?')) return;

    try {
      await apiClient.delete(`/companies/${user.company_id}/branding/logo`);
      setSuccess('Logo deleted successfully!');
      setTimeout(() => setSuccess(''), 3000);
      setLogoPreview(null);
      await loadBranding();
    } catch (error) {
      setError(error.response?.data?.detail || 'Failed to delete logo');
    }
  };

  const handleDeleteStamp = async () => {
    if (!confirm('Are you sure you want to delete the company stamp?')) return;

    try {
      await apiClient.delete(`/companies/${user.company_id}/branding/stamp`);
      setSuccess('Stamp deleted successfully!');
      setTimeout(() => setSuccess(''), 3000);
      setStampPreview(null);
      await loadBranding();
    } catch (error) {
      setError(error.response?.data?.detail || 'Failed to delete stamp');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
          <p className="text-gray-600">Loading branding settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex">
      <Sidebar />
      
      <div className="flex-1 ml-64">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <BackToDashboard />

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Company Branding</h1>
          <p className="text-gray-600 mt-2">
            Upload your company logo and stamp to display on invoices
          </p>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-800 font-medium">Error</p>
              <p className="text-red-700 text-sm mt-1">{error}</p>
            </div>
            <button onClick={() => setError('')} className="text-red-600 hover:text-red-800">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-green-800 font-medium">Success</p>
              <p className="text-green-700 text-sm mt-1">{success}</p>
            </div>
            <button onClick={() => setSuccess('')} className="text-green-600 hover:text-green-800">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Info Box */}
        <div className="mb-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <ImageIcon className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900 mb-2">UAE E-Invoicing Compliance</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>✅ Logo and stamp are <strong>optional</strong> (not required by UAE law)</li>
                <li>✅ Images are for <strong>display purposes only</strong></li>
                <li>✅ Will NOT be transmitted via Peppol network (UBL XML is text-only)</li>
                <li>✅ Improves professional appearance and brand recognition</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Logo Upload */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Company Logo</h2>
            
            {logoPreview ? (
              <div className="space-y-4">
                <div className="border-2 border-gray-200 rounded-xl p-8 bg-gray-50">
                  <img
                    src={logoPreview}
                    alt="Company Logo"
                    className="max-h-32 mx-auto object-contain"
                  />
                </div>
                <div className="flex gap-3">
                  <label className="flex-1">
                    <input
                      type="file"
                      accept="image/png,image/svg+xml"
                      onChange={handleLogoUpload}
                      className="hidden"
                      disabled={uploading.logo}
                    />
                    <div className="w-full px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold text-center cursor-pointer hover:bg-indigo-700 disabled:opacity-50">
                      {uploading.logo ? 'Uploading...' : 'Replace Logo'}
                    </div>
                  </label>
                  <button
                    onClick={handleDeleteLogo}
                    className="px-4 py-2 bg-red-100 text-red-700 rounded-xl font-semibold hover:bg-red-200"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <label className="block">
                  <input
                    type="file"
                    accept="image/png,image/svg+xml"
                    onChange={handleLogoUpload}
                    className="hidden"
                    disabled={uploading.logo}
                  />
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-colors">
                    <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-700 font-medium mb-2">
                      {uploading.logo ? 'Uploading...' : 'Click to upload logo'}
                    </p>
                    <p className="text-sm text-gray-500">PNG or SVG (max 2MB)</p>
                  </div>
                </label>
              </div>
            )}

            <div className="mt-4 text-sm text-gray-600">
              <p className="font-medium mb-2">Logo Guidelines:</p>
              <ul className="space-y-1 text-xs">
                <li>• Formats: PNG or SVG</li>
                <li>• Max size: 2MB</li>
                <li>• Recommended: Square format (200x200px)</li>
                <li>• Will appear in invoice header</li>
              </ul>
            </div>
          </div>

          {/* Stamp Upload */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Company Stamp</h2>
            
            {stampPreview ? (
              <div className="space-y-4">
                <div className="border-2 border-gray-200 rounded-xl p-8 bg-gray-50">
                  <img
                    src={stampPreview}
                    alt="Company Stamp"
                    className="max-h-32 mx-auto object-contain"
                  />
                </div>
                <div className="flex gap-3">
                  <label className="flex-1">
                    <input
                      type="file"
                      accept="image/png,image/svg+xml"
                      onChange={handleStampUpload}
                      className="hidden"
                      disabled={uploading.stamp}
                    />
                    <div className="w-full px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold text-center cursor-pointer hover:bg-indigo-700 disabled:opacity-50">
                      {uploading.stamp ? 'Uploading...' : 'Replace Stamp'}
                    </div>
                  </label>
                  <button
                    onClick={handleDeleteStamp}
                    className="px-4 py-2 bg-red-100 text-red-700 rounded-xl font-semibold hover:bg-red-200"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <label className="block">
                  <input
                    type="file"
                    accept="image/png,image/svg+xml"
                    onChange={handleStampUpload}
                    className="hidden"
                    disabled={uploading.stamp}
                  />
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-colors">
                    <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-700 font-medium mb-2">
                      {uploading.stamp ? 'Uploading...' : 'Click to upload stamp'}
                    </p>
                    <p className="text-sm text-gray-500">PNG or SVG (max 2MB)</p>
                  </div>
                </label>
              </div>
            )}

            <div className="mt-4 text-sm text-gray-600">
              <p className="font-medium mb-2">Stamp Guidelines:</p>
              <ul className="space-y-1 text-xs">
                <li>• Formats: PNG or SVG</li>
                <li>• Max size: 2MB</li>
                <li>• Recommended: Square format (200x200px)</li>
                <li>• Will appear in invoice footer</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Preview Section */}
        {(logoPreview || stampPreview) && (
          <div className="mt-8 bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Invoice Preview</h2>
            <div className="border-2 border-gray-200 rounded-xl p-8">
              <div className="flex items-center justify-between mb-8">
                {logoPreview && (
                  <img src={logoPreview} alt="Logo" className="h-12 object-contain" />
                )}
                <div className="text-right">
                  <div className="text-2xl font-bold text-gray-900">INV-2024-001</div>
                  <div className="text-sm text-gray-500">Sample Invoice</div>
                </div>
              </div>
              
              <div className="border-t pt-6 text-center text-sm text-gray-500">
                <p className="mb-4">Invoice details would appear here...</p>
                {stampPreview && (
                  <div className="flex justify-end">
                    <div className="text-center">
                      <img src={stampPreview} alt="Stamp" className="h-20 mx-auto mb-2 object-contain" />
                      <p className="text-xs">Authorized Signature</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
