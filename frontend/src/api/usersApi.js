import axiosClient from "./axiosClient";

export const loginRequest = async (email, password) => {
  const { data } = await axiosClient.post("/users/login/", { email, password });
  return data;
};

export const getCurrentUser = async () => {
  const { data } = await axiosClient.get("/users/me/");
  return data;
};

export const getUsuarios = async (params = {}) => {
  const { data } = await axiosClient.get("/users/usuarios/", { params });
  return data;
};

export const createUsuario = async (payload) => {
  const { data } = await axiosClient.post("/users/usuarios/", payload);
  return data;
};

export const updateUsuario = async (id, payload) => {
  const { data } = await axiosClient.patch(`/users/usuarios/${id}/`, payload);
  return data;
};

export const unlockUsuario = async (id) => {
  const { data } = await axiosClient.post(`/users/usuarios/${id}/desbloquear/`);
  return data;
};
