import { api } from '../../shared/api';

export async function fetchFinancialStats() {
  const response = await api.get('/stats/financial');
  return response.data;
}

export async function fetchPayments() {
  const response = await api.get('/payments/');
  return response.data;
}

export async function fetchPaymentAllocations(paymentId) {
  const response = await api.get(`/payments/${paymentId}/allocations`);
  return response.data;
}

export async function createPayment(payload) {
  const response = await api.post('/payments/', payload);
  return response.data;
}

export async function deletePayment(paymentId) {
  const response = await api.delete(`/payments/${paymentId}`);
  return response.data;
}

export async function redistributePayments() {
  const response = await api.post('/payments/redistribute');
  return response.data;
}

export async function fetchOrdersForFinance() {
  const response = await api.get('/orders/', {
    params: { limit: 500, sort_by: 'id', sort_order: 'desc' },
  });
  return response.data;
}

export async function fetchUsersForFinance() {
  const response = await api.get('/users');
  return response.data;
}

export async function fetchDeductionsForFinance() {
  const response = await api.get('/deductions/');
  return response.data;
}

export async function createDeductionForFinance(payload) {
  const response = await api.post('/deductions/', payload);
  return response.data;
}

export async function deleteDeductionForFinance(deductionId) {
  const response = await api.delete(`/deductions/${deductionId}`);
  return response.data;
}

export async function updateDeductionForFinance(deductionId, payload) {
  const response = await api.patch(`/deductions/${deductionId}`, payload);
  return response.data;
}
