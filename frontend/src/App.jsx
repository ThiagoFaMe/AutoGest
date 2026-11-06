import React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import MainLayout from "./layouts/MainLayout";
import LoginPage from "./pages/auth/LoginPage";
import AppointmentsPage from "./pages/appointments/AppointmentsPage";
import BudgetsPage from "./pages/budgets/BudgetsPage";
import ClientsPage from "./pages/clients/ClientsPage";
import DashboardPage from "./pages/dashboard/DashboardPage";
import FinancePage from "./pages/finance/FinancePage";
import InsurersPage from "./pages/insurers/InsurersPage";
import InventoryPage from "./pages/inventory/InventoryPage";
import UsersPage from "./pages/users/UsersPage";
import VehiclesPage from "./pages/vehicles/VehiclesPage";
import PublicTrackingPage from "./pages/workorders/PublicTrackingPage";
import WorkOrdersPage from "./pages/workorders/WorkOrdersPage";

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (allowedRoles && !allowedRoles.includes(user.rol)) {
    return <Navigate to="/ordenes" replace />;
  }
  return children;
};

const HomeRedirect = () => {
  const { user } = useAuth();
  if (user?.rol === "administrador" || user?.rol === "administrativo") {
    return <Navigate to="/dashboard" replace />;
  }
  return <Navigate to="/ordenes" replace />;
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/seguimiento" element={<PublicTrackingPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<HomeRedirect />} />
            <Route
              path="dashboard"
              element={
                <ProtectedRoute allowedRoles={["administrador", "administrativo"]}>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route path="ordenes" element={<WorkOrdersPage />} />
            <Route path="turnos" element={<AppointmentsPage />} />
            <Route path="inventario" element={<InventoryPage />} />
            <Route
              path="finanzas"
              element={
                <ProtectedRoute allowedRoles={["administrador", "administrativo"]}>
                  <FinancePage />
                </ProtectedRoute>
              }
            />
            <Route path="clientes" element={<ClientsPage />} />
            <Route path="vehiculos" element={<VehiclesPage />} />
            <Route
              path="aseguradoras"
              element={
                <ProtectedRoute allowedRoles={["administrador", "administrativo"]}>
                  <InsurersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="presupuestos"
              element={
                <ProtectedRoute allowedRoles={["administrador", "administrativo"]}>
                  <BudgetsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="usuarios"
              element={
                <ProtectedRoute allowedRoles={["administrador"]}>
                  <UsersPage />
                </ProtectedRoute>
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
