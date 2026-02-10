import React, { useState } from 'react';

const CalendarView = ({ orders, onSelectOrder }) => {
    const [currentDate, setCurrentDate] = useState(new Date());

    // Helper to get days in month
    const getDaysInMonth = (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const days = new Date(year, month + 1, 0).getDate();
        const firstDay = new Date(year, month, 1).getDay(); // 0 = Sun, 1 = Mon

        // Adjust for Monday start (UA standard)
        // JS: 0=Sun, 1=Mon... 6=Sat
        // UA: 0=Mon... 6=Sun
        const startOffset = firstDay === 0 ? 6 : firstDay - 1;

        return { days, startOffset, year, month };
    };

    const { days, startOffset, year, month } = getDaysInMonth(currentDate);

    const monthNames = [
        'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
        'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'
    ];

    const prevMonth = () => {
        setCurrentDate(new Date(year, month - 1, 1));
    };

    const nextMonth = () => {
        setCurrentDate(new Date(year, month + 1, 1));
    };

    const isToday = (day) => {
        const today = new Date();
        return day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
    };

    // Filter events for the current month view
    const getEventsForDay = (day) => {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        const dayEvents = [];

        orders.forEach(order => {
            // Deadline (Red) w/ Check for valid date
            if (order.date_design_deadline === dateStr) {
                // Only show if not fully paid/done? Or always?
                // Always show deadlines.
                dayEvents.push({
                    type: 'deadline',
                    order,
                    label: `Дедлайн #${order.id}`
                });
            }

            // Installation (Green) - Actual/Constructor
            if (order.date_installation === dateStr) {
                dayEvents.push({
                    type: 'installation',
                    order,
                    label: `Монтаж #${order.id}`
                });
            }

            // Planned Installation (Purple) - Manager
            if (order.date_installation_plan === dateStr) {
                dayEvents.push({
                    type: 'plan',
                    order,
                    label: `План #${order.id}`
                });
            }
        });

        return dayEvents;
    };

    return (
        <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 p-6 overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <button onClick={prevMonth} className="px-4 py-2 bg-slate-100 rounded-xl hover:bg-slate-200 font-bold text-slate-600 transition">
                    ←
                </button>
                <h2 className="text-2xl font-black text-slate-800 uppercase italic">
                    {monthNames[month]} <span className="text-blue-600">{year}</span>
                </h2>
                <button onClick={nextMonth} className="px-4 py-2 bg-slate-100 rounded-xl hover:bg-slate-200 font-bold text-slate-600 transition">
                    →
                </button>
            </div>

            {/* Grid Header (Days) */}
            <div className="grid grid-cols-7 gap-2 mb-2 text-center">
                {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'].map(d => (
                    <div key={d} className="text-xs font-bold text-slate-400 uppercase tracking-wider">{d}</div>
                ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-2 auto-rows-fr">
                {/* Empty cells for start offset */}
                {Array.from({ length: startOffset }).map((_, i) => (
                    <div key={`empty-${i}`} className="min-h-[100px] bg-slate-50/50 rounded-xl border border-dashed border-slate-100"></div>
                ))}

                {/* Days */}
                {Array.from({ length: days }).map((_, i) => {
                    const day = i + 1;
                    const events = getEventsForDay(day);

                    return (
                        <div
                            key={day}
                            className={`min-h-[100px] p-2 rounded-xl border transition group relative
                                ${isToday(day) ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-100' : 'bg-white border-slate-100 hover:border-blue-200 hover:shadow-md'}
                            `}
                        >
                            <div className={`text-right text-sm font-bold mb-1 ${isToday(day) ? 'text-blue-600' : 'text-slate-400'}`}>
                                {day}
                            </div>

                            <div className="flex flex-col gap-1 overflow-y-auto max-h-[80px] scrollbar-thin">
                                {events.map((evt, idx) => (
                                    <div
                                        key={idx}
                                        onClick={() => onSelectOrder(evt.order)}
                                        className={`text-[10px] px-2 py-1 rounded cursor-pointer font-bold truncate transition hover:scale-105
                                            ${evt.type === 'deadline'
                                                ? 'bg-red-100 text-red-700 border border-red-200'
                                                : evt.type === 'plan'
                                                    ? 'bg-purple-100 text-purple-700 border border-purple-200'
                                                    : 'bg-emerald-100 text-emerald-700 border border-emerald-200'}
                                        `}
                                        title={`${evt.order.name} (${evt.type === 'deadline' ? 'Дедлайн' : evt.type === 'plan' ? 'План. монтаж' : 'Монтаж'})`}
                                    >
                                        {evt.type === 'deadline' ? '⏰' : evt.type === 'plan' ? '📅' : '🛠'} #{evt.order.id} {evt.order.name}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="mt-4 flex gap-4 text-xs font-bold text-slate-500 cursor-default">
                <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-400"></span> Дедлайн (Конструктив)</div>
                <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-purple-400"></span> План монтажу (Менеджер)</div>
                <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-emerald-400"></span> Здача монтажу</div>
            </div>
        </div>
    );
};

export default CalendarView;
