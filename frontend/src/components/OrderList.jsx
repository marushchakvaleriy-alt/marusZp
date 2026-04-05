import React, { useEffect, useState } from 'react';
import { getOrders, createOrder, getDeductions, updateOrder, getUsers, api } from '../api';
import PaymentModal from './PaymentModal';
import SettingsModal from './SettingsModal';
import CalendarView from './CalendarView';
import GanttView from './GanttView';
import { useAuth } from '../context/AuthContext';
import UKDatePicker from './UKDatePicker';


const CreateOrderModal = ({ isOpen, onClose, onSave }) => {
    const [formData, setFormData] = useState({
        name: '',
        price: '',
        date_received: new Date().toISOString().split('T')[0], // Default to today
        date_design_deadline: '', // New field
        constructive_days: 5,
        complectation_days: 2,
        preassembly_days: 1,
        installation_days: 3,
        material_cost: '',
        fixed_bonus: '',  // Manager can set exact amount
        product_types: [],
        constructor_id: '',
        manager_id: ''
    });
    const [customType, setCustomType] = useState('');
    const [constructors, setConstructors] = useState([]);
    const [managers, setManagers] = useState([]);

    const { user } = useAuth();
    const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
    const isManager = user?.role === 'manager';
    const canManage = isAdmin || isManager;

    useEffect(() => {
        if (isOpen && canManage) {
            getUsers().then(users => {
                setConstructors(users.filter(u => u.role === 'constructor' || u.role === 'admin' || u.role === 'super_admin'));
                setManagers(users.filter(u => u.role === 'manager' || u.role === 'admin' || u.role === 'super_admin'));
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
            constructive_days: Math.max(1, parseInt(formData.constructive_days) || 5),
            complectation_days: Math.max(1, parseInt(formData.complectation_days) || 2),
            preassembly_days: Math.max(1, parseInt(formData.preassembly_days) || 1),
            installation_days: Math.max(1, parseInt(formData.installation_days) || 3),
            product_types: JSON.stringify(formData.product_types),
            date_to_work: null,
            constructor_id: formData.constructor_id ? parseInt(formData.constructor_id) : null,
            manager_id: formData.manager_id ? parseInt(formData.manager_id) : null
        });
        setFormData({
            name: '',
            price: '',
            date_received: new Date().toISOString().split('T')[0],
            date_design_deadline: '',
            constructive_days: 5,
            complectation_days: 2,
            preassembly_days: 1,
            installation_days: 3,
            product_types: [],
            constructor_id: '',
            manager_id: '',
            material_cost: '',
            fixed_bonus: ''
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
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 text-green-600">Вартість матеріалів (для розрахунку ЗП)</label>
                        <input
                            type="number"
                            className="w-full p-3 bg-green-50/50 border border-green-200 rounded-xl font-bold text-green-700 focus:outline-none focus:border-green-500"
                            value={formData.material_cost}
                            placeholder="0"
                            onChange={e => setFormData({ ...formData, material_cost: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Дата дедлайну (Конструктив)</label>
                        <UKDatePicker
                            selected={formData.date_design_deadline}
                            onChange={date => setFormData({ ...formData, date_design_deadline: date })}
                            className="w-full p-3 bg-slate-50 border border-red-100 rounded-xl font-bold text-slate-700 focus:outline-none focus:border-red-500"
                        />
                    </div>

                    {canManage && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Днів: Конструктив</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="60"
                                    className="w-full p-3 bg-slate-50 border border-blue-100 rounded-xl font-bold text-slate-700 focus:outline-none focus:border-blue-500"
                                    value={formData.constructive_days}
                                    onChange={e => setFormData({ ...formData, constructive_days: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Днів: Комплектація</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="60"
                                    className="w-full p-3 bg-slate-50 border border-amber-100 rounded-xl font-bold text-slate-700 focus:outline-none focus:border-amber-500"
                                    value={formData.complectation_days}
                                    onChange={e => setFormData({ ...formData, complectation_days: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Днів: Предзбірка</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="60"
                                    className="w-full p-3 bg-slate-50 border border-violet-100 rounded-xl font-bold text-slate-700 focus:outline-none focus:border-violet-500"
                                    value={formData.preassembly_days}
                                    onChange={e => setFormData({ ...formData, preassembly_days: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Днів: Монтаж</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="60"
                                    className="w-full p-3 bg-slate-50 border border-emerald-100 rounded-xl font-bold text-slate-700 focus:outline-none focus:border-emerald-500"
                                    value={formData.installation_days}
                                    onChange={e => setFormData({ ...formData, installation_days: e.target.value })}
                                />
                            </div>
                        </div>
                    )}

                    {isAdmin && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Призначити конструктора</label>
                                <select
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:outline-none focus:border-blue-500"
                                    value={formData.constructor_id}
                                    onChange={e => setFormData({ ...formData, constructor_id: e.target.value })}
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
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Призначити менеджера</label>
                                <select
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:outline-none focus:border-blue-500"
                                    value={formData.manager_id}
                                    onChange={e => setFormData({ ...formData, manager_id: e.target.value })}
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
    const [viewLayout, setViewLayout] = useState('list'); // 'list' | 'calendar' | 'gantt'
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('id');
    const [sortOrder, setSortOrder] = useState('desc');
    const [activeTab, setActiveTab] = useState('constructors'); // 'constructors' or 'managers'
    const [filterConstructorId, setFilterConstructorId] = useState('');
    const [constructors, setConstructors] = useState([]);
    const [managers, setManagers] = useState([]);
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
    const isManager = user?.role === 'manager';
    // Managers can manage orders (create, edit, assign) but might have fewer financial rights or deletion rights
    // Managers can manage orders, but double check role isn't constructor or undefined
    const canManage = (isAdmin || isManager) && user?.role !== 'constructor';

    // Granular Permissions for Columns
    // Admin sees everything, Constructor sees own data
    // Manager - depends on individual permissions
    const canSeeConstructorPay = isAdmin ||
        user?.role === 'constructor' ||
        (isManager && user?.can_see_constructor_pay === true);

    const canSeeStage1 = isAdmin ||
        user?.role === 'constructor' ||
        (isManager && user?.can_see_stage1 === true);

    const canSeeStage2 = isAdmin ||
        user?.role === 'constructor' ||
        (isManager && user?.can_see_stage2 === true);

    const canSeeDebt = isAdmin ||
        user?.role === 'constructor' ||
        (isManager && user?.can_see_debt === true);

    // Keep showFinancials for price column and fines
    const showFinancials = true;

    useEffect(() => {
        if (canManage) {
            getUsers().then(users => {
                // Filter constructors and managers
                setConstructors(users.filter(u => u.role === 'constructor' || u.role === 'admin' || u.role === 'super_admin'));
                setManagers(users.filter(u => u.role === 'manager' || u.role === 'admin' || u.role === 'super_admin'));
            }).catch(console.error);
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
            const errorMsg = error.response?.data?.detail || error.message || "Невідома помилка";
            alert(`Помилка при зміні ID: ${errorMsg}`);
        }
    };

    const handleGanttUpdate = async (orderId, patch) => {
        try {
            await updateOrder(orderId, patch);
            fetchOrders();
        } catch (error) {
            console.error("Failed to update order plan:", error);
            alert("Помилка оновлення плану в Gantt");
        }
    };

    // Filter orders by completion status and search query
    const filteredOrders = orders.filter(order => {
        const isCompleted = !!order.date_final_paid || (!!order.date_installation && order.remainder_amount <= 0.01);


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
                
                {/* Tab Switcher */}
                <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl mb-1 w-fit">
                    <button
                        onClick={() => setActiveTab('constructors')}
                        className={`px-6 py-2 rounded-xl font-bold text-sm transition ${activeTab === 'constructors' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <i className="fas fa-drafting-compass mr-2"></i> Конструктори
                    </button>
                    <button
                        onClick={() => setActiveTab('managers')}
                        className={`px-6 py-2 rounded-xl font-bold text-sm transition ${activeTab === 'managers' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <i className="fas fa-user-tie mr-2"></i> Менеджери
                    </button>
                </div>

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

                {/* Layout Toggle */}
                <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                    <button
                        onClick={() => setViewLayout('list')}
                        className={`px-3 py-1.5 rounded-lg text-sm font-bold transition flex items-center gap-1 ${viewLayout === 'list'
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'text-slate-400 hover:text-slate-600'
                            }`}
                    >
                        <span>📋</span> Список
                    </button>
                    <button
                        onClick={() => setViewLayout('calendar')}
                        className={`px-3 py-1.5 rounded-lg text-sm font-bold transition flex items-center gap-1 ${viewLayout === 'calendar'
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'text-slate-400 hover:text-slate-600'
                            }`}
                    >
                        <span>📅</span> Календар
                    </button>
                    <button
                        onClick={() => setViewLayout('gantt')}
                        className={`px-3 py-1.5 rounded-lg text-sm font-bold transition flex items-center gap-1 ${viewLayout === 'gantt'
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'text-slate-400 hover:text-slate-600'
                            }`}
                    >
                        <span>📊</span> Gantt
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

            <CreateOrderModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                onSave={handleCreate} 
                constructors={constructors}
                managers={managers}
            />
            <PaymentModal
                isOpen={isPaymentModalOpen}
                onClose={() => setIsPaymentModalOpen(false)}
                onSuccess={() => {
                    fetchOrders();
                    if (onPaymentAdded) onPaymentAdded();
                }}
            />
            {isSettingsOpen && <SettingsModal onClose={() => setIsSettingsOpen(false)} />}

            {viewLayout === 'calendar' ? (
                <CalendarView orders={filteredOrders} onSelectOrder={onSelectOrder} />
            ) : viewLayout === 'gantt' ? (
                <GanttView
                    orders={filteredOrders}
                    onSelectOrder={onSelectOrder}
                    canManage={canManage}
                    onPlanUpdate={handleGanttUpdate}
                />
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
                                <th className="p-1 px-2 border-b text-center font-bold text-purple-500">Прийнято в роботу</th>
                                <th className="p-1 px-2 border-b text-center font-bold text-red-500">Дедлайн</th>
                                {(canManage) && <th className="p-1 px-2 border-b text-center font-bold text-purple-500">План. монтаж</th>}
                                
                                {activeTab === 'constructors' ? (
                                    <>
                                        {showFinancials && <th className="p-1 px-2 border-b text-right font-bold">Вартість</th>}
                                        {canSeeConstructorPay && <th className="p-1 px-2 border-b text-right font-bold text-blue-500">Конструкторська робота</th>}
                                        {canSeeStage1 && <th className="p-1 px-2 border-b text-center font-bold text-slate-500 bg-slate-100/10">Етап I: Конструктив</th>}
                                        {canSeeStage2 && <th className="p-1 px-2 border-b text-center font-bold text-emerald-600/70 bg-emerald-50/10">Етап II: Монтаж</th>}
                                    </>
                                ) : (
                                    <>
                                        {showFinancials && <th className="p-1 px-2 border-b text-right font-bold text-amber-600">Вартість проекту</th>}
                                        <th className="p-1 px-2 border-b text-right font-bold text-blue-600">Менеджерська премія</th>
                                        <th className="p-1 px-2 border-b text-center font-bold text-emerald-600 bg-emerald-50/10">Виплата менеджеру</th>
                                    </>
                                )}
                                
                                {showFinancials && <th className="p-1 px-2 border-b text-center font-bold text-orange-600 bg-orange-50/10">Штрафи</th>}
                                {canSeeDebt && <th className="p-1 px-2 border-b text-right font-bold">Борг/Залишок</th>}
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
                                    const advanceAmount = showFinancials ? (order.advance_amount ?? (bonus * 0.5)) : 0;
                                    const finalAmount = showFinancials ? (order.final_amount ?? (bonus * 0.5)) : 0;
                                    const stageAmount = bonus * 0.5;

                                    const isPaidStage1 = !!order.date_advance_paid;
                                    const isPaidStage2 = !!order.date_final_paid;

                                    return (
                                        <tr key={order.id} className="hover:bg-white/10 transition cursor-pointer group" onClick={() => onSelectOrder(order)}>
                                            <td className="p-1 pl-3 text-slate-300 font-bold italic text-sm group-hover:text-blue-500 transition-colors">
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

                                            <td className="p-1 px-2">
                                                <div className="font-black text-slate-800 italic text-base">{order.name}</div>
                                                <div onClick={(e) => e.stopPropagation()} className="mt-1">
                                                    {activeTab === 'constructors' ? (
                                                        canManage ? (
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
                                                                <option value="">-- Конструктор --</option>
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
                                                        )
                                                    ) : (
                                                        canManage ? (
                                                            <select
                                                                className="w-full text-xs font-bold text-indigo-600 bg-indigo-50/30 border-0 rounded-lg p-1 outline-none focus:ring-1 focus:ring-indigo-300 cursor-pointer"
                                                                value={order.manager_id || ""}
                                                                onChange={async (e) => {
                                                                    const val = e.target.value ? parseInt(e.target.value) : null;
                                                                    try {
                                                                        await updateOrder(order.id, { manager_id: val });
                                                                        fetchOrders();
                                                                    } catch (err) {
                                                                        alert("Помилка призначення менеджера");
                                                                    }
                                                                }}
                                                            >
                                                                <option value="">-- Менеджер --</option>
                                                                {managers.map(m => (
                                                                    <option key={m.id} value={m.id}>
                                                                        {m.full_name || m.username}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        ) : (
                                                            order.manager_id && (
                                                                <div className="text-xs font-bold text-indigo-600 flex items-center gap-1">
                                                                    <span>👤</span>
                                                                    {managers.find(m => m.id === order.manager_id)?.full_name || 'Невідомий'}
                                                                </div>
                                                            )
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

                                            <td className="p-1 px-2 text-center">
                                                <span className="text-sm font-bold text-purple-600 italic">
                                                    {formatDate(order.date_received)}
                                                </span>
                                            </td>

                                            <td className="p-4 text-center">
                                                {isAdmin && !isPaidStage1 && (
                                                    <div className="flex justify-center" onClick={e => e.stopPropagation()}>
                                                        <UKDatePicker
                                                            selected={order.date_design_deadline}
                                                            onChange={async (date) => {
                                                                try {
                                                                    await updateOrder(order.id, { date_design_deadline: date || null });
                                                                    fetchOrders();
                                                                } catch (err) {
                                                                    alert("Помилка оновлення дедлайну");
                                                                }
                                                            }}
                                                            className={`w-28 text-[12px] font-bold p-1 bg-white border rounded shadow-sm focus:border-blue-500 ${!order.date_to_work && order.date_design_deadline && new Date() > new Date(order.date_design_deadline)
                                                                ? 'border-red-400 text-red-600'
                                                                : 'border-slate-200 text-slate-700'
                                                                }`}
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
                                            </td>

                                            {(canManage) && (
                                                <td className="p-1 px-2 text-center">
                                                    <div className="flex flex-col items-center gap-1" onClick={e => e.stopPropagation()}>
                                                        <UKDatePicker
                                                            selected={order.date_installation_plan}
                                                            onChange={async (date) => {
                                                                try {
                                                                    await updateOrder(order.id, { date_installation_plan: date || null });
                                                                    await fetchOrders();
                                                                } catch (err) {
                                                                    alert(`Помилка оновлення дати монтажу: ${err.message || err}`);
                                                                }
                                                            }}
                                                            className="w-28 text-[12px] font-bold p-1 bg-white border border-slate-200 rounded shadow-sm text-purple-600 focus:border-purple-500"
                                                        />
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            max="60"
                                                            defaultValue={order.installation_days || 3}
                                                            className="w-16 text-[11px] font-bold p-1 bg-white border border-emerald-200 rounded shadow-sm text-emerald-700 text-center focus:border-emerald-500"
                                                            title="Кількість днів монтажу"
                                                            onBlur={async (e) => {
                                                                const parsed = Math.max(1, Math.min(60, parseInt(e.target.value || '3', 10)));
                                                                e.target.value = String(parsed);
                                                                if (parsed !== (order.installation_days || 3)) {
                                                                    try {
                                                                        await updateOrder(order.id, { installation_days: parsed });
                                                                        await fetchOrders();
                                                                    } catch (err) {
                                                                        alert(`Помилка оновлення тривалості монтажу: ${err.message || err}`);
                                                                    }
                                                                }
                                                            }}
                                                        />
                                                    </div>
                                                </td>
                                            )}

                                            {activeTab === 'constructors' ? (
                                                <>
                                                    {showFinancials && (
                                                        <td className="p-1 px-2 text-right font-bold text-slate-600 italic mono">
                                                            {order.price.toLocaleString()}
                                                        </td>
                                                    )}
                                                    {canSeeConstructorPay && (
                                                        <td className="p-1 px-2 text-right font-black text-blue-600 italic text-lg mono">
                                                            {bonus.toLocaleString()}
                                                        </td>
                                                    )}
                                                </>
                                            ) : (
                                                <>
                                                    {showFinancials && (
                                                        <td className="p-1 px-2 text-right font-bold text-amber-600 italic mono">
                                                            {order.price.toLocaleString()} ₴
                                                        </td>
                                                    )}
                                                    <td className="p-1 px-2 text-right font-black text-blue-600 italic text-lg mono">
                                                        {(order.manager_bonus || 0).toLocaleString()} ₴
                                                    </td>
                                                </>
                                            )}

                                            {(() => {
                                                const unpaidFines = deductions
                                                    .filter(d => d.order_id === order.id && !d.is_paid)
                                                    .reduce((sum, d) => sum + d.amount, 0);

                                                const adjustedDebt = order.is_critical_debt ? order.current_debt : order.remainder_amount;
                                                const isPaidStage1 = !!order.date_advance_paid || (order.date_to_work && order.advance_remaining <= 0.01);
                                                const isPaidStage2 = !!order.date_final_paid || (order.date_installation && order.final_remaining <= 0.01);

                                                return (
                                                    <>
                                                        {activeTab === 'constructors' ? (
                                                            <>
                                                                {canSeeStage1 && (
                                                                    <td className="p-1 px-2 text-center bg-slate-50/20">
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
                                                                                <div className="text-[10px] font-bold text-red-600 uppercase">БОРГ</div>
                                                                            ) : (
                                                                                <span className="text-[9px] font-bold text-slate-400 border border-slate-200 px-2 py-0.5 rounded-md uppercase">ОЧІКУЄ</span>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                )}

                                                                {canSeeStage2 && (
                                                                    <td className="p-1 px-2 text-center bg-emerald-50/20">
                                                                        <div className="flex flex-col items-center">
                                                                            <span className="text-[10px] font-bold text-slate-400 uppercase mb-1">Монтаж: {formatDate(order.date_installation)}</span>
                                                                            <span className={`text-sm font-black italic mono mb-1 ${isPaidStage2 ? 'text-green-600 underline decoration-2' : 'text-slate-300'}`}>
                                                                                {finalAmount.toLocaleString()} ₴
                                                                            </span>
                                                                            {isPaidStage2 ? (
                                                                                <span className="text-[9px] font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-md uppercase">
                                                                                    {order.date_final_paid ? `Оплата: ${formatDate(order.date_final_paid).slice(0, 5)}` : 'ПОГАШЕНО'}
                                                                                </span>
                                                                            ) : order.date_installation ? (
                                                                                <div className="text-[10px] font-bold text-red-600 uppercase">БОРГ</div>
                                                                            ) : (
                                                                                <span className="text-[9px] font-bold text-slate-400 border border-slate-200 px-2 py-0.5 rounded-md uppercase">ОЧІКУЄ</span>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <td className="p-1 px-2 text-center bg-emerald-50/10">
                                                                <div className="flex flex-col items-center">
                                                                    <span className="text-[10px] font-bold text-slate-500 uppercase mb-1">Статус виплат менеджера</span>
                                                                    <span className={`text-sm font-black italic mono mb-1 ${order.date_manager_paid ? 'text-green-600 underline decoration-2' : 'text-slate-400'}`}>
                                                                        {(order.manager_paid_amount || 0).toLocaleString()} / {(order.manager_bonus || 0).toLocaleString()} ₴
                                                                    </span>
                                                                    {order.date_manager_paid ? (
                                                                        <span className="text-[9px] font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-md uppercase">Виплачено {formatDate(order.date_manager_paid)}</span>
                                                                    ) : (order.manager_paid_amount || 0) > 0 ? (
                                                                        <span className="text-[9px] font-bold text-orange-400 uppercase">Частково</span>
                                                                    ) : (
                                                                        <span className="text-[10px] font-bold text-slate-300 uppercase">Очікує</span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        )}

                                                        {showFinancials && (
                                                            <td className="p-1 px-2 text-center bg-orange-50/20">
                                                                {unpaidFines > 0 ? (
                                                                    <span className="text-sm font-black italic text-orange-600">-{unpaidFines.toLocaleString()} ₴</span>
                                                                ) : (
                                                                    <span className="text-xs text-slate-400">—</span>
                                                                )}
                                                            </td>
                                                        )}

                                                        {canSeeDebt && (
                                                            <td className={`p-4 pr-6 text-right font-black text-lg italic mono ${order.is_critical_debt ? 'text-red-500' : 'text-slate-300'}`}>
                                                                {adjustedDebt.toLocaleString(undefined, { minimumFractionDigits: 2 })} ₴
                                                            </td>
                                                        )}
                                                    </>
                                                );
                                            })()}
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>

                    {/* Mobile Card View (simplified for constructors only for now) */}
                    <div className="md:hidden divide-y divide-white/20">
                        {filteredOrders.map((order) => {
                            const bonus = order.bonus;
                            const stageAmount = bonus / 2;
                            const isPaidStage1 = !!order.date_advance_paid || (order.date_to_work && order.advance_remaining <= 0.01);
                            const isPaidStage2 = !!order.date_final_paid || (order.date_installation && order.final_remaining <= 0.01);
                            const unpaidFines = deductions
                                .filter(d => d.order_id === order.id && !d.is_paid)
                                .reduce((sum, d) => sum + d.amount, 0);
                            const adjustedDebt = order.is_critical_debt
                                ? order.current_debt
                                : order.remainder_amount;

                            return (
                                <div key={order.id} className="p-4 hover:bg-white/20 transition cursor-pointer bg-white/10 backdrop-blur-md mb-2 rounded-xl border border-white/20" onClick={() => onSelectOrder(order)}>
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex-1">
                                            <div className="text-slate-400 text-xs font-bold">#{order.id}</div>
                                            <div className="font-bold text-slate-800 text-sm">{order.name}</div>
                                            <div className="text-[10px] font-bold mt-1">
                                                {activeTab === 'constructors' ? (
                                                    <span className="text-blue-600 italic">👨‍🔧 {constructors.find(c => c.id === order.constructor_id)?.full_name || 'Не призначено'}</span>
                                                ) : (
                                                    <span className="text-indigo-600 italic">👤 {managers.find(m => m.id === order.manager_id)?.full_name || 'Не призначено'}</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-black text-slate-800 text-base">{order.price.toLocaleString()} ₴</div>
                                        </div>
                                    </div>
                                    <div className={`text-sm font-black text-right ${order.is_critical_debt ? 'text-red-500' : 'text-slate-300'}`}>
                                        Борг: {Math.max(0, adjustedDebt).toLocaleString()} ₴
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {viewLayout !== 'calendar' && viewLayout !== 'gantt' && filteredOrders.length === 0 && (
                <div className="text-center py-20">
                    <div className="inline-block p-6 rounded-full bg-slate-50 mb-4">
                        <span className="text-4xl">📭</span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-400">Немає замовлень</h3>
                    <p className="text-slate-300">Спробуйте змінити фільтри або пошук</p>
                </div>
            )}
        </div>
    );
};

export default OrderList;
