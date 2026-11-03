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

export const registrarEntregaVehiculo = async (idOrden) => {
  const { data } = await axiosClient.post(
    `/workorders/ordenes/${idOrden}/registrar-entrega/`
  );
  return data;
};

export const consultarSeguimientoPublico = async (codigo) => {
  const { data } = await axiosClient.get(
    `/workorders/seguimiento/${encodeURIComponent(codigo.trim())}/`
  );
  return data;
};
