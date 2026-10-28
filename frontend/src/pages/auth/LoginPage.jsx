import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/clientes");
    } catch (err) {
      const detail =
        err.response?.data?.detail ||
        "Error de conexión con el servidor. Verifique que el backend esté activo.";
      setErrorMsg(detail);
    } finally {
      setLoading(false);
    }
  };

  const fillDemoUser = (demoEmail, demoPass) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setErrorMsg("");
  };

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center bg-dark p-3">
      <div className="card shadow-lg border-0" style={{ maxWidth: "460px", width: "100%" }}>
        <div className="card-body p-4 p-md-5">
          <div className="text-center mb-4">
            <div
              className="bg-primary text-white rounded-circle d-inline-flex align-items-center justify-content-center mb-3"
              style={{ width: "56px", height: "56px" }}
            >
              <i className="bi bi-car-front-fill fs-3"></i>
            </div>
            <h3 className="fw-bold mb-1">AutoGest</h3>
            <p className="text-muted small mb-0">
              Gestión y Trazabilidad Operativa • Taller Sergio (Córdoba)
            </p>
          </div>

          {errorMsg && (
            <div className="alert alert-danger d-flex align-items-start gap-2 small" role="alert">
              <i className="bi bi-exclamation-triangle-fill fs-5"></i>
              <div>{errorMsg}</div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label fw-semibold small">Correo Electrónico</label>
              <div className="input-group">
                <span className="input-group-text bg-light">
                  <i className="bi bi-envelope"></i>
                </span>
                <input
                  type="email"
                  className="form-control"
                  placeholder="usuario@tallersergio.com.ar"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="form-label fw-semibold small">Contraseña</label>
              <div className="input-group">
                <span className="input-group-text bg-light">
                  <i className="bi bi-lock"></i>
                </span>
                <input
                  type="password"
                  className="form-control"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary w-100 py-2 fw-semibold"
              disabled={loading}
            >
              {loading ? "Verificando credenciales..." : "Iniciar Sesión"}
            </button>
          </form>

          {/* Accesos rápidos para pruebas y defensa de TFG */}
          <div className="mt-4 pt-3 border-top">
            <div className="small text-muted fw-semibold mb-2">
              <i className="bi bi-lightning-charge-fill text-warning me-1"></i>
              Perfiles precargados (Defensa TFG / Taller Sergio):
            </div>
            <div className="d-grid gap-2">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm text-start d-flex justify-content-between align-items-center"
                onClick={() => fillDemoUser("sergio@tallersergio.com.ar", "AdminSergio2026!")}
              >
                <span>
                  <strong>Sergio</strong> (Dueño / Administrador)
                </span>
                <span className="badge bg-primary">Admin</span>
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm text-start d-flex justify-content-between align-items-center"
                onClick={() =>
                  fillDemoUser("administracion@tallersergio.com.ar", "AdminLaura2026!")
                }
              >
                <span>
                  <strong>Laura Gómez</strong> (Oficina / Recepción)
                </span>
                <span className="badge bg-info text-dark">Administrativo</span>
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm text-start d-flex justify-content-between align-items-center"
                onClick={() => fillDemoUser("chapa@tallersergio.com.ar", "TallerChapa2026!")}
              >
                <span>
                  <strong>Carlos Domínguez</strong> (Sector Chapa)
                </span>
                <span className="badge bg-warning text-dark">Operario</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
