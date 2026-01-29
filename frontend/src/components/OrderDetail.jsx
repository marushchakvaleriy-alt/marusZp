import React, { useState, useEffect } from 'react';
import { updateOrder, deleteOrder, getDeductions, createDeduction, deleteDeduction } from '../api';
import FileManager from './FileManager';

const OrderDetail = ({ order, onBack, onUpdate }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [isEditingInfo, setIsEditingInfo] = useState(false);
    const [formData, setFormData] = useState({
        date_to_work: order.date_to_work || '',
        date_advance_paid: order.date_advance_paid || '',
        date_installation: order.date_installation || '',
        date_final_paid: order.date_final_paid || ''
    });
    const [infoData, setInfoData] = useState({
        name: order.name,
        price: order.price,
        product_types: order.product_types ? JSON.parse(order.product_types) : []
    });
    const [customType, setCustomType] = useState('');

    // Deductions state
    const [deductions, setDeductions] = useState([]);
    const [showDeductionModal, setShowDeductionModal] = useState(false);
    const [deductionForm, setDeductionForm] = useState({
        amount: '',
        description: '',
        date_created: new Date().toISOString().split('T')[0]
    });

    useEffect(() => {
        loadDeductions();
    }, [order.id]);

    const loadDeductions = async () => {
        try {
            const data = await getDeductions(order.id);
            setDeductions(data);
        } catch (error) {
            console.error('Failed to load deductions:', error);
        }
    };

    const handleSave = async () => {
        try {
            // Convert empty strings to null for dates
            const updateData = Object.fromEntries(
                Object.entries(formData).map(([key, value]) => [
                    key,
                    value === '' ? null : value
                ])
            );

            await updateOrder(order.id, updateData);
            setIsEditing(false);
            if (onUpdate) onUpdate(); // Refresh data
        } catch (error) {
            console.error('Failed to update order:', error);
            alert('Помилка при збереженні');
        }
    };

    const handleSaveInfo = async () => {
        try {
            const updateData = {
                name: infoData.name,
                price: parseFloat(infoData.price),
                product_types: JSON.stringify(infoData.product_types)
            };

            await updateOrder(order.id, updateData);
            setIsEditingInfo(false);
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error('Failed to update order:', error);
            alert('Помилка при збереженні');
        }
    };

    const handleDelete = async () => {
        if (window.confirm(`Ви впевнені, що хочете видалити замовлення "${order.name}"?`)) {
            try {
                await deleteOrder(order.id);
                onBack();
            } catch (error) {
                console.error('Failed to delete order:', error);
                alert('Помилка при видаленні');
            }
        }
    };

    const toggleProductType = (type) => {
        setInfoData(prev => ({
            ...prev,
            product_types: prev.product_types.includes(type)
                ? prev.product_types.filter(t => t !== type)
                : [...prev.product_types, type]
        }));
    };

    const addCustomType = () => {
        if (customType.trim() && !infoData.product_types.includes(customType.trim())) {
            setInfoData(prev => ({
                ...prev,
                product_types: [...prev.product_types, customType.trim()]
            }));
            setCustomType('');
        }
    };

    const removeProductType = (type) => {
        setInfoData(prev => ({
            ...prev,
            product_types: prev.product_types.filter(t => t !== type)
        }));
    };

    const handleCreateDeduction = async (e) => {
        e.preventDefault();
        try {
            await createDeduction({
                order_id: order.id,
                amount: parseFloat(deductionForm.amount),
                description: deductionForm.description,
                date_created: deductionForm.date_created
            });
            setShowDeductionModal(false);
            setDeductionForm({
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

    const handleDeleteDeduction = async (id) => {
        if (window.confirm('Видалити цей штраф?')) {
            try {
                await deleteDeduction(id);
                loadDeductions();
            } catch (error) {
                console.error('Failed to delete deduction:', error);
                alert('Помилка при видаленні');
            }
        }
    };

    const productOptions = [
        'Кухня', 'Шафа', 'Передпокій', 'Санвузол', 'Вітальня',
        'ТВ зона', 'Пенал', 'Гардероб', 'Стіл', 'Комод', 'Тумбочка'
    ];

    const formatDate = (dateString) => {
        if (!dateString) return '--.--.--';
        const date = new Date(dateString);
        return date.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: '2-digit' });
    };

    return (
        <div id="project-page">
            <button onClick={onBack} className="mb-6 text-slate-400 hover:text-blue-600 font-bold text-xs uppercase transition">
                <i className="fas fa-arrow-left mr-2"></i> Назад до реєстру
            </button>

            <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
                <div className="p-8 bg-slate-900 text-white">
                    {isEditingInfo ? (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs text-slate-400 mb-2">Назва</label>
                                <input
                                    type="text"
                                    value={infoData.name}
                                    onChange={e => setInfoData({ ...infoData, name: e.target.value })}
                                    className="w-full p-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-bold"
                                />
                            </div>

                            <div>
                                <label className="block text-xs text-slate-400 mb-2">Ціна</label>
                                <input
                                    type="number"
                                    value={infoData.price}
                                    onChange={e => setInfoData({ ...infoData, price: e.target.value })}
                                    className="w-full p-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-bold"
                                />
                            </div>

                            <div>
                                <label className="block text-xs text-slate-400 mb-2">Типи виробів</label>
                                {infoData.product_types.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        {infoData.product_types.map((type, idx) => (
                                            <span key={idx} className="inline-flex items-center gap-1 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-lg">
                                                {type}
                                                <button
                                                    type="button"
                                                    onClick={() => removeProductType(type)}
                                                    className="ml-1 hover:bg-blue-700 rounded-full w-4 h-4 flex items-center justify-center"
                                                >
                                                    ×
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}

                                <div className="grid grid-cols-3 gap-2 mb-2">
                                    {productOptions.map(type => (
                                        <label key={type} className="flex items-center gap-2 text-xs cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={infoData.product_types.includes(type)}
                                                onChange={() => toggleProductType(type)}
                                                className="w-3 h-3"
                                            />
                                            <span>{type}</span>
                                        </label>
                                    ))}
                                </div>

                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Інший тип..."
                                        value={customType}
                                        onChange={e => setCustomType(e.target.value)}
                                        onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addCustomType())}
                                        className="flex-1 p-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white"
                                    />
                                    <button
                                        type="button"
                                        onClick={addCustomType}
                                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                                    >
                                        +
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex justify-between items-center">
                            <div>
                                <h2 className="text-2xl font-black uppercase italic">{order.name}</h2>
                                {order.product_types && (() => {
                                    try {
                                        const types = JSON.parse(order.product_types);
                                        if (types && types.length > 0) {
                                            return (
                                                <div className="flex flex-wrap gap-2 mt-2">
                                                    {types.map((type, idx) => (
                                                        <span key={idx} className="text-xs font-bold bg-blue-600 text-white px-3 py-1 rounded-md">
                                                            {type}
                                                        </span>
                                                    ))}
                                                </div>
                                            );
                                        }
                                    } catch (e) {
                                        return null;
                                    }
                                })()}
                                <p className="text-slate-400 text-[10px] font-bold tracking-widest uppercase mt-1">Детальна інформація та документація</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] text-blue-400 font-bold uppercase">Загальний ПГ:</p>
                                <p className="text-2xl font-black">{order.bonus.toLocaleString()} ₴</p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 bg-slate-50 border-b flex justify-between items-center">
                    <div className="flex gap-2">
                        {isEditingInfo ? (
                            <>
                                <button onClick={() => setIsEditingInfo(false)} className="px-4 py-2 text-slate-400 font-bold text-sm hover:text-slate-600 transition">
                                    Скасувати
                                </button>
                                <button onClick={handleSaveInfo} className="px-6 py-2 bg-green-600 text-white font-bold rounded-xl shadow-lg shadow-green-200 hover:bg-green-700 transition">
                                    Зберегти зміни
                                </button>
                            </>
                        ) : (
                            <button onClick={() => setIsEditingInfo(true)} className="px-4 py-2 bg-slate-600 text-white font-bold rounded-xl shadow-lg hover:bg-slate-700 transition flex items-center gap-2">
                                <i className="fas fa-pencil-alt text-xs"></i> Редагувати замовлення
                            </button>
                        )}
                    </div>

                    <div className="flex gap-3">
                        <button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-200 hover:bg-red-700 transition flex items-center gap-2">
                            <i className="fas fa-trash text-xs"></i> Видалити
                        </button>

                        {isEditing ? (
                            <>
                                <button onClick={() => setIsEditing(false)} className="px-4 py-2 text-slate-400 font-bold text-sm hover:text-slate-600 transition">
                                    Скасувати
                                </button>
                                <button onClick={handleSave} className="px-6 py-2 bg-green-600 text-white font-bold rounded-xl shadow-lg shadow-green-200 hover:bg-green-700 transition">
                                    Зберегти дати
                                </button>
                            </>
                        ) : (
                            <button onClick={() => setIsEditing(true)} className="px-6 py-2 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition">
                                Редагувати дати
                            </button>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8 border-b border-slate-100 bg-slate-50/30">
                    {/* Stage 1 */}
                    <div className={`bg-white p-6 rounded-3xl border ${order.date_advance_paid ? 'border-green-200 bg-green-50/30' : 'border-blue-100'}`}>
                        <h4 className="text-xs font-bold text-blue-600 uppercase mb-4 italic underline">Етап І: Конструктив (50%)</h4>
                        <div className="space-y-3 text-sm italic">
                            <div className="flex justify-between items-center">
                                <span>Дата в роботу:</span>
                                {isEditing ? (
                                    <input
                                        type="date"
                                        className="px-3 py-1 border border-slate-300 rounded-lg font-bold"
                                        value={formData.date_to_work}
                                        onChange={e => setFormData({ ...formData, date_to_work: e.target.value })}
                                    />
                                ) : (
                                    <span className="font-bold">{formatDate(order.date_to_work)}</span>
                                )}
                            </div>
                            <div className="flex justify-between"><span>Сума авансу:</span><span className="mono font-bold">{order.advance_amount.toLocaleString()} ₴</span></div>
                            <div className="flex justify-between text-emerald-600 font-bold italic underline items-center">
                                <span>Дата оплати:</span>
                                {isEditing ? (
                                    <input
                                        type="date"
                                        className="px-3 py-1 border border-green-300 rounded-lg font-bold text-green-700"
                                        value={formData.date_advance_paid}
                                        onChange={e => setFormData({ ...formData, date_advance_paid: e.target.value })}
                                    />
                                ) : (
                                    <span>{formatDate(order.date_advance_paid) === '--.--.--' ? 'Очікується' : formatDate(order.date_advance_paid)}</span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Stage 2 */}
                    <div className={`bg-white p-6 rounded-3xl border ${order.is_critical_debt ? 'border-red-200 bg-red-50' : 'border-emerald-100 opacity-60'}`}>
                        <h4 className={`text-xs font-bold uppercase mb-4 italic underline ${order.is_critical_debt ? 'text-red-600' : 'text-emerald-600'}`}>Етап ІІ: Встановлення (50%)</h4>
                        <div className="space-y-3 text-sm italic">
                            <div className="flex justify-between items-center">
                                <span>Дата монтажу:</span>
                                {isEditing ? (
                                    <input
                                        type="date"
                                        className="px-3 py-1 border border-slate-300 rounded-lg font-bold"
                                        value={formData.date_installation}
                                        onChange={e => setFormData({ ...formData, date_installation: e.target.value })}
                                    />
                                ) : (
                                    <span className="font-bold">{formatDate(order.date_installation)}</span>
                                )}
                            </div>
                            <div className="flex justify-between"><span>Сума залишку:</span><span className="mono font-bold">{order.remainder_amount.toLocaleString()} ₴</span></div>
                            <div className="flex justify-between italic items-center">
                                <span>Дата оплати:</span>
                                {isEditing ? (
                                    <input
                                        type="date"
                                        className="px-3 py-1 border border-green-300 rounded-lg font-bold text-green-700"
                                        value={formData.date_final_paid}
                                        onChange={e => setFormData({ ...formData, date_final_paid: e.target.value })}
                                    />
                                ) : (
                                    <span className={`italic uppercase ${order.is_critical_debt ? 'text-red-600 font-black' : ''}`}>
                                        {formatDate(order.date_final_paid) === '--.--.--' ? 'Очікується' : formatDate(order.date_final_paid)}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Deductions Section */}
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

            </div>

            {/* Deduction Modal */}
            {showDeductionModal && (
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
            )}
        </div>
    );
};

export default OrderDetail;
