import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { createOrder, fetchOrders, fetchUsers } from './orderApi';
import CreateOrderModal from './CreateOrderModal';
import {
  formatCurrency,
  formatDate,
  getOrderStatus,
  getPaymentStatus,
  isArchivedOrder,
  parseProductTypes,
} from './orderUtils';

export default function OrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('active');
  const [sortBy, setSortBy] = useState('id');
  const [sortOrder, setSortOrder] = useState('desc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canReadUsers =
    user?.role === 'admin' ||
    user?.role === 'super_admin' ||
    user?.role === 'manager';

  useEffect(() => {
    const loadOrders = async () => {
      setLoading(true);
      setError('');

      try {
        const nextOrders = await fetchOrders({
          search: search || undefined,
          sort_by: sortBy,
          sort_order: sortOrder,
        });
        setOrders(nextOrders);
      } catch (loadError) {
        setError('Не вдалося завантажити замовлення');
      } finally {
        setLoading(false);
      }
    };

    loadOrders();
  }, [search, sortBy, sortOrder]);

  useEffect(() => {
    if (!canReadUsers) return;

    const loadUsers = async () => {
      try {
        const nextUsers = await fetchUsers();
        setUsers(nextUsers);
      } catch (usersError) {
        setUsers([]);
      }
    };

    loadUsers();
  }, [canReadUsers]);

  const usersById = useMemo(
    () => new Map(users.map((entry) => [entry.id, entry])),
    [users]
  );

  const visibleOrders = useMemo(() => {
    return orders.filter((order) => {
      const archived = isArchivedOrder(order);
      return viewMode === 'active' ? !archived : archived;
    });
  }, [orders, viewMode]);

  const totalDebt = useMemo(
    () =>
      visibleOrders.reduce(
        (sum, order) => sum + Number(order.current_debt || 0),
        0
      ),
    [visibleOrders]
  );

  const totalPrice = useMemo(
    () =>
      visibleOrders.reduce((sum, order) => sum + Number(order.price || 0), 0),
    [visibleOrders]
  );

  const handleCreateOrder = async (payload) => {
    setSubmitting(true);
    try {
      await createOrder(payload);
      setIsCreateOpen(false);
      const refreshed = await fetchOrders({
        search: search || undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
      });
      setOrders(refreshed);
    } catch (submitError) {
      setError(
        submitError?.response?.data?.detail ||
          'Не вдалося створити замовлення'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const canSeeConstructorPay =
    user?.role !== 'manager' || user?.can_see_constructor_pay !== false;
  const canSeeDebt =
    user?.role !== 'manager' || user?.can_see_debt !== false;

  return (
    <div className="page-stack">
      <section className="section-head">
        <div>
          <p className="eyebrow">Реєстр замовлень</p>
          <h3>Простий робочий екран</h3>
        </div>
        <p className="section-copy">
          Тут все по кроках: знайдіть замовлення, відкрийте картку, відредагуйте
          дані або створіть нове.
        </p>
      </section>

      <section className="card">
        <div className="workflow-inline">
          <span className="workflow-step">1</span>
          <p>Оберіть режим: `Активні` або `Архів`</p>
        </div>
        <div className="workflow-inline">
          <span className="workflow-step">2</span>
          <p>Знайдіть потрібне замовлення через пошук</p>
        </div>
        <div className="workflow-inline">
          <span className="workflow-step">3</span>
          <p>Натисніть `Відкрити картку` для детальної роботи</p>
        </div>
      </section>

      <section className="stats-grid">
        <article className="card metric-card">
          <p className="card-kicker">У списку зараз</p>
          <h3>{visibleOrders.length}</h3>
          <p className="muted-text">
            {viewMode === 'active' ? 'Активні замовлення' : 'Архівні замовлення'}
          </p>
        </article>

        <article className="card metric-card">
          <p className="card-kicker">Сума по вибірці</p>
          <h3>{formatCurrency(totalPrice)} грн</h3>
          <p className="muted-text">Сумарна вартість поточного списку</p>
        </article>

        <article className="card metric-card">
          <p className="card-kicker">Борг по етапах</p>
          <h3>{formatCurrency(totalDebt)} грн</h3>
          <p className="muted-text">Тільки по замовленнях у поточному режимі</p>
        </article>

        <article className="card metric-card">
          <p className="card-kicker">Роль у системі</p>
          <h3>{user?.role || '—'}</h3>
          <p className="muted-text">
            Видимість колонок і дій уже починає залежати від ролі
          </p>
        </article>
      </section>

      <section className="card orders-toolbar-card">
        <div className="orders-toolbar">
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
              className={viewMode === 'archived' ? 'segment-active' : ''}
              onClick={() => setViewMode('archived')}
            >
              Архів
            </button>
          </div>

          <label className="toolbar-search">
            <span>Пошук</span>
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ID або назва"
            />
          </label>

          <label className="field compact-field">
            <span>Сортувати</span>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
            >
              <option value="id">За ID</option>
              <option value="name">За назвою</option>
            </select>
          </label>

          <label className="field compact-field">
            <span>Порядок</span>
            <select
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value)}
            >
              <option value="desc">Спочатку новіші</option>
              <option value="asc">Спочатку старіші</option>
            </select>
          </label>

          <button className="primary-button" onClick={() => setIsCreateOpen(true)}>
            Нове замовлення
          </button>
        </div>
      </section>

      {error ? (
        <section className="card error-card">
          <p className="card-kicker">Помилка</p>
          <p>{error}</p>
        </section>
      ) : null}

      <section className="orders-list">
        {loading ? (
          <article className="card empty-state-card">
            <p className="card-kicker">Завантаження</p>
            <h4>Отримуємо список замовлень</h4>
          </article>
        ) : visibleOrders.length === 0 ? (
          <article className="card empty-state-card">
            <p className="card-kicker">Порожньо</p>
            <h4>За цими фільтрами замовлень немає</h4>
            <p className="muted-text">
              Спробуйте змінити режим, пошук або створити нове замовлення.
            </p>
          </article>
        ) : (
          visibleOrders.map((order) => {
            const orderStatus = getOrderStatus(order);
            const paymentStatus = getPaymentStatus(order);
            const constructorName = usersById.get(order.constructor_id)?.full_name;
            const managerName = usersById.get(order.manager_id)?.full_name;
            const productTypes = parseProductTypes(order.product_types);

            return (
              <article key={order.id} className="card order-card">
                <div className="order-card-top">
                  <div>
                    <p className="card-kicker">Замовлення #{order.id}</p>
                    <h4>{order.name}</h4>
                  </div>
                  <div className="order-statuses">
                    <span className={`status-pill status-${orderStatus.tone}`}>
                      {orderStatus.label}
                    </span>
                    <span className={`status-pill status-${paymentStatus.tone}`}>
                      {paymentStatus.label}
                    </span>
                  </div>
                </div>

                <div className="order-meta-grid">
                  <div className="order-meta-block">
                    <span>Дата отримання</span>
                    <strong>{formatDate(order.date_received)}</strong>
                  </div>
                  <div className="order-meta-block">
                    <span>Дедлайн конструктиву</span>
                    <strong>{formatDate(order.date_design_deadline)}</strong>
                  </div>
                  <div className="order-meta-block">
                    <span>План монтажу</span>
                    <strong>{formatDate(order.date_installation_plan)}</strong>
                  </div>
                  <div className="order-meta-block">
                    <span>Факт монтажу</span>
                    <strong>{formatDate(order.date_installation)}</strong>
                  </div>
                </div>

                <div className="order-assignees">
                  <div>
                    <span>Конструктор</span>
                    <strong>{constructorName || order.constructor_id || 'Не призначено'}</strong>
                  </div>
                  <div>
                    <span>Менеджер</span>
                    <strong>{managerName || order.manager_id || 'Не призначено'}</strong>
                  </div>
                </div>

                {productTypes.length > 0 ? (
                  <div className="tag-row">
                    {productTypes.map((type) => (
                      <span key={`${order.id}-${type}`} className="tag subtle-tag">
                        {type}
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className="order-finance-grid">
                  <div className="finance-box">
                    <span>Ціна</span>
                    <strong>{formatCurrency(order.price)} грн</strong>
                  </div>

                  {canSeeConstructorPay ? (
                    <div className="finance-box">
                      <span>Оплата конструктора</span>
                      <strong>{formatCurrency(order.bonus)} грн</strong>
                    </div>
                  ) : null}

                  {canSeeDebt ? (
                    <div className="finance-box">
                      <span>Борг по етапах</span>
                      <strong>{formatCurrency(order.current_debt)} грн</strong>
                    </div>
                  ) : null}

                  <div className="finance-box">
                    <span>Залишок по замовленню</span>
                    <strong>{formatCurrency(order.remainder_amount)} грн</strong>
                  </div>
                </div>

                <div className="stage-line">
                  <span className="stage-pill stage-constructive">
                    Конструктив: {order.constructive_days} дн.
                  </span>
                  <span className="stage-pill stage-complectation">
                    Комплектація: {order.complectation_days} дн.
                  </span>
                  <span className="stage-pill stage-preassembly">
                    Предзбірка: {order.preassembly_days} дн.
                  </span>
                  <span className="stage-pill stage-installation">
                    Монтаж: {order.installation_days} дн.
                  </span>
                </div>

                <div className="detail-inline-actions">
                  <Link className="primary-button" to={`/orders/${order.id}`}>
                    Відкрити картку
                  </Link>
                </div>
              </article>
            );
          })
        )}
      </section>

      <CreateOrderModal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreateOrder}
        users={users}
        currentUser={user}
        submitting={submitting}
      />
    </div>
  );
}
