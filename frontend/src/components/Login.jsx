import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import logoGif from '../assets/videos/MHata1.gif';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login(username, password);
        } catch (err) {
            setError('Невірний логін або пароль');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl">
                <div className="text-center mb-8">
                    {/* Animated GIF Logo */}
                    <div className="relative w-full mx-auto mb-6">
                        <img
                            src={logoGif}
                            alt="Logo"
                            className="w-full h-auto object-contain mx-auto drop-shadow-xl"
                        />
                    </div>

                    <h1 className="text-3xl font-black text-slate-800 italic uppercase tracking-tight">
                        Вхід у систему
                    </h1>
                </div>

                {error && (
                    <div className="bg-red-100 text-red-600 p-3 rounded-xl text-sm font-bold mb-4 text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                            Логін
                        </label>
                        <input
                            type="text"
                            required
                            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:outline-none focus:border-blue-500 transition"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Введіть логін"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                            Пароль
                        </label>
                        <input
                            type="password"
                            required
                            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:outline-none focus:border-blue-500 transition"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-200 transition transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                    >
                        {loading ? 'Вхід...' : 'УВІЙТИ'}
                    </button>

                    <div className="text-center mt-4">
                        <span className="text-xs text-slate-400">
                            За замовчуванням адмін: admin / admin
                        </span>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Login;
