import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { companyAPI } from '../lib/api';
import { Save, AlertCircle, CheckCircle } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';

const EMIRATES = [
  'Abu Dhabi',
  'Dubai',
  'Sharjah',
  'Ajman',
  'Umm Al Quwain',
  'Ras Al Khaimah',
  'Fujairah'
];

export default function CompanyInfoEditDialog({ open, onOpenChange, company, onSave }) {
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
    po_box: ''
  });

  useEffect(() => {
    if (company) {
      setFormData({
        legal_name: company.legal_name || '',
        phone: company.phone || '',
        website: company.website || '',
        address_line1: company.address_line1 || '',
        address_line2: company.address_line2 || '',
        city: company.city || '',
        emirate: company.emirate || '',
        po_box: company.po_box || ''
      });
    }
  }, [company]);

  const updateMutation = useMutation({
    mutationFn: (payload) => companyAPI.updateCompanyProfile(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company'] });
      setSuccess('Company profile updated successfully!');
      
      if (onSave) {
        onSave();
      }
      
      setTimeout(() => {
        setSuccess('');
        onOpenChange(false);
      }, 1500);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Company Information</DialogTitle>
        </DialogHeader>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
            <AlertCircle className="text-red-600" size={18} />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
            <CheckCircle className="text-green-600" size={18} />
            <p className="text-sm text-green-800">{success}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Company Details</h3>
            
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
          </div>

          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-semibold text-gray-900">Address Details</h3>
            
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
                  P.O. Box
                </label>
                <Input
                  type="text"
                  name="po_box"
                  value={formData.po_box}
                  onChange={handleChange}
                  placeholder="00000"
                  className="w-full"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={updateMutation.isPending}
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
      </DialogContent>
    </Dialog>
  );
}
