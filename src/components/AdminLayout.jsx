import React from 'react';
import { useNavigate } from 'react-router-dom';
import Footer from './Footer';

export default function AdminLayout({ children, navigation, title, subtitle }) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <nav className="bg-white/70 backdrop-blur-md border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xl font-bold cursor-pointer" onClick={() => navigate('/')}>
              <span className="text-2xl">🔗</span>
              <span>InvoLinks</span>
            </div>
            {navigation && <div className="flex items-center gap-3">{navigation}</div>}
          </div>
        </div>
      </nav>

      <main className="flex-1">
        {children}
      </main>

      <Footer />
    </div>
  );
}
