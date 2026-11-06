import axiosClient from "./axiosClient";

export const getInsumos = async (params = {}) => {
  const { data } = await axiosClient.get("/inventory/insumos/", { params });
  return data;
};

export const createInsumo = async (payload) => {
  const { data } = await axiosClient.post("/inventory/insumos/", payload);
  return data;
};

export const updateInsumo = async (id, payload) => {
  const { data } = await axiosClient.patch(`/inventory/insumos/${id}/`, payload);
  return data;
};

export const getMovimientosStock = async (params = {}) => {
  const { data } = await axiosClient.get("/inventory/movimientos/", { params });
  return data;
};

export const registrarIngresoStock = async (payload) => {
  const { data } = await axiosClient.post(
    "/inventory/movimientos/registrar-ingreso/",
    payload
  );
  return data;
};

export const registrarConsumoOT = async (payload) => {
  const { data } = await axiosClient.post(
    "/inventory/movimientos/registrar-consumo/",
    payload
  );
  return data;
};
