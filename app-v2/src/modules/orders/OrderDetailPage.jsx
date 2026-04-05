import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import {
  addFileLink,
  createDeduction,
  deleteDeduction,
  deleteOrder,
  fetchDeductions,
  fetchOrder,
  fetchOrderFiles,
  fetchUsers,
  removeFileLink,
  updateDeduction,
  updateOrder,
} from './orderApi';
import {
  formatCurrency,
  formatDate,
  getOrderStatus,
  getPaymentStatus,
  parseProductTypes,
  productOptions,
} from './orderUtils';

const folderOptions = [
  'Проджекти',
  'Перекупні позиції',
  'Метал',
  'Креслення',
  'Погодження',
  'Фурнітура',
];

function toInputDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function getInitialForm(order) {
  return {
    name: order.name || '',
    price: order.price ?? '',
    material_cost: order.material_cost ?? '',
    fixed_bonus: order.fixed_bonus ?? '',
    constructor_id: order.constructor_id ?? '',
    manager_id: order.manager_id ?? '',
    product_types: parseProductTypes(order.product_types),
    date_received: toInputDate(order.date_received),
    date_design_deadline: toInputDate(order.date_design_deadline),
    date_to_work: toInputDate(order.date_to_work),
    date_installation_plan: toInputDate(order.date_installation_plan),
    date_installation: toInputDate(order.date_installation),
    date_advance_paid: toInputDate(order.date_advance_paid),
    date_final_paid: toInputDate(order.date_final_paid),
    date_manager_paid: toInputDate(order.date_manager_paid),
    manager_paid_amount: order.manager_paid_amount ?? '',
    constructive_days: order.constructive_days ?? 5,
    complectation_days: order.complectation_days ?? 2,
    preassembly_days: order.preassembly_days ?? 1,
    installation_days: order.installation_days ?? 3,
  };
}

export default function OrderDetailPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [order, setOrder] = useState(null);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(null);
  const [deductions, setDeductions] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [newDeduction, setNewDeduction] = useState({
    amount: '',
    description: '',
    date_created: new Date().toISOString().slice(0, 10),
  });
  const [newFile, setNewFile] = useState({
    name: '',
    url: '',
    folder_name: folderOptions[0],
  });

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isManager = user?.role === 'manager';
  const canManage = isAdmin || isManager;
  const canReadUsers = canManage;

  const usersById = useMemo(
    () => new Map(users.map((entry) => [entry.id, entry])),
    [users]
  );

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

  const loadPage = async () => {
    if (!orderId) return;
    setLoading(true);
    setError('');
    try {
      const [orderData, deductionsData, filesData] = await Promise.all([
        fetchOrder(orderId),
        fetchDeductions(orderId),
        fetchOrderFiles(orderId),
      ]);

      setOrder(orderData);
      setForm(getInitialForm(orderData));
      setDeductions(deductionsData);
      setFiles(filesData);

      if (canReadUsers) {
        const usersData = await fetchUsers();
        setUsers(usersData);
      } else {
        setUsers([]);
      }
    } catch (loadError) {
      setError(
        loadError?.response?.data?.detail ||
          'Не вдалося завантажити деталі замовлення'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPage();
  }, [orderId, canReadUsers]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateField = (field, value) => {
    setForm((previous) => ({ ...previous, [field]: value }));
  };

  const handleToggleType = (type) => {
    setForm((previous) => ({
      ...previous,
      product_types: previous.product_types.includes(type)
        ? previous.product_types.filter((item) => item !== type)
        : [...previous.product_types, type],
    }));
  };

  const handleSave = async () => {
    if (!form || !order) return;
    setSaving(true);
    setError('');

    const payload = {
      name: form.name.trim(),
      price: Number(form.price || 0),
      material_cost: Number(form.material_cost || 0),
      fixed_bonus: form.fixed_bonus ? Number(form.fixed_bonus) : null,
      constructor_id: form.constructor_id ? Number(form.constructor_id) : null,
      manager_id: form.manager_id ? Number(form.manager_id) : null,
      product_types: JSON.stringify(form.product_types || []),
      date_received: form.date_received || null,
      date_design_deadline: form.date_design_deadline || null,
      date_to_work: form.date_to_work || null,
      date_installation_plan: form.date_installation_plan || null,
      date_installation: form.date_installation || null,
      date_advance_paid: form.date_advance_paid || null,
      date_final_paid: form.date_final_paid || null,
      date_manager_paid: form.date_manager_paid || null,
      manager_paid_amount: Number(form.manager_paid_amount || 0),
      constructive_days: Number(form.constructive_days || 5),
      complectation_days: Number(form.complectation_days || 2),
      preassembly_days: Number(form.preassembly_days || 1),
      installation_days: Number(form.installation_days || 3),
    };

    if (!canManage) {
      delete payload.name;
      delete payload.price;
      delete payload.material_cost;
      delete payload.fixed_bonus;
      delete payload.constructor_id;
      delete payload.manager_id;
      delete payload.product_types;
      delete payload.constructive_days;
      delete payload.complectation_days;
      delete payload.preassembly_days;
      delete payload.installation_days;
      delete payload.manager_paid_amount;
      delete payload.date_manager_paid;
    }

    try {
      const updated = await updateOrder(order.id, payload);
      setOrder(updated);
      setForm(getInitialForm(updated));
    } catch (saveError) {
      setError(
        saveError?.response?.data?.detail || 'Не вдалося зберегти зміни'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOrder = async () => {
    if (!order || !isAdmin) return;
    const confirmed = window.confirm(
      `Видалити замовлення #${order.id} "${order.name}"?`
    );
    if (!confirmed) return;

    try {
      await deleteOrder(order.id);
      navigate('/orders', { replace: true });
    } catch (deleteError) {
      setError(
        deleteError?.response?.data?.detail || 'Не вдалося видалити замовлення'
      );
    }
  };

  const handleCreateDeduction = async (event) => {
    event.preventDefault();
    if (!order || !canManage) return;

    try {
      await createDeduction({
        order_id: order.id,
        amount: Number(newDeduction.amount || 0),
        description: newDeduction.description,
        date_created: newDeduction.date_created,
      });
      setNewDeduction({
        amount: '',
        description: '',
        date_created: new Date().toISOString().slice(0, 10),
      });
      const [nextOrder, nextDeductions] = await Promise.all([
        fetchOrder(order.id),
        fetchDeductions(order.id),
      ]);
      setOrder(nextOrder);
      setForm(getInitialForm(nextOrder));
      setDeductions(nextDeductions);
    } catch (deductionError) {
      setError(
        deductionError?.response?.data?.detail || 'Не вдалося додати штраф'
      );
    }
  };

  const handleDeleteDeduction = async (deductionId) => {
    if (!canManage) return;
    const confirmed = window.confirm('Видалити цей штраф?');
    if (!confirmed) return;

    try {
      await deleteDeduction(deductionId);
      const [nextOrder, nextDeductions] = await Promise.all([
        fetchOrder(order.id),
        fetchDeductions(order.id),
      ]);
      setOrder(nextOrder);
      setForm(getInitialForm(nextOrder));
      setDeductions(nextDeductions);
    } catch (deleteDeductionError) {
      setError(
        deleteDeductionError?.response?.data?.detail ||
          'Не вдалося видалити штраф'
      );
    }
  };

  const handleMarkDeductionPaid = async (deduction) => {
    if (!canManage) return;
    try {
      await updateDeduction(deduction.id, {
        is_paid: !deduction.is_paid,
        date_paid: deduction.is_paid ? null : new Date().toISOString().slice(0, 10),
      });
      const refreshed = await fetchDeductions(order.id);
      setDeductions(refreshed);
    } catch (toggleError) {
      setError(toggleError?.response?.data?.detail || 'Не вдалося оновити штраф');
    }
  };

  const handleAddFile = async (event) => {
    event.preventDefault();
    if (!order) return;

    try {
      await addFileLink(order.id, newFile);
      setNewFile({
        name: '',
        url: '',
        folder_name: folderOptions[0],
      });
      const refreshed = await fetchOrderFiles(order.id);
      setFiles(refreshed);
    } catch (fileError) {
      setError(fileError?.response?.data?.detail || 'Не вдалося додати файл');
    }
  };

  const handleRemoveFile = async (fileId) => {
    const confirmed = window.confirm('Видалити посилання на файл?');
    if (!confirmed) return;

    try {
      await removeFileLink(fileId);
      const refreshed = await fetchOrderFiles(order.id);
      setFiles(refreshed);
    } catch (removeError) {
      setError(removeError?.response?.data?.detail || 'Не вдалося видалити файл');
    }
  };

  if (loading || !form) {
    return (
      <section className="card">
        <p className="card-kicker">Завантаження</p>
        <h3>Отримуємо деталі замовлення</h3>
      </section>
    );
  }

  if (!order) {
    return (
      <section className="card error-card">
        <p className="card-kicker">Помилка</p>
        <p>Замовлення не знайдено</p>
      </section>
    );
  }

  const orderStatus = getOrderStatus(order);
  const paymentStatus = getPaymentStatus(order);
  const constructorName = usersById.get(order.constructor_id)?.full_name;
  const managerName = usersById.get(order.manager_id)?.full_name;

  return (
    <div className="page-stack">
      <section className="section-head">
        <div>
          <p className="eyebrow">Order detail</p>
          <h3>
            Замовлення #{order.id}: {order.name}
          </h3>
        </div>
        <div className="tag-row">
          <span className={`status-pill status-${orderStatus.tone}`}>
            {orderStatus.label}
          </span>
          <span className={`status-pill status-${paymentStatus.tone}`}>
            {paymentStatus.label}
          </span>
        </div>
      </section>

      <section className="detail-top-actions">
        <Link className="ghost-button" to="/orders">
          Назад до реєстру
        </Link>
        <button className="primary-button" onClick={handleSave} disabled={saving}>
          {saving ? 'Збереження...' : 'Зберегти зміни'}
        </button>
        {isAdmin ? (
          <button className="danger-button" onClick={handleDeleteOrder}>
            Видалити замовлення
          </button>
        ) : null}
      </section>

      {error ? (
        <section className="card error-card">
          <p className="card-kicker">Помилка</p>
          <p>{error}</p>
        </section>
      ) : null}

      <section className="card detail-grid">
        <article className="detail-col">
          <p className="card-kicker">Основна інформація</p>

          <label className="field">
            <span>Назва</span>
            <input
              type="text"
              value={form.name}
              onChange={(event) => updateField('name', event.target.value)}
              disabled={!canManage}
            />
          </label>

          <div className="detail-two-col">
            <label className="field">
              <span>Ціна</span>
              <input
                type="number"
                value={form.price}
                onChange={(event) => updateField('price', event.target.value)}
                disabled={!canManage}
              />
            </label>

            <label className="field">
              <span>Матеріали</span>
              <input
                type="number"
                value={form.material_cost}
                onChange={(event) =>
                  updateField('material_cost', event.target.value)
                }
                disabled={!canManage}
              />
            </label>
          </div>

          <label className="field">
            <span>Фіксована оплата</span>
            <input
              type="number"
              value={form.fixed_bonus}
              onChange={(event) => updateField('fixed_bonus', event.target.value)}
              disabled={!canManage}
            />
          </label>

          <div className="detail-two-col">
            <label className="field">
              <span>Конструктор</span>
              <select
                value={form.constructor_id}
                onChange={(event) =>
                  updateField('constructor_id', event.target.value)
                }
                disabled={!canManage}
              >
                <option value="">Не призначено</option>
                {constructors.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.full_name || entry.username}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Менеджер</span>
              <select
                value={form.manager_id}
                onChange={(event) => updateField('manager_id', event.target.value)}
                disabled={!canManage}
              >
                <option value="">Не призначено</option>
                {managers.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.full_name || entry.username}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="detail-assignees">
            <span>Поточний конструктор: {constructorName || 'Не призначено'}</span>
            <span>Поточний менеджер: {managerName || 'Не призначено'}</span>
          </div>

          <div>
            <p className="field-caption">Типи виробів</p>
            <div className="tag-row">
              {productOptions.map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`select-tag${
                    form.product_types.includes(type) ? ' select-tag-active' : ''
                  }`}
                  onClick={() => handleToggleType(type)}
                  disabled={!canManage}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        </article>

        <article className="detail-col">
          <p className="card-kicker">Дати та етапи</p>
          <div className="detail-two-col">
            <label className="field">
              <span>Дата отримання</span>
              <input
                type="date"
                value={form.date_received}
                onChange={(event) => updateField('date_received', event.target.value)}
              />
            </label>
            <label className="field">
              <span>Дедлайн конструктиву</span>
              <input
                type="date"
                value={form.date_design_deadline}
                onChange={(event) =>
                  updateField('date_design_deadline', event.target.value)
                }
              />
            </label>
            <label className="field">
              <span>В роботу</span>
              <input
                type="date"
                value={form.date_to_work}
                onChange={(event) => updateField('date_to_work', event.target.value)}
              />
            </label>
            <label className="field">
              <span>План монтажу</span>
              <input
                type="date"
                value={form.date_installation_plan}
                onChange={(event) =>
                  updateField('date_installation_plan', event.target.value)
                }
              />
            </label>
            <label className="field">
              <span>Факт монтажу</span>
              <input
                type="date"
                value={form.date_installation}
                onChange={(event) =>
                  updateField('date_installation', event.target.value)
                }
              />
            </label>
            <label className="field">
              <span>Дата оплати етапу 1</span>
              <input
                type="date"
                value={form.date_advance_paid}
                onChange={(event) =>
                  updateField('date_advance_paid', event.target.value)
                }
              />
            </label>
            <label className="field">
              <span>Дата оплати етапу 2</span>
              <input
                type="date"
                value={form.date_final_paid}
                onChange={(event) => updateField('date_final_paid', event.target.value)}
              />
            </label>
            <label className="field">
              <span>Дата виплати менеджера</span>
              <input
                type="date"
                value={form.date_manager_paid}
                onChange={(event) =>
                  updateField('date_manager_paid', event.target.value)
                }
                disabled={!canManage}
              />
            </label>
            <label className="field">
              <span>Виплачено менеджеру</span>
              <input
                type="number"
                value={form.manager_paid_amount}
                onChange={(event) =>
                  updateField('manager_paid_amount', event.target.value)
                }
                disabled={!canManage}
              />
            </label>
            <label className="field">
              <span>Днів: конструктив</span>
              <input
                type="number"
                min="1"
                max="60"
                value={form.constructive_days}
                onChange={(event) =>
                  updateField('constructive_days', event.target.value)
                }
                disabled={!canManage}
              />
            </label>
            <label className="field">
              <span>Днів: комплектація</span>
              <input
                type="number"
                min="1"
                max="60"
                value={form.complectation_days}
                onChange={(event) =>
                  updateField('complectation_days', event.target.value)
                }
                disabled={!canManage}
              />
            </label>
            <label className="field">
              <span>Днів: предзбірка</span>
              <input
                type="number"
                min="1"
                max="60"
                value={form.preassembly_days}
                onChange={(event) =>
                  updateField('preassembly_days', event.target.value)
                }
                disabled={!canManage}
              />
            </label>
            <label className="field">
              <span>Днів: монтаж</span>
              <input
                type="number"
                min="1"
                max="60"
                value={form.installation_days}
                onChange={(event) =>
                  updateField('installation_days', event.target.value)
                }
                disabled={!canManage}
              />
            </label>
          </div>

          <div className="detail-finance-board">
            <div className="finance-box">
              <span>Оплата конструктора</span>
              <strong>{formatCurrency(order.bonus)} грн</strong>
            </div>
            <div className="finance-box">
              <span>Борг по етапах</span>
              <strong>{formatCurrency(order.current_debt)} грн</strong>
            </div>
            <div className="finance-box">
              <span>Залишок</span>
              <strong>{formatCurrency(order.remainder_amount)} грн</strong>
            </div>
            <div className="finance-box">
              <span>Менеджерська премія</span>
              <strong>{formatCurrency(order.manager_bonus)} грн</strong>
            </div>
          </div>
        </article>
      </section>

      <section className="detail-split-grid">
        <article className="card detail-col">
          <div className="section-head">
            <div>
              <p className="card-kicker">Штрафи / відрахування</p>
              <h3>Дисципліна по замовленню</h3>
            </div>
          </div>

          <form className="modal-form" onSubmit={handleCreateDeduction}>
            <div className="detail-two-col">
              <label className="field">
                <span>Сума</span>
                <input
                  type="number"
                  step="0.01"
                  value={newDeduction.amount}
                  onChange={(event) =>
                    setNewDeduction((prev) => ({
                      ...prev,
                      amount: event.target.value,
                    }))
                  }
                  disabled={!canManage}
                  required
                />
              </label>
              <label className="field">
                <span>Дата</span>
                <input
                  type="date"
                  value={newDeduction.date_created}
                  onChange={(event) =>
                    setNewDeduction((prev) => ({
                      ...prev,
                      date_created: event.target.value,
                    }))
                  }
                  disabled={!canManage}
                  required
                />
              </label>
            </div>
            <label className="field">
              <span>Опис</span>
              <input
                type="text"
                value={newDeduction.description}
                onChange={(event) =>
                  setNewDeduction((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }))
                }
                disabled={!canManage}
                placeholder="Причина штрафу"
                required
              />
            </label>
            <button className="primary-button" type="submit" disabled={!canManage}>
              Додати штраф
            </button>
          </form>

          <div className="detail-list">
            {deductions.length === 0 ? (
              <p className="muted-text">Штрафів по цьому замовленню немає.</p>
            ) : (
              deductions.map((deduction) => (
                <div key={deduction.id} className="detail-list-row">
                  <div>
                    <strong>{formatCurrency(deduction.amount)} грн</strong>
                    <p className="muted-text">{deduction.description}</p>
                    <small className="muted-text">
                      {formatDate(deduction.date_created)}
                      {deduction.date_paid
                        ? ` • погашено ${formatDate(deduction.date_paid)}`
                        : ''}
                    </small>
                  </div>
                  <div className="detail-inline-actions">
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => handleMarkDeductionPaid(deduction)}
                      disabled={!canManage}
                    >
                      {deduction.is_paid ? 'Зняти погашення' : 'Позначити як погашено'}
                    </button>
                    <button
                      className="danger-button"
                      type="button"
                      onClick={() => handleDeleteDeduction(deduction.id)}
                      disabled={!canManage}
                    >
                      Видалити
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="card detail-col">
          <div className="section-head">
            <div>
              <p className="card-kicker">Файли</p>
              <h3>Посилання та документація</h3>
            </div>
          </div>

          <form className="modal-form" onSubmit={handleAddFile}>
            <label className="field">
              <span>Назва файлу</span>
              <input
                type="text"
                value={newFile.name}
                onChange={(event) =>
                  setNewFile((prev) => ({ ...prev, name: event.target.value }))
                }
                required
              />
            </label>
            <label className="field">
              <span>Посилання</span>
              <input
                type="url"
                value={newFile.url}
                onChange={(event) =>
                  setNewFile((prev) => ({ ...prev, url: event.target.value }))
                }
                placeholder="https://..."
                required
              />
            </label>
            <label className="field">
              <span>Папка</span>
              <select
                value={newFile.folder_name}
                onChange={(event) =>
                  setNewFile((prev) => ({
                    ...prev,
                    folder_name: event.target.value,
                  }))
                }
              >
                {folderOptions.map((folder) => (
                  <option key={folder} value={folder}>
                    {folder}
                  </option>
                ))}
              </select>
            </label>
            <button className="primary-button" type="submit">
              Додати посилання
            </button>
          </form>

          <div className="detail-list">
            {files.length === 0 ? (
              <p className="muted-text">Файли ще не додані.</p>
            ) : (
              files.map((file) => (
                <div key={file.id} className="detail-list-row">
                  <div>
                    <strong>{file.name}</strong>
                    <p className="muted-text">{file.folder_name}</p>
                    <a href={file.url} target="_blank" rel="noreferrer">
                      {file.url}
                    </a>
                  </div>
                  <button
                    className="danger-button"
                    type="button"
                    onClick={() => handleRemoveFile(file.id)}
                  >
                    Видалити
                  </button>
                </div>
              ))
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
