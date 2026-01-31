import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

const UserManagement = ({ onBack }) => {
    const { user } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // New User Form State
    const [newUser, setNewUser] = useState({
        username: '',
        password: '',
        full_name: '',
        role: 'constructor'
    });
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const response = await api.get('/users');
            setUsers(response.data);
        } catch (err) {
            setError('Не вдалося завантажити список користувачів');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        setCreating(true);
        setError('');

        try {
            await api.post('/users', newUser);
            setNewUser({ username: '', password: '', full_name: '', role: 'constructor' });
            fetchUsers(); // Refresh list
            alert("Користувача створено успішно!");
        } catch (err) {
            setError(err.response?.data?.detail || 'Помилка при створенні користувача');
        } finally {
            setCreating(false);
        }
    };

    if (user.role !== 'admin') {
        return <div className="text-center text-red-500 mt-10">Доступ заборонено</div>;
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-slate-500 hover:text-blue-600 transition font-bold uppercase text-xs tracking-wider"
                >
                    <i className="fas fa-arrow-left"></i> Назад
                </button>
                <h2 className="text-2xl font-black text-slate-800 uppercase italic">
                    Керування командою
                </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Create User Form */}
                <div className="bg-white rounded-3xl p-6 shadow-xl shadow-slate-200/50 border border-slate-100 h-fit">
                    <h3 className="text-lg font-black text-slate-800 uppercase mb-4 flex items-center gap-2">
                        <i className="fas fa-user-plus text-blue-500"></i> Додати користувача
                    </h3>

                    {error && (
                        <div className="mb-4 p-3 bg-red-100 text-red-600 rounded-xl text-sm font-bold">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleCreateUser} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Логін (для входу)</label>
                            <input
                                type="text"
                                required
                                value={newUser.username}
                                onChange={e => setNewUser({ ...newUser, username: e.target.value })}
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:border-blue-500"
                                placeholder="ivan_k"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Пароль</label>
                            <input
                                type="text"
                                required
                                value={newUser.password}
                                onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:border-blue-500"
                                placeholder="Введіть пароль"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Прізвище та Ім'я</label>
                            <input
                                type="text"
                                required
                                value={newUser.full_name}
                                onChange={e => setNewUser({ ...newUser, full_name: e.target.value })}
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:border-blue-500"
                                placeholder="Іванов Іван"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Роль</label>
                            <select
                                value={newUser.role}
                                onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:border-blue-500"
                            >
                                <option value="constructor">Конструктор</option>
                                <option value="admin">Адміністратор</option>
                            </select>
                        </div>

                        <button
                            type="submit"
                            disabled={creating}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-200 transition active:scale-95 disabled:opacity-50"
                        >
                            {creating ? 'Створення...' : 'Створити користувача'}
                        </button>
                    </form>
                </div>

                {/* User List */}
                <div className="bg-white rounded-3xl p-6 shadow-xl shadow-slate-200/50 border border-slate-100">
                    <h3 className="text-lg font-black text-slate-800 uppercase mb-4 flex items-center gap-2">
                        <i className="fas fa-users text-indigo-500"></i> Список користувачів
                    </h3>

                    {loading ? (
                        <div className="text-center p-4 text-slate-400">Завантаження...</div>
                    ) : (
                        <div className="space-y-3">
                            {users.map(u => (
                                <div key={u.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <div>
                                        <div className="font-bold text-slate-800">{u.full_name}</div>
                                        <div className="text-xs font-mono text-slate-400">@{u.username}</div>
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${u.role === 'admin' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'
                                        }`}>
                                        {u.role === 'admin' ? 'Адмін' : 'Конструктор'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UserManagement;
