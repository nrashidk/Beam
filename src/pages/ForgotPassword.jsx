import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { EmailInput } from '../components/ui/validated-input';
import { ArrowLeft } from 'lucide-react';
import api from '../lib/api';
import Footer from '../components/Footer';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await api.post('/auth/forgot-password', { email });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex flex-col">
        <nav className="backdrop-blur-md bg-white/80 border-b border-gray-200 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
            <div className="flex items-center gap-2 text-xl font-bold cursor-pointer" onClick={() => navigate('/')}>
              <span className="text-2xl">🔗</span>
              <span>InvoLinks</span>
            </div>
            <Button variant="ghost" onClick={() => navigate('/')}>
              Home
            </Button>
          </div>
        </nav>
        
        <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">Check Your Email</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-gray-600">
                If an account exists for <strong>{email}</strong>, you will receive a password reset link in your email.
              </p>
              <p className="text-sm text-gray-500">
                Please check your inbox and follow the instructions to reset your password.
              </p>
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-left space-y-1">
                <p className="font-medium text-blue-900">Email sent from: noreply@involinks.ae</p>
                <p className="text-blue-700">Can't find it? Check your spam/junk folder</p>
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate('/login')}
            >
              Back to Login
            </Button>
          </CardContent>
        </Card>
        </div>
        
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="backdrop-blur-md bg-white/80 border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2 text-xl font-bold cursor-pointer" onClick={() => navigate('/')}>
            <span className="text-2xl">🔗</span>
            <span>InvoLinks</span>
          </div>
          <Button variant="ghost" onClick={() => navigate('/')}>
            Home
          </Button>
        </div>
      </nav>
      
      <div className="flex-1 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <button
            onClick={() => navigate('/login')}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Login
          </button>
          <CardTitle>Reset Your Password</CardTitle>
          <p className="text-sm text-gray-600 mt-2">
            Enter your email address and we'll send you a link to reset your password.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-gray-700">
                Email Address
              </label>
              <EmailInput
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading || !email}
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </Button>
          </form>
        </CardContent>
      </Card>
      </div>
      
      <Footer />
    </div>
  );
}
