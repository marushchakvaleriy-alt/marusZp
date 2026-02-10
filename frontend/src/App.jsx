import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import OrderList from './components/OrderList';
import OrderDetail from './components/OrderDetail';
import PaymentHistory from './components/PaymentHistory';
import DeductionsList from './components/DeductionsList';
import { getOrder, resetDatabase } from './api';
import ActivityLog from './components/ActivityLog';
import { useAuth } from './context/AuthContext';
import Login from './components/Login';
import UserManagement from './components/UserManagement';
import SeasonBackground from './components/SeasonBackground';

function App() {
    const { user, loading, logout } = useAuth();
    const [currentView, setCurrentView] = useState('list');
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [statsRefreshKey, setStatsRefreshKey] = useState(0);

    // Season State
    const [season, setSeason] = useState(() => {
        // Auto-detect season logic (optional, defaults to winter for now)
        const month = new Date().getMonth(); // 0-11
        if (month >= 2 && month <= 4) return 'spring';
        if (month >= 5 && month <= 7) return 'summer';
        if (month >= 8 && month <= 10) return 'autumn';
        return 'winter';
    });

    const cycleSeason = () => {
        const seasons = ['winter', 'spring', 'summer', 'autumn'];
        const nextIndex = (seasons.indexOf(season) + 1) % seasons.length;
        setSeason(seasons[nextIndex]);
    };

    // Initial History Setup & Listener
    useEffect(() => {
        if (!window.history.state) {
            window.history.replaceState({ view: 'list' }, '', '');
        }

        const handlePopState = (event) => {
            if (event.state) {
                setCurrentView(event.state.view || 'list');
                setSelectedOrder(event.state.order || null);
            } else {
                setCurrentView('list');
                setSelectedOrder(null);
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    const navigateTo = (view, order = null) => {
        setCurrentView(view);
        setSelectedOrder(order);
        window.history.pushState({ view, order }, '', '');
        window.scrollTo(0, 0);
    };

    const handleSelectOrder = (order) => {
        navigateTo('detail', order);
    };

    const handleUpdateOrder = async () => {
        if (selectedOrder) {
            const updatedOrder = await getOrder(selectedOrder.id);
            setSelectedOrder(updatedOrder);
            window.history.replaceState({ view: 'detail', order: updatedOrder }, '', '');
        }
    };

    const handleStatsRefresh = () => {
        setStatsRefreshKey(prev => prev + 1);
    };

    const handleResetDatabase = async () => {
        const password = prompt("Введіть пароль для очищення всієї бази даних:");
        if (!password) return;

        try {
            await resetDatabase(password);
            alert("Базу даних успішно очищено!");
            window.location.reload();
        } catch (error) {
            console.error("Reset failed:", error);
            if (error.response && error.response.status === 403) {
                alert("Невірний пароль!");
            } else {
                alert("Помилка при очищенні бази даних.");
            }
        }
    };

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center text-slate-500">Завантаження...</div>;
    }

    if (!user) {
        return (
            <>
                <SeasonBackground season={season} />
                <Login />
            </>
        );
    }

    const getSeasonIcon = () => {
        switch (season) {
            case 'winter': return '❄️';
            case 'spring': return '🐦';
            case 'summer': return '✨';
            case 'autumn': return '🍂';
            default: return '🌈';
        }
    };

    return (
        <div className="min-h-screen p-4 lg:p-8 relative">
            <SeasonBackground season={season} />

            {/* Season Toggle Button */}
            <button
                onClick={cycleSeason}
                className="fixed bottom-4 right-4 z-50 bg-white/80 backdrop-blur-md p-3 rounded-full shadow-lg border border-slate-200 hover:scale-110 transition-transform text-2xl"
                title="Змінити пору року"
            >
                {getSeasonIcon()}
            </button>
            <div className="max-w-[1900px] mx-auto relative z-10">
                {currentView === 'list' && (
                    <>
                        <Dashboard refreshTrigger={statsRefreshKey} />
                        <div className="mb-6 flex justify-end gap-3 flex-wrap items-center">
                            <div className="mr-auto flex items-center gap-2">
                                <span className="text-slate-500 font-bold">
                                    {user.username} ({user.role === 'admin' ? 'Адмін' : user.role === 'manager' ? 'Менеджер' : 'Конструктор'})
                                </span>
                                <button onClick={logout} className="text-red-500 hover:text-red-700 text-sm font-bold underline">Вийти</button>
                            </div>

                            {user.role === 'admin' && (
                                <>
                                    <button
                                        onClick={() => navigateTo('users')}
                                        className="px-6 py-2 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition flex items-center gap-2"
                                    >
                                        <i className="fas fa-users-cog"></i> Користувачі
                                    </button>
                                    <button
                                        onClick={handleResetDatabase}
                                        className="px-6 py-2 bg-slate-800 text-white font-bold rounded-xl shadow-lg shadow-slate-200 hover:bg-black transition flex items-center gap-2"
                                    >
                                        <i className="fas fa-trash-alt"></i> Очистити все
                                    </button>
                                </>
                            )}
                            <button
                                onClick={() => navigateTo('activity')}
                                className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition flex items-center gap-2"
                            >
                                <i className="fas fa-list-ul"></i> Історія дій
                            </button>
                            <button
                                onClick={() => navigateTo('deductions')}
                                className="px-6 py-2 bg-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-200 hover:bg-red-700 transition flex items-center gap-2"
                            >
                                <i className="fas fa-exclamation-triangle"></i> {(user.role === 'admin' || user.role === 'manager') ? 'Провини конструкторів' : 'Мої провини'}
                            </button>
                            <button
                                onClick={() => navigateTo('payments')}
                                className="px-6 py-2 bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition flex items-center gap-2"
                            >
                                <i className="fas fa-history"></i> Історія платежів
                            </button>
                        </div>
                        <OrderList onSelectOrder={handleSelectOrder} onPaymentAdded={handleStatsRefresh} refreshTrigger={statsRefreshKey} />
                    </>
                )}

                {currentView === 'detail' && selectedOrder && (
                    <OrderDetail order={selectedOrder} onBack={() => navigateTo('list')} onUpdate={handleUpdateOrder} />
                )}

                {currentView === 'users' && (
                    <UserManagement onBack={() => navigateTo('list')} />
                )}

                {currentView === 'payments' && (
                    <>
                        <button
                            onClick={() => navigateTo('list')}
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
                            onClick={() => navigateTo('list')}
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
                            onClick={() => navigateTo('list')}
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
