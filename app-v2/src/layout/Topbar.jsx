import { useLocation } from 'react-router-dom';
import { navigation } from '../app/navigation';
import { useAuth } from '../modules/auth/AuthContext';
import { roleLabels } from '../modules/auth/access';

export default function Topbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const currentPage =
    navigation.find(
      (item) =>
        item.to === location.pathname ||
        location.pathname.startsWith(`${item.to}/`)
    ) || navigation[0];
  const today = new Intl.DateTimeFormat('uk-UA', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">Розділ</p>
        <h2>{currentPage.label}</h2>
        <p className="topbar-sub">
          {currentPage.caption} • {today}
        </p>
      </div>

      <div className="topbar-actions">
        <div className="topbar-pill">{user?.full_name || user?.username}</div>
        <div className="topbar-pill">{roleLabels[user?.role] || user?.role}</div>
        <button className="topbar-button" onClick={logout}>
          Вийти
        </button>
      </div>
    </header>
  );
}
