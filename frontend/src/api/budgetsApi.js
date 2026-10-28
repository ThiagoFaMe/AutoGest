import axiosClient from "./axiosClient";

export const getPresupuestos = async (params = {}) => {
  const { data } = await axiosClient.get("/budgets/presupuestos/", { params });
  return data;
};

export const createPresupuesto = async (payload) => {
  const { data } = await axiosClient.post("/budgets/presupuestos/", payload);
  return data;
};

export const updatePresupuesto = async (id, payload) => {
  const { data } = await axiosClient.patch(`/budgets/presupuestos/${id}/`, payload);
  return data;
};

export const emitirPresupuesto = async (id) => {
  const { data } = await axiosClient.post(`/budgets/presupuestos/${id}/emitir/`);
  return data;
};

export const aprobarPresupuesto = async (id, payload) => {
  const { data } = await axiosClient.post(`/budgets/presupuestos/${id}/aprobar/`, payload);
  return data;
};

export const rechazarPresupuesto = async (id, payload = {}) => {
  const { data } = await axiosClient.post(`/budgets/presupuestos/${id}/rechazar/`, payload);
  return data;
};

export const getOrdenesTrabajo = async (params = {}) => {
  const { data } = await axiosClient.get("/workorders/ordenes/", { params });
  return data;
};

export const getOrdenTrabajoById = async (id) => {
  const { data } = await axiosClient.get(`/workorders/ordenes/${id}/`);
  return data;
};
