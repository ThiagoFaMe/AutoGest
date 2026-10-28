import React, { useEffect, useState } from "react";
import { createCliente, getClientes, updateCliente } from "../../api/coreApi";
import { useAuth } from "../../context/AuthContext";

const INITIAL_CLIENT = {
  dni: "",
  nombre: "",
  apellido: "",
  telefono: "",
  email: "",
  direccion: "",
  activo: true,
};

export default function ClientsPage() {
  const { user } = useAuth();
  const canEdit = user?.rol === "administrador" || user?.rol === "administrativo";

  const [clientes, setClientes] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(INITIAL_CLIENT);
  const [formError, setFormError] = useState("");
  const [existingDuplicate, setExistingDuplicate] = useState(null);
  const [feedback, setFeedback] = useState("");

  const fetchClientes = async (query = "") => {
    setLoading(true);
    try {
      // HU-002 Criterio 3: Búsqueda rápida al ingresar al menos 3 caracteres (o vacío para listar todos)
      const params = query.trim().length >= 3 ? { search: query.trim() } : {};
      const data = await getClientes(params);
      setClientes(data);
    } catch {
      setFormError("Error al cargar el padrón de clientes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClientes();
  }, []);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearch(val);
    if (val.trim().length === 0 || val.trim().length >= 3) {
      fetchClientes(val);
    }
  };

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData(INITIAL_CLIENT);
    setFormError("");
    setExistingDuplicate(null);
    setShowModal(true);
  };

  const handleOpenEdit = (cliente) => {
    setEditingId(cliente.id_cliente);
    setFormData({
      dni: cliente.dni,
      nombre: cliente.nombre,
      apellido: cliente.apellido,
      telefono: cliente.telefono,
      email: cliente.email || "",
      direccion: cliente.direccion || "",
      activo: cliente.activo,
    });
    setFormError("");
    setExistingDuplicate(null);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setExistingDuplicate(null);
    try {
      if (editingId) {
        await updateCliente(editingId, formData);
        setFeedback("Ficha de cliente actualizada exitosamente.");
      } else {
        await createCliente(formData);
        setFeedback("Nuevo cliente registrado exitosamente en el padrón.");
      }
      setShowModal(false);
      fetchClientes(search);
    } catch (err) {
      const data = err.response?.data;
      if (data?.ficha_existente) {
        // HU-002 Criterio 1: Mostrar ficha existente y ofrecer editar sus datos de contacto
        setExistingDuplicate(data.ficha_existente);
        setFormError(
          Array.isArray(data.dni) ? data.dni[0] : data.dni || "El DNI ya existe."
        );
      } else if (data) {
        const msg = Object.entries(data)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(" ") : v}`)
          .join(" | ");
        setFormError(msg);
      } else {
        setFormError("Ocurrió un error al guardar el cliente.");
      }
    }
  };

  return (
    <div>
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-2">
        <div>
          <h4 className="fw-bold mb-1">
            <i className="bi bi-people-fill text-primary me-2"></i>
            Padrón de Clientes del Taller (HU-002)
          </h4>
          <p className="text-muted small mb-0">
            Base única e indexada por DNI, apellido y teléfono para confección de presupuestos y aviso de entregas.
          </p>
        </div>
        {canEdit && (
          <button className="btn btn-primary" onClick={handleOpenCreate}>
            <i className="bi bi-person-plus-fill me-2"></i>
            Registrar Cliente
          </button>
        )}
      </div>

      {feedback && (
        <div className="alert alert-success alert-dismissible fade show small">
          <i className="bi bi-check-circle-fill me-2"></i>
          {feedback}
          <button type="button" className="btn-close" onClick={() => setFeedback("")}></button>
        </div>
      )}

      <div className="card card-stat">
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
                  placeholder="Buscar por DNI, apellido o teléfono (mín. 3 caracteres)..."
                  value={search}
                  onChange={handleSearchChange}
                />
              </div>
            </div>
            <div className="col-md-6 text-md-end text-muted small">
              Total registrados: <strong>{clientes.length}</strong> cliente(s)
            </div>
          </div>

          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>DNI / CUIT</th>
                  <th>Apellido y Nombre</th>
                  <th>Teléfono / WhatsApp</th>
                  <th>Correo Electrónico</th>
                  <th>Vehículos Asociados</th>
                  <th>Estado</th>
                  {canEdit && <th className="text-end">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="text-center py-4 text-muted">
                      Cargando clientes...
                    </td>
                  </tr>
                ) : clientes.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-4 text-muted">
                      No se encontraron clientes con ese criterio.
                    </td>
                  </tr>
                ) : (
                  clientes.map((c) => (
                    <tr key={c.id_cliente}>
                      <td className="fw-bold text-secondary">{c.dni}</td>
                      <td>
                        <div className="fw-semibold">
                          {c.apellido}, {c.nombre}
                        </div>
                        {c.direccion && (
                          <div className="small text-muted">
                            <i className="bi bi-geo-alt me-1"></i>
                            {c.direccion}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className="badge bg-light text-dark border">
                          <i className="bi bi-whatsapp text-success me-1"></i>
                          {c.telefono}
                        </span>
                      </td>
                      <td className="small">{c.email || "—"}</td>
                      <td>
                        {c.vehiculos && c.vehiculos.length > 0 ? (
                          <div className="d-flex flex-wrap gap-1">
                            {c.vehiculos.map((v) => (
                              <span
                                key={v.id_vehiculo}
                                className="patente-badge small"
                                title={`${v.marca} ${v.modelo} (${v.anio})`}
                              >
                                {v.patente}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted small">Sin vehículos</span>
                        )}
                      </td>
                      <td>
                        {c.activo ? (
                          <span className="badge bg-success-subtle text-success">Activo</span>
                        ) : (
                          <span className="badge bg-secondary">Inactivo</span>
                        )}
                      </td>
                      {canEdit && (
                        <td className="text-end">
                          <button
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => handleOpenEdit(c)}
                          >
                            <i className="bi bi-pencil-square me-1"></i>
                            Editar
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal de Alta / Edición de Cliente */}
      {showModal && (
        <div className="modal d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header">
                <h5 className="modal-title fw-bold">
                  {editingId ? "Editar Ficha de Cliente" : "Registrar Nuevo Cliente"}
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

                  {/* Tarjeta interactiva para HU-002 Criterio 1: DNI duplicado muestra ficha existente */}
                  {existingDuplicate && (
                    <div className="alert alert-warning border border-warning small">
                      <div className="fw-bold mb-1">
                        <i className="bi bi-person-badge-fill me-1"></i>
                        Ficha Existente Detectada (HU-002 Criterio 1):
                      </div>
                      <div>
                        <strong>Cliente:</strong> {existingDuplicate.apellido},{" "}
                        {existingDuplicate.nombre} (DNI: {existingDuplicate.dni})
                      </div>
                      <div>
                        <strong>Teléfono:</strong> {existingDuplicate.telefono} |{" "}
                        <strong>Dirección:</strong> {existingDuplicate.direccion || "—"}
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm btn-warning mt-2 fw-semibold"
                        onClick={() => handleOpenEdit(existingDuplicate)}
                      >
                        <i className="bi bi-pencil-fill me-1"></i>
                        Editar esta ficha existente
                      </button>
                    </div>
                  )}

                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">DNI / CUIT *</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Ej.: 32458910"
                        value={formData.dni}
                        onChange={(e) => setFormData({ ...formData, dni: e.target.value })}
                        required
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">
                        Teléfono / WhatsApp *
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Ej.: 351-6124890"
                        value={formData.telefono}
                        onChange={(e) =>
                          setFormData({ ...formData, telefono: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Apellido *</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.apellido}
                        onChange={(e) =>
                          setFormData({ ...formData, apellido: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Nombre *</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.nombre}
                        onChange={(e) =>
                          setFormData({ ...formData, nombre: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="col-12">
                      <label className="form-label small fw-semibold">
                        Correo Electrónico (Opcional)
                      </label>
                      <input
                        type="email"
                        className="form-control"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                      />
                    </div>
                    <div className="col-12">
                      <label className="form-label small fw-semibold">
                        Domicilio Particular
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Calle, número y barrio"
                        value={formData.direccion}
                        onChange={(e) =>
                          setFormData({ ...formData, direccion: e.target.value })
                        }
                      />
                    </div>
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
                    Guardar Cliente
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
