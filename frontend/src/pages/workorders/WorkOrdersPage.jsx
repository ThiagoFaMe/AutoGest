import React, { useEffect, useState } from "react";
import {
  getOrdenesTrabajo,
  registrarEntregaVehiculo,
} from "../../api/workordersApi";
import { useAuth } from "../../context/AuthContext";
import WorkOrderDetailModal from "./WorkOrderDetailModal";

const formatDateShort = (dateStr) => {
  if (!dateStr) return "—";
  const parts = String(dateStr).split("T")[0].split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
};

export default function WorkOrdersPage() {
  const { user } = useAuth();
  const [ordenes, setOrdenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState("activas"); // "activas" | "retrasadas" | "entregadas" | "todas"
  const [selectedOrden, setSelectedOrden] = useState(null);
  const [deliveringId, setDeliveringId] = useState(null);

  const canRegisterDelivery =
    user?.rol === "administrador" || user?.rol === "administrativo";

  const fetchOrdenes = async () => {
    setLoading(true);
    try {
      const data = await getOrdenesTrabajo();
      setOrdenes(Array.isArray(data) ? data : data.results || []);
    } catch (err) {
      console.error("Error cargando órdenes de trabajo:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrdenes();
  }, []);

  const handleOrdenUpdated = (updatedOrden) => {
    setSelectedOrden(updatedOrden);
    setOrdenes((prev) =>
      prev.map((o) =>
        o.id_orden === updatedOrden.id_orden ? updatedOrden : o
      )
    );
  };

  const handleQuickEntrega = async (orden) => {
    if (
      !window.confirm(
        `¿Confirmar la entrega efectiva del vehículo ${orden.vehiculo_patente} (${orden.vehiculo_descripcion}) al cliente ${orden.cliente_nombre}?`
      )
    ) {
      return;
    }
    setDeliveringId(orden.id_orden);
    try {
      const resp = await registrarEntregaVehiculo(orden.id_orden);
      if (resp?.orden) {
        setOrdenes((prev) =>
          prev.map((o) => (o.id_orden === resp.orden.id_orden ? resp.orden : o))
        );
      } else {
        fetchOrdenes();
      }
    } catch (err) {
      alert(
        err.response?.data?.detail ||
          "No se pudo registrar la entrega del vehículo."
      );
    } finally {
      setDeliveringId(null);
    }
  };

  const filteredOrdenes = ordenes.filter((o) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      o.codigo_seguimiento?.toLowerCase().includes(q) ||
      o.vehiculo_patente?.toLowerCase().includes(q) ||
      o.vehiculo_descripcion?.toLowerCase().includes(q) ||
      o.cliente_nombre?.toLowerCase().includes(q) ||
      o.estado_actual?.toLowerCase().includes(q);

    if (!matchesSearch) return false;
    if (filterMode === "retrasadas") return o.en_retraso === true;
    if (filterMode === "entregadas") return Boolean(o.fecha_entrega_real);
    if (filterMode === "activas") return !o.fecha_entrega_real;
    return true;
  });

  const totalActivas = ordenes.filter((o) => !o.fecha_entrega_real).length;
  const totalRetrasadas = ordenes.filter((o) => o.en_retraso).length;
  const totalListas = ordenes.filter(
    (o) => o.estado_actual === "Lista para entrega" && !o.fecha_entrega_real
  ).length;
  const totalEntregadas = ordenes.filter((o) =>
    Boolean(o.fecha_entrega_real)
  ).length;

  return (
    <div>
      {/* Encabezado de Página */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
        <div>
          <h4 className="fw-bold mb-1">
            <i className="bi bi-wrench-adjustable-circle-fill text-primary me-2"></i>
            Tablero de Órdenes de Trabajo en Planta
          </h4>
          <p className="text-muted small mb-0">
            Seguimiento secuencial de las 8 fases operativas de taller, control de tiempos por etapa y alertas de retraso.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-outline-primary btn-sm"
          onClick={fetchOrdenes}
        >
          <i className="bi bi-arrow-clockwise me-1"></i>
          Actualizar Tablero
        </button>
      </div>

      {/* 4 Indicadores Operativos Rápidos */}
      <div className="row g-3 mb-4">
        <div className="col-sm-6 col-xl-3">
          <div
            className="card border-0 shadow-sm border-start border-primary border-4 h-100"
            role="button"
            onClick={() => setFilterMode("activas")}
          >
            <div className="card-body py-3 d-flex justify-content-between align-items-center">
              <div>
                <div className="text-muted small fw-semibold">
                  UNIDADES EN PLANTA (ACTIVAS)
                </div>
                <div className="fs-3 fw-bold text-dark">{totalActivas}</div>
              </div>
              <i className="bi bi-car-front-fill fs-1 text-primary opacity-50"></i>
            </div>
          </div>
        </div>

        <div className="col-sm-6 col-xl-3">
          <div
            className="card border-0 shadow-sm border-start border-danger border-4 h-100"
            role="button"
            onClick={() => setFilterMode("retrasadas")}
          >
            <div className="card-body py-3 d-flex justify-content-between align-items-center">
              <div>
                <div className="text-muted small fw-semibold">
                  UNIDADES EN RETRASO
                </div>
                <div className="fs-3 fw-bold text-danger">{totalRetrasadas}</div>
              </div>
              <i className="bi bi-alarm-fill fs-1 text-danger opacity-50"></i>
            </div>
          </div>
        </div>

        <div className="col-sm-6 col-xl-3">
          <div className="card border-0 shadow-sm border-start border-success border-4 h-100">
            <div className="card-body py-3 d-flex justify-content-between align-items-center">
              <div>
                <div className="text-muted small fw-semibold">
                  LISTAS PARA ENTREGA
                </div>
                <div className="fs-3 fw-bold text-success">{totalListas}</div>
              </div>
              <i className="bi bi-check2-circle fs-1 text-success opacity-50"></i>
            </div>
          </div>
        </div>

        <div className="col-sm-6 col-xl-3">
          <div
            className="card border-0 shadow-sm border-start border-dark border-4 h-100"
            role="button"
            onClick={() => setFilterMode("entregadas")}
          >
            <div className="card-body py-3 d-flex justify-content-between align-items-center">
              <div>
                <div className="text-muted small fw-semibold">
                  YA ENTREGADAS
                </div>
                <div className="fs-3 fw-bold text-dark">{totalEntregadas}</div>
              </div>
              <i className="bi bi-key-fill fs-1 text-secondary opacity-50"></i>
            </div>
          </div>
        </div>
      </div>

      {/* Barra de Búsqueda y Filtros Táctiles */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body d-flex flex-column flex-md-row gap-3 justify-content-between align-items-md-center">
          <div className="input-group" style={{ maxWidth: "440px" }}>
            <span className="input-group-text bg-white">
              <i className="bi bi-search text-muted"></i>
            </span>
            <input
              type="text"
              className="form-control"
              placeholder="Buscar por patente, código OT, cliente o etapa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="btn-group flex-wrap">
            <button
              type="button"
              className={`btn btn-sm ${
                filterMode === "activas"
                  ? "btn-primary fw-semibold"
                  : "btn-outline-secondary"
              }`}
              onClick={() => setFilterMode("activas")}
            >
              En Planta ({totalActivas})
            </button>
            <button
              type="button"
              className={`btn btn-sm ${
                filterMode === "retrasadas"
                  ? "btn-danger fw-semibold"
                  : "btn-outline-secondary"
              }`}
              onClick={() => setFilterMode("retrasadas")}
            >
              Con Retraso ({totalRetrasadas})
            </button>
            <button
              type="button"
              className={`btn btn-sm ${
                filterMode === "entregadas"
                  ? "btn-success fw-semibold"
                  : "btn-outline-secondary"
              }`}
              onClick={() => setFilterMode("entregadas")}
            >
              Entregadas ({totalEntregadas})
            </button>
            <button
              type="button"
              className={`btn btn-sm ${
                filterMode === "todas"
                  ? "btn-dark fw-semibold"
                  : "btn-outline-secondary"
              }`}
              onClick={() => setFilterMode("todas")}
            >
              Todas ({ordenes.length})
            </button>
          </div>
        </div>
      </div>

      {/* Grilla de Tarjetas Operativas de Taller */}
      {loading ? (
        <div className="text-center py-5 text-muted">
          Cargando órdenes de trabajo en planta...
        </div>
      ) : filteredOrdenes.length === 0 ? (
        <div className="card border-0 shadow-sm">
          <div className="card-body text-center py-5 text-muted">
            No se encontraron órdenes de trabajo con el criterio seleccionado.
          </div>
        </div>
      ) : (
        <div className="row g-3">
          {filteredOrdenes.map((orden) => (
            <div key={orden.id_orden} className="col-md-6 col-xl-4">
              <div
                className={`card h-100 shadow-sm border-0 ${
                  orden.en_retraso
                    ? "border-top border-danger border-4"
                    : orden.fecha_entrega_real
                    ? "border-top border-success border-4"
                    : ""
                }`}
              >
                <div className="card-body d-flex flex-column justify-content-between">
                  <div>
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <div>
                        <span className="badge bg-dark me-2">
                          {orden.codigo_seguimiento}
                        </span>
                        <span
                          className={`badge ${
                            orden.presupuesto_tipo === "aseguradora"
                              ? "bg-info text-dark"
                              : "bg-secondary"
                          }`}
                        >
                          {orden.presupuesto_tipo === "aseguradora"
                            ? `Seguro: ${orden.aseguradora_nombre || "Cía"}`
                            : "Particular"}
                        </span>
                      </div>

                      {orden.fecha_entrega_real ? (
                        <span className="badge bg-success">
                          <i className="bi bi-check2-all me-1"></i>
                          Entregado ({formatDateShort(orden.fecha_entrega_real)})
                        </span>
                      ) : orden.en_retraso ? (
                        <span className="badge bg-danger">
                          <i className="bi bi-exclamation-triangle-fill me-1"></i>
                          +{orden.dias_retraso}d retraso
                        </span>
                      ) : (
                        <span className="badge bg-success-subtle text-success border border-success-subtle">
                          En término
                        </span>
                      )}
                    </div>

                    <h5 className="fw-bold mb-1">
                      {orden.vehiculo_patente} • {orden.vehiculo_descripcion}
                    </h5>
                    <div className="small text-muted mb-3">
                      <i className="bi bi-person me-1"></i>
                      {orden.cliente_nombre} • Color: {orden.vehiculo_color}
                    </div>

                    {/* Fase Activa y Barra de Avance */}
                    <div className="p-2 rounded bg-light border mb-3">
                      <div className="d-flex justify-content-between align-items-center small mb-1">
                        <span className="text-muted">Etapa actual:</span>
                        <span className="fw-bold text-primary">
                          {orden.estado_actual}
                        </span>
                      </div>
                      <div className="progress" style={{ height: "8px" }}>
                        <div
                          className={`progress-bar ${
                            orden.progreso_porcentaje === 100
                              ? "bg-success"
                              : orden.en_retraso
                              ? "bg-danger"
                              : "bg-primary"
                          }`}
                          style={{ width: `${orden.progreso_porcentaje}%` }}
                        ></div>
                      </div>
                      <div className="d-flex justify-content-between small text-muted mt-1">
                        <span>
                          {orden.fases_completadas}/{orden.total_fases} fases
                        </span>
                        <span>{orden.progreso_porcentaje}% completado</span>
                      </div>
                    </div>

                    <div className="d-flex justify-content-between small text-muted mb-3">
                      <span>
                        <i className="bi bi-calendar-check me-1"></i>
                        Ingreso: <strong>{formatDateShort(orden.fecha_ingreso)}</strong>
                      </span>
                      <span className={orden.en_retraso ? "text-danger fw-bold" : ""}>
                        <i className="bi bi-calendar-event me-1"></i>
                        Promesa:{" "}
                        <strong>
                          {formatDateShort(orden.fecha_estimada_entrega)}
                        </strong>
                      </span>
                    </div>
                  </div>

                  <div className="d-flex flex-column gap-2">
                    {orden.estado_actual === "Lista para entrega" &&
                      !orden.fecha_entrega_real &&
                      canRegisterDelivery && (
                        <button
                          type="button"
                          className="btn btn-success w-100 fw-semibold d-flex align-items-center justify-content-center gap-2"
                          disabled={deliveringId === orden.id_orden}
                          onClick={() => handleQuickEntrega(orden)}
                        >
                          <i className="bi bi-key-fill"></i>
                          {deliveringId === orden.id_orden
                            ? "Registrando entrega..."
                            : "Registrar Entrega al Cliente"}
                        </button>
                      )}

                    <button
                      type="button"
                      className="btn btn-primary w-100 fw-semibold d-flex align-items-center justify-content-center gap-2"
                      onClick={() => setSelectedOrden(orden)}
                    >
                      <i className="bi bi-diagram-3-fill"></i>
                      Abrir Línea de Tiempo / Avanzar Etapa
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Línea de Tiempo Secuencial */}
      {selectedOrden && (
        <WorkOrderDetailModal
          orden={selectedOrden}
          onClose={() => setSelectedOrden(null)}
          onUpdated={handleOrdenUpdated}
        />
      )}
    </div>
  );
}
