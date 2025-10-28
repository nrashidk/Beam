import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { EmailInput, PasswordInput } from '../components/ui/validated-input';
import MFAVerificationModal from '../components/MFAVerificationModal';

export default function Login() {
  const navigate = useNavigate();
  const { login, mfaRequired } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await login(email, password);
    
    if (result.success && !result.mfaRequired) {
      navigate('/dashboard');
    } else if (result.success && result.mfaRequired) {
      setLoading(false);
    } else {
      setError(result.error);
      setLoading(false);
    }
  };

  const handleMFASuccess = () => {
    navigate('/dashboard');
  };

  return (
    <>
      {mfaRequired && <MFAVerificationModal onSuccess={handleMFASuccess} />}
      
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 text-2xl font-bold mb-2">
            <span className="text-3xl">🔗</span>
            <span>InvoLinks</span>
          </div>
        </div>

        <Card>
          <CardContent className="p-8 space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-semibold mb-2">Welcome Back</h2>
              <p className="text-sm text-gray-600">Sign in to your account</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <EmailInput
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Password</label>
                <PasswordInput
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>

              <div className="text-right">
                <button
                  type="button"
                  className="text-sm text-blue-600 hover:underline"
                  onClick={() => navigate('/forgot-password')}
                >
                  Forgot password?
                </button>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Signing In...' : 'Sign In →'}
              </Button>
            </form>

            <p className="text-center text-sm text-gray-600">
              Don't have an account?{' '}
              <button
                type="button"
                className="text-blue-600 hover:underline"
                onClick={() => navigate('/')}
              >
                Sign up for free
              </button>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
    </>
  );
}
