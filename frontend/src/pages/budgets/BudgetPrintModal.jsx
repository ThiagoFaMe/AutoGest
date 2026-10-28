import React, { useEffect, useState } from "react";
import { getOrdenTrabajoById } from "../../api/budgetsApi";

const TIPO_ITEM_LABEL = {
  mano_obra_chapa: "Mano de Obra Chapa",
  mano_obra_pintura: "Mano de Obra Pintura",
  repuesto: "Repuesto / Autoparte",
};

export default function BudgetPrintModal({ budget, onClose }) {
  const [ordenDetalle, setOrdenDetalle] = useState(null);

  useEffect(() => {
    if (budget?.orden_trabajo_resumen?.id_orden) {
      getOrdenTrabajoById(budget.orden_trabajo_resumen.id_orden)
        .then(setOrdenDetalle)
        .catch(() => setOrdenDetalle(null));
    }
  }, [budget]);

  if (!budget) return null;

  return (
    <div className="modal d-block" style={{ backgroundColor: "rgba(0,0,0,0.55)" }}>
      <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content border-0 shadow-lg">
          <div className="modal-header bg-light d-print-none">
            <h5 className="modal-title fw-bold">
              <i className="bi bi-printer-fill text-primary me-2"></i>
              Vista Estandarizada de Presupuesto #{budget.id_presupuesto} (HU-005 / HU-006)
            </h5>
            <div className="d-flex gap-2">
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => window.print()}
              >
                <i className="bi bi-file-earmark-pdf-fill me-1"></i>
                Imprimir / Guardar PDF
              </button>
              <button
                type="button"
                className="btn-close"
                onClick={onClose}
              ></button>
            </div>
          </div>

          <div className="modal-body p-4">
            {/* Encabezado Formal de Taller Sergio */}
            <div className="d-flex justify-content-between align-items-start border-bottom pb-3 mb-3">
              <div>
                <h4 className="fw-bold mb-0">TALLER SERGIO</h4>
                <div className="text-muted small">
                  Especialistas en Carrocería, Chapa y Pintura Automotriz
                </div>
                <div className="text-muted small">
                  Córdoba Capital, Provincia de Córdoba, Argentina
                </div>
              </div>
              <div className="text-end">
                <span className="badge bg-dark fs-6 mb-1">
                  PRESUPUESTO N.º {String(budget.id_presupuesto).padStart(4, "0")}
                </span>
                <div className="small">
                  <strong>Modalidad:</strong>{" "}
                  {budget.tipo === "aseguradora"
                    ? "Compañía Aseguradora"
                    : "Cliente Particular"}
                </div>
                <div className="small">
                  <strong>Emisión:</strong> {budget.fecha_emision || "En borrador"}{" "}
                  | <strong>Vence:</strong> {budget.fecha_vencimiento || "—"}
                </div>
              </div>
            </div>

            {/* Datos del Cliente, Vehículo y Siniestro */}
            <div className="row g-3 mb-3 small">
              <div className="col-md-6">
                <div className="p-2 bg-light rounded border h-100">
                  <div className="fw-bold text-uppercase text-secondary mb-1">
                    Datos del Cliente y Unidad
                  </div>
                  <div>
                    <strong>Cliente:</strong> {budget.cliente_nombre} (DNI:{" "}
                    {budget.cliente_dni})
                  </div>
                  <div>
                    <strong>Teléfono:</strong> {budget.cliente_telefono}
                  </div>
                  <div>
                    <strong>Vehículo:</strong>{" "}
                    <span className="fw-bold">{budget.vehiculo_patente}</span> —{" "}
                    {budget.vehiculo_detalle}
                  </div>
                </div>
              </div>
              <div className="col-md-6">
                <div className="p-2 bg-light rounded border h-100">
                  <div className="fw-bold text-uppercase text-secondary mb-1">
                    Estado y Condiciones Comerciales
                  </div>
                  <div>
                    <strong>Estado Actual:</strong>{" "}
                    <span className="text-uppercase fw-bold">
                      {budget.estado}
                    </span>
                  </div>
                  {budget.tipo === "aseguradora" ? (
                    <>
                      <div>
                        <strong>Compañía:</strong> {budget.compania_nombre}
                      </div>
                      <div>
                        <strong>N.º Siniestro:</strong> {budget.nro_siniestro} |{" "}
                        <strong>Perito:</strong> {budget.nombre_perito}
                      </div>
                    </>
                  ) : (
                    <div>
                      <strong>Condición:</strong> Cotización directa particular (validez 15 días).
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Tabla de Ítems */}
            <table className="table table-sm table-bordered align-middle mb-3">
              <thead className="table-light small">
                <tr>
                  <th>Descripción de Tarea / Autoparte</th>
                  <th>Rubro</th>
                  <th className="text-center">Cant.</th>
                  <th className="text-end">Precio Unit.</th>
                  <th className="text-end">Subtotal</th>
                </tr>
              </thead>
              <tbody className="small">
                {budget.items?.map((item) => (
                  <tr key={item.id_item}>
                    <td>{item.descripcion}</td>
                    <td>{TIPO_ITEM_LABEL[item.tipo_item] || item.tipo_item}</td>
                    <td className="text-center">{item.cantidad}</td>
                    <td className="text-end">
                      ${" "}
                      {Number(item.precio_unitario).toLocaleString("es-AR", {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="text-end fw-semibold">
                      ${" "}
                      {Number(item.subtotal).toLocaleString("es-AR", {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totales */}
            <div className="row justify-content-end mb-3">
              <div className="col-md-6">
                <div className="p-3 bg-light rounded border small">
                  <div className="d-flex justify-content-between mb-1">
                    <span>Subtotal Mano de Obra (Chapa y Pintura):</span>
                    <span className="fw-semibold">
                      ${" "}
                      {Number(budget.monto_mano_obra).toLocaleString("es-AR", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="d-flex justify-content-between mb-1">
                    <span>
                      Subtotal Repuestos{" "}
                      {budget.tipo === "aseguradora"
                        ? "(Provee Aseguradora)"
                        : ""}
                      :
                    </span>
                    <span className="fw-semibold">
                      ${" "}
                      {Number(budget.monto_repuestos).toLocaleString("es-AR", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="d-flex justify-content-between border-top pt-2 fs-6 fw-bold">
                    <span>TOTAL PRESUPUESTADO:</span>
                    <span>
                      ${" "}
                      {Number(budget.monto_total).toLocaleString("es-AR", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {budget.observaciones && (
              <div className="small text-muted border-top pt-2 mb-3">
                <strong>Observaciones:</strong> {budget.observaciones}
              </div>
            )}

            {/* Si el presupuesto está aprobado, exhibe la Orden de Trabajo 1:1 y sus 8 fases creadas (HU-007) */}
            {ordenDetalle && (
              <div className="mt-3 p-3 rounded border border-success bg-success-subtle small">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="fw-bold text-success fs-6">
                    <i className="bi bi-check-circle-fill me-1"></i>
                    Orden de Trabajo Vinculada (1:1): {ordenDetalle.codigo_seguimiento}
                  </span>
                  <span className="badge bg-success">
                    Entrega Estimada: {ordenDetalle.fecha_estimada_entrega}
                  </span>
                </div>
                <div className="mb-2">
                  <strong>Hoja de Ruta Inicializada (8 Fases Operativas en FaseReparacion - HU-007 Criterio 2):</strong>
                </div>
                <div className="d-flex flex-wrap gap-1">
                  {ordenDetalle.fases?.map((f) => (
                    <span
                      key={f.id_fase}
                      className="badge bg-white text-dark border px-2 py-1"
                    >
                      {f.numero_secuencia}. {f.nombre_fase} ({f.estado})
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
