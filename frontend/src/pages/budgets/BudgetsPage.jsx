import React, { useEffect, useState } from "react";
import {
  emitirPresupuesto,
  getPresupuestos,
  rechazarPresupuesto,
} from "../../api/budgetsApi";
import {
  getAseguradoras,
  getClientes,
  getVehiculos,
} from "../../api/coreApi";
import BudgetApproveModal from "./BudgetApproveModal";
import BudgetFormModal from "./BudgetFormModal";
import BudgetPrintModal from "./BudgetPrintModal";

const ESTADO_BADGE = {
  borrador: "bg-secondary",
  emitido: "bg-warning text-dark",
  aprobado: "bg-success",
  rechazado: "bg-danger",
  vencido: "bg-dark",
};

export default function BudgetsPage() {
  const [presupuestos, setPresupuestos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [aseguradoras, setAseguradoras] = useState([]);

  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState("");
  const [filterEstado, setFilterEstado] = useState("");
  const [loading, setLoading] = useState(true);

  const [showFormModal, setShowFormModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [approvingBudget, setApprovingBudget] = useState(null);
  const [printingBudget, setPrintingBudget] = useState(null);

  const [feedback, setFeedback] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const fetchAll = async (q = search, t = filterTipo, est = filterEstado) => {
    setLoading(true);
    try {
      const params = {};
      if (q.trim()) params.search = q.trim();
      if (t) params.tipo = t;
      if (est) params.estado = est;

      const [presData, cliData, vehData, asegData] = await Promise.all([
        getPresupuestos(params),
        getClientes({ activo: true }),
        getVehiculos(),
        getAseguradoras(),
      ]);
      setPresupuestos(presData);
      setClientes(cliData);
      setVehiculos(vehData);
      setAseguradoras(asegData);
    } catch {
      setErrorMsg("Error al cargar el listado de presupuestos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handleEmitir = async (p) => {
    setErrorMsg("");
    try {
      const res = await emitirPresupuesto(p.id_presupuesto);
      setFeedback(res.detail);
      fetchAll();
    } catch (err) {
      setErrorMsg(
        err.response?.data?.[0] ||
          err.response?.data?.detail ||
          "No se pudo emitir el presupuesto."
      );
    }
  };

  const handleRechazar = async (p) => {
    setErrorMsg("");
    try {
      const res = await rechazarPresupuesto(p.id_presupuesto, {
        observaciones: "Cotización rechazada por el cliente / aseguradora.",
      });
      setFeedback(res.detail);
      fetchAll();
    } catch {
      setErrorMsg("No se pudo rechazar el presupuesto.");
    }
  };

  return (
    <div>
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-2">
        <div>
          <h4 className="fw-bold mb-1">
            <i className="bi bi-file-earmark-text-fill text-primary me-2"></i>
            Gestión de Presupuestos y Apertura Automática de OT (Sprint 2)
          </h4>
          <p className="text-muted small mb-0">
            Cotizaciones Particulares (HU-005), Siniestros de Aseguradoras (HU-006) y Generación 1:1 de Orden de Trabajo con sus 8 fases (HU-007).
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setEditingBudget(null);
            setShowFormModal(true);
          }}
        >
          <i className="bi bi-plus-circle-fill me-2"></i>
          Nuevo Presupuesto
        </button>
      </div>

      {feedback && (
        <div className="alert alert-success alert-dismissible fade show small">
          <i className="bi bi-check-circle-fill me-2"></i>
          {feedback}
          <button
            type="button"
            className="btn-close"
            onClick={() => setFeedback("")}
          ></button>
        </div>
      )}

      {errorMsg && (
        <div className="alert alert-danger alert-dismissible fade show small">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          {errorMsg}
          <button
            type="button"
            className="btn-close"
            onClick={() => setErrorMsg("")}
          ></button>
        </div>
      )}

      {/* Filtros y Búsqueda */}
      <div className="card card-stat">
        <div className="card-body">
          <div className="row g-2 align-items-center mb-3">
            <div className="col-md-5">
              <div className="input-group">
                <span className="input-group-text bg-white">
                  <i className="bi bi-search"></i>
                </span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Buscar por patente, apellido, DNI, aseguradora o siniestro..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    fetchAll(e.target.value, filterTipo, filterEstado);
                  }}
                />
              </div>
            </div>
            <div className="col-md-3">
              <select
                className="form-select"
                value={filterTipo}
                onChange={(e) => {
                  setFilterTipo(e.target.value);
                  fetchAll(search, e.target.value, filterEstado);
                }}
              >
                <option value="">Todas las modalidades</option>
                <option value="particular">Particular (HU-005)</option>
                <option value="aseguradora">Compañía Aseguradora (HU-006)</option>
              </select>
            </div>
            <div className="col-md-2">
              <select
                className="form-select"
                value={filterEstado}
                onChange={(e) => {
                  setFilterEstado(e.target.value);
                  fetchAll(search, filterTipo, e.target.value);
                }}
              >
                <option value="">Todos los estados</option>
                <option value="borrador">Borrador</option>
                <option value="emitido">Emitido</option>
                <option value="aprobado">Aprobado (Con OT)</option>
                <option value="rechazado">Rechazado</option>
              </select>
            </div>
            <div className="col-md-2 text-md-end text-muted small">
              Total: <strong>{presupuestos.length}</strong>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>N.º</th>
                  <th>Vehículo / Cliente</th>
                  <th>Modalidad / Siniestro</th>
                  <th>Emisión y Validez</th>
                  <th className="text-end">Total ($)</th>
                  <th>Estado / Orden (1:1)</th>
                  <th className="text-end">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="text-center py-4 text-muted">
                      Cargando presupuestos...
                    </td>
                  </tr>
                ) : presupuestos.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-4 text-muted">
                      No se encontraron presupuestos registrados.
                    </td>
                  </tr>
                ) : (
                  presupuestos.map((p) => (
                    <tr key={p.id_presupuesto}>
                      <td className="fw-bold text-secondary">
                        #{String(p.id_presupuesto).padStart(4, "0")}
                      </td>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <span className="patente-badge small">
                            {p.vehiculo_patente}
                          </span>
                          <span className="fw-semibold">{p.cliente_nombre}</span>
                        </div>
                        <div className="small text-muted">
                          {p.vehiculo_detalle}
                        </div>
                      </td>
                      <td>
                        {p.tipo === "aseguradora" ? (
                          <div>
                            <span className="badge bg-info-subtle text-dark border border-info-subtle mb-1">
                              <i className="bi bi-shield-check me-1"></i>
                              {p.compania_nombre}
                            </span>
                            <div className="small text-muted">
                              Siniestro: <strong>{p.nro_siniestro}</strong> •
                              Perito: {p.nombre_perito}
                            </div>
                          </div>
                        ) : (
                          <span className="badge bg-light text-dark border">
                            <i className="bi bi-person me-1"></i>
                            Cliente Particular
                          </span>
                        )}
                      </td>
                      <td className="small">
                        {p.fecha_emision ? (
                          <>
                            <div>Emitido: {p.fecha_emision}</div>
                            <div className="text-muted">
                              Vence: {p.fecha_vencimiento}
                            </div>
                            {p.estado === "emitido" &&
                              p.tipo === "aseguradora" && (
                                <span className="badge bg-warning-subtle text-dark border mt-1">
                                  En espera de perito: {p.dias_espera_aprobacion} día(s)
                                </span>
                              )}
                          </>
                        ) : (
                          <span className="text-muted">Sin emitir (Borrador)</span>
                        )}
                      </td>
                      <td className="text-end">
                        <div className="fw-bold">
                          ${" "}
                          {Number(p.monto_total).toLocaleString("es-AR", {
                            minimumFractionDigits: 2,
                          })}
                        </div>
                        <div className="small text-muted">
                          M.O.: $
                          {Number(p.monto_mano_obra).toLocaleString("es-AR")}
                        </div>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            ESTADO_BADGE[p.estado] || "bg-secondary"
                          } text-uppercase`}
                        >
                          {p.estado}
                        </span>
                        {p.orden_trabajo_resumen && (
                          <div className="mt-1">
                            <span className="badge bg-success-subtle text-success border border-success-subtle">
                              <i className="bi bi-wrench-adjustable me-1"></i>
                              {p.orden_trabajo_resumen.codigo_seguimiento}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="text-end">
                        <div className="d-inline-flex gap-1 flex-wrap justify-content-end">
                          <button
                            className="btn btn-sm btn-outline-dark"
                            title="Ver comprobante imprimible / PDF y hoja de ruta"
                            onClick={() => setPrintingBudget(p)}
                          >
                            <i className="bi bi-printer"></i>
                          </button>

                          {(p.estado === "borrador" ||
                            p.estado === "emitido") && (
                            <button
                              className="btn btn-sm btn-outline-primary"
                              title="Editar ítems del presupuesto"
                              onClick={() => {
                                setEditingBudget(p);
                                setShowFormModal(true);
                              }}
                            >
                              <i className="bi bi-pencil-square"></i>
                            </button>
                          )}

                          {p.estado === "borrador" && (
                            <button
                              className="btn btn-sm btn-warning fw-semibold"
                              onClick={() => handleEmitir(p)}
                            >
                              Emitir
                            </button>
                          )}

                          {p.estado === "emitido" && (
                            <>
                              <button
                                className="btn btn-sm btn-success fw-semibold"
                                onClick={() => setApprovingBudget(p)}
                              >
                                <i className="bi bi-check-lg me-1"></i>
                                Aprobar → OT
                              </button>
                              <button
                                className="btn btn-sm btn-outline-danger"
                                title="Registrar rechazo del presupuesto"
                                onClick={() => handleRechazar(p)}
                              >
                                <i className="bi bi-x-lg"></i>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal de Creación / Edición (HU-005 y HU-006) */}
      {showFormModal && (
        <BudgetFormModal
          editingBudget={editingBudget}
          clientes={clientes}
          vehiculos={vehiculos}
          aseguradoras={aseguradoras}
          onClose={() => setShowFormModal(false)}
          onSaved={(msg) => {
            setShowFormModal(false);
            setFeedback(msg);
            fetchAll();
          }}
        />
      )}

      {/* Modal de Aprobación y Generación Automática de OT (HU-007) */}
      {approvingBudget && (
        <BudgetApproveModal
          budget={approvingBudget}
          onClose={() => setApprovingBudget(null)}
          onApproved={(res) => {
            setApprovingBudget(null);
            setFeedback(res.detail);
            fetchAll();
          }}
        />
      )}

      {/* Modal de Vista Imprimible / PDF y consulta de las 8 fases generadas */}
      {printingBudget && (
        <BudgetPrintModal
          budget={printingBudget}
          onClose={() => setPrintingBudget(null)}
        />
      )}
    </div>
  );
}
