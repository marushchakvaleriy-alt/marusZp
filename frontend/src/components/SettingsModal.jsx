import React, { useState, useEffect } from 'react';
import { getSettings, updateSettings } from '../api';
import TelegramInstructionsModal from './TelegramInstructionsModal';
import { useAuth } from '../context/AuthContext';

const SettingsModal = ({ onClose }) => {
    const { user } = useAuth();
    const isSuperAdmin = user?.role === 'super_admin';
    const [path, setPath] = useState('');
    const [telegramToken, setTelegramToken] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showInstructions, setShowInstructions] = useState(false);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            setLoading(true);
            const data = await getSettings();
            setPath(data.storage_path);
            setTelegramToken(data.telegram_bot_token || '');
        } catch (error) {
            console.error("Failed to load settings:", error);
            alert("Помилка завантаження налаштувань");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            setSaving(true);
            await updateSettings({
                storage_path: path,
                telegram_bot_token: telegramToken
            });
            alert("Налаштування збережено! ✅");
            onClose();
        } catch (error) {
            console.error("Failed to save settings:", error);
            alert("Помилка збереження: " + error.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">

            {showInstructions && <TelegramInstructionsModal onClose={() => setShowInstructions(false)} />}

            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
                    <h2 className="text-xl font-black uppercase italic tracking-wider flex items-center gap-2">
                        <i className="fas fa-cog"></i> Налаштування системи
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition">
                        <i className="fas fa-times text-xl"></i>
                    </button>
                </div>

                <div className="p-8 overflow-y-auto">
                    {loading ? (
                        <p className="text-center text-slate-400 font-bold uppercase animate-pulse">Завантаження...</p>
                    ) : (
                        <form onSubmit={handleSave} className="space-y-6">
                            {/* File Storage Section */}
                            <div>
                                <h4 className="font-bold text-slate-700 mb-3 border-b pb-1">📂 Сховище Файлів</h4>
                                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-4">
                                    <p className="text-sm text-blue-700">
                                        Вкажіть шлях до папки, де будуть зберігатися всі файли проєктів.
                                    </p>
                                </div>
                                <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Шлях до теки</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-3 text-slate-400">📂</span>
                                    <input
                                        type="text"
                                        value={path}
                                        onChange={(e) => setPath(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="C:\TechPay_Projects"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Database Backup Section */}
                            <div>
                                <h4 className="font-bold text-slate-700 mb-3 border-b pb-1">💾 Резервна копія</h4>
                                <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 mb-4">
                                    <p className="text-sm text-amber-700 mb-2">
                                        Ви можете завантажити повну копію бази даних у форматі JSON.
                                        Це корисно для збереження історії або перенесення даних.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            // Direct download link using configured API URL
                                            const token = localStorage.getItem('token');
                                            // Get base URL from axios instance or env
                                            // api.defaults.baseURL might be undefined if set via create() config object only in some axios versions, 
                                            // but we can import 'api' and use it.
                                            // However, for fetch we need the string. 
                                            // Let's rely on the same logic as api.js:
                                            const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';

                                            fetch(`${baseUrl}/admin/backup`, {
                                                headers: {
                                                    'Authorization': `Bearer ${token}`
                                                }
                                            })
                                                .then(response => {
                                                    if (!response.ok) throw new Error("Network response was not ok");
                                                    return response.blob();
                                                })
                                                .then(blob => {
                                                    const url = window.URL.createObjectURL(blob);
                                                    const a = document.createElement('a');
                                                    a.href = url;
                                                    a.download = `backup_${new Date().toISOString().slice(0, 10)}.json`;
                                                    document.body.appendChild(a);
                                                    a.click();
                                                    window.URL.revokeObjectURL(url);
                                                })
                                                .catch(err => alert("Помилка завантаження: " + err.message));
                                        }}
                                        className="w-full py-2 bg-white border border-amber-300 text-amber-700 font-bold rounded-lg hover:bg-amber-100 transition flex items-center justify-center gap-2 text-xs uppercase"
                                    >
                                        <span className="text-lg">📥</span> Скачати базу даних (JSON)
                                    </button>

                                    <div className="mt-4 pt-4 border-t border-amber-200">
                                        <p className="text-sm text-red-600 font-bold mb-2">♨️ Відновлення (Імпорт)</p>
                                        <p className="text-xs text-slate-500 mb-2">
                                            Це повністю <u>ВИДАЛИТЬ</u> поточні дані і замінить їх даними з файлу.
                                        </p>
                                        {isSuperAdmin ? (
                                            <label className="w-full py-2 bg-red-50 border border-red-300 text-red-700 font-bold rounded-lg hover:bg-red-100 transition flex items-center justify-center gap-2 text-xs uppercase cursor-pointer">
                                                <span className="text-lg">♻️</span> Завантажити Backup файл
                                                <input
                                                    type="file"
                                                    accept=".json"
                                                    className="hidden"
                                                    onChange={async (e) => {
                                                        const file = e.target.files[0];
                                                        if (!file) return;

                                                        if (!confirm("⚠️ УВАГА! Всі поточні дані буде видалено і замінено даними з файлу.\n\nВи впевнені?")) return;

                                                        const formData = new FormData();
                                                        formData.append('file', file);

                                                        try {
                                                            const token = localStorage.getItem('token');
                                                            const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';

                                                            const res = await fetch(`${baseUrl}/admin/restore`, {
                                                                method: 'POST',
                                                                headers: {
                                                                    'Authorization': `Bearer ${token}`
                                                                },
                                                                body: formData
                                                            });

                                                            if (!res.ok) {
                                                                const err = await res.json();
                                                                throw new Error(err.detail || "Upload failed");
                                                            }

                                                            alert("Базу даних успішно відновлено! 🔄\nСторінка буде перезавантажена.");
                                                            window.location.reload();

                                                        } catch (err) {
                                                            alert("Помилка відновлення: " + err.message);
                                                            console.error(err);
                                                        }
                                                    }}
                                                />
                                            </label>
                                        ) : (
                                            <div className="w-full py-2 px-3 bg-slate-100 border border-slate-200 text-slate-500 font-bold rounded-lg text-xs uppercase text-center">
                                                Доступно лише для Супер-Адміністратора
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Telegram Bot Section */}
                            <div>
                                <div className="flex items-center justify-between mb-3 border-b pb-1">
                                    <h4 className="font-bold text-slate-700 flex items-center gap-2">
                                        <span className="text-blue-500">🤖</span> Telegram Бот
                                    </h4>
                                    <button
                                        type="button"
                                        onClick={() => setShowInstructions(true)}
                                        className="text-xs bg-blue-100 text-blue-600 px-3 py-1 rounded-lg font-bold hover:bg-blue-200 transition flex items-center gap-2"
                                    >
                                        <i className="far fa-question-circle"></i> ЯК НАЛАШТУВАТИ?
                                    </button>
                                </div>

                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4 text-sm text-slate-600">
                                    <p className="mb-2">Щоб активувати сповіщення, вставте Token бота нижче.</p>
                                    <p className="text-xs text-slate-500">
                                        Натисніть кнопку "ЯК НАЛАШТУВАТИ" зверху, щоб отримати детальну покрокову інструкцію.
                                    </p>
                                </div>

                                <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Bot Token</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-3 text-slate-400">🔑</span>
                                    <input
                                        type="password"
                                        value={telegramToken}
                                        onChange={(e) => setTelegramToken(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="123456789:ABCdefGHIjklMNOpqrs..."
                                    />
                                </div>
                                <p className="text-[10px] text-slate-400 font-bold mt-2">
                                    * Залиште поле пустим, щоб вимкнути інтеграцію.
                                </p>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition uppercase text-xs tracking-wider"
                                >
                                    Скасувати
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition uppercase text-xs tracking-wider flex items-center justify-center gap-2"
                                >
                                    {saving ? 'Збереження...' : <>💾 Зберегти</>}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
