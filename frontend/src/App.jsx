import React, { useState } from 'react';
import Dashboard from './components/Dashboard';
import OrderList from './components/OrderList';
import OrderDetail from './components/OrderDetail';
import PaymentHistory from './components/PaymentHistory';
import DeductionsList from './components/DeductionsList';
import { getOrder } from './api';
import ActivityLog from './components/ActivityLog';

function App() {
    const [currentView, setCurrentView] = useState('list');
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [statsRefreshKey, setStatsRefreshKey] = useState(0);

    const handleSelectOrder = (order) => {
        setSelectedOrder(order);
        setCurrentView('detail');
    };

    const handleUpdateOrder = async () => {
        if (selectedOrder) {
            const updatedOrder = await getOrder(selectedOrder.id);
            setSelectedOrder(updatedOrder);
        }
    };

    const handleStatsRefresh = () => {
        setStatsRefreshKey(prev => prev + 1);
    };

    return (
        <div className="min-h-screen p-4 lg:p-8">
            <div className="max-w-[1600px] mx-auto">
                {currentView === 'list' && (
                    <>
                        <Dashboard key={statsRefreshKey} />
                        <div className="mb-6 flex justify-end gap-3 flex-wrap">
                            <button
                                onClick={() => setCurrentView('activity')}
                                className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition flex items-center gap-2"
                            >
                                <i className="fas fa-list-ul"></i> Історія дій
                            </button>
                            <button
                                onClick={() => setCurrentView('deductions')}
                                className="px-6 py-2 bg-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-200 hover:bg-red-700 transition flex items-center gap-2"
                            >
                                <i className="fas fa-exclamation-triangle"></i> Мої провини
                            </button>
                            <button
                                onClick={() => setCurrentView('payments')}
                                className="px-6 py-2 bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition flex items-center gap-2"
                            >
                                <i className="fas fa-history"></i> Історія платежів
                            </button>
                        </div>
                        <OrderList onSelectOrder={handleSelectOrder} onPaymentAdded={handleStatsRefresh} />
                    </>
                )}

                {currentView === 'detail' && selectedOrder && (
                    <OrderDetail order={selectedOrder} onBack={() => setCurrentView('list')} onUpdate={handleUpdateOrder} />
                )}

                {currentView === 'payments' && (
                    <>
                        <button
                            onClick={() => setCurrentView('list')}
                            className="mb-6 text-slate-400 hover:text-blue-600 font-bold text-xs uppercase transition"
                        >
                            <i className="fas fa-arrow-left mr-2"></i> Назад до реєстру
                        </button>
                        <PaymentHistory />
                    </>
                )}

                {currentView === 'deductions' && (
                    <>
                        <button
                            onClick={() => setCurrentView('list')}
                            className="mb-6 text-slate-400 hover:text-blue-600 font-bold text-xs uppercase transition"
                        >
                            <i className="fas fa-arrow-left mr-2"></i> Назад до реєстру
                        </button>
                        <DeductionsList />
                    </>
                )}

                {currentView === 'activity' && (
                    <>
                        <button
                            onClick={() => setCurrentView('list')}
                            className="mb-6 text-slate-400 hover:text-blue-600 font-bold text-xs uppercase transition"
                        >
                            <i className="fas fa-arrow-left mr-2"></i> Назад до реєстру
                        </button>
                        <ActivityLog />
                    </>
                )}
            </div>
        </div>
    );
}

export default App;
