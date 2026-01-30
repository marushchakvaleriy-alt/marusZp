import React, { useEffect, useState } from 'react';
import { getOrders, createOrder, getDeductions } from '../api';
import PaymentModal from './PaymentModal';


const CreateOrderModal = ({ isOpen, onClose, onSave }) => {
    const [formData, setFormData] = useState({
        name: '',
        price: '',
        date_received: '',
        product_types: []
    });
    const [customType, setCustomType] = useState('');

    const productOptions = [
        'Кухня', 'Шафа', 'Передпокій', 'Санвузол', 'Вітальня',
        'ТВ зона', 'Пенал', 'Гардероб', 'Стіл', 'Комод', 'Тумбочка'
    ];

    if (!isOpen) return null;

    const toggleProductType = (type) => {
        setFormData(prev => ({
            ...prev,
            product_types: prev.product_types.includes(type)
                ? prev.product_types.filter(t => t !== type)
                : [...prev.product_types, type]
        }));
    };

    const addCustomType = () => {
        if (customType.trim() && !formData.product_types.includes(customType.trim())) {
            setFormData(prev => ({
                ...prev,
                product_types: [...prev.product_types, customType.trim()]
            }));
            setCustomType('');
        }
    };

    const removeProductType = (type) => {
        setFormData(prev => ({
            ...prev,
            product_types: prev.product_types.filter(t => t !== type)
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({
            name: formData.name,
            price: parseFloat(formData.price),
            date_received: formData.date_received || null,
            product_types: JSON.stringify(formData.product_types),
            date_to_work: null
        });
        setFormData({ name: '', price: '', date_received: '', product_types: [] });
        setCustomType('');
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50">
            <div className="bg-white rounded-3xl p-8 w-[600px] max-h-[90vh] overflow-y-auto shadow-2xl">
                <h2 className="text-xl font-black text-slate-800 uppercase italic mb-6">Нове замовлення</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Назва об'єкту</label>
                        <input
                            type="text"
                            required
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:outline-none focus:border-blue-500"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>


                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Типи виробів</label>

                        {/* Selected types */}
                        {formData.product_types.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-3 p-3 bg-blue-50 rounded-xl">
                                {formData.product_types.map((type, idx) => (
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

                        <div className="grid grid-cols-2 gap-2 mb-3">
                            {productOptions.map(type => (
                                <label key={type} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg hover:bg-blue-50 cursor-pointer transition">
                                    <input
                                        type="checkbox"
                                        checked={formData.product_types.includes(type)}
                                        onChange={() => toggleProductType(type)}
                                        className="w-4 h-4 accent-blue-600"
                                    />
                                    <span className="text-sm font-bold text-slate-700">{type}</span>
                                </label>
                            ))}
                        </div>

                        {/* Custom input */}
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="Інший тип виробу..."
                                value={customType}
                                onChange={(e) => setCustomType(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomType())}
                                className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 focus:outline-none focus:border-blue-500"
                            />
                            <button
                                type="button"
                                onClick={addCustomType}
                                className="px-4 py-2 bg-slate-200 text-slate-700 font-bold text-sm rounded-lg hover:bg-slate-300 transition"
                            >
                                + Додати
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Ціна (Загальна)</label>
                        <input
                            type="number"
                            required
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:outline-none focus:border-blue-500"
                            value={formData.price}
                            onChange={e => setFormData({ ...formData, price: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Дата отримання</label>
                        <input
                            type="date"
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:outline-none focus:border-blue-500"
                            value={formData.date_received}
                            onChange={e => setFormData({ ...formData, date_received: e.target.value })}
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-slate-400 font-bold text-sm hover:text-slate-600 transition">Скасувати</button>
                        <button type="submit" className="px-6 py-2 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition">Створити</button>
                    </div>
                </form>
            </div>
        </div>
    );
};


const OrderList = ({ onSelectOrder, onPaymentAdded, refreshTrigger }) => {
    const [orders, setOrders] = useState([]);
    const [deductions, setDeductions] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [viewMode, setViewMode] = useState('active'); // 'active' or 'archived'
    const [searchQuery, setSearchQuery] = useState('');

    const fetchOrders = async () => {
        try {
            const [ordersData, deductionsData] = await Promise.all([
                getOrders(),
                getDeductions()
            ]);
            setOrders(ordersData);
            setDeductions(deductionsData);
        } catch (error) {
            console.error("Failed to fetch data:", error);
        }
    };

    useEffect(() => {
        fetchOrders();
    }, [refreshTrigger]);

    const handleCreate = async (newOrder) => {
        try {
            await createOrder(newOrder);
            setIsModalOpen(false);
            fetchOrders();
        } catch (error) {
            console.error("Failed to create order:", error);
            alert("Помилка при створенні замовлення");
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return '--.--.--';
        const date = new Date(dateString);
        return date.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: '2-digit' });
    };

    // Filter orders by completion status and search query
    const filteredOrders = orders.filter(order => {
        // Determine if order is completed (archived)
        const isCompleted = order.date_advance_paid && order.date_installation && order.date_final_paid;

        // Filter by view mode
        const matchesViewMode = viewMode === 'active' ? !isCompleted : isCompleted;

        // Filter by search query
        const matchesSearch = searchQuery === '' ||
            order.id.toString().includes(searchQuery) ||
            order.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (order.product_types && order.product_types.toLowerCase().includes(searchQuery.toLowerCase()));

        return matchesViewMode && matchesSearch;
    });

    return (
        <div id="list-page">
            <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 mb-8">
                <h1 className="text-2xl font-black text-slate-800 italic uppercase">Реєстр замовлень</h1>
                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 md:gap-4">
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="bg-blue-600 text-white px-6 py-2 rounded-2xl font-bold uppercase text-xs shadow-lg shadow-blue-200 hover:bg-blue-700 transition flex items-center justify-center gap-2"
                    >
                        <span className="text-xl">+</span> Нове замовлення
                    </button>

                    <button
                        onClick={() => setIsPaymentModalOpen(true)}
                        className="bg-green-600 text-white px-6 py-2 rounded-2xl font-bold uppercase text-xs shadow-lg shadow-green-200 hover:bg-green-700 transition flex items-center justify-center gap-2"
                    >
                        <span className="text-xl">💵</span> Додати платіж
                    </button>

                </div>
            </div>

            {/* Archive Toggle and Search */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
                {/* View Mode Toggle */}
                <div className="flex gap-2">
                    <button
                        onClick={() => setViewMode('active')}
                        className={`px-4 py-2 rounded-xl font-bold text-sm transition ${viewMode === 'active'
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                            }`}
                    >
                        Активні
                    </button>
                    <button
                        onClick={() => setViewMode('archived')}
                        className={`px-4 py-2 rounded-xl font-bold text-sm transition ${viewMode === 'archived'
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                            }`}
                    >
                        Архів
                    </button>
                </div>

                {/* Search Input */}
                <div className="flex-1">
                    <input
                        type="text"
                        placeholder="Пошук за ID, назвою або типом..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-200 outline-none transition"
                    />
                </div>
            </div>

            <CreateOrderModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleCreate} />
            <PaymentModal
                isOpen={isPaymentModalOpen}
                onClose={() => setIsPaymentModalOpen(false)}
                onSuccess={() => {
                    fetchOrders();
                    if (onPaymentAdded) onPaymentAdded();
                }}
            />

            <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
                {/* Desktop Table View */}
                <table className="hidden md:table w-full text-left border-collapse">
                    <thead>
                        <tr className="text-[10px] uppercase tracking-wider text-slate-400 bg-slate-50/80">
                            <th className="p-4 pl-6 border-b font-bold">ID</th>
                            <th className="p-4 border-b font-bold">Виріб / Об'єкт</th>
                            <th className="p-4 border-b text-center font-bold text-purple-500">Прийнято в роботу</th>
                            <th className="p-4 border-b text-right font-bold">Ціна (100%)</th>
                            <th className="p-4 border-b text-right font-bold text-blue-500">ЗП (5%)</th>
                            <th className="p-4 border-b text-center font-bold text-slate-500 bg-slate-100/50">Етап I: Конструктив (50%)</th>
                            <th className="p-4 border-b text-center font-bold text-emerald-600/70 bg-emerald-50/30">Етап II: Монтаж (50%)</th>
                            <th className="p-4 border-b text-center font-bold text-orange-600 bg-orange-50/30">Штрафи</th>
                            <th className="p-4 pr-6 border-b text-right font-bold">Борг/Залишок</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {filteredOrders.map((order) => {
                            const bonus = order.bonus;
                            const stageAmount = bonus / 2;
                            const isPaidStage1 = !!order.date_advance_paid;
                            const isPaidStage2 = !!order.date_final_paid;

                            return (
                                <tr key={order.id} className="hover:bg-blue-50/20 transition cursor-pointer group" onClick={() => onSelectOrder(order)}>
                                    <td className="p-4 pl-6 text-slate-300 font-bold italic text-sm">#{order.id}</td>

                                    <td className="p-4">
                                        <div className="font-black text-slate-800 italic text-base">{order.name}</div>
                                        {order.product_types && (() => {
                                            try {
                                                const types = JSON.parse(order.product_types);
                                                if (types && types.length > 0) {
                                                    return (
                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                            {types.map((type, idx) => (
                                                                <span key={idx} className="text-[9px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md uppercase">
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
                                    </td>

                                    <td className="p-4 text-center">
                                        <span className="text-sm font-bold text-purple-600 italic">
                                            {formatDate(order.date_received)}
                                        </span>
                                    </td>

                                    <td className="p-4 text-right font-bold text-slate-600 italic mono">
                                        {order.price.toLocaleString()}
                                    </td>

                                    <td className="p-4 text-right font-black text-blue-600 italic text-lg mono">
                                        {bonus.toLocaleString()}
                                    </td>

                                    {(() => {
                                        // Calculate unpaid fines for this order
                                        const unpaidFines = deductions
                                            .filter(d => d.order_id === order.id && !d.is_paid)
                                            .reduce((sum, d) => sum + d.amount, 0);

                                        // Calculate adjusted debt
                                        const adjustedDebt = (order.is_critical_debt ? order.current_debt : order.remainder_amount) - unpaidFines;

                                        // Determine if stages are effectively paid (debt covered by fines)
                                        const isEffectivelyPaid = adjustedDebt <= 0.01;

                                        // Stage 1 status
                                        const isPaidStage1 = !!order.date_advance_paid || (order.date_to_work && isEffectivelyPaid && order.advance_remaining <= 0.01);

                                        // Stage 2 status
                                        const isPaidStage2 = !!order.date_final_paid || (order.date_installation && isEffectivelyPaid);

                                        return (
                                            <>
                                                {/* Stage 1 */}
                                                <td className="p-4 text-center bg-slate-50/30">
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-[10px] font-bold text-slate-500 uppercase mb-1">
                                                            Здано: {formatDate(order.date_to_work)}
                                                        </span>
                                                        {order.advance_paid_amount > 0 && order.advance_paid_amount < order.advance_amount && !isPaidStage1 ? (
                                                            <span className="text-sm font-black italic mono mb-1 text-yellow-600">
                                                                {order.advance_paid_amount.toLocaleString()} / {order.advance_amount.toLocaleString()} ₴
                                                            </span>
                                                        ) : (
                                                            <span className={`text-sm font-black italic mono mb-1 ${isPaidStage1 ? 'text-green-600 underline decoration-2' : 'text-slate-400'}`}>
                                                                {stageAmount.toLocaleString()} ₴
                                                            </span>
                                                        )}
                                                        {isPaidStage1 ? (
                                                            <span className="text-[9px] font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-md uppercase">
                                                                {order.date_advance_paid ? `Оплата: ${formatDate(order.date_advance_paid).slice(0, 5)}` : 'ПОГАШЕНО'}
                                                            </span>
                                                        ) : order.date_to_work ? (
                                                            (() => {
                                                                // Calculate fines applied to this stage
                                                                const orderFines = deductions.filter(d => d.order_id === order.id && !d.is_paid);
                                                                const totalFines = orderFines.reduce((sum, d) => sum + d.amount, 0);

                                                                // Assume fines go to advance stage first (same logic as payment distribution)
                                                                const fineToAdvance = Math.min(totalFines, order.advance_amount);
                                                                const realPayment = order.advance_paid_amount;

                                                                return (
                                                                    <div className="text-[10px] font-bold text-red-600 uppercase">
                                                                        БОРГ
                                                                        <div className="text-xs mt-0.5 flex items-center justify-center gap-1">
                                                                            {realPayment > 0 && (
                                                                                <>
                                                                                    <span className="text-slate-700">{realPayment.toLocaleString()}</span>
                                                                                    {fineToAdvance > 0 && <span className="text-slate-400">+</span>}
                                                                                </>
                                                                            )}
                                                                            {fineToAdvance > 0 && (
                                                                                <span className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-bold">
                                                                                    {fineToAdvance.toLocaleString()} ШТРАФ
                                                                                </span>
                                                                            )}
                                                                            {(realPayment > 0 || fineToAdvance > 0) && (
                                                                                <span className="text-slate-400">/</span>
                                                                            )}
                                                                            <span className="text-slate-600">
                                                                                {(order.advance_amount - realPayment - fineToAdvance).toLocaleString()} ₴
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })()
                                                        ) : (
                                                            <span className="text-[9px] font-bold text-slate-400 border border-slate-200 px-2 py-0.5 rounded-md uppercase">
                                                                ОЧІКУЄ
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Stage 2 */}
                                                <td className="p-4 text-center bg-emerald-50/10">
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase mb-1">
                                                            Монтаж: {formatDate(order.date_installation)}
                                                        </span>
                                                        <span className={`text-sm font-black italic mono mb-1 ${isPaidStage2 ? 'text-green-600 underline decoration-2' : 'text-slate-300'}`}>
                                                            {stageAmount.toLocaleString()} ₴
                                                        </span>
                                                        {isPaidStage2 ? (
                                                            <span className="text-[9px] font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-md uppercase">
                                                                {order.date_final_paid ? `Оплата: ${formatDate(order.date_final_paid).slice(0, 5)}` : 'ПОГАШЕНО'}
                                                            </span>
                                                        ) : order.date_installation ? (
                                                            (() => {
                                                                // Calculate fines applied to this stage
                                                                const orderFines = deductions.filter(d => d.order_id === order.id && !d.is_paid);
                                                                const totalFines = orderFines.reduce((sum, d) => sum + d.amount, 0);

                                                                // Fines go to advance first, then final
                                                                const fineToAdvance = Math.min(totalFines, order.advance_amount);
                                                                const fineToFinal = Math.max(0, Math.min(totalFines - fineToAdvance, stageAmount));
                                                                const realPayment = order.final_paid_amount;

                                                                return (
                                                                    <div className="text-[10px] font-bold text-red-600 uppercase">
                                                                        БОРГ
                                                                        <div className="text-xs mt-0.5 flex items-center justify-center gap-1">
                                                                            {realPayment > 0 && (
                                                                                <>
                                                                                    <span className="text-slate-700">{realPayment.toLocaleString()}</span>
                                                                                    {fineToFinal > 0 && <span className="text-slate-400">+</span>}
                                                                                </>
                                                                            )}
                                                                            {fineToFinal > 0 && (
                                                                                <span className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-bold">
                                                                                    {fineToFinal.toLocaleString()} ШТРАФ
                                                                                </span>
                                                                            )}
                                                                            {(realPayment > 0 || fineToFinal > 0) && (
                                                                                <span className="text-slate-400">/</span>
                                                                            )}
                                                                            <span className="text-slate-600">
                                                                                {(stageAmount - realPayment - fineToFinal).toLocaleString()} ₴
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })()
                                                        ) : (
                                                            <span className="text-[9px] font-bold text-slate-400 border border-slate-200 px-2 py-0.5 rounded-md uppercase">
                                                                ОЧІКУЄ
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                            </>
                                        );
                                    })()}

                                    {/* Fines column */}
                                    <td className="p-4 text-center bg-orange-50/20">
                                        {(() => {
                                            const unpaidFines = deductions
                                                .filter(d => d.order_id === order.id && !d.is_paid)
                                                .reduce((sum, d) => sum + d.amount, 0);

                                            if (unpaidFines > 0) {
                                                return (
                                                    <span className="text-sm font-black italic text-orange-600">
                                                        {unpaidFines.toLocaleString()} ₴
                                                    </span>
                                                );
                                            } else {
                                                return <span className="text-xs text-slate-400">—</span>;
                                            }
                                        })()}
                                    </td>

                                    <td className={`p-4 pr-6 text-right font-black text-lg italic mono ${order.is_critical_debt ? 'text-red-500' : 'text-slate-300'}`}>
                                        {(() => {
                                            const unpaidFines = deductions
                                                .filter(d => d.order_id === order.id && !d.is_paid)
                                                .reduce((sum, d) => sum + d.amount, 0);

                                            if (order.is_critical_debt) {
                                                const adjustedDebt = order.current_debt - unpaidFines;
                                                // Don't show negative debt - show 0 if fines cover all debt
                                                const displayDebt = Math.max(0, adjustedDebt);
                                                return displayDebt.toLocaleString(undefined, { minimumFractionDigits: 2 });
                                            } else {
                                                const val = order.remainder_amount - unpaidFines;
                                                const displayVal = Math.max(0, val);
                                                return displayVal.toLocaleString(undefined, { minimumFractionDigits: 2 });
                                            }
                                        })()}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {/* Mobile Card View */}
                <div className="md:hidden divide-y divide-slate-100">
                    {filteredOrders.map((order) => {
                        const bonus = order.bonus;
                        const stageAmount = bonus / 2;
                        const isPaidStage1 = !!order.date_advance_paid;
                        const isPaidStage2 = !!order.date_final_paid;
                        const unpaidFines = deductions
                            .filter(d => d.order_id === order.id && !d.is_paid)
                            .reduce((sum, d) => sum + d.amount, 0);
                        const adjustedDebt = order.is_critical_debt
                            ? Math.max(0, order.current_debt - unpaidFines)
                            : Math.max(0, order.remainder_amount - unpaidFines);

                        return (
                            <div
                                key={order.id}
                                className="p-4 hover:bg-blue-50/20 transition cursor-pointer"
                                onClick={() => onSelectOrder(order)}
                            >
                                {/* Header: ID + Name */}
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1">
                                        <div className="text-slate-400 text-xs font-bold mb-1">#{order.id}</div>
                                        <div className="font-bold text-slate-800 text-sm">{order.name}</div>
                                        <div className="flex gap-1 mt-1 flex-wrap">
                                            {order.product_types && JSON.parse(order.product_types).map((type, idx) => (
                                                <span key={idx} className="bg-blue-100 text-blue-700 text-[9px] px-2 py-0.5 rounded-full font-bold uppercase">
                                                    {type}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[10px] text-slate-400 uppercase mb-0.5">Ціна</div>
                                        <div className="font-black text-slate-800 text-base">{order.price.toLocaleString()} ₴</div>
                                        <div className="text-[10px] text-blue-500 font-bold">ЗП: {bonus.toLocaleString()} ₴</div>
                                    </div>
                                </div>

                                {/* Date & Status */}
                                <div className="mb-3 text-xs">
                                    <div className="flex items-center gap-2 text-purple-600">
                                        <span className="font-bold uppercase text-[10px]">Прийнято:</span>
                                        <span className="font-bold">{formatDate(order.date_to_work)}</span>
                                    </div>
                                </div>

                                {/* Stages Grid */}
                                <div className="grid grid-cols-2 gap-2 mb-3">
                                    {/* Stage I */}
                                    <div className="bg-slate-50 rounded-lg p-2">
                                        <div className="text-[9px] text-slate-500 uppercase font-bold mb-1">Етап I</div>
                                        <div className="text-xs font-black text-slate-700 mb-1">{stageAmount.toLocaleString()} ₴</div>
                                        {isPaidStage1 ? (
                                            <div className="text-[9px] bg-green-100 text-green-700 px-2 py-0.5 rounded font-bold">ОПЛАЧЕНО</div>
                                        ) : order.date_to_work ? (
                                            <div className="text-[9px] text-red-600 font-bold">БОРГ</div>
                                        ) : (
                                            <div className="text-[9px] text-slate-400 font-bold">ОЧІКУЄ</div>
                                        )}
                                    </div>

                                    {/* Stage II */}
                                    <div className="bg-emerald-50/50 rounded-lg p-2">
                                        <div className="text-[9px] text-emerald-600 uppercase font-bold mb-1">Етап II</div>
                                        <div className="text-xs font-black text-slate-700 mb-1">{stageAmount.toLocaleString()} ₴</div>
                                        {isPaidStage2 ? (
                                            <div className="text-[9px] bg-green-100 text-green-700 px-2 py-0.5 rounded font-bold">ОПЛАЧЕНО</div>
                                        ) : order.date_installation ? (
                                            <div className="text-[9px] text-red-600 font-bold">БОРГ</div>
                                        ) : (
                                            <div className="text-[9px] text-slate-400 font-bold">ОЧІКУЄ</div>
                                        )}
                                    </div>
                                </div>

                                {/* Footer: Fines & Debt */}
                                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                                    {unpaidFines > 0 && (
                                        <div className="text-xs">
                                            <span className="text-orange-600 font-black">{unpaidFines.toLocaleString()} ₴</span>
                                            <span className="text-orange-500 text-[10px] ml-1">штрафи</span>
                                        </div>
                                    )}
                                    <div className={`text-sm font-black ml-auto ${order.is_critical_debt ? 'text-red-500' : 'text-slate-300'}`}>
                                        {adjustedDebt.toLocaleString(undefined, { minimumFractionDigits: 2 })} ₴
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div >
    );
};

export default OrderList;
