import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
});

export const getOrders = async () => {
    const response = await api.get('/orders/');
    return response.data;
};

export const getOrder = async (id) => {
    const response = await api.get(`/orders/${id}`);
    return response.data;
};

export const createOrder = async (orderData) => {
    const response = await api.post('/orders/', orderData);
    return response.data;
};

export const updateOrder = async (id, orderData) => {
    const response = await api.patch(`/orders/${id}`, orderData);
    return response.data;
};

export const deleteOrder = async (id) => {
    const response = await api.delete(`/orders/${id}`);
    return response.data;
};

export const addPayment = async (paymentData) => {
    const response = await api.post('/payments/', paymentData);
    return response.data;
};

export const getPayments = async () => {
    const response = await api.get('/payments/');
    return response.data;
};

export const getPaymentAllocations = async (paymentId) => {
    const response = await api.get(`/payments/${paymentId}/allocations`);
    return response.data;
};

export const getFiles = async (orderId, folder) => {
    const response = await api.get(`/orders/${orderId}/files/${folder}`);
    return response.data;
};

// Deductions
export const getDeductions = async (orderId = null) => {
    const params = orderId ? { order_id: orderId } : {};
    const response = await api.get('/deductions/', { params });
    return response.data;
};

export const createDeduction = async (deductionData) => {
    const response = await api.post('/deductions/', deductionData);
    return response.data;
};

export const deleteDeduction = async (id) => {
    const response = await api.delete(`/deductions/${id}`);
    return response.data;
};

export const getFinancialStats = async () => {
    const response = await api.get('/stats/financial');
    return response.data;
};

export const getLogs = async () => {
    const response = await api.get('/logs');
    return response.data;
};
