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
    editingBudget?.id_cliente || (clientes[0]?.id_cliente ?? "")
  );
  const [idVehiculo, setIdVehiculo] = useState(
    editingBudget?.id_vehiculo || (vehiculos[0]?.id_vehiculo ?? "")
  );
  const [idCompania, setIdCompania] = useState(
    editingBudget?.id_compania || (aseguradoras[0]?.id_compania ?? "")
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
    const found = vehiculos.find((v) => String(v.id_vehiculo) === String(vehId));
    if (found) {
      setIdCliente(found.id_cliente);
    }
  };

  const handleSave = async (emitirAhora = false) => {
    setErrorMsg("");
    setSaving(true);
    try {
      const payload = {
        tipo,
        id_cliente: Number(idCliente),
        id_vehiculo: Number(idVehiculo),
        id_compania: tipo === "aseguradora" ? Number(idCompania) : null,
        nro_siniestro: tipo === "aseguradora" ? nroSiniestro.trim() : "",
        nombre_perito: tipo === "aseguradora" ? nombrePerito.trim() : "",
        observaciones: observaciones.trim(),
        detalle_libre: tipo === "particular" ? detalleLibre : "",
        planilla_marcaciones: tipo === "aseguradora" ? marcaciones : {},
        rubros_importes: rubrosImportes,
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
          : `Presupuesto #${saved.id_presupuesto} guardado en borrador.`
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
    <div className="modal d-block" style={{ backgroundColor: "rgba(0,0,0,0.6)" }}>
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

            {/* Cabecera: Selector de Modalidad (Talonario Terceros vs Planilla Aseguradoras) */}
            <div className="row g-3 mb-3 pb-3 border-bottom">
              <div className="col-md-4">
                <label className="form-label small fw-bold">
                  Formato de Presupuesto *
                </label>
                <div className="btn-group w-100" role="group">
                  <button
                    type="button"
                    className={`btn ${
                      tipo === "particular"
                        ? "btn-primary fw-semibold"
                        : "btn-outline-primary"
                    }`}
                    onClick={() => setTipo("particular")}
                  >
                    <i className="bi bi-journal-text me-1"></i>
                    Terceros / Particular (Texto Libre)
                  </button>
                  <button
                    type="button"
                    className={`btn ${
                      tipo === "aseguradora"
                        ? "btn-primary fw-semibold"
                        : "btn-outline-primary"
                    }`}
                    onClick={() => setTipo("aseguradora")}
                  >
                    <i className="bi bi-grid-3x3-gap-fill me-1"></i>
                    Planilla Aseguradora (Casillas [X])
                  </button>
                </div>
              </div>

              <div className="col-md-4">
                <label className="form-label small fw-bold">
                  Vehículo / Dominio *
                </label>
                <select
                  className="form-select"
                  value={idVehiculo}
                  onChange={(e) => handleVehiculoChange(e.target.value)}
                  required
                >
                  {vehiculos.map((v) => (
                    <option key={v.id_vehiculo} value={v.id_vehiculo}>
                      {v.patente} — {v.marca} {v.modelo} ({v.anio}) [{v.color}]
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-md-4">
                <label className="form-label small fw-bold">
                  Apellido y Nombre del Cliente *
                </label>
                <select
                  className="form-select"
                  value={idCliente}
                  onChange={(e) => setIdCliente(e.target.value)}
                  required
                >
                  {clientes.map((c) => (
                    <option key={c.id_cliente} value={c.id_cliente}>
                      {c.apellido}, {c.nombre} — Tel: {c.telefono}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Si es Aseguradora, pide Compañía, Siniestro y Perito arriba de la Planilla C/R/P */}
            {tipo === "aseguradora" && (
              <div className="p-3 mb-3 rounded border border-primary bg-primary-subtle">
                <div className="row g-3">
                  <div className="col-md-4">
                    <label className="form-label small fw-bold">
                      Compañía Aseguradora *
                    </label>
                    <select
                      className="form-select form-select-sm"
                      value={idCompania}
                      onChange={(e) => setIdCompania(e.target.value)}
                      required
                    >
                      {aseguradoras.map((a) => (
                        <option key={a.id_compania} value={a.id_compania}>
                          {a.razon_social} (Plazo: {a.plazo_pago_dias} días)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small fw-bold">
                      Número de Siniestro *
                    </label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="Ej.: SIN-2026-44890"
                      value={nroSiniestro}
                      onChange={(e) => setNroSiniestro(e.target.value)}
                      required
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small fw-bold">
                      Perito Liquidador *
                    </label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="Ej.: Ing. Roberto Sosa"
                      value={nombrePerito}
                      onChange={(e) => setNombrePerito(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Cuerpo dinámico según el tipo de presupuesto elegido */}
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
              Guardar Borrador
            </button>
            <button
              type="button"
              className="btn btn-primary fw-semibold"
              onClick={() => handleSave(true)}
              disabled={saving}
            >
              <i className="bi bi-send-check-fill me-1"></i>
              Guardar y Emitir Formalmente (+15 días)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
