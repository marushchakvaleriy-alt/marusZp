import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { formatCurrency, formatDate } from '../orders/orderUtils';
import {
  createDeductionForFinance,
  createPayment,
  deleteDeductionForFinance,
  deletePayment,
  fetchDeductionsForFinance,
  fetchFinancialStats,
  fetchOrdersForFinance,
  fetchPaymentAllocations,
  fetchPayments,
  fetchUsersForFinance,
  redistributePayments,
  updateDeductionForFinance,
} from './financeApi';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function getStageLabel(stage) {
  if (stage === 'advance') return 'Аванс';
  if (stage === 'final') return 'Фінал';
  if (stage === 'manager') return 'Менеджер';
  return stage;
}

export default function FinancePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const canManage = isAdmin || user?.role === 'manager';

  const [stats, setStats] = useState(null);
  const [payments, setPayments] = useState([]);
  const [deductions, setDeductions] = useState([]);
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showOnlyUnallocated, setShowOnlyUnallocated] = useState(false);

  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    date_received: todayIso(),
    notes: '',
    target: 'general',
    manual_order_id: '',
    constructor_id: '',
    manager_id: '',
  });

  const [deductionForm, setDeductionForm] = useState({
    order_id: '',
    amount: '',
    description: '',
    date_created: todayIso(),
  });

  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [deductionSubmitting, setDeductionSubmitting] = useState(false);
  const [redistributing, setRedistributing] = useState(false);

  const constructors = useMemo(
    () =>
      users.filter(
        (entry) =>
          entry.role === 'constructor' ||
          entry.role === 'admin' ||
          entry.role === 'super_admin'
      ),
    [users]
  );

  const managers = useMemo(
    () =>
      users.filter(
        (entry) =>
          entry.role === 'manager' ||
          entry.role === 'admin' ||
          entry.role === 'super_admin'
      ),
    [users]
  );

  const deductionStats = useMemo(() => {
    const total = deductions.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const unpaid = deductions
      .filter((item) => !item.is_paid)
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    return { total, unpaid };
  }, [deductions]);

  const filteredPayments = useMemo(() => {
    if (!showOnlyUnallocated) return payments;
    return payments.filter(
      (item) =>
        !item.manual_order_id && item.person_name === 'Загальний (нерозподілений)'
    );
  }, [payments, showOnlyUnallocated]);

  const selectedAllocatedTotal = useMemo(
    () => allocations.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [allocations]
  );

  const selectedRemaining = useMemo(() => {
    if (!selectedPayment) return 0;
    return Number(selectedPayment.amount || 0) - selectedAllocatedTotal;
  }, [selectedAllocatedTotal, selectedPayment]);

  const loadFinanceData = async () => {
    setLoading(true);
    setError('');

    try {
      const baseRequests = [
        fetchFinancialStats(),
        fetchPayments(),
        fetchDeductionsForFinance(),
        fetchOrdersForFinance(),
      ];

      const [statsData, paymentsData, deductionsData, ordersData] =
        await Promise.all(baseRequests);

      setStats(statsData);
      setPayments(paymentsData);
      setDeductions(deductionsData);
      setOrders(ordersData);

      if (!deductionForm.order_id && ordersData.length > 0) {
        setDeductionForm((prev) => ({
          ...prev,
          order_id: String(ordersData[0].id),
        }));
      }

      if (canManage) {
        const usersData = await fetchUsersForFinance();
        setUsers(usersData);
      } else {
        setUsers([]);
      }
    } catch (loadError) {
      setError(
        loadError?.response?.data?.detail || 'Не вдалося завантажити модуль фінансів'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFinanceData();
  }, [canManage]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePaymentSelect = async (payment) => {
    setSelectedPayment(payment);
    try {
      const allocs = await fetchPaymentAllocations(payment.id);
      setAllocations(allocs);
    } catch (allocationError) {
      setAllocations([]);
      setError(
        allocationError?.response?.data?.detail ||
          'Не вдалося отримати деталізацію розподілу'
      );
    }
  };

  const handleCreatePayment = async (event) => {
    event.preventDefault();
    if (!isAdmin) return;

    setPaymentSubmitting(true);
    setError('');
    try {
      const payload = {
        amount: Number(paymentForm.amount || 0),
        date_received: paymentForm.date_received,
        notes: paymentForm.notes || null,
        manual_order_id: null,
        constructor_id: null,
        manager_id: null,
      };

      if (paymentForm.target === 'order') {
        payload.manual_order_id = paymentForm.manual_order_id
          ? Number(paymentForm.manual_order_id)
          : null;
      } else if (paymentForm.target === 'constructor') {
        payload.constructor_id = paymentForm.constructor_id
          ? Number(paymentForm.constructor_id)
          : null;
      } else if (paymentForm.target === 'manager') {
        payload.manager_id = paymentForm.manager_id
          ? Number(paymentForm.manager_id)
          : null;
      }

      await createPayment(payload);
      setPaymentForm({
        amount: '',
        date_received: todayIso(),
        notes: '',
        target: 'general',
        manual_order_id: '',
        constructor_id: '',
        manager_id: '',
      });
      await loadFinanceData();
    } catch (createError) {
      setError(createError?.response?.data?.detail || 'Не вдалося додати платіж');
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const handleDeletePayment = async (payment) => {
    if (!isAdmin) return;
    const confirmed = window.confirm(
      `Видалити платіж ${formatCurrency(payment.amount)} грн?`
    );
    if (!confirmed) return;

    try {
      await deletePayment(payment.id);
      if (selectedPayment?.id === payment.id) {
        setSelectedPayment(null);
        setAllocations([]);
      }
      await loadFinanceData();
    } catch (deleteError) {
      setError(
        deleteError?.response?.data?.detail || 'Не вдалося видалити платіж'
      );
    }
  };

  const handleRedistribute = async () => {
    if (!isAdmin) return;
    const confirmed = window.confirm(
      'Перерозподілити всі доступні кошти по замовленнях?'
    );
    if (!confirmed) return;

    setRedistributing(true);
    setError('');
    try {
      await redistributePayments();
      await loadFinanceData();
      if (selectedPayment) {
        const refreshed = payments.find((p) => p.id === selectedPayment.id);
        if (refreshed) {
          await handlePaymentSelect(refreshed);
        }
      }
    } catch (redistributeError) {
      setError(
        redistributeError?.response?.data?.detail ||
          'Не вдалося виконати перерозподіл'
      );
    } finally {
      setRedistributing(false);
    }
  };

  const handleCreateDeduction = async (event) => {
    event.preventDefault();
    if (!canManage) return;

    setDeductionSubmitting(true);
    setError('');
    try {
      await createDeductionForFinance({
        order_id: Number(deductionForm.order_id),
        amount: Number(deductionForm.amount || 0),
        description: deductionForm.description,
        date_created: deductionForm.date_created,
      });

      setDeductionForm((prev) => ({
        ...prev,
        amount: '',
        description: '',
        date_created: todayIso(),
      }));
      await loadFinanceData();
    } catch (createDeductionError) {
      setError(
        createDeductionError?.response?.data?.detail || 'Не вдалося додати штраф'
      );
    } finally {
      setDeductionSubmitting(false);
    }
  };

  const handleDeleteDeduction = async (deductionId) => {
    if (!canManage) return;
    const confirmed = window.confirm('Видалити цей штраф?');
    if (!confirmed) return;

    try {
      await deleteDeductionForFinance(deductionId);
      await loadFinanceData();
    } catch (deleteDeductionError) {
      setError(
        deleteDeductionError?.response?.data?.detail ||
          'Не вдалося видалити штраф'
      );
    }
  };

  const handleToggleDeductionPaid = async (deduction) => {
    if (!canManage) return;

    try {
      await updateDeductionForFinance(deduction.id, {
        is_paid: !deduction.is_paid,
        date_paid: deduction.is_paid ? null : todayIso(),
      });
      await loadFinanceData();
    } catch (toggleError) {
      setError(toggleError?.response?.data?.detail || 'Не вдалося оновити штраф');
    }
  };

  if (loading) {
    return (
      <section className="card">
        <p className="card-kicker">Завантаження</p>
        <h3>Підтягуємо фінансові дані</h3>
      </section>
    );
  }

  return (
    <div className="page-stack">
      <section className="section-head">
        <div>
          <p className="eyebrow">Фінанси</p>
          <h3>Зрозумілий порядок дій</h3>
        </div>
        <p className="section-copy">
          Спочатку додаєте платіж, потім перевіряєте його розподіл, після цього
          ведете штрафи і контроль боргів.
        </p>
      </section>

      <section className="card">
        <div className="workflow-inline">
          <span className="workflow-step">1</span>
          <p>`Додати платіж` у нижньому лівому блоці</p>
        </div>
        <div className="workflow-inline">
          <span className="workflow-step">2</span>
          <p>У списку платежів натиснути `Деталі` і перевірити розподіл</p>
        </div>
        <div className="workflow-inline">
          <span className="workflow-step">3</span>
          <p>За потреби додати/погасити штраф у блоці праворуч</p>
        </div>
      </section>

      <section className="stats-grid">
        <article className="card metric-card">
          <p className="card-kicker">Отримано коштів</p>
          <h3>{formatCurrency(stats?.total_received)} грн</h3>
          <p className="muted-text">Сума всіх вхідних платежів</p>
        </article>
        <article className="card metric-card">
          <p className="card-kicker">Розподілено</p>
          <h3>{formatCurrency(stats?.total_allocated)} грн</h3>
          <p className="muted-text">Сума, прив'язана до замовлень</p>
        </article>
        <article className="card metric-card">
          <p className="card-kicker">Нерозподілено</p>
          <h3>{formatCurrency(stats?.unallocated)} грн</h3>
          <p className="muted-text">Доступний залишок для рознесення</p>
        </article>
        <article className="card metric-card">
          <p className="card-kicker">Борг по виплатах</p>
          <h3>{formatCurrency(stats?.total_debt)} грн</h3>
          <p className="muted-text">
            Менеджери: {formatCurrency(stats?.total_manager_debt)} грн
          </p>
        </article>
      </section>

      {error ? (
        <section className="card error-card">
          <p className="card-kicker">Помилка</p>
          <p>{error}</p>
        </section>
      ) : null}

      <section className="detail-split-grid">
        <article className="card detail-col">
          <div className="section-head">
            <div>
              <p className="card-kicker">Платежі</p>
              <h3>Історія надходжень</h3>
            </div>
            <div className="detail-inline-actions">
              <button
                type="button"
                className="ghost-button"
                onClick={() => setShowOnlyUnallocated((prev) => !prev)}
              >
                {showOnlyUnallocated ? 'Показати всі' : 'Тільки нерозподілені'}
              </button>
              {isAdmin ? (
                <button
                  type="button"
                  className="primary-button"
                  onClick={handleRedistribute}
                  disabled={redistributing}
                >
                  {redistributing ? 'Перерозподіл...' : 'Перерозподілити'}
                </button>
              ) : null}
            </div>
          </div>

          <div className="detail-list">
            {filteredPayments.length === 0 ? (
              <p className="muted-text">Платежів у цьому режимі немає.</p>
            ) : (
              filteredPayments.map((payment) => {
                const selected = selectedPayment?.id === payment.id;
                return (
                  <div
                    key={payment.id}
                    className={`detail-list-row${selected ? ' detail-list-row-active' : ''}`}
                  >
                    <div>
                      <strong>{formatCurrency(payment.amount)} грн</strong>
                      <p className="muted-text">
                        {formatDate(payment.date_received)} • {payment.person_name}
                      </p>
                      {payment.notes ? (
                        <small className="muted-text">{payment.notes}</small>
                      ) : null}
                    </div>
                    <div className="detail-inline-actions">
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => handlePaymentSelect(payment)}
                      >
                        Деталі
                      </button>
                      {isAdmin ? (
                        <button
                          type="button"
                          className="danger-button"
                          onClick={() => handleDeletePayment(payment)}
                        >
                          Видалити
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </article>

        <article className="card detail-col">
          <div className="section-head">
            <div>
              <p className="card-kicker">Розподіл платежу</p>
              <h3>
                {selectedPayment
                  ? `Платіж #${selectedPayment.id} • ${formatCurrency(
                      selectedPayment.amount
                    )} грн`
                  : 'Оберіть платіж у списку'}
              </h3>
            </div>
          </div>

          {!selectedPayment ? (
            <p className="muted-text">
              Виберіть платіж зліва, щоб переглянути розподіл по замовленнях.
            </p>
          ) : (
            <>
              <div className="detail-finance-board">
                <div className="finance-box">
                  <span>Дата</span>
                  <strong>{formatDate(selectedPayment.date_received)}</strong>
                </div>
                <div className="finance-box">
                  <span>Розподілено</span>
                  <strong>{formatCurrency(selectedAllocatedTotal)} грн</strong>
                </div>
                <div className="finance-box">
                  <span>Залишок</span>
                  <strong>{formatCurrency(selectedRemaining)} грн</strong>
                </div>
                <div className="finance-box">
                  <span>Тип</span>
                  <strong>
                    {selectedPayment.manual_order_id ? 'Ручний' : 'Автоматичний'}
                  </strong>
                </div>
              </div>

              <div className="detail-list">
                {allocations.length === 0 ? (
                  <p className="muted-text">Для цього платежу немає розподілу.</p>
                ) : (
                  allocations.map((allocation, index) => (
                    <div key={`${allocation.order_id}-${index}`} className="detail-list-row">
                      <div>
                        <strong>
                          #{allocation.order_id} {allocation.order_name}
                        </strong>
                        <p className="muted-text">{getStageLabel(allocation.stage)}</p>
                      </div>
                      <strong>{formatCurrency(allocation.amount)} грн</strong>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </article>
      </section>

      <section className="detail-split-grid">
        {isAdmin ? (
          <article className="card detail-col">
            <p className="card-kicker">Додати платіж</p>
            <h3>Операція надходження коштів</h3>
            <form className="modal-form" onSubmit={handleCreatePayment}>
              <div className="detail-two-col">
                <label className="field">
                  <span>Сума</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={paymentForm.amount}
                    onChange={(event) =>
                      setPaymentForm((prev) => ({
                        ...prev,
                        amount: event.target.value,
                      }))
                    }
                    required
                  />
                </label>
                <label className="field">
                  <span>Дата отримання</span>
                  <input
                    type="date"
                    value={paymentForm.date_received}
                    onChange={(event) =>
                      setPaymentForm((prev) => ({
                        ...prev,
                        date_received: event.target.value,
                      }))
                    }
                    required
                  />
                </label>
              </div>

              <label className="field">
                <span>Режим розподілу</span>
                <select
                  value={paymentForm.target}
                  onChange={(event) =>
                    setPaymentForm((prev) => ({
                      ...prev,
                      target: event.target.value,
                    }))
                  }
                >
                  <option value="general">Загальний (авто)</option>
                  <option value="order">Конкретне замовлення</option>
                  <option value="constructor">По конструктору</option>
                  <option value="manager">По менеджеру</option>
                </select>
              </label>

              {paymentForm.target === 'order' ? (
                <label className="field">
                  <span>Замовлення</span>
                  <select
                    value={paymentForm.manual_order_id}
                    onChange={(event) =>
                      setPaymentForm((prev) => ({
                        ...prev,
                        manual_order_id: event.target.value,
                      }))
                    }
                    required
                  >
                    <option value="">Оберіть замовлення</option>
                    {orders.map((order) => (
                      <option key={order.id} value={order.id}>
                        #{order.id} {order.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {paymentForm.target === 'constructor' ? (
                <label className="field">
                  <span>Конструктор</span>
                  <select
                    value={paymentForm.constructor_id}
                    onChange={(event) =>
                      setPaymentForm((prev) => ({
                        ...prev,
                        constructor_id: event.target.value,
                      }))
                    }
                    required
                  >
                    <option value="">Оберіть конструктора</option>
                    {constructors.map((constructor) => (
                      <option key={constructor.id} value={constructor.id}>
                        {constructor.full_name || constructor.username}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {paymentForm.target === 'manager' ? (
                <label className="field">
                  <span>Менеджер</span>
                  <select
                    value={paymentForm.manager_id}
                    onChange={(event) =>
                      setPaymentForm((prev) => ({
                        ...prev,
                        manager_id: event.target.value,
                      }))
                    }
                    required
                  >
                    <option value="">Оберіть менеджера</option>
                    {managers.map((manager) => (
                      <option key={manager.id} value={manager.id}>
                        {manager.full_name || manager.username}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <label className="field">
                <span>Нотатка</span>
                <input
                  type="text"
                  value={paymentForm.notes}
                  onChange={(event) =>
                    setPaymentForm((prev) => ({
                      ...prev,
                      notes: event.target.value,
                    }))
                  }
                  placeholder="Коментар до платежу (необов'язково)"
                />
              </label>

              <button className="primary-button" type="submit" disabled={paymentSubmitting}>
                {paymentSubmitting ? 'Додавання...' : 'Додати платіж'}
              </button>
            </form>
          </article>
        ) : (
          <article className="card detail-col">
            <p className="card-kicker">Режим доступу</p>
            <h3>Операції платежів для вашої ролі обмежені</h3>
            <p className="muted-text">
              Ви можете переглядати свої фінансові дані та історію розподілу.
            </p>
          </article>
        )}

        <article className="card detail-col">
          <div className="section-head">
            <div>
              <p className="card-kicker">Штрафи / провини</p>
              <h3>Реєстр відрахувань</h3>
            </div>
            <div className="tag-row">
              <span className="tag">Всього: {formatCurrency(deductionStats.total)} грн</span>
              <span className="tag">
                Не погашено: {formatCurrency(deductionStats.unpaid)} грн
              </span>
            </div>
          </div>

          {canManage ? (
            <form className="modal-form" onSubmit={handleCreateDeduction}>
              <div className="detail-two-col">
                <label className="field">
                  <span>Замовлення</span>
                  <select
                    value={deductionForm.order_id}
                    onChange={(event) =>
                      setDeductionForm((prev) => ({
                        ...prev,
                        order_id: event.target.value,
                      }))
                    }
                    required
                  >
                    <option value="">Оберіть замовлення</option>
                    {orders.map((order) => (
                      <option key={order.id} value={order.id}>
                        #{order.id} {order.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Сума</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={deductionForm.amount}
                    onChange={(event) =>
                      setDeductionForm((prev) => ({
                        ...prev,
                        amount: event.target.value,
                      }))
                    }
                    required
                  />
                </label>
              </div>
              <div className="detail-two-col">
                <label className="field">
                  <span>Дата</span>
                  <input
                    type="date"
                    value={deductionForm.date_created}
                    onChange={(event) =>
                      setDeductionForm((prev) => ({
                        ...prev,
                        date_created: event.target.value,
                      }))
                    }
                    required
                  />
                </label>
                <label className="field">
                  <span>Опис</span>
                  <input
                    type="text"
                    value={deductionForm.description}
                    onChange={(event) =>
                      setDeductionForm((prev) => ({
                        ...prev,
                        description: event.target.value,
                      }))
                    }
                    required
                  />
                </label>
              </div>
              <button className="primary-button" type="submit" disabled={deductionSubmitting}>
                {deductionSubmitting ? 'Додавання...' : 'Додати штраф'}
              </button>
            </form>
          ) : null}

          <div className="detail-list">
            {deductions.length === 0 ? (
              <p className="muted-text">Штрафів поки немає.</p>
            ) : (
              deductions.map((deduction) => (
                <div key={deduction.id} className="detail-list-row">
                  <div>
                    <strong>{formatCurrency(deduction.amount)} грн</strong>
                    <p className="muted-text">
                      #{deduction.order_id} {deduction.order_name}
                    </p>
                    <small className="muted-text">
                      {formatDate(deduction.date_created)}
                      {deduction.is_paid
                        ? ` • погашено ${formatDate(deduction.date_paid)}`
                        : ' • не погашено'}
                    </small>
                  </div>
                  {canManage ? (
                    <div className="detail-inline-actions">
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => handleToggleDeductionPaid(deduction)}
                      >
                        {deduction.is_paid ? 'Зняти погашення' : 'Погасити'}
                      </button>
                      <button
                        type="button"
                        className="danger-button"
                        onClick={() => handleDeleteDeduction(deduction.id)}
                      >
                        Видалити
                      </button>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
