import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { ArrowLeft, Save, RefreshCcw, Edit2, Check, X } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

export default function TierManagement() {
  const { isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState([]);
  const [editingPlan, setEditingPlan] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isSuperAdmin) {
      navigate('/dashboard');
      return;
    }
    fetchPlans();
  }, [isSuperAdmin, navigate]);

  async function fetchPlans() {
    try {
      setLoading(true);
      const response = await api.get('/admin/subscription-plans');
      setPlans(response.data);
    } catch (error) {
      console.error('Failed to fetch plans:', error);
      alert('Failed to load subscription plans');
    } finally {
      setLoading(false);
    }
  }

  function startEditing(plan) {
    setEditingPlan({ ...plan });
  }

  function cancelEditing() {
    setEditingPlan(null);
  }

  async function savePlan() {
    if (!editingPlan) return;

    try {
      setSaving(true);
      await api.put(`/admin/subscription-plans/${editingPlan.id}`, {
        name: editingPlan.name,
        description: editingPlan.description,
        price_monthly: parseFloat(editingPlan.price_monthly),
        price_yearly: parseFloat(editingPlan.price_yearly),
        max_invoices_per_month: editingPlan.max_invoices_per_month ? parseInt(editingPlan.max_invoices_per_month) : null,
        max_users: parseInt(editingPlan.max_users),
        max_business_admins: parseInt(editingPlan.max_business_admins),
        max_finance_users: parseInt(editingPlan.max_finance_users),
        max_pos_devices: parseInt(editingPlan.max_pos_devices),
        allow_api_access: editingPlan.allow_api_access,
        allow_branding: editingPlan.allow_branding,
        allow_multi_currency: editingPlan.allow_multi_currency,
        priority_support: editingPlan.priority_support,
        active: editingPlan.active
      });
      
      await fetchPlans();
      setEditingPlan(null);
      alert('Subscription plan updated successfully');
    } catch (error) {
      console.error('Failed to save plan:', error);
      alert('Failed to update subscription plan');
    } finally {
      setSaving(false);
    }
  }

  function updateField(field, value) {
    setEditingPlan(prev => ({ ...prev, [field]: value }));
  }

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
              <h1 className="text-2xl font-bold">Tier Management</h1>
              <p className="text-sm text-gray-600">Manage subscription plan limits and features</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchPlans}
            className="rounded-full"
          >
            <RefreshCcw size={16} className="mr-2" />
            Refresh
          </Button>
        </div>

        <div className="grid gap-4">
          {plans.map(plan => {
            const isEditing = editingPlan?.id === plan.id;
            const currentPlan = isEditing ? editingPlan : plan;

            return (
              <Card key={plan.id} className="rounded-2xl shadow-sm">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-xl">
                        {isEditing ? (
                          <Input
                            value={currentPlan.name}
                            onChange={(e) => updateField('name', e.target.value)}
                            className="h-8 w-48"
                          />
                        ) : (
                          currentPlan.name
                        )}
                      </CardTitle>
                      {currentPlan.active ? (
                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {isEditing ? (
                        <>
                          <Button
                            size="sm"
                            onClick={savePlan}
                            disabled={saving}
                            className="rounded-full"
                          >
                            <Check size={16} className="mr-2" />
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={cancelEditing}
                            disabled={saving}
                            className="rounded-full"
                          >
                            <X size={16} className="mr-2" />
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => startEditing(plan)}
                          className="rounded-full"
                        >
                          <Edit2 size={16} className="mr-2" />
                          Edit
                        </Button>
                      )}
                    </div>
                  </div>
                  {isEditing && (
                    <Input
                      value={currentPlan.description || ''}
                      onChange={(e) => updateField('description', e.target.value)}
                      placeholder="Description"
                      className="mt-2"
                    />
                  )}
                  {!isEditing && currentPlan.description && (
                    <p className="text-sm text-gray-600 mt-1">{currentPlan.description}</p>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-gray-700">Pricing</h4>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-600 w-24">Monthly:</span>
                          {isEditing ? (
                            <Input
                              type="number"
                              step="0.01"
                              value={currentPlan.price_monthly}
                              onChange={(e) => updateField('price_monthly', e.target.value)}
                              className="h-8 w-32"
                            />
                          ) : (
                            <span className="text-sm font-medium">AED {currentPlan.price_monthly.toFixed(2)}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-600 w-24">Yearly:</span>
                          {isEditing ? (
                            <Input
                              type="number"
                              step="0.01"
                              value={currentPlan.price_yearly}
                              onChange={(e) => updateField('price_yearly', e.target.value)}
                              className="h-8 w-32"
                            />
                          ) : (
                            <span className="text-sm font-medium">AED {currentPlan.price_yearly.toFixed(2)}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-gray-700">User Limits</h4>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-600 w-32">Total Users:</span>
                          {isEditing ? (
                            <Input
                              type="number"
                              value={currentPlan.max_users}
                              onChange={(e) => updateField('max_users', e.target.value)}
                              className="h-8 w-20"
                            />
                          ) : (
                            <span className="text-sm font-medium">{currentPlan.max_users}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-600 w-32">Business Admins:</span>
                          {isEditing ? (
                            <Input
                              type="number"
                              value={currentPlan.max_business_admins}
                              onChange={(e) => updateField('max_business_admins', e.target.value)}
                              className="h-8 w-20"
                            />
                          ) : (
                            <span className="text-sm font-medium">{currentPlan.max_business_admins}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-600 w-32">Finance Users:</span>
                          {isEditing ? (
                            <Input
                              type="number"
                              value={currentPlan.max_finance_users}
                              onChange={(e) => updateField('max_finance_users', e.target.value)}
                              className="h-8 w-20"
                            />
                          ) : (
                            <span className="text-sm font-medium">{currentPlan.max_finance_users}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-gray-700">Resource Limits</h4>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-600 w-32">Invoices/Month:</span>
                          {isEditing ? (
                            <Input
                              type="number"
                              value={currentPlan.max_invoices_per_month || ''}
                              onChange={(e) => updateField('max_invoices_per_month', e.target.value)}
                              placeholder="Unlimited"
                              className="h-8 w-20"
                            />
                          ) : (
                            <span className="text-sm font-medium">
                              {currentPlan.max_invoices_per_month || 'Unlimited'}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-600 w-32">POS Devices:</span>
                          {isEditing ? (
                            <Input
                              type="number"
                              value={currentPlan.max_pos_devices}
                              onChange={(e) => updateField('max_pos_devices', e.target.value)}
                              className="h-8 w-20"
                            />
                          ) : (
                            <span className="text-sm font-medium">{currentPlan.max_pos_devices}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-gray-700">Features</h4>
                      <div className="space-y-1">
                        {['allow_api_access', 'allow_branding', 'allow_multi_currency', 'priority_support'].map(feature => (
                          <div key={feature} className="flex items-center gap-2">
                            {isEditing ? (
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={currentPlan[feature]}
                                  onChange={(e) => updateField(feature, e.target.checked)}
                                  className="h-4 w-4 rounded border-gray-300"
                                />
                                <span className="text-xs text-gray-700">
                                  {feature.replace('allow_', '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                </span>
                              </label>
                            ) : (
                              <>
                                <div className={`h-2 w-2 rounded-full ${currentPlan[feature] ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                                <span className="text-xs text-gray-700">
                                  {feature.replace('allow_', '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                </span>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
