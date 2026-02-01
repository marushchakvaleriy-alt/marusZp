import React, { useState, useEffect } from 'react';
import { api, updateUser } from '../api';
import { useAuth } from '../context/AuthContext';

const UserManagement = ({ onBack }) => {
    const { user } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Form State (Create / Edit)
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        full_name: '',
        role: 'constructor',
        card_number: '',
        email: '',
        phone_number: ''
    });
    const [isEditing, setIsEditing] = useState(false);
    const [editId, setEditId] = useState(null);
    const [submitting, setSubmitting] = useState(false);

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

    const resetForm = () => {
        setFormData({ username: '', password: '', full_name: '', role: 'constructor', card_number: '', email: '', phone_number: '' });
        setIsEditing(false);
        setEditId(null);
        setError('');
    };

    const handleEdit = (u) => {
        setFormData({
            username: u.username,
            password: '', // Password not retrieved for security
            full_name: u.full_name,
            role: u.role,
            card_number: u.card_number || '',
            email: u.email || '',
            phone_number: u.phone_number || ''
        });
        setEditId(u.id);
        setIsEditing(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError('');

        try {
            if (isEditing) {
                // Update
                const updateData = { ...formData };
                if (!updateData.password) delete updateData.password; // Don't send empty password
                delete updateData.username; // Cannot change username usually, or handled carefully

                await updateUser(editId, updateData);
                alert("Дані оновлено!");
            } else {
                // Create
                await api.post('/users', formData);
                alert("Користувача створено успішно!");
            }
            resetForm();
            fetchUsers();
        } catch (err) {
            setError(err.response?.data?.detail || 'Помилка збереження');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteUser = async (id, username) => {
        if (!window.confirm(`Видалити користувача ${username}?`)) return;
        try {
            await api.delete(`/users/${id}`);
            fetchUsers();
            alert("Користувача видалено.");
        } catch (err) {
            alert(err.response?.data?.detail || "Помилка видалення");
        }
    };

    if (user.role !== 'admin') {
        return <div className="text-center text-red-500 mt-10">Доступ заборонено</div>;
    }

    return (
        <div className="space-y-6 animate-fade-in pb-10">
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Form (Create / Edit) */}
                <div className="lg:col-span-1">
                    <div className="bg-white rounded-3xl p-6 shadow-xl shadow-slate-200/50 border border-slate-100 sticky top-4">
                        <h3 className="text-lg font-black text-slate-800 uppercase mb-4 flex items-center gap-2">
                            <i className={`fas ${isEditing ? 'fa-pen' : 'fa-user-plus'} text-blue-500`}></i>
                            {isEditing ? 'Редагувати профіль' : 'Додати користувача'}
                        </h3>

                        {error && (
                            <div className="mb-4 p-3 bg-red-100 text-red-600 rounded-xl text-sm font-bold">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {!isEditing && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Логін</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.username}
                                        onChange={e => setFormData({ ...formData, username: e.target.value })}
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:border-blue-500"
                                        placeholder="ivan_k"
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                                    {isEditing ? 'Новий пароль (залиште пустим, щоб не змінювати)' : 'Пароль'}
                                </label>
                                <input
                                    type="text"
                                    required={!isEditing}
                                    value={formData.password}
                                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:border-blue-500"
                                    placeholder={isEditing ? "********" : "supersecret"}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Прізвище та Ім'я</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.full_name}
                                    onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:border-blue-500"
                                    placeholder="Іванов Іван"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Роль</label>
                                <select
                                    value={formData.role}
                                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:border-blue-500"
                                >
                                    <option value="constructor">Конструктор</option>
                                    <option value="manager">Менеджер</option>
                                    <option value="admin">Адміністратор</option>
                                </select>
                            </div>

                            <div className="pt-2 border-t border-dashed">
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Номер картки (IBAN / Card)</label>
                                <input
                                    type="text"
                                    value={formData.card_number}
                                    onChange={e => setFormData({ ...formData, card_number: e.target.value })}
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm focus:outline-none focus:border-blue-500"
                                    placeholder="0000 0000 0000 0000"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Email</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:border-blue-500"
                                    placeholder="mail@example.com"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Телефон</label>
                                <input
                                    type="text"
                                    value={formData.phone_number}
                                    onChange={e => setFormData({ ...formData, phone_number: e.target.value })}
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:border-blue-500"
                                    placeholder="+380991234567"
                                />
                            </div>

                            <div className="flex gap-2 pt-2">
                                {isEditing && (
                                    <button
                                        type="button"
                                        onClick={resetForm}
                                        className="flex-1 py-3 bg-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-300 transition"
                                    >
                                        Скасувати
                                    </button>
                                )}
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-200 transition active:scale-95 disabled:opacity-50"
                                >
                                    {submitting ? 'Збереження...' : (isEditing ? 'Зберегти зміни' : 'Створити')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                {/* User List */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-3xl p-6 shadow-xl shadow-slate-200/50 border border-slate-100">
                        <h3 className="text-lg font-black text-slate-800 uppercase mb-4 flex items-center gap-2">
                            <i className="fas fa-users text-indigo-500"></i> Список користувачів ({users.length})
                        </h3>

                        {loading ? (
                            <div className="text-center p-4 text-slate-400">Завантаження...</div>
                        ) : (
                            <div className="space-y-3">
                                {users.map(u => (
                                    <div key={u.id} className="relative p-5 bg-slate-50 rounded-2xl border border-slate-100 hover:shadow-md transition group">
                                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-1">
                                                    <span className="font-bold text-lg text-slate-800">{u.full_name}</span>
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${u.role === 'admin' ? 'bg-purple-100 text-purple-600' :
                                                        u.role === 'manager' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'
                                                        }`}>
                                                        {u.role === 'admin' ? 'Адмін' : u.role === 'manager' ? 'Менеджер' : 'Конструктор'}
                                                    </span>
                                                </div>
                                                <div className="flex flex-col gap-1 text-sm text-slate-500">
                                                    <span className="font-mono text-xs">Login: @{u.username}</span>
                                                    {u.card_number && (
                                                        <span className="flex items-center gap-2">
                                                            <i className="far fa-credit-card text-slate-400"></i>
                                                            <span className="font-mono text-slate-700 bg-white px-1 rounded border border-slate-200">
                                                                {u.card_number}
                                                            </span>
                                                        </span>
                                                    )}
                                                    {u.email && (
                                                        <span className="flex items-center gap-2">
                                                            <i className="far fa-envelope text-slate-400"></i>
                                                            {u.email}
                                                        </span>
                                                    )}
                                                    {u.phone_number && (
                                                        <span className="flex items-center gap-2">
                                                            <i className="fas fa-phone text-slate-400"></i>
                                                            {u.phone_number}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleEdit(u)}
                                                    className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 text-blue-500 rounded-xl hover:bg-blue-50 hover:border-blue-200 transition shadow-sm"
                                                    title="Редагувати"
                                                >
                                                    <i className="fas fa-pen"></i>
                                                </button>

                                                {u.username !== 'admin' && (
                                                    <button
                                                        onClick={() => handleDeleteUser(u.id, u.full_name)}
                                                        className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 text-red-500 rounded-xl hover:bg-red-50 hover:border-red-200 transition shadow-sm"
                                                        title="Видалити"
                                                    >
                                                        <i className="fas fa-trash"></i>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UserManagement;
