import { useMemo, useState } from 'react';
import { productOptions } from './orderUtils';

const initialState = {
  name: '',
  price: '',
  material_cost: '',
  date_received: new Date().toISOString().slice(0, 10),
  date_design_deadline: '',
  constructive_days: 5,
  complectation_days: 2,
  preassembly_days: 1,
  installation_days: 3,
  fixed_bonus: '',
  constructor_id: '',
  manager_id: '',
  product_types: [],
};

export default function CreateOrderModal({
  open,
  onClose,
  onSubmit,
  users,
  currentUser,
  submitting,
}) {
  const [form, setForm] = useState(initialState);

  const constructors = useMemo(
    () =>
      users.filter(
        (user) =>
          user.role === 'constructor' ||
          user.role === 'admin' ||
          user.role === 'super_admin'
      ),
    [users]
  );

  const managers = useMemo(
    () =>
      users.filter(
        (user) =>
          user.role === 'manager' ||
          user.role === 'admin' ||
          user.role === 'super_admin'
      ),
    [users]
  );

  if (!open) return null;

  const isAdmin =
    currentUser?.role === 'admin' || currentUser?.role === 'super_admin';
  const isManager = currentUser?.role === 'manager';

  const updateField = (field, value) => {
    setForm((previous) => ({ ...previous, [field]: value }));
  };

  const toggleProductType = (type) => {
    setForm((previous) => ({
      ...previous,
      product_types: previous.product_types.includes(type)
        ? previous.product_types.filter((item) => item !== type)
        : [...previous.product_types, type],
    }));
  };

  const handleSave = async (event) => {
    event.preventDefault();

    const payload = {
      name: form.name.trim(),
      price: Number(form.price || 0),
      material_cost: Number(form.material_cost || 0),
      fixed_bonus: form.fixed_bonus ? Number(form.fixed_bonus) : null,
      date_received: form.date_received || null,
      date_design_deadline: form.date_design_deadline || null,
      constructive_days: Math.max(1, Number(form.constructive_days || 5)),
      complectation_days: Math.max(1, Number(form.complectation_days || 2)),
      preassembly_days: Math.max(1, Number(form.preassembly_days || 1)),
      installation_days: Math.max(1, Number(form.installation_days || 3)),
      product_types: JSON.stringify(form.product_types),
      constructor_id: form.constructor_id ? Number(form.constructor_id) : null,
      manager_id: form.manager_id ? Number(form.manager_id) : null,
    };

    if (isManager) {
      payload.manager_id = currentUser.id;
    }

    await onSubmit(payload);
    setForm(initialState);
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-shell card">
        <div className="modal-head">
          <div>
            <p className="card-kicker">Нове замовлення</p>
            <h3>Створити замовлення в `app-v2`</h3>
          </div>
          <button className="ghost-button" type="button" onClick={onClose}>
            Закрити
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSave}>
          <div className="form-grid">
            <label className="field">
              <span>Назва об'єкта</span>
              <input
                type="text"
                value={form.name}
                onChange={(event) => updateField('name', event.target.value)}
                placeholder="Наприклад: Квартира на Печерську"
                required
              />
            </label>

            <label className="field">
              <span>Загальна ціна</span>
              <input
                type="number"
                min="0"
                value={form.price}
                onChange={(event) => updateField('price', event.target.value)}
                placeholder="0"
                required
              />
            </label>

            <label className="field">
              <span>Матеріали</span>
              <input
                type="number"
                min="0"
                value={form.material_cost}
                onChange={(event) =>
                  updateField('material_cost', event.target.value)
                }
                placeholder="0"
              />
            </label>

            <label className="field">
              <span>Фіксована оплата</span>
              <input
                type="number"
                min="0"
                value={form.fixed_bonus}
                onChange={(event) =>
                  updateField('fixed_bonus', event.target.value)
                }
                placeholder="Необов'язково"
              />
            </label>

            <label className="field">
              <span>Дата отримання</span>
              <input
                type="date"
                value={form.date_received}
                onChange={(event) =>
                  updateField('date_received', event.target.value)
                }
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
              <span>Днів: конструктив</span>
              <input
                type="number"
                min="1"
                max="60"
                value={form.constructive_days}
                onChange={(event) =>
                  updateField('constructive_days', event.target.value)
                }
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
              />
            </label>

            {(isAdmin || isManager) && (
              <label className="field">
                <span>Конструктор</span>
                <select
                  value={form.constructor_id}
                  onChange={(event) =>
                    updateField('constructor_id', event.target.value)
                  }
                >
                  <option value="">Не призначено</option>
                  {constructors.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name || user.username}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {isAdmin && (
              <label className="field">
                <span>Менеджер</span>
                <select
                  value={form.manager_id}
                  onChange={(event) =>
                    updateField('manager_id', event.target.value)
                  }
                >
                  <option value="">Не призначено</option>
                  {managers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name || user.username}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <div className="tag-picker">
            <p className="field-caption">Типи виробів</p>
            <div className="tag-row">
              {productOptions.map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`select-tag${
                    form.product_types.includes(type) ? ' select-tag-active' : ''
                  }`}
                  onClick={() => toggleProductType(type)}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="modal-actions">
            <button className="ghost-button" type="button" onClick={onClose}>
              Скасувати
            </button>
            <button className="primary-button" type="submit" disabled={submitting}>
              {submitting ? 'Створення...' : 'Створити замовлення'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
