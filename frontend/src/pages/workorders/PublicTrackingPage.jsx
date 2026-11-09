import React, { useState } from "react";
import { Link } from "react-router-dom";
import { consultarSeguimientoPublico } from "../../api/workordersApi";

const formatDateShort = (dateStr) => {
  if (!dateStr) return "—";
  const parts = String(dateStr).split("T")[0].split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
};

const FACTORES_FASES = {
  Recepción: {
    descripcion:
      "Recibimos el vehículo, lo inspeccionamos junto a vos y registramos su estado y los daños a reparar.",
    factores: [
      "Aprobación del presupuesto (tuyo o de tu aseguradora)",
      "Documentación y datos completos del vehículo",
    ],
  },
  Desarme: {
    descripcion:
      "Desmontamos las piezas afectadas para evaluar el daño real, incluso el que no se ve a simple vista.",
    factores: [
      "Daños ocultos que aparecen al desarmar",
      "Pedido y llegada de repuestos necesarios",
    ],
  },
  Chapa: {
    descripcion:
      "Reparamos o reemplazamos la estructura y los paneles dañados hasta devolverles su forma original.",
    factores: [
      "Gravedad y cantidad de piezas dañadas",
      "Disponibilidad de repuestos originales o alternativos",
    ],
  },
  Preparación: {
    descripcion:
      "Masillamos, lijamos e imprimamos las superficies para que la pintura quede pareja y duradera.",
    factores: [
      "Tiempos de secado de masillas y fondos",
      "Cantidad de superficie a preparar",
    ],
  },
  Pintura: {
    descripcion:
      "Aplicamos el color y el barniz en cabina, igualando el tono original de tu vehículo.",
    factores: [
      "Código de color y ajuste del tono",
      "Clima y humedad (afectan el secado)",
      "Tiempo de horneado y curado de la pintura",
    ],
  },
  Armado: {
    descripcion:
      "Volvemos a colocar las piezas, molduras, ópticas y accesorios desmontados.",
    factores: [
      "Llegada de piezas y accesorios pendientes",
      "Verificación de ajustes y funcionamiento",
    ],
  },
  Pulido: {
    descripcion:
      "Pulimos y lustramos las zonas pintadas para lograr el brillo y la terminación final.",
    factores: [
      "Curado completo de la pintura antes de pulir",
      "Terminación exigida por tipo de pintura",
    ],
  },
  "Alistado para entrega": {
    descripcion:
      "Realizamos el control de calidad final y la limpieza. Te avisamos para que retires tu vehículo.",
    factores: [
      "Control de calidad final",
      "Coordinación de la fecha de retiro con vos",
    ],
  },
};

const FACTORES_GENERALES = [
  {
    icono: "bi-box-seam",
    titulo: "Disponibilidad de repuestos",
    texto:
      "Si una pieza debe pedirse a proveedores, el plazo depende de su entrega.",
  },
  {
    icono: "bi-shield-check",
    titulo: "Aprobaciones de la aseguradora",
    texto:
      "En siniestros, la inspección del perito y la autorización de la compañía pueden demorar el inicio o la continuidad.",
  },
  {
    icono: "bi-search",
    titulo: "Daños ocultos",
    texto:
      "Al desarmar pueden aparecer daños adicionales que requieren una ampliación del trabajo.",
  },
  {
    icono: "bi-cloud-sun",
    titulo: "Secado y clima",
    texto:
      "La pintura, el barniz y las masillas necesitan tiempos de secado que varían con la humedad y la temperatura.",
  },
  {
    icono: "bi-palette",
    titulo: "Color y terminación",
    texto:
      "Igualar el tono original puede requerir pruebas y ajustes antes de pintar.",
  },
  {
    icono: "bi-calendar-check",
    titulo: "Carga de trabajo del taller",
    texto:
      "La cantidad de vehículos en planta y la complejidad de cada uno influyen en los tiempos de cada etapa.",
  },
];

export default function PublicTrackingPage() {
  const [codigo, setCodigo] = useState("");
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
              dominio/patente de tu vehículo.
            </p>

            <form onSubmit={handleSearch} className="d-flex gap-2">
              <input
                type="text"
                className="form-control form-control-lg text-uppercase fw-bold"
                placeholder="Código OT o Patente"
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
                {(orden.fases || []).map((fase) => {
                  const info = FACTORES_FASES[fase.nombre_fase];
                  const enCurso = fase.estado === "en_curso";
                  return (
                    <div
                      key={fase.orden_secuencia}
                      className={`list-group-item py-3 ${
                        enCurso ? "border-primary bg-primary-subtle" : ""
                      }`}
                    >
                      <div className="d-flex justify-content-between align-items-center">
                        <div className="d-flex align-items-center gap-3">
                          <span
                            className={`badge rounded-pill ${
                              fase.estado === "completada"
                                ? "bg-success"
                                : enCurso
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
                              : enCurso
                              ? "bg-primary"
                              : "bg-light text-muted border"
                          }`}
                        >
                          {fase.estado === "completada"
                            ? "Finalizada"
                            : enCurso
                            ? "En Proceso Ahora"
                            : "Pendiente"}
                        </span>
                      </div>

                      {info && (
                        <div className="mt-2 ms-5 small">
                          <div className="text-muted">{info.descripcion}</div>
                          <div className="mt-1">
                            <span className="fw-semibold text-secondary">
                              Qué puede influir en esta etapa:
                            </span>
                            <ul className="mb-0 ps-3 text-muted">
                              {info.factores.map((f) => (
                                <li key={f}>{f}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <h6 className="fw-bold text-uppercase text-secondary small mt-4 mb-3">
                Factores que pueden modificar la fecha estimada
              </h6>
              <div className="row g-2">
                {FACTORES_GENERALES.map((f) => (
                  <div className="col-md-6" key={f.titulo}>
                    <div className="p-3 rounded bg-light border h-100 small">
                      <div className="fw-semibold mb-1">
                        <i className={`bi ${f.icono} text-primary me-2`}></i>
                        {f.titulo}
                      </div>
                      <div className="text-muted">{f.texto}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-muted small mt-3">
                <i className="bi bi-info-circle me-1"></i>
                La fecha de entrega es estimada. Si algún factor la modifica, el
                taller te lo informará.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
