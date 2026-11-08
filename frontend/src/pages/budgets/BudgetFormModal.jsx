import React, { useState } from "react";
import {
  createPresupuesto,
  emitirPresupuesto,
  updatePresupuesto,
} from "../../api/budgetsApi";
import AseguradoraGridEditor from "./AseguradoraGridEditor";
import ParticularSheetEditor from "./ParticularSheetEditor";

export default function BudgetFormModal({
  editingBudget,
  clientes,
  vehiculos,
  aseguradoras,
  onClose,
  onSaved,
}) {
  const [tipo, setTipo] = useState(editingBudget?.tipo || "particular");
  const [idCliente, setIdCliente] = useState(
    editingBudget?.id_cliente ? String(editingBudget.id_cliente) : ""
  );
  const [idVehiculo, setIdVehiculo] = useState(
    editingBudget?.id_vehiculo ? String(editingBudget.id_vehiculo) : ""
  );
  const [idCompania, setIdCompania] = useState(
    editingBudget?.id_compania
      ? String(editingBudget.id_compania)
      : aseguradoras[0]?.id_compania
      ? String(aseguradoras[0].id_compania)
      : ""
  );
  const [nroSiniestro, setNroSiniestro] = useState(
    editingBudget?.nro_siniestro || ""
  );
  const [nombrePerito, setNombrePerito] = useState(
    editingBudget?.nombre_perito || ""
  );
  const [observaciones, setObservaciones] = useState(
    editingBudget?.observaciones || ""
  );

  // Estado para Presupuesto Particular (Hoja libre estilo Talonario / Word - Anexo 1)
  const [detalleLibre, setDetalleLibre] = useState(
    editingBudget?.detalle_libre || ""
  );

  // Estado para Presupuesto Aseguradora (Planilla de casillas [X] C/R/P - Anexo 2)
  const [marcaciones, setMarcaciones] = useState(
    editingBudget?.planilla_marcaciones || {}
  );

  // Inicialización de datos de cabecera de la planilla física (APELLIDO Y NOMBRE, TEL., DOMICILIO, VEHÍCULO, COLOR, MODELO, DOMINIO)
  const buildCabeceraFromIds = (cliId, vehId, prevCab = {}) => {
    const cli = clientes.find((c) => String(c.id_cliente) === String(cliId));
    const veh = vehiculos.find((v) => String(v.id_vehiculo) === String(vehId));
    const hoy = new Date();
    return {
      fecha_dia: prevCab.fecha_dia || String(hoy.getDate()).padStart(2, "0"),
      fecha_mes:
        prevCab.fecha_mes || String(hoy.getMonth() + 1).padStart(2, "0"),
      fecha_anio: prevCab.fecha_anio || String(hoy.getFullYear()).slice(-2),
      apellido_nombre: cli
        ? `${cli.apellido} ${cli.nombre}`.toUpperCase()
        : prevCab.apellido_nombre || "",
      telefono_1: cli ? cli.telefono || "" : prevCab.telefono_1 || "",
      domicilio: cli ? cli.direccion || "" : prevCab.domicilio || "",
      telefono_2: prevCab.telefono_2 || "",
      vehiculo_texto: veh
        ? `${veh.marca} ${veh.modelo}`
        : prevCab.vehiculo_texto || "",
      color_texto: veh ? veh.color || "" : prevCab.color_texto || "",
      modelo_anio: veh ? String(veh.anio) : prevCab.modelo_anio || "",
      dominio_patente: veh ? veh.patente || "" : prevCab.dominio_patente || "",
    };
  };

  const [datosCabeceraPlanilla, setDatosCabeceraPlanilla] = useState(() => {
    if (editingBudget?.rubros_importes?.cabecera_planilla) {
      return editingBudget.rubros_importes.cabecera_planilla;
    }
    return buildCabeceraFromIds(
      editingBudget?.id_cliente || "",
      editingBudget?.id_vehiculo || ""
    );
  });

  // Importes por rubro (tanto para Particular como para el pie de Planilla de Aseguradora)
  const [rubrosImportes, setRubrosImportes] = useState(() => {
    if (
      editingBudget?.rubros_importes &&
      Object.keys(editingBudget.rubros_importes).length > 0
    ) {
      return editingBudget.rubros_importes;
    }
    return {
      mano_obra: editingBudget?.monto_mano_obra || "",
      pintura: "",
      mecanica: "",
      electricidad: "",
      tapiceria: "",
      repuestos: editingBudget?.monto_repuestos || "",
      iva: "",
      incluir_repuestos_en_total: Number(editingBudget?.monto_repuestos) > 0,
      descuento_efectivo_porc: "",
      total_final: editingBudget?.monto_total || "",
    };
  });

  const [errorMsg, setErrorMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedVehiculo = vehiculos.find(
    (v) => String(v.id_vehiculo) === String(idVehiculo)
  );
  const selectedCliente = clientes.find(
    (c) => String(c.id_cliente) === String(idCliente)
  );

  const handleVehiculoChange = (vehId) => {
    setIdVehiculo(vehId);
    const foundVeh = vehiculos.find(
      (v) => String(v.id_vehiculo) === String(vehId)
    );
    const nextCliId = foundVeh ? String(foundVeh.id_cliente) : idCliente;
    if (foundVeh) {
      setIdCliente(String(foundVeh.id_cliente));
    }
    setDatosCabeceraPlanilla((prev) =>
      buildCabeceraFromIds(nextCliId, vehId, prev)
    );
  };

  const handleClienteChange = (cliId) => {
    setIdCliente(cliId);
    setDatosCabeceraPlanilla((prev) =>
      buildCabeceraFromIds(cliId, idVehiculo, prev)
    );
  };

  const handleSave = async (emitirAhora = false) => {
    setErrorMsg("");
    setSaving(true);
    try {
      const payload = {
        tipo,
        id_cliente: idCliente ? Number(idCliente) : null,
        id_vehiculo: idVehiculo ? Number(idVehiculo) : null,
        id_compania:
          tipo === "aseguradora" && idCompania ? Number(idCompania) : null,
        nro_siniestro: tipo === "aseguradora" ? nroSiniestro.trim() : "",
        nombre_perito: tipo === "aseguradora" ? nombrePerito.trim() : "",
        observaciones: observaciones.trim(),
        detalle_libre: tipo === "particular" ? detalleLibre : "",
        planilla_marcaciones: tipo === "aseguradora" ? marcaciones : {},
        rubros_importes: {
          ...rubrosImportes,
          cabecera_planilla: datosCabeceraPlanilla,
        },
      };

      let saved;
      if (editingBudget) {
        saved = await updatePresupuesto(editingBudget.id_presupuesto, payload);
      } else {
        saved = await createPresupuesto(payload);
      }

      if (emitirAhora) {
        await emitirPresupuesto(saved.id_presupuesto);
      }

      onSaved(
        emitirAhora
          ? `Presupuesto #${saved.id_presupuesto} guardado y emitido formalmente (+15 días de validez).`
          : `Presupuesto #${saved.id_presupuesto} actualizado correctamente.`
      );
    } catch (err) {
      const data = err.response?.data;
      if (data) {
        const msg = Object.entries(data)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(" ") : v}`)
          .join(" | ");
        setErrorMsg(msg);
      } else {
        setErrorMsg("No se pudo guardar el presupuesto. Verifique los datos.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="modal d-block"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
    >
      <div className="modal-dialog modal-fullscreen-lg-down modal-xl modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content border-0 shadow-lg">
          <div className="modal-header bg-dark text-white">
            <h5 className="modal-title fw-bold">
              <i className="bi bi-file-earmark-text me-2"></i>
              {editingBudget
                ? `Editar Presupuesto #${editingBudget.id_presupuesto}`
                : "Nuevo Presupuesto – Taller Sergio"}
            </h5>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={onClose}
            ></button>
          </div>

          <div className="modal-body">
            {errorMsg && (
              <div className="alert alert-danger small">{errorMsg}</div>
            )}

            {/* Barra de selección rápida de Formato y Vínculo Opcional con Padrón */}
            <div className="row g-3 mb-3 pb-3 border-bottom align-items-end">
              <div className="col-md-4">
                <label className="form-label small fw-bold">
                  Formato de Presupuesto *
                </label>
                <div className="btn-group w-100" role="group">
                  <button
                    type="button"
                    className={`btn btn-sm ${
                      tipo === "particular"
                        ? "btn-primary fw-semibold"
                        : "btn-outline-primary"
                    }`}
                    onClick={() => setTipo("particular")}
                  >
                    <i className="bi bi-journal-text me-1"></i>
                    Terceros / Particular
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${
                      tipo === "aseguradora"
                        ? "btn-primary fw-semibold"
                        : "btn-outline-primary"
                    }`}
                    onClick={() => setTipo("aseguradora")}
                  >
                    <i className="bi bi-grid-3x3-gap-fill me-1"></i>
                    Compañía Aseguradora
                  </button>
                </div>
              </div>

              <div className="col-md-4">
                <label className="form-label small fw-bold">
                  Autocompletar desde Vehículo (Opcional)
                </label>
                <select
                  className="form-select form-select-sm"
                  value={idVehiculo}
                  onChange={(e) => handleVehiculoChange(e.target.value)}
                >
                  <option value="">
                    -- Sin registrar aún (Se carga si acepta el presupuesto) --
                  </option>
                  {vehiculos.map((v) => (
                    <option key={v.id_vehiculo} value={v.id_vehiculo}>
                      {v.patente} — {v.marca} {v.modelo} ({v.anio}) [{v.color}]
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-md-4">
                <label className="form-label small fw-bold">
                  Cliente en Padrón (Opcional)
                </label>
                <select
                  className="form-select form-select-sm"
                  value={idCliente}
                  onChange={(e) => handleClienteChange(e.target.value)}
                >
                  <option value="">
                    -- Sin registrar aún (Se carga si acepta el presupuesto) --
                  </option>
                  {clientes.map((c) => (
                    <option key={c.id_cliente} value={c.id_cliente}>
                      {c.apellido}, {c.nombre} — Tel: {c.telefono}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Datos de Compañía Aseguradora, Siniestro y Perito (HU-006) */}
            {tipo === "aseguradora" && (
              <div className="px-3 py-2 mb-3 rounded border bg-light">
                <div className="row g-2 align-items-center">
                  <div className="col-md-4">
                    <label className="form-label small fw-bold mb-1">
                      Compañía Aseguradora *
                    </label>
                    <select
                      className="form-select form-select-sm"
                      value={idCompania}
                      onChange={(e) => setIdCompania(e.target.value)}
                      required
                    >
                      <option value="">-- Seleccione aseguradora --</option>
                      {aseguradoras.map((a) => (
                        <option key={a.id_compania} value={a.id_compania}>
                          {a.razon_social} (Plazo: {a.plazo_pago_dias} días)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small fw-bold mb-1">
                      Número de Siniestro (Opcional)
                    </label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="Ej.: SIN-2026-44890 (si ya lo tiene)"
                      value={nroSiniestro}
                      onChange={(e) => setNroSiniestro(e.target.value)}
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small fw-bold mb-1">
                      Perito Liquidador (Opcional)
                    </label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="Ej.: Ing. Roberto Sosa (si ya fue asignado)"
                      value={nombrePerito}
                      onChange={(e) => setNombrePerito(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Cuerpo dinámico: Talonario de Terceros vs Planilla Completa de Aseguradora */}
            {tipo === "particular" ? (
              <ParticularSheetEditor
                selectedVehiculo={selectedVehiculo}
                selectedCliente={selectedCliente}
                detalleLibre={detalleLibre}
                setDetalleLibre={setDetalleLibre}
                rubrosImportes={rubrosImportes}
                setRubrosImportes={setRubrosImportes}
              />
            ) : (
              <AseguradoraGridEditor
                presupuestoNumero={editingBudget?.id_presupuesto}
                datosCabeceraPlanilla={datosCabeceraPlanilla}
                setDatosCabeceraPlanilla={setDatosCabeceraPlanilla}
                marcaciones={marcaciones}
                setMarcaciones={setMarcaciones}
                rubrosImportes={rubrosImportes}
                setRubrosImportes={setRubrosImportes}
              />
            )}
          </div>

          <div className="modal-footer bg-light">
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={onClose}
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => handleSave(false)}
              disabled={saving}
            >
              <i className="bi bi-save me-1"></i>
              {editingBudget ? "Guardar Cambios" : "Guardar Borrador"}
            </button>
            {editingBudget?.estado !== "aprobado" && (
              <button
                type="button"
                className="btn btn-primary fw-semibold"
                onClick={() => handleSave(true)}
                disabled={saving}
              >
                <i className="bi bi-send-check-fill me-1"></i>
                Guardar y Emitir Formalmente (+15 días)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
