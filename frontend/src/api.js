import axios from 'axios';

export const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
});

export const resetDatabase = async (password) => {
    const response = await api.delete('/admin/reset', { data: { password } });
    return response.data;
};

export const getOrders = async (params = {}) => {
    const response = await api.get('/orders/', { params });
    return response.data;
};

export const getUsers = async () => {
    const response = await api.get('/users');
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

export const deletePayment = async (id) => {
    const response = await api.delete(`/payments/${id}`);
    return response.data;
};

export const getFiles = async (orderId) => {
    const response = await api.get(`/orders/${orderId}/files`);
    return response.data;
};

export const addFileLink = async (orderId, fileData) => {
    const response = await api.post(`/orders/${orderId}/files`, fileData);
    return response.data;
};

export const deleteFileLink = async (fileId) => {
    const response = await api.delete(`/files/${fileId}`);
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

export const getSettings = async () => {
    const response = await api.get('/admin/settings');
    return response.data;
};

export const updateSettings = async (settings) => {
    const response = await api.post('/admin/settings', settings);
    return response.data;
};

export const uploadFile = async (orderId, folderCategory, file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post(`/orders/${orderId}/upload`, formData, {
        params: { folder_category: folderCategory },
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
    return response.data;
};

export const updateUser = async (id, userData) => {
    const response = await api.patch(`/users/${id}`, userData);
    return response.data;
};
