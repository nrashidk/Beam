import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useContent } from '../contexts/ContentContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { PhoneInput, EmailInput, PasswordInput } from '../components/ui/validated-input';
import Footer from '../components/Footer';
import api from '../lib/api';

export default function Homepage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  
  // Dynamic content
  const heroTitle = useContent('homepage_hero_title', 'Simple, Compliant\nDigital Invoicing for UAE');
  const heroSubtitle = useContent('homepage_hero_subtitle', 'Automated invoicing in structured electronic formats.');
  const box1Title = useContent('feature_box_1_title', 'Government-Approved Invoices');
  const box1Desc = useContent('feature_box_1_description', 'Create professional invoices that meet all UAE government requirements.');
  const box2Title = useContent('feature_box_2_title', 'Manage Your Purchases');
  const box2Desc = useContent('feature_box_2_description', 'Create purchase orders, receive supplier invoices, and keep track of all your expenses.');
  const box3Title = useContent('feature_box_3_title', 'Extra Security');
  const box3Desc = useContent('feature_box_3_description', 'Extra protection for your account.');
  const box4Title = useContent('feature_box_4_title', 'Team Collaboration');
  const box4Desc = useContent('feature_box_4_description', 'Work together with your team.');
  const box5Title = useContent('feature_box_5_title', 'Electronic Delivery');
  const box5Desc = useContent('feature_box_5_description', 'Send invoices electronically to your customers.');
  const box6Title = useContent('feature_box_6_title', 'Flexible Subscriptions');
  const box6Desc = useContent('feature_box_6_description', 'Start free with 10 invoices per month.');
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
          <h1 className="text-5xl md:text-6xl font-bold leading-tight whitespace-pre-line">
            {heroTitle}
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            {heroSubtitle}
          </p>
        </div>

        {/* Who We Are Section */}
        <div className="bg-gradient-to-br from-indigo-50 to-white rounded-3xl p-12 space-y-6 border border-indigo-100">
          <div className="text-center space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Who We Are</h2>
            <div className="w-24 h-1 bg-indigo-600 mx-auto rounded-full"></div>
          </div>

          <div className="max-w-4xl mx-auto space-y-6 text-gray-700 leading-relaxed">
            <p className="text-lg">
              <span className="font-semibold text-indigo-600">InvoLinks</span> is a modern, UAE-based technology company specializing in digital invoicing and financial management solutions. We are dedicated to helping businesses across the United Arab Emirates navigate the complexities of digital transformation in their financial operations.
            </p>

            <p>
              Founded with a vision to simplify compliance and streamline financial workflows, InvoLinks has emerged as a trusted partner for businesses seeking to modernize their invoicing and accounts payable processes while maintaining full compliance with UAE Federal Tax Authority (FTA) regulations.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
              <div className="text-center space-y-3 p-6 bg-white rounded-xl shadow-sm">
                <div className="text-3xl">🎯</div>
                <h3 className="font-semibold text-gray-900">Our Mission</h3>
                <p className="text-sm text-gray-600">
                  Empower UAE businesses with simple, compliant digital invoicing solutions that eliminate complexity and reduce manual effort.
                </p>
              </div>

              <div className="text-center space-y-3 p-6 bg-white rounded-xl shadow-sm">
                <div className="text-3xl">🚀</div>
                <h3 className="font-semibold text-gray-900">Our Vision</h3>
                <p className="text-sm text-gray-600">
                  Become the leading digital invoicing platform in the UAE and GCC region, setting the standard for innovation and compliance.
                </p>
              </div>

              <div className="text-center space-y-3 p-6 bg-white rounded-xl shadow-sm">
                <div className="text-3xl">💎</div>
                <h3 className="font-semibold text-gray-900">Our Values</h3>
                <p className="text-sm text-gray-600">
                  Simplicity, compliance-first approach, continuous innovation, customer success, transparency, and security.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="hover:shadow-lg transition-shadow bg-white">
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-indigo-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900">{box1Title}</h3>
              <p className="text-sm text-gray-600">{box1Desc}</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow bg-white">
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-indigo-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900">{box2Title}</h3>
              <p className="text-sm text-gray-600">{box2Desc}</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow bg-white">
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-indigo-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900">{box3Title}</h3>
              <p className="text-sm text-gray-600">{box3Desc}</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow bg-white">
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-indigo-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900">{box4Title}</h3>
              <p className="text-sm text-gray-600">{box4Desc}</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow bg-white">
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-indigo-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900">{box5Title}</h3>
              <p className="text-sm text-gray-600">{box5Desc}</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow bg-white">
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-indigo-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900">{box6Title}</h3>
              <p className="text-sm text-gray-600">{box6Desc}</p>
            </CardContent>
          </Card>
        </div>

        {/* What We Do Section */}
        <div className="space-y-8">
          <div className="text-center space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">What We Do</h2>
            <div className="w-24 h-1 bg-indigo-600 mx-auto rounded-full"></div>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              InvoLinks is a comprehensive, FTA-compliant digital invoicing and accounts payable platform designed specifically for UAE businesses. We provide end-to-end solutions that make compliance simple.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-l-4 border-l-indigo-600">
              <CardContent className="p-8 space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Digital E-Invoicing</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      Create fully compliant e-invoices with UBL 2.1 XML generation, automatic VAT calculation, TRN validation, and support for multiple invoice types including Tax Invoice, Credit Note, and Commercial Invoice.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-purple-600">
              <CardContent className="p-8 space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">PEPPOL Network Integration</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      Connect to the global PEPPOL network through accredited providers. Send invoices directly to customer accounting systems with real-time delivery confirmation and automated receipt.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-blue-600">
              <CardContent className="p-8 space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Accounts Payable (AP) Management</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      Complete purchase-to-pay workflow with PO creation, goods receipt notes, automated 3-way matching, variance detection, and comprehensive vendor management with spend analytics.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-green-600">
              <CardContent className="p-8 space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Security & Compliance</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      Enterprise-grade security with RSA-2048 digital signatures, SHA-256 hash chains, multi-factor authentication, immutable audit trails, and full compliance with FTA Phase 2 requirements.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="bg-indigo-600 text-white rounded-2xl p-8 text-center">
            <h3 className="text-2xl font-bold mb-4">Built Specifically for UAE Businesses</h3>
            <p className="text-indigo-100 max-w-3xl mx-auto mb-6">
              Unlike generic international platforms, InvoLinks is purpose-built for the UAE market with FTA Phase 2 compliance, UAE VAT rules, TRN validation, and local support that understands your business needs.
            </p>
            <div className="flex flex-wrap justify-center gap-4 text-sm">
              <Badge className="bg-white text-indigo-600 hover:bg-indigo-50">FTA Phase 2 Ready</Badge>
              <Badge className="bg-white text-indigo-600 hover:bg-indigo-50">UAE VAT Compliant</Badge>
              <Badge className="bg-white text-indigo-600 hover:bg-indigo-50">PEPPOL Certified</Badge>
              <Badge className="bg-white text-indigo-600 hover:bg-indigo-50">Multi-Currency Support</Badge>
              <Badge className="bg-white text-indigo-600 hover:bg-indigo-50">Local Support Team</Badge>
            </div>
          </div>
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

        {/* Statistics Section - Real Aggregated Platform Data */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-200">
            <div className="text-4xl font-bold text-indigo-600 mb-2">
              {publicStats.totalCompanies > 0 ? publicStats.totalCompanies.toLocaleString() : '—'}
            </div>
            <p className="text-sm text-gray-700">Active businesses using InvoLinks</p>
          </div>
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-200">
            <div className="text-4xl font-bold text-indigo-600 mb-2">
              {publicStats.totalInvoices > 0 ? publicStats.totalInvoices.toLocaleString() : '—'}
            </div>
            <p className="text-sm text-gray-700">e-Invoices generated on InvoLinks platform</p>
          </div>
        </div>

        {/* Why Choose InvoLinks Section */}
        <div className="space-y-8">
          <div className="text-center space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Why Choose InvoLinks?</h2>
            <div className="w-24 h-1 bg-indigo-600 mx-auto rounded-full"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-white hover:shadow-xl transition-shadow">
              <CardContent className="p-8 text-center space-y-4">
                <div className="w-16 h-16 mx-auto bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900">100% UAE Compliant</h3>
                <p className="text-sm text-gray-600">
                  Purpose-built for UAE businesses with FTA Phase 2 ready compliance, UAE VAT rules, and 15-digit TRN validation built-in from day one.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white hover:shadow-xl transition-shadow">
              <CardContent className="p-8 text-center space-y-4">
                <div className="w-16 h-16 mx-auto bg-gradient-to-br from-green-500 to-teal-600 rounded-2xl flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900">Transparent Pricing</h3>
                <p className="text-sm text-gray-600">
                  Start free with 10 invoices/month. No hidden fees, no setup costs, no per-user charges. Scale as you grow with clear, predictable pricing.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white hover:shadow-xl transition-shadow">
              <CardContent className="p-8 text-center space-y-4">
                <div className="w-16 h-16 mx-auto bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900">Modern Technology</h3>
                <p className="text-sm text-gray-600">
                  Built with cutting-edge React and FastAPI for lightning-fast performance, real-time sync, and 99.9% uptime reliability you can count on.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white hover:shadow-xl transition-shadow">
              <CardContent className="p-8 text-center space-y-4">
                <div className="w-16 h-16 mx-auto bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900">Local Support</h3>
                <p className="text-sm text-gray-600">
                  UAE-based support team that understands your business needs, timezone, and regulatory environment. We're here when you need us.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white hover:shadow-xl transition-shadow">
              <CardContent className="p-8 text-center space-y-4">
                <div className="w-16 h-16 mx-auto bg-gradient-to-br from-pink-500 to-rose-600 rounded-2xl flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900">Bank-Grade Security</h3>
                <p className="text-sm text-gray-600">
                  RSA-2048 digital signatures, SHA-256 hash chains, multi-factor authentication, and encrypted data storage protect your financial information.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white hover:shadow-xl transition-shadow">
              <CardContent className="p-8 text-center space-y-4">
                <div className="w-16 h-16 mx-auto bg-gradient-to-br from-yellow-500 to-amber-600 rounded-2xl flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900">Future-Ready Platform</h3>
                <p className="text-sm text-gray-600">
                  Continuous updates, API access, export flexibility, and a transparent roadmap ensure your investment grows with your business needs.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-2xl p-1">
            <div className="bg-white rounded-xl p-8">
              <div className="text-center space-y-4">
                <h3 className="text-2xl font-bold text-gray-900">Ready to Transform Your Invoicing?</h3>
                <p className="text-gray-600 max-w-2xl mx-auto">
                  Join hundreds of UAE businesses that trust InvoLinks for compliant, efficient digital invoicing. Start free today—no credit card required.
                </p>
                <div className="flex flex-wrap justify-center gap-4 pt-4">
                  <Button
                    size="lg"
                    className="bg-indigo-600 hover:bg-indigo-700"
                    onClick={() => document.getElementById('signup')?.scrollIntoView({ behavior: 'smooth' })}
                  >
                    Start Free Trial
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => navigate('/pricing')}
                  >
                    View Pricing
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Card id="signup" className="max-w-6xl mx-auto">
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
      <Footer />
    </div>
  );
}
