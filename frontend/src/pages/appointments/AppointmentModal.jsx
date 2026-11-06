import React, { useEffect, useState } from "react";
import { getAseguradoras, getVehiculos } from "../../api/coreApi";
import { createTurnoTaller, updateTurnoTaller } from "../../api/workordersApi";

const TIPOS_TURNO = [
  {
    value: "ingreso_reparacion",
    label: "Ingreso de Vehículo a Reparación",
  },
  {
    value: "peritaje_seguro",
    label: "Inspección / Peritaje de Aseguradora",
  },
  {
    value: "cotizacion",
    label: "Turno para Presupuesto / Cotización",
  },
  {
    value: "entrega_unidad",
    label: "Entrega Programada de Unidad",
  },
];

const ESTADOS_TURNO = [
  { value: "programado", label: "Programado" },
  { value: "ingresado", label: "Vehículo Recibido en Taller" },
  { value: "reprogramado", label: "Reprogramado" },
  { value: "cancelado", label: "Cancelado" },
];

export default function AppointmentModal({
  turno,
  defaultDate,
  onClose,
  onSaved,
}) {
  const isEditing = Boolean(turno?.id_turno);

  const [vehiculos, setVehiculos] = useState([]);
  const [aseguradoras, setAseguradoras] = useState([]);
  const [modoVehiculo, setModoVehiculo] = useState(
    turno && !turno.vehiculo && turno.patente_referencia
      ? "libre"
      : "padron"
  );

  const [formData, setFormData] = useState({
    fecha_turno:
      turno?.fecha_turno ||
      defaultDate ||
      new Date().toISOString().split("T")[0],
    hora_turno: turno?.hora_turno ? turno.hora_turno.slice(0, 5) : "08:30",
    tipo_turno: turno?.tipo_turno || "ingreso_reparacion",
    estado: turno?.estado || "programado",
    vehiculo: turno?.vehiculo || "",
    compania: turno?.compania || "",
    cliente_nombre_libre: turno?.cliente_nombre_libre || "",
    telefono_contacto: turno?.telefono_contacto || "",
    patente_referencia: turno?.patente_referencia || "",
    vehiculo_referencia: turno?.vehiculo_referencia || "",
    motivo_observaciones: turno?.motivo_observaciones || "",
  });

  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadCatalogs = async () => {
      try {
        const [vData, aData] = await Promise.all([
          getVehiculos(),
          getAseguradoras(),
        ]);
        const vList = Array.isArray(vData) ? vData : vData.results || [];
        const aList = Array.isArray(aData) ? aData : aData.results || [];
        setVehiculos(vList);
        setAseguradoras(aList);
        if (!isEditing && vList.length > 0 && !formData.vehiculo) {
          setFormData((prev) => ({
            ...prev,
            vehiculo: vList[0].id_vehiculo,
          }));
        }
      } catch (err) {
        console.error("Error cargando catálogos para turno:", err);
      }
    };
    loadCatalogs();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);
    try {
      const payload = {
        fecha_turno: formData.fecha_turno,
        hora_turno: formData.hora_turno,
        tipo_turno: formData.tipo_turno,
        estado: formData.estado,
        vehiculo:
          modoVehiculo === "padron" && formData.vehiculo
            ? Number(formData.vehiculo)
            : null,
        compania: formData.compania ? Number(formData.compania) : null,
        cliente_nombre_libre:
          modoVehiculo === "libre"
            ? formData.cliente_nombre_libre.trim()
            : "",
        telefono_contacto: formData.telefono_contacto.trim(),
        patente_referencia:
          modoVehiculo === "libre"
            ? formData.patente_referencia.trim().toUpperCase()
            : "",
        vehiculo_referencia:
          modoVehiculo === "libre" ? formData.vehiculo_referencia.trim() : "",
        motivo_observaciones: formData.motivo_observaciones.trim(),
      };

      let saved;
      if (isEditing) {
        saved = await updateTurnoTaller(turno.id_turno, payload);
      } else {
        saved = await createTurnoTaller(payload);
      }
      if (onSaved) onSaved(saved);
    } catch (err) {
      const data = err.response?.data;
      const msg =
        data?.detail ||
        (data &&
          Object.entries(data)
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(" ") : v}`)
            .join(" | ")) ||
        "No se pudo guardar el turno en el calendario.";
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
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content border-0 shadow-lg">
          <div className="modal-header bg-dark text-white">
            <h5 className="modal-title fw-bold">
              <i className="bi bi-calendar-plus me-2"></i>
              {isEditing
                ? "Editar Turno Agendado"
                : "Agendar Nuevo Turno de Ingreso al Taller"}
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
                <div className="alert alert-danger small">{errorMsg}</div>
              )}

              {/* Fecha, Hora, Tipo y Estado */}
              <div className="row g-3 mb-3">
                <div className="col-md-3">
                  <label className="form-label fw-semibold small">
                    Fecha de Ingreso *
                  </label>
                  <input
                    type="date"
                    name="fecha_turno"
                    className="form-control fw-bold"
                    value={formData.fecha_turno}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="col-md-3">
                  <label className="form-label fw-semibold small">
                    Horario *
                  </label>
                  <input
                    type="time"
                    name="hora_turno"
                    className="form-control fw-bold"
                    value={formData.hora_turno}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="col-md-3">
                  <label className="form-label fw-semibold small">
                    Motivo del Turno *
                  </label>
                  <select
                    name="tipo_turno"
                    className="form-select"
                    value={formData.tipo_turno}
                    onChange={handleChange}
                  >
                    {TIPOS_TURNO.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-md-3">
                  <label className="form-label fw-semibold small">
                    Estado *
                  </label>
                  <select
                    name="estado"
                    className="form-select"
                    value={formData.estado}
                    onChange={handleChange}
                  >
                    {ESTADOS_TURNO.map((e) => (
                      <option key={e.value} value={e.value}>
                        {e.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Selector de Modo: Vehículo ya empadronado vs Anotación rápida telefónica */}
              <div className="mb-3">
                <label className="form-label fw-semibold small d-block">
                  Identificación del Vehículo y Cliente *
                </label>
                <div className="btn-group w-100">
                  <button
                    type="button"
                    className={`btn btn-sm ${
                      modoVehiculo === "padron"
                        ? "btn-primary fw-semibold"
                        : "btn-outline-secondary"
                    }`}
                    onClick={() => setModoVehiculo("padron")}
                  >
                    <i className="bi bi-car-front me-1"></i>
                    Seleccionar Vehículo del Padrón
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${
                      modoVehiculo === "libre"
                        ? "btn-primary fw-semibold"
                        : "btn-outline-secondary"
                    }`}
                    onClick={() => setModoVehiculo("libre")}
                  >
                    <i className="bi bi-telephone-inbound me-1"></i>
                    Anotación Rápida (Auto aún no cargado)
                  </button>
                </div>
              </div>

              {modoVehiculo === "padron" ? (
                <div className="row g-3 mb-3">
                  <div className="col-md-8">
                    <label className="form-label fw-semibold small">
                      Vehículo Registrado *
                    </label>
                    <select
                      name="vehiculo"
                      className="form-select"
                      value={formData.vehiculo}
                      onChange={handleChange}
                      required
                    >
                      {vehiculos.map((v) => (
                        <option key={v.id_vehiculo} value={v.id_vehiculo}>
                          {v.patente} — {v.marca} {v.modelo} ({v.color}) •
                          Titular: {v.cliente_nombre}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-md-4">
                    <label className="form-label fw-semibold small">
                      Teléfono de Contacto (Opcional)
                    </label>
                    <input
                      type="text"
                      name="telefono_contacto"
                      className="form-control"
                      placeholder="Se usa el del cliente si se omite"
                      value={formData.telefono_contacto}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              ) : (
                <div className="row g-3 mb-3 p-3 rounded bg-light border">
                  <div className="col-md-3">
                    <label className="form-label fw-semibold small">
                      Patente / Dominio *
                    </label>
                    <input
                      type="text"
                      name="patente_referencia"
                      className="form-control text-uppercase fw-bold"
                      placeholder="Ej: AG120KL"
                      value={formData.patente_referencia}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="col-md-5">
                    <label className="form-label fw-semibold small">
                      Marca, Modelo y Color *
                    </label>
                    <input
                      type="text"
                      name="vehiculo_referencia"
                      className="form-control"
                      placeholder="Ej: Chevrolet Cruze Blanco"
                      value={formData.vehiculo_referencia}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-semibold small">
                      Apellido y Nombre Cliente *
                    </label>
                    <input
                      type="text"
                      name="cliente_nombre_libre"
                      className="form-control"
                      placeholder="Ej: Gómez, Hernán"
                      value={formData.cliente_nombre_libre}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-semibold small">
                      Teléfono / WhatsApp *
                    </label>
                    <input
                      type="text"
                      name="telefono_contacto"
                      className="form-control"
                      placeholder="Ej: 351-6891234"
                      value={formData.telefono_contacto}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
              )}

              <div className="row g-3">
                <div className="col-md-5">
                  <label className="form-label fw-semibold small">
                    Compañía Aseguradora (Si corresponde)
                  </label>
                  <select
                    name="compania"
                    className="form-select"
                    value={formData.compania}
                    onChange={handleChange}
                  >
                    <option value="">-- Particular / Sin Aseguradora --</option>
                    {aseguradoras.map((a) => (
                      <option key={a.id_compania} value={a.id_compania}>
                        {a.razon_social}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-md-7">
                  <label className="form-label fw-semibold small">
                    Detalle del Trabajo / Observaciones de Ingreso
                  </label>
                  <input
                    type="text"
                    name="motivo_observaciones"
                    className="form-control"
                    placeholder="Ej: Trae paragolpes provisto por el seguro para pintar y colocar"
                    value={formData.motivo_observaciones}
                    onChange={handleChange}
                  />
                </div>
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
                {loading
                  ? "Guardando..."
                  : isEditing
                  ? "Guardar Cambios"
                  : "Agendar en Calendario"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
