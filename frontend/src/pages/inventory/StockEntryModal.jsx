import React, { useState } from "react";
import { registrarIngresoStock } from "../../api/inventoryApi";

export default function StockEntryModal({
  insumos,
  preselectedInsumo,
  onClose,
  onSuccess,
}) {
  const [idInsumo, setIdInsumo] = useState(
    preselectedInsumo?.id_insumo || (insumos[0]?.id_insumo ?? "")
  );
  const selectedObj = insumos.find(
    (i) => String(i.id_insumo) === String(idInsumo)
  );

  const [cantidad, setCantidad] = useState("1.00");
  const [costoUnitario, setCostoUnitario] = useState(
    selectedObj?.costo_unitario || "0.00"
  );
  const [remito, setRemito] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handleInsumoChange = (e) => {
    const val = e.target.value;
    setIdInsumo(val);
    const found = insumos.find((i) => String(i.id_insumo) === String(val));
    if (found) {
      setCostoUnitario(found.costo_unitario);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);
    try {
      const resp = await registrarIngresoStock({
        id_insumo: Number(idInsumo),
        cantidad,
        costo_unitario: costoUnitario,
        remito_comprobante: remito.trim(),
      });
      if (onSuccess) onSuccess(resp);
    } catch (err) {
      const data = err.response?.data;
      const msg =
        data?.detail ||
        (data &&
          Object.entries(data)
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(" ") : v}`)
            .join(" | ")) ||
        "No se pudo registrar el ingreso de stock.";
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
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content border-0 shadow-lg">
          <div className="modal-header bg-success text-white">
            <h5 className="modal-title fw-bold">
              <i className="bi bi-box-arrow-in-down me-2"></i>
              Ingreso de Stock por Compra / Remito
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

              <div className="mb-3">
                <label className="form-label fw-semibold small">
                  Insumo o Repuesto Recibido *
                </label>
                <select
                  className="form-select"
                  value={idInsumo}
                  onChange={handleInsumoChange}
                  required
                >
                  {insumos.map((item) => (
                    <option key={item.id_insumo} value={item.id_insumo}>
                      {item.codigo} — {item.nombre} (Stock actual:{" "}
                      {item.stock_actual} {item.unidad_medida})
                    </option>
                  ))}
                </select>
              </div>

              {selectedObj && (
                <div className="p-2 rounded bg-light border small mb-3 d-flex justify-content-between">
                  <span>
                    Existencia actual:{" "}
                    <strong>
                      {selectedObj.stock_actual} {selectedObj.unidad_medida}
                    </strong>
                  </span>
                  <span>
                    Stock mínimo:{" "}
                    <strong>
                      {selectedObj.stock_minimo} {selectedObj.unidad_medida}
                    </strong>
                  </span>
                </div>
              )}

              <div className="row g-3 mb-3">
                <div className="col-6">
                  <label className="form-label fw-semibold small">
                    Cantidad Recibida ({selectedObj?.unidad_medida || "Unid."}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="form-control fw-bold"
                    value={cantidad}
                    onChange={(e) => setCantidad(e.target.value)}
                    required
                  />
                </div>

                <div className="col-6">
                  <label className="form-label fw-semibold small">
                    Costo Unitario Compra ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-control"
                    value={costoUnitario}
                    onChange={(e) => setCostoUnitario(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="mb-2">
                <label className="form-label fw-semibold small">
                  N° de Remito / Factura Proveedor / Envío Seguro *
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Ej: REM-0008-00450 Pinturerías Córdoba"
                  value={remito}
                  onChange={(e) => setRemito(e.target.value)}
                  required
                />
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
                className="btn btn-success fw-semibold px-4"
                disabled={loading}
              >
                {loading ? "Procesando..." : "Confirmar Ingreso al Pañol"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
