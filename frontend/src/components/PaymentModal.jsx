import React, { useState, useEffect } from 'react';
import { addPayment, getOrders, getUsers } from '../api';
import UKDatePicker from './UKDatePicker';

const PaymentModal = ({ isOpen, onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        amount: '',
        date_received: new Date().toISOString().split('T')[0],
        notes: '',
        constructor_id: null,
        manager_id: null,
        manual_order_id: null
    });
    const [orders, setOrders] = useState([]);
    const [constructors, setConstructors] = useState([]);
    const [managers, setManagers] = useState([]);
    const [paymentRole, setPaymentRole] = useState('constructor'); // 'constructor' or 'manager'
    const [useManual, setUseManual] = useState(false);
    const [result, setResult] = useState(null);

    useEffect(() => {
        if (isOpen) {
            fetchOrders();
            fetchUsers();
            setResult(null);
        }
    }, [isOpen]);

    const fetchOrders = async () => {
        try {
            const data = await getOrders();
            setOrders(data.filter(o => o.remainder_amount > 0));
        } catch (error) {
            console.error('Failed to fetch orders:', error);
        }
    };

    const fetchUsers = async () => {
        try {
            const users = await getUsers();
            setConstructors(users.filter(u => u.role === 'constructor'));
            setManagers(users.filter(u => u.role === 'manager' || u.role === 'admin' || u.role === 'super_admin'));
        } catch (error) {
            console.error('Failed to fetch users:', error);
        }
    };

    // Filter orders based on selected person (optional, helps find orders easier)
    const getFilteredOrders = () => {
        if (paymentRole === 'constructor') {
            if (!formData.constructor_id) return orders;
            return orders.filter(o => o.constructor_id === formData.constructor_id);
        } else {
            if (!formData.manager_id) return orders;
            return orders.filter(o => o.manager_id === formData.manager_id);
        }
    };

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const paymentData = {
                amount: parseFloat(formData.amount),
                date_received: formData.date_received,
                notes: formData.notes || (paymentRole === 'constructor'
                    ? (formData.constructor_id ? `Оплата для конструктора ID ${formData.constructor_id}` : null)
                    : (formData.manager_id ? `Оплата для менеджера ID ${formData.manager_id}` : null)),
                manual_order_id: useManual ? formData.manual_order_id : null,
                constructor_id: paymentRole === 'constructor' ? formData.constructor_id : null,
                manager_id: paymentRole === 'manager' ? formData.manager_id : null
            };

            const response = await addPayment(paymentData);
            setResult(response);

            if (onSuccess) {
                setTimeout(() => {
                    onSuccess();
                    setFormData({ amount: '', date_received: new Date().toISOString().split('T')[0], notes: '', manual_order_id: null, constructor_id: null, manager_id: null });
                    setUseManual(false);
                    onClose();
                }, 3000);
            }
        } catch (error) {
            console.error('Failed to add payment:', error);
            const msg = error.response?.data?.detail || error.message || "Невідома помилка";
            alert('Помилка при додаванні платежу:\n' + msg);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50">
            <div className="bg-white rounded-3xl p-8 w-[600px] max-h-[90vh] overflow-y-auto shadow-2xl">
                <h2 className="text-xl font-black text-slate-800 uppercase italic mb-6">💰 Додати платіж</h2>

                {result ? (
                    <div className="space-y-4">
                        <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-6">
                            <p className="text-lg font-bold text-green-700 mb-4">{result.message}</p>

                            {result.allocations && result.allocations.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-xs font-bold text-slate-400 uppercase">Розподіл:</p>
                                    {result.allocations.map((alloc, idx) => (
                                        <div key={idx} className="flex justify-between text-sm bg-white p-3 rounded-xl">
                                            <span className="font-bold">{alloc.order_name}</span>
                                            <span className="text-slate-500">
                                                {alloc.stage === 'advance' ? 'Аванс' : (alloc.stage === 'final' ? 'Фінал' : 'Комісія менеджера')}: {alloc.amount.toLocaleString()} ₴
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {result.remaining_amount > 0 && (
                                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-xl">
                                    <p className="text-sm font-bold text-yellow-700">
                                        Залишок нерозподілено: {result.remaining_amount.toLocaleString()} ₴
                                    </p>
                                </div>
                            )}
                        </div>
                        <button onClick={onClose} className="w-full px-6 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition">
                            Закрити
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Сума платежу (грн)</label>
                            <input
                                type="number"
                                step="0.01"
                                required
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:outline-none focus:border-blue-500"
                                value={formData.amount}
                                onChange={e => setFormData({ ...formData, amount: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Дата отримання</label>
                            <UKDatePicker
                                selected={formData.date_received}
                                onChange={date => setFormData({ ...formData, date_received: date })}
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:outline-none focus:border-blue-500"
                            />
                        </div>

                        <div className="flex bg-slate-100 p-1 rounded-2xl mb-4">
                            <button
                                type="button"
                                className={`flex-1 py-2 px-4 rounded-xl font-bold text-sm transition ${paymentRole === 'constructor' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                onClick={() => {
                                    setPaymentRole('constructor');
                                    setFormData(prev => ({ ...prev, manager_id: null }));
                                }}
                            >
                                👤 Конструктор
                            </button>
                            <button
                                type="button"
                                className={`flex-1 py-2 px-4 rounded-xl font-bold text-sm transition ${paymentRole === 'manager' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                onClick={() => {
                                    setPaymentRole('manager');
                                    setFormData(prev => ({ ...prev, constructor_id: null }));
                                }}
                            >
                                💼 Менеджер
                            </button>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                                {paymentRole === 'constructor' ? 'Конструктор' : 'Менеджер'} (Обов'язково)
                            </label>
                            {paymentRole === 'constructor' ? (
                                <select
                                    required={!useManual}
                                    className={`w-full p-3 border rounded-xl font-bold text-slate-700 focus:outline-none focus:border-blue-500 ${!formData.constructor_id && !useManual ? 'border-red-300 bg-red-50' : 'bg-slate-50 border-slate-200'}`}
                                    value={formData.constructor_id || ''}
                                    onChange={e => {
                                        const val = e.target.value ? parseInt(e.target.value) : null;
                                        setFormData({ ...formData, constructor_id: val });
                                    }}
                                >
                                    <option value="">-- Оберіть конструктора --</option>
                                    {constructors.map(c => (
                                        <option key={c.id} value={c.id}>
                                            👤 {c.full_name || c.username}
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <select
                                    required={!useManual}
                                    className={`w-full p-3 border rounded-xl font-bold text-slate-700 focus:outline-none focus:border-blue-500 ${!formData.manager_id && !useManual ? 'border-red-300 bg-red-50' : 'bg-slate-50 border-slate-200'}`}
                                    value={formData.manager_id || ''}
                                    onChange={e => {
                                        const val = e.target.value ? parseInt(e.target.value) : null;
                                        setFormData({ ...formData, manager_id: val });
                                    }}
                                >
                                    <option value="">-- Оберіть менеджера --</option>
                                    {managers.map(m => (
                                        <option key={m.id} value={m.id}>
                                            💼 {m.full_name || m.username}
                                        </option>
                                    ))}
                                </select>
                            )}
                            <p className="text-[10px] text-slate-400 mt-1 pl-1">
                                {paymentRole === 'constructor'
                                    ? "Кошти будуть розподілені тільки на замовлення обраного конструктора."
                                    : "Кошти будуть розподілені тільки на комісію обраного менеджера."}
                            </p>
                        </div>

                        <div className="border-t pt-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={useManual}
                                    onChange={e => setUseManual(e.target.checked)}
                                    className="w-4 h-4 accent-blue-600"
                                />
                                <span className="text-sm font-bold text-slate-600">Або вказати конкретне замовлення вручну</span>
                            </label>
                        </div>

                        {useManual && (
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Замовлення</label>
                                <select
                                    required
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:outline-none focus:border-blue-500"
                                    value={formData.manual_order_id || ''}
                                    onChange={e => setFormData({ ...formData, manual_order_id: parseInt(e.target.value) })}
                                >
                                    <option value="">Оберіть замовлення</option>
                                    {getFilteredOrders().map(order => (
                                        <option key={order.id} value={order.id}>
                                            #{order.id} - {order.name} (Залишок: {order.remainder_amount.toLocaleString()} ₴)
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="flex justify-end gap-3 pt-4">
                            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-400 font-bold text-sm hover:text-slate-600 transition">
                                Скасувати
                            </button>
                            <button type="submit" className="px-6 py-2 bg-green-600 text-white font-bold rounded-xl shadow-lg shadow-green-200 hover:bg-green-700 transition">
                                Додати платіж
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default PaymentModal;
