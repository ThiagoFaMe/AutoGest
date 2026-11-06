import React, { useEffect, useState } from "react";
import { emitirFacturaCuenta } from "../../api/financeApi";
import { getOrdenesTrabajo } from "../../api/workordersApi";

export default function IssueInvoiceModal({ onClose, onSuccess }) {
  const [ordenes, setOrdenes] = useState([]);
  const [idOrden, setIdOrden] = useState("");
  const [nroFactura, setNroFactura] = useState("");
  const [fechaEmision, setFechaEmision] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [montoFacturado, setMontoFacturado] = useState("0.00");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadOrdenes = async () => {
      try {
        const data = await getOrdenesTrabajo();
        const list = Array.isArray(data) ? data : data.results || [];
        setOrdenes(list);
        if (list.length > 0) {
          setIdOrden(list[0].id_orden);
          setMontoFacturado(list[0].monto_total || "0.00");
        }
      } catch (err) {
        console.error("Error cargando órdenes para facturación:", err);
      }
    };
    loadOrdenes();
  }, []);

  const selectedOrden = ordenes.find(
    (o) => String(o.id_orden) === String(idOrden)
  );

  const handleOrdenChange = (e) => {
    const val = e.target.value;
    setIdOrden(val);
    const found = ordenes.find((o) => String(o.id_orden) === String(val));
    if (found) {
      setMontoFacturado(found.monto_total);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);
    try {
      const resp = await emitirFacturaCuenta({
        id_orden: Number(idOrden),
        nro_factura: nroFactura.trim(),
        fecha_emision: fechaEmision,
        monto_facturado: montoFacturado,
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
        "No se pudo emitir la factura.";
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
          <div className="modal-header bg-dark text-white">
            <h5 className="modal-title fw-bold">
              <i className="bi bi-receipt-cutoff me-2"></i>
              Emitir Factura y Generar Cuenta por Cobrar (HU-013)
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
                  Orden de Trabajo a Facturar *
                </label>
                <select
                  className="form-select fw-semibold"
                  value={idOrden}
                  onChange={handleOrdenChange}
                  required
                >
                  {ordenes.map((ot) => (
                    <option key={ot.id_orden} value={ot.id_orden}>
                      {ot.codigo_seguimiento} • {ot.vehiculo_patente} (
                      {ot.aseguradora_nombre || ot.cliente_nombre})
                    </option>
                  ))}
                </select>
              </div>

              {selectedOrden && (
                <div className="p-2 rounded bg-light border small mb-3">
                  <div>
                    Deudor:{" "}
                    <strong>
                      {selectedOrden.aseguradora_nombre
                        ? `Aseguradora: ${selectedOrden.aseguradora_nombre}`
                        : `Particular: ${selectedOrden.cliente_nombre}`}
                    </strong>
                  </div>
                  <div className="text-muted">
                    El vencimiento se calculará automáticamente sumando el plazo
                    configurado de la aseguradora (HU-004 y HU-013 Criterio 1).
                  </div>
                </div>
              )}

              <div className="mb-3">
                <label className="form-label fw-semibold small">
                  Número de Factura Electrónica *
                </label>
                <input
                  type="text"
                  className="form-control text-uppercase fw-bold"
                  placeholder="Ej: FAC-A-0001-00280"
                  value={nroFactura}
                  onChange={(e) => setNroFactura(e.target.value)}
                  required
                />
              </div>

              <div className="row g-3">
                <div className="col-6">
                  <label className="form-label fw-semibold small">
                    Fecha de Emisión *
                  </label>
                  <input
                    type="date"
                    className="form-control"
                    value={fechaEmision}
                    onChange={(e) => setFechaEmision(e.target.value)}
                    required
                  />
                </div>

                <div className="col-6">
                  <label className="form-label fw-semibold small">
                    Monto Facturado ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="form-control fw-bold"
                    value={montoFacturado}
                    onChange={(e) => setMontoFacturado(e.target.value)}
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
                  ? "Generando..."
                  : "Emitir Factura y Calcular Vencimiento"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
