import axiosClient from "./axiosClient";

// --- HU-002: Clientes ---
export const getClientes = async (params = {}) => {
  const { data } = await axiosClient.get("/core/clientes/", { params });
  return data;
};

export const createCliente = async (payload) => {
  const { data } = await axiosClient.post("/core/clientes/", payload);
  return data;
};

export const updateCliente = async (id, payload) => {
  const { data } = await axiosClient.patch(`/core/clientes/${id}/`, payload);
  return data;
};

// --- HU-003: Vehículos ---
export const getVehiculos = async (params = {}) => {
  const { data } = await axiosClient.get("/core/vehiculos/", { params });
  return data;
};

export const createVehiculo = async (payload) => {
  const { data } = await axiosClient.post("/core/vehiculos/", payload);
  return data;
};

export const updateVehiculo = async (id, payload) => {
  const { data } = await axiosClient.patch(`/core/vehiculos/${id}/`, payload);
  return data;
};

// --- HU-004: Compañías Aseguradoras ---
export const getAseguradoras = async (params = {}) => {
  const { data } = await axiosClient.get("/core/aseguradoras/", { params });
  return data;
};

export const createAseguradora = async (payload) => {
  const { data } = await axiosClient.post("/core/aseguradoras/", payload);
  return data;
};

export const updateAseguradora = async (id, payload) => {
  const { data } = await axiosClient.patch(`/core/aseguradoras/${id}/`, payload);
  return data;
};
