import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { ArrowLeft, CheckCircle, XCircle, RefreshCw, Network, Key, Globe, Info } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function PEPPOLSettings() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  
  const [settings, setSettings] = useState({
    peppol_enabled: false,
    peppol_provider: '',
    peppol_participant_id: '',
    peppol_base_url: '',
    peppol_api_key: '',
    peppol_configured_at: null,
    peppol_last_tested_at: null
  });

  const providers = [
    {
      id: 'mock',
      name: 'Mock Provider (Testing)',
      description: 'For development and testing - simulates PEPPOL transmission',
      defaultUrl: 'https://mock.peppol.local',
      requiresKey: false
    },
    {
      id: 'tradeshift',
      name: 'Tradeshift',
      description: 'Global PEPPOL provider with proven UAE support',
      defaultUrl: 'https://api.tradeshift.com/v1',
      requiresKey: true,
      docsUrl: 'https://developers.tradeshift.com/'
    },
    {
      id: 'basware',
      name: 'Basware',
      description: 'Enterprise PEPPOL provider with comprehensive features',
      defaultUrl: 'https://api.basware.com/v1',
      requiresKey: true,
      docsUrl: 'https://developer.basware.com/'
    }
  ];

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await axios.get(`${API_URL}/settings/peppol`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSettings(response.data);
    } catch (error) {
      console.error('Failed to fetch PEPPOL settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProviderSelect = (providerId) => {
    const provider = providers.find(p => p.id === providerId);
    setSettings({
      ...settings,
      peppol_provider: providerId,
      peppol_base_url: provider.defaultUrl
    });
    setTestResult(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setTestResult(null);
    
    try {
      const response = await axios.put(`${API_URL}/settings/peppol`, settings, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      alert('PEPPOL settings saved successfully!');
      fetchSettings(); // Refresh to get updated timestamps
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert(error.response?.data?.detail || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    
    try {
      const response = await axios.post(`${API_URL}/settings/peppol/test`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setTestResult(response.data);
    } catch (error) {
      console.error('Connection test failed:', error);
      setTestResult({
        success: false,
        error: error.response?.data?.detail || error.message,
        message: 'Connection test failed'
      });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading PEPPOL settings...</div>
      </div>
    );
  }

  const selectedProvider = providers.find(p => p.id === settings.peppol_provider);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => navigate('/dashboard')}
              variant="ghost"
              size="sm"
              className="gap-2"
            >
              <ArrowLeft size={16} />
              Back to Dashboard
            </Button>
            <div className="text-xl font-bold">PEPPOL Settings</div>
          </div>
          
          <Badge variant={settings.peppol_enabled ? "success" : "outline"}>
            {settings.peppol_enabled ? 'Enabled' : 'Disabled'}
          </Badge>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Info Banner */}
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <Info className="text-blue-600 flex-shrink-0" size={24} />
              <div className="space-y-2">
                <h3 className="font-semibold text-blue-900">About PEPPOL Integration</h3>
                <p className="text-sm text-blue-800">
                  PEPPOL (Pan-European Public Procurement On-Line) is the international network for e-invoicing. 
                  In UAE, starting July 2026, all B2B/B2G invoices must be transmitted via accredited PEPPOL providers.
                  InvoLinks integrates with certified providers to send and receive invoices automatically.
                </p>
                <p className="text-sm text-blue-800 font-medium">
                  Configure your provider below to enable automated invoice transmission and FTA reporting.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Enable/Disable Toggle */}
        <Card>
          <CardHeader>
            <CardTitle>PEPPOL Status</CardTitle>
            <CardDescription>Enable or disable PEPPOL network integration</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <div className="font-medium">PEPPOL Integration</div>
                <div className="text-sm text-gray-500">
                  {settings.peppol_enabled 
                    ? 'Invoices will be transmitted via PEPPOL network' 
                    : 'PEPPOL transmission is disabled'}
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={settings.peppol_enabled}
                  onChange={(e) => setSettings({...settings, peppol_enabled: e.target.checked})}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Provider Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Network size={20} />
              Select PEPPOL Provider
            </CardTitle>
            <CardDescription>Choose your accredited service provider</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {providers.map((provider) => (
              <div
                key={provider.id}
                onClick={() => handleProviderSelect(provider.id)}
                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  settings.peppol_provider === provider.id
                    ? 'border-indigo-600 bg-indigo-50'
                    : 'border-gray-200 hover:border-indigo-300'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{provider.name}</h3>
                      {settings.peppol_provider === provider.id && (
                        <CheckCircle size={18} className="text-indigo-600" />
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{provider.description}</p>
                    {provider.docsUrl && (
                      <a
                        href={provider.docsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-indigo-600 hover:underline mt-2 inline-block"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View documentation →
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Configuration Form */}
        {settings.peppol_provider && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key size={20} />
                  Provider Configuration
                </CardTitle>
                <CardDescription>
                  Configure your {selectedProvider?.name} connection details
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Participant ID */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Your PEPPOL Participant ID
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., 0190:123456789012345"
                    value={settings.peppol_participant_id}
                    onChange={(e) => setSettings({...settings, peppol_participant_id: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Format: 0190:&lt;Your 15-digit TRN&gt; (UAE scheme identifier)
                  </p>
                </div>

                {/* Base URL */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Globe size={16} />
                    API Base URL
                  </label>
                  <input
                    type="text"
                    placeholder="https://api.provider.com/v1"
                    value={settings.peppol_base_url}
                    onChange={(e) => setSettings({...settings, peppol_base_url: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    {selectedProvider?.id === 'mock' 
                      ? 'Mock URL for testing (no actual API calls)' 
                      : 'Use sandbox URL for testing, production URL for live invoices'}
                  </p>
                </div>

                {/* API Key */}
                {selectedProvider?.requiresKey && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      API Key / Credentials
                    </label>
                    <input
                      type="password"
                      placeholder="Enter your API key"
                      value={settings.peppol_api_key || ''}
                      onChange={(e) => setSettings({...settings, peppol_api_key: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      Obtain from your provider's developer portal
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Test Connection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw size={20} />
                  Test Connection
                </CardTitle>
                <CardDescription>
                  Verify your PEPPOL provider configuration
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  onClick={handleTestConnection}
                  disabled={testing || !settings.peppol_enabled}
                  className="w-full gap-2"
                  variant="outline"
                >
                  {testing ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      Testing Connection...
                    </>
                  ) : (
                    <>
                      <RefreshCw size={16} />
                      Test PEPPOL Connection
                    </>
                  )}
                </Button>

                {testResult && (
                  <div className={`p-4 rounded-lg ${testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                    <div className="flex items-start gap-3">
                      {testResult.success ? (
                        <CheckCircle className="text-green-600 flex-shrink-0" size={24} />
                      ) : (
                        <XCircle className="text-red-600 flex-shrink-0" size={24} />
                      )}
                      <div className="flex-1">
                        <div className={`font-semibold ${testResult.success ? 'text-green-900' : 'text-red-900'}`}>
                          {testResult.message}
                        </div>
                        {testResult.error && (
                          <div className="text-sm text-red-700 mt-1">{testResult.error}</div>
                        )}
                        {testResult.success && testResult.participant_valid !== undefined && (
                          <div className="text-sm text-green-700 mt-1">
                            Participant ID: {testResult.participant_valid ? 'Valid ✓' : 'Not found in network'}
                          </div>
                        )}
                        {testResult.tested_at && (
                          <div className="text-sm text-gray-600 mt-1">
                            Tested: {new Date(testResult.tested_at).toLocaleString()}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {settings.peppol_last_tested_at && !testResult && (
                  <div className="text-sm text-gray-500 text-center">
                    Last tested: {new Date(settings.peppol_last_tested_at).toLocaleString()}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Save Button */}
        <div className="flex justify-end gap-4">
          <Button
            onClick={() => navigate('/dashboard')}
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !settings.peppol_provider}
            className="gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>
    </div>
  );
}
