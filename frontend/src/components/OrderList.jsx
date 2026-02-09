import React, { useEffect, useState } from 'react';
import { getOrders, createOrder, getDeductions, updateOrder, getUsers, api } from '../api';
import PaymentModal from './PaymentModal';
import SettingsModal from './SettingsModal';
import CalendarView from './CalendarView';
import { useAuth } from '../context/AuthContext';


const CreateOrderModal = ({ isOpen, onClose, onSave }) => {
    const [formData, setFormData] = useState({
        name: '',
        price: '',
        date_received: new Date().toISOString().split('T')[0], // Default to today
        date_design_deadline: '', // New field
        material_cost: '',
        fixed_bonus: '',  // Manager can set exact amount
        product_types: [],
        constructor_id: ''
    });
    const [customType, setCustomType] = useState('');
    const [constructors, setConstructors] = useState([]);

    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';
    const isManager = user?.role === 'manager';
    const canManage = isAdmin || isManager;

    useEffect(() => {
        if (isOpen && canManage) {
            getUsers().then(users => {
                setConstructors(users);
            }).catch(console.error);
        }
    }, [isOpen, canManage]);

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
            material_cost: parseFloat(formData.material_cost) || 0,
            fixed_bonus: formData.fixed_bonus ? parseFloat(formData.fixed_bonus) : null,
            date_received: formData.date_received || new Date().toISOString().split('T')[0],
            date_design_deadline: formData.date_design_deadline || null,
            product_types: JSON.stringify(formData.product_types),
            date_to_work: null,
            constructor_id: formData.constructor_id ? parseInt(formData.constructor_id) : null
        });
        setFormData({
            name: '',
            price: '',
            date_received: new Date().toISOString().split('T')[0],
            date_design_deadline: '',
            product_types: [],
            constructor_id: ''
        });
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
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Дата дедлайну (Конструктив)</label>
                        <input
                            type="date"
                            className="w-full p-3 bg-slate-50 border border-red-100 rounded-xl font-bold text-slate-700 focus:outline-none focus:border-red-500"
                            value={formData.date_design_deadline || ''}
                            onChange={e => setFormData({ ...formData, date_design_deadline: e.target.value })}
                        />
                    </div>

                    {isAdmin && (
                        <div className="mb-4">
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Призначити конструктора</label>
                            <select
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:outline-none focus:border-blue-500"
                                value={formData.constructor_id}
                                onChange={e => setFormData({ ...formData, constructor_id: e.target.value })}
                            >
                                <option value="">-- Не призначено --</option>
                                {constructors.map(u => (
                                    <option key={u.id} value={u.id}>
                                        {u.full_name || u.username} ({u.role === 'admin' ? 'Адмін' : 'Конструктор'})
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Fixed Bonus - Manager Override */}
                    {isAdmin && (
                        <div className="col-span-2 bg-gradient-to-br from-amber-50 to-orange-50 p-4 rounded-2xl border-2 border-amber-200 mt-4">
                            <label className="block text-xs font-bold text-amber-700 uppercase mb-2">
                                💰 Фіксована оплата конструктора (перевизначення)
                            </label>
                            <input
                                type="number"
                                className="w-full p-3 bg-white border-2 border-amber-200 rounded-xl font-bold text-lg text-amber-700 focus:outline-none focus:border-amber-500"
                                value={formData.fixed_bonus}
                                onChange={e => setFormData({ ...formData, fixed_bonus: e.target.value })}
                                placeholder="Залиште порожнім для автоматичного розрахунку"
                            />
                            <p className="text-[10px] text-amber-600 mt-2 italic">
                                💡 Якщо встановлено, використовується ця сума замість розрахунку за налаштуваннями конструктора
                            </p>
                        </div>
                    )}

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
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [viewMode, setViewMode] = useState('active'); // 'active' or 'archived'
    const [isCalendarMode, setIsCalendarMode] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('id');
    const [sortOrder, setSortOrder] = useState('desc');
    const [filterConstructorId, setFilterConstructorId] = useState('');
    const [constructors, setConstructors] = useState([]);
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';
    const isManager = user?.role === 'manager';
    // Managers can manage orders (create, edit, assign) but might have fewer financial rights or deletion rights
    // Managers can manage orders, but double check role isn't constructor or undefined
    const canManage = (isAdmin || isManager) && user?.role !== 'constructor';

    // Show financials to Admin only? Or Manager too? 
    // Requirement says Manager manages constructors and sees info.
    // Let's assume Manager sees financials for now, or maybe restricted?
    // User requested: "менеджер також має можливість розподіляти замовлення по конструкторам і бачити інформацію на кому зараз задача"
    // Does not explicitly say "see money". But usually manager needs to know price.
    // Let's keep showFinancials = !isManager (from previous code) or change it?
    // Previous code: const showFinancials = !isManager; 
    // Wait, if !isManager, then Admin sees it (true), Constructor (role='constructor') sees it (true? no, user.role!='manager' is true for constructor).
    // Logic error in previous code?
    // user.role is 'admin', 'manager', 'constructor'.
    // if role='admin', showFinancials = true.
    // if role='constructor', showFinancials = true.
    // if role='manager', showFinancials = false.
    // This seems weird. Everyone sees financials except manager?
    // Let's fix this: Admin sees all. Constructor sees their own partials (handled by backend usually). 
    // Manager probably should see financials too.
    const showFinancials = true;

    useEffect(() => {
        if (canManage) {
            getUsers().then(setConstructors).catch(console.error);
        }
    }, [canManage]);

    const fetchOrders = async () => {
        try {
            const [ordersData, deductionsData] = await Promise.all([
                getOrders({ sort_by: sortBy, sort_order: sortOrder, limit: 1000 }), // Increase limit to avoid missing data
                getDeductions()
            ]);
            setOrders(ordersData);
            setDeductions(deductionsData);
        } catch (error) {
            console.error("Failed to fetch data:", error);
        }
    };

    useEffect(() => {
        if (user) {
            fetchOrders();
        }
    }, [refreshTrigger, user, sortBy, sortOrder]); // Re-fetch when sort changes

    const handleCreate = async (newOrder) => {
        try {
            await createOrder(newOrder);
            setIsModalOpen(false);
            fetchOrders();
        } catch (error) {
            console.error("Failed to create order:", error);
            const msg = error.response?.data?.detail || "Помилка при створенні замовлення";
            if (msg.includes("UndefinedColumn") || msg.includes("does not exist")) {
                alert("🔴 УВАГА! База даних не оновлена.\n\n👉 Натисніть ЧЕРВОНУ кнопку з ключем (🔧) біля кнопки 'Додати платіж', щоб виправити це автоматично.");
            } else {
                alert(msg);
            }
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return '--.--.--';
        const date = new Date(dateString);
        return date.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: '2-digit' });
    };

    const handleEditId = async (e, order) => {
        e.stopPropagation(); // Stop opening order details
        const newIdStr = prompt(`Введіть новий ID для замовлення "${order.name}" (поточний: ${order.id}):`, order.id);
        if (!newIdStr) return;

        const newId = parseInt(newIdStr);
        if (isNaN(newId) || newId === order.id) return;

        try {
            await updateOrder(order.id, { id: newId });
            fetchOrders();
        } catch (error) {
            console.error("Failed to update ID:", error);
            alert("Помилка при зміні ID: " + (error.response?.data?.detail || error.message));
        }
    };

    // Filter orders by completion status and search query
    const filteredOrders = orders.filter(order => {
        // Determine if order is completed (archived)
        // Determine if order is completed (archived)
        // CRITICAL: Order is completed if explicitly paid OR if installation is done and debt is covered by fines
        const orderFines = deductions
            .filter(d => d.order_id === order.id)
            .reduce((sum, d) => sum + d.amount, 0);

        const adjustedDebt = (order.is_critical_debt ? order.current_debt : order.remainder_amount) - orderFines;
        const isEffectivelyPaid = adjustedDebt <= 0.01;

        const isCompleted = !!order.date_final_paid || (!!order.date_installation && isEffectivelyPaid);

        // Filter by view mode
        const matchesViewMode = viewMode === 'active' ? !isCompleted : isCompleted;

        // Filter by search query
        const matchesSearch = searchQuery === '' ||
            order.id.toString().includes(searchQuery) ||
            order.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (order.product_types && order.product_types.toLowerCase().includes(searchQuery.toLowerCase()));

        const matchesConstructor = !filterConstructorId ||
            (filterConstructorId === 'unassigned' ? !order.constructor_id : order.constructor_id === parseInt(filterConstructorId));

        return matchesViewMode && matchesSearch && matchesConstructor;
    }); // Server-side sorting is used now

    return (
        <div id="list-page">
            <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 mb-8">
                <h1 className="text-2xl font-black text-slate-800 italic uppercase">Реєстр замовлень</h1>
                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 md:gap-4">
                    {isAdmin && (
                        <>
                            <button
                                onClick={async () => {
                                    if (confirm("Виправити структуру бази даних?")) {
                                        try {
                                            await api.get('/fix-db');
                                            alert("База даних оновлена! 🛠️");
                                            window.location.reload();
                                        } catch (e) {
                                            alert("Помилка: " + e.message);
                                        }
                                    }
                                }}
                                className="bg-red-500 text-white px-3 py-2 rounded-2xl font-bold uppercase text-xs shadow-lg hover:bg-red-600 transition flex items-center justify-center gap-2"
                                title="Виправити базу даних (якщо є помилки)"
                            >
                                <span className="text-xl">🔧</span>
                            </button>

                            <button
                                onClick={() => setIsSettingsOpen(true)}
                                className="bg-slate-700 text-white px-4 py-2 rounded-2xl font-bold uppercase text-xs shadow-lg hover:bg-slate-800 transition flex items-center justify-center gap-2"
                                title="Налаштування збереження файлів"
                            >
                                <i className="fas fa-cog text-lg"></i>
                            </button>
                        </>
                    )}

                    {canManage && (
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="bg-blue-600 text-white px-6 py-2 rounded-2xl font-bold uppercase text-xs shadow-lg shadow-blue-200 hover:bg-blue-700 transition flex items-center justify-center gap-2"
                        >
                            <span className="text-xl">+</span> Нове замовлення
                        </button>
                    )}

                    {isAdmin && (
                        <button
                            onClick={() => setIsPaymentModalOpen(true)}
                            className="bg-green-600 text-white px-6 py-2 rounded-2xl font-bold uppercase text-xs shadow-lg shadow-green-200 hover:bg-green-700 transition flex items-center justify-center gap-2"
                        >
                            <span className="text-xl">💵</span> Додати платіж
                        </button>
                    )}
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

                {/* Calendar Toggle */}
                <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                    <button
                        onClick={() => setIsCalendarMode(false)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-bold transition flex items-center gap-1 ${!isCalendarMode
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'text-slate-400 hover:text-slate-600'
                            }`}
                    >
                        <span>📋</span> Список
                    </button>
                    <button
                        onClick={() => setIsCalendarMode(true)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-bold transition flex items-center gap-1 ${isCalendarMode
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'text-slate-400 hover:text-slate-600'
                            }`}
                    >
                        <span>📅</span> Календар
                    </button>
                </div>

                {/* Constructor Filter */}
                {canManage && (
                    <div className="w-full md:w-64">
                        <select
                            value={filterConstructorId}
                            onChange={(e) => setFilterConstructorId(e.target.value)}
                            className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-200 outline-none transition font-bold text-slate-700 cursor-pointer bg-white"
                        >
                            <option value="">👨‍🔧 Всі конструктори</option>
                            <option value="unassigned">-- Не призначено --</option>
                            {constructors.map(c => (
                                <option key={c.id} value={c.id}>{c.full_name || c.username}</option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Sorting Dropdown Removed */}

                {/* Search Input */}
                <div className="flex-1">
                    <input
                        type="text"
                        placeholder="Пошук за ID, назвою..."
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
            {isSettingsOpen && <SettingsModal onClose={() => setIsSettingsOpen(false)} />}

            {isCalendarMode ? (
                <CalendarView orders={filteredOrders} onSelectOrder={onSelectOrder} />
            ) : (
                <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-xl overflow-hidden border border-white/20">
                    {/* Desktop Table View */}
                    <table className="hidden md:table w-full text-left border-collapse">
                        <thead>
                            <tr className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200/30">
                                <th
                                    className="p-4 pl-6 border-b font-bold cursor-pointer hover:bg-slate-100 transition select-none group"
                                    onClick={() => {
                                        if (sortBy === 'id') {
                                            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                                        } else {
                                            setSortBy('id');
                                            setSortOrder('desc');
                                        }
                                    }}
                                >
                                    <div className="flex items-center gap-1">
                                        ID
                                        {sortBy === 'id' && (
                                            <span className="text-blue-500">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                                        )}
                                        <span className="opacity-0 group-hover:opacity-30 text-slate-400">↕</span>
                                    </div>
                                </th>
                                <th
                                    className="p-4 border-b font-bold cursor-pointer hover:bg-slate-100 transition select-none group"
                                    onClick={() => {
                                        if (sortBy === 'name') {
                                            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                                        } else {
                                            setSortBy('name');
                                            setSortOrder('asc');
                                        }
                                    }}
                                >
                                    <div className="flex items-center gap-1">
                                        Виріб / Об'єкт
                                        {sortBy === 'name' && (
                                            <span className="text-blue-500">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                                        )}
                                        <span className="opacity-0 group-hover:opacity-30 text-slate-400">↕</span>
                                    </div>
                                </th>
                                <th className="p-4 border-b text-center font-bold text-purple-500">Прийнято в роботу</th>
                                <th className="p-4 border-b text-center font-bold text-red-500">Дедлайн</th>
                                {showFinancials && <th className="p-4 border-b text-right font-bold">Вартість</th>}
                                {showFinancials && <th className="p-4 border-b text-right font-bold text-blue-500">Конструкторська робота</th>}
                                <th className="p-4 border-b text-center font-bold text-slate-500 bg-slate-100/10">Етап I: Конструктив</th>
                                <th className="p-4 border-b text-center font-bold text-emerald-600/70 bg-emerald-50/10">Етап II: Монтаж</th>
                                {showFinancials && <th className="p-4 border-b text-center font-bold text-orange-600 bg-orange-50/10">Штрафи</th>}
                                {showFinancials && <th className="p-4 pr-6 border-b text-right font-bold">Борг/Залишок</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/20">
                            {filteredOrders.length === 0 ? (
                                <tr>
                                    <td colSpan="11" className="p-8 text-center text-slate-400 italic">
                                        Замовлень не знайдено
                                    </td>
                                </tr>
                            ) : (
                                filteredOrders.map((order) => {
                                    const bonus = order.bonus;
                                    // USE BACKEND VALUES, fall back to calculation only if missing
                                    const advanceAmount = showFinancials ? (order.advance_amount ?? (bonus * 0.5)) : 0;
                                    const finalAmount = showFinancials ? (order.final_amount ?? (bonus * 0.5)) : 0;
                                    const stageAmount = bonus * 0.5;

                                    const isPaidStage1 = !!order.date_advance_paid;
                                    const isPaidStage2 = !!order.date_final_paid;

                                    return (
                                        <tr key={order.id} className="hover:bg-white/10 transition cursor-pointer group" onClick={() => onSelectOrder(order)}>
                                            <td className="p-4 pl-6 text-slate-300 font-bold italic text-sm group-hover:text-blue-500 transition-colors">
                                                <div className="flex items-center gap-2">
                                                    #{order.id}
                                                    <button
                                                        onClick={(e) => handleEditId(e, order)}
                                                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-blue-600 transition"
                                                        title="Змінити ID"
                                                    >
                                                        ✎
                                                    </button>
                                                </div>
                                            </td>

                                            <td className="p-4">
                                                <div className="font-black text-slate-800 italic text-base">{order.name}</div>
                                                {/* Constructor Name Display / Edit */}
                                                <div onClick={(e) => e.stopPropagation()} className="mt-1">
                                                    {canManage ? (
                                                        <select
                                                            className="w-full text-xs font-bold text-blue-600 bg-blue-50/30 border-0 rounded-lg p-1 outline-none focus:ring-1 focus:ring-blue-300 cursor-pointer"
                                                            value={order.constructor_id || ""}
                                                            onChange={async (e) => {
                                                                const val = e.target.value ? parseInt(e.target.value) : null;
                                                                try {
                                                                    await updateOrder(order.id, { constructor_id: val });
                                                                    fetchOrders();
                                                                } catch (err) {
                                                                    alert("Помилка призначення конструктора");
                                                                }
                                                            }}
                                                        >
                                                            <option value="">-- Не призначено --</option>
                                                            {constructors.map(c => (
                                                                <option key={c.id} value={c.id}>
                                                                    {c.full_name || c.username}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    ) : (
                                                        order.constructor_id && (
                                                            <div className="text-xs font-bold text-blue-600 flex items-center gap-1">
                                                                <span>👨‍🔧</span>
                                                                {constructors.find(c => c.id === order.constructor_id)?.full_name || 'Невідомий'}
                                                            </div>
                                                        )
                                                    )}
                                                </div>
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

                                            <td className="p-4 text-center">
                                                {/* Design Deadline Input (Admin Only) */}
                                                {isAdmin && !isPaidStage1 && (
                                                    <div className="flex justify-center" onClick={e => e.stopPropagation()}>
                                                        <input
                                                            type="date"
                                                            className={`w-28 text-[12px] font-bold p-1 bg-white border rounded shadow-sm focus:border-blue-500 ${!order.date_to_work && order.date_design_deadline && new Date() > new Date(order.date_design_deadline)
                                                                ? 'border-red-400 text-red-600'
                                                                : 'border-slate-200 text-slate-700'
                                                                }`}
                                                            value={order.date_design_deadline || ''}
                                                            onChange={async (e) => {
                                                                try {
                                                                    await updateOrder(order.id, { date_design_deadline: e.target.value || null });
                                                                    fetchOrders();
                                                                } catch (err) {
                                                                    console.error("Failed to update deadline", err);
                                                                    alert("Помилка оновлення дедлайну");
                                                                }
                                                            }}
                                                        />
                                                    </div>
                                                )}
                                                {(!isAdmin || isPaidStage1) && order.date_design_deadline && (
                                                    (() => {
                                                        const isOverdue = !order.date_to_work && new Date() > new Date(order.date_design_deadline);
                                                        return (
                                                            <div className={`text-[12px] font-bold px-2 py-1 rounded inline-block ${isOverdue
                                                                ? 'text-red-500 bg-red-50 border border-red-100'
                                                                : 'text-blue-600 bg-blue-50 border border-blue-100'
                                                                }`}>
                                                                {isOverdue && '⚠️ '} {formatDate(order.date_design_deadline)}
                                                            </div>
                                                        );
                                                    })()
                                                )}
                                                {!order.date_design_deadline && !isAdmin && (
                                                    <span className="text-slate-300 text-xs">—</span>
                                                )}
                                            </td>

                                            {showFinancials && (
                                                <>
                                                    <td className="p-4 text-right font-bold text-slate-600 italic mono">
                                                        {order.price.toLocaleString()}
                                                    </td>
                                                    <td className="p-4 text-right font-black text-blue-600 italic text-lg mono">
                                                        {bonus.toLocaleString()}
                                                    </td>
                                                </>
                                            )}

                                            {(() => {
                                                // Calculate unpaid fines for this order
                                                const unpaidFines = deductions
                                                    .filter(d => d.order_id === order.id)
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
                                                        <td className="p-4 text-center bg-slate-50/20">
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
                                                                        {advanceAmount.toLocaleString()} ₴
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
                                                        <td className="p-4 text-center bg-emerald-50/20">
                                                            <div className="flex flex-col items-center">
                                                                <span className="text-[10px] font-bold text-slate-400 uppercase mb-1">
                                                                    Монтаж: {formatDate(order.date_installation)}
                                                                </span>
                                                                <span className={`text-sm font-black italic mono mb-1 ${isPaidStage2 ? 'text-green-600 underline decoration-2' : 'text-slate-300'}`}>
                                                                    {finalAmount.toLocaleString()} ₴
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
                                            {showFinancials && (
                                                <td className="p-4 text-center bg-orange-50/20">
                                                    {(() => {
                                                        const unpaidFines = deductions
                                                            .filter(d => d.order_id === order.id)
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
                                            )}

                                            {showFinancials && (
                                                <td className={`p-4 pr-6 text-right font-black text-lg italic mono ${order.is_critical_debt ? 'text-red-500' : 'text-slate-300'}`}>
                                                    {(() => {
                                                        const unpaidFines = deductions
                                                            .filter(d => d.order_id === order.id)
                                                            .reduce((sum, d) => sum + d.amount, 0);

                                                        let val;
                                                        if (order.is_critical_debt) {
                                                            val = order.current_debt - unpaidFines;
                                                        } else {
                                                            val = order.remainder_amount - unpaidFines;
                                                        }

                                                        // Clamp negative values to 0 (fines move to unallocated)
                                                        const displayVal = Math.max(0, val);
                                                        return (
                                                            <span>
                                                                {displayVal.toLocaleString(undefined, { minimumFractionDigits: 2 })} ₴
                                                            </span>
                                                        );
                                                    })()}
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>

                    {/* Mobile Card View */}
                    <div className="md:hidden divide-y divide-white/20">
                        {filteredOrders.map((order) => {
                            const bonus = order.bonus;
                            const stageAmount = bonus / 2;
                            const isPaidStage1 = !!order.date_advance_paid;
                            const isPaidStage2 = !!order.date_final_paid;
                            const unpaidFines = deductions
                                .filter(d => d.order_id === order.id)
                                .reduce((sum, d) => sum + d.amount, 0);
                            const adjustedDebt = order.is_critical_debt
                                ? order.current_debt - unpaidFines
                                : order.remainder_amount - unpaidFines;

                            return (
                                <div
                                    key={order.id}
                                    className="p-4 hover:bg-white/20 transition cursor-pointer bg-white/10 backdrop-blur-md mb-2 rounded-xl border border-white/20"
                                    onClick={() => onSelectOrder(order)}
                                >
                                    {/* Header: ID + Name */}
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <div className="text-slate-400 text-xs font-bold">#{order.id}</div>
                                                <button
                                                    onClick={(e) => handleEditId(e, order)}
                                                    className="text-slate-300 hover:text-blue-600 text-xs px-2"
                                                >
                                                    ✎
                                                </button>
                                            </div>
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
                                            {Math.max(0, adjustedDebt).toLocaleString(undefined, { minimumFractionDigits: 2 })} ₴
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )
            }

            {/* Empty State */}
            {
                !isCalendarMode && filteredOrders.length === 0 && (
                    <div className="text-center py-20">
                        <div className="inline-block p-6 rounded-full bg-slate-50 mb-4">
                            <span className="text-4xl">📭</span>
                        </div>
                        <h3 className="text-lg font-bold text-slate-400">Немає замовлень</h3>
                        <p className="text-slate-300">Спробуйте змінити фільтри або пошук</p>
                    </div>
                )
            }
        </div >
    );
};

export default OrderList;
