import React, { useEffect, useState } from "react";
import {
  createVehiculo,
  getClientes,
  getVehiculos,
  updateVehiculo,
} from "../../api/coreApi";
import { useAuth } from "../../context/AuthContext";

const INITIAL_VEHICLE = {
  patente: "",
  marca: "",
  modelo: "",
  anio: new Date().getFullYear(),
  color: "",
  id_cliente: "",
};

export default function VehiclesPage() {
  const { user } = useAuth();
  const canEdit = user?.rol === "administrador" || user?.rol === "administrativo";

  const [vehiculos, setVehiculos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(INITIAL_VEHICLE);
  const [formError, setFormError] = useState("");
  const [existingVehicle, setExistingVehicle] = useState(null);
  const [feedback, setFeedback] = useState("");

  const fetchData = async (query = "") => {
    setLoading(true);
    try {
      const [vehData, cliData] = await Promise.all([
        getVehiculos(query ? { search: query } : {}),
        getClientes({ activo: true }),
      ]);
      setVehiculos(vehData);
      setClientes(cliData);
    } catch {
      setFormError("Error al cargar el padrón de vehículos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData({
      ...INITIAL_VEHICLE,
      id_cliente: clientes.length > 0 ? clientes[0].id_cliente : "",
    });
    setFormError("");
    setExistingVehicle(null);
    setShowModal(true);
  };

  const handleOpenEdit = (v) => {
    setEditingId(v.id_vehiculo);
    setFormData({
      patente: v.patente,
      marca: v.marca,
      modelo: v.modelo,
      anio: v.anio,
      color: v.color,
      id_cliente: v.id_cliente,
    });
    setFormError("");
    setExistingVehicle(null);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setExistingVehicle(null);
    try {
      const payload = {
        ...formData,
        patente: formData.patente.toUpperCase().replace(/[\s-]/g, ""),
        anio: Number(formData.anio),
        id_cliente: Number(formData.id_cliente),
      };
      if (editingId) {
        await updateVehiculo(editingId, payload);
        setFeedback("Datos del vehículo actualizados correctamente.");
      } else {
        await createVehiculo(payload);
        setFeedback("Vehículo registrado y vinculado al propietario exitosamente.");
      }
      setShowModal(false);
      fetchData(search);
    } catch (err) {
      const data = err.response?.data;
      if (data?.vehiculo_existente) {
        // HU-003 Criterio 1: Rechazar duplicación y mostrar el vehículo existente con su historial
        setExistingVehicle(data.vehiculo_existente);
        setFormError(
          Array.isArray(data.patente) ? data.patente[0] : data.patente
        );
      } else if (data) {
        const msg = Object.entries(data)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(" ") : v}`)
          .join(" | ");
        setFormError(msg);
      } else {
        setFormError("Error al guardar el vehículo.");
      }
    }
  };

  return (
    <div>
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-2">
        <div>
          <h4 className="fw-bold mb-1">
            <i className="bi bi-truck-front-fill text-primary me-2"></i>
            Padrón de Vehículos y Código Colorimétrico (HU-003)
          </h4>
          <p className="text-muted small mb-0">
            Control de unicidad por dominio (Mercosur AA123BB / Tradicional ABC123) y trazabilidad por unidad.
          </p>
        </div>
        {canEdit && (
          <button className="btn btn-primary" onClick={handleOpenCreate}>
            <i className="bi bi-plus-circle-fill me-2"></i>
            Registrar Vehículo
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
                  placeholder="Buscar por patente, marca, modelo o apellido del propietario..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    fetchData(e.target.value);
                  }}
                />
              </div>
            </div>
            <div className="col-md-6 text-md-end text-muted small">
              Unidades registradas: <strong>{vehiculos.length}</strong>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Dominio (Patente)</th>
                  <th>Marca y Modelo</th>
                  <th>Año</th>
                  <th>Color / Código Pintura</th>
                  <th>Cliente Titular</th>
                  {canEdit && <th className="text-end">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6" className="text-center py-4 text-muted">
                      Cargando vehículos...
                    </td>
                  </tr>
                ) : vehiculos.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-4 text-muted">
                      No se encontraron vehículos registrados.
                    </td>
                  </tr>
                ) : (
                  vehiculos.map((v) => (
                    <tr key={v.id_vehiculo}>
                      <td>
                        <span className="patente-badge">{v.patente}</span>
                      </td>
                      <td>
                        <div className="fw-semibold">{v.marca}</div>
                        <div className="small text-muted">{v.modelo}</div>
                      </td>
                      <td>{v.anio}</td>
                      <td>
                        <span className="badge bg-light text-dark border">
                          <i className="bi bi-palette-fill text-primary me-1"></i>
                          {v.color}
                        </span>
                      </td>
                      <td>
                        <div className="fw-medium">{v.cliente_nombre}</div>
                        <div className="small text-muted">
                          DNI: {v.cliente_dni} • Tel: {v.cliente_telefono}
                        </div>
                      </td>
                      {canEdit && (
                        <td className="text-end">
                          <button
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => handleOpenEdit(v)}
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

      {/* Modal de Alta / Edición de Vehículo */}
      {showModal && (
        <div className="modal d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header">
                <h5 className="modal-title fw-bold">
                  {editingId ? "Editar Vehículo" : "Registrar Nuevo Vehículo"}
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

                  {/* Tarjeta para HU-003 Criterio 1: Vehículo existente detectado */}
                  {existingVehicle && (
                    <div className="alert alert-warning border border-warning small">
                      <div className="fw-bold mb-1">
                        <i className="bi bi-car-front-fill me-1"></i>
                        Vehículo Existente en el Padrón (HU-003 Criterio 1):
                      </div>
                      <div>
                        <strong>Unidad:</strong> {existingVehicle.patente} —{" "}
                        {existingVehicle.marca} {existingVehicle.modelo} (
                        {existingVehicle.anio})
                      </div>
                      <div>
                        <strong>Color:</strong> {existingVehicle.color} |{" "}
                        <strong>Propietario:</strong> {existingVehicle.cliente_nombre}
                      </div>
                      <div className="mt-1">
                        <strong>Historial de Órdenes:</strong>{" "}
                        {existingVehicle.historial_ordenes?.length || 0} orden(es) registrada(s)
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm btn-warning mt-2 fw-semibold"
                        onClick={() => handleOpenEdit(existingVehicle)}
                      >
                        <i className="bi bi-pencil-fill me-1"></i>
                        Abrir y editar este vehículo
                      </button>
                    </div>
                  )}

                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">
                        Patente / Dominio *
                      </label>
                      <input
                        type="text"
                        className="form-control text-uppercase fw-bold"
                        placeholder="AA123BB o ABC123"
                        value={formData.patente}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            patente: e.target.value.toUpperCase(),
                          })
                        }
                        required
                      />
                      <div className="form-text">
                        Se normaliza en mayúsculas sin espacios ni guiones.
                      </div>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">
                        Año de Fabricación *
                      </label>
                      <input
                        type="number"
                        className="form-control"
                        min="1950"
                        max="2027"
                        value={formData.anio}
                        onChange={(e) =>
                          setFormData({ ...formData, anio: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Marca *</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Ej.: Volkswagen, Toyota, Ford"
                        value={formData.marca}
                        onChange={(e) =>
                          setFormData({ ...formData, marca: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">
                        Modelo y Versión *
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Ej.: Amarok V6 Highline"
                        value={formData.modelo}
                        onChange={(e) =>
                          setFormData({ ...formData, modelo: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="col-12">
                      <label className="form-label small fw-semibold">
                        Color y Código Colorimétrico (Laboratorio Pintura) *
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Ej.: Blanco Perlado (070) / Gris Indium (LR7H)"
                        value={formData.color}
                        onChange={(e) =>
                          setFormData({ ...formData, color: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="col-12">
                      <label className="form-label small fw-semibold">
                        Cliente Titular / Propietario *
                      </label>
                      <select
                        className="form-select"
                        value={formData.id_cliente}
                        onChange={(e) =>
                          setFormData({ ...formData, id_cliente: e.target.value })
                        }
                        required
                      >
                        <option value="">Seleccione un cliente registrado...</option>
                        {clientes.map((c) => (
                          <option key={c.id_cliente} value={c.id_cliente}>
                            {c.apellido}, {c.nombre} — DNI: {c.dni}
                          </option>
                        ))}
                      </select>
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
                    Guardar Vehículo
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
