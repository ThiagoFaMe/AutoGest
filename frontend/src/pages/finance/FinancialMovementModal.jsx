import React, { useState } from "react";
import { registrarMovimientoFinanciero } from "../../api/financeApi";

const CATEGORIAS_INGRESO = [
  "Liquidación Aseguradora",
  "Cobro Particular",
  "Otro Ingreso",
];
const CATEGORIAS_EGRESO = [
  "Compra Insumos",
  "Gasto Operativo",
  "Servicios e Impuestos",
  "Sueldos y Adelantos",
];

export default function FinancialMovementModal({
  preselectedCuenta,
  defaultTipo = "ingreso",
  onClose,
  onSuccess,
}) {
  const [tipo, setTipo] = useState(
    preselectedCuenta ? "ingreso" : defaultTipo
  );
  const [categoria, setCategoria] = useState(
    preselectedCuenta
      ? preselectedCuenta.id_compania
        ? "Liquidación Aseguradora"
        : "Cobro Particular"
      : defaultTipo === "ingreso"
      ? "Liquidación Aseguradora"
      : "Compra Insumos"
  );
  const [concepto, setConcepto] = useState(
    preselectedCuenta
      ? `Cobro Factura ${preselectedCuenta.nro_factura} (${preselectedCuenta.orden_codigo})`
      : ""
  );
  const [monto, setMonto] = useState(
    preselectedCuenta ? preselectedCuenta.saldo_pendiente : ""
  );
  const [medioPago, setMedioPago] = useState(
    preselectedCuenta?.id_compania ? "e-cheq" : "transferencia"
  );
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handleTipoChange = (newTipo) => {
    setTipo(newTipo);
    setCategoria(
      newTipo === "ingreso" ? "Liquidación Aseguradora" : "Compra Insumos"
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);
    try {
      const resp = await registrarMovimientoFinanciero({
        fecha,
        tipo,
        categoria,
        concepto: concepto.trim(),
        monto,
        medio_pago: medioPago,
        id_cuenta: preselectedCuenta ? preselectedCuenta.id_cuenta : null,
        id_orden: preselectedCuenta ? preselectedCuenta.id_orden : null,
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
        "No se pudo registrar el movimiento financiero.";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const categoriasList =
    tipo === "ingreso" ? CATEGORIAS_INGRESO : CATEGORIAS_EGRESO;

  return (
    <div
      className="modal d-block"
      style={{ backgroundColor: "rgba(15, 23, 42, 0.72)", zIndex: 1060 }}
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content border-0 shadow-lg">
          <div
            className={`modal-header text-white ${
              tipo === "ingreso" ? "bg-success" : "bg-danger"
            }`}
          >
            <h5 className="modal-title fw-bold">
              <i className="bi bi-cash-coin me-2"></i>
              {preselectedCuenta
                ? `Imputar Cobro a Factura ${preselectedCuenta.nro_factura} (HU-013)`
                : "Registrar Movimiento Financiero de Caja (HU-014)"}
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

              {preselectedCuenta ? (
                <div className="p-3 rounded bg-light border mb-3 small">
                  <div className="d-flex justify-content-between mb-1">
                    <span>Comprobante:</span>
                    <strong>{preselectedCuenta.nro_factura}</strong>
                  </div>
                  <div className="d-flex justify-content-between mb-1">
                    <span>Deudor:</span>
                    <strong>{preselectedCuenta.compania_nombre}</strong>
                  </div>
                  <div className="d-flex justify-content-between text-danger">
                    <span>Saldo Pendiente Máximo:</span>
                    <strong>
                      ${" "}
                      {Number(
                        preselectedCuenta.saldo_pendiente
                      ).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                    </strong>
                  </div>
                </div>
              ) : (
                <div className="mb-3">
                  <label className="form-label fw-semibold small">
                    Tipo de Flujo de Fondos *
                  </label>
                  <div className="btn-group w-100">
                    <button
                      type="button"
                      className={`btn ${
                        tipo === "ingreso"
                          ? "btn-success fw-bold"
                          : "btn-outline-secondary"
                      }`}
                      onClick={() => handleTipoChange("ingreso")}
                    >
                      <i className="bi bi-arrow-down-left-circle me-1"></i>
                      Ingreso (Cobro)
                    </button>
                    <button
                      type="button"
                      className={`btn ${
                        tipo === "egreso"
                          ? "btn-danger fw-bold"
                          : "btn-outline-secondary"
                      }`}
                      onClick={() => handleTipoChange("egreso")}
                    >
                      <i className="bi bi-arrow-up-right-circle me-1"></i>
                      Egreso (Pago / Gasto)
                    </button>
                  </div>
                </div>
              )}

              <div className="row g-3 mb-3">
                <div className="col-6">
                  <label className="form-label fw-semibold small">
                    Categoría Financiera *
                  </label>
                  <select
                    className="form-select"
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                  >
                    {categoriasList.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-6">
                  <label className="form-label fw-semibold small">
                    Instrumento / Medio de Pago *
                  </label>
                  <select
                    className="form-select"
                    value={medioPago}
                    onChange={(e) => setMedioPago(e.target.value)}
                  >
                    <option value="transferencia">Transferencia Bancaria</option>
                    <option value="e-cheq">e-Cheq (Cheque Electrónico)</option>
                    <option value="efectivo">Efectivo</option>
                  </select>
                </div>
              </div>

              <div className="row g-3 mb-3">
                <div className="col-6">
                  <label className="form-label fw-semibold small">
                    Importe en Pesos ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="form-control fw-bold"
                    placeholder="0.00"
                    value={monto}
                    onChange={(e) => setMonto(e.target.value)}
                    required
                  />
                </div>

                <div className="col-6">
                  <label className="form-label fw-semibold small">
                    Fecha del Movimiento *
                  </label>
                  <input
                    type="date"
                    className="form-control"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="mb-2">
                <label className="form-label fw-semibold small">
                  Concepto / Detalle del Comprobante *
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Ej: Cobro e-cheq Factura FAC-A-0001-00148 o Pago EPEC"
                  value={concepto}
                  onChange={(e) => setConcepto(e.target.value)}
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
                className={`btn fw-semibold px-4 ${
                  tipo === "ingreso" ? "btn-success" : "btn-danger"
                }`}
                disabled={loading}
              >
                {loading
                  ? "Registrando..."
                  : tipo === "ingreso"
                  ? "Confirmar Cobro"
                  : "Confirmar Egreso"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
