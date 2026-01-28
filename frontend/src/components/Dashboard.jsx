import React, { useEffect, useState } from 'react';
import { getOrders, getFinancialStats, getDeductions } from '../api';

const StatCard = ({ title, value, type = 'default', showCurrency = true }) => {
    const styles = {
        default: {
            bg: 'glass-card',
            titleColor: 'text-slate-400',
            valueColor: 'text-slate-900',
            subColor: 'text-slate-300'
        },
        blue: {
            bg: 'bg-blue-600 shadow-lg shadow-blue-100 text-white',
            titleColor: 'text-blue-100',
            valueColor: 'text-white',
            subColor: 'text-blue-300'
        },
        red: {
            bg: 'bg-red-50 border border-red-100',
            titleColor: 'text-red-400 italic',
            valueColor: 'text-red-600',
            subColor: 'text-red-300 italic'
        },
        yellow: {
            bg: 'bg-yellow-50 border border-yellow-100',
            titleColor: 'text-yellow-600 uppercase font-extrabold',
            valueColor: 'text-yellow-700',
            subColor: 'text-yellow-500'
        }
    };

    const style = styles[type] || styles.default;

    return (
        <div className={`p-6 rounded-3xl shadow-sm ${style.bg}`}>
            <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${style.titleColor}`}>{title}</p>
            <h2 className={`text-3xl font-black ${style.valueColor}`}>
                {value} {showCurrency && <span className={`text-lg font-normal ${style.subColor}`}>₴</span>}
            </h2>
        </div>
    );
};

const Dashboard = () => {
    const [stats, setStats] = useState({
        unpaidAdvances: "0",
        completedOrders: "0",
        totalDebt: "0",
        totalBalance: "0",
        unallocatedFunds: "0"
    });

    useEffect(() => {
        const calculateStats = async () => {
            try {
                const [orders, financialStats, deductions] = await Promise.all([
                    getOrders(),
                    getFinancialStats(),
                    getDeductions()
                ]);

                let unpaidAdvances = 0;
                let completedCount = 0;
                let totalDebt = 0;
                let totalBalance = 0;
                let totalDeductions = 0;

                // Calculate total unpaid deductions
                deductions.forEach(d => {
                    if (!d.is_paid) {
                        totalDeductions += d.amount;
                    }
                });

                orders.forEach(order => {
                    // Total balance = sum of all bonuses
                    totalBalance += order.bonus;

                    // Completed orders = fully paid
                    if (order.date_final_paid) {
                        completedCount++;
                    }

                    // Unpaid advances = orders with date_to_work but unpaid advance
                    if (order.date_to_work && order.advance_remaining > 0.01) {
                        unpaidAdvances += order.advance_remaining;
                    }

                    // Total debt = all critical debts
                    if (order.is_critical_debt) {
                        totalDebt += order.current_debt;
                    }
                });

                // Add fines to debt and subtract from balance
                totalDebt -= totalDeductions;
                // totalBalance -= totalDeductions; // Optional: depending on if "Balance" is gross or net. Let's adjust it to net.

                setStats({
                    unpaidAdvances: unpaidAdvances.toLocaleString(),
                    completedOrders: completedCount.toString(),
                    totalDebt: totalDebt.toLocaleString(),
                    totalBalance: totalBalance.toLocaleString(),
                    unallocatedFunds: financialStats.unallocated.toLocaleString()
                });
            } catch (error) {
                console.error("Failed to fetch stats:", error);
            }
        };
        calculateStats();
    }, []);

    return (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-10">
            <StatCard title="Неоплачені аванси" value={stats.unpaidAdvances} type="blue" />
            <StatCard title="Закриті замовлення" value={stats.completedOrders} showCurrency={false} />
            <StatCard title="Загальний борг" value={stats.totalDebt} type="red" />
            <StatCard title="Загальний баланс" value={stats.totalBalance} />
            <StatCard title="Нерозподілено" value={stats.unallocatedFunds} type="yellow" />
        </div>
    );
};

export default Dashboard;
