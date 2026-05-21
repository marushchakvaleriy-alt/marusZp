import React from 'react';

class AppErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('App runtime error:', error, errorInfo);
    }

    handleReload = () => {
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                    <div className="max-w-xl w-full bg-white border border-red-200 rounded-2xl shadow-lg p-6">
                        <h1 className="text-lg font-black text-red-600 mb-3">Помилка інтерфейсу</h1>
                        <p className="text-sm text-slate-600 mb-4">
                            Сталася помилка під час завантаження сторінки. Оновіть сторінку або зверніться до адміністратора.
                        </p>
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 font-mono mb-4 break-words">
                            {this.state.error?.message || 'Невідома помилка'}
                        </div>
                        <button
                            onClick={this.handleReload}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition"
                        >
                            Оновити сторінку
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default AppErrorBoundary;
