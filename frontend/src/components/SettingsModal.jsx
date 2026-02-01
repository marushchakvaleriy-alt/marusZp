import React, { useState, useEffect } from 'react';
import { getSettings, updateSettings } from '../api';

const SettingsModal = ({ onClose }) => {
    const [path, setPath] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            setLoading(true);
            const data = await getSettings();
            setPath(data.storage_path);
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
            await updateSettings({ storage_path: path });
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
                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-6">
                                <h4 className="font-bold text-blue-800 mb-2 flex items-center gap-2">
                                    <i className="fas fa-info-circle"></i> Як це працює
                                </h4>
                                <p className="text-sm text-blue-700">
                                    Вкажіть шлях до папки на цьому комп'ютері, де будуть зберігатися всі файли проєктів.
                                    Програма автоматично створюватиме там папки для кожного замовлення.
                                </p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 mb-2">
                                    Шлях до сховища файлів
                                </label>
                                <div className="relative">
                                    <i className="fas fa-folder absolute left-4 top-3 text-slate-400"></i>
                                    <input
                                        type="text"
                                        value={path}
                                        onChange={(e) => setPath(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="C:\TechPay_Projects"
                                        required
                                    />
                                </div>
                                <p className="text-[10px] text-slate-400 font-bold mt-2 uppercase">
                                    Приклад: D:\MyProjects або C:\Users\Admin\Documents\Projects
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
                                    {saving ? 'Збереження...' : <><i className="fas fa-save"></i> Зберегти</>}
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
