import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext';
import AppErrorBoundary from './components/AppErrorBoundary.jsx';
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <AuthProvider>
            <AppErrorBoundary>
                <App />
            </AppErrorBoundary>
        </AuthProvider>
    </React.StrictMode>,
)
