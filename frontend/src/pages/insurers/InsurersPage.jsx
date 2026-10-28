import React, { useEffect, useState } from "react";
import {
  createAseguradora,
  getAseguradoras,
  updateAseguradora,
} from "../../api/coreApi";

const INITIAL_INSURER = {
  razon_social: "",
  cuit: "",
  plazo_pago_dias: 30,
  telefono: "",
  email_peritos: "",
};

export default function InsurersPage() {
  const [aseguradoras, setAseguradoras] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(INITIAL_INSURER);
  const [formError, setFormError] = useState("");
  const [feedback, setFeedback] = useState("");

  const fetchAseguradoras = async (query = "") => {
    setLoading(true);
    try {
      const data = await getAseguradoras(query ? { search: query } : {});
      setAseguradoras(data);
    } catch {
      setFormError("No se pudo cargar el padrón de compañías aseguradoras.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAseguradoras();
  }, []);

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData(INITIAL_INSURER);
    setFormError("");
    setShowModal(true);
  };

  const handleOpenEdit = (item) => {
    setEditingId(item.id_compania);
    setFormData({
      razon_social: item.razon_social,
      cuit: item.cuit,
      plazo_pago_dias: item.plazo_pago_dias,
      telefono: item.telefono || "",
      email_peritos: item.email_peritos || "",
    });
    setFormError("");
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    try {
      const payload = {
        ...formData,
        plazo_pago_dias: Number(formData.plazo_pago_dias),
      };
      if (editingId) {
        await updateAseguradora(editingId, payload);
        setFeedback("Compañía aseguradora actualizada correctamente.");
      } else {
        await createAseguradora(payload);
        setFeedback("Compañía aseguradora registrada en el padrón.");
      }
      setShowModal(false);
      fetchAseguradoras(search);
    } catch (err) {
      const data = err.response?.data;
      if (data) {
        const msg = Object.entries(data)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(" ") : v}`)
          .join(" | ");
        setFormError(msg);
      } else {
        setFormError("Error al guardar la aseguradora.");
      }
    }
  };

  return (
    <div>
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-2">
        <div>
          <h4 className="fw-bold mb-1">
            <i className="bi bi-shield-check text-primary me-2"></i>
            Compañías Aseguradoras y Plazos de Liquidación (HU-004)
          </h4>
          <p className="text-muted small mb-0">
            Parametrización de CUIT, contacto de peritos y plazo contractual (30, 45 o 60 días) para cálculo automático de vencimientos.
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenCreate}>
          <i className="bi bi-building-add me-2"></i>
          Nueva Aseguradora
        </button>
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
                  placeholder="Buscar por razón social, CUIT o correo de peritos..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    fetchAseguradoras(e.target.value);
                  }}
                />
              </div>
            </div>
            <div className="col-md-6 text-md-end text-muted small">
              Compañías habilitadas: <strong>{aseguradoras.length}</strong>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Razón Social</th>
                  <th>CUIT (Único)</th>
                  <th>Plazo Pactado de Pago</th>
                  <th>Teléfono Siniestros</th>
                  <th>Correo de Peritos / Facturación</th>
                  <th className="text-end">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6" className="text-center py-4 text-muted">
                      Cargando aseguradoras...
                    </td>
                  </tr>
                ) : aseguradoras.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-4 text-muted">
                      No se encontraron compañías aseguradoras.
                    </td>
                  </tr>
                ) : (
                  aseguradoras.map((item) => (
                    <tr key={item.id_compania}>
                      <td className="fw-semibold">{item.razon_social}</td>
                      <td className="text-secondary fw-medium">{item.cuit}</td>
                      <td>
                        <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1">
                          <i className="bi bi-calendar-check me-1"></i>
                          {item.plazo_pago_dias} días corridos
                        </span>
                      </td>
                      <td className="small">{item.telefono || "—"}</td>
                      <td className="small">{item.email_peritos || "—"}</td>
                      <td className="text-end">
                        <button
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => handleOpenEdit(item)}
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

      {/* Modal de Alta / Edición de Aseguradora */}
      {showModal && (
        <div className="modal d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header">
                <h5 className="modal-title fw-bold">
                  {editingId
                    ? "Editar Compañía Aseguradora"
                    : "Registrar Compañía Aseguradora"}
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
                    <label className="form-label small fw-semibold">
                      Razón Social / Denominación Comercial *
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Ej.: Sancor Cooperativa de Seguros Ltda."
                      value={formData.razon_social}
                      onChange={(e) =>
                        setFormData({ ...formData, razon_social: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div className="row g-3 mb-3">
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">
                        CUIT (Único) *
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Ej.: 30-50004946-0"
                        value={formData.cuit}
                        onChange={(e) =>
                          setFormData({ ...formData, cuit: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">
                        Plazo de Pago (1 a 180 días) *
                      </label>
                      <input
                        type="number"
                        className="form-control"
                        min="1"
                        max="180"
                        value={formData.plazo_pago_dias}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            plazo_pago_dias: e.target.value,
                          })
                        }
                        required
                      />
                      <div className="form-text">
                        Habitual: 30, 45 o 60 días corridos.
                      </div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">
                      Teléfono de Siniestros / Administración
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Ej.: 0800-444-2850"
                      value={formData.telefono}
                      onChange={(e) =>
                        setFormData({ ...formData, telefono: e.target.value })
                      }
                    />
                  </div>

                  <div className="mb-2">
                    <label className="form-label small fw-semibold">
                      Correo Electrónico de Peritos / Envío de Facturas
                    </label>
                    <input
                      type="email"
                      className="form-control"
                      placeholder="peritajes@aseguradora.com.ar"
                      value={formData.email_peritos}
                      onChange={(e) =>
                        setFormData({ ...formData, email_peritos: e.target.value })
                      }
                    />
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
                    Guardar Aseguradora
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
