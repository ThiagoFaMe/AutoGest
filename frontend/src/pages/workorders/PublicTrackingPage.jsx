import React, { useState } from "react";
import { Link } from "react-router-dom";
import { consultarSeguimientoPublico } from "../../api/workordersApi";

const formatDateShort = (dateStr) => {
  if (!dateStr) return "—";
  const parts = String(dateStr).split("T")[0].split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
};

export default function PublicTrackingPage() {
  const [codigo, setCodigo] = useState("OT-2026-001");
  const [orden, setOrden] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!codigo.trim()) return;
    setLoading(true);
    setErrorMsg("");
    setOrden(null);
    try {
      const data = await consultarSeguimientoPublico(codigo);
      setOrden(data);
    } catch (err) {
      setErrorMsg(
        err.response?.data?.detail ||
          "No se encontró ninguna Orden de Trabajo con ese código o patente."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-vh-100 bg-dark text-white py-5 px-3">
      <div className="container" style={{ maxWidth: "820px" }}>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div className="d-flex align-items-center gap-2">
            <div className="bg-primary text-white rounded-3 p-2">
              <i className="bi bi-car-front-fill fs-4"></i>
            </div>
            <div>
              <h4 className="mb-0 fw-bold">SERGIO Carrocería y Pintura</h4>
              <small className="text-secondary">
                Boedo 1627 esq. Agustín Garzón • Consulta de Estado de Reparación
              </small>
            </div>
          </div>

          <Link to="/login" className="btn btn-outline-light btn-sm">
            <i className="bi bi-box-arrow-in-right me-1"></i>
            Acceso Personal del Taller
          </Link>
        </div>

        {/* Buscador por Código o Patente */}
        <div className="card border-0 shadow-lg text-dark mb-4">
          <div className="card-body p-4">
            <h5 className="fw-bold mb-2">
              Consultá el avance de tu vehículo en tiempo real
            </h5>
            <p className="text-muted small mb-3">
              Ingresá tu código de seguimiento (ej: <code>OT-2026-001</code>) o el
              dominio/patente de tu vehículo (ej: <code>AF784KL</code> o{" "}
              <code>AD309TR</code>).
            </p>

            <form onSubmit={handleSearch} className="d-flex gap-2">
              <input
                type="text"
                className="form-control form-control-lg text-uppercase fw-bold"
                placeholder="Código OT o Patente (ej: OT-2026-001 o AF784KL)"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                required
              />
              <button
                type="submit"
                className="btn btn-primary btn-lg px-4 fw-semibold"
                disabled={loading}
              >
                {loading ? "Buscando..." : "Consultar"}
              </button>
            </form>

            <div className="mt-2 small text-muted">
              Accesos rápidos de demostración:{" "}
              <button
                type="button"
                className="btn btn-link btn-sm p-0 me-2"
                onClick={() => setCodigo("OT-2026-001")}
              >
                OT-2026-001 (AF784KL)
              </button>
              <button
                type="button"
                className="btn btn-link btn-sm p-0"
                onClick={() => setCodigo("OT-2026-002")}
              >
                OT-2026-002 (AD309TR)
              </button>
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="alert alert-danger shadow-sm">{errorMsg}</div>
        )}

        {orden && (
          <div className="card border-0 shadow-lg text-dark">
            <div className="card-header bg-primary text-white py-3 d-flex justify-content-between align-items-center">
              <div>
                <span className="badge bg-dark me-2">
                  {orden.codigo_seguimiento}
                </span>
                <strong className="fs-5">
                  {orden.vehiculo_patente} — {orden.vehiculo_descripcion} (
                  {orden.vehiculo_color})
                </strong>
              </div>
              <span className="badge bg-light text-primary fs-6">
                {orden.progreso_porcentaje}% Completado
              </span>
            </div>

            <div className="card-body p-4">
              <div className="row g-3 mb-4">
                <div className="col-md-4">
                  <div className="p-3 rounded bg-light border">
                    <div className="small text-muted">Etapa Actual en Taller</div>
                    <div className="fw-bold text-primary fs-5">
                      {orden.estado_actual}
                    </div>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="p-3 rounded bg-light border">
                    <div className="small text-muted">Fecha de Ingreso</div>
                    <div className="fw-bold fs-5">
                      {formatDateShort(orden.fecha_ingreso)}
                    </div>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="p-3 rounded bg-light border">
                    <div className="small text-muted">Entrega Estimada</div>
                    <div className="fw-bold fs-5">
                      {formatDateShort(orden.fecha_estimada_entrega)}
                    </div>
                  </div>
                </div>
              </div>

              <h6 className="fw-bold text-uppercase text-secondary small mb-3">
                Progreso por Etapas de Reparación
              </h6>

              <div className="list-group">
                {(orden.fases || []).map((fase) => (
                  <div
                    key={fase.orden_secuencia}
                    className="list-group-item d-flex justify-content-between align-items-center py-3"
                  >
                    <div className="d-flex align-items-center gap-3">
                      <span
                        className={`badge rounded-pill ${
                          fase.estado === "completada"
                            ? "bg-success"
                            : fase.estado === "en_curso"
                            ? "bg-primary"
                            : "bg-secondary"
                        }`}
                      >
                        {fase.orden_secuencia}
                      </span>
                      <span className="fw-semibold">{fase.nombre_fase}</span>
                    </div>

                    <span
                      className={`badge ${
                        fase.estado === "completada"
                          ? "bg-success-subtle text-success border border-success-subtle"
                          : fase.estado === "en_curso"
                          ? "bg-primary"
                          : "bg-light text-muted border"
                      }`}
                    >
                      {fase.estado === "completada"
                        ? "Finalizada"
                        : fase.estado === "en_curso"
                        ? "En Proceso Ahora"
                        : "Pendiente"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
