import { Navigate, Route, Routes } from 'react-router-dom';
import AppShell from '../layout/AppShell';
import DashboardPage from '../modules/dashboard/DashboardPage';
import OrdersPage from '../modules/orders/OrdersPage';
import OrderDetailPage from '../modules/orders/OrderDetailPage';
import PlanningPage from '../modules/planning/PlanningPage';
import FinancePage from '../modules/finance/FinancePage';
import TeamPage from '../modules/team/TeamPage';
import SettingsPage from '../modules/settings/SettingsPage';
import LoginPage from '../modules/auth/LoginPage';
import ProtectedRoute from '../modules/auth/ProtectedRoute';
import RoleGate from '../modules/auth/RoleGate';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route
          path="/dashboard"
          element={
            <RoleGate pageKey="dashboard">
              <DashboardPage />
            </RoleGate>
          }
        />
        <Route
          path="/orders"
          element={
            <RoleGate pageKey="orders">
              <OrdersPage />
            </RoleGate>
          }
        />
        <Route
          path="/orders/:orderId"
          element={
            <RoleGate pageKey="orders">
              <OrderDetailPage />
            </RoleGate>
          }
        />
        <Route
          path="/planning"
          element={
            <RoleGate pageKey="planning">
              <PlanningPage />
            </RoleGate>
          }
        />
        <Route
          path="/finance"
          element={
            <RoleGate pageKey="finance">
              <FinancePage />
            </RoleGate>
          }
        />
        <Route
          path="/team"
          element={
            <RoleGate pageKey="team">
              <TeamPage />
            </RoleGate>
          }
        />
        <Route
          path="/settings"
          element={
            <RoleGate pageKey="settings">
              <SettingsPage />
            </RoleGate>
          }
        />
        </Route>
      </Route>
    </Routes>
  );
}
