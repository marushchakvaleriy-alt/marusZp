import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { fetchOrders, fetchUsers, updateOrder } from '../orders/orderApi';
import { formatDate, isArchivedOrder } from '../orders/orderUtils';

function parseDate(value) {
  if (!value) return null;
  const [year, month, day] = String(value).split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function atStartOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function diffDays(from, to) {
  const ms = atStartOfDay(to).getTime() - atStartOfDay(from).getTime();
  return Math.round(ms / 86400000);
}

function clampDays(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(60, parsed));
}

function defaultDraft(order) {
  return {
    date_installation_plan: order.date_installation_plan || '',
    constructive_days: clampDays(order.constructive_days, 5),
    complectation_days: clampDays(order.complectation_days, 2),
    preassembly_days: clampDays(order.preassembly_days, 1),
    installation_days: clampDays(order.installation_days, 3),
  };
}

function stageDateLabel(startDate, duration) {
  const endDate = addDays(startDate, Math.max(1, duration) - 1);
  return `${formatDate(startDate)} - ${formatDate(endDate)}`;
}

function buildPlan(order, usersById) {
  const baseStart =
    parseDate(order.date_to_work) ||
    parseDate(order.date_received) ||
    parseDate(order.date_design_deadline) ||
    parseDate(order.date_installation_plan) ||
    parseDate(order.date_installation);

  const constructiveDays = clampDays(order.constructive_days, 5);
  const complectationDays = clampDays(order.complectation_days, 2);
  const preassemblyDays = clampDays(order.preassembly_days, 1);
  const installationDays = clampDays(order.installation_days, 3);

  const managerName =
    usersById.get(order.manager_id)?.full_name ||
    (order.manager_id ? `ID ${order.manager_id}` : 'Не призначено');
  const constructorName =
    usersById.get(order.constructor_id)?.full_name ||
    (order.constructor_id ? `ID ${order.constructor_id}` : 'Не призначено');

  if (!baseStart) {
    return {
      id: order.id,
      name: order.name,
      managerName,
      constructorName,
      hasSchedule: false,
      date_to_work: order.date_to_work,
      date_design_deadline: order.date_design_deadline,
      date_installation_plan: order.date_installation_plan,
      date_installation: order.date_installation,
      stageDays: {
        constructiveDays,
        complectationDays,
        preassemblyDays,
        installationDays,
      },
      stages: [],
      markers: [],
      rangeStart: null,
      rangeEnd: null,
    };
  }

  const constructiveStart = baseStart;
  const constructiveEnd = addDays(constructiveStart, constructiveDays);

  const complectationStart = constructiveEnd;
  const complectationEnd = addDays(complectationStart, complectationDays);

  const preassemblyStart = complectationEnd;
  const preassemblyEnd = addDays(preassemblyStart, preassemblyDays);

  const installationStart = parseDate(order.date_installation_plan) || preassemblyEnd;
  const installationEnd = addDays(installationStart, installationDays);

  const stages = [
    {
      key: 'constructive',
      label: 'Конструктив',
      start: constructiveStart,
      duration: constructiveDays,
      dateText: stageDateLabel(constructiveStart, constructiveDays),
    },
    {
      key: 'complectation',
      label: 'Комплектація',
      start: complectationStart,
      duration: complectationDays,
      dateText: stageDateLabel(complectationStart, complectationDays),
    },
    {
      key: 'preassembly',
      label: 'Предзбірка',
      start: preassemblyStart,
      duration: preassemblyDays,
      dateText: stageDateLabel(preassemblyStart, preassemblyDays),
    },
    {
      key: 'installation',
      label: 'Монтаж',
      start: installationStart,
      duration: installationDays,
      dateText: stageDateLabel(installationStart, installationDays),
    },
  ];

  const markers = [
    {
      key: 'to_work',
      label: 'В роботу',
      date: parseDate(order.date_to_work),
    },
    {
      key: 'deadline',
      label: 'Дедлайн конструктиву',
      date: parseDate(order.date_design_deadline),
    },
    {
      key: 'install_plan',
      label: 'План монтажу',
      date: parseDate(order.date_installation_plan),
    },
    {
      key: 'install_fact',
      label: 'Факт монтажу',
      date: parseDate(order.date_installation),
    },
  ].filter((entry) => entry.date);

  const points = [
    ...stages.map((stage) => stage.start),
    ...stages.map((stage) => addDays(stage.start, stage.duration)),
    ...markers.map((marker) => marker.date),
  ];

  const rangeStart = points.reduce((min, point) => (point < min ? point : min), points[0]);
  const rangeEnd = points.reduce((max, point) => (point > max ? point : max), points[0]);

  return {
    id: order.id,
    name: order.name,
    managerName,
    constructorName,
    hasSchedule: true,
    date_to_work: order.date_to_work,
    date_design_deadline: order.date_design_deadline,
    date_installation_plan: order.date_installation_plan,
    date_installation: order.date_installation,
    stageDays: {
      constructiveDays,
      complectationDays,
      preassemblyDays,
      installationDays,
    },
    stages,
    markers,
    rangeStart,
    rangeEnd,
  };
}

export default function PlanningPage() {
  const { user } = useAuth();
  const canReadUsers =
    user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'manager';
  const canEditPlan =
    user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'manager';

  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [savingById, setSavingById] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [viewMode, setViewMode] = useState('active');
  const [constructorFilter, setConstructorFilter] = useState('all');

  const loadData = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const nextOrders = await fetchOrders({ limit: 500, sort_by: 'id', sort_order: 'desc' });
      setOrders(nextOrders);

      if (canReadUsers) {
        const nextUsers = await fetchUsers();
        setUsers(nextUsers);
      } else {
        setUsers([]);
      }
    } catch (loadError) {
      setError(loadError?.response?.data?.detail || 'Не вдалося завантажити планування');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [canReadUsers]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const nextDrafts = {};
    orders.forEach((order) => {
      nextDrafts[order.id] = defaultDraft(order);
    });
    setDrafts(nextDrafts);
  }, [orders]);

  const usersById = useMemo(() => new Map(users.map((entry) => [entry.id, entry])), [users]);

  const constructorsForFilter = useMemo(() => {
    const available = users.filter((entry) => entry.role === 'constructor');
    return available.sort((a, b) =>
      (a.full_name || a.username).localeCompare(b.full_name || b.username)
    );
  }, [users]);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (viewMode === 'active' && isArchivedOrder(order)) return false;
      if (constructorFilter !== 'all' && order.constructor_id !== Number(constructorFilter)) {
        return false;
      }
      return true;
    });
  }, [orders, viewMode, constructorFilter]);

  const plans = useMemo(
    () => filteredOrders.map((order) => buildPlan(order, usersById)),
    [filteredOrders, usersById]
  );

  const timeline = useMemo(() => {
    const scheduled = plans.filter((plan) => plan.hasSchedule);
    const today = atStartOfDay(new Date());

    if (scheduled.length === 0) {
      const start = addDays(today, -2);
      const end = addDays(today, 20);
      return {
        rangeStart: start,
        rangeEnd: end,
        totalDays: diffDays(start, end),
      };
    }

    const min = scheduled.reduce((value, plan) => {
      if (!plan.rangeStart) return value;
      return plan.rangeStart < value ? plan.rangeStart : value;
    }, scheduled[0].rangeStart);

    const max = scheduled.reduce((value, plan) => {
      if (!plan.rangeEnd) return value;
      return plan.rangeEnd > value ? plan.rangeEnd : value;
    }, scheduled[0].rangeEnd);

    const start = addDays(min, -1);
    const end = addDays(max, 2);
    const totalDays = Math.max(1, diffDays(start, end));

    return { rangeStart: start, rangeEnd: end, totalDays };
  }, [plans]);

  const timelineScale = useMemo(() => {
    const step = timeline.totalDays > 90 ? 14 : timeline.totalDays > 45 ? 7 : 3;
    const ticks = [];
    for (let day = 0; day <= timeline.totalDays; day += step) {
      ticks.push(addDays(timeline.rangeStart, day));
    }
    if (ticks.length === 0 || ticks[ticks.length - 1] < timeline.rangeEnd) {
      ticks.push(timeline.rangeEnd);
    }
    return ticks;
  }, [timeline]);

  const gridLines = useMemo(() => {
    const step = timeline.totalDays > 90 ? 7 : timeline.totalDays > 45 ? 3 : 1;
    const values = [];
    for (let day = 0; day <= timeline.totalDays; day += step) {
      values.push(day);
    }
    return values;
  }, [timeline]);

  const updateDraft = (orderId, field, value) => {
    setDrafts((prev) => ({
      ...prev,
      [orderId]: {
        ...prev[orderId],
        [field]: value,
      },
    }));
  };

  const isDraftChanged = (order, draft) => {
    if (!draft) return false;

    const expected = defaultDraft(order);
    return (
      String(draft.date_installation_plan || '') !== String(expected.date_installation_plan || '') ||
      Number(draft.constructive_days) !== Number(expected.constructive_days) ||
      Number(draft.complectation_days) !== Number(expected.complectation_days) ||
      Number(draft.preassembly_days) !== Number(expected.preassembly_days) ||
      Number(draft.installation_days) !== Number(expected.installation_days)
    );
  };

  const saveDraft = async (order, draft) => {
    if (!canEditPlan || !order || !draft) return;

    setSavingById((prev) => ({ ...prev, [order.id]: true }));
    setError('');
    setSuccess('');

    try {
      await updateOrder(order.id, {
        date_installation_plan: draft.date_installation_plan || null,
        constructive_days: clampDays(draft.constructive_days, 5),
        complectation_days: clampDays(draft.complectation_days, 2),
        preassembly_days: clampDays(draft.preassembly_days, 1),
        installation_days: clampDays(draft.installation_days, 3),
      });
      setSuccess(`Планування для замовлення #${order.id} збережено.`);
      await loadData();
    } catch (saveError) {
      setError(saveError?.response?.data?.detail || `Не вдалося зберегти замовлення #${order.id}`);
    } finally {
      setSavingById((prev) => ({ ...prev, [order.id]: false }));
    }
  };

  if (loading) {
    return (
      <section className="card">
        <p className="card-kicker">Завантаження</p>
        <h3>Збираємо планування по замовленнях</h3>
      </section>
    );
  }

  return (
    <div className="page-stack">
      <section className="section-head">
        <div>
          <p className="eyebrow">Планування</p>
          <h3>Реальний Gantt по замовленнях</h3>
        </div>
        <p className="section-copy">
          Етапи: конструктив, комплектація, предзбірка, монтаж. Дати видно прямо в рядку
          замовлення. Адмін/менеджер можуть коригувати тривалості і план монтажу.
        </p>
      </section>

      <section className="card planning-toolbar">
        <div className="segmented-control">
          <button
            type="button"
            className={viewMode === 'active' ? 'segment-active' : ''}
            onClick={() => setViewMode('active')}
          >
            Активні
          </button>
          <button
            type="button"
            className={viewMode === 'all' ? 'segment-active' : ''}
            onClick={() => setViewMode('all')}
          >
            Всі
          </button>
        </div>

        <label className="field compact-field">
          <span>Конструктор</span>
          <select
            value={constructorFilter}
            onChange={(event) => setConstructorFilter(event.target.value)}
          >
            <option value="all">Всі конструктори</option>
            {constructorsForFilter.map((constructor) => (
              <option key={constructor.id} value={constructor.id}>
                {constructor.full_name || constructor.username}
              </option>
            ))}
          </select>
        </label>
      </section>

      {error ? (
        <section className="card error-card">
          <p className="card-kicker">Помилка</p>
          <p>{error}</p>
        </section>
      ) : null}

      {success ? (
        <section className="card success-card">
          <p className="card-kicker">Готово</p>
          <p>{success}</p>
        </section>
      ) : null}

      {plans.length === 0 ? (
        <section className="card">
          <p className="card-kicker">Порожньо</p>
          <h3>Немає замовлень для цього фільтра</h3>
        </section>
      ) : (
        <section className="planning-list">
          <div className="planning-scale card">
            {timelineScale.map((tick) => {
              const position = (diffDays(timeline.rangeStart, tick) / timeline.totalDays) * 100;
              return (
                <span key={toIsoDate(tick)} style={{ left: `${position}%` }}>
                  {new Intl.DateTimeFormat('uk-UA', {
                    day: '2-digit',
                    month: '2-digit',
                  }).format(tick)}
                </span>
              );
            })}
          </div>

          {plans.map((plan) => {
            const sourceOrder = filteredOrders.find((row) => row.id === plan.id);
            const draft = drafts[plan.id];
            const saving = Boolean(savingById[plan.id]);
            const dirty = sourceOrder ? isDraftChanged(sourceOrder, draft) : false;

            return (
              <article key={plan.id} className="planning-row card">
                <div className="planning-meta">
                  <div>
                    <p className="card-kicker">Замовлення #{plan.id}</p>
                    <h4>{plan.name}</h4>
                  </div>
                  <p className="muted-text">Менеджер: {plan.managerName}</p>
                  <p className="muted-text">Конструктор: {plan.constructorName}</p>
                  <p className="muted-text">
                    В роботу: {formatDate(plan.date_to_work)} • Дедлайн: {formatDate(plan.date_design_deadline)}
                  </p>
                  <p className="muted-text">
                    План монтажу: {formatDate(plan.date_installation_plan)} • Факт: {formatDate(plan.date_installation)}
                  </p>
                </div>

                <div className="planning-track-wrap">
                  {!plan.hasSchedule ? (
                    <div className="planning-empty">
                      <p>Немає стартової дати. Заповніть дату “В роботу” або “Дата отримання”.</p>
                    </div>
                  ) : (
                    <div className="planning-track">
                      <div className="planning-gridlines">
                        {gridLines.map((lineDay) => {
                          const left = (lineDay / timeline.totalDays) * 100;
                          return <span key={`${plan.id}-grid-${lineDay}`} style={{ left: `${left}%` }} />;
                        })}
                      </div>

                      {plan.stages.map((stage) => {
                        const left = (diffDays(timeline.rangeStart, stage.start) / timeline.totalDays) * 100;
                        const width = Math.max((stage.duration / timeline.totalDays) * 100, 1.6);

                        return (
                          <div
                            key={`${plan.id}-${stage.key}`}
                            className={`planning-bar planning-bar-${stage.key}`}
                            style={{ left: `${left}%`, width: `${width}%` }}
                            title={`${stage.label}: ${stage.dateText}`}
                          >
                            <strong>{stage.label}</strong>
                            <small>{stage.dateText}</small>
                          </div>
                        );
                      })}

                      {plan.markers.map((marker) => {
                        const left = (diffDays(timeline.rangeStart, marker.date) / timeline.totalDays) * 100;
                        return (
                          <span
                            key={`${plan.id}-${marker.key}`}
                            className={`planning-marker planning-marker-${marker.key}`}
                            style={{ left: `${left}%` }}
                            title={`${marker.label}: ${formatDate(marker.date)}`}
                          />
                        );
                      })}
                    </div>
                  )}

                  <div className="planning-stage-list">
                    {plan.stages.map((stage) => (
                      <span key={`${plan.id}-text-${stage.key}`}>
                        {stage.label}: {stage.dateText}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="planning-edit">
                  <label className="field">
                    <span>План монтажу</span>
                    <input
                      type="date"
                      value={draft?.date_installation_plan || ''}
                      onChange={(event) =>
                        updateDraft(plan.id, 'date_installation_plan', event.target.value)
                      }
                      disabled={!canEditPlan}
                    />
                  </label>

                  <div className="planning-days-grid">
                    <label className="field">
                      <span>Конструктив</span>
                      <input
                        type="number"
                        min="1"
                        max="60"
                        value={draft?.constructive_days ?? 5}
                        onChange={(event) =>
                          updateDraft(plan.id, 'constructive_days', event.target.value)
                        }
                        disabled={!canEditPlan}
                      />
                    </label>
                    <label className="field">
                      <span>Комплектація</span>
                      <input
                        type="number"
                        min="1"
                        max="60"
                        value={draft?.complectation_days ?? 2}
                        onChange={(event) =>
                          updateDraft(plan.id, 'complectation_days', event.target.value)
                        }
                        disabled={!canEditPlan}
                      />
                    </label>
                    <label className="field">
                      <span>Предзбірка</span>
                      <input
                        type="number"
                        min="1"
                        max="60"
                        value={draft?.preassembly_days ?? 1}
                        onChange={(event) =>
                          updateDraft(plan.id, 'preassembly_days', event.target.value)
                        }
                        disabled={!canEditPlan}
                      />
                    </label>
                    <label className="field">
                      <span>Монтаж</span>
                      <input
                        type="number"
                        min="1"
                        max="60"
                        value={draft?.installation_days ?? 3}
                        onChange={(event) =>
                          updateDraft(plan.id, 'installation_days', event.target.value)
                        }
                        disabled={!canEditPlan}
                      />
                    </label>
                  </div>

                  {canEditPlan ? (
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => saveDraft(sourceOrder, draft)}
                      disabled={!dirty || saving}
                    >
                      {saving ? 'Збереження...' : 'Зберегти план'}
                    </button>
                  ) : (
                    <p className="muted-text">Для вашої ролі доступний тільки перегляд.</p>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
