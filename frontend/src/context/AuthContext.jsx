import React, { createContext, useState, useEffect, useContext } from 'react';
import { api } from '../api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const initAuth = async () => {
            if (token) {
                try {
                    // Fetch current user or basic validity check
                    // For now, we decode token or just assume valid if exists
                    // Ideally call /users/me endpoint
                    const payload = JSON.parse(atob(token.split('.')[1]));
                    setUser({ username: payload.sub, role: payload.role || 'constructor' });
                    // Set default header
                    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
                } catch (error) {
                    logout();
                }
            }
            setLoading(false);
        };
        initAuth();
    }, [token]);

    const login = async (username, password) => {
        try {
            const formData = new FormData();
            formData.append('username', username);
            formData.append('password', password);

            const response = await api.post('/token', formData);
            const { access_token } = response.data;

            localStorage.setItem('token', access_token);
            setToken(access_token);

            // Set user from token payload immediately
            const payload = JSON.parse(atob(access_token.split('.')[1]));
            setUser({ username: payload.sub, role: payload.role || 'constructor' });
            return true;
        } catch (error) {
            console.error("Login failed", error);
            throw error;
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
        delete api.defaults.headers.common['Authorization'];
    };

    return (
        <AuthContext.Provider value={{ user, token, login, logout, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
