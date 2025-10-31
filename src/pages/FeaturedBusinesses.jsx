import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { ArrowLeft, Plus, Trash2, RefreshCcw, Search, Edit } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

export default function FeaturedBusinesses() {
  const { isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [featured, setFeatured] = useState([]);
  const [allCompanies, setAllCompanies] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newFeatured, setNewFeatured] = useState({
    company_id: '',
    display_name: '',
    logo_url: ''
  });
  const [editingFeatured, setEditingFeatured] = useState(null);

  useEffect(() => {
    if (!isSuperAdmin) {
      navigate('/dashboard');
      return;
    }
    fetchData();
  }, [isSuperAdmin, navigate]);

  async function fetchData() {
    try {
      setLoading(true);
      const [featuredRes, companiesRes] = await Promise.all([
        api.get('/admin/featured-businesses'),
        api.get('/admin/stats?from=2024-01-01&to=2025-12-31')
      ]);
      setFeatured(featuredRes.data);
      setAllCompanies(companiesRes.data?.companies?.all || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      alert('Failed to load featured businesses');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddFeatured() {
    if (!newFeatured.company_id) {
      alert('Please select a company');
      return;
    }

    try {
      setSaving(true);
      await api.post('/admin/featured-businesses', newFeatured);
      await fetchData();
      setShowAddModal(false);
      setNewFeatured({
        company_id: '',
        display_name: '',
        logo_url: ''
      });
    } catch (error) {
      console.error('Failed to add featured business:', error);
      alert(error.response?.data?.detail || 'Failed to add featured business');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateFeatured() {
    if (!editingFeatured) return;

    try {
      setSaving(true);
      await api.put(`/admin/featured-businesses/${editingFeatured.id}`, {
        display_name: editingFeatured.display_name,
        logo_url: editingFeatured.logo_url,
        is_active: editingFeatured.is_active,
        display_order: editingFeatured.display_order
      });
      await fetchData();
      setShowEditModal(false);
      setEditingFeatured(null);
    } catch (error) {
      console.error('Failed to update featured business:', error);
      alert(error.response?.data?.detail || 'Failed to update featured business');
    } finally {
      setSaving(false);
    }
  }

  function openEditModal(featured) {
    setEditingFeatured({...featured});
    setShowEditModal(true);
  }

  async function handleRemoveFeatured(featuredId) {
    if (!confirm('Remove this business from the featured list?')) return;

    try {
      await api.delete(`/admin/featured-businesses/${featuredId}`);
      await fetchData();
    } catch (error) {
      console.error('Failed to remove featured business:', error);
      alert('Failed to remove featured business');
    }
  }

  const filteredCompanies = allCompanies.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const availableCompanies = allCompanies.filter(c => 
    !featured.some(f => f.company_id === c.id)
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/dashboard')}
              className="rounded-full"
            >
              <ArrowLeft size={18} />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Featured Businesses</h1>
              <p className="text-sm text-gray-600">Manage companies shown on the homepage moving bar</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              className="rounded-full"
            >
              <RefreshCcw size={16} className="mr-2" />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => setShowAddModal(true)}
              className="rounded-full"
            >
              <Plus size={16} className="mr-2" />
              Add Featured Business
            </Button>
          </div>
        </div>

        {featured.length === 0 ? (
          <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-12 text-center">
              <p className="text-gray-600 mb-4">No featured businesses yet</p>
              <Button onClick={() => setShowAddModal(true)}>
                <Plus size={16} className="mr-2" />
                Add Your First Featured Business
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {featured.map((f) => (
              <Card key={f.id} className="rounded-2xl shadow-sm">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {f.logo_url && (
                        <img 
                          src={f.logo_url} 
                          alt={f.display_name || f.company_name}
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                      )}
                      <div>
                        <CardTitle className="text-lg">
                          {f.display_name || f.company_name}
                        </CardTitle>
                        <p className="text-sm text-gray-600">{f.company_name}</p>
                      </div>
                      {f.is_active ? (
                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </div>
                    <div className="flex gap-2 items-center">
                      <Badge variant="outline" className="text-xs">
                        Order: {f.display_order}
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditModal(f)}
                        className="rounded-full"
                      >
                        <Edit size={16} />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRemoveFeatured(f.id)}
                        className="rounded-full text-red-600 hover:text-red-700"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}

        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-lg rounded-2xl">
              <CardHeader>
                <CardTitle>Add Featured Business</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Select Company</label>
                  <select
                    value={newFeatured.company_id}
                    onChange={(e) => setNewFeatured({ ...newFeatured, company_id: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- Select a company --</option>
                    {availableCompanies.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {availableCompanies.length} companies available
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Display Name (Optional)
                  </label>
                  <Input
                    value={newFeatured.display_name}
                    onChange={(e) => setNewFeatured({ ...newFeatured, display_name: e.target.value })}
                    placeholder="Leave empty to use company name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Logo URL (Optional)
                  </label>
                  <Input
                    value={newFeatured.logo_url}
                    onChange={(e) => setNewFeatured({ ...newFeatured, logo_url: e.target.value })}
                    placeholder="https://example.com/logo.png"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Display order will be automatically assigned
                  </p>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={handleAddFeatured}
                    disabled={saving}
                    className="flex-1"
                  >
                    {saving ? 'Adding...' : 'Add Featured Business'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowAddModal(false);
                      setNewFeatured({
                        company_id: '',
                        display_name: '',
                        logo_url: ''
                      });
                    }}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {showEditModal && editingFeatured && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-lg rounded-2xl">
              <CardHeader>
                <CardTitle>Edit Featured Business</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Company
                  </label>
                  <Input
                    value={editingFeatured.company_name}
                    disabled
                    className="bg-gray-100"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Company cannot be changed
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Display Name (Optional)
                  </label>
                  <Input
                    value={editingFeatured.display_name || ''}
                    onChange={(e) => setEditingFeatured({ ...editingFeatured, display_name: e.target.value })}
                    placeholder="Leave empty to use company name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Logo URL (Optional)
                  </label>
                  <Input
                    value={editingFeatured.logo_url || ''}
                    onChange={(e) => setEditingFeatured({ ...editingFeatured, logo_url: e.target.value })}
                    placeholder="https://example.com/logo.png"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Display Order
                  </label>
                  <Input
                    type="number"
                    value={editingFeatured.display_order}
                    onChange={(e) => setEditingFeatured({ ...editingFeatured, display_order: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Lower numbers appear first
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={editingFeatured.is_active}
                    onChange={(e) => setEditingFeatured({ ...editingFeatured, is_active: e.target.checked })}
                    className="w-4 h-4 rounded"
                  />
                  <label htmlFor="is_active" className="text-sm font-medium">
                    Active (show on homepage)
                  </label>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={handleUpdateFeatured}
                    disabled={saving}
                    className="flex-1"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowEditModal(false);
                      setEditingFeatured(null);
                    }}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
