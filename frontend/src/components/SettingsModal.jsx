import React, { useState, useEffect } from 'react';
import { getSettings, updateSettings } from '../api';
import TelegramInstructionsModal from './TelegramInstructionsModal';

const SettingsModal = ({ onClose }) => {
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
