import React, { useState, useEffect } from 'react';
import { updateOrder, deleteOrder, getDeductions, createDeduction, deleteDeduction } from '../api';
import FileManager from './FileManager';

// Editable Date Component
const EditableDate = ({ value, onSave, className, emptyText = "--.--.--" }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [dateValue, setDateValue] = useState(value || '');

    useEffect(() => {
        setDateValue(value || '');
    }, [value]);

    const handleSave = () => {
        setIsEditing(false);
        if (dateValue !== value) {
            onSave(dateValue || null);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleSave();
        if (e.key === 'Escape') {
            setIsEditing(false);
            setDateValue(value || '');
        }
    };

    if (isEditing) {
        return (
            <input
                type="date"
                autoFocus
                className={`px-2 py-1 border border-blue-300 rounded shadow-sm outline-none text-sm ${className}`}
                value={dateValue}
                onChange={(e) => setDateValue(e.target.value)}
                onBlur={handleSave}
                onKeyDown={handleKeyDown}
                onClick={(e) => e.stopPropagation()}
            />
        );
    }

    const formatDate = (dateString) => {
        if (!dateString) return emptyText;
        const date = new Date(dateString);
        return date.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: '2-digit' });
    };

    return (
        <span
            onClick={() => setIsEditing(true)}
            className={`cursor-pointer hover:bg-black/5 px-2 py-0.5 rounded transition border border-transparent hover:border-black/10 items-center inline-flex gap-1 group ${className}`}
            title="Натисніть, щоб змінити дату"
        >
            {formatDate(value)}
            <i className="fas fa-pen text-[8px] opacity-0 group-hover:opacity-100 text-slate-400"></i>
        </span>
    );
};

const OrderDetail = ({ order, onBack, onUpdate }) => {
    const OrderDetail = ({ order, onBack, onUpdate }) => {
        // const [isEditing, setIsEditing] = useState(false); // Removed
        const [isEditingInfo, setIsEditingInfo] = useState(false);
        const [infoData, setInfoData] = useState({
            name: order.name,
            price: order.price,
            product_types: order.product_types ? JSON.parse(order.product_types) : []
        });
        const [customType, setCustomType] = useState('');

        // ... (rest of state)

        const handleQuickUpdate = async (field, value) => {
            try {
                await updateOrder(order.id, { [field]: value });
                if (onUpdate) onUpdate();
            } catch (error) {
                console.error('Failed to update order:', error);
                alert('Помилка при збереженні дати');
            }
        };

        // Removed handleSave

        // ... (rest of handlers)

        // In JSX:
        <div className="flex gap-3">
            <button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-200 hover:bg-red-700 transition flex items-center gap-2">
                <i className="fas fa-trash text-xs"></i> Видалити
            </button>
        </div>
                </div >

    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8 border-b border-slate-100 bg-slate-50/30">
        {/* Stage 1 */}
        <div className={`bg-white p-6 rounded-3xl border ${order.date_advance_paid ? 'border-green-200 bg-green-50/30' : 'border-blue-100'}`}>
            <h4 className="text-xs font-bold text-blue-600 uppercase mb-4 italic underline">Етап І: Конструктив (50%)</h4>
            <div className="space-y-3 text-sm italic">
                <div className="flex justify-between items-center">
                    <span>Дата в роботу:</span>
                    <EditableDate
                        value={order.date_to_work}
                        onSave={(val) => handleQuickUpdate('date_to_work', val)}
                        className="font-bold cursor-pointer"
                    />
                </div>
                <div className="flex justify-between"><span>Сума авансу:</span><span className="mono font-bold">{order.advance_amount.toLocaleString()} ₴</span></div>
                <div className="flex justify-between text-emerald-600 font-bold italic underline items-center">
                    <span>Дата оплати:</span>
                    <EditableDate
                        value={order.date_advance_paid}
                        onSave={(val) => handleQuickUpdate('date_advance_paid', val)}
                        emptyText="Очікується"
                        className="text-emerald-700"
                    />
                </div>
            </div>
        </div>

        {/* Stage 2 */}
        <div className={`bg-white p-6 rounded-3xl border ${order.is_critical_debt ? 'border-red-200 bg-red-50' : 'border-emerald-100 opacity-60'}`}>
            <h4 className={`text-xs font-bold uppercase mb-4 italic underline ${order.is_critical_debt ? 'text-red-600' : 'text-emerald-600'}`}>Етап ІІ: Встановлення (50%)</h4>
            <div className="space-y-3 text-sm italic">
                <div className="flex justify-between items-center">
                    <span>Дата монтажу:</span>
                    <EditableDate
                        value={order.date_installation}
                        onSave={(val) => handleQuickUpdate('date_installation', val)}
                        className="font-bold"
                    />
                </div>
                <div className="flex justify-between"><span>Сума залишку:</span><span className="mono font-bold">{order.remainder_amount.toLocaleString()} ₴</span></div>
                <div className="flex justify-between italic items-center">
                    <span>Дата оплати:</span>
                    <EditableDate
                        value={order.date_final_paid}
                        onSave={(val) => handleQuickUpdate('date_final_paid', val)}
                        emptyText="Очікується"
                        className={`italic uppercase ${order.is_critical_debt ? 'text-red-600 font-black' : ''}`}
                    />
                </div>
            </div>
        </div>
    </div>

{/* Deductions Section */ }
                <div className="p-8 border-b border-slate-100">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-black text-red-600 uppercase italic flex items-center gap-2">
                            <i className="fas fa-exclamation-triangle"></i> Мої провини / Штрафи
                        </h3>
                        <button
                            onClick={() => setShowDeductionModal(true)}
                            className="px-4 py-2 bg-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-200 hover:bg-red-700 transition text-sm"
                        >
                            + Додати штраф
                        </button>
                    </div>

                    {deductions.length === 0 ? (
                        <div className="text-center py-8 bg-green-50 rounded-2xl border border-green-200">
                            <i className="fas fa-check-circle text-4xl text-green-500 mb-2"></i>
                            <p className="text-green-700 font-bold">Штрафів немає! 🎉</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {deductions.map(deduction => (
                                <div
                                    key={deduction.id}
                                    className={`p-4 rounded-xl border-2 ${deduction.is_paid
                                        ? 'bg-green-50 border-green-200'
                                        : 'bg-red-50 border-red-200'
                                        }`}
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                <span className={`text-xs font-bold px-3 py-1 rounded-full ${deduction.is_paid
                                                    ? 'bg-green-200 text-green-800'
                                                    : 'bg-red-200 text-red-800'
                                                    }`}>
                                                    {deduction.is_paid ? '✓ Погашено' : '× Не погашено'}
                                                </span>
                                                <span className="text-xs text-slate-500">
                                                    {formatDate(deduction.date_created)}
                                                </span>
                                            </div>
                                            <p className="text-sm text-slate-700 font-medium mb-1">
                                                {deduction.description}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl font-black text-red-600">
                                                {deduction.amount.toLocaleString()} ₴
                                            </span>
                                            {!deduction.is_paid && (
                                                <button
                                                    onClick={() => handleDeleteDeduction(deduction.id)}
                                                    className="text-red-600 hover:text-red-800 p-2"
                                                    title="Видалити"
                                                >
                                                    <i className="fas fa-trash"></i>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <div className="mt-4 pt-4 border-t-2 border-red-200">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-bold text-slate-700 uppercase">Всього штрафів:</span>
                                    <span className="text-2xl font-black text-red-600">
                                        {deductions.reduce((sum, d) => sum + d.amount, 0).toLocaleString()} ₴
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <FileManager projectId={order.id} />

            </div >

    {/* Deduction Modal */ }
{
    showDeductionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full mx-4">
                <h3 className="text-2xl font-black text-red-600 mb-6 flex items-center gap-2">
                    <i className="fas fa-exclamation-triangle"></i> Додати штраф
                </h3>
                <form onSubmit={handleCreateDeduction} className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Сума (₴)</label>
                        <input
                            type="number"
                            step="0.01"
                            value={deductionForm.amount}
                            onChange={e => setDeductionForm({ ...deductionForm, amount: e.target.value })}
                            required
                            className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Опис провини</label>
                        <textarea
                            value={deductionForm.description}
                            onChange={e => setDeductionForm({ ...deductionForm, description: e.target.value })}
                            required
                            rows={3}
                            placeholder="Наприклад: Брак матеріалу, помилка розмірів..."
                            className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Дата</label>
                        <input
                            type="date"
                            value={deductionForm.date_created}
                            onChange={e => setDeductionForm({ ...deductionForm, date_created: e.target.value })}
                            required
                            className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
                        />
                    </div>
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={() => setShowDeductionModal(false)}
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
    )
}
        </div >
    );
};

export default OrderDetail;
