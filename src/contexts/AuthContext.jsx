import React, { createContext, useState, useContext, useEffect } from 'react';
import { authAPI, mfaAPI } from '../lib/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [tempToken, setTempToken] = useState(null);
  const [mfaMethod, setMfaMethod] = useState(null);
  const [userEmail, setUserEmail] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (token && userData) {
      setUser(JSON.parse(userData));
    }
    setLoading(false);
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
          mfaMethod: data.mfa_method 
        };
      }
      
      const { access_token, user_id, company_id, company_name, role } = data;
      localStorage.setItem('token', access_token);
      const userData = { user_id, company_id, company_name, role };
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      
      return { success: true, mfaRequired: false };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.detail || 'Login failed' 
      };
    }
  };

  const verifyMFA = async (code, method) => {
    try {
      const response = await mfaAPI.verifyMFA(tempToken, code, method);
      const { access_token, user_id, company_id, company_name, role } = response.data;
      
      localStorage.setItem('token', access_token);
      const userData = { user_id, company_id, company_name, role };
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      
      setMfaRequired(false);
      setTempToken(null);
      setMfaMethod(null);
      setUserEmail(null);
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.detail || 'Verification failed' 
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
    localStorage.removeItem('token');
    localStorage.removeItem('user');
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
    isSuperAdmin: user?.role === 'SUPER_ADMIN',
    isCompanyAdmin: user?.role === 'COMPANY_ADMIN' || user?.role === 'COMPANY',
    mfaRequired,
    mfaMethod,
    userEmail,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
