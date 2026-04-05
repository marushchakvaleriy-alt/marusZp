import React, { createContext, useState, useEffect, useContext } from 'react';
import { api } from '../api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [loading, setLoading] = useState(true);

    const applyToken = (jwtToken) => {
        if (jwtToken) {
            api.defaults.headers.common['Authorization'] = `Bearer ${jwtToken}`;
        } else {
            delete api.defaults.headers.common['Authorization'];
        }
    };

    const fetchCurrentUser = async (jwtToken) => {
        applyToken(jwtToken);
        const response = await api.get('/users/me');
        setUser(response.data);
    };

    useEffect(() => {
        const initAuth = async () => {
            if (token) {
                try {
                    await fetchCurrentUser(token);
                } catch (error) {
                    logout();
                }
            } else {
                applyToken(null);
            }
            setLoading(false);
        };
        initAuth();
    }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

    const login = async (username, password) => {
        try {
            const formData = new FormData();
            formData.append('username', username);
            formData.append('password', password);

            const response = await api.post('/token', formData);
            const { access_token } = response.data;

            localStorage.setItem('token', access_token);
            setToken(access_token);
            await fetchCurrentUser(access_token);
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
        applyToken(null);
    };

    return (
        <AuthContext.Provider value={{ user, token, login, logout, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
