import React from 'react';

const TelegramInstructionsModal = ({ onClose }) => {
    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-6 bg-[#0088cc] text-white flex justify-between items-center shrink-0">
                    <h2 className="text-xl font-bold uppercase italic tracking-wider flex items-center gap-3">
                        <i className="fab fa-telegram text-2xl"></i>
                        <span>Інструкція: Налаштування Telegram</span>
                    </h2>
                    <button onClick={onClose} className="text-white/70 hover:text-white transition w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10">
                        <i className="fas fa-times text-xl"></i>
                    </button>
                </div>

                {/* Content */}
                <div className="p-8 overflow-y-auto space-y-8 text-slate-700">

                    {/* Step 1: Admin Setup */}
                    <section>
                        <h3 className="flex items-center gap-3 text-lg font-black text-slate-800 uppercase mb-4">
                            <span className="w-8 h-8 bg-slate-800 text-white rounded-lg flex items-center justify-center text-sm">1</span>
                            Налаштування для Адміністратора
                        </h3>
                        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3 text-sm">
                            <p className="font-bold">Щоб програма могла надсилати повідомлення, потрібно створити власного бота:</p>
                            <ol className="list-decimal list-inside space-y-2 ml-2 text-slate-600">
                                <li>Відкрийте Telegram і знайдіть <b>@BotFather</b> (він має синю галочку).</li>
                                <li>Напишіть йому команду <code className="bg-white px-2 py-0.5 rounded border border-slate-300">/newbot</code>.</li>
                                <li>Він попросить ім'я (наприклад: <i>My CRM Bot</i>).</li>
                                <li>Далі попросить <b>username</b> (має закінчуватись на 'bot', наприклад: <i>my_company_crm_bot</i>).</li>
                                <li>У відповідь ви отримаєте довгий код — це <b>Token</b>.</li>
                                <li>Скопіюйте цей Токен і вставте його у вікні "Налаштування системи" (у цій програмі).</li>
                            </ol>
                        </div>
                    </section>

                    {/* Step 2: User Setup */}
                    <section>
                        <h3 className="flex items-center gap-3 text-lg font-black text-slate-800 uppercase mb-4">
                            <span className="w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center text-sm">2</span>
                            Що робити Користувачу (Конструктору)
                        </h3>
                        <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100 space-y-4 text-sm">
                            <p className="font-bold text-blue-800">Кожен працівник має виконати 2 прості дії:</p>

                            <div className="flex gap-4 items-start">
                                <div className="w-6 h-6 rounded-full bg-blue-200 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">A</div>
                                <div>
                                    <p className="font-bold mb-1">Дізнатися свій ID</p>
                                    <p className="text-slate-600 mb-1">Треба знайти бота <b>@userinfobot</b> і натиснути "Start".</p>
                                    <p className="text-slate-600">Він надішле цифри (наприклад: <code>123456789</code>). Ці цифри треба передати Адміністратору.</p>
                                </div>
                            </div>

                            <div className="flex gap-4 items-start">
                                <div className="w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">B</div>
                                <div>
                                    <p className="font-bold mb-1 text-red-600">ОБОВ'ЯЗКОВО: Запустити Вашого бота</p>
                                    <p className="text-slate-600 mb-1">Користувач має знайти <b>ВАШОГО</b> бота (ім'я якого ви створили на кроці 1) і натиснути кнопку <b>"Start" (Розпочати)</b>.</p>
                                    <p className="text-slate-500 text-xs italic">
                                        * Без цього бот не матиме права писати користувачу, навіть якщо ми знаємо ID. Це правило Telegram для боротьби зі спамом.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>

                <div className="p-6 bg-slate-50 border-t border-slate-100 text-center">
                    <button
                        onClick={onClose}
                        className="px-8 py-3 bg-[#0088cc] text-white rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-600 active:scale-95 transition"
                    >
                        ЗРОЗУМІЛО, ДЯКУЮ!
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TelegramInstructionsModal;
