import React, { useState } from "react";
import { aprobarPresupuesto } from "../../api/budgetsApi";

export default function BudgetApproveModal({ budget, onClose, onApproved }) {
  const defaultDelivery = () => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split("T")[0];
  };

  const [fechaIngreso, setFechaIngreso] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [fechaEstimadaEntrega, setFechaEstimadaEntrega] = useState(
    defaultDelivery()
  );
  const [nroOrdenAseguradora, setNroOrdenAseguradora] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSubmitting(true);
    try {
      const res = await aprobarPresupuesto(budget.id_presupuesto, {
        fecha_ingreso: fechaIngreso,
        fecha_estimada_entrega: fechaEstimadaEntrega,
        nro_orden_aseguradora: nroOrdenAseguradora.trim(),
      });
      onApproved(res);
    } catch (err) {
      const data = err.response?.data;
      if (data) {
        const msg = Object.entries(data)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(" ") : v}`)
          .join(" | ");
        setErrorMsg(msg);
      } else {
        setErrorMsg("Error al aprobar el presupuesto.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal d-block" style={{ backgroundColor: "rgba(0,0,0,0.55)" }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content border-0 shadow">
          <div className="modal-header bg-success text-white">
            <h5 className="modal-title fw-bold">
              <i className="bi bi-check2-circle me-2"></i>
              Aprobar Presupuesto #{budget.id_presupuesto} y Generar OT (HU-007)
            </h5>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={onClose}
            ></button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              {errorMsg && (
                <div className="alert alert-danger small">{errorMsg}</div>
              )}

              <div className="alert alert-success small mb-3">
                <div className="fw-bold mb-1">
                  Transición Automática 1 a 1 (HU-007 Criterios 1 y 2):
                </div>
                Al confirmar la aprobación de esta cotización por{" "}
                <strong>
                  ${" "}
                  {Number(budget.monto_total).toLocaleString("es-AR", {
                    minimumFractionDigits: 2,
                  })}
                </strong>
                , el sistema creará automáticamente la{" "}
                <strong>Orden de Trabajo</strong> para el vehículo{" "}
                <span className="patente-badge">{budget.vehiculo_patente}</span>{" "}
                e inicializará en base de datos sus{" "}
                <strong>8 fases secuenciales de taller</strong> (1-Recepción a
                8-Alistado para entrega).
              </div>

              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label small fw-semibold">
                    Fecha de Ingreso al Taller *
                  </label>
                  <input
                    type="date"
                    className="form-control"
                    value={fechaIngreso}
                    onChange={(e) => setFechaIngreso(e.target.value)}
                    required
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label small fw-semibold">
                    Fecha Estimada de Entrega *
                  </label>
                  <input
                    type="date"
                    className="form-control"
                    value={fechaEstimadaEntrega}
                    onChange={(e) => setFechaEstimadaEntrega(e.target.value)}
                    required
                  />
                </div>

                {budget.tipo === "aseguradora" && (
                  <div className="col-12">
                    <label className="form-label small fw-semibold">
                      N.º de Orden de Reparación Pericial ({budget.compania_nombre}) *
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Ej.: OR-SANCOR-2026-881"
                      value={nroOrdenAseguradora}
                      onChange={(e) => setNroOrdenAseguradora(e.target.value)}
                      required
                    />
                    <div className="form-text">
                      Obligatorio para vincular la autorización emitida por el perito{" "}
                      <strong>{budget.nombre_perito}</strong>.
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer bg-light">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={onClose}
                disabled={submitting}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn btn-success fw-semibold"
                disabled={submitting}
              >
                <i className="bi bi-gear-wide-connected me-1"></i>
                Confirmar Aprobación y Crear Orden de Trabajo
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
