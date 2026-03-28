import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { PasswordInput } from "../components/ui/validated-input";
import api from "../lib/api";

export default function ForceChangePassword() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const forceFlag = localStorage.getItem("force_password_change");
    if (!forceFlag) {
      navigate("/dashboard", { replace: true });
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      await api.post("/me/change-password", null, {
        params: {
          current_password: currentPassword,
          new_password: newPassword,
        },
      });

      localStorage.removeItem("force_password_change");
      setSuccess(true);

      setTimeout(() => {
        navigate("/dashboard", { replace: true });
      }, 2000);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Failed to change password. Please check your current password and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    logout();
    navigate("/login", { replace: true });
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-2xl font-semibold text-green-700 mb-2">
              Password Changed
            </h2>
            <p className="text-gray-600">
              Your password has been updated. Redirecting to your dashboard...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-6">
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
              <div className="text-4xl mb-3">🔒</div>
              <h2 className="text-2xl font-semibold mb-2">
                Password Change Required
              </h2>
              <p className="text-sm text-gray-600">
                For your security, you must set a new password before accessing
                your account. Your account was provisioned with a temporary
                password.
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg text-sm">
              <strong>Security Notice:</strong> Please choose a strong, unique
              password that you haven't used before.
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Current (Temporary) Password
                </label>
                <PasswordInput
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  noValidation={true}
                  placeholder="Enter your temporary password"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  New Password
                </label>
                <PasswordInput
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Choose a strong new password"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Confirm New Password
                </label>
                <PasswordInput
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  noValidation={true}
                  placeholder="Repeat your new password"
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Changing Password..." : "Set New Password"}
              </Button>
            </form>

            <div className="text-center">
              <button
                type="button"
                className="text-sm text-gray-500 hover:underline"
                onClick={handleCancel}
              >
                Cancel and sign out
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
