import React, { useState } from "react";
import { aprobarPresupuesto } from "../../api/budgetsApi";

function extractInitialProspectData(budget) {
  const cab = budget?.rubros_importes?.cabecera_planilla || {};
  const primeraLinea = (budget?.detalle_libre || "").splitlines
    ? ""
    : ((budget?.detalle_libre || "").split("\n")[0] || "").trim();

  // Intentar separar apellido y nombre si fue escrito en la cabecera de la planilla
  const apNom = (cab.apellido_nombre || "").trim();
  let apellidoInit = "";
  let nombreInit = "";
  if (apNom) {
    const parts = apNom.split(/\s+/);
    apellidoInit = parts[0] || "";
    nombreInit = parts.slice(1).join(" ") || "";
  }

  // Intentar extraer patente, marca y modelo de cabecera_planilla o de la primera línea del talonario libre
  const patDetectada =
    budget?.vehiculo_patente && budget.vehiculo_patente !== "S/PATENTE"
      ? budget.vehiculo_patente
      : (cab.dominio_patente || "").trim().toUpperCase();

  let marcaInit = "";
  let modeloInit = "";
  const vehTexto = (cab.vehiculo_texto || "").trim();
  if (vehTexto) {
    const vParts = vehTexto.split(/\s+/);
    marcaInit = vParts[0] || "";
    modeloInit = vParts.slice(1).join(" ") || vParts[0] || "";
  } else if (primeraLinea) {
    // Ej: "Honda CRV, patente: AC683VD" -> limpiamos la parte de patente
    const sinPatente = primeraLinea
      .replace(/,?\s*patente\s*:?\s*[A-Za-z0-9\s-]+/i, "")
      .replace(/\b([A-Za-z]{2}\s*\d{3}\s*[A-Za-z]{2}|[A-Za-z]{3}\s*\d{3})\b/, "")
      .trim();
    const pParts = sinPatente.split(/\s+/).filter(Boolean);
    if (pParts.length >= 2) {
      marcaInit = pParts[0];
      modeloInit = pParts.slice(1).join(" ");
    } else if (pParts.length === 1) {
      marcaInit = pParts[0];
      modeloInit = pParts[0];
    }
  }

  return {
    dni: "",
    apellido: apellidoInit,
    nombre: nombreInit,
    telefono: (cab.telefono_1 || "").trim(),
    direccion: (cab.domicilio || "").trim(),
    email: "",
    patente: patDetectada,
    marca: marcaInit,
    modelo: modeloInit,
    anio: (cab.modelo_anio || "").trim() || String(new Date().getFullYear()),
    color: (cab.color_texto || "").trim() || "A confirmar",
  };
}

export default function BudgetApproveModal({
  budget,
  clientes = [],
  vehiculos = [],
  onClose,
  onApproved,
}) {
  const defaultDelivery = () => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split("T")[0];
  };

  const needsClient = !budget.id_cliente;
  const needsVehicle = !budget.id_vehiculo;
  const initProspect = extractInitialProspectData(budget);

  const [fechaIngreso, setFechaIngreso] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [fechaEstimadaEntrega, setFechaEstimadaEntrega] = useState(
    defaultDelivery()
  );
  const [nroOrdenAseguradora, setNroOrdenAseguradora] = useState("");
  const [nroSiniestro, setNroSiniestro] = useState(budget.nro_siniestro || "");
  const [nombrePerito, setNombrePerito] = useState(budget.nombre_perito || "");

  // Modo de vinculación cuando el presupuesto se emitió sin cliente/vehículo registrado
  const [modoCliente, setModoCliente] = useState("nuevo"); // "nuevo" | "existente"
  const [idClienteSel, setIdClienteSel] = useState(
    clientes[0]?.id_cliente ? String(clientes[0].id_cliente) : ""
  );
  const [nuevoCliente, setNuevoCliente] = useState({
    dni: initProspect.dni,
    apellido: initProspect.apellido,
    nombre: initProspect.nombre,
    telefono: initProspect.telefono,
    direccion: initProspect.direccion,
    email: initProspect.email,
  });

  const [modoVehiculo, setModoVehiculo] = useState("nuevo"); // "nuevo" | "existente"
  const [idVehiculoSel, setIdVehiculoSel] = useState(
    vehiculos[0]?.id_vehiculo ? String(vehiculos[0].id_vehiculo) : ""
  );
  const [nuevoVehiculo, setNuevoVehiculo] = useState({
    patente: initProspect.patente,
    marca: initProspect.marca,
    modelo: initProspect.modelo,
    anio: initProspect.anio,
    color: initProspect.color,
  });

  const [errorMsg, setErrorMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSubmitting(true);
    try {
      const payload = {
        fecha_ingreso: fechaIngreso,
        fecha_estimada_entrega: fechaEstimadaEntrega,
        nro_orden_aseguradora: nroOrdenAseguradora.trim(),
        nro_siniestro: nroSiniestro.trim(),
        nombre_perito: nombrePerito.trim(),
      };

      if (needsClient) {
        if (modoCliente === "existente" && idClienteSel) {
          payload.id_cliente = Number(idClienteSel);
        } else {
          payload.nuevo_cliente = {
            dni: nuevoCliente.dni.trim(),
            apellido: nuevoCliente.apellido.trim(),
            nombre: nuevoCliente.nombre.trim(),
            telefono: nuevoCliente.telefono.trim(),
            direccion: nuevoCliente.direccion.trim(),
            email: nuevoCliente.email.trim(),
          };
        }
      }

      if (needsVehicle) {
        if (modoVehiculo === "existente" && idVehiculoSel) {
          payload.id_vehiculo = Number(idVehiculoSel);
        } else {
          payload.nuevo_vehiculo = {
            patente: nuevoVehiculo.patente.trim().toUpperCase(),
            marca: nuevoVehiculo.marca.trim(),
            modelo: nuevoVehiculo.modelo.trim(),
            anio: Number(nuevoVehiculo.anio) || new Date().getFullYear(),
            color: nuevoVehiculo.color.trim(),
          };
        }
      }

      const res = await aprobarPresupuesto(budget.id_presupuesto, payload);
      onApproved(res);
    } catch (err) {
      const data = err.response?.data;
      if (data) {
        const msg = Object.entries(data)
          .map(([k, v]) => {
            if (typeof v === "object" && v !== null && !Array.isArray(v)) {
              return Object.entries(v)
                .map(([subK, subV]) => `${subK}: ${Array.isArray(subV) ? subV.join(" ") : subV}`)
                .join(" | ");
            }
            return `${k}: ${Array.isArray(v) ? v.join(" ") : v}`;
          })
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
    <div
      className="modal d-block"
      style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
    >
      <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content border-0 shadow">
          <div className="modal-header bg-success text-white">
            <h5 className="modal-title fw-bold">
              <i className="bi bi-check2-circle me-2"></i>
              Aprobar Presupuesto #{budget.id_presupuesto} y Generar OT
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
                  Aceptación del Presupuesto y Apertura Automática de Orden (1 a 1):
                </div>
                Al confirmar la aprobación de esta cotización por{" "}
                <strong>
                  ${" "}
                  {Number(budget.monto_total).toLocaleString("es-AR", {
                    minimumFractionDigits: 2,
                  })}
                </strong>
                , el sistema registrará el vehículo y el cliente (si aún no estaban cargados),
                creará automáticamente la <strong>Orden de Trabajo</strong> e inicializará sus{" "}
                <strong>8 fases secuenciales de taller</strong> (1-Recepción a
                8-Alistado para entrega).
              </div>

              {/* Si el presupuesto se emitió sin empadronar al Cliente, se da de alta acá mismo */}
              {needsClient && (
                <div className="p-3 mb-3 rounded border bg-light">
                  <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
                    <h6 className="fw-bold text-dark mb-0">
                      <i className="bi bi-person-plus-fill text-primary me-2"></i>
                      1. Alta del Cliente (Aceptó el presupuesto)
                    </h6>
                    {clientes.length > 0 && (
                      <div className="btn-group btn-group-sm">
                        <button
                          type="button"
                          className={`btn ${
                            modoCliente === "nuevo"
                              ? "btn-primary"
                              : "btn-outline-primary"
                          }`}
                          onClick={() => setModoCliente("nuevo")}
                        >
                          Crear Cliente Nuevo
                        </button>
                        <button
                          type="button"
                          className={`btn ${
                            modoCliente === "existente"
                              ? "btn-primary"
                              : "btn-outline-primary"
                          }`}
                          onClick={() => setModoCliente("existente")}
                        >
                          Elegir Cliente Ya Registrado
                        </button>
                      </div>
                    )}
                  </div>

                  {modoCliente === "existente" && clientes.length > 0 ? (
                    <div>
                      <label className="form-label small fw-semibold">
                        Seleccionar Cliente del Padrón *
                      </label>
                      <select
                        className="form-select form-select-sm"
                        value={idClienteSel}
                        onChange={(e) => setIdClienteSel(e.target.value)}
                        required
                      >
                        {clientes.map((c) => (
                          <option key={c.id_cliente} value={c.id_cliente}>
                            {c.apellido}, {c.nombre} (DNI: {c.dni}) — Tel: {c.telefono}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="row g-2">
                      <div className="col-md-4">
                        <label className="form-label small fw-semibold mb-1">
                          Apellido *
                        </label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="Ej.: Gómez"
                          value={nuevoCliente.apellido}
                          onChange={(e) =>
                            setNuevoCliente({
                              ...nuevoCliente,
                              apellido: e.target.value,
                            })
                          }
                          required
                        />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label small fw-semibold mb-1">
                          Nombre *
                        </label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="Ej.: Juan Carlos"
                          value={nuevoCliente.nombre}
                          onChange={(e) =>
                            setNuevoCliente({
                              ...nuevoCliente,
                              nombre: e.target.value,
                            })
                          }
                          required
                        />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label small fw-semibold mb-1">
                          DNI / CUIT *
                        </label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="Ej.: 32456789"
                          value={nuevoCliente.dni}
                          onChange={(e) =>
                            setNuevoCliente({
                              ...nuevoCliente,
                              dni: e.target.value,
                            })
                          }
                          required
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label small fw-semibold mb-1">
                          Teléfono / WhatsApp *
                        </label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="Ej.: 351-6123456"
                          value={nuevoCliente.telefono}
                          onChange={(e) =>
                            setNuevoCliente({
                              ...nuevoCliente,
                              telefono: e.target.value,
                            })
                          }
                          required
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label small fw-semibold mb-1">
                          Domicilio (Opcional)
                        </label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="Calle y barrio"
                          value={nuevoCliente.direccion}
                          onChange={(e) =>
                            setNuevoCliente({
                              ...nuevoCliente,
                              direccion: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Si el presupuesto se emitió sin empadronar el Vehículo, se da de alta acá mismo */}
              {needsVehicle && (
                <div className="p-3 mb-3 rounded border bg-light">
                  <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
                    <h6 className="fw-bold text-dark mb-0">
                      <i className="bi bi-car-front-fill text-primary me-2"></i>
                      2. Alta del Vehículo (Se pre-completó desde el presupuesto)
                    </h6>
                    {vehiculos.length > 0 && (
                      <div className="btn-group btn-group-sm">
                        <button
                          type="button"
                          className={`btn ${
                            modoVehiculo === "nuevo"
                              ? "btn-primary"
                              : "btn-outline-primary"
                          }`}
                          onClick={() => setModoVehiculo("nuevo")}
                        >
                          Crear Vehículo Nuevo
                        </button>
                        <button
                          type="button"
                          className={`btn ${
                            modoVehiculo === "existente"
                              ? "btn-primary"
                              : "btn-outline-primary"
                          }`}
                          onClick={() => setModoVehiculo("existente")}
                        >
                          Elegir Vehículo Ya Registrado
                        </button>
                      </div>
                    )}
                  </div>

                  {modoVehiculo === "existente" && vehiculos.length > 0 ? (
                    <div>
                      <label className="form-label small fw-semibold">
                        Seleccionar Vehículo del Padrón *
                      </label>
                      <select
                        className="form-select form-select-sm"
                        value={idVehiculoSel}
                        onChange={(e) => setIdVehiculoSel(e.target.value)}
                        required
                      >
                        {vehiculos.map((v) => (
                          <option key={v.id_vehiculo} value={v.id_vehiculo}>
                            {v.patente} — {v.marca} {v.modelo} ({v.anio}) [{v.color}]
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="row g-2">
                      <div className="col-md-3">
                        <label className="form-label small fw-semibold mb-1">
                          Patente / Dominio *
                        </label>
                        <input
                          type="text"
                          className="form-control form-control-sm text-uppercase fw-bold"
                          placeholder="Ej.: AC683VD"
                          value={nuevoVehiculo.patente}
                          onChange={(e) =>
                            setNuevoVehiculo({
                              ...nuevoVehiculo,
                              patente: e.target.value.toUpperCase(),
                            })
                          }
                          required
                        />
                      </div>
                      <div className="col-md-3">
                        <label className="form-label small fw-semibold mb-1">
                          Marca *
                        </label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="Ej.: Honda"
                          value={nuevoVehiculo.marca}
                          onChange={(e) =>
                            setNuevoVehiculo({
                              ...nuevoVehiculo,
                              marca: e.target.value,
                            })
                          }
                          required
                        />
                      </div>
                      <div className="col-md-3">
                        <label className="form-label small fw-semibold mb-1">
                          Modelo *
                        </label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="Ej.: CRV"
                          value={nuevoVehiculo.modelo}
                          onChange={(e) =>
                            setNuevoVehiculo({
                              ...nuevoVehiculo,
                              modelo: e.target.value,
                            })
                          }
                          required
                        />
                      </div>
                      <div className="col-md-3">
                        <label className="form-label small fw-semibold mb-1">
                          Color *
                        </label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="Ej.: Gris Plata"
                          value={nuevoVehiculo.color}
                          onChange={(e) =>
                            setNuevoVehiculo({
                              ...nuevoVehiculo,
                              color: e.target.value,
                            })
                          }
                          required
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

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
                  <>
                    <div className="col-md-4">
                      <label className="form-label small fw-semibold">
                        N.º de Siniestro (Opcional)
                      </label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="Ej.: SIN-2026-44890"
                        value={nroSiniestro}
                        onChange={(e) => setNroSiniestro(e.target.value)}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-semibold">
                        Perito Liquidador (Opcional)
                      </label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="Ej.: Ing. Roberto Sosa"
                        value={nombrePerito}
                        onChange={(e) => setNombrePerito(e.target.value)}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-semibold">
                        N.º Orden Reparación (Opcional)
                      </label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="Ej.: OR-SANCOR-2026-881"
                        value={nroOrdenAseguradora}
                        onChange={(e) => setNroOrdenAseguradora(e.target.value)}
                      />
                    </div>
                  </>
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
