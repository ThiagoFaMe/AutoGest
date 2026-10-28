import React, { createContext, useContext, useState } from "react";
import { loginRequest } from "../api/usersApi";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("autogest_user");
    return saved ? JSON.parse(saved) : null;
  });

  const login = async (email, password) => {
    const data = await loginRequest(email, password);
    localStorage.setItem("autogest_access_token", data.access);
    localStorage.setItem("autogest_refresh_token", data.refresh);
    localStorage.setItem("autogest_user", JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem("autogest_access_token");
    localStorage.removeItem("autogest_refresh_token");
    localStorage.removeItem("autogest_user");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
