import React, { useEffect, useState } from 'react';
import { getDeductions, createDeduction, deleteDeduction } from '../api';
import { useAuth } from '../context/AuthContext';

const DeductionsList = () => {
    const { user } = useAuth();
    const canManage = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'super_admin';

    const [deductions, setDeductions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({
        order_id: '',
        amount: '',
        description: '',
        date_created: new Date().toISOString().split('T')[0]
    });

    useEffect(() => {
        loadDeductions();
    }, []);

    const loadDeductions = async () => {
        try {
            const data = await getDeductions();
            setDeductions(data);
            setLoading(false);
        } catch (error) {
            console.error('Failed to load deductions:', error);
            setLoading(false);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            await createDeduction({
                ...formData,
                amount: parseFloat(formData.amount),
                order_id: parseInt(formData.order_id)
            });
            setShowModal(false);
            setFormData({
                order_id: '',
                amount: '',
                description: '',
                date_created: new Date().toISOString().split('T')[0]
            });
            loadDeductions();
        } catch (error) {
            console.error('Failed to create deduction:', error);
            alert('Помилка при створенні штрафу');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Ви впевнені, що хочете видалити цей штраф?')) {
            try {
                await deleteDeduction(id);
                loadDeductions();
            } catch (error) {
                console.error('Failed to delete deduction:', error);
                alert('Помилка при видаленні');
            }
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return '--.--.--';
        const date = new Date(dateString);
        return date.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    const stats = deductions.reduce((acc, ded) => {
        acc.total += ded.amount;
        if (!ded.is_paid) acc.unpaid += ded.amount;
        return acc;
    }, { total: 0, unpaid: 0 });

    if (loading) {
        return <div className="text-center py-10">Завантаження...</div>;
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-black text-slate-800 uppercase italic">Мої провини / Штрафи</h2>
                <p className="text-sm text-slate-500 mt-1">Облік всіх відрахувань та штрафів</p>
            </div>



            {/* Deductions Table */}
            <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
                <div className="p-6 bg-slate-900 text-white">
                    <h3 className="text-lg font-black uppercase">Список штрафів</h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Дата</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Замовлення</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Опис</th>
                                <th className="px-6 py-3 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">Сума</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {deductions.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="px-6 py-10 text-center text-slate-400">
                                        Штрафів поки немає 🎉
                                    </td>
                                </tr>
                            ) : (
                                deductions.map(deduction => (
                                    <tr key={deduction.id} className="hover:bg-slate-50">
                                        <td className="px-6 py-4 text-sm text-slate-500">
                                            {formatDate(deduction.date_created)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm font-bold text-slate-800">{deduction.order_name}</span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-600">
                                            {deduction.description}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-3">
                                                <span className="text-lg font-black text-red-600">
                                                    {deduction.amount.toLocaleString()} ₴
                                                </span>
                                                {canManage && (
                                                    <button
                                                        onClick={() => handleDelete(deduction.id)}
                                                        className="text-red-600 hover:text-red-800 p-1"
                                                        title="Видалити штраф"
                                                    >
                                                        <i className="fas fa-trash"></i>
                                                    </button>
                                                )}
                                            </div>
                                        </td>

                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full mx-4">
                        <h3 className="text-2xl font-black text-slate-800 mb-6">Додати штраф</h3>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">ID Замовлення</label>
                                <input
                                    type="number"
                                    value={formData.order_id}
                                    onChange={e => setFormData({ ...formData, order_id: e.target.value })}
                                    required
                                    className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Сума (₴)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formData.amount}
                                    onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                    required
                                    className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Опис</label>
                                <textarea
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    required
                                    rows={3}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Дата</label>
                                <input
                                    type="date"
                                    value={formData.date_created}
                                    onChange={e => setFormData({ ...formData, date_created: e.target.value })}
                                    required
                                    className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition"
                                >
                                    Скасувати
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition"
                                >
                                    Створити
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DeductionsList;
