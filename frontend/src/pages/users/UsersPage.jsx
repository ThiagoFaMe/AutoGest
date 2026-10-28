import React, { useEffect, useState } from "react";
import {
  createUsuario,
  getUsuarios,
  unlockUsuario,
  updateUsuario,
} from "../../api/usersApi";

const INITIAL_FORM = {
  nombre_completo: "",
  email: "",
  password: "",
  rol: "operario",
  activo: true,
};

export default function UsersPage() {
  const [usuarios, setUsuarios] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [formError, setFormError] = useState("");
  const [feedback, setFeedback] = useState("");

  const fetchList = async (query = "") => {
    setLoading(true);
    try {
      const data = await getUsuarios(query ? { search: query } : {});
      setUsuarios(data);
    } catch (err) {
      setFormError("No se pudo cargar el padrón de usuarios.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, []);

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData(INITIAL_FORM);
    setFormError("");
    setShowModal(true);
  };

  const handleOpenEdit = (u) => {
    setEditingId(u.id_usuario);
    setFormData({
      nombre_completo: u.nombre_completo,
      email: u.email,
      password: "",
      rol: u.rol,
      activo: u.activo,
    });
    setFormError("");
    setShowModal(true);
  };

  const handleUnlock = async (u) => {
    try {
      const res = await unlockUsuario(u.id_usuario);
      setFeedback(res.detail);
      fetchList(search);
    } catch {
      setFormError("Error al desbloquear la cuenta.");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    try {
      const payload = { ...formData };
      if (editingId && !payload.password) {
        delete payload.password;
      }
      if (editingId) {
        await updateUsuario(editingId, payload);
        setFeedback("Usuario actualizado correctamente.");
      } else {
        await createUsuario(payload);
        setFeedback("Nuevo usuario registrado con contraseña encriptada (Bcrypt).");
      }
      setShowModal(false);
      fetchList(search);
    } catch (err) {
      const data = err.response?.data;
      if (data) {
        const messages = Object.entries(data)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(" ") : v}`)
          .join(" | ");
        setFormError(messages);
      } else {
        setFormError("Error al guardar el usuario.");
      }
    }
  };

  // Verificador visual en tiempo real de las 5 reglas de contraseña (HU-001 Criterio 2)
  const pwd = formData.password || "";
  const pwdRules = [
    { label: "Mínimo 8 caracteres", ok: pwd.length >= 8 },
    { label: "Una letra mayúscula (A-Z)", ok: /[A-Z]/.test(pwd) },
    { label: "Una letra minúscula (a-z)", ok: /[a-z]/.test(pwd) },
    { label: "Un dígito numérico (0-9)", ok: /\d/.test(pwd) },
    { label: "Un carácter especial (@, #, $, %, !, *)", ok: /[^A-Za-z0-9]/.test(pwd) },
  ];

  return (
    <div>
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-2">
        <div>
          <h4 className="fw-bold mb-1">
            <i className="bi bi-person-lock text-primary me-2"></i>
            Gestión de Usuarios y Roles (HU-001)
          </h4>
          <p className="text-muted small mb-0">
            Control de acceso basado en roles (RBAC), políticas de complejidad de clave y desbloqueo de cuentas.
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenCreate}>
          <i className="bi bi-person-plus-fill me-2"></i>
          Nuevo Usuario
        </button>
      </div>

      {feedback && (
        <div className="alert alert-success alert-dismissible fade show small" role="alert">
          <i className="bi bi-check-circle-fill me-2"></i>
          {feedback}
          <button type="button" className="btn-close" onClick={() => setFeedback("")}></button>
        </div>
      )}

      <div className="card card-stat mb-4">
        <div className="card-body">
          <div className="row g-2 align-items-center mb-3">
            <div className="col-md-6">
              <div className="input-group">
                <span className="input-group-text bg-white">
                  <i className="bi bi-search"></i>
                </span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Buscar por nombre o correo electrónico..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    fetchList(e.target.value);
                  }}
                />
              </div>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>ID</th>
                  <th>Nombre Completo</th>
                  <th>Correo (Login)</th>
                  <th>Perfil RBAC</th>
                  <th>Seguridad / Intentos</th>
                  <th>Estado</th>
                  <th className="text-end">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="text-center py-4 text-muted">
                      Cargando usuarios...
                    </td>
                  </tr>
                ) : usuarios.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-4 text-muted">
                      No se encontraron usuarios registrados.
                    </td>
                  </tr>
                ) : (
                  usuarios.map((u) => (
                    <tr key={u.id_usuario}>
                      <td className="text-muted">#{u.id_usuario}</td>
                      <td className="fw-semibold">{u.nombre_completo}</td>
                      <td>{u.email}</td>
                      <td>
                        <span
                          className={`badge ${
                            u.rol === "administrador"
                              ? "bg-primary"
                              : u.rol === "administrativo"
                              ? "bg-info text-dark"
                              : "bg-warning text-dark"
                          }`}
                        >
                          {u.rol.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        {u.esta_bloqueado ? (
                          <span className="badge bg-danger">
                            <i className="bi bi-lock-fill me-1"></i>
                            Bloqueado ({u.intentos_fallidos}/5 fallos)
                          </span>
                        ) : (
                          <span className="text-muted small">
                            Intentos fallidos: {u.intentos_fallidos}/5
                          </span>
                        )}
                      </td>
                      <td>
                        {u.activo ? (
                          <span className="badge bg-success-subtle text-success">Activo</span>
                        ) : (
                          <span className="badge bg-secondary">Inactivo</span>
                        )}
                      </td>
                      <td className="text-end">
                        {u.esta_bloqueado && (
                          <button
                            className="btn btn-sm btn-warning me-2"
                            onClick={() => handleUnlock(u)}
                            title="Restablecer contador de intentos fallidos"
                          >
                            <i className="bi bi-unlock-fill me-1"></i>
                            Desbloquear
                          </button>
                        )}
                        <button
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => handleOpenEdit(u)}
                        >
                          <i className="bi bi-pencil-square me-1"></i>
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal de Alta / Edición */}
      {showModal && (
        <div className="modal d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header">
                <h5 className="modal-title fw-bold">
                  {editingId ? "Editar Usuario" : "Alta de Usuario del Taller"}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowModal(false)}
                ></button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  {formError && (
                    <div className="alert alert-danger small">{formError}</div>
                  )}

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Nombre y Apellido *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.nombre_completo}
                      onChange={(e) =>
                        setFormData({ ...formData, nombre_completo: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">
                      Correo Electrónico (Único) *
                    </label>
                    <input
                      type="email"
                      className="form-control"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Perfil / Rol (RBAC) *</label>
                    <select
                      className="form-select"
                      value={formData.rol}
                      onChange={(e) => setFormData({ ...formData, rol: e.target.value })}
                    >
                      <option value="administrador">
                        Administrador (Dueño - Acceso Total y KPIs)
                      </option>
                      <option value="administrativo">
                        Administrativo (Oficina - Presupuestos, Clientes, Stock, Cobros)
                      </option>
                      <option value="operario">
                        Operario (Galpón - Fases de Taller y Consumo de Insumos)
                      </option>
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">
                      {editingId
                        ? "Nueva Contraseña (dejar en blanco para mantener la actual)"
                        : "Contraseña *"}
                    </label>
                    <input
                      type="password"
                      className="form-control"
                      value={formData.password}
                      onChange={(e) =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                      required={!editingId}
                    />
                    <div className="mt-2 p-2 bg-light rounded border small">
                      <div className="fw-semibold text-muted mb-1">
                        Política de complejidad (HU-001):
                      </div>
                      {pwdRules.map((r, idx) => (
                        <div
                          key={idx}
                          className={
                            r.ok ? "text-success fw-medium" : "text-secondary"
                          }
                        >
                          <i
                            className={`bi ${
                              r.ok ? "bi-check-circle-fill" : "bi-circle"
                            } me-1`}
                          ></i>
                          {r.label}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="form-check form-switch">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="usuarioActivoSwitch"
                      checked={formData.activo}
                      onChange={(e) =>
                        setFormData({ ...formData, activo: e.target.checked })
                      }
                    />
                    <label className="form-check-label small" htmlFor="usuarioActivoSwitch">
                      Cuenta habilitada para iniciar sesión
                    </label>
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setShowModal(false)}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Guardar Usuario
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
