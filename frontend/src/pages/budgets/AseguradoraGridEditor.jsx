import React, { useState } from "react";
import {
  PLANILLA_ASEGURADORA_COLUMNAS,
  buildPiezaKey,
  countMarkedItems,
} from "./aseguradoraPlanillaCatalog";

/**
 * Planilla Digital Interactiva de Compañías Aseguradoras (Anexo 2 del TFG).
 * Incluye el encabezado oficial idéntico al papel físico de Taller Sergio:
 * - Membrete "SERGIO Carrocería y Pintura - De Martín Pablo César" + "[X] Documento No Válido como Factura" + "PRESUPUESTO N° y FECHA"
 * - Renglones punteados editables: APELLIDO Y NOMBRE, TEL., DOMICILIO, TEL., VEHÍCULO, COLOR, MODELO, DOMINIO
 * - Grilla de 3 columnas con cuadraditos [X] para C: Cambiar | R: Reparar | P: Pintar
 */
export default function AseguradoraGridEditor({
  presupuestoNumero,
  datosCabeceraPlanilla,
  setDatosCabeceraPlanilla,
  marcaciones,
  setMarcaciones,
  rubrosImportes,
  setRubrosImportes,
}) {
  const [filtroTexto, setFiltroTexto] = useState("");
  const [soloMarcadas, setSoloMarcadas] = useState(false);

  const hoy = new Date();
  const dia = datosCabeceraPlanilla.fecha_dia || String(hoy.getDate()).padStart(2, "0");
  const mes = datosCabeceraPlanilla.fecha_mes || String(hoy.getMonth() + 1).padStart(2, "0");
  const anio = datosCabeceraPlanilla.fecha_anio || String(hoy.getFullYear()).slice(-2);

  const handleHeaderField = (field, val) => {
    setDatosCabeceraPlanilla({
      ...datosCabeceraPlanilla,
      [field]: val,
    });
  };

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

  // Estilo de input sobre línea punteada igual a la planilla física
  const dottedInputStyle = {
    border: "none",
    borderBottom: "1.5px dotted #1f2937",
    borderRadius: 0,
    backgroundColor: "transparent",
    padding: "0.1rem 0.35rem",
    fontWeight: 600,
    color: "#111827",
    outline: "none",
    width: "100%",
  };

  return (
    <div className="bg-white border border-2 border-dark p-3 rounded-2 shadow-sm">
      {/* =========================================================================
          ENCABEZADO OFICIAL DE LA PLANILLA DE TALLER SERGIO (IDÉNTICO A LA FOTO)
          ========================================================================= */}
      <div
        className="border border-2 border-dark px-3 py-2 mb-3"
        style={{ borderRadius: "14px" }}
      >
        <div className="row align-items-center g-2">
          {/* Izquierda: Logo SERGIO + Dirección y Teléfonos */}
          <div className="col-lg-6 d-flex align-items-center gap-3 flex-wrap">
            <div className="text-center">
              <div
                style={{
                  fontSize: "2.5rem",
                  fontWeight: 900,
                  fontStyle: "italic",
                  letterSpacing: "1px",
                  lineHeight: 0.95,
                }}
              >
                SERGIO
              </div>
              <div
                className="bg-dark text-white px-2 py-0 fw-bold text-uppercase mt-1"
                style={{ fontSize: "0.72rem", letterSpacing: "0.5px" }}
              >
                CARROCERÍA Y PINTURA
              </div>
              <div
                className="fst-italic fw-semibold mt-1"
                style={{ fontSize: "0.78rem" }}
              >
                De Martín Pablo César
              </div>
            </div>

            <div style={{ fontSize: "0.8rem", lineHeight: "1.25rem" }}>
              <div>Boedo 1627 esq. Agustín Garzón</div>
              <div>B° 1° de Mayo - Córdoba</div>
              <div className="fw-bold">CEL.: (0351) 152165277</div>
              <div>martin-pablo@outlook.com.ar</div>
              <div>tallersergio1627@gmail.com</div>
            </div>
          </div>

          {/* Centro: Cuadro [ X ] Documento No Válido como Factura */}
          <div className="col-lg-2 text-center d-flex flex-column align-items-center justify-content-center">
            <div
              className="border border-2 border-dark d-flex align-items-center justify-content-center fw-bold"
              style={{
                width: "42px",
                height: "42px",
                fontSize: "1.55rem",
                borderRadius: "4px",
              }}
            >
              X
            </div>
            <div
              className="text-center mt-1"
              style={{ fontSize: "0.62rem", lineHeight: "0.72rem" }}
            >
              <div>Documento</div>
              <div>No Válido</div>
              <div>como</div>
              <div>Factura</div>
            </div>
            <div
              style={{
                width: "2px",
                height: "14px",
                backgroundColor: "#111827",
                marginTop: "2px",
              }}
            ></div>
          </div>

          {/* Derecha: PRESUPUESTO N° y cajas de FECHA [DD] [MM] [AA] */}
          <div className="col-lg-4 text-center text-lg-end">
            <div
              className="fw-semibold text-uppercase text-center"
              style={{ fontSize: "1.15rem", letterSpacing: "1px" }}
            >
              PRESUPUESTO
            </div>
            <div className="text-center small fw-bold mb-1">
              N°:{" "}
              {presupuestoNumero
                ? String(presupuestoNumero).padStart(4, "0")
                : "NUEVO"}
            </div>
            <div className="d-flex justify-content-center gap-2">
              <input
                type="text"
                maxLength={2}
                className="border border-2 border-dark text-center fw-bold"
                style={{
                  width: "46px",
                  height: "38px",
                  fontSize: "1.1rem",
                  borderRadius: "4px",
                }}
                value={dia}
                onChange={(e) => handleHeaderField("fecha_dia", e.target.value)}
              />
              <input
                type="text"
                maxLength={2}
                className="border border-2 border-dark text-center fw-bold"
                style={{
                  width: "46px",
                  height: "38px",
                  fontSize: "1.1rem",
                  borderRadius: "4px",
                }}
                value={mes}
                onChange={(e) => handleHeaderField("fecha_mes", e.target.value)}
              />
              <input
                type="text"
                maxLength={2}
                className="border border-2 border-dark text-center fw-bold"
                style={{
                  width: "46px",
                  height: "38px",
                  fontSize: "1.1rem",
                  borderRadius: "4px",
                }}
                value={anio}
                onChange={(e) => handleHeaderField("fecha_anio", e.target.value)}
              />
            </div>
            <div
              className="text-center fw-semibold mt-1"
              style={{ fontSize: "0.75rem" }}
            >
              FECHA:
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          RENGLONES PUNTEADOS DEL CLIENTE Y VEHÍCULO (IDÉNTICO A LA PLANILLA FÍSICA)
          ========================================================================= */}
      <div className="px-1 mb-2" style={{ fontSize: "0.86rem" }}>
        {/* Renglón 1: APELLIDO Y NOMBRE ... TEL. */}
        <div className="row g-2 align-items-end mb-2">
          <div className="col-md-8 d-flex align-items-end">
            <span className="fw-bold text-nowrap me-2">APELLIDO Y NOMBRE:</span>
            <input
              type="text"
              style={dottedInputStyle}
              placeholder="Ej.: NOVACK MARIA ANDREA"
              value={datosCabeceraPlanilla.apellido_nombre || ""}
              onChange={(e) =>
                handleHeaderField("apellido_nombre", e.target.value)
              }
            />
          </div>
          <div className="col-md-4 d-flex align-items-end">
            <span className="fw-bold text-nowrap me-2">TEL.:</span>
            <input
              type="text"
              style={dottedInputStyle}
              placeholder="Ej.: 351-6124890"
              value={datosCabeceraPlanilla.telefono_1 || ""}
              onChange={(e) => handleHeaderField("telefono_1", e.target.value)}
            />
          </div>
        </div>

        {/* Renglón 2: DOMICILIO ... TEL. */}
        <div className="row g-2 align-items-end mb-2">
          <div className="col-md-8 d-flex align-items-end">
            <span className="fw-bold text-nowrap me-2">DOMICILIO:</span>
            <input
              type="text"
              style={dottedInputStyle}
              placeholder="Calle, número y barrio"
              value={datosCabeceraPlanilla.domicilio || ""}
              onChange={(e) => handleHeaderField("domicilio", e.target.value)}
            />
          </div>
          <div className="col-md-4 d-flex align-items-end">
            <span className="fw-bold text-nowrap me-2">TEL.:</span>
            <input
              type="text"
              style={dottedInputStyle}
              placeholder="Teléfono alternativo"
              value={datosCabeceraPlanilla.telefono_2 || ""}
              onChange={(e) => handleHeaderField("telefono_2", e.target.value)}
            />
          </div>
        </div>

        {/* Renglón 3: VEHÍCULO ... COLOR ... MODELO ... DOMINIO */}
        <div className="row g-2 align-items-end">
          <div className="col-md-4 d-flex align-items-end">
            <span className="fw-bold text-nowrap me-2">VEHÍCULO:</span>
            <input
              type="text"
              style={dottedInputStyle}
              placeholder="Ej.: Fiat Palio Fire"
              value={datosCabeceraPlanilla.vehiculo_texto || ""}
              onChange={(e) =>
                handleHeaderField("vehiculo_texto", e.target.value)
              }
            />
          </div>
          <div className="col-md-3 d-flex align-items-end">
            <span className="fw-bold text-nowrap me-2">COLOR:</span>
            <input
              type="text"
              style={dottedInputStyle}
              placeholder="Ej.: Gris"
              value={datosCabeceraPlanilla.color_texto || ""}
              onChange={(e) => handleHeaderField("color_texto", e.target.value)}
            />
          </div>
          <div className="col-md-2 d-flex align-items-end">
            <span className="fw-bold text-nowrap me-2">MODELO:</span>
            <input
              type="text"
              style={dottedInputStyle}
              placeholder="Ej.: 2008"
              value={datosCabeceraPlanilla.modelo_anio || ""}
              onChange={(e) => handleHeaderField("modelo_anio", e.target.value)}
            />
          </div>
          <div className="col-md-3 d-flex align-items-end">
            <span className="fw-bold text-nowrap me-2">DOMINIO:</span>
            <input
              type="text"
              style={{ ...dottedInputStyle, textTransform: "uppercase" }}
              placeholder="Ej.: HCZ 770"
              value={datosCabeceraPlanilla.dominio_patente || ""}
              onChange={(e) =>
                handleHeaderField("dominio_patente", e.target.value.toUpperCase())
              }
            />
          </div>
        </div>
      </div>

      {/* Línea divisoria negra + Leyenda central C: Cambiar | R: Reparar | P: Pintar */}
      <div className="border-top border-2 border-dark pt-2 pb-2 d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div className="fw-bold fs-6 mx-auto">
          C: Cambiar &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; R: Reparar
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; P: Pintar
        </div>

        <div className="d-flex align-items-center gap-2">
          <span className="badge bg-dark">
            {cantidadMarcadas} marcada(s) con [X]
          </span>
          <div className="form-check form-switch mb-0">
            <input
              className="form-check-input"
              type="checkbox"
              id="soloMarcadasSwitch"
              checked={soloMarcadas}
              onChange={(e) => setSoloMarcadas(e.target.checked)}
            />
            <label
              className="form-check-label small fw-semibold"
              htmlFor="soloMarcadasSwitch"
            >
              Solo marcadas
            </label>
          </div>
          <input
            type="text"
            className="form-control form-control-sm border-dark"
            style={{ width: "185px" }}
            placeholder="Buscar pieza..."
            value={filtroTexto}
            onChange={(e) => setFiltroTexto(e.target.value)}
          />
        </div>
      </div>

      {/* =========================================================================
          GRILLA DE 3 COLUMNAS CON CASILLAS [X] (PARTE DELANTERA, TRASERA, ETC.)
          ========================================================================= */}
      <div className="row g-2">
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
                    Sumar Repuestos $ al TOTAL $ de la planilla
                  </label>
                </div>

                <div className="text-center my-2 py-1 border-top border-bottom border-dark small">
                  <div className="fw-bold">TALLER SERGIO</div>
                  <div>Pablo Martín • 3512165277</div>
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
