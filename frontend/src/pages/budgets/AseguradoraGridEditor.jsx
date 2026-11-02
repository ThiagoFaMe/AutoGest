import React, { useState } from "react";
import {
  PLANILLA_ASEGURADORA_COLUMNAS,
  buildPiezaKey,
  countMarkedItems,
} from "./aseguradoraPlanillaCatalog";

/**
 * Planilla Digital Interactiva de 3 Columnas para Compañías Aseguradoras (Anexo 2 del TFG).
 * Replica exactamente la planilla física de Taller Sergio:
 * - C: Cambiar | R: Reparar | P: Pintar (casillas cuadradas marcables con [X])
 * - Bloque de importes al pie de la Columna 3 (MANO DE OBRA $, PINTURA $, MECÁNICA $, etc.)
 */
export default function AseguradoraGridEditor({
  marcaciones,
  setMarcaciones,
  rubrosImportes,
  setRubrosImportes,
}) {
  const [filtroTexto, setFiltroTexto] = useState("");
  const [soloMarcadas, setSoloMarcadas] = useState(false);

  const toggleCasilla = (seccionId, pieza, colLetra) => {
    const key = buildPiezaKey(seccionId, pieza);
    const actual = marcaciones[key] || { C: false, R: false, P: false, nota: "" };
    const actualizado = {
      ...actual,
      [colLetra]: !actual[colLetra],
    };
    const nuevas = { ...marcaciones };
    if (
      !actualizado.C &&
      !actualizado.R &&
      !actualizado.P &&
      !actualizado.nota
    ) {
      delete nuevas[key];
    } else {
      nuevas[key] = actualizado;
    }
    setMarcaciones(nuevas);
  };

  const handleRubroChange = (field, value) => {
    setRubrosImportes({
      ...rubrosImportes,
      [field]: value,
    });
  };

  const totalManoObraRubros =
    (Number(rubrosImportes.mano_obra) || 0) +
    (Number(rubrosImportes.pintura) || 0) +
    (Number(rubrosImportes.mecanica) || 0) +
    (Number(rubrosImportes.electricidad) || 0) +
    (Number(rubrosImportes.tapiceria) || 0) +
    (Number(rubrosImportes.iva) || 0);

  const repuestosVal = Number(rubrosImportes.repuestos) || 0;
  const incluirRepuestos = Boolean(rubrosImportes.incluir_repuestos_en_total);
  const totalPlanilla =
    totalManoObraRubros + (incluirRepuestos ? repuestosVal : 0);

  const cantidadMarcadas = countMarkedItems(marcaciones);

  return (
    <div>
      {/* Barra superior de referencia C / R / P y filtro rápido */}
      <div className="d-flex flex-wrap justify-content-between align-items-center bg-dark text-white px-3 py-2 rounded-top border border-dark gap-2">
        <div className="d-flex align-items-center gap-3">
          <span className="fw-bold text-warning">
            <i className="bi bi-check2-square me-1"></i>
            Haga clic en los cuadraditos para marcar con una X:
          </span>
          <span className="badge bg-light text-dark fs-6">
            <strong>C:</strong> Cambiar
          </span>
          <span className="badge bg-light text-dark fs-6">
            <strong>R:</strong> Reparar
          </span>
          <span className="badge bg-light text-dark fs-6">
            <strong>P:</strong> Pintar
          </span>
        </div>

        <div className="d-flex align-items-center gap-2">
          <span className="badge bg-primary">
            {cantidadMarcadas} pieza(s) marcada(s) con [X]
          </span>
          <div className="form-check form-switch mb-0 ms-2">
            <input
              className="form-check-input"
              type="checkbox"
              id="soloMarcadasSwitch"
              checked={soloMarcadas}
              onChange={(e) => setSoloMarcadas(e.target.checked)}
            />
            <label
              className="form-check-label small text-white"
              htmlFor="soloMarcadasSwitch"
            >
              Ver solo marcadas
            </label>
          </div>
          <input
            type="text"
            className="form-control form-control-sm"
            style={{ width: "200px" }}
            placeholder="Filtrar pieza (ej. capot, puerta)..."
            value={filtroTexto}
            onChange={(e) => setFiltroTexto(e.target.value)}
          />
        </div>
      </div>

      {/* Grilla de 3 Columnas idéntica a la Planilla de Taller Sergio */}
      <div className="row g-2 bg-white p-2 border border-top-0 border-dark">
        {PLANILLA_ASEGURADORA_COLUMNAS.map((seccionesColumna, colIdx) => (
          <div key={colIdx} className="col-lg-4">
            {seccionesColumna.map((seccion) => {
              const piezasFiltradas = seccion.piezas.filter((pieza) => {
                const key = buildPiezaKey(seccion.id, pieza);
                const m = marcaciones[key];
                const tieneMarca = m && (m.C || m.R || m.P);
                if (soloMarcadas && !tieneMarca) return false;
                if (
                  filtroTexto.trim() &&
                  !pieza.toLowerCase().includes(filtroTexto.trim().toLowerCase())
                ) {
                  return false;
                }
                return true;
              });

              if (piezasFiltradas.length === 0) return null;

              return (
                <div
                  key={seccion.id}
                  className="mb-2 border border-dark"
                  style={{ fontSize: "0.78rem" }}
                >
                  {/* Encabezado de la sección (ej. PARTE DELANTERA | C | R | P) */}
                  <div className="d-flex bg-secondary-subtle border-bottom border-dark fw-bold">
                    <div className="flex-grow-1 px-2 py-1 text-uppercase">
                      {seccion.titulo}
                    </div>
                    {seccion.columnas.map((letra) => (
                      <div
                        key={letra}
                        className="text-center border-start border-dark py-1"
                        style={{ width: "34px" }}
                      >
                        {letra}
                      </div>
                    ))}
                  </div>

                  {/* Renglones de piezas con sus cuadraditos [X] */}
                  {piezasFiltradas.map((pieza) => {
                    const key = buildPiezaKey(seccion.id, pieza);
                    const estadoPieza = marcaciones[key] || {};
                    const algunaMarcada =
                      estadoPieza.C || estadoPieza.R || estadoPieza.P;

                    return (
                      <div
                        key={pieza}
                        className={`d-flex align-items-center border-bottom ${
                          algunaMarcada ? "bg-warning-subtle fw-bold" : ""
                        }`}
                      >
                        <div className="flex-grow-1 px-2 py-1 text-truncate">
                          {pieza}
                        </div>
                        {seccion.columnas.map((letra) => {
                          const marcada = Boolean(estadoPieza[letra]);
                          return (
                            <div
                              key={letra}
                              onClick={() =>
                                toggleCasilla(seccion.id, pieza, letra)
                              }
                              role="button"
                              title={`${pieza} - ${
                                letra === "C"
                                  ? "Cambiar"
                                  : letra === "R"
                                  ? "Reparar"
                                  : "Pintar"
                              }`}
                              className={`text-center border-start border-dark user-select-none d-flex align-items-center justify-content-center ${
                                marcada
                                  ? "bg-dark text-white fw-black"
                                  : "bg-white text-muted"
                              }`}
                              style={{
                                width: "34px",
                                height: "25px",
                                cursor: "pointer",
                                fontSize: "0.92rem",
                                fontWeight: 900,
                              }}
                            >
                              {marcada ? "X" : ""}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {/* Al pie de la Columna 3 va el recuadro oficial de importes de la planilla */}
            {colIdx === 2 && (
              <div className="border border-2 border-dark p-3 bg-light mt-2">
                <div className="fw-bold text-uppercase small border-bottom border-dark pb-1 mb-2">
                  Importes al Pie de Planilla (Taller Sergio)
                </div>

                {[
                  { key: "mano_obra", label: "MANO DE OBRA $" },
                  { key: "pintura", label: "PINTURA $" },
                  { key: "mecanica", label: "MECÁNICA $" },
                  { key: "electricidad", label: "ELECTRICIDAD $" },
                  { key: "tapiceria", label: "TAPICERÍA $" },
                  { key: "repuestos", label: "REPUESTOS $" },
                  { key: "iva", label: "I.V.A. $" },
                ].map((r) => (
                  <div
                    key={r.key}
                    className="d-flex align-items-center justify-content-between mb-1 gap-2"
                  >
                    <label
                      className="small fw-bold mb-0"
                      style={{ minWidth: "130px" }}
                    >
                      {r.label}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      className="form-control form-control-sm text-end fw-semibold border-dark"
                      placeholder="0"
                      value={rubrosImportes[r.key] ?? ""}
                      onChange={(e) => handleRubroChange(r.key, e.target.value)}
                    />
                  </div>
                ))}

                <div className="form-check mt-2 mb-2 small">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="incluirRepuestosCheck"
                    checked={incluirRepuestos}
                    onChange={(e) =>
                      handleRubroChange(
                        "incluir_repuestos_en_total",
                        e.target.checked
                      )
                    }
                  />
                  <label
                    className="form-check-label small"
                    htmlFor="incluirRepuestosCheck"
                  >
                    Sumar Repuestos al Total $ (marcar cuando el taller cotiza los repuestos en la planilla como en las fotos)
                  </label>
                </div>

                <div className="border border-2 border-dark bg-white p-2 mt-2 d-flex justify-content-between align-items-center">
                  <span className="fw-black fs-6">TOTAL $</span>
                  <span className="fw-black fs-5 text-primary">
                    ${" "}
                    {totalPlanilla.toLocaleString("es-AR", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
