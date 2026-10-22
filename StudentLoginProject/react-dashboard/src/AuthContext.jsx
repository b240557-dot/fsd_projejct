import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, api } from "./api";
import { AuthContext } from "./auth-context";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  const refreshUser = useCallback(async () => {
    setLoading(true);
    setAuthError("");
    try {
      const result = await api.me();
      setUser(result.user);
      setAuthError("");
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 401) {
        setUser(null);
        setAuthError("");
      } else {
        setAuthError(error.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    api.me()
      .then((result) => {
        if (!active) return;
        setUser(result.user);
        setAuthError("");
      })
      .catch((error) => {
        if (!active) return;
        if (error instanceof ApiError && error.statusCode === 401) {
          setUser(null);
        } else {
          setAuthError(error.message);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    authError,
    refreshUser,
    async login(values) {
      await api.login(values);
      const session = await api.me();
      if (!session.user) {
        throw new ApiError(
          "Login succeeded but the session cookie was not retained. Check the backend cookie and frontend proxy settings, then try again.",
          401,
        );
      }
      setUser(session.user);
      setAuthError("");
      return session;
    },
    async signup(values) {
      return api.signup(values);
    },
    async logout() {
      await api.logout();
      setUser(null);
    },
  }), [user, loading, authError, refreshUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
