import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

export default function RoleGate({ pageKey, children }) {
  const { canAccessPage, getHomePath } = useAuth();
  const location = useLocation();

  if (canAccessPage(pageKey)) {
    return children;
  }

  return (
    <div className="page-stack">
      <section className="card access-card">
        <p className="card-kicker">Доступ обмежено</p>
        <h3>Ця сторінка недоступна для вашої ролі</h3>
        <p className="muted-text">
          Поточний шлях: {location.pathname}. Для цієї ролі ми сховаємо модуль із
          навігації та перенаправимо на перший доступний розділ.
        </p>
        <Navigate to={getHomePath()} replace />
      </section>
    </div>
  );
}
