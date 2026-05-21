import React, { useMemo } from 'react';

const DAY_MS = 24 * 60 * 60 * 1000;
const LEFT_COLUMN_WIDTH = 350;
const MIN_DAY_WIDTH = 86;

const STAGE_META = {
    constructive: {
        label: 'Конструктив',
        color: '#58a6ff',
    },
    complectation: {
        label: 'Комплектація',
        color: '#f7b53a',
    },
    preassembly: {
        label: 'Предзбірка',
        color: '#9b7cf7',
    },
    installation: {
        label: 'Монтаж',
        color: '#37c49a',
    },
};

const parseDate = (value) => {
    if (!value) return null;
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
};

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const addDays = (date, days) => new Date(date.getTime() + days * DAY_MS);
const diffDays = (a, b) => Math.round((b.getTime() - a.getTime()) / DAY_MS);

const clampDays = (value, fallback) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(1, Math.min(60, Math.round(parsed)));
};

const formatDate = (date) => (
    date
        ? date.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' })
        : '--.--'
);

const formatHeaderDate = (date) => {
    const label = date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' });
    return label.charAt(0).toUpperCase() + label.slice(1);
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

const getRangeStyle = (timelineStart, totalDays, start, end) => {
    if (!start || !end) return null;
    const left = (diffDays(timelineStart, start) / totalDays) * 100;
    const width = ((diffDays(start, end) + 1) / totalDays) * 100;

    return {
        left: `${Math.max(0, Math.min(100, left))}%`,
        width: `${Math.max(1.25, Math.min(100, width))}%`,
    };
};

const getMarkerStyle = (timelineStart, totalDays, date, shift = 0.5) => {
    if (!date) return null;
    const left = ((diffDays(timelineStart, date) + shift) / totalDays) * 100;
    return { left: `${Math.max(0, Math.min(100, left))}%` };
};

const resolveStageRange = (fallbackStart, fallbackEnd, manualStart, manualEnd, duration) => {
    if (manualStart && manualEnd) {
        const normalizedStart = manualStart <= manualEnd ? manualStart : manualEnd;
        const normalizedEnd = manualStart <= manualEnd ? manualEnd : manualStart;
        return {
            start: normalizedStart,
            end: normalizedEnd,
            duration: Math.max(1, diffDays(normalizedStart, normalizedEnd) + 1),
        };
    }
    if (manualStart) {
        return {
            start: manualStart,
            end: addDays(manualStart, duration - 1),
            duration,
        };
    }
    if (manualEnd) {
        return {
            start: addDays(manualEnd, -(duration - 1)),
            end: manualEnd,
            duration,
        };
    }
    return {
        start: fallbackStart,
        end: fallbackEnd,
        duration,
    };
};

const GanttView = ({ orders, onSelectOrder, canManage }) => {
    const today = startOfDay(new Date());

    const prepared = useMemo(() => {
        return orders.map((order) => {
            const dateReceived = parseDate(order.date_received);
            const dateToWork = parseDate(order.date_to_work);
            const dateDesignDeadline = parseDate(order.date_design_deadline);
            const dateInstallPlan = parseDate(order.date_installation_plan);
            const dateInstallDone = parseDate(order.date_installation);
            const manualStageDates = {
                constructiveStart: parseDate(order.constructive_start_date),
                constructiveEnd: parseDate(order.constructive_end_date),
                complectationStart: parseDate(order.complectation_start_date),
                complectationEnd: parseDate(order.complectation_end_date),
                preassemblyStart: parseDate(order.preassembly_start_date),
                preassemblyEnd: parseDate(order.preassembly_end_date),
                installationStart: parseDate(order.installation_start_date),
                installationEnd: parseDate(order.installation_end_date),
            };

            const days = {
                constructive: clampDays(order.constructive_days, 5),
                complectation: clampDays(order.complectation_days, 2),
                preassembly: clampDays(order.preassembly_days, 1),
                installation: clampDays(order.installation_days, 3),
            };

            const rawStages = dateInstallPlan
                ? buildBackwardStages(dateInstallPlan, days)
                : buildForwardStages(dateToWork || dateReceived || today, days);

            const constructiveRange = resolveStageRange(
                rawStages.constructiveStart,
                rawStages.constructiveEnd,
                manualStageDates.constructiveStart,
                manualStageDates.constructiveEnd,
                days.constructive
            );
            const complectationRange = resolveStageRange(
                rawStages.complectationStart,
                rawStages.complectationEnd,
                manualStageDates.complectationStart,
                manualStageDates.complectationEnd,
                days.complectation
            );
            const preassemblyRange = resolveStageRange(
                rawStages.preassemblyStart,
                rawStages.preassemblyEnd,
                manualStageDates.preassemblyStart,
                manualStageDates.preassemblyEnd,
                days.preassembly
            );
            const installationRange = resolveStageRange(
                rawStages.installationStart,
                rawStages.installationEnd,
                manualStageDates.installationStart,
                manualStageDates.installationEnd,
                days.installation
            );

            const stages = [
                {
                    key: 'constructive',
                    label: STAGE_META.constructive.label,
                    color: STAGE_META.constructive.color,
                    start: constructiveRange.start,
                    end: constructiveRange.end,
                    duration: constructiveRange.duration,
                },
                {
                    key: 'complectation',
                    label: STAGE_META.complectation.label,
                    color: STAGE_META.complectation.color,
                    start: complectationRange.start,
                    end: complectationRange.end,
                    duration: complectationRange.duration,
                },
                {
                    key: 'preassembly',
                    label: STAGE_META.preassembly.label,
                    color: STAGE_META.preassembly.color,
                    start: preassemblyRange.start,
                    end: preassemblyRange.end,
                    duration: preassemblyRange.duration,
                },
                {
                    key: 'installation',
                    label: STAGE_META.installation.label,
                    color: STAGE_META.installation.color,
                    start: installationRange.start,
                    end: installationRange.end,
                    duration: installationRange.duration,
                },
            ];

            const productionStart = stages[0].start;
            const productionEnd = stages[stages.length - 1].end;

            const points = [
                productionStart,
                productionEnd,
                dateToWork,
                dateDesignDeadline,
                dateInstallPlan,
                dateInstallDone,
            ].filter(Boolean);

            const overdueDesign = Boolean(
                dateDesignDeadline &&
                !dateToWork &&
                dateDesignDeadline < today
            );
            const overdueInstall = Boolean(
                dateInstallPlan &&
                !dateInstallDone &&
                dateInstallPlan < today
            );
            const noInstallPlan = !dateInstallPlan;

            let tone = 'normal';
            let status = 'В роботі';
            if (overdueDesign || overdueInstall) {
                tone = 'danger';
                status = 'Ризик';
            } else if (noInstallPlan) {
                tone = 'warning';
                status = 'Без плану';
            }

            return {
                order,
                stages,
                dateToWork,
                dateDesignDeadline,
                dateInstallPlan,
                dateInstallDone,
                productionStart,
                productionEnd,
                minDate: points.length ? new Date(Math.min(...points.map((point) => point.getTime()))) : productionStart,
                maxDate: points.length ? new Date(Math.max(...points.map((point) => point.getTime()))) : productionEnd,
                status,
                tone,
                days,
            };
        });
    }, [orders, today]);

    const timeline = useMemo(() => {
        const minDates = prepared.map((item) => item.minDate).filter(Boolean);
        const maxDates = prepared.map((item) => item.maxDate).filter(Boolean);

        if (!minDates.length || !maxDates.length) {
            return {
                start: addDays(today, -1),
                end: addDays(today, 6),
            };
        }

        const minDate = new Date(Math.min(...minDates.map((date) => date.getTime())));
        const maxDate = new Date(Math.max(...maxDates.map((date) => date.getTime())));

        return {
            start: addDays(startOfDay(minDate), -1),
            end: addDays(startOfDay(maxDate), 2),
        };
    }, [prepared, today]);

    const totalDays = Math.max(1, diffDays(timeline.start, timeline.end) + 1);
    const timelineWidth = Math.max(900, totalDays * MIN_DAY_WIDTH);

    const dayHeaders = useMemo(
        () => Array.from({ length: totalDays }, (_, index) => addDays(timeline.start, index)),
        [timeline.start, totalDays]
    );

    const dayWidthPercent = 100 / totalDays;
    const todayStyle = getMarkerStyle(timeline.start, totalDays, today, 0);

    return (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xl">
            <div className="border-b border-slate-200 bg-white/90 px-4 py-3">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <h2 className="text-lg font-black uppercase italic text-slate-800">План виробництва</h2>
                        <p className="mt-1 text-xs font-medium text-slate-500">
                            Денний Gantt: кожне замовлення окремим рядком, а праворуч одна кольорова лінія по етапах.
                        </p>
                    </div>
                    <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                        {canManage ? 'Клік по рядку відкриває замовлення для редагування.' : 'Клік по рядку відкриває деталі замовлення.'}
                    </div>
                </div>
            </div>

            <div className="max-h-[72vh] overflow-auto">
                <div style={{ minWidth: LEFT_COLUMN_WIDTH + timelineWidth }}>
                    <div className="grid" style={{ gridTemplateColumns: `${LEFT_COLUMN_WIDTH}px ${timelineWidth}px` }}>
                        <div className="sticky left-0 top-0 z-[70] flex h-10 items-center justify-between border-r border-b border-slate-200 bg-slate-50 px-3 text-[11px] font-bold uppercase tracking-wide text-slate-500 shadow-[4px_0_12px_-10px_rgba(15,23,42,0.28),1px_0_0_0_rgba(226,232,240,1)]">
                            <span>Замовлення</span>
                            <span className="text-slate-400">📊</span>
                        </div>

                        <div
                            className="sticky top-0 z-40 grid h-10 border-b border-slate-200 bg-sky-50/95 text-[11px] font-bold text-slate-500 backdrop-blur"
                            style={{ gridTemplateColumns: `repeat(${dayHeaders.length}, minmax(0, 1fr))` }}
                        >
                            {dayHeaders.map((day) => (
                                <div
                                    key={day.toISOString()}
                                    className="flex items-center justify-center border-l border-sky-100"
                                >
                                    {formatHeaderDate(day)}
                                </div>
                            ))}
                        </div>
                    </div>

                    {prepared.length === 0 ? (
                        <div className="px-4 py-10 text-center text-sm italic text-slate-400">
                            Немає замовлень для Gantt-плану
                        </div>
                    ) : (
                        prepared.map((item) => {
                            const statusTone =
                                item.tone === 'danger'
                                    ? 'border-rose-200 bg-rose-100 text-rose-700'
                                    : item.tone === 'warning'
                                        ? 'border-amber-200 bg-amber-100 text-amber-700'
                                        : 'border-sky-200 bg-sky-100 text-sky-700';

                            return (
                                <div
                                    key={item.order.id}
                                    className="grid border-b border-slate-200 last:border-b-0"
                                    style={{ gridTemplateColumns: `${LEFT_COLUMN_WIDTH}px ${timelineWidth}px` }}
                                >
                                    <button
                                        type="button"
                                        onClick={() => onSelectOrder(item.order)}
                                        className="sticky left-0 z-[60] border-r border-slate-200 bg-white px-3 py-3 text-left shadow-[4px_0_12px_-10px_rgba(15,23,42,0.28),1px_0_0_0_rgba(226,232,240,1)] transition hover:bg-slate-50"
                                        title="Відкрити замовлення"
                                    >
                                        <div className="flex flex-col gap-2">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className="truncate text-[14px] font-black text-slate-800">
                                                        #{item.order.id} {item.order.name}
                                                    </div>
                                                    <div className="mt-1 truncate text-[11px] font-semibold text-slate-500">
                                                        Старт {formatDate(item.productionStart)} · Дедлайн {formatDate(item.dateDesignDeadline)} · Монтаж {formatDate(item.dateInstallPlan)}
                                                    </div>
                                                </div>
                                                <span className={`shrink-0 rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-wide ${statusTone}`}>
                                                    {item.status}
                                                </span>
                                            </div>

                                            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-bold text-slate-400">
                                                <span>К {item.days.constructive}д</span>
                                                <span>Комп {item.days.complectation}д</span>
                                                <span>ПЗ {item.days.preassembly}д</span>
                                                <span>М {item.days.installation}д</span>
                                            </div>
                                        </div>
                                    </button>

                                    <div
                                        className="relative z-0 h-[82px] overflow-hidden bg-white"
                                        style={{
                                            backgroundImage: `
                                                repeating-linear-gradient(
                                                    to right,
                                                    transparent 0,
                                                    transparent calc(${dayWidthPercent}% - 1px),
                                                    rgba(203, 213, 225, 0.85) calc(${dayWidthPercent}% - 1px),
                                                    rgba(203, 213, 225, 0.85) ${dayWidthPercent}%
                                                )
                                            `,
                                        }}
                                    >
                                        <div className="absolute inset-y-0 left-0 right-0 bg-gradient-to-r from-transparent via-amber-50/70 to-transparent" />

                                        {todayStyle ? (
                                            <div
                                                className="absolute inset-y-0 z-10 w-px bg-slate-400/50"
                                                style={todayStyle}
                                            />
                                        ) : null}

                                        <div className="absolute left-0 right-0 top-1/2 z-10 h-px -translate-y-1/2 bg-slate-300" />

                                        {item.stages.map((stage, index) => {
                                            const stageStyle = getRangeStyle(timeline.start, totalDays, stage.start, stage.end);
                                            if (!stageStyle) return null;

                                            const radiusClass =
                                                index === 0
                                                    ? 'rounded-l-full'
                                                    : index === item.stages.length - 1
                                                        ? 'rounded-r-full'
                                                        : '';

                                            return (
                                                <div
                                                    key={`${item.order.id}-${stage.key}`}
                                                    className={`absolute top-1/2 z-20 h-4 -translate-y-1/2 ${radiusClass}`}
                                                    style={{
                                                        ...stageStyle,
                                                        backgroundColor: stage.color,
                                                    }}
                                                    title={`${stage.label}: ${formatDate(stage.start)} - ${formatDate(stage.end)}`}
                                                />
                                            );
                                        })}

                                        {item.dateDesignDeadline ? (
                                            <div
                                                className="absolute top-[14px] z-30 h-8 w-[3px] bg-red-500"
                                                style={getMarkerStyle(timeline.start, totalDays, item.dateDesignDeadline, 0.5)}
                                                title={`Дедлайн конструктиву: ${formatDate(item.dateDesignDeadline)}`}
                                            />
                                        ) : null}

                                        {item.dateInstallPlan ? (
                                            <div
                                                className="absolute bottom-[12px] z-30 h-6 w-[3px] bg-emerald-600"
                                                style={getMarkerStyle(timeline.start, totalDays, item.dateInstallPlan, 0.5)}
                                                title={`План монтажу: ${formatDate(item.dateInstallPlan)}`}
                                            />
                                        ) : null}

                                        {item.dateInstallDone ? (
                                            <div
                                                className="absolute bottom-[12px] z-30 h-6 w-[3px] bg-emerald-900"
                                                style={getMarkerStyle(timeline.start, totalDays, item.dateInstallDone, 0.5)}
                                                title={`Факт монтажу: ${formatDate(item.dateInstallDone)}`}
                                            />
                                        ) : null}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/70 px-4 py-3 text-[11px] font-bold text-slate-500">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <span><span className="mr-1 inline-block h-3 w-3 rounded-full bg-sky-400 align-middle" />Конструктив</span>
                    <span><span className="mr-1 inline-block h-3 w-3 rounded-full bg-amber-400 align-middle" />Комплектація</span>
                    <span><span className="mr-1 inline-block h-3 w-3 rounded-full bg-violet-400 align-middle" />Предзбірка</span>
                    <span><span className="mr-1 inline-block h-3 w-3 rounded-full bg-emerald-400 align-middle" />Монтаж</span>
                    <span><span className="mr-1 inline-block h-5 w-[3px] bg-red-500 align-middle" />Дедлайн конструктиву</span>
                    <span><span className="mr-1 inline-block h-5 w-[3px] bg-emerald-600 align-middle" />План монтажу</span>
                    <span><span className="mr-1 inline-block h-5 w-[3px] bg-emerald-900 align-middle" />Факт монтажу</span>
                </div>
                <div className="text-[10px] uppercase tracking-wide text-slate-400">
                    Шкала по днях
                </div>
            </div>
        </div>
    );
};

export default GanttView;
