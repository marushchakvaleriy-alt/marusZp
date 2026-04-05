import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { fetchFinancialStats } from '../finance/financeApi';
import { fetchOrders } from '../orders/orderApi';
import { formatCurrency, isArchivedOrder } from '../orders/orderUtils';

function parseDate(value) {
  if (!value) return null;
  const [year, month, day] = String(value).split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export default function DashboardPage() {
  const { canAccessPage } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError('');

      const [ordersResult, statsResult] = await Promise.allSettled([
        fetchOrders({ limit: 500, sort_by: 'id', sort_order: 'desc' }),
        fetchFinancialStats(),
      ]);

      if (ordersResult.status === 'fulfilled') {
        setOrders(ordersResult.value);
      } else {
        setOrders([]);
        setError('Не вдалося завантажити аналітику по замовленнях.');
      }

      if (statsResult.status === 'fulfilled') {
        setStats(statsResult.value);
      } else {
        setStats(null);
      }

      setLoading(false);
    };

    loadData();
  }, []);

  const metrics = useMemo(() => {
    const activeOrders = orders.filter((order) => !isArchivedOrder(order));
    const today = startOfDay(new Date());
    const weekEnd = addDays(today, 7);

    const dueSoon = activeOrders.filter((order) => {
      const deadline = parseDate(order.date_design_deadline);
      if (!deadline) return false;
      return deadline >= today && deadline <= weekEnd;
    }).length;

    const thisWeekInstallations = activeOrders.filter((order) => {
      const installDate = parseDate(order.date_installation_plan);
      if (!installDate) return false;
      return installDate >= today && installDate <= weekEnd;
    }).length;

    return {
      activeOrders: activeOrders.length,
      dueSoon,
      thisWeekInstallations,
      unallocated: Number(stats?.unallocated || 0),
      totalDebt: Number(stats?.total_debt || 0),
    };
  }, [orders, stats]);

  const quickActions = [
    { pageKey: 'orders', to: '/orders', label: 'Відкрити замовлення' },
    { pageKey: 'planning', to: '/planning', label: 'Відкрити планування' },
    { pageKey: 'finance', to: '/finance', label: 'Відкрити фінанси' },
    { pageKey: 'team', to: '/team', label: 'Користувачі' },
  ].filter((item) => canAccessPage(item.pageKey));

  if (loading) {
    return (
      <section className="card">
        <p className="card-kicker">Завантаження</p>
        <h3>Оновлюємо дані робочого дня</h3>
      </section>
    );
  }

  return (
    <div className="page-stack">
      <section className="card">
        <p className="card-kicker">Швидкі дії</p>
        <h3>Що робимо сьогодні</h3>
        <div className="quick-actions-row">
          {quickActions.map((action) => (
            <Link key={action.to} className="primary-button" to={action.to}>
              {action.label}
            </Link>
          ))}
        </div>
      </section>

      {error ? (
        <section className="card error-card">
          <p className="card-kicker">Помилка</p>
          <p>{error}</p>
        </section>
      ) : null}

      <section className="stats-grid">
        <article className="card metric-card">
          <p className="card-kicker">Активні замовлення</p>
          <h3>{metrics.activeOrders}</h3>
          <p className="muted-text">В роботі зараз</p>
        </article>
        <article className="card metric-card">
          <p className="card-kicker">Дедлайн до 7 днів</p>
          <h3>{metrics.dueSoon}</h3>
          <p className="muted-text">По конструктиву</p>
        </article>
        <article className="card metric-card">
          <p className="card-kicker">Монтажі на 7 днів</p>
          <h3>{metrics.thisWeekInstallations}</h3>
          <p className="muted-text">За планом монтажу</p>
        </article>
        <article className="card metric-card">
          <p className="card-kicker">Нерозподілені кошти</p>
          <h3>{formatCurrency(metrics.unallocated)} грн</h3>
          <p className="muted-text">
            Борг по виплатах: {formatCurrency(metrics.totalDebt)} грн
          </p>
        </article>
      </section>
    </div>
  );
}
