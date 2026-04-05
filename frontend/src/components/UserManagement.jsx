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
        phone_number: '',
        telegram_id: '',
        salary_mode: 'sales_percent',
        salary_percent: 5.0,
        payment_stage1_percent: 50.0,
        payment_stage2_percent: 50.0,
        // Manager permissions
        can_see_constructor_pay: true,
        can_see_stage1: true,
        can_see_stage2: true,
        can_see_debt: true,
        can_see_dashboard: true
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
        setFormData({
            username: '',
            password: '',
            full_name: '',
            role: 'constructor',
            card_number: '',
            email: '',
            phone_number: '',
            telegram_id: '',
            salary_mode: 'sales_percent',
            salary_percent: 5.0,
            payment_stage1_percent: 50.0,
            payment_stage2_percent: 50.0,
            // Manager permissions
            can_see_constructor_pay: true,
            can_see_stage1: true,
            can_see_stage2: true,
            can_see_debt: true,
            can_see_dashboard: true
        });
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
            phone_number: u.phone_number || '',
            telegram_id: u.telegram_id || '',
            salary_mode: u.salary_mode || 'sales_percent',
            salary_percent: u.salary_percent !== undefined ? u.salary_percent : 5.0,
            payment_stage1_percent: u.payment_stage1_percent !== undefined ? u.payment_stage1_percent : 50.0,
            payment_stage2_percent: u.payment_stage2_percent !== undefined ? u.payment_stage2_percent : 50.0,
            // Manager permissions
            can_see_constructor_pay: u.can_see_constructor_pay !== undefined ? u.can_see_constructor_pay : true,
            can_see_stage1: u.can_see_stage1 !== undefined ? u.can_see_stage1 : true,
            can_see_stage2: u.can_see_stage2 !== undefined ? u.can_see_stage2 : true,
            can_see_debt: u.can_see_debt !== undefined ? u.can_see_debt : true,
            can_see_dashboard: u.can_see_dashboard !== undefined ? u.can_see_dashboard : true
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

    if (user.role !== 'admin' && user.role !== 'super_admin') {
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
                                    <option value="super_admin">Супер-Адміністратор 🌟</option>
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


                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Telegram ID</label>
                                <input
                                    type="text"
                                    value={formData.telegram_id}
                                    onChange={e => setFormData({ ...formData, telegram_id: e.target.value })}
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm font-bold focus:outline-none focus:border-blue-500"
                                    placeholder="123456789"
                                />
                                <p className="text-[10px] text-slate-400 mt-1">* Можна дізнатися у бота @userinfobot</p>
                            </div>

                            {/* Salary Configuration */}
                            <div className="col-span-2 bg-gradient-to-br from-green-50 to-blue-50 p-4 rounded-2xl border-2 border-green-100">
                                <h3 className="text-sm font-black text-green-700 uppercase mb-3 flex items-center gap-2">
                                    <span>💰</span> Конфігурація виплат
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Спосіб розрахунку</label>
                                        <select
                                            value={formData.salary_mode}
                                            onChange={e => setFormData({ ...formData, salary_mode: e.target.value })}
                                            className="w-full p-3 bg-white border-2 border-green-200 rounded-xl font-bold text-sm text-slate-700 focus:outline-none focus:border-green-500"
                                        >
                                            <option value="sales_percent">💵 Від ціни продажу</option>
                                            <option value="materials_percent">🧱 Від вартості матеріалів</option>
                                            <option value="fixed_amount">💰 Фіксована ціна</option>
                                        </select>
                                    </div>
                                    {formData.salary_mode !== 'fixed_amount' && (
                                        <div>
                                            <label className="block text-xs font-bold text-slate-600 uppercase mb-2">
                                                Відсоток (%)
                                            </label>
                                            <input
                                                type="number"
                                                step="0.1"
                                                min="0"
                                                max="100"
                                                value={formData.salary_percent}
                                                onChange={e => setFormData({ ...formData, salary_percent: parseFloat(e.target.value) || 0 })}
                                                className="w-full p-3 bg-white border-2 border-green-200 rounded-xl font-bold text-lg text-green-700 focus:outline-none focus:border-green-500"
                                                placeholder="5.0"
                                            />
                                        </div>
                                    )}
                                </div>
                                <p className="text-[10px] text-slate-500 mt-2 italic">
                                    💡 {
                                        formData.salary_mode === 'fixed_amount'
                                            ? 'Конструктор завжди отримує фіксовану суму в залежності від замовлення'
                                            : `Зарплата = ${formData.salary_mode === 'materials_percent' ? 'Вартість матеріалів' : 'Ціна продажу'} × ${formData.salary_percent}%`
                                    }
                                </p>

                                {/* Stage Distribution */}
                                <div className="mt-4 pt-4 border-t border-green-200">
                                    <label className="block text-xs font-bold text-slate-600 uppercase mb-3">📊 Розподіл по етапах</label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] text-slate-500 uppercase">Етап I (Конструктив)</label>
                                            <input
                                                type="number"
                                                step="1"
                                                min="0"
                                                max="100"
                                                value={formData.payment_stage1_percent}
                                                onChange={e => setFormData({ ...formData, payment_stage1_percent: parseFloat(e.target.value) || 0 })}
                                                className="w-full p-2 bg-white border-2 border-green-200 rounded-xl font-bold text-green-700 focus:outline-none focus:border-green-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-slate-500 uppercase">Етап II (Монтаж)</label>
                                            <input
                                                type="number"
                                                step="1"
                                                min="0"
                                                max="100"
                                                value={formData.payment_stage2_percent}
                                                onChange={e => setFormData({ ...formData, payment_stage2_percent: parseFloat(e.target.value) || 0 })}
                                                className="w-full p-2 bg-white border-2 border-green-200 rounded-xl font-bold text-green-700 focus:outline-none focus:border-green-500"
                                            />
                                        </div>
                                    </div>
                                    <p className={`text-xs font-bold mt-2 ${Math.abs((formData.payment_stage1_percent + formData.payment_stage2_percent) - 100) < 0.01
                                        ? 'text-green-600'
                                        : 'text-red-600'
                                        }`}>
                                        {formData.payment_stage1_percent}% + {formData.payment_stage2_percent}% = {formData.payment_stage1_percent + formData.payment_stage2_percent}%
                                        {Math.abs((formData.payment_stage1_percent + formData.payment_stage2_percent) - 100) < 0.01 ? ' ✓' : ' ⚠️ Має дорівнювати 100%!'}
                                    </p>
                                </div>
                            </div>

                            {/* Manager Permissions Section */}
                            {formData.role === 'manager' && (
                                <div className="col-span-2 bg-gradient-to-br from-purple-50 to-pink-50 p-4 rounded-2xl border-2 border-purple-100">
                                    <h3 className="text-sm font-black text-purple-700 uppercase mb-3 flex items-center gap-2">
                                        <span>🔒</span> Права доступу менеджера
                                    </h3>
                                    <div className="space-y-2">
                                        <label className="flex items-center gap-3 p-2 bg-white rounded-xl border border-purple-100 hover:border-purple-300 transition cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={formData.can_see_constructor_pay}
                                                onChange={(e) => setFormData({ ...formData, can_see_constructor_pay: e.target.checked })}
                                                className="w-5 h-5 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                                            />
                                            <span className="text-sm font-bold text-slate-700">Бачити "Конструкторська робота"</span>
                                        </label>

                                        <label className="flex items-center gap-3 p-2 bg-white rounded-xl border border-purple-100 hover:border-purple-300 transition cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={formData.can_see_stage1}
                                                onChange={(e) => setFormData({ ...formData, can_see_stage1: e.target.checked })}
                                                className="w-5 h-5 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                                            />
                                            <span className="text-sm font-bold text-slate-700">Бачити "Етап I: Конструктив"</span>
                                        </label>

                                        <label className="flex items-center gap-3 p-2 bg-white rounded-xl border border-purple-100 hover:border-purple-300 transition cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={formData.can_see_stage2}
                                                onChange={(e) => setFormData({ ...formData, can_see_stage2: e.target.checked })}
                                                className="w-5 h-5 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                                            />
                                            <span className="text-sm font-bold text-slate-700">Бачити "Етап II: Монтаж"</span>
                                        </label>

                                        <label className="flex items-center gap-3 p-2 bg-white rounded-xl border border-purple-100 hover:border-purple-300 transition cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={formData.can_see_debt}
                                                onChange={(e) => setFormData({ ...formData, can_see_debt: e.target.checked })}
                                                className="w-5 h-5 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                                            />
                                            <span className="text-sm font-bold text-slate-700">Бачити "Борг/Залишок"</span>
                                        </label>

                                        <label className="flex items-center gap-3 p-2 bg-white rounded-xl border border-purple-100 hover:border-purple-300 transition cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={formData.can_see_dashboard}
                                                onChange={(e) => setFormData({ ...formData, can_see_dashboard: e.target.checked })}
                                                className="w-5 h-5 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                                            />
                                            <span className="text-sm font-bold text-slate-700">Бачити дашборди (верхні плашки)</span>
                                        </label>
                                    </div>
                                    <p className="text-[10px] text-slate-500 mt-2 italic">
                                        💡 Ці налаштування дозволяють контролювати, які колонки та інформацію бачить цей менеджер
                                    </p>
                                </div>
                            )}

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
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${u.role === 'super_admin' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                                                        u.role === 'admin' ? 'bg-purple-100 text-purple-600' :
                                                        u.role === 'manager' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'
                                                        }`}>
                                                        {u.role === 'super_admin' ? 'Супер-Адмін' : u.role === 'admin' ? 'Адмін' : u.role === 'manager' ? 'Менеджер' : 'Конструктор'}
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

                                                    {u.telegram_id && (
                                                        <span className="flex items-center gap-2">
                                                            <i className="fab fa-telegram text-blue-400"></i>
                                                            <span className="font-mono text-xs text-blue-600 bg-blue-50 px-1 rounded">
                                                                ID: {u.telegram_id}
                                                            </span>
                                                        </span>
                                                    )}

                                                    {/* Salary Terms Display */}
                                                    {(u.role === 'constructor' || u.role === 'manager') && (
                                                        <div className="mt-2 p-2 bg-white rounded-xl border border-slate-100 flex items-center gap-2 text-[11px] font-bold">
                                                            <span className="text-slate-400 uppercase tracking-tighter">Умови:</span>
                                                            <span className="text-green-600 flex items-center gap-1">
                                                                {u.salary_mode === 'sales_percent' && <>💵 {u.salary_percent}% від продажу</>}
                                                                {u.salary_mode === 'materials_percent' && <>🧱 {u.salary_percent}% від матеріалів</>}
                                                                {u.salary_mode === 'fixed_amount' && <>💰 Фіксована ціна</>}
                                                            </span>
                                                            <span className="text-slate-300 mx-1">|</span>
                                                            <span className="text-blue-500">
                                                                📊 {u.payment_stage1_percent}% / {u.payment_stage2_percent}%
                                                            </span>
                                                        </div>
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
