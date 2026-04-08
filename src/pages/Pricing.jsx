import React, { useState } from 'react';
import { Check, X, CreditCard, Calendar, TrendingUp, Shield, Loader, AlertCircle, CheckCircle, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import StripeCardForm from '../components/StripeCardForm';
import apiClient from '../lib/api';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

export default function Pricing() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [billingCycle, setBillingCycle] = useState(1);

  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [modalTier, setModalTier] = useState(null);
  const [modalCycle, setModalCycle] = useState(1);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loadingModal, setLoadingModal] = useState(false);
  const [showCardForm, setShowCardForm] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [subscribeError, setSubscribeError] = useState('');
  const [subscribeSuccess, setSubscribeSuccess] = useState(false);

  const tiers = [
    {
      name: 'Free Trial',
      id: 'trial',
      description: 'Test our platform before committing',
      price: 0,
      features: [
        '100 invoices or 30 days',
        'Full UAE e-Invoicing compliance',
        'UBL/PINT-AE XML generation',
        'Digital signatures & hash chains',
        'Basic analytics dashboard',
        'Email support'
      ],
      limitations: [
        'No PEPPOL transmission',
        'Limited team members (3)',
        'No custom branding'
      ],
      highlighted: false,
      cta: 'Start Free Trial',
      available: true
    },
    {
      name: 'Basic',
      id: 'BASIC',
      description: 'For small businesses and startups',
      monthlyPrice: 99,
      features: [
        'Unlimited invoices',
        'Full UAE e-Invoicing compliance',
        'UBL/PINT-AE XML generation',
        'Digital signatures & hash chains',
        'Up to 5 team members',
        'Basic branding (logo)',
        'FTA Audit File generation',
        'Priority email support',
        'PEPPOL transmission (pay-per-use)'
      ],
      limitations: [
        'Limited analytics',
        'No AP management'
      ],
      highlighted: false,
      cta: 'Get Started',
      available: true
    },
    {
      name: 'Pro',
      id: 'PRO',
      description: 'For growing businesses with complex needs',
      monthlyPrice: 299,
      features: [
        'Everything in Basic',
        'Unlimited team members',
        'Full custom branding',
        'Advanced analytics & reporting',
        'Accounts Payable management',
        'Purchase orders & 3-way matching',
        'Bulk invoice import (CSV/Excel)',
        'Custom invoice templates',
        'API access',
        'Priority phone & chat support'
      ],
      limitations: [],
      highlighted: true,
      cta: 'Go Pro',
      available: true
    },
    {
      name: 'Enterprise',
      id: 'ENTERPRISE',
      description: 'For large organizations with custom requirements',
      monthlyPrice: 799,
      features: [
        'Everything in Pro',
        'Dedicated account manager',
        'Custom integrations',
        'Advanced security & compliance',
        'Multi-company management',
        'Custom workflows',
        'White-label options',
        'SLA guarantee',
        '24/7 priority support',
        'Onboarding & training'
      ],
      limitations: [],
      highlighted: false,
      cta: 'Contact Sales',
      available: true
    }
  ];

  const calculatePrice = (monthlyPrice, cycle) => {
    if (!monthlyPrice) return 0;
    
    const discounts = {
      1: 0,
      3: monthlyPrice >= 799 ? 10 : 5,
      6: monthlyPrice >= 799 ? 15 : 10
    };
    
    const discount = discounts[cycle] || 0;
    const subtotal = monthlyPrice * cycle;
    const discountAmount = subtotal * (discount / 100);
    return Math.round(subtotal - discountAmount);
  };

  const getDiscount = (monthlyPrice, cycle) => {
    if (cycle === 1) return null;
    const discounts = {
      3: monthlyPrice >= 799 ? 10 : 5,
      6: monthlyPrice >= 799 ? 15 : 10
    };
    return discounts[cycle];
  };

  const handleSelectPlan = async (tierId) => {
    if (tierId === 'trial') {
      navigate(isAuthenticated ? '/dashboard' : '/login');
      return;
    }
    if (tierId === 'ENTERPRISE') {
      // Contact sales — no direct payment
      window.location.href = 'mailto:sales@involinks.com?subject=Enterprise Plan Enquiry';
      return;
    }
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    const tier = tiers.find(t => t.id === tierId);
    setModalTier(tier);
    setModalCycle(billingCycle);
    setSubscribeError('');
    setSubscribeSuccess(false);
    setShowCardForm(false);
    setShowPaymentModal(true);
    setLoadingModal(true);

    try {
      const res = await apiClient.get('/billing/payment-methods');
      setPaymentMethods(res.data || []);
      if (!res.data || res.data.length === 0) setShowCardForm(true);
    } catch {
      setPaymentMethods([]);
      setShowCardForm(true);
    } finally {
      setLoadingModal(false);
    }
  };

  const doSubscribe = async (paymentMethodId) => {
    setSubscribing(true);
    setSubscribeError('');
    try {
      const formData = new FormData();
      formData.append('tier', modalTier.id);
      formData.append('billing_cycle_months', modalCycle);
      formData.append('payment_method_id', paymentMethodId);
      await apiClient.post('/billing/subscribe', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSubscribeSuccess(true);
      setTimeout(() => {
        setShowPaymentModal(false);
        navigate('/billing');
      }, 1800);
    } catch (error) {
      setSubscribeError(error.response?.data?.detail || 'Failed to create subscription. Please try again.');
    } finally {
      setSubscribing(false);
    }
  };

  const handlePayWithExistingCard = async () => {
    const defaultCard = paymentMethods.find(pm => pm.is_default) || paymentMethods[0];
    if (!defaultCard) { setShowCardForm(true); return; }
    await doSubscribe(defaultCard.id);
  };

  const handleAddCardAndSubscribe = async ({ paymentMethodId, billingName, billingEmail }) => {
    const formData = new FormData();
    formData.append('payment_method_token', paymentMethodId);
    formData.append('billing_name', billingName);
    formData.append('billing_email', billingEmail);
    formData.append('set_as_default', 'true');
    try {
      const res = await apiClient.post('/billing/payment-methods', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await doSubscribe(res.data?.id || paymentMethodId);
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to add payment method');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <nav className="bg-white/80 backdrop-blur-md border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
              <TrendingUp className="h-8 w-8 text-blue-600" />
              <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                InvoLinks
              </span>
            </div>
            {isAuthenticated ? (
              <button
                onClick={() => navigate('/dashboard')}
                className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                Dashboard
              </button>
            ) : (
              <button
                onClick={() => navigate('/login')}
                className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Choose the perfect plan for your business. Start with a free trial, no credit card required.
          </p>
        </div>

        <div className="flex justify-center mb-12">
          <div className="bg-white rounded-full p-1 shadow-lg inline-flex gap-1">
            <button
              onClick={() => setBillingCycle(1)}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                billingCycle === 1
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle(3)}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                billingCycle === 3
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-2">
                3 Months
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                  Save 5-10%
                </span>
              </div>
            </button>
            <button
              onClick={() => setBillingCycle(6)}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                billingCycle === 6
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-2">
                6 Months
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                  Save 10-15%
                </span>
              </div>
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {tiers.map((tier) => {
            const totalPrice = calculatePrice(tier.monthlyPrice, billingCycle);
            const discount = getDiscount(tier.monthlyPrice, billingCycle);
            const monthlyEquivalent = tier.monthlyPrice ? Math.round(totalPrice / billingCycle) : 0;

            return (
              <div
                key={tier.id}
                className={`relative rounded-2xl p-8 transition-all ${
                  tier.highlighted
                    ? 'bg-gradient-to-br from-blue-600 to-purple-600 text-white shadow-2xl scale-105 border-4 border-blue-400'
                    : 'bg-white shadow-lg hover:shadow-xl border border-gray-200'
                }`}
              >
                {tier.highlighted && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-yellow-400 text-gray-900 px-4 py-1 rounded-full text-sm font-bold">
                    Most Popular
                  </div>
                )}

                <div className="mb-6">
                  <h3 className={`text-2xl font-bold mb-2 ${tier.highlighted ? 'text-white' : 'text-gray-900'}`}>
                    {tier.name}
                  </h3>
                  <p className={`text-sm ${tier.highlighted ? 'text-blue-100' : 'text-gray-600'}`}>
                    {tier.description}
                  </p>
                </div>

                <div className="mb-6">
                  {tier.id === 'trial' ? (
                    <div>
                      <div className={`text-4xl font-bold ${tier.highlighted ? 'text-white' : 'text-gray-900'}`}>
                        Free
                      </div>
                      <div className={`text-sm mt-1 ${tier.highlighted ? 'text-blue-100' : 'text-gray-600'}`}>
                        100 invoices or 30 days
                      </div>
                    </div>
                  ) : tier.id === 'ENTERPRISE' ? (
                    <div>
                      <div className={`text-4xl font-bold ${tier.highlighted ? 'text-white' : 'text-gray-900'}`}>
                        Custom
                      </div>
                      <div className={`text-sm mt-1 ${tier.highlighted ? 'text-blue-100' : 'text-gray-600'}`}>
                        Contact for pricing
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-2">
                        {discount && (
                          <div className={`text-sm line-through ${tier.highlighted ? 'text-blue-200' : 'text-gray-500'}`}>
                            AED {tier.monthlyPrice * billingCycle}
                          </div>
                        )}
                        {discount && (
                          <div className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-medium">
                            {discount}% off
                          </div>
                        )}
                      </div>
                      <div className={`text-4xl font-bold ${tier.highlighted ? 'text-white' : 'text-gray-900'}`}>
                        AED {totalPrice}
                      </div>
                      <div className={`text-sm mt-1 ${tier.highlighted ? 'text-blue-100' : 'text-gray-600'}`}>
                        {billingCycle === 1 ? 'per month' : `for ${billingCycle} months`}
                        {billingCycle > 1 && ` (AED ${monthlyEquivalent}/mo)`}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handleSelectPlan(tier.id)}
                  className={`w-full py-3 rounded-lg font-medium transition-all mb-6 ${
                    tier.highlighted
                      ? 'bg-white text-blue-600 hover:bg-gray-50 shadow-lg'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {tier.cta}
                </button>

                <div className="space-y-3">
                  {tier.features.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <Check className={`h-5 w-5 flex-shrink-0 ${tier.highlighted ? 'text-green-300' : 'text-green-600'}`} />
                      <span className={`text-sm ${tier.highlighted ? 'text-blue-50' : 'text-gray-700'}`}>
                        {feature}
                      </span>
                    </div>
                  ))}
                  
                  {tier.limitations.map((limitation, idx) => (
                    <div key={idx} className="flex items-start gap-2 opacity-70">
                      <X className={`h-5 w-5 flex-shrink-0 ${tier.highlighted ? 'text-red-300' : 'text-gray-400'}`} />
                      <span className={`text-sm ${tier.highlighted ? 'text-blue-100' : 'text-gray-500'}`}>
                        {limitation}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-16 bg-white rounded-2xl shadow-lg p-8">
          <h2 className="text-2xl font-bold mb-6 text-center">PEPPOL Usage Fees</h2>
          <p className="text-center text-gray-600 mb-6">Pay-as-you-go pricing for PEPPOL network transmission</p>
          
          <div className="grid md:grid-cols-4 gap-6">
            <div className="text-center p-4 border-2 border-gray-200 rounded-xl">
              <div className="text-sm text-gray-600 mb-2 font-medium">Free Trial</div>
              <div className="text-2xl font-bold text-gray-400 mb-1">—</div>
              <div className="text-xs text-gray-500">No PEPPOL access</div>
            </div>
            <div className="text-center p-4 border-2 border-blue-200 rounded-xl bg-blue-50">
              <div className="text-sm text-gray-700 mb-2 font-medium">Basic Plan</div>
              <div className="text-3xl font-bold text-blue-600 mb-1">AED 2.00</div>
              <div className="text-xs text-gray-600">per invoice</div>
            </div>
            <div className="text-center p-4 border-2 border-purple-200 rounded-xl bg-purple-50">
              <div className="text-sm text-gray-700 mb-2 font-medium">Pro Plan</div>
              <div className="text-3xl font-bold text-purple-600 mb-1">AED 1.00</div>
              <div className="text-xs text-gray-600">per invoice</div>
            </div>
            <div className="text-center p-4 border-2 border-green-200 rounded-xl bg-green-50">
              <div className="text-sm text-gray-700 mb-2 font-medium">Enterprise Plan</div>
              <div className="text-3xl font-bold text-green-600 mb-1">AED 0.50</div>
              <div className="text-xs text-gray-600">per invoice</div>
            </div>
          </div>

          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-6">
            <div className="text-sm font-semibold text-blue-900 mb-2">What is PEPPOL?</div>
            <div className="text-sm text-gray-700">
              PEPPOL is a secure network for sending invoices directly to the UAE Federal Tax Authority. 
              Pay only for what you use.
            </div>
          </div>
        </div>

        <div className="mt-12 text-center">
          <p className="text-gray-600 mb-4">
            All plans include UAE VAT (5%). Need help choosing?
          </p>
          <button className="text-blue-600 hover:text-blue-700 font-medium">
            Contact our sales team →
          </button>
        </div>
      </div>

      {/* ── Payment Modal ── */}
      {showPaymentModal && modalTier && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 text-white">
              <h2 className="text-xl font-bold">Subscribe to {modalTier.name}</h2>
              <p className="text-blue-100 text-sm mt-1">Complete your payment to get started</p>
            </div>

            <div className="p-6">
              {subscribeSuccess ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Subscription Activated!</h3>
                  <p className="text-gray-600">Redirecting to your billing dashboard…</p>
                </div>
              ) : (
                <>
                  {/* Order Summary */}
                  <div className="bg-gray-50 rounded-xl p-4 mb-5">
                    <div className="text-sm font-semibold text-gray-700 mb-3">Order Summary</div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-600 text-sm">{modalTier.name} Plan</span>
                      <span className="font-medium text-sm">AED {modalTier.monthlyPrice}/mo</span>
                    </div>

                    {/* Billing cycle selector */}
                    <div className="mt-3">
                      <label className="text-xs text-gray-500 uppercase tracking-wide font-medium">Billing Cycle</label>
                      <div className="mt-1 flex gap-2">
                        {[
                          { value: 1, label: 'Monthly' },
                          { value: 3, label: '3 Months', badge: `Save ${modalTier.monthlyPrice >= 799 ? 10 : 5}%` },
                          { value: 6, label: '6 Months', badge: `Save ${modalTier.monthlyPrice >= 799 ? 15 : 10}%` },
                        ].map(({ value, label, badge }) => (
                          <button
                            key={value}
                            onClick={() => setModalCycle(value)}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                              modalCycle === value
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'text-gray-600 border-gray-300 hover:border-blue-400'
                            }`}
                          >
                            {label}
                            {badge && <span className="block text-[10px] opacity-80">{badge}</span>}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="border-t border-gray-200 mt-3 pt-3 flex justify-between font-bold text-base">
                      <span>Total</span>
                      <span className="text-blue-600">
                        AED {calculatePrice(modalTier.monthlyPrice, modalCycle)}
                        <span className="text-xs font-normal text-gray-500 ml-1">
                          {modalCycle > 1 ? `for ${modalCycle} months` : '/month'}
                        </span>
                      </span>
                    </div>
                  </div>

                  {loadingModal ? (
                    <div className="flex justify-center py-8">
                      <Loader className="h-8 w-8 animate-spin text-blue-600" />
                    </div>
                  ) : (
                    <>
                      {/* Existing cards */}
                      {!showCardForm && paymentMethods.length > 0 && (
                        <div className="space-y-3 mb-4">
                          <div className="text-sm font-medium text-gray-700">Pay with saved card</div>
                          {paymentMethods.map(pm => (
                            <div key={pm.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg bg-gray-50">
                              <CreditCard className="h-5 w-5 text-gray-400" />
                              <div className="flex-1">
                                <div className="font-medium text-sm">{pm.card_brand?.toUpperCase()} •••• {pm.card_last4}</div>
                                <div className="text-xs text-gray-500">Expires {pm.exp_month}/{pm.exp_year}</div>
                              </div>
                              {pm.is_default && (
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Default</span>
                              )}
                            </div>
                          ))}

                          {subscribeError && (
                            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                              {subscribeError}
                            </div>
                          )}

                          <button
                            onClick={handlePayWithExistingCard}
                            disabled={subscribing}
                            className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                          >
                            {subscribing ? (
                              <><Loader className="h-4 w-4 animate-spin" /> Processing…</>
                            ) : (
                              <>Pay AED {calculatePrice(modalTier.monthlyPrice, modalCycle)} <ArrowRight className="h-4 w-4" /></>
                            )}
                          </button>

                          <button
                            onClick={() => setShowCardForm(true)}
                            className="w-full py-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                          >
                            + Use a different card
                          </button>
                        </div>
                      )}

                      {/* Stripe card form */}
                      {showCardForm && (
                        <div>
                          <div className="text-sm font-medium text-gray-700 mb-3">
                            {paymentMethods.length > 0 ? 'Enter new card details' : 'Enter your card details'}
                          </div>
                          {subscribeError && (
                            <div className="flex items-start gap-2 p-3 mb-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                              {subscribeError}
                            </div>
                          )}
                          <Elements stripe={stripePromise}>
                            <StripeCardForm
                              onSuccess={handleAddCardAndSubscribe}
                              onCancel={() => {
                                if (paymentMethods.length > 0) setShowCardForm(false);
                                else setShowPaymentModal(false);
                              }}
                              submitLabel={`Pay AED ${calculatePrice(modalTier.monthlyPrice, modalCycle)}`}
                            />
                          </Elements>
                        </div>
                      )}
                    </>
                  )}

                  {/* Close link */}
                  {!subscribing && !subscribeSuccess && (
                    <button
                      onClick={() => setShowPaymentModal(false)}
                      className="w-full mt-3 py-2 text-sm text-gray-500 hover:text-gray-700"
                    >
                      Cancel
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
