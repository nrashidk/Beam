import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { PhoneInput, EmailInput, PasswordInput } from '../components/ui/validated-input';
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
          <Card className="hover:shadow-lg transition-shadow bg-white">
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-indigo-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900">Government-Approved Invoices</h3>
              <p className="text-sm text-gray-600">Create professional invoices that meet all UAE government requirements. Every invoice is automatically secured and properly formatted.</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow bg-white">
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-indigo-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900">Manage Your Purchases</h3>
              <p className="text-sm text-gray-600">Create purchase orders, receive supplier invoices, and keep track of all your expenses in one organized place.</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow bg-white">
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-indigo-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900">Extra Security</h3>
              <p className="text-sm text-gray-600">Extra protection for your account. Use your phone or email to confirm it's really you when logging in.</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow bg-white">
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-indigo-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900">Team Collaboration</h3>
              <p className="text-sm text-gray-600">Work together with your team. Add unlimited members and control who can view or edit invoices.</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow bg-white">
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-indigo-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900">Electronic Delivery</h3>
              <p className="text-sm text-gray-600">Send invoices electronically to your customers through trusted partners, making delivery fast and secure.</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow bg-white">
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-indigo-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900">Flexible Subscriptions</h3>
              <p className="text-sm text-gray-600">Start free with 10 invoices per month. Upgrade anytime as your business grows to send unlimited invoices.</p>
            </CardContent>
          </Card>
        </div>

        {/* Trusted by Leading Brands */}
        <div className="space-y-8">
          <h2 className="text-2xl font-semibold text-center text-gray-900">Trusted by Leading Brands</h2>
          <div className="overflow-hidden relative">
            <div className="flex gap-12 animate-scroll">
              <div className="flex items-center justify-center min-w-[200px] h-20 grayscale hover:grayscale-0 transition-all">
                <span className="text-3xl font-bold text-gray-400">LuLu</span>
              </div>
              <div className="flex items-center justify-center min-w-[200px] h-20 grayscale hover:grayscale-0 transition-all">
                <span className="text-3xl font-bold text-gray-400">Styli</span>
              </div>
              <div className="flex items-center justify-center min-w-[200px] h-20 grayscale hover:grayscale-0 transition-all">
                <span className="text-2xl font-bold text-gray-400">GIORGIO ARMANI</span>
              </div>
              <div className="flex items-center justify-center min-w-[200px] h-20 grayscale hover:grayscale-0 transition-all">
                <span className="text-2xl font-bold text-gray-400">DUNCAN & ROSS</span>
              </div>
              <div className="flex items-center justify-center min-w-[200px] h-20 grayscale hover:grayscale-0 transition-all">
                <span className="text-3xl font-bold text-gray-400">LuLu</span>
              </div>
              <div className="flex items-center justify-center min-w-[200px] h-20 grayscale hover:grayscale-0 transition-all">
                <span className="text-3xl font-bold text-gray-400">Styli</span>
              </div>
            </div>
          </div>
        </div>

        {/* Statistics Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-200">
            <div className="text-4xl font-bold text-gray-900 mb-2">1Bn+</div>
            <p className="text-sm text-gray-700">e-Invoices generated annually on InvoLinks platform</p>
          </div>
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-200">
            <div className="text-4xl font-bold text-gray-900 mb-2">99.8%</div>
            <p className="text-sm text-gray-700">Success rate in e-invoice generation</p>
          </div>
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-200">
            <div className="text-4xl font-bold text-gray-900 mb-2">$5Bn+</div>
            <p className="text-sm text-gray-700">Worth Invoices processed</p>
          </div>
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-200">
            <div className="text-4xl font-bold text-gray-900 mb-2">10%+</div>
            <p className="text-sm text-gray-700">Market share in GCC countries</p>
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
                      <PhoneInput
                        required
                        name="phone"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Work Email <span className="text-red-500">*</span>
                      </label>
                      <EmailInput
                        required
                        name="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Password <span className="text-red-500">*</span>
                      </label>
                      <PasswordInput
                        required
                        name="password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      />
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
