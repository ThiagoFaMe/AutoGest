import React, { useState } from "react";
import { createInsumo, updateInsumo } from "../../api/inventoryApi";

const CATEGORIAS = ["Pintura", "Preparación", "Abrasivos", "Autopartes"];
const UNIDADES = ["Litros", "Kilogramos", "Unidades"];

export default function InventoryItemModal({ insumo, onClose, onSaved }) {
  const isEditing = Boolean(insumo?.id_insumo);

  const [formData, setFormData] = useState({
    codigo: insumo?.codigo || "",
    nombre: insumo?.nombre || "",
    categoria: insumo?.categoria || "Pintura",
    unidad_medida: insumo?.unidad_medida || "Litros",
    stock_actual: insumo?.stock_actual ?? "0.00",
    stock_minimo: insumo?.stock_minimo ?? "1.00",
    costo_unitario: insumo?.costo_unitario ?? "0.00",
  });
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);
    try {
      let saved;
      if (isEditing) {
        saved = await updateInsumo(insumo.id_insumo, formData);
      } else {
        saved = await createInsumo(formData);
      }
      if (onSaved) onSaved(saved);
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === "object") {
        const msg = Object.entries(data)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(" ") : v}`)
          .join(" | ");
        setErrorMsg(msg);
      } else {
        setErrorMsg("No se pudo guardar el insumo/repuesto.");
      }
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
              <i className="bi bi-box-seam me-2"></i>
              {isEditing
                ? `Editar Insumo / Repuesto (${insumo.codigo})`
                : "Alta de Insumo o Repuesto en Catálogo (HU-010)"}
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

              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label fw-semibold small">
                    Código Interno (Único) *
                  </label>
                  <input
                    type="text"
                    name="codigo"
                    className="form-control text-uppercase fw-bold"
                    placeholder="Ej: INS-014 o REP-104"
                    value={formData.codigo}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="col-md-8">
                  <label className="form-label fw-semibold small">
                    Nombre / Descripción Técnica *
                  </label>
                  <input
                    type="text"
                    name="nombre"
                    className="form-control"
                    placeholder="Ej: Barniz Poliuretánico Alto Sólido 2K"
                    value={formData.nombre}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label fw-semibold small">
                    Categoría (Rubro) *
                  </label>
                  <select
                    name="categoria"
                    className="form-select"
                    value={formData.categoria}
                    onChange={handleChange}
                  >
                    {CATEGORIAS.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-md-6">
                  <label className="form-label fw-semibold small">
                    Unidad de Medida *
                  </label>
                  <select
                    name="unidad_medida"
                    className="form-select"
                    value={formData.unidad_medida}
                    onChange={handleChange}
                  >
                    {UNIDADES.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-md-4">
                  <label className="form-label fw-semibold small">
                    Stock Inicial / Actual *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    name="stock_actual"
                    className="form-control"
                    value={formData.stock_actual}
                    onChange={handleChange}
                    disabled={isEditing}
                    required
                  />
                  {isEditing && (
                    <small className="text-muted">
                      Se actualiza mediante Ingresos o Consumos.
                    </small>
                  )}
                </div>

                <div className="col-md-4">
                  <label className="form-label fw-semibold small">
                    Umbral Stock Mínimo (Alerta) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    name="stock_minimo"
                    className="form-control"
                    value={formData.stock_minimo}
                    onChange={handleChange}
                    required
                  />
                  <small className="text-muted">
                    Dispara alerta si Stock Actual &le; Mínimo.
                  </small>
                </div>

                <div className="col-md-4">
                  <label className="form-label fw-semibold small">
                    Costo Unitario Vigente ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    name="costo_unitario"
                    className="form-control"
                    value={formData.costo_unitario}
                    onChange={handleChange}
                    required
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
                  : "Registrar en Catálogo"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
