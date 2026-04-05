import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

export default function ProtectedRoute() {
  const { user, loading, getHomePath } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="splash-screen">
        <div className="splash-card card">
          <p className="card-kicker">Завантаження</p>
          <h2>Перевіряємо сесію та права доступу</h2>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  const homePath = getHomePath();
  if (location.pathname === '/login') {
    return <Navigate to={homePath} replace />;
  }

  return <Outlet />;
}
