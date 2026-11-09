import React, { useEffect, useState } from "react";
import {
  eliminarMovimientoFinanciero,
  getCuentasPorCobrar,
  getMovimientosFinancieros,
} from "../../api/financeApi";
import FinancialMovementModal from "./FinancialMovementModal";
import IssueInvoiceModal from "./IssueInvoiceModal";

const formatCurrency = (val) => {
  if (val === null || val === undefined) return "—";
  return Number(val).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  });
};

const formatDateShort = (dateStr) => {
  if (!dateStr) return "—";
  const parts = String(dateStr).split("T")[0].split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
};

export default function FinancePage() {
  const [cuentas, setCuentas] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("cuentas"); // "cuentas" | "caja"
  const [search, setSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("");

  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedCuentaCobro, setSelectedCuentaCobro] = useState(null);
  const [editingMovement, setEditingMovement] = useState(null);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [defaultMovementTipo, setDefaultMovementTipo] = useState("ingreso");
  const [feedback, setFeedback] = useState(null);

  const handleDeleteMovement = async (mov) => {
    if (
      !window.confirm(
        `¿Seguro que querés eliminar el ${mov.tipo} "${mov.concepto}" por ${formatCurrency(
          mov.monto
        )}?`
      )
    ) {
      return;
    }
    try {
      const resp = await eliminarMovimientoFinanciero(mov.id_movimiento);
      setFeedback(resp.detail);
      loadData();
    } catch {
      alert("No se pudo eliminar el movimiento financiero.");
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [cData, mData] = await Promise.all([
        getCuentasPorCobrar(),
        getMovimientosFinancieros(),
      ]);
      setCuentas(Array.isArray(cData) ? cData : cData.results || []);
      setMovimientos(Array.isArray(mData) ? mData : mData.results || []);
    } catch (err) {
      console.error("Error cargando finanzas:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredCuentas = cuentas.filter((c) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      c.nro_factura?.toLowerCase().includes(q) ||
      c.orden_codigo?.toLowerCase().includes(q) ||
      c.vehiculo_patente?.toLowerCase().includes(q) ||
      c.compania_nombre?.toLowerCase().includes(q);
    if (!matchesSearch) return false;
    if (estadoFilter && c.estado_cobranza !== estadoFilter) return false;
    return true;
  });

  const totalCarteraPendiente = cuentas.reduce(
    (acc, c) => acc + Number(c.saldo_pendiente || 0),
    0
  );
  const totalVencidoMora = cuentas
    .filter((c) => c.en_mora)
    .reduce((acc, c) => acc + Number(c.saldo_pendiente || 0), 0);

  const totalIngresosCaja = movimientos
    .filter((m) => m.tipo === "ingreso")
    .reduce((acc, m) => acc + Number(m.monto || 0), 0);
  const totalEgresosCaja = movimientos
    .filter((m) => m.tipo === "egreso")
    .reduce((acc, m) => acc + Number(m.monto || 0), 0);
  const balanceNetoCaja = totalIngresosCaja - totalEgresosCaja;

  const renderEstadoBadge = (c) => {
    if (c.estado_cobranza === "cancelada") {
      return <span className="badge bg-success">Cancelada</span>;
    }
    if (c.estado_cobranza === "vencida_en_mora" || c.en_mora) {
      return (
        <span className="badge bg-danger">
          <i className="bi bi-exclamation-octagon-fill me-1"></i>
          Vencida / En mora (+{c.dias_mora} días)
        </span>
      );
    }
    if (c.estado_cobranza === "pago_parcial") {
      return (
        <span className="badge bg-warning text-dark">
          Pago Parcial (En Plazo)
        </span>
      );
    }
    return (
      <span className="badge bg-info text-dark">Pendiente en Plazo</span>
    );
  };

  return (
    <div>
      {/* Encabezado */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
        <div>
          <h4 className="fw-bold mb-1">
            <i className="bi bi-bank2 text-primary me-2"></i>
            Cuentas por Cobrar, Vencimientos y Flujo de Caja
          </h4>
          <p className="text-muted small mb-0">
            Seguimiento de facturas a aseguradoras, alerta automática de mora y conciliación de ingresos/egresos.
          </p>
        </div>

        <div className="d-flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-primary fw-semibold"
            onClick={() => setShowInvoiceModal(true)}
          >
            <i className="bi bi-receipt-cutoff me-1"></i>
            Emitir Factura OT
          </button>

          <button
            type="button"
            className="btn btn-success fw-semibold"
            onClick={() => {
              setSelectedCuentaCobro(null);
              setEditingMovement(null);
              setDefaultMovementTipo("ingreso");
              setShowMovementModal(true);
            }}
          >
            <i className="bi bi-plus-circle me-1"></i>
            Registrar Ingreso
          </button>

          <button
            type="button"
            className="btn btn-danger fw-semibold"
            onClick={() => {
              setSelectedCuentaCobro(null);
              setEditingMovement(null);
              setDefaultMovementTipo("egreso");
              setShowMovementModal(true);
            }}
          >
            <i className="bi bi-dash-circle me-1"></i>
            Registrar Egreso
          </button>
        </div>
      </div>

      {feedback && (
        <div className="alert alert-success d-flex justify-content-between align-items-center shadow-sm mb-4">
          <span>
            <i className="bi bi-check-circle-fill me-2"></i>
            {feedback}
          </span>
          <button
            type="button"
            className="btn-close"
            onClick={() => setFeedback(null)}
          ></button>
        </div>
      )}

      {/* Tarjetas Resumen Financiero (Prototipo 4) */}
      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <div className="card border-0 shadow-sm border-start border-primary border-4 h-100">
            <div className="card-body py-3">
              <div className="text-muted small fw-semibold">
                CARTERA TOTAL POR COBRAR
              </div>
              <div className="fs-4 fw-bold text-dark">
                {formatCurrency(totalCarteraPendiente)}
              </div>
              <small className="text-muted">
                {cuentas.filter((c) => Number(c.saldo_pendiente) > 0).length}{" "}
                factura(s) con saldo abierto
              </small>
            </div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card border-0 shadow-sm border-start border-danger border-4 h-100">
            <div className="card-body py-3">
              <div className="text-muted small fw-semibold">
                VENCIDO EN MORA (RECLAMO URGENTE)
              </div>
              <div className="fs-4 fw-bold text-danger">
                {formatCurrency(totalVencidoMora)}
              </div>
              <small className="text-danger fw-semibold">
                {cuentas.filter((c) => c.en_mora).length} factura(s) con plazo
                vencido
              </small>
            </div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card border-0 shadow-sm border-start border-success border-4 h-100">
            <div className="card-body py-3">
              <div className="text-muted small fw-semibold">
                INGRESOS COBRADOS EN CAJA
              </div>
              <div className="fs-4 fw-bold text-success">
                {formatCurrency(totalIngresosCaja)}
              </div>
              <small className="text-muted">
                Egresos: {formatCurrency(totalEgresosCaja)}
              </small>
            </div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card border-0 shadow-sm border-start border-dark border-4 h-100">
            <div className="card-body py-3">
              <div className="text-muted small fw-semibold">
                FLUJO DE CAJA NETO (BALANCE)
              </div>
              <div
                className={`fs-4 fw-bold ${
                  balanceNetoCaja >= 0 ? "text-primary" : "text-danger"
                }`}
              >
                {formatCurrency(balanceNetoCaja)}
              </div>
              <small className="text-muted">
                Ingresos cobrados menos egresos
              </small>
            </div>
          </div>
        </div>
      </div>

      {/* Pestañas: Cuentas por Cobrar vs Libro de Caja */}
      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link fw-semibold ${
              activeTab === "cuentas" ? "active" : ""
            }`}
            onClick={() => setActiveTab("cuentas")}
          >
            <i className="bi bi-file-earmark-spreadsheet me-1"></i>
            Cartera de Cuentas por Cobrar y Mora ({cuentas.length})
          </button>
        </li>
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link fw-semibold ${
              activeTab === "caja" ? "active" : ""
            }`}
            onClick={() => setActiveTab("caja")}
          >
            <i className="bi bi-journal-check me-1"></i>
            Flujo de Caja: Ingresos y Egresos ({movimientos.length})
          </button>
        </li>
      </ul>

      {activeTab === "cuentas" ? (
        <>
          <div className="card border-0 shadow-sm mb-3">
            <div className="card-body d-flex flex-column flex-md-row gap-3 justify-content-between align-items-md-center">
              <div className="input-group" style={{ maxWidth: "460px" }}>
                <span className="input-group-text bg-white">
                  <i className="bi bi-search text-muted"></i>
                </span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Buscar por N° Factura, OT, patente o aseguradora..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <select
                className="form-select"
                style={{ maxWidth: "240px" }}
                value={estadoFilter}
                onChange={(e) => setEstadoFilter(e.target.value)}
              >
                <option value="">Todos los estados de cobranza</option>
                <option value="vencida_en_mora">Vencida / En mora</option>
                <option value="pendiente_en_plazo">Pendiente en plazo</option>
                <option value="pago_parcial">Pago parcial</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </div>
          </div>

          <div className="card border-0 shadow-sm">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>N° Factura</th>
                    <th>Orden / Vehículo</th>
                    <th>Aseguradora / Deudor</th>
                    <th>Emisión</th>
                    <th>Vencimiento</th>
                    <th className="text-end">Facturado</th>
                    <th className="text-end">Cobrado</th>
                    <th className="text-end">Saldo Pendiente</th>
                    <th>Estado y Mora</th>
                    <th className="text-end">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="10" className="text-center py-4 text-muted">
                        Cargando cuentas por cobrar...
                      </td>
                    </tr>
                  ) : filteredCuentas.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="text-center py-4 text-muted">
                        No hay facturas que coincidan con el filtro.
                      </td>
                    </tr>
                  ) : (
                    filteredCuentas.map((c) => (
                      <tr
                        key={c.id_cuenta}
                        className={c.en_mora ? "table-danger" : ""}
                      >
                        <td className="fw-bold font-monospace">
                          {c.nro_factura}
                        </td>
                        <td>
                          <span className="badge bg-dark me-1">
                            {c.orden_codigo}
                          </span>
                          <span className="fw-semibold">
                            {c.vehiculo_patente}
                          </span>
                        </td>
                        <td>
                          <div className="fw-semibold">{c.compania_nombre}</div>
                          <small className="text-muted">
                            Plazo pactado: {c.plazo_pago_dias} días
                          </small>
                        </td>
                        <td className="small">
                          {formatDateShort(c.fecha_emision)}
                        </td>
                        <td className="small fw-semibold">
                          {formatDateShort(c.fecha_vencimiento)}
                        </td>
                        <td className="text-end">
                          {formatCurrency(c.monto_facturado)}
                        </td>
                        <td className="text-end text-success fw-semibold">
                          {formatCurrency(c.monto_cobrado)}
                        </td>
                        <td className="text-end fw-bold text-danger">
                          {formatCurrency(c.saldo_pendiente)}
                        </td>
                        <td>{renderEstadoBadge(c)}</td>
                        <td className="text-end">
                          {Number(c.saldo_pendiente) > 0 ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-success fw-semibold"
                              onClick={() => {
                                setSelectedCuentaCobro(c);
                                setShowMovementModal(true);
                              }}
                            >
                              <i className="bi bi-cash-coin me-1"></i>
                              Imputar Cobro
                            </button>
                          ) : (
                            <span className="text-muted small">Saldada</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="card border-0 shadow-sm">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Fecha</th>
                  <th>Flujo</th>
                  <th>Categoría</th>
                  <th>Concepto / Detalle</th>
                  <th>Medio de Pago</th>
                  <th>Vínculo (OT / Factura)</th>
                  <th>Registrado por</th>
                  <th className="text-end">Monto ($)</th>
                  <th className="text-end">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="text-center py-4 text-muted">
                      No hay movimientos financieros registrados.
                    </td>
                  </tr>
                ) : (
                  movimientos.map((m) => (
                    <tr key={m.id_movimiento}>
                      <td className="small fw-semibold">
                        {formatDateShort(m.fecha)}
                      </td>
                      <td>
                        {m.tipo === "ingreso" ? (
                          <span className="badge bg-success">INGRESO</span>
                        ) : (
                          <span className="badge bg-danger">EGRESO</span>
                        )}
                      </td>
                      <td className="fw-semibold">{m.categoria}</td>
                      <td>{m.concepto}</td>
                      <td>
                        <span className="badge bg-light text-dark border text-uppercase">
                          {m.medio_pago}
                        </span>
                      </td>
                      <td>
                        {m.nro_factura && (
                          <span className="badge bg-primary me-1">
                            {m.nro_factura}
                          </span>
                        )}
                        {m.orden_codigo && (
                          <span className="badge bg-dark">
                            {m.orden_codigo}
                          </span>
                        )}
                        {!m.nro_factura && !m.orden_codigo && "—"}
                      </td>
                      <td className="small text-muted">{m.usuario_nombre}</td>
                      <td
                        className={`text-end fw-bold ${
                          m.tipo === "ingreso" ? "text-success" : "text-danger"
                        }`}
                      >
                        {m.tipo === "ingreso" ? "+" : "-"}
                        {formatCurrency(m.monto)}
                      </td>
                      <td className="text-end">
                        <div className="d-inline-flex gap-1 justify-content-end">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary"
                            title="Editar importe, fecha, medio de pago o concepto"
                            onClick={() => {
                              setSelectedCuentaCobro(null);
                              setEditingMovement(m);
                              setShowMovementModal(true);
                            }}
                          >
                            <i className="bi bi-pencil-square me-1"></i>
                            Editar
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            title="Eliminar movimiento"
                            onClick={() => handleDeleteMovement(m)}
                          >
                            <i className="bi bi-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showInvoiceModal && (
        <IssueInvoiceModal
          onClose={() => setShowInvoiceModal(false)}
          onSuccess={(resp) => {
            setShowInvoiceModal(false);
            setFeedback(resp.detail);
            loadData();
          }}
        />
      )}

      {showMovementModal && (
        <FinancialMovementModal
          preselectedCuenta={selectedCuentaCobro}
          editingMovement={editingMovement}
          defaultTipo={defaultMovementTipo}
          onClose={() => {
            setShowMovementModal(false);
            setEditingMovement(null);
          }}
          onSuccess={(resp) => {
            setShowMovementModal(false);
            setEditingMovement(null);
            setFeedback(resp.detail);
            loadData();
          }}
        />
      )}
    </div>
  );
}
