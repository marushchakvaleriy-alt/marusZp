import { NavLink } from 'react-router-dom';
import { navigation } from '../app/navigation';
import { useAuth } from '../modules/auth/AuthContext';
import { roleLabels } from '../modules/auth/access';

export default function Sidebar() {
  const { user, canAccessPage } = useAuth();
  const visibleNavigation = navigation.filter((item) => canAccessPage(item.pageKey));

  return (
    <aside className="sidebar">
      <div className="brand-block">
        <div className="brand-mark">V2</div>
        <div>
          <p className="eyebrow">Production OS</p>
          <h1>Робоче меню</h1>
        </div>
      </div>

      <div className="sidebar-user sidebar-user-compact">
        <strong>{user?.full_name || user?.username}</strong>
        <span>{roleLabels[user?.role] || user?.role || 'guest'}</span>
      </div>

      <nav className="nav-list">
        {visibleNavigation.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `nav-item${isActive ? ' nav-item-active' : ''}`
            }
          >
            <span className="nav-title">{item.label}</span>
            <span className="nav-caption">{item.caption}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
