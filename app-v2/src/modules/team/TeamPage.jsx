import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { roleLabels } from '../auth/access';
import {
  createTeamUser,
  deleteTeamUser,
  fetchTeamUsers,
  updateTeamUser,
} from './teamApi';

const ALL_ROLES = ['super_admin', 'admin', 'manager', 'constructor'];
const ROLE_PRIORITY = {
  super_admin: 0,
  admin: 1,
  manager: 2,
  constructor: 3,
};

function emptyCreateForm(defaultRole) {
  return {
    username: '',
    password: '',
    full_name: '',
    role: defaultRole,
    email: '',
    phone_number: '',
    card_number: '',
  };
}

function toEditableUser(user) {
  return {
    id: user.id,
    username: user.username || '',
    full_name: user.full_name || '',
    role: user.role || 'constructor',
    is_active: user.is_active !== false,
    email: user.email || '',
    phone_number: user.phone_number || '',
    card_number: user.card_number || '',
    password: '',
  };
}

export default function TeamPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';

  const availableRoles = useMemo(
    () =>
      isSuperAdmin
        ? ALL_ROLES
        : ALL_ROLES.filter((role) => role !== 'super_admin'),
    [isSuperAdmin]
  );
  const defaultCreateRole = useMemo(
    () =>
      availableRoles.includes('constructor')
        ? 'constructor'
        : availableRoles[0] || 'constructor',
    [availableRoles]
  );

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [createForm, setCreateForm] = useState(() =>
    emptyCreateForm(defaultCreateRole)
  );
  const [editingUser, setEditingUser] = useState(null);

  useEffect(() => {
    setCreateForm((prev) => {
      if (availableRoles.includes(prev.role)) return prev;
      return { ...prev, role: defaultCreateRole };
    });
  }, [availableRoles, defaultCreateRole]);

  const sortedUsers = useMemo(() => {
    const list = [...users];
    list.sort((a, b) => {
      const roleDiff =
        (ROLE_PRIORITY[a.role] ?? 99) - (ROLE_PRIORITY[b.role] ?? 99);
      if (roleDiff !== 0) return roleDiff;

      const aName = (a.full_name || a.username || '').toLowerCase();
      const bName = (b.full_name || b.username || '').toLowerCase();
      return aName.localeCompare(bName);
    });
    return list;
  }, [users]);

  const roleCounts = useMemo(() => {
    return sortedUsers.reduce(
      (acc, row) => {
        acc.total += 1;
        if (row.is_active) acc.active += 1;
        if (row.role === 'super_admin') acc.super_admin += 1;
        if (row.role === 'admin') acc.admin += 1;
        if (row.role === 'manager') acc.manager += 1;
        if (row.role === 'constructor') acc.constructor += 1;
        return acc;
      },
      {
        total: 0,
        active: 0,
        super_admin: 0,
        admin: 0,
        manager: 0,
        constructor: 0,
      }
    );
  }, [sortedUsers]);

  const loadUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await fetchTeamUsers();
      setUsers(rows);
    } catch (loadError) {
      setError(
        loadError?.response?.data?.detail ||
          'Не вдалося завантажити список користувачів'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = async (event) => {
    event.preventDefault();
    setCreating(true);
    setError('');
    setSuccess('');

    if (!isSuperAdmin && createForm.role === 'super_admin') {
      setError('Адмін не може створювати користувача з роллю суперадмін.');
      setCreating(false);
      return;
    }

    try {
      await createTeamUser({
        username: createForm.username.trim(),
        password: createForm.password,
        full_name: createForm.full_name.trim(),
        role: createForm.role,
        email: createForm.email.trim() || null,
        phone_number: createForm.phone_number.trim() || null,
        card_number: createForm.card_number.trim() || null,
      });

      setCreateForm(emptyCreateForm(defaultCreateRole));
      setSuccess('Користувача успішно додано.');
      await loadUsers();
    } catch (createError) {
      setError(
        createError?.response?.data?.detail || 'Не вдалося додати користувача'
      );
    } finally {
      setCreating(false);
    }
  };

  const handleStartEdit = (targetUser) => {
    setError('');
    setSuccess('');
    setEditingUser(toEditableUser(targetUser));
  };

  const handleUpdate = async (event) => {
    event.preventDefault();
    if (!editingUser) return;

    setUpdating(true);
    setError('');
    setSuccess('');

    if (!isSuperAdmin && editingUser.role === 'super_admin') {
      setError('Адмін не може змінювати роль на суперадмін.');
      setUpdating(false);
      return;
    }

    try {
      const payload = {
        full_name: editingUser.full_name.trim(),
        role: editingUser.role,
        is_active: editingUser.is_active,
        email: editingUser.email.trim() || null,
        phone_number: editingUser.phone_number.trim() || null,
        card_number: editingUser.card_number.trim() || null,
      };

      if (editingUser.password) {
        payload.password = editingUser.password;
      }

      await updateTeamUser(editingUser.id, payload);
      setSuccess('Дані користувача оновлено.');
      setEditingUser(null);
      await loadUsers();
    } catch (updateError) {
      setError(
        updateError?.response?.data?.detail ||
          'Не вдалося оновити користувача'
      );
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async (targetUser) => {
    if (targetUser.id === user?.id) {
      setError('Не можна видалити поточний обліковий запис.');
      setSuccess('');
      return;
    }

    if (!isSuperAdmin && targetUser.role === 'super_admin') {
      setError('Адмін не може видаляти суперадміна.');
      setSuccess('');
      return;
    }

    const confirmed = window.confirm(
      `Видалити користувача "${targetUser.full_name || targetUser.username}"?`
    );
    if (!confirmed) return;

    setDeletingId(targetUser.id);
    setError('');
    setSuccess('');
    try {
      await deleteTeamUser(targetUser.id);
      if (editingUser?.id === targetUser.id) {
        setEditingUser(null);
      }
      setSuccess('Користувача видалено.');
      await loadUsers();
    } catch (deleteError) {
      setError(
        deleteError?.response?.data?.detail ||
          'Не вдалося видалити користувача'
      );
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <section className="card">
        <p className="card-kicker">Завантаження</p>
        <h3>Отримуємо список користувачів</h3>
      </section>
    );
  }

  return (
    <div className="page-stack">
      <section className="section-head">
        <div>
          <p className="eyebrow">Користувачі</p>
          <h3>Додавання, ролі та доступи</h3>
        </div>
        <p className="section-copy">
          Тут ви керуєте командою: створюєте нових користувачів, змінюєте роль
          і вимикаєте доступ, якщо потрібно.
        </p>
      </section>

      <section className="card">
        <div className="workflow-inline">
          <span className="workflow-step">1</span>
          <p>У лівому блоці заповніть форму `Додати користувача`</p>
        </div>
        <div className="workflow-inline">
          <span className="workflow-step">2</span>
          <p>У списку натисніть `Редагувати` щоб змінити роль чи статус</p>
        </div>
        <div className="workflow-inline">
          <span className="workflow-step">3</span>
          <p>`Видалити` використовуйте тільки для непотрібних облікових записів</p>
        </div>
      </section>

      <section className="stats-grid">
        <article className="card metric-card">
          <p className="card-kicker">Всього користувачів</p>
          <h3>{roleCounts.total}</h3>
          <p className="muted-text">Усі облікові записи системи</p>
        </article>
        <article className="card metric-card">
          <p className="card-kicker">Активні</p>
          <h3>{roleCounts.active}</h3>
          <p className="muted-text">Мають доступ до входу</p>
        </article>
        <article className="card metric-card">
          <p className="card-kicker">Адміністрація</p>
          <h3>{roleCounts.super_admin + roleCounts.admin}</h3>
          <p className="muted-text">
            Суперадмін: {roleCounts.super_admin} • Адмін: {roleCounts.admin}
          </p>
        </article>
        <article className="card metric-card">
          <p className="card-kicker">Операційні ролі</p>
          <h3>{roleCounts.manager + roleCounts.constructor}</h3>
          <p className="muted-text">
            Менеджер: {roleCounts.manager} • Конструктор: {roleCounts.constructor}
          </p>
        </article>
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

      <section className="detail-split-grid">
        <article className="card detail-col">
          <p className="card-kicker">Додати користувача</p>
          <h3>Новий обліковий запис</h3>
          <form className="modal-form" onSubmit={handleCreate}>
            <div className="detail-two-col">
              <label className="field">
                <span>Логін</span>
                <input
                  type="text"
                  value={createForm.username}
                  onChange={(event) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      username: event.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label className="field">
                <span>Пароль</span>
                <input
                  type="password"
                  value={createForm.password}
                  onChange={(event) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      password: event.target.value,
                    }))
                  }
                  required
                />
              </label>
            </div>

            <div className="detail-two-col">
              <label className="field">
                <span>Ім'я та прізвище</span>
                <input
                  type="text"
                  value={createForm.full_name}
                  onChange={(event) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      full_name: event.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label className="field">
                <span>Роль</span>
                <select
                  value={createForm.role}
                  onChange={(event) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      role: event.target.value,
                    }))
                  }
                  required
                >
                  {availableRoles.map((role) => (
                    <option key={role} value={role}>
                      {roleLabels[role] || role}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="detail-two-col">
              <label className="field">
                <span>Email (необов'язково)</span>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(event) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      email: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="field">
                <span>Телефон (необов'язково)</span>
                <input
                  type="text"
                  value={createForm.phone_number}
                  onChange={(event) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      phone_number: event.target.value,
                    }))
                  }
                />
              </label>
            </div>

            <label className="field">
              <span>Номер картки (необов'язково)</span>
              <input
                type="text"
                value={createForm.card_number}
                onChange={(event) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    card_number: event.target.value,
                  }))
                }
              />
            </label>

            <button className="primary-button" type="submit" disabled={creating}>
              {creating ? 'Додавання...' : 'Додати користувача'}
            </button>
          </form>
        </article>

        <article className="card detail-col">
          <p className="card-kicker">Редагування користувача</p>
          {!editingUser ? (
            <>
              <h3>Оберіть користувача зі списку</h3>
              <p className="muted-text">
                Натисніть кнопку `Редагувати` праворуч у потрібному рядку.
              </p>
            </>
          ) : (
            <>
              <h3>{editingUser.full_name || editingUser.username}</h3>
              <form className="modal-form" onSubmit={handleUpdate}>
                <div className="detail-two-col">
                  <label className="field">
                    <span>Логін</span>
                    <input type="text" value={editingUser.username} disabled />
                  </label>
                  <label className="field">
                    <span>Статус доступу</span>
                    <select
                      value={editingUser.is_active ? 'active' : 'disabled'}
                      onChange={(event) =>
                        setEditingUser((prev) => ({
                          ...prev,
                          is_active: event.target.value === 'active',
                        }))
                      }
                    >
                      <option value="active">Активний</option>
                      <option value="disabled">Вимкнений</option>
                    </select>
                  </label>
                </div>

                <div className="detail-two-col">
                  <label className="field">
                    <span>Ім'я та прізвище</span>
                    <input
                      type="text"
                      value={editingUser.full_name}
                      onChange={(event) =>
                        setEditingUser((prev) => ({
                          ...prev,
                          full_name: event.target.value,
                        }))
                      }
                      required
                    />
                  </label>
                  <label className="field">
                    <span>Роль</span>
                    <select
                      value={editingUser.role}
                      onChange={(event) =>
                        setEditingUser((prev) => ({
                          ...prev,
                          role: event.target.value,
                        }))
                      }
                      disabled={
                        !isSuperAdmin &&
                        (editingUser.role === 'super_admin' ||
                          !availableRoles.includes(editingUser.role))
                      }
                    >
                      {availableRoles.includes(editingUser.role) ? null : (
                        <option value={editingUser.role}>
                          {roleLabels[editingUser.role] || editingUser.role}
                        </option>
                      )}
                      {availableRoles.map((role) => (
                        <option key={role} value={role}>
                          {roleLabels[role] || role}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="detail-two-col">
                  <label className="field">
                    <span>Email</span>
                    <input
                      type="email"
                      value={editingUser.email}
                      onChange={(event) =>
                        setEditingUser((prev) => ({
                          ...prev,
                          email: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Телефон</span>
                    <input
                      type="text"
                      value={editingUser.phone_number}
                      onChange={(event) =>
                        setEditingUser((prev) => ({
                          ...prev,
                          phone_number: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>

                <div className="detail-two-col">
                  <label className="field">
                    <span>Номер картки</span>
                    <input
                      type="text"
                      value={editingUser.card_number}
                      onChange={(event) =>
                        setEditingUser((prev) => ({
                          ...prev,
                          card_number: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Новий пароль (необов'язково)</span>
                    <input
                      type="password"
                      value={editingUser.password}
                      onChange={(event) =>
                        setEditingUser((prev) => ({
                          ...prev,
                          password: event.target.value,
                        }))
                      }
                      placeholder="Введіть тільки якщо треба змінити"
                    />
                  </label>
                </div>

                <div className="detail-inline-actions">
                  <button className="primary-button" type="submit" disabled={updating}>
                    {updating ? 'Збереження...' : 'Зберегти зміни'}
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => setEditingUser(null)}
                  >
                    Скасувати
                  </button>
                </div>
              </form>
            </>
          )}
        </article>
      </section>

      <section className="card">
        <div className="section-head">
          <div>
            <p className="card-kicker">Список користувачів</p>
            <h3>Хто працює в системі</h3>
          </div>
        </div>

        <div className="detail-list">
          {sortedUsers.length === 0 ? (
            <p className="muted-text">Користувачів поки немає.</p>
          ) : (
            sortedUsers.map((row) => {
              const lockedByRole = !isSuperAdmin && row.role === 'super_admin';
              const deleting = deletingId === row.id;

              return (
                <div key={row.id} className="detail-list-row">
                  <div className="team-user-main">
                    <strong>{row.full_name || row.username}</strong>
                    <p className="muted-text">
                      @{row.username} • {roleLabels[row.role] || row.role} •{' '}
                      {row.is_active ? 'активний' : 'вимкнений'}
                    </p>
                    <small className="muted-text">
                      {row.email || 'email не вказано'}
                      {' • '}
                      {row.phone_number || 'телефон не вказано'}
                    </small>
                  </div>

                  <div className="detail-inline-actions">
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => handleStartEdit(row)}
                      disabled={lockedByRole}
                    >
                      Редагувати
                    </button>
                    <button
                      type="button"
                      className="danger-button"
                      onClick={() => handleDelete(row)}
                      disabled={lockedByRole || row.id === user?.id || deleting}
                    >
                      {deleting ? 'Видалення...' : 'Видалити'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
