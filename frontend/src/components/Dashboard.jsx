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

const Dashboard = ({ refreshTrigger }) => {
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
                let positiveDebt = 0; // Customer owes technologist
                let negativeDebt = 0; // Technologist owes customer (fines)
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

                    // Calculate fines for this order (ALL fines reduce debt)
                    const orderFines = deductions
                        .filter(d => d.order_id === order.id)
                        .reduce((sum, d) => sum + d.amount, 0);

                    // Separate positive debts (customer owes) and negative debts (technologist owes)
                    // Calculate for ALL orders to ensure credits (fines) are counted even if order is 'paid'
                    const adjustedDebt = order.current_debt - orderFines;

                    if (adjustedDebt > 0) {
                        // Positive debt: customer owes technologist
                        positiveDebt += adjustedDebt;
                    } else if (adjustedDebt < 0) {
                        // Negative debt: technologist owes customer (fines exceed work debt)
                        negativeDebt += Math.abs(adjustedDebt);
                    }
                });

                // Compensate positive and negative debts
                // Net debt = positive debt minus negative debt (but not below 0)
                const netDebt = Math.max(0, positiveDebt - negativeDebt);

                // Customer balance = excess of negative debt after compensation
                const customerBalance = Math.max(0, negativeDebt - positiveDebt);

                setStats({
                    totalOrders: orders.length.toLocaleString(),
                    completedOrders: completedCount.toLocaleString(),
                    totalBalance: totalBalance.toLocaleString(),
                    totalDebt: netDebt.toLocaleString(),
                    totalDeductions: totalDeductions.toLocaleString(),
                    unpaidAdvances: unpaidAdvances.toLocaleString(),
                    customerBalance: customerBalance.toLocaleString(),
                    unallocatedFunds: (financialStats.unallocated + customerBalance).toLocaleString()
                });
            } catch (error) {
                console.error("Failed to fetch stats:", error);
            }
        };
        calculateStats();
    }, [refreshTrigger]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
            <StatCard title="Загальний борг" value={stats.totalDebt} type="red" />
            <StatCard title="Нерозподілено" value={stats.unallocatedFunds} type="yellow" />
        </div>
    );
};

export default Dashboard;
