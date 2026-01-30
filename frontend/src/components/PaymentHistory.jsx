import React, { useEffect, useState } from 'react';
import { getPayments, getPaymentAllocations, deletePayment } from '../api';

const PaymentHistory = () => {
    const [payments, setPayments] = useState([]);
    const [selectedPayment, setSelectedPayment] = useState(null);
    const [allocations, setAllocations] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadPayments();
    }, []);

    const loadPayments = async () => {
        try {
            const data = await getPayments();
            setPayments(data);
            setLoading(false);
        } catch (error) {
            console.error('Failed to load payments:', error);
            setLoading(false);
        }
    };

    const handlePaymentClick = async (payment) => {
        setSelectedPayment(payment);
        try {
            const data = await getPaymentAllocations(payment.id);
            setAllocations(data);
        } catch (error) {
            console.error('Failed to load allocations:', error);
        }
    };

    const handleDeletePayment = async (e, payment) => {
        e.stopPropagation();

        const password = prompt('Введіть пароль для видалення платежу:');
        if (password !== 'Gjksyrf') {
            alert('Невірний пароль!');
            return;
        }

        if (!window.confirm(`Ви впевнені, що хочете видалити платіж на суму ${payment.amount} грн?\n\nУВАГА: Це призведе до перерахунку всіх балансів замовлень! Цю дію неможливо відмінити.`)) {
            return;
        }

        try {
            setLoading(true);
            await deletePayment(payment.id);
            await loadPayments();
            if (selectedPayment?.id === payment.id) {
                setSelectedPayment(null);
                setAllocations([]);
            }
        } catch (error) {
            console.error('Failed to delete payment:', error);
            alert('Помилка при видаленні платежу');
            setLoading(false);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return '--.--.--';
        const date = new Date(dateString);
        return date.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    if (loading) {
        return <div className="text-center py-10">Завантаження...</div>;
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-black text-slate-800 uppercase italic mb-4">Історія платежів</h2>
                <p className="text-sm text-slate-500 mb-6">Перегляд всіх внесених коштів та їх розподілу</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Payments List */}
                <div className="bg-white rounded-3xl shadow-lg border border-slate-100 overflow-hidden">
                    <div className="p-6 bg-slate-900 text-white">
                        <h3 className="text-lg font-black uppercase">Платежі</h3>
                        <p className="text-xs text-slate-400 mt-1">Всього: {payments.length}</p>
                    </div>

                    <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                        {payments.length === 0 ? (
                            <div className="p-6 text-center text-slate-400">
                                Платежів поки немає
                            </div>
                        ) : (
                            payments.map(payment => (
                                <div
                                    key={payment.id}
                                    onClick={() => handlePaymentClick(payment)}
                                    className={`p-4 cursor-pointer transition hover:bg-blue-50 group ${selectedPayment?.id === payment.id ? 'bg-blue-100 border-l-4 border-blue-600' : ''
                                        }`}
                                >
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="text-xs text-slate-400 uppercase font-bold">
                                                {formatDate(payment.date_received)}
                                            </p>
                                            <p className="text-2xl font-black text-blue-600 mt-1">
                                                {payment.amount.toLocaleString()} ₴
                                            </p>
                                            {payment.notes && (
                                                <p className="text-xs text-slate-500 italic mt-1">{payment.notes}</p>
                                            )}
                                        </div>
                                        <div className="flex flex-col items-end gap-2">
                                            <span className={`text-xs font-bold px-3 py-1 rounded-full ${payment.manual_order_id
                                                ? 'bg-orange-100 text-orange-700'
                                                : 'bg-green-100 text-green-700'
                                                }`}>
                                                {payment.manual_order_id ? 'Ручний' : 'Авто'}
                                            </span>

                                            <button
                                                onClick={(e) => handleDeletePayment(e, payment)}
                                                className="text-slate-300 hover:text-red-500 transition-colors p-1 opacity-0 group-hover:opacity-100"
                                                title="Видалити платіж"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Allocations Detail */}
                <div className="bg-white rounded-3xl shadow-lg border border-slate-100 overflow-hidden">
                    <div className="p-6 bg-emerald-600 text-white">
                        <h3 className="text-lg font-black uppercase">Розподіл коштів</h3>
                        {selectedPayment && (
                            <p className="text-xs text-emerald-100 mt-1">
                                Платіж від {formatDate(selectedPayment.date_received)}
                            </p>
                        )}
                    </div>

                    <div className="p-6">
                        {!selectedPayment ? (
                            <div className="text-center text-slate-400 py-10">
                                Оберіть платіж зліва для перегляду деталей розподілу
                            </div>
                        ) : allocations.length === 0 ? (
                            <div className="text-center text-slate-400 py-10">
                                Завантаження...
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {allocations.map((allocation, idx) => (
                                    <div
                                        key={idx}
                                        className="p-4 bg-slate-50 rounded-xl border border-slate-200"
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <p className="font-bold text-slate-800">
                                                    {allocation.order_name}
                                                </p>
                                                <p className="text-xs text-slate-400 uppercase font-bold mt-1">
                                                    Замовлення #{allocation.order_id}
                                                </p>
                                            </div>
                                            <span className={`text-xs font-bold px-3 py-1 rounded-full ${allocation.payment_type === 'advance'
                                                ? 'bg-blue-100 text-blue-700'
                                                : 'bg-emerald-100 text-emerald-700'
                                                }`}>
                                                {allocation.payment_type === 'advance' ? 'Аванс' : 'Залишок'}
                                            </span>
                                        </div>

                                        <div className="mt-3 pt-3 border-t border-slate-200">
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm text-slate-600">Сума:</span>
                                                <span className="text-lg font-black text-emerald-600">
                                                    {allocation.amount.toLocaleString()} ₴
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                <div className="mt-6 pt-4 border-t-2 border-slate-300">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-bold text-slate-700 uppercase">Всього розподілено:</span>
                                        <span className="text-2xl font-black text-slate-900">
                                            {allocations.reduce((sum, a) => sum + a.amount, 0).toLocaleString()} ₴
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PaymentHistory;
