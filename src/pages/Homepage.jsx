import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import axios from 'axios';

export default function Homepage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    company_name: '',
    business_type: '',
    phone: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await axios.post('/register/quick', {
        email: formData.email,
        company_name: formData.company_name,
        business_type: formData.business_type,
        phone: formData.phone,
        password: formData.password,
      });

      if (response.data.success) {
        alert('Registration successful! Awaiting admin approval.');
        setFormData({ email: '', company_name: '', business_type: '', phone: '', password: '' });
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <nav className="backdrop-blur-md bg-white/80 border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2 text-xl font-bold">
            <span className="text-2xl">⚡</span>
            <span>Beam</span>
          </div>
          <Button variant="ghost" onClick={() => navigate('/login')}>
            Sign In
          </Button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-12 space-y-16">
        <div className="text-center space-y-4 mb-12">
          <h1 className="text-5xl md:text-6xl font-bold leading-tight">
            Simple, Compliant<br />Digital Invoicing for UAE
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Automated invoicing in structured electronic formats.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {[
            { icon: '🚀', title: 'Boost Digitalisation', desc: 'Fully paperless invoicing ecosystem' },
            { icon: '⚡', title: 'Operational Efficiency', desc: 'Streamlined workflows & automation' },
            { icon: '🌱', title: 'Eliminate Printed Invoices', desc: 'Sustainable digital-first approach' },
            { icon: '✓', title: 'Tax and Audit Compliance', desc: 'Full regulatory compliance built-in' },
            { icon: '🔍', title: 'Enhanced Transparency', desc: 'Real-time visibility & traceability' },
            { icon: '💳', title: 'Multi-Payment', desc: 'Integrate and accept all payment methods' },
          ].map((feature, i) => (
            <Card key={i} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6 text-center space-y-2">
                <div className="text-4xl">{feature.icon}</div>
                <h3 className="font-semibold">{feature.title}</h3>
                <p className="text-sm text-gray-600">{feature.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="max-w-md mx-auto">
          <CardContent className="p-8 space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-semibold mb-2">Get Started</h2>
              <p className="text-sm text-gray-600">Create your free account</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email*</label>
                <Input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Company Name*</label>
                <Input
                  type="text"
                  required
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Business Type</label>
                <Input
                  type="text"
                  placeholder="e.g., Retail, IT Services"
                  value={formData.business_type}
                  onChange={(e) => setFormData({ ...formData, business_type: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Phone</label>
                <Input
                  type="tel"
                  placeholder="+971..."
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Password*</label>
                <Input
                  type="password"
                  required
                  minLength={8}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Creating Account...' : 'Create Account →'}
              </Button>
            </form>

            <p className="text-center text-sm text-gray-600">
              Already have an account?{' '}
              <button
                type="button"
                className="text-blue-600 hover:underline"
                onClick={() => navigate('/login')}
              >
                Sign in
              </button>
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
