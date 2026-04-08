import React, { useState } from 'react';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { CreditCard, Loader } from 'lucide-react';

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      fontSize: '16px',
      color: '#32325d',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      '::placeholder': {
        color: '#aab7c4',
      },
      padding: '12px',
    },
    invalid: {
      color: '#fa755a',
      iconColor: '#fa755a',
    },
  },
  hidePostalCode: false,
};

export default function StripeCardForm({ onSuccess, onCancel, submitLabel = 'Add Card' }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [billingName, setBillingName] = useState('');
  const [billingEmail, setBillingEmail] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    if (!billingName.trim()) {
      setError('Cardholder name is required');
      return;
    }
    if (!billingEmail.trim()) {
      setError('Billing email is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const cardElement = elements.getElement(CardElement);
      
      const { error: stripeError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
        billing_details: {
          name: billingName.trim(),
          email: billingEmail.trim(),
        },
      });

      if (stripeError) {
        setError(stripeError.message);
        setLoading(false);
        return;
      }

      await onSuccess({
        paymentMethodId: paymentMethod.id,
        billingName: billingName.trim(),
        billingEmail: billingEmail.trim(),
      });
      
    } catch (err) {
      setError(err.message || 'Failed to add payment method');
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Cardholder Name
        </label>
        <input
          type="text"
          value={billingName}
          onChange={(e) => setBillingName(e.target.value)}
          placeholder="John Smith"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Billing Email
        </label>
        <input
          type="email"
          value={billingEmail}
          onChange={(e) => setBillingEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <CreditCard className="inline w-4 h-4 mr-1" />
          Card Information
        </label>
        <div className="border border-gray-300 rounded-lg p-3 bg-white">
          <CardElement options={CARD_ELEMENT_OPTIONS} />
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!stripe || loading}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader className="w-4 h-4 animate-spin" />
              Processing...
            </>
          ) : (
            submitLabel
          )}
        </button>
      </div>
    </form>
  );
}
