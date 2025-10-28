import React, { useState } from 'react';
import { mfaAPI } from '../lib/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent } from './ui/card';

export default function MFAEnrollmentWizard({ onComplete, onCancel }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [enrollmentData, setEnrollmentData] = useState(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodesSaved, setBackupCodesSaved] = useState(false);

  const handleStartEnrollment = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await mfaAPI.enrollTOTP();
      setEnrollmentData(response.data);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to start enrollment');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEnrollment = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');
      await mfaAPI.verifyEnrollment(verificationCode);
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = () => {
    if (!backupCodesSaved) {
      setError('Please confirm you have saved your backup codes');
      return;
    }
    onComplete();
  };

  const handleDownloadBackupCodes = () => {
    const codes = enrollmentData.backup_codes.join('\n');
    const blob = new Blob([codes], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'involinks-backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
    setBackupCodesSaved(true);
  };

  const handleCopyBackupCodes = () => {
    const codes = enrollmentData.backup_codes.join('\n');
    navigator.clipboard.writeText(codes);
    setBackupCodesSaved(true);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-6 z-50">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardContent className="p-8">
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="mb-4 flex justify-center">
                  <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-4xl">🔐</span>
                  </div>
                </div>
                <h2 className="text-3xl font-bold mb-2">Enable Two-Factor Authentication</h2>
                <p className="text-gray-600">
                  Add an extra layer of security to your account with two-factor authentication (2FA)
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 p-6 rounded-lg">
                <h3 className="font-semibold mb-3">What you'll need:</h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 mt-1">📱</span>
                    <span>An authenticator app (Google Authenticator, Microsoft Authenticator, or Authy)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 mt-1">🔑</span>
                    <span>A safe place to store backup recovery codes</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 mt-1">⏱️</span>
                    <span>About 2 minutes to complete setup</span>
                  </li>
                </ul>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <Button onClick={handleStartEnrollment} disabled={loading} className="flex-1">
                  {loading ? 'Loading...' : 'Get Started →'}
                </Button>
                <Button onClick={onCancel} variant="outline" className="flex-1">
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {step === 2 && enrollmentData && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold mb-2">Scan QR Code</h2>
                <p className="text-gray-600">
                  Use your authenticator app to scan this QR code
                </p>
              </div>

              <div className="bg-white p-6 rounded-lg border-2 border-gray-200 flex justify-center">
                <img 
                  src={enrollmentData.qr_code} 
                  alt="QR Code" 
                  className="w-64 h-64"
                />
              </div>

              <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg">
                <p className="text-sm font-medium mb-2">Can't scan the QR code?</p>
                <p className="text-xs text-gray-600 mb-2">Enter this code manually in your authenticator app:</p>
                <div className="bg-white p-3 rounded border border-gray-300 font-mono text-sm text-center break-all">
                  {enrollmentData.secret}
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleVerifyEnrollment} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Enter the 6-digit code from your authenticator app
                  </label>
                  <Input
                    type="text"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="123456"
                    maxLength={6}
                    className="text-center text-2xl tracking-widest"
                    required
                    autoFocus
                  />
                </div>

                <div className="flex gap-3">
                  <Button 
                    type="submit" 
                    disabled={loading || verificationCode.length !== 6}
                    className="flex-1"
                  >
                    {loading ? 'Verifying...' : 'Verify & Continue →'}
                  </Button>
                  <Button 
                    type="button"
                    onClick={() => setStep(1)} 
                    variant="outline"
                    className="flex-1"
                  >
                    ← Back
                  </Button>
                </div>
              </form>
            </div>
          )}

          {step === 3 && enrollmentData && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="mb-4 flex justify-center">
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                    <span className="text-4xl">✅</span>
                  </div>
                </div>
                <h2 className="text-2xl font-bold mb-2">Save Your Backup Codes</h2>
                <p className="text-gray-600">
                  Store these codes in a safe place. You can use them to access your account if you lose your authenticator device.
                </p>
              </div>

              <div className="bg-yellow-50 border-2 border-yellow-300 p-6 rounded-lg">
                <div className="flex items-start gap-3 mb-4">
                  <span className="text-2xl">⚠️</span>
                  <div>
                    <p className="font-semibold text-yellow-900 mb-1">Important!</p>
                    <p className="text-sm text-yellow-800">
                      Each code can only be used once. Save them now - you won't see them again.
                    </p>
                  </div>
                </div>
                
                <div className="bg-white p-4 rounded border border-yellow-300">
                  <div className="grid grid-cols-2 gap-3 font-mono text-sm">
                    {enrollmentData.backup_codes.map((code, i) => (
                      <div key={i} className="bg-gray-50 p-2 rounded text-center border border-gray-200">
                        {code}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button 
                  onClick={handleDownloadBackupCodes}
                  variant="outline"
                  className="flex-1"
                >
                  📥 Download Codes
                </Button>
                <Button 
                  onClick={handleCopyBackupCodes}
                  variant="outline"
                  className="flex-1"
                >
                  📋 Copy to Clipboard
                </Button>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={backupCodesSaved}
                    onChange={(e) => setBackupCodesSaved(e.target.checked)}
                    className="mt-1"
                  />
                  <span className="text-sm">
                    I have saved my backup codes in a secure location and understand that I won't be able to see them again.
                  </span>
                </label>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <Button 
                onClick={handleComplete}
                disabled={!backupCodesSaved}
                className="w-full"
              >
                Complete Setup ✓
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
