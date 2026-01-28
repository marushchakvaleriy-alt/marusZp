import React, { useEffect, useState } from 'react';
import { getLogs } from '../api';

const ActivityLog = () => {
    const [logs, setLogs] = useState([]);

    const fetchLogs = async () => {
        try {
            const data = await getLogs();
            setLogs(data);
        } catch (error) {
            console.error("Failed to fetch logs:", error);
        }
    };

    useEffect(() => {
        fetchLogs();
        // Auto-refresh every 30 seconds
        const interval = setInterval(fetchLogs, 30000);
        return () => clearInterval(interval);
    }, []);

    const getActionConfig = (action) => {
        switch (action) {
            case "CREATE_ORDER":
                return {
                    label: "НОВЕ ЗАМОВЛЕННЯ",
                    icon: "fas fa-folder-plus",
                    style: "bg-blue-100 text-blue-700 border-blue-200"
                };
            case "ADD_PAYMENT":
                return {
                    label: "НАТХОДЖЕННЯ КОШТІВ",
                    icon: "fas fa-money-bill-wave",
                    style: "bg-emerald-100 text-emerald-700 border-emerald-200"
                };
            case "ADD_DEDUCTION":
                return {
                    label: "ШТРАФ / ПРОВИНА",
                    icon: "fas fa-exclamation-circle",
                    style: "bg-red-100 text-red-700 border-red-200"
                };
            case "DELETE_ORDER":
                return {
                    label: "ВИДАЛЕННЯ ЗАМОВЛЕННЯ",
                    icon: "fas fa-trash-alt",
                    style: "bg-slate-100 text-slate-600 border-slate-200"
                };
            case "DELETE_DEDUCTION":
                return {
                    label: "ВИДАЛЕННЯ ШТРАФУ",
                    icon: "fas fa-trash-restore",
                    style: "bg-orange-100 text-orange-700 border-orange-200"
                };
            default:
                return {
                    label: action,
                    icon: "fas fa-info-circle",
                    style: "bg-gray-100 text-gray-600 border-gray-200"
                };
        }
    };

    return (
        <div className="bg-white rounded-3xl shadow-xl p-8 border border-white/50 relative overflow-hidden backdrop-blur-xl">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black text-slate-800 italic uppercase flex items-center gap-3">
                    <span className="bg-indigo-100 text-indigo-600 p-2 rounded-lg text-xl">
                        <i className="fas fa-list-ul"></i>
                    </span>
                    Історія дій
                </h2>
                <button
                    onClick={fetchLogs}
                    className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition text-slate-500"
                    title="Оновити"
                >
                    <i className="fas fa-sync-alt"></i>
                </button>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-slate-100 text-left">
                            <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider w-32">Час</th>
                            <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider w-48">Подія</th>
                            <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Опис</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {logs.length === 0 ? (
                            <tr>
                                <td colSpan="3" className="p-12 text-center">
                                    <div className="text-slate-300 text-4xl mb-3">
                                        <i className="fas fa-history"></i>
                                    </div>
                                    <div className="text-slate-400 italic">Історія поки що порожня</div>
                                </td>
                            </tr>
                        ) : (
                            logs.map((log) => {
                                const config = getActionConfig(log.action_type);
                                return (
                                    <tr key={log.id} className="hover:bg-slate-50/80 transition group">
                                        <td className="p-4 text-xs font-mono text-slate-400 whitespace-nowrap">
                                            {new Date(log.timestamp).toLocaleDateString()}
                                            <div className="text-[10px] opacity-0 group-hover:opacity-100 transition">
                                                {/* ID: {log.id} */}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide border ${config.style}`}>
                                                <i className={`${config.icon}`}></i>
                                                {config.label}
                                            </span>
                                        </td>
                                        <td className="p-4 text-sm text-slate-700 font-medium">
                                            {log.description}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ActivityLog;
