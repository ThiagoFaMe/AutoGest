import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ROLE_LABELS = {
  administrador: { text: "Administrador (Dueño)", badge: "bg-primary" },
  administrativo: { text: "Administrativo (Oficina)", badge: "bg-info text-dark" },
  operario: { text: "Operario de Taller", badge: "bg-warning text-dark" },
};

export default function MainLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const roleMeta = ROLE_LABELS[user?.rol] || { text: user?.rol, badge: "bg-secondary" };

  return (
    <div className="d-flex min-vh-100">
      {/* Sidebar Lateral */}
      <aside className="autogest-sidebar d-flex flex-column p-3">
        <div className="d-flex align-items-center gap-2 px-2 py-3 border-bottom border-secondary border-opacity-25 mb-3">
          <div className="bg-primary text-white rounded-3 p-2 d-flex align-items-center justify-content-center">
            <i className="bi bi-car-front-fill fs-4"></i>
          </div>
          <div>
            <h5 className="mb-0 fw-bold text-white">AutoGest</h5>
            <small className="text-secondary">Taller Sergio • Córdoba</small>
          </div>
        </div>

        <div className="px-2 mb-2 text-uppercase text-secondary small fw-semibold">
          Sprint 1 • Padrones y Acceso
        </div>

        <nav className="nav flex-column gap-1 flex-grow-1">
          <NavLink to="/clientes" className="autogest-nav-link">
            <i className="bi bi-people-fill"></i>
            <span>Clientes (HU-002)</span>
          </NavLink>

          <NavLink to="/vehiculos" className="autogest-nav-link">
            <i className="bi bi-truck-front-fill"></i>
            <span>Vehículos (HU-003)</span>
          </NavLink>

          {(user?.rol === "administrador" || user?.rol === "administrativo") && (
            <>
              <NavLink to="/aseguradoras" className="autogest-nav-link">
                <i className="bi bi-shield-check"></i>
                <span>Aseguradoras (HU-004)</span>
              </NavLink>

              <div className="px-2 mt-3 mb-1 text-uppercase text-secondary small fw-semibold">
                Sprint 2 • Cotización y OT
              </div>
              <NavLink to="/presupuestos" className="autogest-nav-link">
                <i className="bi bi-file-earmark-text-fill"></i>
                <span>Presupuestos (HU-005..007)</span>
              </NavLink>
            </>
          )}

          {user?.rol === "administrador" && (
            <>
              <div className="px-2 mt-3 mb-1 text-uppercase text-secondary small fw-semibold">
                Seguridad RBAC
              </div>
              <NavLink to="/usuarios" className="autogest-nav-link">
                <i className="bi bi-person-lock"></i>
                <span>Usuarios y Roles (HU-001)</span>
              </NavLink>
            </>
          )}
        </nav>

        {/* Tarjeta del usuario activo */}
        <div className="border-top border-secondary border-opacity-25 pt-3 mt-3">
          <div className="px-2 mb-2">
            <div className="fw-semibold text-white text-truncate">{user?.nombre_completo}</div>
            <div className="small text-secondary text-truncate mb-1">{user?.email}</div>
            <span className={`badge ${roleMeta.badge}`}>{roleMeta.text}</span>
          </div>
          <button
            onClick={handleLogout}
            className="btn btn-outline-light btn-sm w-100 mt-2 d-flex align-items-center justify-content-center gap-2"
          >
            <i className="bi bi-box-arrow-right"></i>
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Área Principal */}
      <main className="flex-grow-1 d-flex flex-column">
        <header className="bg-white border-bottom px-4 py-3 d-flex justify-content-between align-items-center">
          <div>
            <span className="text-muted small">
              Sistema de Gestión y Trazabilidad de Chapa y Pintura
            </span>
          </div>
          <div className="d-flex align-items-center gap-3">
            <span className="badge bg-success-subtle text-success border border-success-subtle">
              <i className="bi bi-hdd-network me-1"></i> Servidor Local Activo
            </span>
          </div>
        </header>

        <div className="p-4 flex-grow-1">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
