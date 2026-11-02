import React, { useEffect, useState } from "react";
import { getOrdenTrabajoById } from "../../api/budgetsApi";
import {
  PLANILLA_ASEGURADORA_COLUMNAS,
  buildPiezaKey,
} from "./aseguradoraPlanillaCatalog";

/**
 * Vista de Impresión / PDF Estandarizada de Taller Sergio:
 * - Si el presupuesto es "particular", imprime el formato de Talonario con renglones (Anexo 1).
 * - Si el presupuesto es "aseguradora", imprime la Planilla Completa de 3 Columnas con casillas [X] C/R/P (Anexo 2).
 */
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

  const fechaObj = budget.fecha_emision
    ? new Date(budget.fecha_emision + "T12:00:00")
    : new Date();
  const dia = String(fechaObj.getDate()).padStart(2, "0");
  const mes = String(fechaObj.getMonth() + 1).padStart(2, "0");
  const anio = String(fechaObj.getFullYear()).slice(-2);

  const marcaciones = budget.planilla_marcaciones || {};
  const rubros = budget.rubros_importes || {};
  const cab = rubros.cabecera_planilla || {};
  const printDia = cab.fecha_dia || dia;
  const printMes = cab.fecha_mes || mes;
  const printAnio = cab.fecha_anio || anio;

  return (
    <div className="modal d-block" style={{ backgroundColor: "rgba(0,0,0,0.6)" }}>
      <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content border-0 shadow-lg">
          <div className="modal-header bg-dark text-white d-print-none">
            <h5 className="modal-title fw-bold">
              <i className="bi bi-printer-fill me-2"></i>
              {budget.tipo === "aseguradora"
                ? `Planilla de Compañía Aseguradora #${budget.id_presupuesto} (Anexo 2)`
                : `Presupuesto / Orden para Terceros #${budget.id_presupuesto} (Anexo 1)`}
            </h5>
            <div className="d-flex gap-2">
              <button
                type="button"
                className="btn btn-sm btn-primary fw-semibold"
                onClick={() => window.print()}
              >
                <i className="bi bi-file-earmark-pdf-fill me-1"></i>
                Imprimir / Guardar PDF
              </button>
              <button
                type="button"
                className="btn-close btn-close-white"
                onClick={onClose}
              ></button>
            </div>
          </div>

          <div className="modal-body p-4 bg-white text-dark">
            {budget.tipo === "particular" ? (
              /* =====================================================================
                 FORMATO 1: TALONARIO LIBRE PARA TERCEROS / PARTICULARES (ANEXO 1)
                 ===================================================================== */
              <div
                className="border border-2 border-dark rounded-3 p-4 mx-auto"
                style={{ maxWidth: "650px" }}
              >
                <div className="border border-2 border-dark rounded-3 p-3 mb-4">
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <div
                        style={{
                          fontSize: "2.3rem",
                          fontWeight: 900,
                          fontStyle: "italic",
                          lineHeight: 1,
                        }}
                      >
                        SERGIO
                      </div>
                      <div className="bg-dark text-white px-2 small fw-bold d-inline-block mt-1">
                        CARROCERÍA Y PINTURA
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="fw-bold small">PRESUPUESTO / ORDEN</div>
                      <div className="d-inline-flex gap-1 mt-1">
                        <span className="border border-dark px-2 py-1 fw-bold">
                          {dia}
                        </span>
                        <span className="border border-dark px-2 py-1 fw-bold">
                          {mes}
                        </span>
                        <span className="border border-dark px-2 py-1 fw-bold">
                          {anio}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.7rem" }}>FECHA</div>
                    </div>
                  </div>
                  <div className="text-center mt-2 pt-2 border-top border-dark small">
                    <div>
                      Boedo 1627 esq. Agustín Garzón - B° 1° de Mayo - Córdoba
                    </div>
                    <div className="fw-bold fs-6">
                      Tel.: (0351) 455 9798 - Cel.: (0351) 152 165277
                    </div>
                    <div>martin-pablo@outlook.com.ar</div>
                  </div>
                </div>

                {/* Cuerpo manuscrito/digital sobre renglones */}
                <div
                  className="p-3 border border-dark rounded"
                  style={{
                    minHeight: "300px",
                    whiteSpace: "pre-wrap",
                    fontSize: "1.2rem",
                    lineHeight: "2.2rem",
                    backgroundImage:
                      "repeating-linear-gradient(white, white 2.13rem, #94a3b8 2.13rem, #94a3b8 2.2rem)",
                  }}
                >
                  {budget.detalle_libre ||
                    `${budget.vehiculo_modelo || budget.vehiculo_detalle}   ${
                      budget.vehiculo_patente
                    }\n` +
                      (budget.items || [])
                        .map((i) => `${i.descripcion}`)
                        .join("\n") +
                      `\nM/O = $ ${Number(budget.monto_total).toLocaleString(
                        "es-AR"
                      )}`}
                </div>

                <div className="d-flex justify-content-between align-items-center mt-3 pt-2 border-top small">
                  <span>
                    <strong>Cliente:</strong> {budget.cliente_nombre} (Tel:{" "}
                    {budget.cliente_telefono})
                  </span>
                  <span className="fw-bold fs-5">
                    TOTAL: ${" "}
                    {Number(budget.monto_total).toLocaleString("es-AR", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>

                <div className="text-center mt-3 fw-bold">
                  <i className="bi bi-instagram me-1"></i>
                  Tallersergio.automotriz
                </div>
              </div>
            ) : (
              /* =====================================================================
                 FORMATO 2: PLANILLA DE 3 COLUMNAS CON CASILLAS [X] C/R/P (ANEXO 2)
                 ===================================================================== */
              <div className="border border-2 border-dark p-3">
                {/* Encabezado idéntico a la planilla preimpresa de Taller Sergio */}
                <div
                  className="border border-2 border-dark px-3 py-2 mb-2"
                  style={{ borderRadius: "14px" }}
                >
                  <div className="row g-2 align-items-center">
                    <div className="col-6 d-flex align-items-center gap-3">
                      <div className="text-center">
                        <div
                          style={{
                            fontSize: "2.2rem",
                            fontWeight: 900,
                            fontStyle: "italic",
                            lineHeight: 1,
                          }}
                        >
                          SERGIO
                        </div>
                        <div className="bg-dark text-white px-2 small fw-bold">
                          CARROCERÍA Y PINTURA
                        </div>
                        <div className="small fst-italic">
                          De Martín Pablo César
                        </div>
                      </div>
                      <div style={{ fontSize: "0.75rem" }}>
                        <div>Boedo 1627 esq. Agustín Garzón</div>
                        <div>B° 1° de Mayo - Córdoba</div>
                        <div className="fw-bold">CEL.: (0351) 152165277</div>
                        <div>martin-pablo@outlook.com.ar</div>
                        <div>tallersergio1627@gmail.com</div>
                      </div>
                    </div>

                    <div className="col-2 text-center d-flex flex-column align-items-center">
                      <div className="border border-2 border-dark d-inline-block px-3 py-1 fw-black fs-4">
                        X
                      </div>
                      <div style={{ fontSize: "0.62rem", lineHeight: "0.72rem" }}>
                        <div>Documento</div>
                        <div>No Válido</div>
                        <div>como</div>
                        <div>Factura</div>
                      </div>
                    </div>

                    <div className="col-4 text-center">
                      <div className="fw-bold">
                        PRESUPUESTO N°:{" "}
                        {String(budget.id_presupuesto).padStart(4, "0")}
                      </div>
                      <div className="d-inline-flex gap-1 my-1">
                        <span className="border border-2 border-dark px-2 py-1 fw-bold">
                          {printDia}
                        </span>
                        <span className="border border-2 border-dark px-2 py-1 fw-bold">
                          {printMes}
                        </span>
                        <span className="border border-2 border-dark px-2 py-1 fw-bold">
                          {printAnio}
                        </span>
                      </div>
                      <div className="small fw-semibold">FECHA:</div>
                    </div>
                  </div>
                </div>

                {/* Datos de filiación del Cliente y Vehículo con líneas punteadas */}
                <div
                  className="border-bottom border-2 border-dark pb-2 mb-2"
                  style={{ fontSize: "0.82rem" }}
                >
                  <div className="row g-2 mb-1">
                    <div className="col-8">
                      <strong>APELLIDO Y NOMBRE:</strong>{" "}
                      <span
                        className="text-uppercase fw-semibold"
                        style={{ borderBottom: "1px dotted #000" }}
                      >
                        {cab.apellido_nombre || budget.cliente_nombre}
                      </span>
                    </div>
                    <div className="col-4">
                      <strong>TEL.:</strong>{" "}
                      <span style={{ borderBottom: "1px dotted #000" }}>
                        {cab.telefono_1 || budget.cliente_telefono}
                      </span>
                    </div>
                  </div>
                  <div className="row g-2 mb-1">
                    <div className="col-8">
                      <strong>DOMICILIO:</strong>{" "}
                      <span style={{ borderBottom: "1px dotted #000" }}>
                        {cab.domicilio ||
                          budget.cliente_direccion ||
                          "Córdoba Capital"}
                      </span>
                    </div>
                    <div className="col-4">
                      <strong>TEL.:</strong>{" "}
                      <span style={{ borderBottom: "1px dotted #000" }}>
                        {cab.telefono_2 || "—"}
                      </span>
                    </div>
                  </div>
                  <div className="row g-2">
                    <div className="col-4">
                      <strong>VEHÍCULO:</strong>{" "}
                      <span style={{ borderBottom: "1px dotted #000" }}>
                        {cab.vehiculo_texto ||
                          `${budget.vehiculo_marca} ${budget.vehiculo_modelo}`}
                      </span>
                    </div>
                    <div className="col-3">
                      <strong>COLOR:</strong>{" "}
                      <span style={{ borderBottom: "1px dotted #000" }}>
                        {cab.color_texto || budget.vehiculo_color}
                      </span>
                    </div>
                    <div className="col-2">
                      <strong>MODELO:</strong>{" "}
                      <span style={{ borderBottom: "1px dotted #000" }}>
                        {cab.modelo_anio || budget.vehiculo_anio}
                      </span>
                    </div>
                    <div className="col-3">
                      <strong>DOMINIO:</strong>{" "}
                      <span
                        className="fw-bold"
                        style={{ borderBottom: "1px dotted #000" }}
                      >
                        {cab.dominio_patente || budget.vehiculo_patente}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-center fw-bold small mb-2">
                  C: Cambiar &nbsp;&nbsp;&nbsp;&nbsp; R: Reparar
                  &nbsp;&nbsp;&nbsp;&nbsp; P: Pintar
                </div>

                {/* Grilla de 3 columnas con todas las secciones y las X marcadas */}
                <div className="row g-2" style={{ fontSize: "0.68rem" }}>
                  {PLANILLA_ASEGURADORA_COLUMNAS.map(
                    (seccionesCol, colIndex) => (
                      <div key={colIndex} className="col-4">
                        {seccionesCol.map((seccion) => (
                          <div
                            key={seccion.id}
                            className="border border-dark mb-2"
                          >
                            <div className="d-flex bg-secondary-subtle border-bottom border-dark fw-bold">
                              <div className="flex-grow-1 px-1">
                                {seccion.titulo}
                              </div>
                              {seccion.columnas.map((c) => (
                                <div
                                  key={c}
                                  className="text-center border-start border-dark"
                                  style={{ width: "22px" }}
                                >
                                  {c}
                                </div>
                              ))}
                            </div>
                            {seccion.piezas.map((pieza) => {
                              const key = buildPiezaKey(seccion.id, pieza);
                              const m = marcaciones[key] || {};
                              return (
                                <div
                                  key={pieza}
                                  className="d-flex border-bottom"
                                  style={{ lineHeight: "1.15rem" }}
                                >
                                  <div className="flex-grow-1 px-1 text-truncate">
                                    {pieza}
                                  </div>
                                  {seccion.columnas.map((c) => (
                                    <div
                                      key={c}
                                      className="text-center border-start border-dark fw-bold"
                                      style={{ width: "22px" }}
                                    >
                                      {m[c] ? "X" : ""}
                                    </div>
                                  ))}
                                </div>
                              );
                            })}
                          </div>
                        ))}

                        {/* Pie de la Columna 3 con el desglose de importes y sello */}
                        {colIndex === 2 && (
                          <div
                            className="border border-2 border-dark p-2 mt-2"
                            style={{ fontSize: "0.78rem" }}
                          >
                            <div className="d-flex justify-content-between mb-1">
                              <strong>MANO DE OBRA $</strong>
                              <span>
                                {Number(
                                  rubros.mano_obra ?? budget.monto_mano_obra
                                ).toLocaleString("es-AR")}
                              </span>
                            </div>
                            <div className="d-flex justify-content-between mb-1">
                              <strong>PINTURA $</strong>
                              <span>
                                {Number(rubros.pintura || 0).toLocaleString(
                                  "es-AR"
                                )}
                              </span>
                            </div>
                            <div className="d-flex justify-content-between mb-1">
                              <strong>MECÁNICA $</strong>
                              <span>
                                {Number(rubros.mecanica || 0).toLocaleString(
                                  "es-AR"
                                )}
                              </span>
                            </div>
                            <div className="d-flex justify-content-between mb-1">
                              <strong>ELECTRICIDAD $</strong>
                              <span>
                                {Number(
                                  rubros.electricidad || 0
                                ).toLocaleString("es-AR")}
                              </span>
                            </div>
                            <div className="d-flex justify-content-between mb-1">
                              <strong>TAPICERÍA $</strong>
                              <span>
                                {Number(rubros.tapiceria || 0).toLocaleString(
                                  "es-AR"
                                )}
                              </span>
                            </div>
                            <div className="d-flex justify-content-between mb-1">
                              <strong>REPUESTOS $</strong>
                              <span>
                                {Number(
                                  rubros.repuestos ?? budget.monto_repuestos
                                ).toLocaleString("es-AR")}
                              </span>
                            </div>
                            <div className="d-flex justify-content-between mb-2">
                              <strong>I.V.A. $</strong>
                              <span>
                                {Number(rubros.iva || 0).toLocaleString(
                                  "es-AR"
                                )}
                              </span>
                            </div>

                            <div className="text-center my-2 py-1 border-top border-bottom border-dark">
                              <div className="fw-bold">TALLER SERGIO</div>
                              <div>Pablo Martín • 3512165277</div>
                              <div style={{ fontSize: "0.68rem" }}>
                                por Taller SERGIO
                              </div>
                            </div>

                            <div className="border border-2 border-dark p-2 d-flex justify-content-between align-items-center fw-bold fs-6">
                              <span>TOTAL $</span>
                              <span>
                                {Number(budget.monto_total).toLocaleString(
                                  "es-AR",
                                  { minimumFractionDigits: 2 }
                                )}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

            {/* Si ya tiene Orden de Trabajo (HU-007), se muestra debajo (no sale en impresión si no se desea) */}
            {ordenDetalle && (
              <div className="mt-3 p-3 rounded border border-success bg-success-subtle small d-print-none">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="fw-bold text-success fs-6">
                    <i className="bi bi-check-circle-fill me-1"></i>
                    Orden de Trabajo Vinculada (1:1):{" "}
                    {ordenDetalle.codigo_seguimiento}
                  </span>
                  <span className="badge bg-success">
                    Entrega Estimada: {ordenDetalle.fecha_estimada_entrega}
                  </span>
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
