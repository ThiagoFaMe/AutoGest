import React from "react";

/**
 * Editor digital estilo Talonario / Hoja de Word para Terceros / Particulares (Anexo 1 del TFG).
 * Replica el formulario real de Taller Sergio (Boedo 1627 esq. Agustín Garzón) permitiendo
 * escribir libremente el trabajo y definir el importe y descuento en efectivo.
 */
export default function ParticularSheetEditor({
  selectedVehiculo,
  selectedCliente,
  detalleLibre,
  setDetalleLibre,
  rubrosImportes,
  setRubrosImportes,
}) {
  const hoy = new Date();
  const dia = String(hoy.getDate()).padStart(2, "0");
  const mes = String(hoy.getMonth() + 1).padStart(2, "0");
  const anio = String(hoy.getFullYear()).slice(-2);

  const manoObra = Number(rubrosImportes.mano_obra) || 0;
  const repuestos = Number(rubrosImportes.repuestos) || 0;
  const descuentoPorc = Number(rubrosImportes.descuento_efectivo_porc) || 0;
  const subtotalBase = manoObra + repuestos;
  const totalConDescuento =
    rubrosImportes.total_final !== undefined && rubrosImportes.total_final !== ""
      ? Number(rubrosImportes.total_final)
      : Math.round(subtotalBase * (1 - descuentoPorc / 100));

  const handleRubroChange = (field, val) => {
    const next = { ...rubrosImportes, [field]: val };
    const mo = Number(next.mano_obra) || 0;
    const rep = Number(next.repuestos) || 0;
    const desc = Number(next.descuento_efectivo_porc) || 0;
    if (field !== "total_final") {
      next.total_final = Math.round((mo + rep) * (1 - desc / 100));
    }
    setRubrosImportes(next);
  };

  const insertTemplateText = (snippet) => {
    const prefix = detalleLibre && !detalleLibre.endsWith("\n") ? "\n" : "";
    setDetalleLibre((detalleLibre || "") + prefix + snippet);
  };

  const handleInsertarEncabezadoVehiculo = () => {
    if (!selectedVehiculo) return;
    insertTemplateText(
      `${selectedVehiculo.modelo}   ${selectedVehiculo.patente}\n`
    );
  };

  const handleInsertarTotalesEnHoja = () => {
    const lines = [];
    if (manoObra > 0) {
      lines.push(`M/O = $ ${manoObra.toLocaleString("es-AR")}`);
    }
    if (repuestos > 0) {
      lines.push(`Repuestos = $ ${repuestos.toLocaleString("es-AR")}`);
    }
    if (descuentoPorc > 0) {
      lines.push(
        `-${descuentoPorc}% En Efectivo (Billete) $ ${totalConDescuento.toLocaleString("es-AR")}`
      );
    } else if (totalConDescuento > 0 && totalConDescuento !== manoObra) {
      lines.push(
        `En Efectivo (Billete) $ ${totalConDescuento.toLocaleString("es-AR")}`
      );
    }
    if (lines.length > 0) {
      insertTemplateText(lines.join("\n"));
    }
  };

  return (
    <div className="row g-4">
      {/* Columna Izquierda: Hoja Digital Estilo Talonario / Word con renglones */}
      <div className="col-lg-7">
        <div
          className="bg-white border border-2 border-dark rounded-3 p-4 shadow-sm"
          style={{ maxWidth: "640px", margin: "0 auto" }}
        >
          {/* Membrete idéntico al talonario real de Taller Sergio */}
          <div className="border border-2 border-dark rounded-3 p-3 mb-3">
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
              <div>
                <div
                  className="fw-black fst-italic"
                  style={{
                    fontSize: "2rem",
                    fontWeight: 900,
                    letterSpacing: "1px",
                    lineHeight: 1,
                  }}
                >
                  SERGIO
                </div>
                <div className="bg-dark text-white px-2 py-0 small fw-bold text-uppercase d-inline-block mt-1">
                  CARROCERÍA Y PINTURA
                </div>
              </div>

              <div className="text-center">
                <div className="fw-bold small text-uppercase mb-1">
                  PRESUPUESTO / ORDEN
                </div>
                <div className="d-inline-flex gap-1">
                  <span
                    className="border border-dark px-2 py-1 fw-bold"
                    style={{ minWidth: "36px" }}
                  >
                    {dia}
                  </span>
                  <span
                    className="border border-dark px-2 py-1 fw-bold"
                    style={{ minWidth: "36px" }}
                  >
                    {mes}
                  </span>
                  <span
                    className="border border-dark px-2 py-1 fw-bold"
                    style={{ minWidth: "36px" }}
                  >
                    {anio}
                  </span>
                </div>
                <div className="text-muted" style={{ fontSize: "0.7rem" }}>
                  FECHA
                </div>
              </div>
            </div>

            <div className="text-center mt-2 pt-2 border-top border-secondary-subtle small">
              <div>Boedo 1627 esq. Agustín Garzón - B° 1° de Mayo - Córdoba</div>
              <div className="fw-bold">
                Tel.: (0351) 455 9798 - Cel.: (0351) 152 165277
              </div>
              <div className="text-muted" style={{ fontSize: "0.78rem" }}>
                martin-pablo@outlook.com.ar
              </div>
            </div>
          </div>

          {/* Barra de herramientas rápidas tipo procesador de texto */}
          <div className="d-flex flex-wrap gap-1 mb-2">
            <button
              type="button"
              className="btn btn-sm btn-outline-dark"
              onClick={handleInsertarEncabezadoVehiculo}
              title="Inserta modelo y patente en el primer renglón"
            >
              <i className="bi bi-car-front me-1"></i>
              Insertar Vehículo y Patente
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-dark"
              onClick={() => insertTemplateText("Reparar y Pintar ")}
            >
              + "Reparar y Pintar..."
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-dark"
              onClick={() => insertTemplateText("Pintar y Colocar ")}
            >
              + "Pintar y Colocar..."
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-primary"
              onClick={handleInsertarTotalesEnHoja}
            >
              <i className="bi bi-calculator me-1"></i>
              Volcar Importes M/O y Efectivo al Texto
            </button>
          </div>

          {/* Área de escritura libre con renglones estilo hoja de talonario / Word */}
          <textarea
            className="form-control border-dark"
            rows="10"
            value={detalleLibre}
            onChange={(e) => setDetalleLibre(e.target.value)}
            placeholder={
              "Escriba libremente el presupuesto como en el talonario, por ejemplo:\n\n" +
              "Corsa AA 467 SL\n" +
              "Puerta Del/Izq Pintar y Colocar.\n" +
              "Lateral Derecho Rep y Pintar.\n" +
              "M/O = $ 600.000\n" +
              "-10% En Efectivo (Billete) $ 540.000"
            }
            style={{
              fontFamily: "'Segoe UI', Roboto, sans-serif",
              fontSize: "1.1rem",
              lineHeight: "2.1rem",
              backgroundImage:
                "repeating-linear-gradient(white, white 2.03rem, #cbd5e1 2.03rem, #cbd5e1 2.1rem)",
              backgroundAttachment: "local",
              paddingTop: "0.2rem",
            }}
          />

          <div className="text-center mt-3 fw-bold small text-secondary">
            <i className="bi bi-instagram me-1"></i>
            Tallersergio.automotriz
          </div>
        </div>
      </div>

      {/* Columna Derecha: Importes para que el sistema calcule la Orden de Trabajo y Finanzas */}
      <div className="col-lg-5">
        <div className="p-3 bg-light rounded-3 border h-100">
          <h6 className="fw-bold text-primary mb-2">
            <i className="bi bi-cash-coin me-2"></i>
            Valores Económicos del Presupuesto Particular
          </h6>
          <p className="small text-muted mb-3">
            Además del texto libre que se imprime en la hoja, indique aquí el monto para que AutoGest calcule la Orden de Trabajo y el saldo al aprobarse.
          </p>

          {selectedCliente && selectedVehiculo && (
            <div className="p-2 bg-white rounded border small mb-3">
              <div>
                <strong>Cliente:</strong> {selectedCliente.apellido},{" "}
                {selectedCliente.nombre} (Tel: {selectedCliente.telefono})
              </div>
              <div>
                <strong>Unidad:</strong>{" "}
                <span className="patente-badge small">
                  {selectedVehiculo.patente}
                </span>{" "}
                {selectedVehiculo.marca} {selectedVehiculo.modelo} (
                {selectedVehiculo.color})
              </div>
            </div>
          )}

          <div className="mb-3">
            <label className="form-label small fw-bold">
              Mano de Obra (M/O $) *
            </label>
            <div className="input-group">
              <span className="input-group-text">$</span>
              <input
                type="number"
                min="0"
                step="1000"
                className="form-control fw-semibold"
                placeholder="Ej.: 600000"
                value={rubrosImportes.mano_obra ?? ""}
                onChange={(e) => handleRubroChange("mano_obra", e.target.value)}
              />
            </div>
          </div>

          <div className="mb-3">
            <label className="form-label small fw-bold">
              Repuestos / Materiales ($ Opcional)
            </label>
            <div className="input-group">
              <span className="input-group-text">$</span>
              <input
                type="number"
                min="0"
                step="1000"
                className="form-control"
                placeholder="0"
                value={rubrosImportes.repuestos ?? ""}
                onChange={(e) => handleRubroChange("repuestos", e.target.value)}
              />
            </div>
          </div>

          <div className="mb-3">
            <label className="form-label small fw-bold">
              Descuento en Efectivo / Billete (%)
            </label>
            <div className="input-group">
              <input
                type="number"
                min="0"
                max="50"
                className="form-control"
                placeholder="Ej.: 10"
                value={rubrosImportes.descuento_efectivo_porc ?? ""}
                onChange={(e) =>
                  handleRubroChange("descuento_efectivo_porc", e.target.value)
                }
              />
              <span className="input-group-text">%</span>
            </div>
          </div>

          <div className="p-3 bg-white rounded border border-primary">
            <label className="form-label small fw-bold text-primary mb-1">
              Importe Final Acordado (Total Presupuesto $) *
            </label>
            <div className="input-group input-group-lg">
              <span className="input-group-text bg-primary text-white fw-bold">
                $
              </span>
              <input
                type="number"
                min="0"
                step="1000"
                className="form-control fw-bold text-primary"
                value={totalConDescuento || ""}
                onChange={(e) =>
                  handleRubroChange("total_final", e.target.value)
                }
              />
            </div>
            <div className="small text-muted mt-1">
              Podés escribir el monto final directo (ej. $ 750.000 en efectivo) o dejar que se calcule con el porcentaje.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
