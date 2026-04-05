import React, { useMemo } from 'react';

const DAY_MS = 24 * 60 * 60 * 1000;

const parseDate = (value) => {
    if (!value) return null;
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
};

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const addDays = (date, days) => new Date(date.getTime() + days * DAY_MS);
const diffDays = (a, b) => Math.round((b.getTime() - a.getTime()) / DAY_MS);
const fmt = (date) => date.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' });
const fmtShort = (date) => date.toLocaleDateString('uk-UA', { day: '2-digit', month: 'short' });

const clampDays = (value, fallback) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(1, Math.min(60, Math.round(parsed)));
};

const normalizeRange = (start, end) => {
    if (!start || !end) return [null, null];
    if (start <= end) return [start, end];
    return [end, start];
};

const buildForwardStages = (start, days) => {
    const constructiveStart = start;
    const constructiveEnd = addDays(constructiveStart, days.constructive - 1);
    const complectationStart = addDays(constructiveEnd, 1);
    const complectationEnd = addDays(complectationStart, days.complectation - 1);
    const preassemblyStart = addDays(complectationEnd, 1);
    const preassemblyEnd = addDays(preassemblyStart, days.preassembly - 1);
    const installationStart = addDays(preassemblyEnd, 1);
    const installationEnd = addDays(installationStart, days.installation - 1);

    return {
        constructiveStart,
        constructiveEnd,
        complectationStart,
        complectationEnd,
        preassemblyStart,
        preassemblyEnd,
        installationStart,
        installationEnd,
    };
};

const buildBackwardStages = (installationStart, days) => {
    const installationEnd = addDays(installationStart, days.installation - 1);
    const preassemblyEnd = addDays(installationStart, -1);
    const preassemblyStart = addDays(preassemblyEnd, -(days.preassembly - 1));
    const complectationEnd = addDays(preassemblyStart, -1);
    const complectationStart = addDays(complectationEnd, -(days.complectation - 1));
    const constructiveEnd = addDays(complectationStart, -1);
    const constructiveStart = addDays(constructiveEnd, -(days.constructive - 1));

    return {
        constructiveStart,
        constructiveEnd,
        complectationStart,
        complectationEnd,
        preassemblyStart,
        preassemblyEnd,
        installationStart,
        installationEnd,
    };
};

const GanttView = ({ orders, onSelectOrder, canManage, onPlanUpdate }) => {
    const prepared = useMemo(() => {
        return orders.map((order) => {
            const dateReceived = parseDate(order.date_received);
            const dateToWork = parseDate(order.date_to_work);
            const dateDesignDeadline = parseDate(order.date_design_deadline);
            const dateInstallPlan = parseDate(order.date_installation_plan);
            const dateInstallDone = parseDate(order.date_installation);

            const days = {
                constructive: clampDays(order.constructive_days, 5),
                complectation: clampDays(order.complectation_days, 2),
                preassembly: clampDays(order.preassembly_days, 1),
                installation: clampDays(order.installation_days, 3),
            };

            const stages = dateInstallPlan
                ? buildBackwardStages(dateInstallPlan, days)
                : buildForwardStages(dateToWork || dateReceived || startOfDay(new Date()), days);

            const points = [
                dateReceived,
                dateToWork,
                dateDesignDeadline,
                dateInstallPlan,
                dateInstallDone,
                stages.constructiveStart,
                stages.constructiveEnd,
                stages.complectationStart,
                stages.complectationEnd,
                stages.preassemblyStart,
                stages.preassemblyEnd,
                stages.installationStart,
                stages.installationEnd,
            ].filter(Boolean);

            return {
                order,
                ...days,
                dateReceived,
                dateToWork,
                dateDesignDeadline,
                dateInstallPlan,
                dateInstallDone,
                ...stages,
                minDate: points.length ? new Date(Math.min(...points.map((d) => d.getTime()))) : null,
                maxDate: points.length ? new Date(Math.max(...points.map((d) => d.getTime()))) : null,
            };
        });
    }, [orders]);

    const timeline = useMemo(() => {
        const minDates = prepared.map((p) => p.minDate).filter(Boolean);
        const maxDates = prepared.map((p) => p.maxDate).filter(Boolean);
        const today = startOfDay(new Date());

        if (!minDates.length || !maxDates.length) {
            return {
                start: addDays(today, -14),
                end: addDays(today, 30),
            };
        }

        const minDate = new Date(Math.min(...minDates.map((d) => d.getTime())));
        const maxDate = new Date(Math.max(...maxDates.map((d) => d.getTime())));
        return {
            start: addDays(startOfDay(minDate), -5),
            end: addDays(startOfDay(maxDate), 12),
        };
    }, [prepared]);

    const totalDays = Math.max(1, diffDays(timeline.start, timeline.end) + 1);
    const todayOffset = Math.min(100, Math.max(0, (diffDays(timeline.start, startOfDay(new Date())) / totalDays) * 100));

    const monthTicks = useMemo(() => {
        const ticks = [];
        let cursor = new Date(timeline.start.getFullYear(), timeline.start.getMonth(), 1);
        if (cursor < timeline.start) {
            cursor = new Date(timeline.start.getFullYear(), timeline.start.getMonth() + 1, 1);
        }
        while (cursor <= timeline.end) {
            ticks.push(new Date(cursor));
            cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
        }
        return ticks;
    }, [timeline.end, timeline.start]);

    const segmentStyle = (start, end) => {
        const [normStart, normEnd] = normalizeRange(start, end);
        if (!normStart || !normEnd) return null;

        const left = (diffDays(timeline.start, normStart) / totalDays) * 100;
        const width = ((diffDays(normStart, normEnd) + 1) / totalDays) * 100;

        return {
            left: `${Math.max(0, Math.min(100, left))}%`,
            width: `${Math.max(0.35, Math.min(100, width))}%`,
        };
    };

    const pointStyle = (date) => {
        if (!date) return null;
        const left = (diffDays(timeline.start, date) / totalDays) * 100;
        return { left: `${Math.max(0, Math.min(100, left))}%` };
    };

    return (
        <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-xl overflow-hidden border border-white/20">
            <div className="p-4 border-b border-slate-200/40 bg-white/60">
                <h2 className="text-lg font-black text-slate-800 uppercase italic">Планування Gantt</h2>
                <p className="text-xs text-slate-500 mt-1">
                    Повний цикл: конструктив, комплектація, предзбірка, монтаж.
                </p>
            </div>

            <div className="overflow-x-auto">
                <div className="min-w-[1120px]">
                    <div className="grid grid-cols-[360px_1fr] border-b border-slate-200/40 bg-slate-50/70">
                        <div className="p-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Замовлення / Етапи</div>
                        <div className="relative p-3 h-14">
                            <div className="absolute inset-0 pointer-events-none">
                                {monthTicks.map((tick) => (
                                    <div
                                        key={`tick-${tick.toISOString()}`}
                                        className="absolute top-0 bottom-0 border-l border-dashed border-slate-300/70"
                                        style={{ left: `${(diffDays(timeline.start, tick) / totalDays) * 100}%` }}
                                    />
                                ))}
                            </div>
                            <div className="relative h-full">
                                {monthTicks.map((tick) => (
                                    <span
                                        key={`label-${tick.toISOString()}`}
                                        className="absolute top-1 text-[10px] font-bold text-slate-500 uppercase"
                                        style={{ left: `${(diffDays(timeline.start, tick) / totalDays) * 100}%` }}
                                    >
                                        {tick.toLocaleDateString('uk-UA', { month: 'short' })}
                                    </span>
                                ))}
                                <span className="absolute bottom-0 right-2 text-[10px] font-bold text-slate-400">
                                    {fmtShort(timeline.start)} - {fmtShort(timeline.end)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {prepared.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 italic">Немає замовлень для Gantt-плану</div>
                    ) : (
                        prepared.map((item) => {
                            const constructiveSeg = segmentStyle(item.constructiveStart, item.constructiveEnd);
                            const complectationSeg = segmentStyle(item.complectationStart, item.complectationEnd);
                            const preassemblySeg = segmentStyle(item.preassemblyStart, item.preassemblyEnd);
                            const installationSeg = segmentStyle(item.installationStart, item.installationEnd);
                            const workPoint = pointStyle(item.dateToWork);
                            const deadlinePoint = pointStyle(item.dateDesignDeadline);
                            const installDonePoint = pointStyle(item.dateInstallDone);
                            const planInstallPoint = pointStyle(item.dateInstallPlan);
                            const isOverdue = item.dateDesignDeadline && !item.dateToWork && item.dateDesignDeadline < startOfDay(new Date());

                            const handleDaysBlur = (field, fallback) => (e) => {
                                if (!canManage) return;
                                const parsed = clampDays(e.target.value, fallback);
                                e.target.value = String(parsed);
                                if (parsed !== Number(item.order[field] || fallback)) {
                                    onPlanUpdate(item.order.id, { [field]: parsed });
                                }
                            };

                            return (
                                <div key={item.order.id} className="grid grid-cols-[360px_1fr] border-b border-slate-200/30 hover:bg-white/40 transition">
                                    <div className="p-3">
                                        <button
                                            onClick={() => onSelectOrder(item.order)}
                                            className="text-left w-full group"
                                            title="Відкрити замовлення"
                                        >
                                            <div className="font-black text-slate-800 group-hover:text-blue-600 transition">
                                                #{item.order.id} {item.order.name}
                                            </div>
                                            <div className="text-[11px] mt-1 text-slate-500">
                                                Дедлайн: {item.dateDesignDeadline ? fmt(item.dateDesignDeadline) : "--.--"}
                                                {isOverdue ? <span className="ml-1 text-red-600 font-bold">прострочено</span> : null}
                                            </div>
                                        </button>

                                        <div className="mt-2 grid grid-cols-2 gap-2">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase">
                                                План монтажу
                                                <input
                                                    type="date"
                                                    className="mt-1 w-full text-xs p-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-700 disabled:bg-slate-100"
                                                    disabled={!canManage}
                                                    value={item.order.date_installation_plan || ''}
                                                    onChange={(e) => {
                                                        if (!canManage) return;
                                                        onPlanUpdate(item.order.id, { date_installation_plan: e.target.value || null });
                                                    }}
                                                />
                                            </label>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase">
                                                Конструктив
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="60"
                                                    className="mt-1 w-full text-xs p-1.5 bg-white border border-blue-200 rounded-lg font-bold text-slate-700 disabled:bg-slate-100"
                                                    disabled={!canManage}
                                                    defaultValue={item.constructive}
                                                    onBlur={handleDaysBlur("constructive_days", 5)}
                                                />
                                            </label>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase">
                                                Комплектація
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="60"
                                                    className="mt-1 w-full text-xs p-1.5 bg-white border border-amber-200 rounded-lg font-bold text-slate-700 disabled:bg-slate-100"
                                                    disabled={!canManage}
                                                    defaultValue={item.complectation}
                                                    onBlur={handleDaysBlur("complectation_days", 2)}
                                                />
                                            </label>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase">
                                                Предзбірка / Монтаж
                                                <div className="mt-1 grid grid-cols-2 gap-1">
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max="60"
                                                        className="w-full text-xs p-1.5 bg-white border border-violet-200 rounded-lg font-bold text-slate-700 disabled:bg-slate-100"
                                                        disabled={!canManage}
                                                        defaultValue={item.preassembly}
                                                        onBlur={handleDaysBlur("preassembly_days", 1)}
                                                        title="Предзбірка"
                                                    />
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max="60"
                                                        className="w-full text-xs p-1.5 bg-white border border-emerald-200 rounded-lg font-bold text-slate-700 disabled:bg-slate-100"
                                                        disabled={!canManage}
                                                        defaultValue={item.installation}
                                                        onBlur={handleDaysBlur("installation_days", 3)}
                                                        title="Монтаж"
                                                    />
                                                </div>
                                            </label>
                                        </div>
                                    </div>

                                    <div className="relative p-3 h-[118px]">
                                        <div className="absolute inset-y-2 left-3 right-3 rounded-xl bg-gradient-to-r from-slate-100/80 to-slate-50/80 border border-slate-200/50" />

                                        <div
                                            className="absolute top-2 bottom-2 w-[2px] bg-red-400/80 z-20"
                                            style={{ left: `calc(${todayOffset}% + 12px)` }}
                                            title="Сьогодні"
                                        />

                                        {constructiveSeg && (
                                            <div
                                                className="absolute top-[28px] h-2 rounded-full bg-blue-500/85 z-10"
                                                style={{
                                                    left: `calc(${constructiveSeg.left} + 12px)`,
                                                    width: `calc(${constructiveSeg.width} - 2px)`,
                                                }}
                                                title={`Конструктив (${item.constructive} дн.)`}
                                            />
                                        )}

                                        {complectationSeg && (
                                            <div
                                                className="absolute top-[42px] h-2 rounded-full bg-amber-500/85 z-10"
                                                style={{
                                                    left: `calc(${complectationSeg.left} + 12px)`,
                                                    width: `calc(${complectationSeg.width} - 2px)`,
                                                }}
                                                title={`Комплектація (${item.complectation} дн.)`}
                                            />
                                        )}

                                        {preassemblySeg && (
                                            <div
                                                className="absolute top-[56px] h-2 rounded-full bg-violet-500/85 z-10"
                                                style={{
                                                    left: `calc(${preassemblySeg.left} + 12px)`,
                                                    width: `calc(${preassemblySeg.width} - 2px)`,
                                                }}
                                                title={`Предзбірка (${item.preassembly} дн.)`}
                                            />
                                        )}

                                        {installationSeg && (
                                            <div
                                                className="absolute top-[70px] h-2 rounded-full bg-emerald-500/85 z-10"
                                                style={{
                                                    left: `calc(${installationSeg.left} + 12px)`,
                                                    width: `calc(${installationSeg.width} - 2px)`,
                                                }}
                                                title={`Монтаж (${item.installation} дн.)`}
                                            />
                                        )}

                                        {workPoint && (
                                            <div
                                                className="absolute top-4 w-2.5 h-2.5 rounded-full bg-indigo-700 z-20"
                                                style={{ left: `calc(${workPoint.left} + 12px - 4px)` }}
                                                title="Передано в роботу"
                                            />
                                        )}

                                        {deadlinePoint && (
                                            <div
                                                className="absolute top-4 w-2.5 h-2.5 rounded-full bg-red-600 z-20"
                                                style={{ left: `calc(${deadlinePoint.left} + 12px - 4px)` }}
                                                title="Дедлайн конструктиву"
                                            />
                                        )}

                                        {planInstallPoint && (
                                            <div
                                                className="absolute top-[66px] w-2.5 h-2.5 rounded-full bg-emerald-700 z-20"
                                                style={{ left: `calc(${planInstallPoint.left} + 12px - 4px)` }}
                                                title="План старту монтажу"
                                            />
                                        )}

                                        {installDonePoint && (
                                            <div
                                                className="absolute top-[84px] w-2.5 h-2.5 rounded-full bg-emerald-900 z-20"
                                                style={{ left: `calc(${installDonePoint.left} + 12px - 4px)` }}
                                                title="Факт монтажу"
                                            />
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            <div className="p-3 bg-white/70 border-t border-slate-200/40 text-[11px] font-bold text-slate-500 flex flex-wrap gap-x-4 gap-y-1">
                <span><span className="inline-block w-2 h-2 rounded-full bg-indigo-700 mr-1" />Передано в роботу</span>
                <span><span className="inline-block w-2 h-2 rounded-full bg-red-600 mr-1" />Дедлайн конструктиву</span>
                <span><span className="inline-block w-3 h-3 rounded-full bg-blue-500/85 mr-1 align-middle" />Конструктив</span>
                <span><span className="inline-block w-3 h-3 rounded-full bg-amber-500/85 mr-1 align-middle" />Комплектація</span>
                <span><span className="inline-block w-3 h-3 rounded-full bg-violet-500/85 mr-1 align-middle" />Предзбірка</span>
                <span><span className="inline-block w-3 h-3 rounded-full bg-emerald-500/85 mr-1 align-middle" />Монтаж</span>
                <span><span className="inline-block w-2 h-2 rounded-full bg-emerald-900 mr-1" />Факт монтажу</span>
            </div>
        </div>
    );
};

export default GanttView;
