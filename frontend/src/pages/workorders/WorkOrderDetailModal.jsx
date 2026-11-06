import React, { useEffect, useState } from "react";
import { getInsumos, getMovimientosStock } from "../../api/inventoryApi";
import {
  completarFaseReparacion,
  getOrdenTrabajoById,
  iniciarFaseReparacion,
  registrarEntregaVehiculo,
} from "../../api/workordersApi";
import { useAuth } from "../../context/AuthContext";
import StockConsumptionModal from "../inventory/StockConsumptionModal";

const formatDateTime = (isoString) => {
  if (!isoString) return "—";
  const d = new Date(isoString);
  return d.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDateShort = (dateStr) => {
  if (!dateStr) return "—";
  const parts = String(dateStr).split("T")[0].split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
};

export default function WorkOrderDetailModal({ orden, onClose, onUpdated }) {
  const { user } = useAuth();
  const [observacion, setObservacion] = useState("");
  const [loadingFaseId, setLoadingFaseId] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [consumosOT, setConsumosOT] = useState([]);
  const [insumosCatalogo, setInsumosCatalogo] = useState([]);
  const [showConsumeModal, setShowConsumeModal] = useState(false);

  const loadConsumosOT = async () => {
    if (!orden?.id_orden) return;
    try {
      const [movData, insData] = await Promise.all([
        getMovimientosStock({ id_orden: orden.id_orden }),
        getInsumos(),
      ]);
      setConsumosOT(Array.isArray(movData) ? movData : movData.results || []);
      setInsumosCatalogo(Array.isArray(insData) ? insData : insData.results || []);
    } catch (err) {
      console.error("Error cargando consumos de la OT:", err);
    }
  };

  useEffect(() => {
    loadConsumosOT();
  }, [orden?.id_orden]);

  if (!orden) return null;

  const fases = orden.fases || [];
  const faseEnCurso = fases.find((f) => f.estado === "en_curso");
  const primeraPendiente = fases.find((f) => f.estado === "pendiente");
  const todasCompletadas =
    fases.length > 0 && fases.every((f) => f.estado === "completada");

  const handleIniciarFase = async (numeroSecuencia, nombreFase) => {
    setFeedback(null);
    setLoadingFaseId(numeroSecuencia);
    try {
      const resp = await iniciarFaseReparacion(orden.id_orden, {
        numero_secuencia: numeroSecuencia,
        observaciones: observacion.trim(),
      });
      setObservacion("");
      setFeedback({ type: "success", text: resp.detail || resp.mensaje });
      if (onUpdated) onUpdated(resp.orden);
    } catch (err) {
      const msg =
        err.response?.data?.detail ||
        `No se pudo iniciar la fase "${nombreFase}". Verifique la secuencia.`;
      setFeedback({ type: "danger", text: msg });
    } finally {
      setLoadingFaseId(null);
    }
  };

  const handleCompletarFase = async (numeroSecuencia, nombreFase) => {
    setFeedback(null);
    setLoadingFaseId(numeroSecuencia);
    try {
      const resp = await completarFaseReparacion(orden.id_orden, {
        numero_secuencia: numeroSecuencia,
        observaciones: observacion.trim(),
      });
      setObservacion("");
      setFeedback({ type: "success", text: resp.detail || resp.mensaje });
      if (onUpdated) onUpdated(resp.orden);
    } catch (err) {
      const msg =
        err.response?.data?.detail ||
        `No se pudo completar la fase "${nombreFase}".`;
      setFeedback({ type: "danger", text: msg });
    } finally {
      setLoadingFaseId(null);
    }
  };

  const handleRegistrarEntrega = async () => {
    if (
      !window.confirm(
        `¿Confirmar la entrega efectiva del vehículo ${orden.vehiculo_patente} al cliente ${orden.cliente_nombre}?`
      )
    ) {
      return;
    }
    setFeedback(null);
    setLoadingFaseId("entrega");
    try {
      const resp = await registrarEntregaVehiculo(orden.id_orden);
      setFeedback({ type: "success", text: resp.detail || resp.mensaje });
      if (onUpdated) onUpdated(resp.orden);
    } catch (err) {
      const msg =
        err.response?.data?.detail || "No se pudo registrar la entrega del vehículo.";
      setFeedback({ type: "danger", text: msg });
    } finally {
      setLoadingFaseId(null);
    }
  };

  const canRegisterDelivery =
    user?.rol === "administrador" || user?.rol === "administrativo";

  return (
    <div
      className="modal d-block"
      style={{ backgroundColor: "rgba(15, 23, 42, 0.72)", zIndex: 1055 }}
    >
      <div className="modal-dialog modal-xl modal-dialog-scrollable">
        <div className="modal-content border-0 shadow-lg">
          {/* Encabezado Prototipo 2 */}
          <div className="modal-header bg-dark text-white py-3">
            <div>
              <div className="d-flex align-items-center gap-2">
                <span className="badge bg-primary fs-6">
                  {orden.codigo_seguimiento}
                </span>
                <h5 className="modal-title fw-bold mb-0">
                  {orden.vehiculo_patente} — {orden.vehiculo_descripcion} (
                  {orden.vehiculo_color})
                </h5>
                {orden.en_retraso && (
                  <span className="badge bg-danger ms-2">
                    <i className="bi bi-exclamation-triangle-fill me-1"></i>
                    Retraso: +{orden.dias_retraso} día(s)
                  </span>
                )}
              </div>
              <div className="small text-secondary mt-1">
                Titular: <strong className="text-light">{orden.cliente_nombre}</strong> (DNI{" "}
                {orden.cliente_dni}) • Tel: {orden.cliente_telefono} • Tipo:{" "}
                <span className="text-uppercase fw-semibold text-info">
                  {orden.presupuesto_tipo}
                </span>
                {orden.aseguradora_nombre ? ` (${orden.aseguradora_nombre})` : ""}
              </div>
            </div>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={onClose}
            ></button>
          </div>

          <div className="modal-body p-4 bg-light">
            {/* Banner de Retroalimentación (Éxito o Bloqueo de Secuencia HU-008) */}
            {feedback && (
              <div
                className={`alert alert-${feedback.type} d-flex align-items-center justify-content-between shadow-sm`}
              >
                <div className="d-flex align-items-center gap-2">
                  <i
                    className={`bi ${
                      feedback.type === "success"
                        ? "bi-check-circle-fill"
                        : "bi-shield-exclamation"
                    } fs-5`}
                  ></i>
                  <span>{feedback.text}</span>
                </div>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setFeedback(null)}
                ></button>
              </div>
            )}

            {/* Tarjetas de Resumen Temporal (HU-009) */}
            <div className="row g-3 mb-4">
              <div className="col-md-3">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-body py-2 px-3">
                    <div className="text-muted small">Estado Operativo Actual</div>
                    <div className="fw-bold text-primary fs-6">
                      {orden.estado_actual}
                    </div>
                    <div className="progress mt-2" style={{ height: "6px" }}>
                      <div
                        className={`progress-bar ${
                          orden.progreso_porcentaje === 100
                            ? "bg-success"
                            : "bg-primary"
                        }`}
                        style={{ width: `${orden.progreso_porcentaje}%` }}
                      ></div>
                    </div>
                    <small className="text-muted">
                      {orden.fases_completadas} de {orden.total_fases} etapas de taller (
                      {orden.progreso_porcentaje}%)
                    </small>
                  </div>
                </div>
              </div>

              <div className="col-md-3">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-body py-2 px-3">
                    <div className="text-muted small">Ingreso / Promesa Entrega</div>
                    <div className="fw-semibold">
                      Ing: {formatDateShort(orden.fecha_ingreso)}
                    </div>
                    <div
                      className={`small fw-semibold ${
                        orden.en_retraso ? "text-danger" : "text-secondary"
                      }`}
                    >
                      Est: {formatDateShort(orden.fecha_estimada_entrega)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-md-3">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-body py-2 px-3">
                    <div className="text-muted small">Tiempo Total en Taller</div>
                    <div className="fw-bold fs-5">
                      {orden.dias_ciclo_total} día(s)
                    </div>
                    <small className="text-muted">
                      {orden.fecha_entrega_real
                        ? `Entregado el ${formatDateShort(orden.fecha_entrega_real)}`
                        : "Ciclo abierto en planta"}
                    </small>
                  </div>
                </div>
              </div>

              <div className="col-md-3">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-body py-2 px-3">
                    <div className="text-muted small">Acción Rápida / Entrega</div>
                    {todasCompletadas && !orden.fecha_entrega_real ? (
                      canRegisterDelivery ? (
                        <button
                          type="button"
                          className="btn btn-success btn-sm w-100 mt-1 fw-semibold"
                          disabled={loadingFaseId === "entrega"}
                          onClick={handleRegistrarEntrega}
                        >
                          <i className="bi bi-key-fill me-1"></i>
                          {loadingFaseId === "entrega"
                            ? "Registrando..."
                            : "Registrar Entrega al Cliente"}
                        </button>
                      ) : (
                        <span className="badge bg-success-subtle text-success border mt-1">
                          Lista para que Administración entregue
                        </span>
                      )
                    ) : orden.fecha_entrega_real ? (
                      <span className="badge bg-dark mt-1">
                        <i className="bi bi-check2-all me-1"></i> Vehículo Entregado
                      </span>
                    ) : (
                      <div className="small text-secondary mt-1">
                        Complete las 8 fases de taller para habilitar la entrega.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Panel de Acción Táctil para la Fase Activa (Tablet de Taller) */}
            {!orden.fecha_entrega_real && (faseEnCurso || primeraPendiente) && (
              <div className="card border-primary border-2 shadow-sm mb-4">
                <div className="card-body d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
                  <div className="flex-grow-1">
                    <div className="d-flex align-items-center gap-2 mb-1">
                      <span className="badge bg-primary">
                        PANEL TÁCTIL DE OPERARIO (HU-008)
                      </span>
                      <span className="text-muted small">
                        Responsable que certifica: <strong>{user?.nombre_completo}</strong>
                      </span>
                    </div>
                    <h6 className="fw-bold mb-2">
                      {faseEnCurso
                        ? `Etapa activa en curso: #${faseEnCurso.orden_secuencia} — ${faseEnCurso.nombre_fase}`
                        : `Próxima etapa lista para iniciar: #${primeraPendiente.orden_secuencia} — ${primeraPendiente.nombre_fase}`}
                    </h6>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="Observación técnica de la etapa (opcional, ej: 'Cabina de pintura a 60°C, 2 manos bicapa')..."
                      value={observacion}
                      onChange={(e) => setObservacion(e.target.value)}
                    />
                  </div>

                  <div className="d-flex gap-2">
                    {faseEnCurso ? (
                      <button
                        type="button"
                        className="btn btn-success px-4 py-2 fw-bold shadow-sm"
                        disabled={loadingFaseId === faseEnCurso.numero_secuencia}
                        onClick={() =>
                          handleCompletarFase(
                            faseEnCurso.numero_secuencia,
                            faseEnCurso.nombre_fase
                          )
                        }
                      >
                        <i className="bi bi-check2-circle me-2 fs-5"></i>
                        {loadingFaseId === faseEnCurso.numero_secuencia
                          ? "Certificando..."
                          : `Finalizar ${faseEnCurso.nombre_fase}`}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-primary px-4 py-2 fw-bold shadow-sm"
                        disabled={loadingFaseId === primeraPendiente.numero_secuencia}
                        onClick={() =>
                          handleIniciarFase(
                            primeraPendiente.numero_secuencia,
                            primeraPendiente.nombre_fase
                          )
                        }
                      >
                        <i className="bi bi-play-circle-fill me-2 fs-5"></i>
                        {loadingFaseId === primeraPendiente.numero_secuencia
                          ? "Iniciando..."
                          : `Iniciar ${primeraPendiente.nombre_fase}`}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Línea de Tiempo Secuencial de 10 Etapas (2 Administrativas + 8 de Taller) */}
            <h6 className="fw-bold text-uppercase text-secondary small mb-3">
              <i className="bi bi-diagram-3-fill me-1"></i>
              Línea de Tiempo Secuencial del Ciclo de Reparación (Prototipo 2 — 10 Fases)
            </h6>

            <div className="d-flex flex-column gap-2">
              {/* Etapas Administrativas Previas (Certificadas en Sprint 2) */}
              <div className="card border-0 shadow-sm bg-white border-start border-success border-4">
                <div className="card-body py-2 px-3 d-flex justify-content-between align-items-center">
                  <div className="d-flex align-items-center gap-3">
                    <span className="badge rounded-pill bg-success">
                      <i className="bi bi-check-lg"></i> Previa 1 y 2
                    </span>
                    <div>
                      <div className="fw-bold text-dark">
                        Armado de Presupuesto y Aprobación Comercial (#
                        {orden.id_presupuesto})
                      </div>
                      <div className="small text-muted">
                        Presupuesto aprobado y Orden de Trabajo generada el{" "}
                        {formatDateShort(orden.fecha_ingreso)}
                      </div>
                    </div>
                  </div>
                  <span className="badge bg-success-subtle text-success border border-success-subtle">
                    Certificada en Oficina
                  </span>
                </div>
              </div>

              {/* Las 8 Fases Operativas de Taller en PostgreSQL */}
              {fases.map((fase) => {
                const isCompleted = fase.estado === "completada";
                const isActive = fase.estado === "en_curso";
                const borderClass = isCompleted
                  ? "border-start border-success border-4"
                  : isActive
                  ? "border-start border-primary border-4 bg-primary-subtle bg-opacity-10"
                  : "border-start border-secondary border-4 opacity-75";

                return (
                  <div
                    key={fase.id_fase}
                    className={`card border-0 shadow-sm ${borderClass}`}
                  >
                    <div className="card-body py-3 px-3 d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2">
                      <div className="d-flex align-items-start gap-3">
                        <div
                          className={`rounded-circle d-flex align-items-center justify-content-center fw-bold text-white flex-shrink-0 ${
                            isCompleted
                              ? "bg-success"
                              : isActive
                              ? "bg-primary"
                              : "bg-secondary"
                          }`}
                          style={{ width: "36px", height: "36px" }}
                        >
                          {isCompleted ? (
                            <i className="bi bi-check-lg"></i>
                          ) : (
                            fase.orden_secuencia
                          )}
                        </div>

                        <div>
                          <div className="d-flex align-items-center gap-2">
                            <span className="fw-bold fs-6">
                              Fase {fase.orden_secuencia}: {fase.nombre_fase}
                            </span>
                            {isCompleted && (
                              <span className="badge bg-success">Completada</span>
                            )}
                            {isActive && (
                              <span className="badge bg-primary">
                                <i className="bi bi-gear-wide-connected me-1"></i>
                                En Curso
                              </span>
                            )}
                            {!isCompleted && !isActive && (
                              <span className="badge bg-secondary">Pendiente</span>
                            )}
                          </div>

                          <div className="small text-muted mt-1 d-flex flex-wrap gap-3">
                            <span>
                              <i className="bi bi-clock me-1"></i>
                              <strong>Inicio:</strong> {formatDateTime(fase.fecha_inicio)}
                            </span>
                            <span>
                              <i className="bi bi-flag me-1"></i>
                              <strong>Fin:</strong> {formatDateTime(fase.fecha_fin)}
                            </span>
                            <span>
                              <i className="bi bi-person-badge me-1"></i>
                              <strong>Responsable:</strong>{" "}
                              {fase.responsable_nombre || "Sin asignar"}
                            </span>
                          </div>

                          {fase.observaciones && (
                            <div className="small text-dark bg-light border rounded px-2 py-1 mt-2">
                              <i className="bi bi-chat-left-text me-1 text-primary"></i>
                              {fase.observaciones}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Métrica de Duración (HU-009) + Acciones por fila */}
                      <div className="d-flex align-items-center gap-2 align-self-end align-self-md-center">
                        <div className="text-end me-2">
                          <div className="small text-muted">Tiempo en etapa</div>
                          <div className="fw-bold text-dark">
                            {fase.duracion_texto}
                          </div>
                        </div>

                        {!orden.fecha_entrega_real && isActive && (
                          <button
                            type="button"
                            className="btn btn-sm btn-success fw-semibold"
                            disabled={loadingFaseId === fase.numero_secuencia}
                            onClick={() =>
                              handleCompletarFase(
                                fase.numero_secuencia,
                                fase.nombre_fase
                              )
                            }
                          >
                            <i className="bi bi-check2 me-1"></i>
                            Completar
                          </button>
                        )}

                        {!orden.fecha_entrega_real && !isCompleted && !isActive && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            disabled={loadingFaseId === fase.numero_secuencia}
                            title="Permite iniciar la fase (o verificar bloqueo de secuencia HU-008 si hay previas sin cerrar)"
                            onClick={() =>
                              handleIniciarFase(
                                fase.numero_secuencia,
                                fase.nombre_fase
                              )
                            }
                          >
                            <i className="bi bi-play me-1"></i>
                            Iniciar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Sección Inferior: Insumos y Repuestos Consumidos en esta OT (HU-009 y HU-012) */}
            <div className="mt-4 pt-3 border-top">
              <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-3 gap-2">
                <div>
                  <h6 className="fw-bold text-uppercase text-secondary small mb-0">
                    <i className="bi bi-boxes me-1"></i>
                    Insumos y Repuestos Imputados a esta Orden (HU-012)
                  </h6>
                  {orden.costo_materiales_consumidos !== null &&
                    orden.costo_materiales_consumidos !== undefined && (
                      <small className="text-muted">
                        Costo acumulado de materiales en esta unidad:{" "}
                        <strong className="text-dark">
                          ${" "}
                          {Number(
                            orden.costo_materiales_consumidos
                          ).toLocaleString("es-AR", {
                            minimumFractionDigits: 2,
                          })}
                        </strong>
                      </small>
                    )}
                </div>

                {!orden.fecha_entrega_real && (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary fw-semibold"
                    onClick={() => setShowConsumeModal(true)}
                  >
                    <i className="bi bi-plus-circle me-1"></i>
                    Imputar Material del Pañol a esta OT
                  </button>
                )}
              </div>

              {consumosOT.length === 0 ? (
                <div className="card border-0 shadow-sm">
                  <div className="card-body py-3 text-center text-muted small">
                    Aún no se registraron consumos de insumos o repuestos para esta orden.
                  </div>
                </div>
              ) : (
                <div className="card border-0 shadow-sm">
                  <div className="table-responsive">
                    <table className="table table-sm align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Fecha / Hora</th>
                          <th>Código e Insumo</th>
                          <th className="text-end">Cantidad</th>
                          <th>Tarea / Observación</th>
                          <th>Responsable</th>
                          {canRegisterDelivery && (
                            <th className="text-end">Subtotal Costo</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {consumosOT.map((c) => (
                          <tr key={c.id_mov_stock}>
                            <td className="small text-muted">
                              {formatDateTime(c.fecha_hora)}
                            </td>
                            <td>
                              <strong>{c.insumo_codigo}</strong> — {c.insumo_nombre}
                            </td>
                            <td className="text-end fw-bold text-danger">
                              -{c.cantidad} {c.insumo_unidad}
                            </td>
                            <td className="small text-muted">
                              {c.remito_comprobante}
                            </td>
                            <td className="small">{c.usuario_nombre}</td>
                            {canRegisterDelivery && (
                              <td className="text-end fw-semibold">
                                ${" "}
                                {Number(c.subtotal_valorizado).toLocaleString(
                                  "es-AR",
                                  { minimumFractionDigits: 2 }
                                )}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="modal-footer bg-white">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
            >
              Cerrar Tablero de Orden
            </button>
          </div>
        </div>
      </div>

      {showConsumeModal && (
        <StockConsumptionModal
          insumos={insumosCatalogo}
          preselectedOrden={orden}
          onClose={() => setShowConsumeModal(false)}
          onSuccess={async (resp) => {
            setShowConsumeModal(false);
            setFeedback({
              type: resp.alerta_stock_minimo ? "warning" : "success",
              text: resp.detail,
            });
            await loadConsumosOT();
            if (onUpdated) {
              const refreshed = await getOrdenTrabajoById(orden.id_orden);
              onUpdated(refreshed);
            }
          }}
        />
      )}
    </div>
  );
}
