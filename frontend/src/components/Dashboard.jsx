import React, { useEffect, useState } from 'react';
import { getFinancialStats } from '../api';
import { useAuth } from '../context/AuthContext';

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
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

    const [stats, setStats] = useState({
        totalDebt: "0",
        totalManagerDebt: "0",
        unallocatedFunds: "0",
        constructorStats: [],
        managerStats: []
    });

    useEffect(() => {
        const calculateStats = async () => {
            try {
                const financialStats = await getFinancialStats();

                setStats({
                    totalDebt: (financialStats.total_debt || 0).toLocaleString(),
                    totalManagerDebt: (financialStats.total_manager_debt || 0).toLocaleString(),
                    unallocatedFunds: (financialStats.unallocated || 0).toLocaleString(),
                    constructorStats: financialStats.constructors_stats || [],
                    managerStats: financialStats.manager_stats || []
                });
            } catch (error) {
                console.error("Failed to fetch stats:", error);
            }
        };
        calculateStats();
    }, [refreshTrigger]);

    if (!user) return null;

    return (
        <div className="space-y-6 mb-10">
            {/* Global Stats */}
            {(isAdmin || user?.role === 'constructor' || (user?.role === 'manager' && user?.can_see_dashboard === true)) && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <StatCard title="Борг конструкторам" value={stats.totalDebt} type="red" />
                    {parseFloat(stats.totalManagerDebt.replace(/[^0-9.-]+/g,"")) > 0 && (
                        <StatCard title="Борг менеджерам" value={stats.totalManagerDebt} type="yellow" />
                    )}
                    <StatCard title="Нерозподілено" value={stats.unallocatedFunds} type="blue" />
                </div>
            )}

            {/* Per-Constructor Stats (Admin Only) */}
            {
                isAdmin && stats.constructorStats && stats.constructorStats.length > 0 && (
                    <div className="bg-slate-50/50 rounded-3xl p-6 border border-slate-100">
                        <h3 className="text-xs font-black uppercase text-slate-400 mb-4 tracking-widest pl-2">По конструкторах</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {stats.constructorStats.map(c => (
                                <div key={c.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
                                    <p className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                                        {c.name}
                                    </p>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <p className="text-[10px] font-bold uppercase" style={{ color: c.debt >= 0 ? '#fca5a5' : '#86efac' }}>
                                                {c.debt >= 0 ? 'Борг' : 'Винен'}
                                            </p>
                                            <p className="text-lg font-black" style={{ color: c.debt >= 0 ? '#ef4444' : '#22c55e' }}>
                                                {Math.abs(c.debt).toLocaleString()}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-yellow-300 font-bold uppercase">Вільні</p>
                                            <p className="text-lg font-black text-yellow-600">{c.unallocated.toLocaleString()}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )
            }

            {/* Per-Manager Stats (Admin Only) */}
            {
                isAdmin && stats.managerStats && stats.managerStats.length > 0 && (
                    <div className="bg-slate-50/50 rounded-3xl p-6 border border-slate-100 mt-6">
                        <h3 className="text-xs font-black uppercase text-slate-400 mb-4 tracking-widest pl-2">По менеджерах</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {stats.managerStats.map(m => (
                                <div key={m.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
                                    <p className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-amber-300"></span>
                                        {m.name}
                                    </p>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <p className="text-[10px] text-red-300 font-bold uppercase">Борг</p>
                                            <p className="text-lg font-black text-red-600">{m.debt.toLocaleString()}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-slate-300 font-bold uppercase">Виплачено</p>
                                            <p className="text-lg font-black text-slate-600">{m.paid.toLocaleString()}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default Dashboard;
