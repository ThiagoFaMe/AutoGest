import React, { useEffect, useState } from "react";
import { registrarConsumoOT } from "../../api/inventoryApi";
import { getOrdenesTrabajo } from "../../api/workordersApi";

export default function StockConsumptionModal({
  insumos,
  preselectedInsumo,
  preselectedOrden,
  onClose,
  onSuccess,
}) {
  const [ordenesActivas, setOrdenesActivas] = useState([]);
  const [idOrden, setIdOrden] = useState(preselectedOrden?.id_orden || "");
  const [idInsumo, setIdInsumo] = useState(
    preselectedInsumo?.id_insumo || (insumos[0]?.id_insumo ?? "")
  );
  const [cantidad, setCantidad] = useState("1.00");
  const [observacion, setObservacion] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadOrdenes = async () => {
      try {
        const data = await getOrdenesTrabajo();
        const list = Array.isArray(data) ? data : data.results || [];
        const activas = list.filter((o) => !o.fecha_entrega_real);
        setOrdenesActivas(activas);
      } catch (err) {
        console.error("Error cargando órdenes activas:", err);
      }
    };
    loadOrdenes();
  }, [preselectedOrden]);

  const selectedInsumo = insumos.find(
    (i) => String(i.id_insumo) === String(idInsumo)
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);
    try {
      const resp = await registrarConsumoOT({
        id_insumo: Number(idInsumo),
        id_orden: idOrden ? Number(idOrden) : null,
        cantidad,
        observacion_comprobante: observacion.trim(),
      });
      if (onSuccess) onSuccess(resp);
    } catch (err) {
      const data = err.response?.data;
      const msg =
        data?.detail ||
        (data &&
          Object.entries(data)
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(" ") : v}`)
            .join(" | ")) ||
        "No se pudo registrar el consumo de stock.";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="modal d-block"
      style={{ backgroundColor: "rgba(15, 23, 42, 0.72)", zIndex: 1060 }}
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content border-0 shadow-lg">
          <div className="modal-header bg-primary text-white">
            <h5 className="modal-title fw-bold">
              <i className="bi bi-tools me-2"></i>
              Registrar Consumo de Insumo o Repuesto
            </h5>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={onClose}
            ></button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="modal-body p-4">
              {errorMsg && (
                <div className="alert alert-danger d-flex align-items-start gap-2 small">
                  <i className="bi bi-exclamation-octagon-fill fs-5"></i>
                  <div>{errorMsg}</div>
                </div>
              )}

              <div className="mb-3">
                <label className="form-label fw-semibold small">
                  Orden de Trabajo Destino (Opcional)
                </label>
                <select
                  className="form-select fw-semibold"
                  value={idOrden}
                  onChange={(e) => setIdOrden(e.target.value)}
                  disabled={Boolean(preselectedOrden)}
                >
                  <option value="">
                    -- Sin vincular a Orden (Consumo general de taller / pañol) --
                  </option>
                  {ordenesActivas.map((ot) => (
                    <option key={ot.id_orden} value={ot.id_orden}>
                      {ot.codigo_seguimiento} • {ot.vehiculo_patente} (
                      {ot.vehiculo_descripcion}) — Etapa: {ot.estado_actual}
                    </option>
                  ))}
                </select>
                <small className="text-muted">
                  Podés asociarlo a un vehículo en planta (ej.: autopartes) o dejarlo como consumo general (ej.: cintas, lijas).
                </small>
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold small">
                  Insumo o Repuesto a Retirar de Pañol *
                </label>
                <select
                  className="form-select"
                  value={idInsumo}
                  onChange={(e) => setIdInsumo(e.target.value)}
                  required
                >
                  {insumos.map((item) => (
                    <option key={item.id_insumo} value={item.id_insumo}>
                      {item.codigo} — {item.nombre} (Disponible:{" "}
                      {item.stock_actual} {item.unidad_medida})
                    </option>
                  ))}
                </select>
              </div>

              {selectedInsumo && (
                <div
                  className={`p-2 rounded border small mb-3 d-flex justify-content-between ${
                    selectedInsumo.en_alerta_stock
                      ? "bg-danger-subtle text-danger border-danger"
                      : "bg-light"
                  }`}
                >
                  <span>
                    Disponible en Pañol:{" "}
                    <strong>
                      {selectedInsumo.stock_actual}{" "}
                      {selectedInsumo.unidad_medida}
                    </strong>
                  </span>
                  <span>
                    Umbral Mínimo:{" "}
                    <strong>
                      {selectedInsumo.stock_minimo}{" "}
                      {selectedInsumo.unidad_medida}
                    </strong>
                  </span>
                </div>
              )}

              <div className="mb-3">
                <label className="form-label fw-semibold small">
                  Cantidad Consumida ({selectedInsumo?.unidad_medida || "Unid."}) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="form-control fw-bold"
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  required
                />
                <small className="text-muted">
                  Si supera el stock disponible ({selectedInsumo?.stock_actual}{" "}
                  {selectedInsumo?.unidad_medida}), el sistema bloqueará el retiro.
                </small>
              </div>

              <div className="mb-2">
                <label className="form-label fw-semibold small">
                  Tarea / Pieza Aplicada (Observación)
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Ej: Aplicación 2 manos en puerta delantera derecha"
                  value={observacion}
                  onChange={(e) => setObservacion(e.target.value)}
                />
              </div>
            </div>

            <div className="modal-footer bg-light">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={onClose}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn btn-primary fw-semibold px-4"
                disabled={loading}
              >
                {loading ? "Descontando..." : "Confirmar Consumo"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
