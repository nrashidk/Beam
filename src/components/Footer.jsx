import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function Footer() {
  const navigate = useNavigate();
  const [footerContent, setFooterContent] = useState({
    company_name: 'InvoLinks',
    company_description: 'Simple, Compliant Digital Invoicing for UAE',
    address: 'Dubai, United Arab Emirates',
    email: 'support@involinks.ae',
    phone: '+971 4 123 4567',
    copyright: '© 2025 InvoLinks. All rights reserved.'
  });

  const quickLinks = [
    { label: 'Home', url: '/' },
    { label: 'Pricing', url: '/pricing' },
    { label: 'Sign In', url: '/login' }
  ];

  const legalLinks = [
    { label: 'Privacy Policy', url: '/privacy' },
    { label: 'Terms of Service', url: '/terms' }
  ];

  useEffect(() => {
    fetchFooterContent();
  }, []);

  const fetchFooterContent = async () => {
    try {
      const response = await axios.get(`${API_URL}/content/footer`);
      if (response.data) {
        setFooterContent(prev => ({ ...prev, ...response.data }));
      }
    } catch (error) {
      // Using default footer content
    }
  };

  return (
    <footer className="bg-gray-900 text-gray-300 py-12 border-t">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Company Info */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-2 text-xl font-bold text-white mb-4">
              <span className="text-2xl">🔗</span>
              <span>{footerContent.company_name}</span>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              {footerContent.company_description}
            </p>
            {footerContent.address && (
              <p className="text-sm text-gray-400">{footerContent.address}</p>
            )}
            {footerContent.email && (
              <p className="text-sm text-gray-400">
                Email: <a href={`mailto:${footerContent.email}`} className="hover:text-blue-400">{footerContent.email}</a>
              </p>
            )}
            {footerContent.phone && (
              <p className="text-sm text-gray-400">
                Phone: <a href={`tel:${footerContent.phone}`} className="hover:text-blue-400">{footerContent.phone}</a>
              </p>
            )}
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-white font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              {quickLinks.map((link, index) => (
                <li key={index}>
                  <button
                    onClick={() => navigate(link.url)}
                    className="text-sm text-gray-400 hover:text-blue-400 transition-colors"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h3 className="text-white font-semibold mb-4">Legal</h3>
            <ul className="space-y-2">
              {legalLinks.map((link, index) => (
                <li key={index}>
                  <button
                    onClick={() => navigate(link.url)}
                    className="text-sm text-gray-400 hover:text-blue-400 transition-colors"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="pt-8 border-t border-gray-800 text-center">
          <p className="text-sm text-gray-500">{footerContent.copyright}</p>
        </div>
      </div>
    </footer>
  );
}
