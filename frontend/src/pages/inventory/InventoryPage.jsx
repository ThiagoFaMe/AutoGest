import React, { useEffect, useState } from "react";
import { getInsumos, getMovimientosStock } from "../../api/inventoryApi";
import { useAuth } from "../../context/AuthContext";
import InventoryItemModal from "./InventoryItemModal";
import StockConsumptionModal from "./StockConsumptionModal";
import StockEntryModal from "./StockEntryModal";

const formatCurrency = (val) => {
  if (val === null || val === undefined) return "—";
  return Number(val).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  });
};

const formatDateTime = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function InventoryPage() {
  const { user } = useAuth();
  const isAdminOrAdministrativo =
    user?.rol === "administrador" || user?.rol === "administrativo";

  const [insumos, setInsumos] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoriaFilter, setCategoriaFilter] = useState("");
  const [onlyAlert, setOnlyAlert] = useState(false);
  const [activeTab, setActiveTab] = useState("catalogo"); // "catalogo" | "historial"

  const [editingItem, setEditingItem] = useState(null);
  const [showItemModal, setShowItemModal] = useState(false);
  const [entryInsumo, setEntryInsumo] = useState(null);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [consumeInsumo, setConsumeInsumo] = useState(null);
  const [showConsumeModal, setShowConsumeModal] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [insData, movData] = await Promise.all([
        getInsumos(),
        getMovimientosStock(),
      ]);
      setInsumos(Array.isArray(insData) ? insData : insData.results || []);
      setMovimientos(Array.isArray(movData) ? movData : movData.results || []);
    } catch (err) {
      console.error("Error cargando inventario:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredInsumos = insumos.filter((item) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      item.codigo?.toLowerCase().includes(q) ||
      item.nombre?.toLowerCase().includes(q) ||
      item.categoria?.toLowerCase().includes(q);
    if (!matchesSearch) return false;
    if (categoriaFilter && item.categoria !== categoriaFilter) return false;
    if (onlyAlert && !item.en_alerta_stock) return false;
    return true;
  });

  const totalItems = insumos.length;
  const totalEnAlerta = insumos.filter((i) => i.en_alerta_stock).length;
  const valorTotalPañol = insumos.reduce(
    (acc, i) => acc + Number(i.stock_actual || 0) * Number(i.costo_unitario || 0),
    0
  );

  return (
    <div>
      {/* Encabezado */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
        <div>
          <h4 className="fw-bold mb-1">
            <i className="bi bi-boxes text-primary me-2"></i>
            Inventario de Pañol, Compras y Consumos por OT (HU-010, HU-011 y HU-012)
          </h4>
          <p className="text-muted small mb-0">
            Control de pinturas, barnices, masillas, abrasivos y autopartes con alertas automáticas de stock mínimo.
          </p>
        </div>

        <div className="d-flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-primary fw-semibold"
            onClick={() => {
              setConsumeInsumo(null);
              setShowConsumeModal(true);
            }}
          >
            <i className="bi bi-tools me-1"></i>
            Imputar Consumo a OT (HU-012)
          </button>

          {isAdminOrAdministrativo && (
            <>
              <button
                type="button"
                className="btn btn-success fw-semibold"
                onClick={() => {
                  setEntryInsumo(null);
                  setShowEntryModal(true);
                }}
              >
                <i className="bi bi-box-arrow-in-down me-1"></i>
                Ingreso por Remito (HU-011)
              </button>

              <button
                type="button"
                className="btn btn-dark fw-semibold"
                onClick={() => {
                  setEditingItem(null);
                  setShowItemModal(true);
                }}
              >
                <i className="bi bi-plus-lg me-1"></i>
                Nuevo Artículo (HU-010)
              </button>
            </>
          )}
        </div>
      </div>

      {/* Banner de retroalimentación (Ej: Alerta de stock mínimo disparada o desactivada) */}
      {feedback && (
        <div
          className={`alert alert-${feedback.type} d-flex justify-content-between align-items-center shadow-sm mb-4`}
        >
          <div className="d-flex align-items-center gap-2">
            <i
              className={`bi ${
                feedback.type === "warning"
                  ? "bi-exclamation-triangle-fill"
                  : "bi-check-circle-fill"
              } fs-5`}
            ></i>
            <span>{feedback.text}</span>
          </div>
          <button
            type="button"
            className="btn-close"
            onClick={() => setFeedback(null)}
          ></button>
        </div>
      )}

      {/* Indicadores Superiores (Prototipo 4) */}
      <div className="row g-3 mb-4">
        <div className="col-md-4">
          <div className="card border-0 shadow-sm border-start border-primary border-4">
            <div className="card-body py-3 d-flex justify-content-between align-items-center">
              <div>
                <div className="text-muted small fw-semibold">
                  ÍTEMS EN CATÁLOGO DE PAÑOL
                </div>
                <div className="fs-3 fw-bold text-dark">{totalItems}</div>
              </div>
              <i className="bi bi-box-seam fs-1 text-primary opacity-50"></i>
            </div>
          </div>
        </div>

        <div className="col-md-4">
          <div className="card border-0 shadow-sm border-start border-danger border-4">
            <div className="card-body py-3 d-flex justify-content-between align-items-center">
              <div>
                <div className="text-muted small fw-semibold">
                  ALERTAS DE REPOSICIÓN CRÍTICA (HU-010/012)
                </div>
                <div className="fs-3 fw-bold text-danger">{totalEnAlerta}</div>
              </div>
              <i className="bi bi-exclamation-triangle-fill fs-1 text-danger opacity-50"></i>
            </div>
          </div>
        </div>

        <div className="col-md-4">
          <div className="card border-0 shadow-sm border-start border-success border-4">
            <div className="card-body py-3 d-flex justify-content-between align-items-center">
              <div>
                <div className="text-muted small fw-semibold">
                  VALORIZACIÓN DE EXISTENCIAS
                </div>
                <div className="fs-4 fw-bold text-success">
                  {isAdminOrAdministrativo
                    ? formatCurrency(valorTotalPañol)
                    : "Reservado Administración"}
                </div>
              </div>
              <i className="bi bi-cash-stack fs-1 text-success opacity-50"></i>
            </div>
          </div>
        </div>
      </div>

      {/* Pestañas: Catálogo de Existencias vs Historial de Movimientos */}
      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link fw-semibold ${
              activeTab === "catalogo" ? "active" : ""
            }`}
            onClick={() => setActiveTab("catalogo")}
          >
            <i className="bi bi-grid-3x3-gap me-1"></i>
            Catálogo y Existencias ({insumos.length})
          </button>
        </li>
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link fw-semibold ${
              activeTab === "historial" ? "active" : ""
            }`}
            onClick={() => setActiveTab("historial")}
          >
            <i className="bi bi-clock-history me-1"></i>
            Kardex / Movimientos de Stock ({movimientos.length})
          </button>
        </li>
      </ul>

      {activeTab === "catalogo" ? (
        <>
          {/* Barra de Filtros */}
          <div className="card border-0 shadow-sm mb-3">
            <div className="card-body d-flex flex-column flex-md-row gap-3 justify-content-between align-items-md-center">
              <div className="d-flex gap-2 flex-grow-1" style={{ maxWidth: "560px" }}>
                <div className="input-group">
                  <span className="input-group-text bg-white">
                    <i className="bi bi-search text-muted"></i>
                  </span>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Buscar por código (INS-001), nombre o categoría..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <select
                  className="form-select"
                  style={{ maxWidth: "180px" }}
                  value={categoriaFilter}
                  onChange={(e) => setCategoriaFilter(e.target.value)}
                >
                  <option value="">Todas las categorías</option>
                  <option value="Pintura">Pintura</option>
                  <option value="Preparación">Preparación</option>
                  <option value="Abrasivos">Abrasivos</option>
                  <option value="Autopartes">Autopartes</option>
                </select>
              </div>

              <div className="form-check form-switch">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="switchSoloAlerta"
                  checked={onlyAlert}
                  onChange={(e) => setOnlyAlert(e.target.checked)}
                />
                <label
                  className="form-check-label fw-semibold text-danger small"
                  htmlFor="switchSoloAlerta"
                >
                  Mostrar solo Bajo Stock ({totalEnAlerta})
                </label>
              </div>
            </div>
          </div>

          {/* Tabla del Catálogo de Pañol (Prototipo 4) */}
          <div className="card border-0 shadow-sm">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Código</th>
                    <th>Descripción del Insumo / Repuesto</th>
                    <th>Categoría</th>
                    <th className="text-end">Stock Actual</th>
                    <th className="text-end">Stock Mínimo</th>
                    <th>Estado de Reposición (HU-010)</th>
                    {isAdminOrAdministrativo && (
                      <th className="text-end">Costo Unit.</th>
                    )}
                    <th className="text-end">Acciones Rápidas</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="8" className="text-center py-4 text-muted">
                        Cargando catálogo de pañol...
                      </td>
                    </tr>
                  ) : filteredInsumos.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="text-center py-4 text-muted">
                        No se encontraron insumos con ese filtro.
                      </td>
                    </tr>
                  ) : (
                    filteredInsumos.map((item) => (
                      <tr
                        key={item.id_insumo}
                        className={item.en_alerta_stock ? "table-danger" : ""}
                      >
                        <td className="fw-bold font-monospace">{item.codigo}</td>
                        <td className="fw-semibold">{item.nombre}</td>
                        <td>
                          <span className="badge bg-secondary-subtle text-dark border">
                            {item.categoria}
                          </span>
                        </td>
                        <td className="text-end fw-bold">
                          {item.stock_actual} {item.unidad_medida}
                        </td>
                        <td className="text-end text-muted">
                          {item.stock_minimo} {item.unidad_medida}
                        </td>
                        <td>
                          {item.en_alerta_stock ? (
                            <span className="badge bg-danger">
                              <i className="bi bi-exclamation-triangle-fill me-1"></i>
                              Bajo Stock / Reposición Crítica
                            </span>
                          ) : (
                            <span className="badge bg-success-subtle text-success border border-success-subtle">
                              Stock Normal
                            </span>
                          )}
                        </td>
                        {isAdminOrAdministrativo && (
                          <td className="text-end">
                            {formatCurrency(item.costo_unitario)}
                          </td>
                        )}
                        <td className="text-end">
                          <div className="btn-group btn-group-sm">
                            <button
                              type="button"
                              className="btn btn-outline-primary"
                              title="Imputar consumo de este material a una Orden de Trabajo"
                              onClick={() => {
                                setConsumeInsumo(item);
                                setShowConsumeModal(true);
                              }}
                            >
                              <i className="bi bi-tools me-1"></i>
                              Consumir
                            </button>

                            {isAdminOrAdministrativo && (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-outline-success"
                                  title="Registrar ingreso por compra / remito"
                                  onClick={() => {
                                    setEntryInsumo(item);
                                    setShowEntryModal(true);
                                  }}
                                >
                                  <i className="bi bi-plus-circle me-1"></i>
                                  Ingresar
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-outline-dark"
                                  title="Editar ficha y stock mínimo"
                                  onClick={() => {
                                    setEditingItem(item);
                                    setShowItemModal(true);
                                  }}
                                >
                                  <i className="bi bi-pencil"></i>
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
        </>
      ) : (
        /* Tabla Kardex de Movimientos de Stock (HU-011 y HU-012) */
        <div className="card border-0 shadow-sm">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Fecha y Hora</th>
                  <th>Tipo</th>
                  <th>Insumo / Repuesto</th>
                  <th className="text-end">Cantidad</th>
                  <th>Orden de Trabajo / Remito</th>
                  <th>Registrado por</th>
                  {isAdminOrAdministrativo && (
                    <th className="text-end">Subtotal Valorizado</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {movimientos.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-4 text-muted">
                      No hay movimientos de stock registrados.
                    </td>
                  </tr>
                ) : (
                  movimientos.map((m) => (
                    <tr key={m.id_mov_stock}>
                      <td className="small text-muted">
                        {formatDateTime(m.fecha_hora)}
                      </td>
                      <td>
                        {m.tipo_movimiento === "ingreso" ? (
                          <span className="badge bg-success">
                            <i className="bi bi-arrow-down-left-circle me-1"></i>
                            Ingreso Compra
                          </span>
                        ) : (
                          <span className="badge bg-primary">
                            <i className="bi bi-arrow-up-right-circle me-1"></i>
                            Consumo en OT
                          </span>
                        )}
                      </td>
                      <td>
                        <strong>{m.insumo_codigo}</strong> — {m.insumo_nombre}
                      </td>
                      <td
                        className={`text-end fw-bold ${
                          m.tipo_movimiento === "ingreso"
                            ? "text-success"
                            : "text-danger"
                        }`}
                      >
                        {m.tipo_movimiento === "ingreso" ? "+" : "-"}
                        {m.cantidad} {m.insumo_unidad}
                      </td>
                      <td>
                        {m.orden_codigo ? (
                          <span className="badge bg-dark me-2">
                            {m.orden_codigo} ({m.vehiculo_patente})
                          </span>
                        ) : null}
                        <span className="small text-muted">
                          {m.remito_comprobante}
                        </span>
                      </td>
                      <td className="small">{m.usuario_nombre}</td>
                      {isAdminOrAdministrativo && (
                        <td className="text-end fw-semibold">
                          {formatCurrency(m.subtotal_valorizado)}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modales */}
      {showItemModal && (
        <InventoryItemModal
          insumo={editingItem}
          onClose={() => setShowItemModal(false)}
          onSaved={() => {
            setShowItemModal(false);
            setFeedback({
              type: "success",
              text: "Catálogo de pañol actualizado correctamente.",
            });
            loadData();
          }}
        />
      )}

      {showEntryModal && (
        <StockEntryModal
          insumos={insumos}
          preselectedInsumo={entryInsumo}
          onClose={() => setShowEntryModal(false)}
          onSuccess={(resp) => {
            setShowEntryModal(false);
            setFeedback({
              type: "success",
              text: resp.detail,
            });
            loadData();
          }}
        />
      )}

      {showConsumeModal && (
        <StockConsumptionModal
          insumos={insumos}
          preselectedInsumo={consumeInsumo}
          onClose={() => setShowConsumeModal(false)}
          onSuccess={(resp) => {
            setShowConsumeModal(false);
            setFeedback({
              type: resp.alerta_stock_minimo ? "warning" : "success",
              text: resp.detail,
            });
            loadData();
          }}
        />
      )}
    </div>
  );
}
