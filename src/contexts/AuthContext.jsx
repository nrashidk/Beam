import React, { createContext, useState, useContext, useEffect } from "react";
import { authAPI, mfaAPI } from "../lib/api";

const AuthContext = createContext(null);

// Helper function to decode JWT and check expiration
const isTokenExpired = (token) => {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const expirationTime = payload.exp * 1000; // Convert to milliseconds
    return Date.now() >= expirationTime;
  } catch (error) {
    return true; // If we can't decode, consider it expired
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [tempToken, setTempToken] = useState(null);
  const [mfaMethod, setMfaMethod] = useState(null);
  const [userEmail, setUserEmail] = useState(null);

  useEffect(() => {
    const checkAndRefreshToken = async () => {
      const token = localStorage.getItem("token");
      const userData = localStorage.getItem("user");
      const refreshToken = localStorage.getItem("refresh_token");

      if (!token || !userData) {
        setLoading(false);
        return;
      }

      // Check if access token is expired
      if (isTokenExpired(token)) {
        // Try to refresh using refresh token
        if (refreshToken && !isTokenExpired(refreshToken)) {
          try {
            const response = await authAPI.refresh();
            if (response && response.access_token) {
              // Token refreshed successfully, user stays logged in
              setUser(JSON.parse(userData));
            } else {
              // Refresh failed, logout
              logout();
            }
          } catch (error) {
            // Refresh failed, logout
            logout();
          }
        } else {
          // No valid refresh token, logout
          logout();
        }
      } else {
        // Token is still valid
        setUser(JSON.parse(userData));
      }

      setLoading(false);
    };

    checkAndRefreshToken();
  }, []);

  const login = async (email, password) => {
    try {
      const response = await authAPI.login(email, password);
      const data = response.data;

      if (data.mfa_required) {
        setMfaRequired(true);
        setTempToken(data.temp_token);
        setMfaMethod(data.mfa_method);
        setUserEmail(email);
        return {
          success: true,
          mfaRequired: true,
          mfaMethod: data.mfa_method,
        };
      }

      const {
        access_token,
        refresh_token,
        user_id,
        company_id,
        company_name,
        role,
      } = data;
      localStorage.setItem("token", access_token);
      if (refresh_token) {
        localStorage.setItem("refresh_token", refresh_token);
      }
      const userData = { user_id, company_id, company_name, role };
      localStorage.setItem("user", JSON.stringify(userData));
      setUser(userData);

      return { success: true, mfaRequired: false };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || "Login failed",
      };
    }
  };

  const verifyMFA = async (code, method) => {
    try {
      const response = await mfaAPI.verifyMFA(tempToken, code, method);
      const {
        access_token,
        refresh_token,
        user_id,
        company_id,
        company_name,
        role,
      } = response.data;

      localStorage.setItem("token", access_token);
      if (refresh_token) {
        localStorage.setItem("refresh_token", refresh_token);
      }
      const userData = { user_id, company_id, company_name, role };
      localStorage.setItem("user", JSON.stringify(userData));
      setUser(userData);

      setMfaRequired(false);
      setTempToken(null);
      setMfaMethod(null);
      setUserEmail(null);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || "Verification failed",
      };
    }
  };

  const cancelMFA = () => {
    setMfaRequired(false);
    setTempToken(null);
    setMfaMethod(null);
    setUserEmail(null);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
    setUser(null);
    authAPI.logout().catch(() => {});
  };

  const value = {
    user,
    login,
    logout,
    verifyMFA,
    cancelMFA,
    loading,
    isAuthenticated: !!user,
    isSuperAdmin: user?.role === "SUPER_ADMIN",
    isCompanyAdmin: user?.role === "COMPANY_ADMIN" || user?.role === "COMPANY" || user?.role === "BUSINESS_ADMIN" || user?.role === "FINANCE_USER",
    mfaRequired,
    mfaMethod,
    userEmail,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
