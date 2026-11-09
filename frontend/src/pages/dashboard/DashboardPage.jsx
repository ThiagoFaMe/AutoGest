import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getDashboardKPIs } from "../../api/financeApi";
import { getOrdenesTrabajo } from "../../api/workordersApi";

const formatCurrency = (val) => {
  if (val === null || val === undefined) return "$ 0,00";
  return Number(val).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  });
};

export default function DashboardPage() {
  const [kpis, setKpis] = useState(null);
  const [ordenes, setOrdenes] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const [kpiData, otData] = await Promise.all([
        getDashboardKPIs(),
        getOrdenesTrabajo(),
      ]);
      setKpis(kpiData);
      setOrdenes(Array.isArray(otData) ? otData : otData.results || []);
    } catch (err) {
      console.error("Error cargando Dashboard de KPIs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  if (loading || !kpis) {
    return (
      <div className="text-center py-5 text-muted">
        Calculando indicadores operativos y financieros en tiempo real...
      </div>
    );
  }

  const maxFaseCount = Math.max(
    1,
    ...(kpis.distribucion_fases || []).map((f) => f.cantidad_vehiculos)
  );

  return (
    <div>
      {/* Encabezado Prototipo 1 */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
        <div>
          <h4 className="fw-bold mb-1">
            <i className="bi bi-speedometer2 text-primary me-2"></i>
            Dashboard Principal — Panel de Control de KPIs
          </h4>
          <p className="text-muted small mb-0">
            Métricas en tiempo real de planta, conversión de presupuestos, stock crítico, cartera de seguros y flujo de caja.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-outline-primary btn-sm fw-semibold"
          onClick={loadDashboard}
        >
          <i className="bi bi-arrow-clockwise me-1"></i>
          Recalcular Indicadores
        </button>
      </div>

      {/* Las 6 Tarjetas de KPIs de HU-014 Criterio 3 (a..f) */}
      <div className="row g-3 mb-4">
        {/* KPI (a): Vehículos en Taller */}
        <div className="col-md-4 col-xl-2">
          <div className="card border-0 shadow-sm h-100 border-top border-primary border-4">
            <div className="card-body py-3">
              <div className="text-muted small fw-semibold">
                (a) VEHÍCULOS EN TALLER
              </div>
              <div className="fs-3 fw-bold text-primary mt-1">
                {kpis.vehiculos_en_taller}
              </div>
              <small
                className={
                  kpis.vehiculos_en_retraso > 0
                    ? "text-danger fw-bold"
                    : "text-muted"
                }
              >
                {kpis.vehiculos_en_retraso} unidad(es) en retraso
              </small>
            </div>
          </div>
        </div>

        {/* KPI (b): Tiempo Promedio de Ciclo */}
        <div className="col-md-4 col-xl-2">
          <div className="card border-0 shadow-sm h-100 border-top border-info border-4">
            <div className="card-body py-3">
              <div className="text-muted small fw-semibold">
                (b) TIEMPO PROM. CICLO
              </div>
              <div className="fs-3 fw-bold text-dark mt-1">
                {kpis.tiempo_promedio_ciclo_dias} <span className="fs-6">días</span>
              </div>
              <small className="text-muted">
                Prom. por fase: {kpis.tiempo_promedio_fase_horas} hs
              </small>
            </div>
          </div>
        </div>

        {/* KPI (c): Tasa de Conversión de Presupuestos */}
        <div className="col-md-4 col-xl-2">
          <div className="card border-0 shadow-sm h-100 border-top border-success border-4">
            <div className="card-body py-3">
              <div className="text-muted small fw-semibold">
                (c) CONVERSIÓN COTIZ.
              </div>
              <div className="fs-3 fw-bold text-success mt-1">
                {kpis.tasa_conversion_presupuestos}%
              </div>
              <small className="text-muted">
                {kpis.presupuestos_aprobados} aprob. de{" "}
                {kpis.presupuestos_emitidos_totales} emitidos
              </small>
            </div>
          </div>
        </div>

        {/* KPI (d): Flujo de Caja Neto */}
        <div className="col-md-4 col-xl-2">
          <div className="card border-0 shadow-sm h-100 border-top border-dark border-4">
            <div className="card-body py-3">
              <div className="text-muted small fw-semibold">
                (d) FLUJO CAJA NETO
              </div>
              <div className="fs-5 fw-bold text-dark mt-1">
                {formatCurrency(kpis.flujo_caja_neto)}
              </div>
              <small className="text-success d-block">
                Ing: {formatCurrency(kpis.ingresos_totales)}
              </small>
              <small className="text-danger d-block">
                Egr: {formatCurrency(kpis.egresos_totales)}
              </small>
            </div>
          </div>
        </div>

        {/* KPI (e): Cartera de Deuda Aseguradoras (En Plazo vs En Mora) */}
        <div className="col-md-4 col-xl-2">
          <div className="card border-0 shadow-sm h-100 border-top border-danger border-4">
            <div className="card-body py-3">
              <div className="text-muted small fw-semibold">
                (e) DEUDA EN MORA
              </div>
              <div className="fs-5 fw-bold text-danger mt-1">
                {formatCurrency(kpis.deuda_en_mora)}
              </div>
              <small className="text-muted d-block">
                En plazo: {formatCurrency(kpis.deuda_en_plazo)}
              </small>
              <small className="text-danger fw-semibold">
                {kpis.facturas_en_mora_count} factura(s) vencida(s)
              </small>
            </div>
          </div>
        </div>

        {/* KPI (f): Alertas de Stock Mínimo */}
        <div className="col-md-4 col-xl-2">
          <div className="card border-0 shadow-sm h-100 border-top border-warning border-4">
            <div className="card-body py-3">
              <div className="text-muted small fw-semibold">
                (f) STOCK CRÍTICO
              </div>
              <div className="fs-3 fw-bold text-danger mt-1">
                {kpis.insumos_en_alerta_count}
              </div>
              <Link
                to="/inventario"
                className="small text-decoration-none fw-semibold"
              >
                Ver reposición en Pañol &rarr;
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Fila Central: Gráfico de Distribución por las 8 Fases Operativas + Resumen Financiero */}
      <div className="row g-4 mb-4">
        <div className="col-lg-8">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center">
              <h6 className="fw-bold mb-0">
                <i className="bi bi-bar-chart-steps text-primary me-2"></i>
                Distribución de Unidades en Planta por Fase Secuencial (Detección de Cuellos de Botella)
              </h6>
              <Link to="/ordenes" className="btn btn-sm btn-outline-primary">
                Ir al Tablero de Planta
              </Link>
            </div>
            <div className="card-body">
              <div className="d-flex flex-column gap-3">
                {(kpis.distribucion_fases || []).map((f) => {
                  const widthPct =
                    f.cantidad_vehiculos > 0
                      ? Math.round((f.cantidad_vehiculos / maxFaseCount) * 100)
                      : 4;
                  return (
                    <div key={f.numero_secuencia}>
                      <div className="d-flex justify-content-between small mb-1">
                        <span className="fw-semibold">
                          Fase {f.numero_secuencia}: {f.nombre_fase}
                        </span>
                        <span className="badge bg-dark">
                          {f.cantidad_vehiculos} unidad(es)
                        </span>
                      </div>
                      <div className="progress" style={{ height: "14px" }}>
                        <div
                          className={`progress-bar ${
                            f.cantidad_vehiculos > 0
                              ? "bg-primary"
                              : "bg-secondary opacity-25"
                          }`}
                          style={{ width: `${widthPct}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center">
              <h6 className="fw-bold mb-0">
                <i className="bi bi-pie-chart-fill text-success me-2"></i>
                Estado de Cartera y Presupuestos
              </h6>
              <Link to="/finanzas" className="btn btn-sm btn-outline-success">
                Ver Finanzas
              </Link>
            </div>
            <div className="card-body d-flex flex-column justify-content-between">
              <div>
                <div className="p-3 rounded bg-light border mb-3">
                  <div className="small text-muted">
                    Deuda Total Pendiente de Cobro
                  </div>
                  <div className="fs-4 fw-bold text-dark">
                    {formatCurrency(kpis.deuda_total_aseguradoras)}
                  </div>
                  <hr className="my-2" />
                  <div className="d-flex justify-content-between small mb-1">
                    <span className="text-danger fw-semibold">
                      Cartera Vencida en Mora:
                    </span>
                    <strong className="text-danger">
                      {formatCurrency(kpis.deuda_en_mora)}
                    </strong>
                  </div>
                  <div className="d-flex justify-content-between small">
                    <span className="text-success fw-semibold">
                      Cartera Regular en Plazo:
                    </span>
                    <strong className="text-success">
                      {formatCurrency(kpis.deuda_en_plazo)}
                    </strong>
                  </div>
                </div>

                <div className="p-3 rounded bg-light border">
                  <div className="small text-muted">
                    Embudo Comercial de Presupuestos
                  </div>
                  <div className="d-flex justify-content-between small mt-2">
                    <span>Emitidos Totales:</span>
                    <strong>{kpis.presupuestos_emitidos_totales}</strong>
                  </div>
                  <div className="d-flex justify-content-between small mt-1">
                    <span>Aprobados (Convertidos en OT):</span>
                    <strong className="text-success">
                      {kpis.presupuestos_aprobados}
                    </strong>
                  </div>
                  <div className="d-flex justify-content-between small mt-1">
                    <span>Pendientes de Orden Pericial:</span>
                    <strong className="text-primary">
                      {kpis.presupuestos_pendientes}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="d-grid gap-2 mt-3">
                <Link to="/presupuestos" className="btn btn-outline-dark btn-sm">
                  Abrir Confección de Presupuestos
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla Inferior Prototipo 1: Órdenes de Trabajo en Curso */}
      <div className="card border-0 shadow-sm">
        <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center">
          <h6 className="fw-bold mb-0">
            <i className="bi bi-list-check text-primary me-2"></i>
            Resumen de Órdenes de Trabajo Activas en Planta
          </h6>
          <Link to="/ordenes" className="small fw-semibold text-decoration-none">
            Gestionar Fases Secuenciales &rarr;
          </Link>
        </div>
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>Código OT</th>
                <th>Dominio y Vehículo</th>
                <th>Cliente / Aseguradora</th>
                <th>Fase Actual</th>
                <th>Avance</th>
                <th className="text-end">Monto Acordado</th>
                <th className="text-end">Saldo Pendiente</th>
                <th>Estado Plazo</th>
              </tr>
            </thead>
            <tbody>
              {ordenes.map((ot) => (
                <tr key={ot.id_orden}>
                  <td>
                    <span className="badge bg-dark">{ot.codigo_seguimiento}</span>
                  </td>
                  <td className="fw-semibold">
                    {ot.vehiculo_patente} — {ot.vehiculo_descripcion}
                  </td>
                  <td>
                    {ot.aseguradora_nombre
                      ? `${ot.aseguradora_nombre} (${ot.cliente_nombre})`
                      : ot.cliente_nombre}
                  </td>
                  <td>
                    <span className="badge bg-primary">{ot.estado_actual}</span>
                  </td>
                  <td style={{ minWidth: "130px" }}>
                    <div className="progress" style={{ height: "7px" }}>
                      <div
                        className="progress-bar bg-primary"
                        style={{ width: `${ot.progreso_porcentaje}%` }}
                      ></div>
                    </div>
                    <small className="text-muted">
                      {ot.progreso_porcentaje}% ({ot.fases_completadas}/8)
                    </small>
                  </td>
                  <td className="text-end">{formatCurrency(ot.monto_total)}</td>
                  <td className="text-end fw-bold text-danger">
                    {formatCurrency(ot.saldo_pendiente)}
                  </td>
                  <td>
                    {ot.en_retraso ? (
                      <span className="badge bg-danger">
                        +{ot.dias_retraso}d retraso
                      </span>
                    ) : (
                      <span className="badge bg-success-subtle text-success border">
                        En término
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
