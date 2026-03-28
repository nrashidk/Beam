import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useRef,
} from "react";
import { authAPI, mfaAPI, apiClient } from "../lib/api";

const AuthContext = createContext(null);
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;

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

// Task 20: Hydrate force_password_change flag from JWT claim
const hydrateForceChangeFromToken = (token) => {
  if (!token) return;
  try {
    const padding = 4 - (token.split(".")[1].length % 4);
    const payload = JSON.parse(atob(token.split(".")[1] + "=".repeat(padding % 4)));
    if (payload.password_change_required === true) {
      localStorage.setItem("force_password_change", "true");
    } else {
      localStorage.removeItem("force_password_change");
    }
  } catch (_) {
    // Ignore decoding errors
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [tempToken, setTempToken] = useState(null);
  const [mfaMethod, setMfaMethod] = useState(null);
  const [userEmail, setUserEmail] = useState(null);
  const inactivityTimerRef = useRef(null);

  useEffect(() => {
    const checkAndRefreshToken = async () => {
      const token = localStorage.getItem("token");
      const userData = localStorage.getItem("user");
      const refreshToken = localStorage.getItem("refresh_token");

      if (!token || !userData) {
        setLoading(false);
        return;
      }

      // Task 20: Sync force_password_change flag from JWT claim on bootstrap
      hydrateForceChangeFromToken(token);

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
        // Token is still valid - try to fetch fresh user profile from /me
        try {
          const resp = await apiClient.get("/me");
          const profile = resp.data;
          // Normalize to client user shape
          const userObj = {
            user_id: profile.user_id,
            company_id: profile.company?.id || profile.company_id,
            company_name: profile.company?.legal_name || profile.company_name,
            role: profile.role,
            email: profile.email,
            company: profile.company,
          };
          localStorage.setItem("user", JSON.stringify(userObj));
          setUser(userObj);
        } catch (err) {
          // Fallback to cached userData if /me fails
          try {
            setUser(JSON.parse(userData));
          } catch (e) {
            setUser(null);
          }
        }
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

      const { access_token, refresh_token } = data;
      localStorage.setItem("token", access_token);
      if (refresh_token) {
        localStorage.setItem("refresh_token", refresh_token);
      }
      // Fetch full profile (/me) to get email and company info
      try {
        const resp = await apiClient.get("/me");
        const profile = resp.data;
        const userObj = {
          user_id: profile.user_id,
          company_id: profile.company?.id || profile.company_id,
          company_name: profile.company?.legal_name || profile.company_name,
          role: profile.role,
          email: profile.email,
          company: profile.company,
        };
        localStorage.setItem("user", JSON.stringify(userObj));
        setUser(userObj);
      } catch (err) {
        // Fallback to minimal user info if /me fails
        const userData = {
          user_id: data.user_id,
          company_id: data.company_id,
          company_name: data.company_name,
          role: data.role,
        };
        localStorage.setItem("user", JSON.stringify(userData));
        setUser(userData);
      }

      // Task 20: Propagate forced password change flag
      const passwordChangeRequired = !!data.password_change_required;
      if (passwordChangeRequired) {
        localStorage.setItem("force_password_change", "true");
      } else {
        localStorage.removeItem("force_password_change");
      }

      return { success: true, mfaRequired: false, passwordChangeRequired };
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
      const { access_token, refresh_token } = response.data;
      localStorage.setItem("token", access_token);
      if (refresh_token) {
        localStorage.setItem("refresh_token", refresh_token);
      }

      // Fetch /me for full profile
      try {
        const resp = await apiClient.get("/me");
        const profile = resp.data;
        const userObj = {
          user_id: profile.user_id,
          company_id: profile.company?.id || profile.company_id,
          company_name: profile.company?.legal_name || profile.company_name,
          role: profile.role,
          email: profile.email,
          company: profile.company,
        };
        localStorage.setItem("user", JSON.stringify(userObj));
        setUser(userObj);
      } catch (err) {
        // If /me fails, fall back to minimal response data
        const { user_id, company_id, company_name, role } = response.data;
        const userData = { user_id, company_id, company_name, role };
        localStorage.setItem("user", JSON.stringify(userData));
        setUser(userData);
      }

      setMfaRequired(false);
      setTempToken(null);
      setMfaMethod(null);
      setUserEmail(null);

      // Task 20: Propagate forced password change flag for MFA users too
      const passwordChangeRequired = !!response.data.password_change_required;
      if (passwordChangeRequired) {
        localStorage.setItem("force_password_change", "true");
      } else {
        localStorage.removeItem("force_password_change");
      }

      return { success: true, passwordChangeRequired };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || "MFA verification failed",
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

  useEffect(() => {
    if (!user) {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
      return;
    }

    const resetInactivityTimer = () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      inactivityTimerRef.current = setTimeout(() => {
        logout();
      }, INACTIVITY_TIMEOUT_MS);
    };

    const activityEvents = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "click",
    ];

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, resetInactivityTimer);
    });

    resetInactivityTimer();

    return () => {
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, resetInactivityTimer);
      });
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
    };
  }, [user]);

  const value = {
    user,
    login,
    logout,
    verifyMFA,
    cancelMFA,
    loading,
    isAuthenticated: !!user,
    isSuperAdmin: user?.role === "SUPER_ADMIN",
    isCompanyAdmin:
      user?.role === "COMPANY_ADMIN" ||
      user?.role === "COMPANY" ||
      user?.role === "BUSINESS_ADMIN" ||
      user?.role === "FINANCE_USER",
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
