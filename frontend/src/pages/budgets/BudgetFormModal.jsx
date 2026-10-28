import React, { useState } from "react";
import {
  createPresupuesto,
  emitirPresupuesto,
  updatePresupuesto,
} from "../../api/budgetsApi";

const EMPTY_ITEM = {
  descripcion: "",
  tipo_item: "mano_obra_chapa",
  cantidad: 1,
  precio_unitario: "",
};

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
  const [items, setItems] = useState(
    editingBudget?.items?.length > 0
      ? editingBudget.items.map((i) => ({
          descripcion: i.descripcion,
          tipo_item: i.tipo_item,
          cantidad: i.cantidad,
          precio_unitario: i.precio_unitario,
        }))
      : [{ ...EMPTY_ITEM }]
  );
  const [errorMsg, setErrorMsg] = useState("");
  const [saving, setSaving] = useState(false);

  // Al seleccionar un vehículo, sincronizamos automáticamente su cliente propietario
  const handleVehiculoChange = (vehId) => {
    setIdVehiculo(vehId);
    const found = vehiculos.find((v) => String(v.id_vehiculo) === String(vehId));
    if (found) {
      setIdCliente(found.id_cliente);
    }
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  const handleAddItem = () => {
    setItems([...items, { ...EMPTY_ITEM }]);
  };

  const handleRemoveItem = (index) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, idx) => idx !== index));
  };

  // Cálculo dinámico en vivo según HU-005 Criterio 1 y HU-006 Criterio 2
  const subtotalManoObra = items.reduce((acc, item) => {
    if (
      item.tipo_item === "mano_obra_chapa" ||
      item.tipo_item === "mano_obra_pintura"
    ) {
      return (
        acc + (Number(item.cantidad) || 0) * (Number(item.precio_unitario) || 0)
      );
    }
    return acc;
  }, 0);

  const subtotalRepuestosRaw = items.reduce((acc, item) => {
    if (item.tipo_item === "repuesto") {
      return (
        acc + (Number(item.cantidad) || 0) * (Number(item.precio_unitario) || 0)
      );
    }
    return acc;
  }, 0);

  // HU-006 Criterio 2: Si es Aseguradora, monto_repuestos = 0 a cargo de la compañía
  const subtotalRepuestosFacturable =
    tipo === "aseguradora" ? 0 : subtotalRepuestosRaw;
  const montoTotalCalculado = subtotalManoObra + subtotalRepuestosFacturable;

  const handleSave = async (emitirAhora = false) => {
    setErrorMsg("");
    setSaving(true);
    try {
      const cleanItems = items
        .filter((i) => i.descripcion.trim() !== "")
        .map((i) => ({
          descripcion: i.descripcion.trim(),
          tipo_item: i.tipo_item,
          cantidad: Number(i.cantidad) || 1,
          precio_unitario: Number(i.precio_unitario) || 0,
        }));

      const payload = {
        tipo,
        id_cliente: Number(idCliente),
        id_vehiculo: Number(idVehiculo),
        id_compania: tipo === "aseguradora" ? Number(idCompania) : null,
        nro_siniestro: tipo === "aseguradora" ? nroSiniestro.trim() : "",
        nombre_perito: tipo === "aseguradora" ? nombrePerito.trim() : "",
        observaciones: observaciones.trim(),
        items: cleanItems,
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
          : `Presupuesto #${saved.id_presupuesto} guardado correctamente.`
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
    <div className="modal d-block" style={{ backgroundColor: "rgba(0,0,0,0.55)" }}>
      <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content border-0 shadow-lg">
          <div className="modal-header bg-dark text-white">
            <h5 className="modal-title fw-bold">
              <i className="bi bi-file-earmark-spreadsheet me-2"></i>
              {editingBudget
                ? `Editar Presupuesto #${editingBudget.id_presupuesto}`
                : "Confección de Presupuesto Estandarizado (Prototipo 3)"}
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

            {/* Selector de Modalidad: Particular (HU-005) vs Aseguradora (HU-006) */}
            <div className="row g-3 mb-3">
              <div className="col-md-4">
                <label className="form-label small fw-bold">
                  Modalidad de Cotización *
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
                    <i className="bi bi-person-fill me-1"></i>
                    Particular (HU-005)
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
                    <i className="bi bi-shield-check me-1"></i>
                    Aseguradora (HU-006)
                  </button>
                </div>
              </div>

              <div className="col-md-4">
                <label className="form-label small fw-bold">
                  Vehículo Siniestrado *
                </label>
                <select
                  className="form-select"
                  value={idVehiculo}
                  onChange={(e) => handleVehiculoChange(e.target.value)}
                  required
                >
                  {vehiculos.map((v) => (
                    <option key={v.id_vehiculo} value={v.id_vehiculo}>
                      {v.patente} — {v.marca} {v.modelo} ({v.cliente_nombre})
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-md-4">
                <label className="form-label small fw-bold">
                  Cliente Solicitante *
                </label>
                <select
                  className="form-select"
                  value={idCliente}
                  onChange={(e) => setIdCliente(e.target.value)}
                  required
                >
                  {clientes.map((c) => (
                    <option key={c.id_cliente} value={c.id_cliente}>
                      {c.apellido}, {c.nombre} (DNI: {c.dni})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Bloque condicional obligatorio para Compañía Aseguradora (HU-006 Criterio 1 y 2) */}
            {tipo === "aseguradora" && (
              <div className="p-3 mb-3 rounded border border-primary bg-primary-subtle">
                <div className="fw-bold text-primary small mb-2">
                  <i className="bi bi-shield-fill-check me-1"></i>
                  Datos Periciales de Compañía Aseguradora (Obligatorios según HU-006)
                </div>
                <div className="row g-3">
                  <div className="col-md-4">
                    <label className="form-label small fw-semibold">
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
                    <label className="form-label small fw-semibold">
                      Número de Siniestro *
                    </label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="Ej.: SIN-2026-88412"
                      value={nroSiniestro}
                      onChange={(e) => setNroSiniestro(e.target.value)}
                      required
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small fw-semibold">
                      Nombre del Perito Liquidador *
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
                <div className="small text-dark mt-2">
                  <i className="bi bi-info-circle-fill me-1"></i>
                  <strong>Regla de negocio (HU-006 Criterio 2):</strong> En siniestros de aseguradora, la provisión de repuestos corre por cuenta de la compañía (`monto_repuestos = $ 0,00`). Puede listar las autopartes debajo como referencia técnica para la recepción.
                </div>
              </div>
            )}

            {/* Tabla dinámica de renglones del presupuesto */}
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h6 className="fw-bold mb-0">
                Desglose de Ítems (Mano de Obra Chapa, Pintura y Autopartes)
              </h6>
              <button
                type="button"
                className="btn btn-sm btn-outline-primary"
                onClick={handleAddItem}
              >
                <i className="bi bi-plus-lg me-1"></i>
                Agregar Renglón
              </button>
            </div>

            <div className="table-responsive mb-3">
              <table className="table table-bordered align-middle mb-0">
                <thead className="table-light small">
                  <tr>
                    <th style={{ width: "42%" }}>Descripción de Tarea o Pieza</th>
                    <th style={{ width: "22%" }}>Clasificación</th>
                    <th style={{ width: "10%" }}>Cant.</th>
                    <th style={{ width: "14%" }}>Precio Unit. ($)</th>
                    <th style={{ width: "12%" }} className="text-end">
                      Subtotal ($)
                    </th>
                    <th style={{ width: "50px" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const lineSub =
                      (Number(item.cantidad) || 0) *
                      (Number(item.precio_unitario) || 0);
                    return (
                      <tr key={idx}>
                        <td>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="Ej.: Desabolladura y pintura guardabarros delantero"
                            value={item.descripcion}
                            onChange={(e) =>
                              handleItemChange(idx, "descripcion", e.target.value)
                            }
                          />
                        </td>
                        <td>
                          <select
                            className="form-select form-select-sm"
                            value={item.tipo_item}
                            onChange={(e) =>
                              handleItemChange(idx, "tipo_item", e.target.value)
                            }
                          >
                            <option value="mano_obra_chapa">
                              Mano de Obra Chapa
                            </option>
                            <option value="mano_obra_pintura">
                              Mano de Obra Pintura
                            </option>
                            <option value="repuesto">
                              Repuesto / Autoparte
                            </option>
                          </select>
                        </td>
                        <td>
                          <input
                            type="number"
                            min="1"
                            className="form-control form-control-sm"
                            value={item.cantidad}
                            onChange={(e) =>
                              handleItemChange(idx, "cantidad", e.target.value)
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="form-control form-control-sm"
                            placeholder="0.00"
                            value={item.precio_unitario}
                            onChange={(e) =>
                              handleItemChange(
                                idx,
                                "precio_unitario",
                                e.target.value
                              )
                            }
                          />
                        </td>
                        <td className="text-end fw-semibold">
                          ${" "}
                          {lineSub.toLocaleString("es-AR", {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td className="text-center">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => handleRemoveItem(idx)}
                            disabled={items.length <= 1}
                          >
                            <i className="bi bi-trash"></i>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="row g-3 align-items-end">
              <div className="col-md-6">
                <label className="form-label small fw-semibold">
                  Observaciones Técnicas / Alcance del Daño
                </label>
                <textarea
                  className="form-control form-control-sm"
                  rows="3"
                  placeholder="Notas sobre cabina de pintura, franquicia o provisión de piezas..."
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                ></textarea>
              </div>
              <div className="col-md-6">
                <div className="bg-light p-3 rounded border">
                  <div className="d-flex justify-content-between small mb-1">
                    <span>Subtotal Mano de Obra (Chapa + Pintura):</span>
                    <span className="fw-semibold">
                      ${" "}
                      {subtotalManoObra.toLocaleString("es-AR", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="d-flex justify-content-between small mb-2">
                    <span>
                      Subtotal Repuestos{" "}
                      {tipo === "aseguradora"
                        ? "(Provee Aseguradora - $0 a facturar)"
                        : "(Cotizados por Taller)"}
                      :
                    </span>
                    <span className="fw-semibold">
                      ${" "}
                      {subtotalRepuestosFacturable.toLocaleString("es-AR", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="d-flex justify-content-between border-top pt-2 fs-5 fw-bold text-primary">
                    <span>Monto Total del Presupuesto:</span>
                    <span>
                      ${" "}
                      {montoTotalCalculado.toLocaleString("es-AR", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
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
              Guardar como Borrador
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
