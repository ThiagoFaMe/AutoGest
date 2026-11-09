import axiosClient from "./axiosClient";

export const getOrdenesTrabajo = async (params = {}) => {
  const { data } = await axiosClient.get("/workorders/ordenes/", { params });
  return data;
};

export const getOrdenTrabajoById = async (id) => {
  const { data } = await axiosClient.get(`/workorders/ordenes/${id}/`);
  return data;
};

export const iniciarFaseReparacion = async (idOrden, payload) => {
  const { data } = await axiosClient.post(
    `/workorders/ordenes/${idOrden}/iniciar-fase/`,
    payload
  );
  return data;
};

export const completarFaseReparacion = async (idOrden, payload) => {
  const { data } = await axiosClient.post(
    `/workorders/ordenes/${idOrden}/completar-fase/`,
    payload
  );
  return data;
};

export const registrarEntregaVehiculo = async (idOrden, payload = {}) => {
  const { data } = await axiosClient.post(
    `/workorders/ordenes/${idOrden}/registrar-entrega/`,
    payload
  );
  return data;
};

export const editarFaseReparacion = async (idOrden, payload) => {
  const { data } = await axiosClient.post(
    `/workorders/ordenes/${idOrden}/editar-fase/`,
    payload
  );
  return data;
};

export const editarFechasOrden = async (idOrden, payload) => {
  const { data } = await axiosClient.post(
    `/workorders/ordenes/${idOrden}/editar-fechas/`,
    payload
  );
  return data;
};

export const consultarSeguimientoPublico = async (codigo) => {
  const { data } = await axiosClient.get(
    `/workorders/seguimiento/${encodeURIComponent(codigo.trim())}/`
  );
  return data;
};

export const getTurnosTaller = async (params = {}) => {
  const { data } = await axiosClient.get("/workorders/turnos/", { params });
  return data;
};

export const createTurnoTaller = async (payload) => {
  const { data } = await axiosClient.post("/workorders/turnos/", payload);
  return data;
};

export const updateTurnoTaller = async (id, payload) => {
  const { data } = await axiosClient.patch(`/workorders/turnos/${id}/`, payload);
  return data;
};

export const deleteTurnoTaller = async (id) => {
  const { data } = await axiosClient.delete(`/workorders/turnos/${id}/`);
  return data;
};

