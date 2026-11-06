import axiosClient from "./axiosClient";

export const getDashboardKPIs = async () => {
  const { data } = await axiosClient.get("/finance/kpis/");
  return data;
};

export const getCuentasPorCobrar = async (params = {}) => {
  const { data } = await axiosClient.get("/finance/cuentas/", { params });
  return data;
};

export const emitirFacturaCuenta = async (payload) => {
  const { data } = await axiosClient.post(
    "/finance/cuentas/emitir-factura/",
    payload
  );
  return data;
};

export const getMovimientosFinancieros = async (params = {}) => {
  const { data } = await axiosClient.get("/finance/movimientos/", { params });
  return data;
};

export const registrarMovimientoFinanciero = async (payload) => {
  const { data } = await axiosClient.post(
    "/finance/movimientos/registrar/",
    payload
  );
  return data;
};
