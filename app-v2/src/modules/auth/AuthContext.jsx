import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../../shared/api';
import { canAccessPage, getFirstAllowedPath } from './access';

const AuthContext = createContext(null);
const storageKey = 'app_v2_token';

function applyToken(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(storageKey));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      if (!token) {
        applyToken(null);
        setLoading(false);
        return;
      }

      try {
        applyToken(token);
        const response = await api.get('/users/me');
        setUser(response.data);
      } catch (error) {
        localStorage.removeItem(storageKey);
        setToken(null);
        setUser(null);
        applyToken(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, [token]);

  const login = async (username, password) => {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);

    const tokenResponse = await api.post('/token', formData);
    const nextToken = tokenResponse.data.access_token;

    localStorage.setItem(storageKey, nextToken);
    applyToken(nextToken);

    const meResponse = await api.get('/users/me');

    setToken(nextToken);
    setUser(meResponse.data);

    return meResponse.data;
  };

  const logout = () => {
    localStorage.removeItem(storageKey);
    setToken(null);
    setUser(null);
    applyToken(null);
  };

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      login,
      logout,
      canAccessPage: (pageKey) => canAccessPage(user, pageKey),
      getHomePath: () => getFirstAllowedPath(user),
    }),
    [token, user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
