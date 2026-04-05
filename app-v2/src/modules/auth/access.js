export const roleLabels = {
  super_admin: 'Суперадмін',
  admin: 'Адмін',
  manager: 'Менеджер',
  constructor: 'Конструктор',
};

export const pageAccess = {
  dashboard: ['super_admin', 'admin', 'manager', 'constructor'],
  orders: ['super_admin', 'admin', 'manager', 'constructor'],
  planning: ['super_admin', 'admin', 'manager', 'constructor'],
  finance: ['super_admin', 'admin', 'manager', 'constructor'],
  team: ['super_admin', 'admin'],
  settings: ['super_admin', 'admin'],
};

export function canAccessPage(user, pageKey) {
  if (!user) return false;

  if (pageKey === 'dashboard' && user.role === 'manager') {
    return user.can_see_dashboard !== false;
  }

  return pageAccess[pageKey]?.includes(user.role) ?? false;
}

export function getFirstAllowedPath(user) {
  const candidates = [
    ['/dashboard', 'dashboard'],
    ['/orders', 'orders'],
    ['/planning', 'planning'],
    ['/finance', 'finance'],
    ['/team', 'team'],
    ['/settings', 'settings'],
  ];

  const match = candidates.find(([, pageKey]) => canAccessPage(user, pageKey));
  return match?.[0] || '/login';
}
