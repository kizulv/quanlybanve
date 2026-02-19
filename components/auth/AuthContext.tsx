import React, { createContext, useContext, useState, useEffect } from "react";
import { User } from "../../types";
import { ROLE_PERMISSIONS as STATIC_ROLE_PERMISSIONS } from "../../lib/permissions";
import { api } from "../../lib/api";

type AuthContextType = {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
  hasPermission: (permission: string) => boolean;
  refreshPermissions: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  login: () => {},
  logout: () => {},
  isAuthenticated: false,
  hasPermission: () => false,
  refreshPermissions: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [rolePermissions, setRolePermissions] = useState<
    Record<string, string[]>
  >(STATIC_ROLE_PERMISSIONS);

  useEffect(() => {
    // Load auth from local storage
    const storedToken = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    // Load dynamic permissions
    refreshPermissions();
  }, []);

  const refreshPermissions = async () => {
    try {
      if (!localStorage.getItem("token")) return; // Don't fetch if not logged in
      const roles = await api.roles.getAll();
      if (Array.isArray(roles) && roles.length > 0) {
        const dynamicMap: Record<string, string[]> = {};
        roles.forEach((r: any) => {
          dynamicMap[r.name] = r.permissions;
        });
        // Ensure guest is present
        if (!dynamicMap["guest"]) {
          dynamicMap["guest"] = STATIC_ROLE_PERMISSIONS["guest"];
        }
        setRolePermissions(dynamicMap);
      }
    } catch (e) {
      console.error("Failed to load role permissions", e);
    }
  };

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem("token", newToken);
    localStorage.setItem("user", JSON.stringify(newUser));

    // Force reload to reset API headers? Or better, handle it in API interceptor
    // For now, let's rely on api lib reading from localStorage or we pass it
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  };

  const hasPermission = (permission: string) => {
    const permissionsMap = rolePermissions || STATIC_ROLE_PERMISSIONS;

    if (!user) {
      return permissionsMap["guest"]?.includes(permission) || false;
    }
    // Check user specific permissions OR role permissions
    // Admin has all permissions? Usually yes, but let's stick to configuration + logic
    if (user.role === "admin") return true;

    return (
      (user.permissions && user.permissions.includes(permission)) ||
      (permissionsMap[user.role] &&
        permissionsMap[user.role].includes(permission)) ||
      false
    );
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        isAuthenticated: !!user,
        hasPermission,
        refreshPermissions,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
