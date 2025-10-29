import React, { useState, useEffect } from 'react';
import { 
  CreditCard, Calendar, TrendingUp, AlertCircle, CheckCircle, 
  Plus, Trash2, Shield, Clock, Award, ArrowRight
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';

export default function BillingSettings() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [trialStatus, setTrialStatus] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [showAddCard, setShowAddCard] = useState(false);
  const [selectedTier, setSelectedTier] = useState(location.state?.selectedTier || null);
  const [selectedCycle, setSelectedCycle] = useState(location.state?.billingCycle || 1);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  useEffect(() => {
    fetchBillingData();
  }, []);

  const fetchBillingData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const [trialRes, paymentRes] = await Promise.all([
        axios.get(`${API_URL}/billing/trial`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/billing/payment-methods`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      setTrialStatus(trialRes.data);
      setPaymentMethods(paymentRes.data);

      try {
        const subRes = await axios.get(`${API_URL}/billing/subscription`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSubscription(subRes.data);
      } catch (err) {
        console.log('No active subscription');
      }
    } catch (error) {
      console.error('Failed to fetch billing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCard = async (e) => {
    e.preventDefault();
    alert('Stripe payment method integration would go here. This requires Stripe.js and Elements.');
  };

  const handleDeleteCard = async (paymentMethodId) => {
    if (!confirm('Are you sure you want to delete this payment method?')) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/billing/payment-methods/${paymentMethodId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchBillingData();
    } catch (error) {
      alert('Failed to delete payment method');
    }
  };

  const handleSubscribe = async () => {
    if (!selectedTier) {
      alert('Please select a plan');
      return;
    }

    const defaultPaymentMethod = paymentMethods.find(pm => pm.is_default);
    if (!defaultPaymentMethod) {
      alert('Please add a payment method first');
      setShowAddCard(true);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('tier', selectedTier);
      formData.append('billing_cycle_months', selectedCycle);
      formData.append('payment_method_id', defaultPaymentMethod.id);

      const response = await axios.post(`${API_URL}/billing/subscribe`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      alert(`Subscription created! Total: AED ${response.data.total_amount}`);
      fetchBillingData();
      setSelectedTier(null);
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to create subscription');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading billing information...</div>
      </div>
    );
  }

  const trialDaysRemaining = trialStatus?.trial_days_remaining || 0;
  const trialInvoicesRemaining = trialStatus?.trial_invoices_remaining || 0;
  const trialProgress = trialStatus?.trial_invoice_count 
    ? Math.min(100, (trialStatus.trial_invoice_count / 100) * 100)
    : 0;

  const pricingTiers = {
    BASIC: { monthly: 99, name: 'Basic' },
    PRO: { monthly: 299, name: 'Pro' },
    ENTERPRISE: { monthly: 799, name: 'Enterprise' }
  };

  const calculatePrice = (tier) => {
    const monthlyPrice = pricingTiers[tier]?.monthly || 0;
    const discounts = {
      1: 0,
      3: tier === 'ENTERPRISE' ? 10 : 5,
      6: tier === 'ENTERPRISE' ? 15 : 10
    };
    const discount = discounts[selectedCycle] || 0;
    const subtotal = monthlyPrice * selectedCycle;
    return Math.round(subtotal - (subtotal * discount / 100));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/dashboard')}>
              <TrendingUp className="h-8 w-8 text-blue-600" />
              <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                InvoLinks
              </span>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Billing & Subscription</h1>
          <p className="text-gray-600 mt-2">Manage your subscription, payment methods, and billing history</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          {trialStatus?.trial_status === 'ACTIVE' && (
            <div className="lg:col-span-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-6 text-white">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                    <Award className="h-6 w-6" />
                    Free Trial Active
                  </h3>
                  <p className="text-blue-100">
                    You have {trialDaysRemaining} days and {trialInvoicesRemaining} invoices remaining
                  </p>
                </div>
                <button
                  onClick={() => navigate('/pricing')}
                  className="bg-white text-blue-600 px-4 py-2 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  Upgrade Now
                </button>
              </div>
              
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Invoices Used</span>
                    <span>{trialStatus.trial_invoice_count} / 100</span>
                  </div>
                  <div className="bg-white/20 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-white h-full rounded-full transition-all"
                      style={{ width: `${trialProgress}%` }}
                    />
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Days Remaining</span>
                    <span>{trialDaysRemaining} / 30 days</span>
                  </div>
                  <div className="bg-white/20 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-white h-full rounded-full transition-all"
                      style={{ width: `${(trialDaysRemaining / 30) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {trialStatus?.trial_status === 'EXPIRED' && !subscription && (
            <div className="lg:col-span-3 bg-red-50 border border-red-200 rounded-xl p-6">
              <div className="flex items-start gap-4">
                <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-red-900 mb-2">Trial Expired</h3>
                  <p className="text-red-700 mb-4">
                    Your free trial has ended. Subscribe to continue creating invoices.
                  </p>
                  <button
                    onClick={() => navigate('/pricing')}
                    className="bg-red-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-red-700 transition-colors"
                  >
                    View Plans & Subscribe
                  </button>
                </div>
              </div>
            </div>
          )}

          {subscription && (
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">Current Plan</h3>
                  <p className="text-gray-600">Active subscription details</p>
                </div>
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              
              <div className="space-y-4">
                <div>
                  <div className="text-3xl font-bold text-gray-900 mb-1">
                    {subscription.tier}
                  </div>
                  <div className="text-sm text-gray-600">
                    AED {subscription.monthly_price}/month • Billed every {subscription.billing_cycle_months} month(s)
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-gray-600 mb-1">Current Period</div>
                      <div className="font-medium">
                        {new Date(subscription.current_period_start).toLocaleDateString()} - 
                        {new Date(subscription.current_period_end).toLocaleDateString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-600 mb-1">Status</div>
                      <div className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                        <CheckCircle className="h-3 w-3" />
                        {subscription.status}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t">
                  <button className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium">
                    Change Plan
                  </button>
                  <button className="flex-1 px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 text-sm font-medium">
                    Cancel Subscription
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Payment Methods</h3>
            
            {paymentMethods.length === 0 ? (
              <div className="text-center py-6">
                <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 mb-4">No payment methods added</p>
                <button
                  onClick={() => setShowAddCard(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
                >
                  Add Payment Method
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {paymentMethods.map((pm) => (
                  <div
                    key={pm.id}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <CreditCard className="h-5 w-5 text-gray-400" />
                      <div>
                        <div className="font-medium text-sm">
                          {pm.card_brand.toUpperCase()} •••• {pm.card_last4}
                        </div>
                        <div className="text-xs text-gray-600">
                          Expires {pm.exp_month}/{pm.exp_year}
                        </div>
                      </div>
                      {pm.is_default && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                          Default
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteCard(pm.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                
                <button
                  onClick={() => setShowAddCard(true)}
                  className="w-full py-2 border border-dashed border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 text-sm font-medium flex items-center justify-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add New Card
                </button>
              </div>
            )}
          </div>
        </div>

        {!subscription && selectedTier && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Complete Your Subscription</h3>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Selected Plan
                  </label>
                  <div className="text-2xl font-bold text-gray-900">
                    {pricingTiers[selectedTier]?.name}
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Billing Cycle
                  </label>
                  <select
                    value={selectedCycle}
                    onChange={(e) => setSelectedCycle(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={1}>Monthly</option>
                    <option value={3}>3 Months (Save 5-10%)</option>
                    <option value={6}>6 Months (Save 10-15%)</option>
                  </select>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm font-medium text-gray-700 mb-3">Order Summary</div>
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal ({selectedCycle} month{selectedCycle > 1 ? 's' : ''})</span>
                    <span className="font-medium">AED {pricingTiers[selectedTier]?.monthly * selectedCycle}</span>
                  </div>
                  {selectedCycle > 1 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Discount</span>
                      <span>-AED {(pricingTiers[selectedTier]?.monthly * selectedCycle) - calculatePrice(selectedTier)}</span>
                    </div>
                  )}
                  <div className="border-t pt-2 flex justify-between font-bold">
                    <span>Total</span>
                    <span className="text-blue-600">AED {calculatePrice(selectedTier)}</span>
                  </div>
                </div>

                <button
                  onClick={handleSubscribe}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 flex items-center justify-center gap-2"
                >
                  Subscribe Now
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {!subscription && !selectedTier && trialStatus?.trial_status !== 'ACTIVE' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
            <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">Ready to get started?</h3>
            <p className="text-gray-600 mb-6">Choose a plan that fits your business needs</p>
            <button
              onClick={() => navigate('/pricing')}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700"
            >
              View Pricing Plans
            </button>
          </div>
        )}
      </div>

      {showAddCard && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Add Payment Method</h3>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-blue-900">
                <strong>Note:</strong> This demo requires Stripe.js integration with Elements for secure card collection.
                In production, Stripe Elements would be loaded here.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowAddCard(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCard}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Add Card (Demo)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
