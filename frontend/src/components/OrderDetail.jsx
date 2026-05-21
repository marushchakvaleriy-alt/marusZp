import React, { useState, useEffect, useMemo } from 'react';
import { updateOrder, deleteOrder, getDeductions, createDeduction, deleteDeduction, getUsers, getOrderCalculationHistory } from '../api';
import FileManager from './FileManager';
import UKDatePicker from './UKDatePicker';
import { useAuth } from '../context/AuthContext';

const DAY_MS = 24 * 60 * 60 * 1000;

const planningDefaultsFromOrder = (order) => ({
    date_received: order.date_received || '',
    date_manager_handover: order.date_manager_handover || '',
    date_to_work: order.date_to_work || '',
    date_design_deadline: order.date_design_deadline || '',
    date_installation_plan: order.date_installation_plan || '',
    date_installation: order.date_installation || '',
    constructive_days: order.constructive_days || 5,
    complectation_days: order.complectation_days || 2,
    preassembly_days: order.preassembly_days || 1,
    installation_days: order.installation_days || 3,
    constructive_start_date: order.constructive_start_date || '',
    constructive_end_date: order.constructive_end_date || '',
    complectation_start_date: order.complectation_start_date || '',
    complectation_end_date: order.complectation_end_date || '',
    preassembly_start_date: order.preassembly_start_date || '',
    preassembly_end_date: order.preassembly_end_date || '',
    installation_start_date: order.installation_start_date || '',
    installation_end_date: order.installation_end_date || '',
});

const parsePlanningDate = (value) => {
    if (!value) return null;
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
};

const addPlanningDays = (date, days) => new Date(date.getTime() + days * DAY_MS);

const clampPlanningDays = (value, fallback) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(1, Math.min(60, Math.round(parsed)));
};

const formatPlanningDate = (date) => (
    date
        ? date.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: '2-digit' })
        : '--.--.--'
);

const toInputDateValue = (date) => {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const buildPlanningStages = (planningData) => {
    const dateReceived = parsePlanningDate(planningData.date_received);
    const dateToWork = parsePlanningDate(planningData.date_to_work);
    const dateInstallPlan = parsePlanningDate(planningData.date_installation_plan);

    const durations = {
        constructive: clampPlanningDays(planningData.constructive_days, 5),
        complectation: clampPlanningDays(planningData.complectation_days, 2),
        preassembly: clampPlanningDays(planningData.preassembly_days, 1),
        installation: clampPlanningDays(planningData.installation_days, 3),
    };

    let constructiveStart = null;
    let constructiveEnd = null;
    let complectationStart = null;
    let complectationEnd = null;
    let preassemblyStart = null;
    let preassemblyEnd = null;
    let installationStart = null;
    let installationEnd = null;
    let calculationMode = 'forward';

    if (dateInstallPlan) {
        calculationMode = 'backward';
        installationStart = dateInstallPlan;
        installationEnd = addPlanningDays(installationStart, durations.installation - 1);
        preassemblyEnd = addPlanningDays(installationStart, -1);
        preassemblyStart = addPlanningDays(preassemblyEnd, -(durations.preassembly - 1));
        complectationEnd = addPlanningDays(preassemblyStart, -1);
        complectationStart = addPlanningDays(complectationEnd, -(durations.complectation - 1));
        constructiveEnd = addPlanningDays(complectationStart, -1);
        constructiveStart = addPlanningDays(constructiveEnd, -(durations.constructive - 1));
    } else if (dateToWork || dateReceived) {
        const baseStart = dateToWork || dateReceived;
        constructiveStart = baseStart;
        constructiveEnd = addPlanningDays(constructiveStart, durations.constructive - 1);
        complectationStart = addPlanningDays(constructiveEnd, 1);
        complectationEnd = addPlanningDays(complectationStart, durations.complectation - 1);
        preassemblyStart = addPlanningDays(complectationEnd, 1);
        preassemblyEnd = addPlanningDays(preassemblyStart, durations.preassembly - 1);
        installationStart = addPlanningDays(preassemblyEnd, 1);
        installationEnd = addPlanningDays(installationStart, durations.installation - 1);
    }

    const stageOverrides = {
        constructive: {
            start: parsePlanningDate(planningData.constructive_start_date),
            end: parsePlanningDate(planningData.constructive_end_date),
        },
        complectation: {
            start: parsePlanningDate(planningData.complectation_start_date),
            end: parsePlanningDate(planningData.complectation_end_date),
        },
        preassembly: {
            start: parsePlanningDate(planningData.preassembly_start_date),
            end: parsePlanningDate(planningData.preassembly_end_date),
        },
        installation: {
            start: parsePlanningDate(planningData.installation_start_date),
            end: parsePlanningDate(planningData.installation_end_date),
        },
    };

    const resolveStageRange = (fallbackStart, fallbackEnd, manualStart, manualEnd, duration) => {
        if (manualStart && manualEnd) {
            const normalizedStart = manualStart <= manualEnd ? manualStart : manualEnd;
            const normalizedEnd = manualStart <= manualEnd ? manualEnd : manualStart;
            return {
                start: normalizedStart,
                end: normalizedEnd,
                duration: Math.max(1, Math.round((normalizedEnd.getTime() - normalizedStart.getTime()) / DAY_MS) + 1),
                lockedByDates: true,
            };
        }
        if (manualStart) {
            return {
                start: manualStart,
                end: addPlanningDays(manualStart, duration - 1),
                duration,
                lockedByDates: false,
            };
        }
        if (manualEnd) {
            return {
                start: addPlanningDays(manualEnd, -(duration - 1)),
                end: manualEnd,
                duration,
                lockedByDates: false,
            };
        }
        return {
            start: fallbackStart,
            end: fallbackEnd,
            duration,
            lockedByDates: false,
        };
    };

    const constructiveRange = resolveStageRange(
        constructiveStart,
        constructiveEnd,
        stageOverrides.constructive.start,
        stageOverrides.constructive.end,
        durations.constructive
    );
    const complectationRange = resolveStageRange(
        complectationStart,
        complectationEnd,
        stageOverrides.complectation.start,
        stageOverrides.complectation.end,
        durations.complectation
    );
    const preassemblyRange = resolveStageRange(
        preassemblyStart,
        preassemblyEnd,
        stageOverrides.preassembly.start,
        stageOverrides.preassembly.end,
        durations.preassembly
    );
    const installationRange = resolveStageRange(
        installationStart,
        installationEnd,
        stageOverrides.installation.start,
        stageOverrides.installation.end,
        durations.installation
    );

    return {
        calculationMode,
        stages: [
            {
                key: 'constructive',
                title: 'Конструктив',
                accent: 'bg-sky-500',
                ring: 'ring-sky-100',
                durationField: 'constructive_days',
                startField: 'constructive_start_date',
                endField: 'constructive_end_date',
                duration: constructiveRange.duration,
                start: constructiveRange.start,
                end: constructiveRange.end,
                lockedByDates: constructiveRange.lockedByDates,
            },
            {
                key: 'complectation',
                title: 'Комплектація',
                accent: 'bg-amber-400',
                ring: 'ring-amber-100',
                durationField: 'complectation_days',
                startField: 'complectation_start_date',
                endField: 'complectation_end_date',
                duration: complectationRange.duration,
                start: complectationRange.start,
                end: complectationRange.end,
                lockedByDates: complectationRange.lockedByDates,
            },
            {
                key: 'preassembly',
                title: 'Предзбірка',
                accent: 'bg-violet-500',
                ring: 'ring-violet-100',
                durationField: 'preassembly_days',
                startField: 'preassembly_start_date',
                endField: 'preassembly_end_date',
                duration: preassemblyRange.duration,
                start: preassemblyRange.start,
                end: preassemblyRange.end,
                lockedByDates: preassemblyRange.lockedByDates,
            },
            {
                key: 'installation',
                title: 'Монтаж',
                accent: 'bg-emerald-500',
                ring: 'ring-emerald-100',
                durationField: 'installation_days',
                startField: 'installation_start_date',
                endField: 'installation_end_date',
                duration: installationRange.duration,
                start: installationRange.start,
                end: installationRange.end,
                lockedByDates: installationRange.lockedByDates,
            },
        ],
    };
};

const EditableDate = ({ value, onSave, className, emptyText = "--.--.--" }) => (
    <UKDatePicker
        selected={value}
        onChange={(val) => onSave(val || null)}
        placeholder={emptyText}
        className={`px-2 py-1 border border-transparent rounded shadow-sm outline-none text-sm hover:border-black/10 hover:bg-black/5 transition inline-flex items-center ${className}`}
    />
);

const OrderDetail = ({ order, onBack, onUpdate }) => {
    const { user } = useAuth(); // To check role
    const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
    const isManager = user?.role === 'manager';
    const isManagerView = isManager && !isAdmin;
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
        if (!canManage) return;
        getUsers().then(users => {
            setConstructors(users.filter(u => u.role === 'constructor' || u.role === 'admin' || u.role === 'super_admin'));
            setManagers(users.filter(u => u.role === 'manager' || u.role === 'admin' || u.role === 'super_admin'));
        }).catch(console.error);
    }, [canManage]);
    const [customType, setCustomType] = useState('');

    // Deductions state
    const [deductions, setDeductions] = useState([]);
    const [calculationHistory, setCalculationHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [activeDetailTab, setActiveDetailTab] = useState('history');
    const [historyScope, setHistoryScope] = useState(isManagerView ? 'manager' : 'constructor');
    const [planningData, setPlanningData] = useState(() => planningDefaultsFromOrder(order));
    const [planningSaving, setPlanningSaving] = useState(false);
    const [planningMessage, setPlanningMessage] = useState('');
    const [showDeductionModal, setShowDeductionModal] = useState(false);
    const [deductionForm, setDeductionForm] = useState({
        amount: '',
        description: '',
        target_role: 'constructor',
        date_created: new Date().toISOString().split('T')[0]
    });

    useEffect(() => {
        loadDeductions();
        if (isManagerView) {
            setCalculationHistory([]);
            setHistoryLoading(false);
        } else {
            loadCalculationHistory();
        }
    }, [
        order.id,
        order.advance_paid_amount,
        order.final_paid_amount,
        order.date_to_work,
        order.date_installation,
        order.date_advance_paid,
        order.date_final_paid,
        order.fixed_bonus,
        order.price,
        isManagerView
    ]);

    useEffect(() => {
        setPlanningData(planningDefaultsFromOrder(order));
        setPlanningMessage('');
    }, [order]);

    useEffect(() => {
        setHistoryScope(isManagerView ? 'manager' : 'constructor');
    }, [order.id, isManagerView]);

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
            setPlanningData(prev => (
                Object.prototype.hasOwnProperty.call(prev, field)
                    ? {
                        ...prev,
                        [field]: value || ''
                    }
                    : prev
            ));
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error('Failed to update order:', error);
            alert('Помилка при збереженні дати');
        }
    };

    const planningPreview = useMemo(() => buildPlanningStages(planningData), [planningData]);

    const planningDirty = useMemo(() => {
        const source = planningDefaultsFromOrder(order);
        return Object.keys(source).some((key) => String(source[key] ?? '') !== String(planningData[key] ?? ''));
    }, [order, planningData]);

    const updatePlanningField = (field, value) => {
        setPlanningData(prev => ({
            ...prev,
            [field]: value
        }));
        setPlanningMessage('');
    };

    const handleSavePlanning = async () => {
        try {
            setPlanningSaving(true);
            const nextPlanningData = {
                date_received: planningData.date_received || '',
                date_manager_handover: planningData.date_manager_handover || '',
                date_to_work: planningData.date_to_work || '',
                date_design_deadline: planningData.date_design_deadline || '',
                date_installation_plan: planningData.date_installation_plan || '',
                date_installation: planningData.date_installation || '',
                constructive_days: clampPlanningDays(planningData.constructive_days, 5),
                complectation_days: clampPlanningDays(planningData.complectation_days, 2),
                preassembly_days: clampPlanningDays(planningData.preassembly_days, 1),
                installation_days: clampPlanningDays(planningData.installation_days, 3),
                constructive_start_date: planningData.constructive_start_date || '',
                constructive_end_date: planningData.constructive_end_date || '',
                complectation_start_date: planningData.complectation_start_date || '',
                complectation_end_date: planningData.complectation_end_date || '',
                preassembly_start_date: planningData.preassembly_start_date || '',
                preassembly_end_date: planningData.preassembly_end_date || '',
                installation_start_date: planningData.installation_start_date || '',
                installation_end_date: planningData.installation_end_date || '',
            };
            const normalizedPlanning = buildPlanningStages(nextPlanningData);
            normalizedPlanning.stages.forEach((stage) => {
                nextPlanningData[stage.durationField] = stage.duration;
            });
            await updateOrder(order.id, {
                date_received: nextPlanningData.date_received || null,
                date_manager_handover: nextPlanningData.date_manager_handover || null,
                date_to_work: nextPlanningData.date_to_work || null,
                date_design_deadline: nextPlanningData.date_design_deadline || null,
                date_installation_plan: nextPlanningData.date_installation_plan || null,
                date_installation: nextPlanningData.date_installation || null,
                constructive_days: nextPlanningData.constructive_days,
                complectation_days: nextPlanningData.complectation_days,
                preassembly_days: nextPlanningData.preassembly_days,
                installation_days: nextPlanningData.installation_days,
                constructive_start_date: nextPlanningData.constructive_start_date || null,
                constructive_end_date: nextPlanningData.constructive_end_date || null,
                complectation_start_date: nextPlanningData.complectation_start_date || null,
                complectation_end_date: nextPlanningData.complectation_end_date || null,
                preassembly_start_date: nextPlanningData.preassembly_start_date || null,
                preassembly_end_date: nextPlanningData.preassembly_end_date || null,
                installation_start_date: nextPlanningData.installation_start_date || null,
                installation_end_date: nextPlanningData.installation_end_date || null,
            });
            await loadCalculationHistory();
            setPlanningData(nextPlanningData);
            setPlanningMessage('Планування збережено');
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error('Failed to save planning:', error);
            alert('Помилка при збереженні планування');
        } finally {
            setPlanningSaving(false);
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
                target_role: deductionForm.target_role || 'constructor',
                date_created: deductionForm.date_created
            });
            setShowDeductionModal(false);
            setDeductionForm({
                amount: '',
                description: '',
                target_role: 'constructor',
                date_created: new Date().toISOString().split('T')[0]
            });
            await Promise.all([loadDeductions(), loadCalculationHistory()]);
            if (onUpdate) onUpdate();
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
                if (onUpdate) onUpdate();
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
    const constructorTotalBonus = order.bonus || 0;
    const constructorStage1Amount = order.advance_amount || 0;
    const constructorStage2Amount = order.final_amount || 0;
    const constructorPaidStage1 = order.advance_paid_amount || 0;
    const constructorPaidStage2 = order.final_paid_amount || 0;
    const constructorStage1Active = !!order.date_to_work;
    const constructorStage2Active = !!order.date_installation;
    const constructorStage1Percent = constructorTotalBonus > 0
        ? Math.round((constructorStage1Amount / constructorTotalBonus) * 100)
        : 50;
    const constructorStage2Percent = constructorTotalBonus > 0
        ? Math.round((constructorStage2Amount / constructorTotalBonus) * 100)
        : 50;
    const constructorAccruedAmount =
        (constructorStage1Active ? constructorStage1Amount : 0) +
        (constructorStage2Active ? constructorStage2Amount : 0);
    const constructorPaidActiveAmount =
        (constructorStage1Active ? constructorPaidStage1 : 0) +
        (constructorStage2Active ? constructorPaidStage2 : 0);
    const constructorPaidTotalAmount = constructorPaidStage1 + constructorPaidStage2;
    const constructorRemainingAmount = Math.max(0, constructorAccruedAmount - constructorPaidActiveAmount);
    const constructorPaymentStatus = constructorAccruedAmount <= 0.01
        ? 'Ще не нараховано'
        : constructorRemainingAmount <= 0.01
            ? (constructorTotalBonus > constructorAccruedAmount + 0.01 ? 'Етап 1 закрито' : 'Виплачено')
            : constructorPaidActiveAmount > 0
                ? 'Частково виплачено'
                : 'Очікується';
    const assignedConstructor = constructors.find((c) => c.id === order.constructor_id);
    const assignedConstructorName = assignedConstructor
        ? (assignedConstructor.full_name || assignedConstructor.username)
        : (order.constructor_id ? `ID ${order.constructor_id}` : 'Не призначено');
    const constructorActivationHint = !constructorStage1Active
        ? 'Етап 1 ще не активовано: вкажіть дату "Передано в роботу".'
        : !constructorStage2Active
            ? 'Етап 1 активний. Етап 2 відкриється після дати монтажу.'
            : 'Обидва етапи конструктора активовані.';

    const managerAccruedAmount = order.manager_bonus || 0;
    const managerTotalBonus = order.manager_total_bonus || 0;
    const managerPaidActiveAmount = order.manager_paid_active_amount || 0;
    const managerPaidRecordedAmount = order.manager_paid_amount || 0;
    const managerRemainingAmount = order.manager_remaining || 0;
    const managerStage1Percent = Math.round(order.manager_stage1_percent || 0);
    const managerStage2Percent = Math.round(order.manager_stage2_percent || 0);
    const managerStage1Active = !!order.date_manager_handover;
    const managerStage2Active = !!order.date_installation;
    const assignedManager = managers.find((m) => m.id === order.manager_id);
    const assignedManagerName = assignedManager
        ? (assignedManager.full_name || assignedManager.username)
        : (order.manager_id ? `ID ${order.manager_id}` : 'Не призначено');
    const managerActivationHint = !managerStage1Active
        ? 'Етап 1 ще не активовано: вкажіть дату "Передано конструктору".'
        : !managerStage2Active
            ? 'Етап 1 активний. Етап 2 відкриється після дати монтажу.'
            : 'Обидва етапи менеджера активовані.';
    const managerStage1Paid = managerStage1Active
        ? Math.min(order.manager_stage1_amount || 0, managerPaidActiveAmount)
        : 0;
    const managerStage2Paid = managerStage2Active
        ? Math.max(0, Math.min(order.manager_stage2_amount || 0, managerPaidActiveAmount - managerStage1Paid))
        : 0;
    const managerStage1Remaining = Math.max(0, (order.manager_stage1_amount || 0) - managerStage1Paid);
    const managerStage2Remaining = Math.max(0, (order.manager_stage2_amount || 0) - managerStage2Paid);
    const constructorStage1Remaining = Math.max(0, constructorStage1Amount - constructorPaidStage1);
    const constructorStage2Remaining = Math.max(0, constructorStage2Amount - constructorPaidStage2);

    const managerPaymentStatus = managerAccruedAmount <= 0.01
        ? 'Ще не нараховано'
        : managerRemainingAmount <= 0.01
            ? (managerTotalBonus > managerAccruedAmount + 0.01 ? 'Етап 1 закрито' : 'Виплачено')
            : managerPaidActiveAmount > 0
                ? 'Частково виплачено'
                : 'Очікується';

    const managerHistoryItems = useMemo(() => {
        if (!(isManagerView || isAdmin)) return [];

        const items = [];

        if (order.date_manager_handover && (order.manager_stage1_amount || 0) > 0) {
            items.push({
                key: 'manager_stage1_bonus',
                date: order.date_manager_handover,
                badge: `Етап 1 (${Math.round(order.manager_stage1_percent || 0)}%)`,
                badgeClass: 'bg-blue-100 text-blue-700',
                amountClass: 'text-blue-600',
                title: 'Активовано першу частину заробітку менеджера',
                description: 'Після передачі замовлення конструктору вам відкрилась перша частина менеджерського заробітку.',
                amount: order.manager_stage1_amount || 0,
            });
        }

        if (order.date_installation && (order.manager_stage2_amount || 0) > 0) {
            items.push({
                key: 'manager_stage2_bonus',
                date: order.date_installation,
                badge: `Етап 2 (${Math.round(order.manager_stage2_percent || 0)}%)`,
                badgeClass: 'bg-violet-100 text-violet-700',
                amountClass: 'text-violet-600',
                title: 'Активовано другу частину заробітку менеджера',
                description: 'Після завершення монтажу вам відкрилась друга частина менеджерського заробітку.',
                amount: order.manager_stage2_amount || 0,
            });
        }

        if (managerPaidActiveAmount > 0 || order.date_manager_paid) {
            items.push({
                key: 'manager_paid',
                date: order.date_manager_paid || order.date_installation || order.date_manager_handover || order.date_received,
                badge: 'Виплата',
                badgeClass: 'bg-emerald-100 text-emerald-700',
                amountClass: 'text-emerald-600',
                title: managerRemainingAmount <= 0.01 ? 'Активні етапи менеджера закрито' : 'Зафіксовано виплату менеджеру',
                description: managerRemainingAmount <= 0.01
                    ? 'По всіх уже активованих етапах виплата менеджеру зараз закрита.'
                    : 'По цьому замовленню вже є виплата менеджеру, але поточний активний залишок ще не закритий.',
                amount: managerPaidActiveAmount,
            });
        } else if (managerAccruedAmount > 0.01) {
            items.push({
                key: 'manager_waiting',
                date: order.date_manager_handover || order.date_installation || order.date_received,
                badge: 'Статус',
                badgeClass: 'bg-slate-100 text-slate-700',
                amountClass: 'text-slate-500',
                title: 'Виплата менеджеру очікується',
                description: 'На цей момент по активних етапах виплата менеджеру ще не закрита.',
                amount: managerRemainingAmount,
            });
        } else {
            items.push({
                key: 'manager_not_accrued_yet',
                date: order.date_received,
                badge: 'Статус',
                badgeClass: 'bg-slate-100 text-slate-700',
                amountClass: 'text-slate-500',
                title: 'Менеджерський заробіток ще не активовано',
                description: 'Поки не активовано жодного етапу, менеджеру ще нічого не нараховано по цьому замовленню.',
                amount: 0,
            });
        }

        return items;
    }, [
        isAdmin,
        isManagerView,
        managerAccruedAmount,
        managerPaidActiveAmount,
        managerRemainingAmount,
        order.date_manager_handover,
        order.date_installation,
        order.date_manager_paid,
        order.date_received,
        order.manager_stage1_amount,
        order.manager_stage1_percent,
        order.manager_stage2_amount,
        order.manager_stage2_percent,
    ]);

    const showManagerHistory = historyScope === 'manager';

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
                                {!isManagerView && order.material_cost > 0 && (
                                    <div>
                                        <p className="text-[10px] text-green-400 font-bold uppercase">Матеріали:</p>
                                        <p className="text-xl font-black text-green-400">{order.material_cost.toLocaleString()} ₴</p>
                                    </div>
                                )}
                                {!isManagerView && order.fixed_bonus > 0 && (
                                    <div>
                                        <p className="text-[10px] text-amber-500 font-bold uppercase">Фіксована ЗП:</p>
                                        <p className="text-xl font-black text-amber-600">{order.fixed_bonus.toLocaleString()} ₴</p>
                                    </div>
                                )}
                                {isManagerView ? (
                                    <>
                                        <div>
                                            <p className="text-[10px] text-emerald-300 font-bold uppercase">Виплачено по активних етапах:</p>
                                            <p className="text-2xl font-black text-emerald-300">{managerPaidActiveAmount.toLocaleString()} ₴</p>
                                        </div>
                                        <div className="border-l border-slate-700 pl-6">
                                            <p className="text-[10px] text-amber-400 font-bold uppercase">Нараховано зараз:</p>
                                            <p className="text-2xl font-black text-amber-500">{managerAccruedAmount.toLocaleString()} ₴</p>
                                            {managerTotalBonus > managerAccruedAmount + 0.01 && (
                                                <p className="mt-1 text-[10px] font-bold uppercase text-slate-400">
                                                    Повна сума після всіх етапів: {formatMoney(managerTotalBonus)}
                                                </p>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div>
                                            <p className="text-[10px] text-blue-400 font-bold uppercase">Загальний ПГ:</p>
                                            <p className="text-2xl font-black">{order.bonus.toLocaleString()} ₴</p>
                                        </div>
                                        {(order.manager_total_bonus || order.manager_bonus) > 0 && (
                                            <div className="border-l border-slate-700 pl-6">
                                                <p className="text-[10px] text-amber-400 font-bold uppercase">Менеджерська премія:</p>
                                                <p className="text-2xl font-black text-amber-500">{(order.manager_total_bonus || order.manager_bonus).toLocaleString()} ₴</p>
                                            </div>
                                        )}
                                    </>
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
                    {isManagerView ? (
                        <>
                            <div className="bg-white p-6 rounded-3xl border border-amber-200 bg-amber-50/30">
                                <h4 className="text-xs font-bold text-amber-700 uppercase mb-4 italic underline">Мій заробіток по замовленню</h4>
                                <div className="space-y-3 text-sm italic">
                                    <div className="flex justify-between"><span>Нараховано зараз:</span><span className="mono font-bold text-amber-700">{formatMoney(managerAccruedAmount)}</span></div>
                                    <div className="flex justify-between"><span>Повна сума по замовленню:</span><span className="mono font-bold text-slate-600">{formatMoney(managerTotalBonus)}</span></div>
                                    <div className="flex justify-between"><span>Виплачено по активних етапах:</span><span className="mono font-bold text-emerald-700">{formatMoney(managerPaidActiveAmount)}</span></div>
                                    <div className="flex justify-between"><span>Поточний залишок:</span><span className="mono font-bold text-slate-700">{formatMoney(managerRemainingAmount)}</span></div>
                                </div>
                            </div>

                            <div className={`bg-white p-6 rounded-3xl border ${managerRemainingAmount <= 0.01 && managerAccruedAmount > 0.01 ? 'border-green-200 bg-green-50/40' : 'border-slate-200'}`}>
                                <h4 className={`text-xs font-bold uppercase mb-4 italic underline ${managerRemainingAmount <= 0.01 && managerAccruedAmount > 0.01 ? 'text-green-600' : 'text-slate-600'}`}>Статус виплати менеджеру</h4>
                                <div className="space-y-3 text-sm italic">
                                    <div className="flex justify-between"><span>Умови виплати:</span><span className="font-bold">{Math.round(order.manager_stage1_percent || 0)} / {Math.round(order.manager_stage2_percent || 0)}</span></div>
                                    <div className="flex justify-between"><span>Етап 1:</span><span className="font-bold">{formatMoney(order.manager_stage1_amount)}</span></div>
                                    <div className="flex justify-between"><span>Етап 2:</span><span className="font-bold">{formatMoney(order.manager_stage2_amount)}</span></div>
                                    <div className="flex justify-between"><span>Дата виплати:</span><span className="font-bold">{formatDate(order.date_manager_paid)}</span></div>
                                    <div className="flex justify-between"><span>Статус:</span><span className={`font-bold ${managerRemainingAmount <= 0.01 && managerAccruedAmount > 0.01 ? 'text-green-600' : managerPaidActiveAmount > 0 ? 'text-amber-600' : 'text-slate-500'}`}>{managerPaymentStatus}</span></div>
                                    <div className="flex justify-between"><span>Призначений менеджер:</span><span className="font-bold">{user?.full_name || user?.username}</span></div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className={`col-span-1 md:col-span-2 bg-gradient-to-br from-sky-50 to-blue-50 p-6 rounded-3xl border ${constructorRemainingAmount > 0.01 ? 'border-sky-200' : 'border-green-200 bg-green-50/50'}`}>
                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                                    <h4 className="text-xs font-bold text-sky-700 uppercase italic underline">Оплата конструктора</h4>
                                    <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                                        <span className="px-3 py-1 rounded-full bg-white/90 border border-sky-200 text-sky-800">
                                            Конструктор: {assignedConstructorName}
                                        </span>
                                        <span className={`px-3 py-1 rounded-full border ${constructorRemainingAmount <= 0.01 && constructorAccruedAmount > 0.01
                                            ? 'bg-green-50 border-green-200 text-green-700'
                                            : constructorAccruedAmount > 0.01
                                                ? 'bg-sky-50 border-sky-200 text-sky-700'
                                                : 'bg-slate-50 border-slate-200 text-slate-600'
                                            }`}>
                                            {constructorPaymentStatus}
                                        </span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                                    <div className="bg-white/90 rounded-2xl border border-sky-100 p-3">
                                        <div className="text-[10px] uppercase font-bold text-slate-400">Повний ПГ</div>
                                        <div className="text-xl font-black text-sky-700">{formatMoney(constructorTotalBonus)}</div>
                                    </div>
                                    <div className="bg-white/90 rounded-2xl border border-sky-100 p-3">
                                        <div className="text-[10px] uppercase font-bold text-slate-400">Нараховано зараз</div>
                                        <div className="text-xl font-black text-sky-800">{formatMoney(constructorAccruedAmount)}</div>
                                    </div>
                                    <div className="bg-white/90 rounded-2xl border border-emerald-100 p-3">
                                        <div className="text-[10px] uppercase font-bold text-slate-400">Виплачено (активні етапи)</div>
                                        <div className="text-xl font-black text-emerald-700">{formatMoney(constructorPaidActiveAmount)}</div>
                                    </div>
                                    <div className="bg-white/90 rounded-2xl border border-sky-100 p-3">
                                        <div className="text-[10px] uppercase font-bold text-slate-400">Поточний залишок</div>
                                        <div className={`text-xl font-black ${constructorRemainingAmount > 0.01 ? 'text-sky-700' : 'text-green-700'}`}>
                                            {formatMoney(constructorRemainingAmount)}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 text-sm">
                                    <div className={`rounded-2xl border p-4 ${constructorStage1Active ? 'border-blue-200 bg-blue-50/50' : 'border-slate-200 bg-white/80'}`}>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="font-black text-blue-700 uppercase text-xs">Етап 1 ({constructorStage1Percent}%)</span>
                                            <span className={`text-[10px] font-bold uppercase ${constructorStage1Active ? 'text-blue-600' : 'text-slate-400'}`}>
                                                {constructorStage1Active ? 'Активний' : 'Очікує'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-slate-600">
                                            <span>Тригер:</span>
                                            <span className="font-bold">Передано в роботу</span>
                                        </div>
                                        <div className="flex items-center justify-between text-slate-600">
                                            <span>Дата старту:</span>
                                            <EditableDate
                                                value={order.date_to_work}
                                                onSave={(val) => handleQuickUpdate('date_to_work', val)}
                                                className="font-bold"
                                            />
                                        </div>
                                        <div className="flex items-center justify-between text-slate-700 mt-1">
                                            <span>Дата оплати:</span>
                                            <EditableDate
                                                value={order.date_advance_paid}
                                                onSave={(val) => handleQuickUpdate('date_advance_paid', val)}
                                                emptyText="Очікується"
                                                className="text-emerald-700 font-bold"
                                            />
                                        </div>
                                        <div className="flex justify-between text-slate-700 mt-1">
                                            <span>Сума етапу:</span>
                                            <span className="font-black">{formatMoney(constructorStage1Amount)}</span>
                                        </div>
                                    </div>

                                    <div className={`rounded-2xl border p-4 ${constructorStage2Active ? 'border-violet-200 bg-violet-50/50' : 'border-slate-200 bg-white/80'}`}>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="font-black text-violet-700 uppercase text-xs">Етап 2 ({constructorStage2Percent}%)</span>
                                            <span className={`text-[10px] font-bold uppercase ${constructorStage2Active ? 'text-violet-600' : 'text-slate-400'}`}>
                                                {constructorStage2Active ? 'Активний' : 'Очікує'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-slate-600">
                                            <span>Тригер:</span>
                                            <span className="font-bold">Монтаж завершено</span>
                                        </div>
                                        <div className="flex items-center justify-between text-slate-600">
                                            <span>Дата монтажу:</span>
                                            <EditableDate
                                                value={order.date_installation}
                                                onSave={(val) => handleQuickUpdate('date_installation', val)}
                                                className="font-bold"
                                            />
                                        </div>
                                        <div className="flex items-center justify-between text-slate-700 mt-1">
                                            <span>Дата оплати:</span>
                                            <EditableDate
                                                value={order.date_final_paid}
                                                onSave={(val) => handleQuickUpdate('date_final_paid', val)}
                                                emptyText="Очікується"
                                                className="text-emerald-700 font-bold"
                                            />
                                        </div>
                                        <div className="flex justify-between text-slate-700 mt-1">
                                            <span>Сума етапу:</span>
                                            <span className="font-black">{formatMoney(constructorStage2Amount)}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white/90 rounded-2xl border border-sky-100 p-4">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                        <div>
                                            <div className="text-[10px] uppercase font-bold text-slate-400">Виплачено (факт)</div>
                                            <div className="mt-1 mono font-bold text-slate-700">
                                                {formatMoney(constructorPaidTotalAmount)}
                                            </div>
                                            <div className="text-[11px] text-slate-500 mt-1">
                                                Етап 1: {formatMoney(constructorPaidStage1)} • Етап 2: {formatMoney(constructorPaidStage2)}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] uppercase font-bold text-slate-400">Борг / статус</div>
                                            <div className={`mt-1 font-bold ${order.is_critical_debt ? 'text-red-600' : 'text-slate-700'}`}>
                                                {order.is_critical_debt ? 'Є критичний борг по етапу 2' : 'Критичного боргу немає'}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] uppercase font-bold text-slate-400">Логіка</div>
                                            <div className="mt-1 text-xs font-semibold text-slate-600">{constructorActivationHint}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Manager Payment Section */}
                            {isAdmin && order.manager_id && (
                                <div className={`col-span-1 md:col-span-2 bg-gradient-to-br from-amber-50 to-orange-50 p-6 rounded-3xl border ${order.date_manager_paid ? 'border-green-200 bg-green-50/50' : 'border-amber-200'}`}>
                                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                                        <h4 className="text-xs font-bold text-amber-700 uppercase italic underline">Оплата менеджера</h4>
                                        <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                                            <span className="px-3 py-1 rounded-full bg-white/90 border border-amber-200 text-amber-800">
                                                Менеджер: {assignedManagerName}
                                            </span>
                                            <span className={`px-3 py-1 rounded-full border ${managerRemainingAmount <= 0.01 && managerAccruedAmount > 0.01
                                                ? 'bg-green-50 border-green-200 text-green-700'
                                                : managerAccruedAmount > 0.01
                                                    ? 'bg-amber-50 border-amber-200 text-amber-700'
                                                    : 'bg-slate-50 border-slate-200 text-slate-600'
                                                }`}>
                                                {managerPaymentStatus}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                                        <div className="bg-white/90 rounded-2xl border border-amber-100 p-3">
                                            <div className="text-[10px] uppercase font-bold text-slate-400">Повна премія</div>
                                            <div className="text-xl font-black text-amber-700">{formatMoney(managerTotalBonus)}</div>
                                        </div>
                                        <div className="bg-white/90 rounded-2xl border border-amber-100 p-3">
                                            <div className="text-[10px] uppercase font-bold text-slate-400">Нараховано зараз</div>
                                            <div className="text-xl font-black text-amber-800">{formatMoney(managerAccruedAmount)}</div>
                                        </div>
                                        <div className="bg-white/90 rounded-2xl border border-emerald-100 p-3">
                                            <div className="text-[10px] uppercase font-bold text-slate-400">Виплачено (активні етапи)</div>
                                            <div className="text-xl font-black text-emerald-700">{formatMoney(managerPaidActiveAmount)}</div>
                                        </div>
                                        <div className="bg-white/90 rounded-2xl border border-amber-100 p-3">
                                            <div className="text-[10px] uppercase font-bold text-slate-400">Поточний залишок</div>
                                            <div className={`text-xl font-black ${managerRemainingAmount > 0.01 ? 'text-amber-700' : 'text-green-700'}`}>
                                                {formatMoney(managerRemainingAmount)}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 text-sm">
                                        <div className={`rounded-2xl border p-4 ${managerStage1Active ? 'border-blue-200 bg-blue-50/50' : 'border-slate-200 bg-white/80'}`}>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="font-black text-blue-700 uppercase text-xs">Етап 1 ({managerStage1Percent}%)</span>
                                                <span className={`text-[10px] font-bold uppercase ${managerStage1Active ? 'text-blue-600' : 'text-slate-400'}`}>
                                                    {managerStage1Active ? 'Активний' : 'Очікує'}
                                                </span>
                                            </div>
                                            <div className="flex justify-between text-slate-600">
                                                <span>Тригер:</span>
                                                <span className="font-bold">Передано конструктору</span>
                                            </div>
                                            <div className="flex justify-between text-slate-600">
                                                <span>Дата:</span>
                                                <span className="font-bold">{formatDate(order.date_manager_handover)}</span>
                                            </div>
                                            <div className="flex justify-between text-slate-700 mt-1">
                                                <span>Сума етапу:</span>
                                                <span className="font-black">{formatMoney(order.manager_stage1_amount)}</span>
                                            </div>
                                        </div>

                                        <div className={`rounded-2xl border p-4 ${managerStage2Active ? 'border-violet-200 bg-violet-50/50' : 'border-slate-200 bg-white/80'}`}>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="font-black text-violet-700 uppercase text-xs">Етап 2 ({managerStage2Percent}%)</span>
                                                <span className={`text-[10px] font-bold uppercase ${managerStage2Active ? 'text-violet-600' : 'text-slate-400'}`}>
                                                    {managerStage2Active ? 'Активний' : 'Очікує'}
                                                </span>
                                            </div>
                                            <div className="flex justify-between text-slate-600">
                                                <span>Тригер:</span>
                                                <span className="font-bold">Монтаж завершено</span>
                                            </div>
                                            <div className="flex justify-between text-slate-600">
                                                <span>Дата:</span>
                                                <span className="font-bold">{formatDate(order.date_installation)}</span>
                                            </div>
                                            <div className="flex justify-between text-slate-700 mt-1">
                                                <span>Сума етапу:</span>
                                                <span className="font-black">{formatMoney(order.manager_stage2_amount)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-white/90 rounded-2xl border border-amber-100 p-4">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                            <div>
                                                <div className="text-[10px] uppercase font-bold text-slate-400">Виплачено (факт)</div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="mono font-bold text-slate-700">{formatMoney(managerPaidRecordedAmount)}</span>
                                                    <button
                                                        onClick={() => {
                                                            const val = prompt('Введіть суму оплати менеджера:', managerPaidRecordedAmount);
                                                            if (val !== null) handleQuickUpdate('manager_paid_amount', parseFloat(val) || 0);
                                                        }}
                                                        className="text-amber-600 hover:text-amber-800"
                                                        title="Змінити суму виплати менеджера"
                                                    >
                                                        <i className="fas fa-edit text-xs"></i>
                                                    </button>
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-[10px] uppercase font-bold text-slate-400">Дата виплати</div>
                                                <div className="mt-1">
                                                    <EditableDate
                                                        value={order.date_manager_paid}
                                                        onSave={(val) => handleQuickUpdate('date_manager_paid', val)}
                                                        emptyText="Не виплачено"
                                                        className="text-emerald-700 font-bold"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-[10px] uppercase font-bold text-slate-400">Логіка</div>
                                                <div className="mt-1 text-xs font-semibold text-slate-600">{managerActivationHint}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div className="p-8 border-b border-slate-100 bg-slate-50/30">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
                        <div className="flex flex-wrap gap-3">
                            <button
                                type="button"
                                onClick={() => setActiveDetailTab('history')}
                                className={`rounded-2xl border px-5 py-3 text-left transition ${activeDetailTab === 'history'
                                    ? 'border-blue-200 bg-white text-blue-700 shadow-sm'
                                    : 'border-slate-200 bg-white/70 text-slate-500 hover:border-slate-300 hover:text-slate-700'
                                    }`}
                            >
                                <div className="flex items-center gap-2 text-lg font-black uppercase italic">
                                    <i className="fas fa-calculator text-blue-600"></i> Розрахунок по етапах
                                </div>
                                <p className="mt-1 text-xs font-semibold normal-case text-slate-400">
                                    Короткий підсумок по Етапу 1 та Етапу 2: дати, виплати та залишок
                                </p>
                            </button>

                            <button
                                type="button"
                                onClick={() => setActiveDetailTab('planning')}
                                className={`rounded-2xl border px-5 py-3 text-left transition ${activeDetailTab === 'planning'
                                    ? 'border-violet-200 bg-white text-violet-700 shadow-sm'
                                    : 'border-slate-200 bg-white/70 text-slate-500 hover:border-slate-300 hover:text-slate-700'
                                    }`}
                            >
                                <div className="flex items-center gap-2 text-lg font-black uppercase italic">
                                    <i className="fas fa-diagram-project text-violet-600"></i> Планування
                                </div>
                                <p className="mt-1 text-xs font-semibold normal-case text-slate-400">
                                    Дати, терміни та всі виробничі процеси по замовленню
                                </p>
                            </button>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                            {activeDetailTab === 'history' && isAdmin && (
                                <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                                    <button
                                        type="button"
                                        onClick={() => setHistoryScope('constructor')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition ${historyScope === 'constructor'
                                            ? 'bg-white text-blue-600 shadow-sm'
                                            : 'text-slate-500 hover:text-slate-700'
                                            }`}
                                    >
                                        Конструктор
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setHistoryScope('manager')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition ${historyScope === 'manager'
                                            ? 'bg-white text-amber-700 shadow-sm'
                                            : 'text-slate-500 hover:text-slate-700'
                                            }`}
                                    >
                                        Менеджер
                                    </button>
                                </div>
                            )}
                            <div className="text-xs font-bold uppercase tracking-widest text-slate-400">
                                {activeDetailTab === 'history'
                                    ? (showManagerHistory ? '2 етапи (менеджер)' : '2 етапи (конструктор)')
                                    : canManage
                                        ? planningDirty
                                            ? 'Є незбережені зміни'
                                            : planningMessage || 'Планування актуальне'
                                        : 'Режим перегляду'}
                            </div>
                        </div>
                    </div>

                    {activeDetailTab === 'history' ? (
                        showManagerHistory ? (
                            <div className="space-y-4">
                                <div className="rounded-xl border border-amber-100 bg-amber-50/40 px-4 py-2 text-xs font-semibold text-amber-800">
                                    Підсумок по менеджеру: дата активації, скільки виплачено та який залишок по кожному етапу.
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className={`rounded-xl border p-4 ${managerStage1Active ? 'border-blue-200 bg-blue-50/50' : 'border-slate-200 bg-white/80'}`}>
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="text-sm font-black text-blue-700 uppercase">Етап 1 ({managerStage1Percent}%)</div>
                                            <span className={`text-[10px] font-bold uppercase ${managerStage1Active ? 'text-blue-600' : 'text-slate-400'}`}>
                                                {managerStage1Active ? 'Активний' : 'Очікує'}
                                            </span>
                                        </div>
                                        <div className="space-y-1 text-sm">
                                            <div className="flex justify-between"><span className="text-slate-500">Дата передачі:</span><span className="font-bold">{formatDate(order.date_manager_handover)}</span></div>
                                            <div className="flex justify-between"><span className="text-slate-500">Нараховано:</span><span className="font-bold text-blue-700">{formatMoney(order.manager_stage1_amount)}</span></div>
                                            <div className="flex justify-between"><span className="text-slate-500">Виплачено:</span><span className="font-bold text-emerald-700">{formatMoney(managerStage1Paid)}</span></div>
                                            <div className="flex justify-between"><span className="text-slate-500">Залишок:</span><span className={`font-black ${managerStage1Remaining > 0.01 ? 'text-amber-700' : 'text-green-700'}`}>{formatMoney(managerStage1Remaining)}</span></div>
                                        </div>
                                    </div>

                                    <div className={`rounded-xl border p-4 ${managerStage2Active ? 'border-violet-200 bg-violet-50/50' : 'border-slate-200 bg-white/80'}`}>
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="text-sm font-black text-violet-700 uppercase">Етап 2 ({managerStage2Percent}%)</div>
                                            <span className={`text-[10px] font-bold uppercase ${managerStage2Active ? 'text-violet-600' : 'text-slate-400'}`}>
                                                {managerStage2Active ? 'Активний' : 'Очікує'}
                                            </span>
                                        </div>
                                        <div className="space-y-1 text-sm">
                                            <div className="flex justify-between"><span className="text-slate-500">Дата монтажу:</span><span className="font-bold">{formatDate(order.date_installation)}</span></div>
                                            <div className="flex justify-between"><span className="text-slate-500">Нараховано:</span><span className="font-bold text-violet-700">{formatMoney(order.manager_stage2_amount)}</span></div>
                                            <div className="flex justify-between"><span className="text-slate-500">Виплачено:</span><span className="font-bold text-emerald-700">{formatMoney(managerStage2Paid)}</span></div>
                                            <div className="flex justify-between"><span className="text-slate-500">Залишок:</span><span className={`font-black ${managerStage2Remaining > 0.01 ? 'text-amber-700' : 'text-green-700'}`}>{formatMoney(managerStage2Remaining)}</span></div>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                    <div className="rounded-lg border border-amber-100 bg-white/90 px-3 py-2">
                                        <div className="text-[10px] uppercase font-bold text-slate-400">Повна премія</div>
                                        <div className="text-sm font-black text-amber-700">{formatMoney(managerTotalBonus)}</div>
                                    </div>
                                    <div className="rounded-lg border border-amber-100 bg-white/90 px-3 py-2">
                                        <div className="text-[10px] uppercase font-bold text-slate-400">Нараховано зараз</div>
                                        <div className="text-sm font-black text-amber-700">{formatMoney(managerAccruedAmount)}</div>
                                    </div>
                                    <div className="rounded-lg border border-emerald-100 bg-white/90 px-3 py-2">
                                        <div className="text-[10px] uppercase font-bold text-slate-400">Виплачено</div>
                                        <div className="text-sm font-black text-emerald-700">{formatMoney(managerPaidActiveAmount)}</div>
                                    </div>
                                    <div className="rounded-lg border border-amber-100 bg-white/90 px-3 py-2">
                                        <div className="text-[10px] uppercase font-bold text-slate-400">Поточний залишок</div>
                                        <div className={`text-sm font-black ${managerRemainingAmount > 0.01 ? 'text-amber-700' : 'text-green-700'}`}>{formatMoney(managerRemainingAmount)}</div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="rounded-xl border border-blue-100 bg-blue-50/40 px-4 py-2 text-xs font-semibold text-blue-800">
                                    Підсумок по конструктору: дата здачі/монтажу, виплати і залишок по кожному етапу.
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className={`rounded-xl border p-4 ${constructorStage1Active ? 'border-blue-200 bg-blue-50/50' : 'border-slate-200 bg-white/80'}`}>
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="text-sm font-black text-blue-700 uppercase">Етап 1 ({constructorStage1Percent}%)</div>
                                            <span className={`text-[10px] font-bold uppercase ${constructorStage1Active ? 'text-blue-600' : 'text-slate-400'}`}>
                                                {constructorStage1Active ? 'Активний' : 'Очікує'}
                                            </span>
                                        </div>
                                        <div className="space-y-1 text-sm">
                                            <div className="flex justify-between"><span className="text-slate-500">Дата здачі в роботу:</span><span className="font-bold">{formatDate(order.date_to_work)}</span></div>
                                            <div className="flex justify-between"><span className="text-slate-500">Нараховано:</span><span className="font-bold text-blue-700">{formatMoney(constructorStage1Amount)}</span></div>
                                            <div className="flex justify-between"><span className="text-slate-500">Виплачено:</span><span className="font-bold text-emerald-700">{formatMoney(constructorPaidStage1)}</span></div>
                                            <div className="flex justify-between"><span className="text-slate-500">Залишок:</span><span className={`font-black ${constructorStage1Remaining > 0.01 ? 'text-amber-700' : 'text-green-700'}`}>{formatMoney(constructorStage1Remaining)}</span></div>
                                        </div>
                                    </div>

                                    <div className={`rounded-xl border p-4 ${constructorStage2Active ? 'border-violet-200 bg-violet-50/50' : 'border-slate-200 bg-white/80'}`}>
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="text-sm font-black text-violet-700 uppercase">Етап 2 ({constructorStage2Percent}%)</div>
                                            <span className={`text-[10px] font-bold uppercase ${constructorStage2Active ? 'text-violet-600' : 'text-slate-400'}`}>
                                                {constructorStage2Active ? 'Активний' : 'Очікує'}
                                            </span>
                                        </div>
                                        <div className="space-y-1 text-sm">
                                            <div className="flex justify-between"><span className="text-slate-500">Дата монтажу:</span><span className="font-bold">{formatDate(order.date_installation)}</span></div>
                                            <div className="flex justify-between"><span className="text-slate-500">Нараховано:</span><span className="font-bold text-violet-700">{formatMoney(constructorStage2Amount)}</span></div>
                                            <div className="flex justify-between"><span className="text-slate-500">Виплачено:</span><span className="font-bold text-emerald-700">{formatMoney(constructorPaidStage2)}</span></div>
                                            <div className="flex justify-between"><span className="text-slate-500">Залишок:</span><span className={`font-black ${constructorStage2Remaining > 0.01 ? 'text-amber-700' : 'text-green-700'}`}>{formatMoney(constructorStage2Remaining)}</span></div>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                    <div className="rounded-lg border border-blue-100 bg-white/90 px-3 py-2">
                                        <div className="text-[10px] uppercase font-bold text-slate-400">Повний ПГ</div>
                                        <div className="text-sm font-black text-blue-700">{formatMoney(constructorTotalBonus)}</div>
                                    </div>
                                    <div className="rounded-lg border border-blue-100 bg-white/90 px-3 py-2">
                                        <div className="text-[10px] uppercase font-bold text-slate-400">Нараховано зараз</div>
                                        <div className="text-sm font-black text-blue-700">{formatMoney(constructorAccruedAmount)}</div>
                                    </div>
                                    <div className="rounded-lg border border-emerald-100 bg-white/90 px-3 py-2">
                                        <div className="text-[10px] uppercase font-bold text-slate-400">Виплачено</div>
                                        <div className="text-sm font-black text-emerald-700">{formatMoney(constructorPaidActiveAmount)}</div>
                                    </div>
                                    <div className="rounded-lg border border-blue-100 bg-white/90 px-3 py-2">
                                        <div className="text-[10px] uppercase font-bold text-slate-400">Поточний залишок</div>
                                        <div className={`text-sm font-black ${constructorRemainingAmount > 0.01 ? 'text-amber-700' : 'text-green-700'}`}>{formatMoney(constructorRemainingAmount)}</div>
                                    </div>
                                </div>
                            </div>
                        )
                    ) : (
                        <div className="space-y-6">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                <div>
                                    <h3 className="text-xl font-black text-slate-800 uppercase italic flex items-center gap-2">
                                        <i className="fas fa-diagram-project text-violet-600"></i> Планування замовлення
                                    </h3>
                                    <p className="text-sm text-slate-500 mt-1">
                                        Тут можна задати ключові дати та терміни по всіх процесах. Дати етапів нижче рахуються автоматично.
                                    </p>
                                </div>

                                {canManage ? (
                                    <div className="flex items-center gap-3">
                                        {planningMessage ? (
                                            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
                                                {planningMessage}
                                            </span>
                                        ) : null}
                                        <button
                                            type="button"
                                            onClick={handleSavePlanning}
                                            disabled={!planningDirty || planningSaving}
                                            className="px-5 py-2.5 bg-violet-600 text-white font-bold rounded-xl shadow-lg shadow-violet-200 hover:bg-violet-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {planningSaving ? 'Збереження...' : 'Зберегти планування'}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                        Для вашої ролі доступний перегляд
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
                                {[
                                    { key: 'date_received', title: 'Дата отримання', hint: 'Базова дата для плану' },
                                    { key: 'date_manager_handover', title: 'Передано конструктору', hint: 'Старт Етапу 1 менеджера' },
                                    { key: 'date_to_work', title: 'Передано в роботу', hint: 'Старт конструктиву' },
                                    { key: 'date_design_deadline', title: 'Дедлайн конструктиву', hint: 'Контрольна дата' },
                                    { key: 'date_installation_plan', title: 'План монтажу', hint: 'Якір для зворотного розрахунку' },
                                    { key: 'date_installation', title: 'Факт монтажу', hint: 'Коли реально змонтовано' },
                                ].map((field) => (
                                    <div key={field.key} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                            {field.title}
                                        </div>
                                        <div className="mt-1 text-[11px] font-semibold text-slate-400">{field.hint}</div>
                                        <UKDatePicker
                                            selected={planningData[field.key]}
                                            onChange={(value) => updatePlanningField(field.key, value || '')}
                                            disabled={!canManage}
                                            placeholder="ДД.ММ.РРРР"
                                            className="mt-4 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 text-left outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                                        />
                                    </div>
                                ))}
                            </div>

                            <div className="rounded-2xl border border-violet-100 bg-violet-50/60 px-4 py-3 text-sm text-violet-700">
                                <span className="font-black uppercase text-[10px] tracking-widest mr-2">Логіка розрахунку:</span>
                                {planningPreview.calculationMode === 'backward'
                                    ? 'є дата планового монтажу, тому попередні процеси рахуються назад від неї.'
                                    : 'дати процесів рахуються вперед від дати "Передано в роботу" або "Дата отримання".'}
                            </div>

                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                {planningPreview.stages.map((stage) => (
                                    <div key={stage.key} className={`rounded-3xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-inset ${stage.ring}`}>
                                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-3">
                                                    <span className={`h-3 w-3 rounded-full ${stage.accent}`}></span>
                                                    <h4 className="text-lg font-black uppercase italic text-slate-800">{stage.title}</h4>
                                                </div>
                                                <p className="mt-2 text-sm text-slate-500">
                                                    Розрахований інтервал для цього процесу з поточного плану замовлення.
                                                </p>
                                            </div>

                                            <div className="w-full md:w-[128px]">
                                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                                                    Термін, днів
                                                </label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="60"
                                                    value={stage.duration}
                                                    onChange={(e) => updatePlanningField(stage.durationField, e.target.value)}
                                                    disabled={!canManage || stage.lockedByDates}
                                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-black text-slate-700 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                                                />
                                                {stage.lockedByDates ? (
                                                    <div className="mt-2 text-[10px] font-bold text-slate-400">
                                                        Рахується з дат старту/фінішу
                                                    </div>
                                                ) : null}
                                            </div>
                                        </div>

                                        <div className="mt-5 grid grid-cols-2 gap-3">
                                            <div className="rounded-2xl bg-slate-50 p-4">
                                                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Старт</div>
                                                <UKDatePicker
                                                    selected={planningData[stage.startField] || toInputDateValue(stage.start)}
                                                    onChange={(value) => updatePlanningField(stage.startField, value || '')}
                                                    disabled={!canManage}
                                                    placeholder="ДД.ММ.РРРР"
                                                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-800 text-left outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                                                />
                                                <div className="mt-2 text-[10px] font-semibold text-slate-400">
                                                    {stage.start ? `Поточна дата: ${formatPlanningDate(stage.start)}` : 'Дата ще не визначена'}
                                                </div>
                                            </div>
                                            <div className="rounded-2xl bg-slate-50 p-4">
                                                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Фініш</div>
                                                <UKDatePicker
                                                    selected={planningData[stage.endField] || toInputDateValue(stage.end)}
                                                    onChange={(value) => updatePlanningField(stage.endField, value || '')}
                                                    disabled={!canManage}
                                                    placeholder="ДД.ММ.РРРР"
                                                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-800 text-left outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                                                />
                                                <div className="mt-2 text-[10px] font-semibold text-slate-400">
                                                    {stage.end ? `Поточна дата: ${formatPlanningDate(stage.end)}` : 'Дата ще не визначена'}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-4">
                                            <div className="mb-2 flex items-center justify-between text-[11px] font-bold text-slate-400">
                                                <span>Тривалість процесу</span>
                                                <span>{clampPlanningDays(planningData[stage.durationField], stage.duration)} дн.</span>
                                            </div>
                                            <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full ${stage.accent}`}
                                                    style={{ width: `${Math.min(100, 18 + clampPlanningDays(planningData[stage.durationField], stage.duration) * 8)}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
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
                                                <span className={`text-xs font-bold px-3 py-1 rounded-full ${deduction.target_role === 'manager'
                                                    ? 'bg-amber-100 text-amber-700'
                                                    : 'bg-blue-100 text-blue-700'
                                                    }`}>
                                                    {deduction.target_role === 'manager' ? '👤 Менеджер' : '👷 Конструктор'}
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
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Кому нарахувати штраф</label>
                                    <select
                                        value={deductionForm.target_role}
                                        onChange={e => setDeductionForm({ ...deductionForm, target_role: e.target.value })}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent font-bold text-slate-700"
                                    >
                                        <option value="constructor">👷 Конструктору</option>
                                        <option value="manager">👤 Менеджеру</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Дата</label>
                                    <UKDatePicker
                                        selected={deductionForm.date_created}
                                        onChange={(value) => setDeductionForm({ ...deductionForm, date_created: value || '' })}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-xl text-left font-bold text-slate-700 focus:ring-2 focus:ring-red-500 focus:border-transparent"
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
