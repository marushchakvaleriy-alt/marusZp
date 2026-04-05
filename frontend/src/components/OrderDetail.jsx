import React, { useState, useEffect } from 'react';
import { updateOrder, deleteOrder, getDeductions, createDeduction, deleteDeduction, getUsers, getOrderCalculationHistory } from '../api';
import FileManager from './FileManager';
import { useAuth } from '../context/AuthContext';

// Editable Date Component
const EditableDate = ({ value, onSave, className, emptyText = "--.--.--" }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [dateValue, setDateValue] = useState(value || '');

    useEffect(() => {
        setDateValue(value || '');
    }, [value]);

    const handleSave = (newValue) => {
        setIsEditing(false);
        if (newValue !== value) {
            onSave(newValue || null);
        }
    };

    const handleChange = (e) => {
        const newValue = e.target.value;
        setDateValue(newValue);
        // Save immediately when date is picked
        if (newValue) {
            handleSave(newValue);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleSave(dateValue);
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
                onChange={handleChange}
                onBlur={() => handleSave(dateValue)}
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
    const { user } = useAuth(); // To check role
    const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
    const isManager = user?.role === 'manager';
    const canManage = isAdmin || isManager;
    // const [isEditing, setIsEditing] = useState(false); // Removed
    const [isEditingInfo, setIsEditingInfo] = useState(false);
    const [infoData, setInfoData] = useState({
        name: order.name,
        price: order.price,
        product_types: order.product_types ? JSON.parse(order.product_types) : [],
        constructor_id: order.constructor_id || '',
        manager_id: order.manager_id || '',
        material_cost: order.material_cost || 0,
        fixed_bonus: order.fixed_bonus || ''
    });
    const [constructors, setConstructors] = useState([]);
    const [managers, setManagers] = useState([]);

    useEffect(() => {
        if (isEditingInfo && canManage) {
            getUsers().then(users => {
                setConstructors(users.filter(u => u.role === 'constructor' || u.role === 'admin' || u.role === 'super_admin'));
                setManagers(users.filter(u => u.role === 'manager' || u.role === 'admin' || u.role === 'super_admin'));
            }).catch(console.error);
        }
    }, [isEditingInfo, canManage]);
    const [customType, setCustomType] = useState('');

    // Deductions state
    const [deductions, setDeductions] = useState([]);
    const [calculationHistory, setCalculationHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [showDeductionModal, setShowDeductionModal] = useState(false);
    const [deductionForm, setDeductionForm] = useState({
        amount: '',
        description: '',
        date_created: new Date().toISOString().split('T')[0]
    });

    useEffect(() => {
        loadDeductions();
        loadCalculationHistory();
    }, [
        order.id,
        order.advance_paid_amount,
        order.final_paid_amount,
        order.date_to_work,
        order.date_installation,
        order.date_advance_paid,
        order.date_final_paid,
        order.fixed_bonus,
        order.price
    ]);

    const loadDeductions = async () => {
        try {
            const data = await getDeductions(order.id);
            setDeductions(data);
        } catch (error) {
            console.error('Failed to load deductions:', error);
        }
    };

    const loadCalculationHistory = async () => {
        try {
            setHistoryLoading(true);
            const data = await getOrderCalculationHistory(order.id);
            setCalculationHistory(data);
        } catch (error) {
            console.error('Failed to load calculation history:', error);
            setCalculationHistory([]);
        } finally {
            setHistoryLoading(false);
        }
    };

    const handleQuickUpdate = async (field, value) => {
        try {
            await updateOrder(order.id, { [field]: value });
            await loadCalculationHistory();
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error('Failed to update order:', error);
            alert('Помилка при збереженні дати');
        }
    };

    // Removed handleSave

    const handleSaveInfo = async () => {
        try {
            const updateData = {
                name: infoData.name,
                price: parseFloat(infoData.price),
                material_cost: parseFloat(infoData.material_cost) || 0,
                fixed_bonus: infoData.fixed_bonus ? parseFloat(infoData.fixed_bonus) : null,
                product_types: JSON.stringify(infoData.product_types),
                constructor_id: infoData.constructor_id ? parseInt(infoData.constructor_id) : null,
                manager_id: infoData.manager_id ? parseInt(infoData.manager_id) : null
            };
            await updateOrder(order.id, updateData);
            await loadCalculationHistory();
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
            await Promise.all([loadDeductions(), loadCalculationHistory()]);
        } catch (error) {
            console.error('Failed to create deduction:', error);
            alert('Помилка при створенні штрафу');
        }
    };

    const handleDeleteDeduction = async (id) => {
        if (window.confirm('Видалити цей штраф?')) {
            try {
                await deleteDeduction(id);
                await Promise.all([loadDeductions(), loadCalculationHistory()]);
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

    const formatMoney = (value) => `${Number(value || 0).toLocaleString('uk-UA', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ₴`;

    const getHistoryEventStyle = (eventType) => {
        if (eventType === 'constructor_assigned') {
            return {
                badge: 'bg-indigo-100 text-indigo-700',
                amount: 'text-indigo-600',
                border: 'border-indigo-100',
                bg: 'bg-indigo-50/40'
            };
        }
        if (eventType === 'deduction_added') {
            return {
                badge: 'bg-red-100 text-red-700',
                amount: 'text-red-600',
                border: 'border-red-100',
                bg: 'bg-red-50/50'
            };
        }
        if (eventType === 'deduction_paid') {
            return {
                badge: 'bg-emerald-100 text-emerald-700',
                amount: 'text-emerald-600',
                border: 'border-emerald-100',
                bg: 'bg-emerald-50/50'
            };
        }
        if (eventType === 'payment_allocation') {
            return {
                badge: 'bg-blue-100 text-blue-700',
                amount: 'text-blue-600',
                border: 'border-blue-100',
                bg: 'bg-blue-50/40'
            };
        }
        if (eventType === 'stage_started') {
            return {
                badge: 'bg-violet-100 text-violet-700',
                amount: 'text-violet-600',
                border: 'border-violet-100',
                bg: 'bg-violet-50/40'
            };
        }
        if (eventType === 'installation_completed') {
            return {
                badge: 'bg-amber-100 text-amber-700',
                amount: 'text-amber-600',
                border: 'border-amber-100',
                bg: 'bg-amber-50/40'
            };
        }
        if (eventType === 'order_closed') {
            return {
                badge: 'bg-emerald-100 text-emerald-700',
                amount: 'text-emerald-600',
                border: 'border-emerald-100',
                bg: 'bg-emerald-50/40'
            };
        }
        return {
            badge: 'bg-slate-100 text-slate-700',
            amount: 'text-slate-700',
            border: 'border-slate-100',
            bg: 'bg-white'
        };
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
                                <label className="block text-xs text-green-400 mb-2">Вартість матеріалів (для розрахунку ЗП)</label>
                                <input
                                    type="number"
                                    value={infoData.material_cost}
                                    onChange={e => setInfoData({ ...infoData, material_cost: e.target.value })}
                                    className="w-full p-2 bg-slate-800 border border-green-900 rounded-lg text-green-400 font-bold"
                                />
                            </div>

                            {isAdmin && (
                                <div className="p-3 bg-amber-900/20 border border-amber-500/30 rounded-xl">
                                    <label className="block text-xs text-amber-400 mb-2 font-bold uppercase">
                                        💰 Фіксована оплата (перевизначення)
                                    </label>
                                    <input
                                        type="number"
                                        value={infoData.fixed_bonus}
                                        onChange={e => setInfoData({ ...infoData, fixed_bonus: e.target.value })}
                                        placeholder="Автоматично..."
                                        className="w-full p-2 bg-slate-800 border border-amber-700 rounded-lg text-amber-400 font-bold"
                                    />
                                </div>
                            )}

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

                            {/* Role Selection (Admin Only) */}
                            {isAdmin && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs text-slate-400 mb-2 font-bold uppercase">Конструктор</label>
                                        <select
                                            value={infoData.constructor_id}
                                            onChange={e => setInfoData({ ...infoData, constructor_id: e.target.value })}
                                            className="w-full p-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-bold"
                                        >
                                            <option value="">-- Не призначено --</option>
                                            {constructors.map(u => (
                                                <option key={u.id} value={u.id}>
                                                    {u.full_name || u.username} ({u.role === 'super_admin' ? 'Супер-Адмін' : u.role === 'admin' ? 'Адмін' : 'Конструктор'})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-400 mb-2 font-bold uppercase">Менеджер</label>
                                        <select
                                            value={infoData.manager_id}
                                            onChange={e => setInfoData({ ...infoData, manager_id: e.target.value })}
                                            className="w-full p-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-bold"
                                        >
                                            <option value="">-- Не призначено --</option>
                                            {managers.map(u => (
                                                <option key={u.id} value={u.id}>
                                                    {u.full_name || u.username} ({u.role === 'super_admin' ? 'Супер-Адмін' : u.role === 'admin' ? 'Адмін' : 'Менеджер'})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            )}
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
                            <div className="text-right flex gap-6 items-center">
                                {isAdmin && (
                                    <button
                                        onClick={handleDelete}
                                        className="p-3 bg-red-600/20 text-red-500 hover:bg-red-600 hover:text-white rounded-2xl transition-all duration-300 group"
                                        title="Видалити замовлення"
                                    >
                                        <i className="fas fa-trash-alt group-hover:scale-110 transition-transform"></i>
                                    </button>
                                )}
                                {order.material_cost > 0 && (
                                    <div>
                                        <p className="text-[10px] text-green-400 font-bold uppercase">Матеріали:</p>
                                        <p className="text-xl font-black text-green-400">{order.material_cost.toLocaleString()} ₴</p>
                                    </div>
                                )}
                                {order.fixed_bonus > 0 && (
                                    <div>
                                        <p className="text-[10px] text-amber-500 font-bold uppercase">Фіксована ЗП:</p>
                                        <p className="text-xl font-black text-amber-600">{order.fixed_bonus.toLocaleString()} ₴</p>
                                    </div>
                                )}
                                <div>
                                    <p className="text-[10px] text-blue-400 font-bold uppercase">Загальний ПГ:</p>
                                    <p className="text-2xl font-black">{order.bonus.toLocaleString()} ₴</p>
                                </div>
                                {order.manager_bonus > 0 && (
                                    <div className="border-l border-slate-700 pl-6">
                                        <p className="text-[10px] text-amber-400 font-bold uppercase">Менеджерська премія:</p>
                                        <p className="text-2xl font-black text-amber-500">{order.manager_bonus.toLocaleString()} ₴</p>
                                    </div>
                                )}
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
                            canManage && (
                            <button onClick={() => setIsEditingInfo(true)} className="px-4 py-2 bg-slate-600 text-white font-bold rounded-xl shadow-lg hover:bg-slate-700 transition flex items-center gap-2">
                                <i className="fas fa-pencil-alt text-xs"></i> Редагувати замовлення
                            </button>
                            )
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

                    {/* Manager Payment Section */}
                    {order.manager_id && (
                        <div className={`col-span-1 md:col-span-2 bg-gradient-to-br from-amber-50 to-orange-50 p-6 rounded-3xl border ${order.date_manager_paid ? 'border-green-200 bg-green-50/50' : 'border-amber-200'}`}>
                            <h4 className="text-xs font-bold text-amber-700 uppercase mb-4 italic underline">Оплата менеджера</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm italic">
                                <div className="flex justify-between md:flex-col md:items-start gap-1">
                                    <span className="text-slate-500">Нараховано:</span>
                                    <span className="mono font-black text-lg text-amber-800">{order.manager_bonus.toLocaleString()} ₴</span>
                                </div>
                                <div className="flex justify-between md:flex-col md:items-start gap-1">
                                    <span className="text-slate-500">Виплачено:</span>
                                    <div className="flex items-center gap-2">
                                        <span className="mono font-bold text-slate-700">{order.manager_paid_amount.toLocaleString()} ₴</span>
                                        {isAdmin && (
                                            <button 
                                                onClick={() => {
                                                    const val = prompt('Введіть суму оплати менеджера:', order.manager_paid_amount);
                                                    if (val !== null) handleQuickUpdate('manager_paid_amount', parseFloat(val) || 0);
                                                }}
                                                className="text-amber-600 hover:text-amber-800"
                                            >
                                                <i className="fas fa-edit text-xs"></i>
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="flex justify-between md:flex-col md:items-start gap-1">
                                    <span className="text-slate-500">Дата виплати:</span>
                                    <EditableDate
                                        value={order.date_manager_paid}
                                        onSave={(val) => handleQuickUpdate('date_manager_paid', val)}
                                        emptyText="Не виплачено"
                                        className="text-emerald-700 font-bold"
                                    />
                                </div>
                            </div>
                            {order.manager_remaining > 0 && !order.date_manager_paid && (
                                <div className="mt-4 pt-4 border-t border-amber-200 flex justify-between items-center text-xs">
                                    <span className="font-bold text-amber-800 uppercase italic">Залишок до виплати:</span>
                                    <span className="text-lg font-black text-amber-600">{order.manager_remaining.toLocaleString()} ₴</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="p-8 border-b border-slate-100 bg-slate-50/30">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
                        <div>
                            <h3 className="text-xl font-black text-slate-800 uppercase italic flex items-center gap-2">
                                <i className="fas fa-calculator text-blue-600"></i> Історія розрахунків
                            </h3>
                            <p className="text-sm text-slate-500 mt-1">Хронологія нарахувань, штрафів, виплат і залишку по цьому замовленню</p>
                        </div>
                        <div className="text-xs font-bold uppercase tracking-widest text-slate-400">
                            {calculationHistory.length} подій
                        </div>
                    </div>

                    {historyLoading ? (
                        <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center text-slate-400 font-bold">
                            Завантажую історію розрахунків...
                        </div>
                    ) : calculationHistory.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center text-slate-400 font-bold">
                            Історія розрахунків ще порожня
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {calculationHistory.map((item, index) => {
                                const style = getHistoryEventStyle(item.event_type);
                                const amountLabel = item.event_type === 'deduction_added'
                                    ? `-${formatMoney(item.amount)}`
                                    : item.event_type === 'payment_allocation'
                                        ? `+${formatMoney(item.amount)}`
                                        : formatMoney(item.amount);

                                return (
                                    <div key={`${item.event_type}-${item.event_date || 'none'}-${index}`} className={`rounded-2xl border p-5 ${style.border} ${style.bg}`}>
                                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                                            <div className="flex-1">
                                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                                    <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full ${style.badge}`}>
                                                        {item.event_type === 'created' && 'Старт'}
                                                        {item.event_type === 'constructor_assigned' && 'Передача'}
                                                        {item.event_type === 'stage_started' && 'Етап'}
                                                        {item.event_type === 'installation_completed' && 'Монтаж'}
                                                        {item.event_type === 'payment_allocation' && 'Виплата'}
                                                        {item.event_type === 'deduction_added' && 'Штраф'}
                                                        {item.event_type === 'deduction_paid' && 'Погашення'}
                                                        {item.event_type === 'order_closed' && 'Закрито'}
                                                    </span>
                                                    <span className="text-xs font-bold text-slate-500">{formatDate(item.event_date)}</span>
                                                </div>
                                                <div className="text-lg font-black text-slate-800">{item.title}</div>
                                                <p className="text-sm text-slate-600 mt-2 leading-relaxed">{item.description}</p>
                                            </div>

                                            <div className="text-right min-w-[150px]">
                                                {item.amount > 0 ? (
                                                    <>
                                                        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Вплив</div>
                                                        <div className={`text-xl font-black ${style.amount}`}>{amountLabel}</div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Вплив</div>
                                                        <div className="text-base font-black text-slate-400">Інфо</div>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3 mt-4 pt-4 border-t border-slate-200/70">
                                            <div className="bg-white/80 rounded-xl p-3">
                                                <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">ПГ</div>
                                                <div className="font-black text-slate-800">{formatMoney(item.snapshot.bonus)}</div>
                                            </div>
                                            <div className="bg-white/80 rounded-xl p-3">
                                                <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">Етап I</div>
                                                <div className="font-black text-blue-700">{formatMoney(item.snapshot.advance_amount)}</div>
                                                <div className="text-[11px] text-slate-500 mt-1">опл. {formatMoney(item.snapshot.advance_paid_amount)}</div>
                                            </div>
                                            <div className="bg-white/80 rounded-xl p-3">
                                                <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">Етап II</div>
                                                <div className="font-black text-violet-700">{formatMoney(item.snapshot.final_amount)}</div>
                                                <div className="text-[11px] text-slate-500 mt-1">опл. {formatMoney(item.snapshot.final_paid_amount)}</div>
                                            </div>
                                            <div className="bg-white/80 rounded-xl p-3">
                                                <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">Штрафи</div>
                                                <div className="font-black text-red-600">{formatMoney(item.snapshot.unpaid_deductions)}</div>
                                            </div>
                                            <div className="bg-white/80 rounded-xl p-3">
                                                <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">Борг зараз</div>
                                                <div className={`font-black ${item.snapshot.current_debt > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                                    {formatMoney(item.snapshot.current_debt)}
                                                </div>
                                            </div>
                                            <div className="bg-white/80 rounded-xl p-3">
                                                <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">Залишок всього</div>
                                                <div className="font-black text-slate-800">{formatMoney(item.snapshot.remainder_amount)}</div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Deductions Section */}
                <div className="p-8 border-b border-slate-100">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-black text-red-600 uppercase italic flex items-center gap-2">
                            <i className="fas fa-exclamation-triangle"></i> Мої провини / Штрафи
                        </h3>
                        {canManage && (
                            <button
                                onClick={() => setShowDeductionModal(true)}
                                className="px-4 py-2 bg-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-200 hover:bg-red-700 transition text-sm"
                            >
                                + Додати штраф
                            </button>
                        )}
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
                                            {canManage && !deduction.is_paid && (
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

            {/* Deduction Modal */}
            {
                canManage && showDeductionModal && (
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
