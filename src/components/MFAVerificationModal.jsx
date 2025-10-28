import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { mfaAPI } from '../lib/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent } from './ui/card';

export default function MFAVerificationModal({ onSuccess }) {
  const { verifyMFA, mfaMethod, userEmail, cancelMFA } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [useBackup, setUseBackup] = useState(false);
  const [useEmail, setUseEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    let method = mfaMethod;
    if (useBackup) method = 'backup';
    if (useEmail) method = 'email';

    const result = await verifyMFA(code, method);

    if (result.success) {
      onSuccess();
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  const handleSendEmailOTP = async () => {
    try {
      setLoading(true);
      await mfaAPI.sendEmailOTP(userEmail);
      setEmailSent(true);
      setUseEmail(true);
      setError('');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to send email');
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    if (useBackup) return 'Enter Backup Code';
    if (useEmail) return 'Enter Email Code';
    if (mfaMethod === 'totp') return 'Two-Factor Authentication';
    return 'Verify Your Identity';
  };

  const getDescription = () => {
    if (useBackup) return 'Enter one of your backup recovery codes';
    if (useEmail) return 'Enter the 6-digit code sent to your email';
    if (mfaMethod === 'totp') return 'Enter the 6-digit code from your authenticator app';
    return 'Please verify your identity to continue';
  };

  const getPlaceholder = () => {
    if (useBackup) return '12345678';
    return '123456';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-6 z-50">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 space-y-6">
          <div className="text-center">
            <div className="mb-4 flex justify-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-3xl">🔐</span>
              </div>
            </div>
            <h2 className="text-2xl font-semibold mb-2">{getTitle()}</h2>
            <p className="text-sm text-gray-600">{getDescription()}</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {emailSent && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
              ✓ Verification code sent to your email
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Verification Code
              </label>
              <Input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, useBackup ? 8 : 6))}
                placeholder={getPlaceholder()}
                maxLength={useBackup ? 8 : 6}
                className="text-center text-2xl tracking-widest"
                required
                autoFocus
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading || code.length !== (useBackup ? 8 : 6)}>
              {loading ? 'Verifying...' : 'Verify →'}
            </Button>
          </form>

          <div className="space-y-2 pt-4 border-t">
            {!useEmail && !useBackup && mfaMethod === 'totp' && (
              <button
                type="button"
                onClick={handleSendEmailOTP}
                disabled={loading || emailSent}
                className="w-full text-sm text-blue-600 hover:underline disabled:text-gray-400"
              >
                {emailSent ? '✓ Email sent' : 'Send code via email instead'}
              </button>
            )}

            {!useBackup && (
              <button
                type="button"
                onClick={() => {
                  setUseBackup(true);
                  setUseEmail(false);
                  setCode('');
                  setError('');
                }}
                className="w-full text-sm text-gray-600 hover:underline"
              >
                Use a backup recovery code
              </button>
            )}

            {(useBackup || useEmail) && (
              <button
                type="button"
                onClick={() => {
                  setUseBackup(false);
                  setUseEmail(false);
                  setCode('');
                  setError('');
                  setEmailSent(false);
                }}
                className="w-full text-sm text-gray-600 hover:underline"
              >
                ← Back to authenticator app
              </button>
            )}

            <button
              type="button"
              onClick={cancelMFA}
              className="w-full text-sm text-red-600 hover:underline"
            >
              Cancel and return to login
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
