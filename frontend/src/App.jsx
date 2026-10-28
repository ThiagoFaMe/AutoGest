import React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import MainLayout from "./layouts/MainLayout";
import LoginPage from "./pages/auth/LoginPage";
import ClientsPage from "./pages/clients/ClientsPage";
import InsurersPage from "./pages/insurers/InsurersPage";
import UsersPage from "./pages/users/UsersPage";
import VehiclesPage from "./pages/vehicles/VehiclesPage";

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (allowedRoles && !allowedRoles.includes(user.rol)) {
    return <Navigate to="/clientes" replace />;
  }
  return children;
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/clientes" replace />} />
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
