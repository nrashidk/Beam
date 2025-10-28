import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { mfaAPI } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import MFAEnrollmentWizard from '../components/MFAEnrollmentWizard';

export default function MFASettings() {
  const navigate = useNavigate();
  const [mfaStatus, setMfaStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEnrollment, setShowEnrollment] = useState(false);
  const [showDisable, setShowDisable] = useState(false);
  const [showRegenerate, setShowRegenerate] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [newBackupCodes, setNewBackupCodes] = useState(null);

  useEffect(() => {
    loadMFAStatus();
  }, []);

  const loadMFAStatus = async () => {
    try {
      setLoading(true);
      const response = await mfaAPI.getStatus();
      setMfaStatus(response.data);
    } catch (err) {
      if (err.response?.status === 401) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEnrollmentComplete = () => {
    setShowEnrollment(false);
    setSuccess('Two-factor authentication has been enabled successfully!');
    loadMFAStatus();
  };

  const handleDisableMFA = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');
      await mfaAPI.disable(verificationCode);
      setShowDisable(false);
      setVerificationCode('');
      setSuccess('Two-factor authentication has been disabled');
      loadMFAStatus();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to disable MFA');
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateBackupCodes = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');
      const response = await mfaAPI.regenerateBackupCodes(verificationCode);
      setNewBackupCodes(response.data.backup_codes);
      setVerificationCode('');
      setSuccess('New backup codes generated successfully!');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to regenerate codes');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadBackupCodes = () => {
    const codes = newBackupCodes.join('\n');
    const blob = new Blob([codes], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'involinks-backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyBackupCodes = () => {
    const codes = newBackupCodes.join('\n');
    navigator.clipboard.writeText(codes);
    setSuccess('Backup codes copied to clipboard!');
  };

  if (loading && !mfaStatus) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {showEnrollment && (
        <MFAEnrollmentWizard
          onComplete={handleEnrollmentComplete}
          onCancel={() => setShowEnrollment(false)}
        />
      )}

      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Security Settings</h1>
              <p className="text-gray-600 mt-1">Manage your account security and authentication</p>
            </div>
            <Button onClick={() => navigate(-1)} variant="outline">
              ← Back
            </Button>
          </div>

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
              ✓ {success}
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <Card>
            <CardContent className="p-8 space-y-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-3xl">🔐</span>
                    <h2 className="text-2xl font-bold">Two-Factor Authentication</h2>
                  </div>
                  <p className="text-gray-600">
                    Add an extra layer of security to your account by requiring a verification code in addition to your password.
                  </p>
                </div>
                <div>
                  {mfaStatus?.enabled ? (
                    <Badge className="bg-green-100 text-green-800 border-green-300">
                      ✓ Enabled
                    </Badge>
                  ) : (
                    <Badge className="bg-gray-100 text-gray-800 border-gray-300">
                      Disabled
                    </Badge>
                  )}
                </div>
              </div>

              {mfaStatus?.enabled ? (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">✅</span>
                      <div className="flex-1">
                        <p className="font-semibold text-green-900 mb-1">Your account is protected</p>
                        <p className="text-sm text-green-800">
                          Method: {mfaStatus.method === 'totp' ? 'Authenticator App' : 'Email OTP'}
                        </p>
                        {mfaStatus.enrolled_at && (
                          <p className="text-xs text-green-700 mt-1">
                            Enabled on {new Date(mfaStatus.enrolled_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      onClick={() => {
                        setShowRegenerate(true);
                        setNewBackupCodes(null);
                        setError('');
                        setSuccess('');
                      }}
                      variant="outline"
                      className="flex-1"
                    >
                      🔑 Regenerate Backup Codes
                    </Button>
                    <Button
                      onClick={() => {
                        setShowDisable(true);
                        setError('');
                        setSuccess('');
                      }}
                      variant="outline"
                      className="flex-1 text-red-600 hover:text-red-700"
                    >
                      🔓 Disable 2FA
                    </Button>
                  </div>

                  {showDisable && (
                    <div className="bg-red-50 border-2 border-red-300 p-6 rounded-lg space-y-4">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">⚠️</span>
                        <div>
                          <p className="font-semibold text-red-900 mb-1">Disable Two-Factor Authentication</p>
                          <p className="text-sm text-red-800">
                            Your account will be less secure. Enter your verification code to confirm.
                          </p>
                        </div>
                      </div>

                      <form onSubmit={handleDisableMFA} className="space-y-3">
                        <Input
                          type="text"
                          value={verificationCode}
                          onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="123456"
                          maxLength={6}
                          className="text-center text-xl tracking-widest"
                          required
                        />
                        <div className="flex gap-2">
                          <Button type="submit" disabled={loading || verificationCode.length !== 6} className="flex-1">
                            {loading ? 'Disabling...' : 'Confirm Disable'}
                          </Button>
                          <Button
                            type="button"
                            onClick={() => {
                              setShowDisable(false);
                              setVerificationCode('');
                            }}
                            variant="outline"
                            className="flex-1"
                          >
                            Cancel
                          </Button>
                        </div>
                      </form>
                    </div>
                  )}

                  {showRegenerate && (
                    <div className="bg-yellow-50 border-2 border-yellow-300 p-6 rounded-lg space-y-4">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">🔑</span>
                        <div>
                          <p className="font-semibold text-yellow-900 mb-1">Regenerate Backup Codes</p>
                          <p className="text-sm text-yellow-800">
                            This will invalidate your old backup codes. Enter your verification code to confirm.
                          </p>
                        </div>
                      </div>

                      {!newBackupCodes ? (
                        <form onSubmit={handleRegenerateBackupCodes} className="space-y-3">
                          <Input
                            type="text"
                            value={verificationCode}
                            onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="123456"
                            maxLength={6}
                            className="text-center text-xl tracking-widest"
                            required
                          />
                          <div className="flex gap-2">
                            <Button type="submit" disabled={loading || verificationCode.length !== 6} className="flex-1">
                              {loading ? 'Generating...' : 'Generate New Codes'}
                            </Button>
                            <Button
                              type="button"
                              onClick={() => {
                                setShowRegenerate(false);
                                setVerificationCode('');
                              }}
                              variant="outline"
                              className="flex-1"
                            >
                              Cancel
                            </Button>
                          </div>
                        </form>
                      ) : (
                        <div className="space-y-4">
                          <div className="bg-white p-4 rounded border border-yellow-300">
                            <div className="grid grid-cols-2 gap-3 font-mono text-sm">
                              {newBackupCodes.map((code, i) => (
                                <div key={i} className="bg-gray-50 p-2 rounded text-center border border-gray-200">
                                  {code}
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button onClick={handleDownloadBackupCodes} variant="outline" className="flex-1">
                              📥 Download
                            </Button>
                            <Button onClick={handleCopyBackupCodes} variant="outline" className="flex-1">
                              📋 Copy
                            </Button>
                          </div>
                          <Button
                            onClick={() => {
                              setShowRegenerate(false);
                              setNewBackupCodes(null);
                            }}
                            className="w-full"
                          >
                            Done
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                    <h3 className="font-semibold mb-2">Why enable 2FA?</h3>
                    <ul className="space-y-1 text-sm text-gray-700">
                      <li className="flex items-start gap-2">
                        <span className="text-blue-600">✓</span>
                        <span>Protect your account even if your password is compromised</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-600">✓</span>
                        <span>Required for compliance with UAE FTA regulations</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-600">✓</span>
                        <span>Works with Google Authenticator, Microsoft Authenticator, and more</span>
                      </li>
                    </ul>
                  </div>

                  <Button onClick={() => setShowEnrollment(true)} className="w-full">
                    Enable Two-Factor Authentication →
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-8">
              <div className="flex items-start gap-3">
                <span className="text-3xl">💡</span>
                <div>
                  <h3 className="font-semibold mb-2">Security Tips</h3>
                  <ul className="space-y-2 text-sm text-gray-700">
                    <li className="flex items-start gap-2">
                      <span className="text-gray-400">•</span>
                      <span>Keep your backup codes in a secure location, like a password manager</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-gray-400">•</span>
                      <span>Never share your verification codes with anyone</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-gray-400">•</span>
                      <span>If you lose access to your authenticator app, use email OTP or backup codes</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-gray-400">•</span>
                      <span>Consider setting up 2FA on your email account as well for maximum security</span>
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
