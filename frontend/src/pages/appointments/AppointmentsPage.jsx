import React, { useEffect, useState } from "react";
import {
  deleteTurnoTaller,
  getTurnosTaller,
  updateTurnoTaller,
} from "../../api/workordersApi";
import { useAuth } from "../../context/AuthContext";
import AppointmentModal from "./AppointmentModal";

const MESES_NOMBRES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const TIPO_BADGE = {
  ingreso_reparacion: {
    label: "Ingreso a Reparación",
    cls: "bg-primary text-white",
  },
  peritaje_seguro: {
    label: "Peritaje Seguro",
    cls: "bg-info text-dark",
  },
  cotizacion: {
    label: "Presupuesto",
    cls: "bg-warning text-dark",
  },
  entrega_unidad: {
    label: "Entrega Unidad",
    cls: "bg-success text-white",
  },
};

const ESTADO_BADGE = {
  programado: { label: "Programado", cls: "bg-primary" },
  ingresado: { label: "Recibido en Taller", cls: "bg-success" },
  reprogramado: { label: "Reprogramado", cls: "bg-warning text-dark" },
  cancelado: { label: "Cancelado", cls: "bg-secondary" },
};

const toIsoDate = (year, monthIndex, day) => {
  const m = String(monthIndex + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
};

const formatDateShort = (dateStr) => {
  if (!dateStr) return "—";
  const parts = String(dateStr).split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
};

export default function AppointmentsPage() {
  const { user } = useAuth();
  const canEdit =
    user?.rol === "administrador" || user?.rol === "administrativo";

  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth()); // 0..11
  const [turnos, setTurnos] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editingTurno, setEditingTurno] = useState(null);
  const [selectedDateForNew, setSelectedDateForNew] = useState(null);

  const loadTurnos = async () => {
    setLoading(true);
    try {
      const data = await getTurnosTaller({
        anio: currentYear,
        mes: currentMonth + 1,
      });
      setTurnos(Array.isArray(data) ? data : data.results || []);
    } catch (err) {
      console.error("Error cargando turnos del calendario:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTurnos();
  }, [currentYear, currentMonth]);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleToday = () => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());
  };

  const handleMarcarIngresado = async (turno) => {
    try {
      await updateTurnoTaller(turno.id_turno, { estado: "ingresado" });
      loadTurnos();
    } catch (err) {
      console.error("Error actualizando estado del turno:", err);
    }
  };

  const handleDeleteTurno = async (turno) => {
    if (
      !window.confirm(
        `¿Eliminar el turno agendado para ${turno.patente_display} del día ${formatDateShort(
          turno.fecha_turno
        )}?`
      )
    ) {
      return;
    }
    try {
      await deleteTurnoTaller(turno.id_turno);
      loadTurnos();
    } catch (err) {
      console.error("Error eliminando turno:", err);
    }
  };

  // Construcción de las celdas del mes (Lunes a Domingo)
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  // En JS getDay() devuelve 0=Dom .. 6=Sáb. Convertimos a 0=Lun .. 6=Dom
  const startOffset = (firstDayOfMonth.getDay() + 6) % 7;

  const calendarCells = [];
  for (let i = 0; i < startOffset; i++) {
    calendarCells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    calendarCells.push(d);
  }
  while (calendarCells.length % 7 !== 0) {
    calendarCells.push(null);
  }

  const todayIso = toIsoDate(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  const turnosProgramados = turnos.filter((t) => t.estado === "programado").length;
  const turnosIngresados = turnos.filter((t) => t.estado === "ingresado").length;
  const turnosPeritajes = turnos.filter(
    (t) => t.tipo_turno === "peritaje_seguro"
  ).length;

  return (
    <div>
      {/* Encabezado */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
        <div>
          <h4 className="fw-bold mb-1">
            <i className="bi bi-calendar-week-fill text-primary me-2"></i>
            Calendario y Turnos de Ingreso al Taller
          </h4>
          <p className="text-muted small mb-0">
            Agenda visual para programar cuándo ingresa cada vehículo a planta, visitas de peritos y entregas comprometidas.
          </p>
        </div>

        {canEdit && (
          <button
            type="button"
            className="btn btn-primary fw-semibold shadow-sm"
            onClick={() => {
              setEditingTurno(null);
              setSelectedDateForNew(todayIso);
              setShowModal(true);
            }}
          >
            <i className="bi bi-calendar-plus me-2"></i>
            Agendar Nuevo Turno
          </button>
        )}
      </div>

      {/* Tarjetas Resumen del Mes */}
      <div className="row g-3 mb-4">
        <div className="col-md-4">
          <div className="card border-0 shadow-sm border-start border-primary border-4">
            <div className="card-body py-3 d-flex justify-content-between align-items-center">
              <div>
                <div className="text-muted small fw-semibold">
                  TURNOS PROGRAMADOS EN EL MES
                </div>
                <div className="fs-3 fw-bold text-primary">
                  {turnosProgramados}
                </div>
              </div>
              <i className="bi bi-calendar-event fs-1 text-primary opacity-50"></i>
            </div>
          </div>
        </div>

        <div className="col-md-4">
          <div className="card border-0 shadow-sm border-start border-success border-4">
            <div className="card-body py-3 d-flex justify-content-between align-items-center">
              <div>
                <div className="text-muted small fw-semibold">
                  VEHÍCULOS YA RECIBIDOS
                </div>
                <div className="fs-3 fw-bold text-success">
                  {turnosIngresados}
                </div>
              </div>
              <i className="bi bi-car-front-fill fs-1 text-success opacity-50"></i>
            </div>
          </div>
        </div>

        <div className="col-md-4">
          <div className="card border-0 shadow-sm border-start border-info border-4">
            <div className="card-body py-3 d-flex justify-content-between align-items-center">
              <div>
                <div className="text-muted small fw-semibold">
                  INSPECCIONES / PERITAJES DE SEGUROS
                </div>
                <div className="fs-3 fw-bold text-dark">{turnosPeritajes}</div>
              </div>
              <i className="bi bi-shield-check fs-1 text-info opacity-50"></i>
            </div>
          </div>
        </div>
      </div>

      {/* Calendario Mensual Interactivo */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={handlePrevMonth}
            >
              <i className="bi bi-chevron-left"></i>
            </button>
            <h5 className="fw-bold mb-0 mx-2">
              {MESES_NOMBRES[currentMonth]} {currentYear}
            </h5>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={handleNextMonth}
            >
              <i className="bi bi-chevron-right"></i>
            </button>
            <button
              type="button"
              className="btn btn-link btn-sm text-decoration-none ms-2"
              onClick={handleToday}
            >
              Ir a Hoy
            </button>
          </div>

          <small className="text-muted d-none d-md-inline">
            {canEdit
              ? "Hacé clic en el botón (+) de cualquier día para anotar un ingreso en esa fecha"
              : "Vista de consulta de ingresos programados"}
          </small>
        </div>

        <div className="card-body p-0">
          {/* Cabecera Lunes a Domingo */}
          <div
            className="d-grid border-bottom bg-light text-center fw-bold small py-2 text-secondary"
            style={{ gridTemplateColumns: "repeat(7, 1fr)" }}
          >
            {DIAS_SEMANA.map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>

          {/* Celdas del Calendario */}
          <div
            className="d-grid"
            style={{ gridTemplateColumns: "repeat(7, 1fr)" }}
          >
            {calendarCells.map((dayNumber, idx) => {
              if (!dayNumber) {
                return (
                  <div
                    key={`empty-${idx}`}
                    className="border-end border-bottom bg-light bg-opacity-50"
                    style={{ minHeight: "120px" }}
                  ></div>
                );
              }

              const cellIso = toIsoDate(currentYear, currentMonth, dayNumber);
              const isToday = cellIso === todayIso;
              const dayTurnos = turnos.filter((t) => t.fecha_turno === cellIso);

              return (
                <div
                  key={cellIso}
                  className={`border-end border-bottom p-2 d-flex flex-column justify-content-between ${
                    isToday ? "bg-primary-subtle bg-opacity-25" : "bg-white"
                  }`}
                  style={{ minHeight: "125px" }}
                >
                  <div>
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <span
                        className={`fw-bold small px-2 py-0 rounded-pill ${
                          isToday ? "bg-primary text-white" : "text-dark"
                        }`}
                      >
                        {dayNumber}
                      </span>

                      {canEdit && (
                        <button
                          type="button"
                          className="btn btn-sm btn-link p-0 text-secondary"
                          title={`Agendar ingreso el ${formatDateShort(cellIso)}`}
                          onClick={() => {
                            setEditingTurno(null);
                            setSelectedDateForNew(cellIso);
                            setShowModal(true);
                          }}
                        >
                          <i className="bi bi-plus-circle"></i>
                        </button>
                      )}
                    </div>

                    {/* Píldoras de turnos agendados en el día */}
                    <div className="d-flex flex-column gap-1">
                      {dayTurnos.map((t) => {
                        const meta =
                          TIPO_BADGE[t.tipo_turno] ||
                          TIPO_BADGE.ingreso_reparacion;
                        const isCancelled = t.estado === "cancelado";

                        return (
                          <div
                            key={t.id_turno}
                            onClick={() => {
                              if (canEdit) {
                                setEditingTurno(t);
                                setShowModal(true);
                              }
                            }}
                            style={{
                              cursor: canEdit ? "pointer" : "default",
                              fontSize: "0.75rem",
                            }}
                            className={`p-1 rounded border shadow-sm text-truncate ${
                              isCancelled
                                ? "bg-light text-muted text-decoration-line-through"
                                : t.estado === "ingresado"
                                ? "bg-success-subtle text-success border-success"
                                : meta.cls
                            }`}
                            title={`${t.hora_turno?.slice(0, 5)} hs - ${
                              t.patente_display
                            } (${t.vehiculo_display}) - ${t.cliente_display}`}
                          >
                            <strong>{t.hora_turno?.slice(0, 5)}</strong>{" "}
                            {t.patente_display} • {t.cliente_display}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Listado Detallado de Turnos del Mes */}
      <div className="card border-0 shadow-sm">
        <div className="card-header bg-white py-3">
          <h6 className="fw-bold mb-0">
            <i className="bi bi-list-ul text-primary me-2"></i>
            Detalle de Ingresos y Turnos de {MESES_NOMBRES[currentMonth]}{" "}
            {currentYear} ({turnos.length})
          </h6>
        </div>

        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>Fecha y Hora</th>
                <th>Motivo</th>
                <th>Patente y Vehículo</th>
                <th>Cliente y Teléfono</th>
                <th>Aseguradora</th>
                <th>Trabajo / Observaciones</th>
                <th>Estado</th>
                {canEdit && <th className="text-end">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="text-center py-4 text-muted">
                    Cargando agenda del mes...
                  </td>
                </tr>
              ) : turnos.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-4 text-muted">
                    No hay turnos agendados en este mes. Hacé clic en "Agendar Nuevo Turno" para anotar un ingreso.
                  </td>
                </tr>
              ) : (
                turnos.map((t) => {
                  const tipoMeta =
                    TIPO_BADGE[t.tipo_turno] || TIPO_BADGE.ingreso_reparacion;
                  const estMeta =
                    ESTADO_BADGE[t.estado] || ESTADO_BADGE.programado;

                  return (
                    <tr key={t.id_turno}>
                      <td className="fw-bold">
                        {formatDateShort(t.fecha_turno)}{" "}
                        <span className="text-primary">
                          {t.hora_turno?.slice(0, 5)} hs
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${tipoMeta.cls}`}>
                          {tipoMeta.label}
                        </span>
                      </td>
                      <td>
                        <span className="badge bg-dark me-1">
                          {t.patente_display}
                        </span>
                        <span className="fw-semibold">{t.vehiculo_display}</span>
                      </td>
                      <td>
                        <div className="fw-semibold">{t.cliente_display}</div>
                        {t.telefono_display && (
                          <small className="text-muted">
                            <i className="bi bi-telephone me-1"></i>
                            {t.telefono_display}
                          </small>
                        )}
                      </td>
                      <td>
                        {t.compania_nombre ? (
                          <span className="badge bg-info-subtle text-dark border">
                            {t.compania_nombre}
                          </span>
                        ) : (
                          <span className="text-muted small">Particular</span>
                        )}
                      </td>
                      <td className="small text-muted">
                        {t.motivo_observaciones || "—"}
                      </td>
                      <td>
                        <span className={`badge ${estMeta.cls}`}>
                          {estMeta.label}
                        </span>
                      </td>
                      {canEdit && (
                        <td className="text-end">
                          <div className="btn-group btn-group-sm">
                            {t.estado === "programado" && (
                              <button
                                type="button"
                                className="btn btn-outline-success"
                                title="Confirmar que el auto ya ingresó físicamente al taller"
                                onClick={() => handleMarcarIngresado(t)}
                              >
                                <i className="bi bi-check2-circle me-1"></i>
                                Recibido
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn btn-outline-dark"
                              title="Editar o reprogramar turno"
                              onClick={() => {
                                setEditingTurno(t);
                                setShowModal(true);
                              }}
                            >
                              <i className="bi bi-pencil"></i>
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline-danger"
                              title="Eliminar turno"
                              onClick={() => handleDeleteTurno(t)}
                            >
                              <i className="bi bi-trash"></i>
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <AppointmentModal
          turno={editingTurno}
          defaultDate={selectedDateForNew}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false);
            loadTurnos();
          }}
        />
      )}
    </div>
  );
}
