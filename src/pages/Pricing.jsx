import React, { useState } from 'react';
import { Check, X, CreditCard, Calendar, TrendingUp, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Pricing() {
  const navigate = useNavigate();
  const [billingCycle, setBillingCycle] = useState(1);

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

  const handleSelectPlan = (tierId) => {
    if (tierId === 'trial') {
      navigate('/login');
    } else {
      navigate('/billing', { state: { selectedTier: tierId, billingCycle } });
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
            <button 
              onClick={() => navigate('/login')}
              className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Sign In
            </button>
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
                      {discount && (
                        <div className={`text-sm line-through mb-1 ${tier.highlighted ? 'text-blue-200' : 'text-gray-500'}`}>
                          AED {tier.monthlyPrice * billingCycle}
                        </div>
                      )}
                      <div className={`text-4xl font-bold ${tier.highlighted ? 'text-white' : 'text-gray-900'}`}>
                        AED {totalPrice}
                      </div>
                      <div className={`text-sm mt-1 ${tier.highlighted ? 'text-blue-100' : 'text-gray-600'}`}>
                        {billingCycle === 1 ? 'per month' : `for ${billingCycle} months`}
                        {billingCycle > 1 && ` (AED ${monthlyEquivalent}/mo)`}
                      </div>
                      {discount && (
                        <div className="mt-2 inline-block bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-medium">
                          {discount}% discount applied
                        </div>
                      )}
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
          <div className="grid md:grid-cols-4 gap-6 text-center">
            <div>
              <div className="text-sm text-gray-600 mb-2">Basic Plan</div>
              <div className="text-3xl font-bold text-blue-600">AED 2.00</div>
              <div className="text-xs text-gray-500 mt-1">per invoice</div>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-2">Pro Plan</div>
              <div className="text-3xl font-bold text-purple-600">AED 1.00</div>
              <div className="text-xs text-gray-500 mt-1">per invoice</div>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-2">Enterprise Plan</div>
              <div className="text-3xl font-bold text-green-600">AED 0.50</div>
              <div className="text-xs text-gray-500 mt-1">per invoice</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-sm font-medium text-blue-900 mb-2">What is PEPPOL?</div>
              <div className="text-xs text-gray-700">
                PEPPOL is a secure network for sending invoices directly to the UAE Federal Tax Authority.
                Pay only for what you use.
              </div>
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
    </div>
  );
}
