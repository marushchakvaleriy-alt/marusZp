export const productOptions = [
  'Кухня',
  'Шафа',
  'Передпокій',
  'Санвузол',
  'Вітальня',
  'ТВ зона',
  'Пенал',
  'Гардероб',
  'Стіл',
  'Комод',
  'Тумбочка',
];

export function parseProductTypes(value) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch (error) {
    return String(value)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
}

export function formatCurrency(value) {
  const safeValue = Number(value || 0);
  return new Intl.NumberFormat('uk-UA').format(safeValue);
}

export function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('uk-UA').format(date);
}

export function getOrderStatus(order) {
  if (isArchivedOrder(order)) {
    return { label: 'Архів', tone: 'neutral' };
  }
  if (order.date_installation) {
    return { label: 'Монтаж завершено', tone: 'green' };
  }
  if (order.date_to_work) {
    return { label: 'В роботі', tone: 'blue' };
  }
  return { label: 'Нове', tone: 'amber' };
}

export function getPaymentStatus(order) {
  if (order.status_payment === 'paid') {
    return { label: 'Оплачено', tone: 'green' };
  }
  if (order.status_payment === 'partially_paid') {
    return { label: 'Частково оплачено', tone: 'blue' };
  }
  if (order.status_payment === 'in_progress') {
    return { label: 'Є борг по етапах', tone: 'red' };
  }
  return { label: 'Без виплат', tone: 'neutral' };
}

export function isArchivedOrder(order) {
  return Boolean(
    order.date_final_paid ||
      (order.date_installation && Number(order.remainder_amount || 0) <= 0.01)
  );
}
