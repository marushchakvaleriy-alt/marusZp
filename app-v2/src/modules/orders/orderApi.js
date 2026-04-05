import { api } from '../../shared/api';

export async function fetchOrders(params = {}) {
  const response = await api.get('/orders/', { params });
  return response.data;
}

export async function fetchOrder(orderId) {
  const response = await api.get(`/orders/${orderId}`);
  return response.data;
}

export async function createOrder(orderData) {
  const response = await api.post('/orders/', orderData);
  return response.data;
}

export async function updateOrder(orderId, patch) {
  const response = await api.patch(`/orders/${orderId}`, patch);
  return response.data;
}

export async function deleteOrder(orderId) {
  const response = await api.delete(`/orders/${orderId}`);
  return response.data;
}

export async function fetchUsers() {
  const response = await api.get('/users');
  return response.data;
}

export async function fetchDeductions(orderId) {
  const response = await api.get('/deductions/', {
    params: orderId ? { order_id: orderId } : {},
  });
  return response.data;
}

export async function createDeduction(payload) {
  const response = await api.post('/deductions/', payload);
  return response.data;
}

export async function updateDeduction(deductionId, payload) {
  const response = await api.patch(`/deductions/${deductionId}`, payload);
  return response.data;
}

export async function deleteDeduction(deductionId) {
  const response = await api.delete(`/deductions/${deductionId}`);
  return response.data;
}

export async function fetchOrderFiles(orderId) {
  const response = await api.get(`/orders/${orderId}/files`);
  return response.data;
}

export async function addFileLink(orderId, payload) {
  const response = await api.post(`/orders/${orderId}/files`, payload);
  return response.data;
}

export async function removeFileLink(fileId) {
  const response = await api.delete(`/files/${fileId}`);
  return response.data;
}
