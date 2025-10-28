import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import api from '../lib/api';

export default function Homepage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    company_name: '',
    phone: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [publicStats, setPublicStats] = useState({ totalInvoices: 0, totalCompanies: 0 });

  useEffect(() => {
    if (user) {
      fetchUserInfo();
    }
    fetchPublicStats();
  }, [user]);

  const fetchUserInfo = async () => {
    try {
      const response = await api.get('/me');
      setUserInfo(response.data);
    } catch (error) {
      console.error('Failed to fetch user info:', error);
    }
  };

  const fetchPublicStats = async () => {
    try {
      const response = await api.get('/public/stats');
      setPublicStats(response.data);
    } catch (error) {
      console.error('Failed to fetch public stats:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await api.post('/register/quick', {
        email: formData.email,
        company_name: formData.company_name,
        business_type: 'LLC',
        phone: formData.phone,
        password: formData.password,
      });

      if (response.data.success) {
        setSuccess(true);
        setFormData({ email: '', company_name: '', phone: '', password: '' });
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
            <span className="text-2xl">🔗</span>
            <span>InvoLinks</span>
          </div>
          {user ? (
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">{user.email}</span>
              <Button variant="outline" size="sm" onClick={logout}>
                Logout
              </Button>
            </div>
          ) : (
            <Button variant="ghost" onClick={() => navigate('/login')}>
              Sign In
            </Button>
          )}
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-12 space-y-16">
        <div className="text-center space-y-4">
          <h1 className="text-5xl md:text-6xl font-bold leading-tight">
            Simple, Compliant<br />Digital Invoicing for UAE
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Automated invoicing in structured electronic formats.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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

        <div className="text-center py-4">
          <div className="text-2xl font-bold text-gray-900">
            {(publicStats?.totalInvoices || 0).toLocaleString()} <span className="font-normal text-gray-600">invoices generated today</span>
          </div>
        </div>

        <Card className="max-w-6xl mx-auto">
          <CardContent className="p-8 space-y-6">
            {success ? (
              <div className="text-center space-y-4 max-w-md mx-auto">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-2xl font-semibold text-gray-900">Registration Successful!</h2>
                <div className="space-y-2">
                  <p className="text-gray-700">Awaiting Admin approval.</p>
                  <p className="text-sm text-gray-600">A confirmation email will be sent upon approval.</p>
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => setSuccess(false)}
                  className="mt-4"
                >
                  Register Another Account
                </Button>
              </div>
            ) : (
              <>
                <div className="text-center">
                  <h2 className="text-2xl font-semibold mb-2">Get Started</h2>
                  <p className="text-sm text-gray-600">Create your free account</p>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl mx-auto">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Work Email <span className="text-red-500">*</span>
                      </label>
                      <Input
                        type="email"
                        required
                        placeholder="you@company.com"
                        pattern="[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}"
                        title="Please enter a valid email address"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                      <small className="text-xs text-gray-500">Valid email format required</small>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Legal Name <span className="text-red-500">*</span>
                      </label>
                      <Input
                        type="text"
                        required
                        placeholder="Your Company LLC"
                        minLength={3}
                        value={formData.company_name}
                        onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Phone Number <span className="text-red-500">*</span>
                      </label>
                      <Input
                        type="text"
                        required
                        placeholder="1234567890"
                        pattern="[0-9]{10}"
                        maxLength={10}
                        title="Please enter exactly 10 digits"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/[^0-9]/g, '') })}
                      />
                      <small className="text-xs text-gray-500">10 digits only (e.g., 0501234567)</small>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Password <span className="text-red-500">*</span>
                      </label>
                      <Input
                        type="password"
                        required
                        placeholder="Enter strong password"
                        minLength={8}
                        pattern="^(?=.*[a-z])(?=.*[A-Z])(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$"
                        title="Password must contain at least 8 characters, including uppercase, lowercase, and special character"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      />
                      <small className="text-xs text-gray-500">Min 8 chars: Uppercase, lowercase & special char</small>
                    </div>
                  </div>

                  <div className="flex justify-center pt-2">
                    <Button type="submit" className="w-full max-w-xs" disabled={loading}>
                      {loading ? 'Creating Account...' : 'Create Account →'}
                    </Button>
                  </div>
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
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
