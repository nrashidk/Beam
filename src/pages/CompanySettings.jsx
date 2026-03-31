import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { companyAPI } from '../lib/api';
import { ArrowLeft, Save, AlertCircle, CheckCircle, Shield } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

const EMIRATES = [
  'Abu Dhabi',
  'Dubai',
  'Sharjah',
  'Ajman',
  'Umm Al Quwain',
  'Ras Al Khaimah',
  'Fujairah'
];

export default function CompanySettings() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({
    legal_name: '',
    phone: '',
    website: '',
    address_line1: '',
    address_line2: '',
    city: '',
    emirate: '',
    postal_code: ''
  });

  const { data: company, isLoading } = useQuery({
    queryKey: ['company'],
    queryFn: async () => {
      const response = await companyAPI.getMyCompany();
      const data = response.data;
      setFormData({
        legal_name: data.legal_name || '',
        phone: data.phone || '',
        website: data.website || '',
        address_line1: data.address_line1 || '',
        address_line2: data.address_line2 || '',
        city: data.city || '',
        emirate: data.emirate || '',
        postal_code: data.postal_code || ''
      });
      return data;
    },
    onError: (error) => {
      console.error('Failed to load company data:', error);
      setError('Failed to load company information');
    }
  });

  const updateMutation = useMutation({
    mutationFn: (payload) => companyAPI.updateCompanyProfile(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company'] });
      setSuccess('Company profile updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    },
    onError: (error) => {
      console.error('Failed to update company profile:', error);
      setError(error.response?.data?.detail || 'Failed to update company profile');
    }
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.legal_name.trim()) {
      setError('Legal name is required');
      return;
    }

    setError('');
    setSuccess('');
    updateMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-lg text-gray-600">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 ml-64 flex flex-col">
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-indigo-600 flex-shrink-0" />
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Company Settings</h1>
              <p className="text-sm text-gray-500 mt-0.5">Update your company information and contact details</p>
            </div>
          </div>
        </div>
        <div className="flex-1 p-6">
          <div className="max-w-4xl mx-auto space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
              <AlertCircle className="text-red-600" size={20} />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
              <CheckCircle className="text-green-600" size={20} />
              <p className="text-sm text-green-800">{success}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <Card className="rounded-2xl shadow-lg">
              <CardHeader className="border-b">
                <CardTitle>Company Information</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Legal Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    name="legal_name"
                    value={formData.legal_name}
                    onChange={handleChange}
                    placeholder="Enter company legal name"
                    required
                    className="w-full"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number
                    </label>
                    <Input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="+971 50 123 4567"
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Website
                    </label>
                    <Input
                      type="text"
                      name="website"
                      value={formData.website}
                      onChange={handleChange}
                      placeholder="www.example.com or example.com"
                      className="w-full"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl shadow-lg">
              <CardHeader className="border-b">
                <CardTitle>Address Details</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address Line 1
                  </label>
                  <Input
                    type="text"
                    name="address_line1"
                    value={formData.address_line1}
                    onChange={handleChange}
                    placeholder="Building name, floor, office number"
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address Line 2
                  </label>
                  <Input
                    type="text"
                    name="address_line2"
                    value={formData.address_line2}
                    onChange={handleChange}
                    placeholder="Street name, area"
                    className="w-full"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      City
                    </label>
                    <Input
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      placeholder="Enter city"
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Emirate
                    </label>
                    <select
                      name="emirate"
                      value={formData.emirate}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      <option value="">Select Emirate</option>
                      {EMIRATES.map(emirate => (
                        <option key={emirate} value={emirate}>{emirate}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Postal Code
                    </label>
                    <Input
                      type="text"
                      name="postal_code"
                      value={formData.postal_code}
                      onChange={handleChange}
                      placeholder="00000"
                      className="w-full"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/dashboard')}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateMutation.isPending}
                className="gap-2"
              >
                <Save size={16} />
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
  );
}
