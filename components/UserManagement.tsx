import React, { useState, useEffect } from "react";
import { User } from "../types";
import { useAuth } from "./AuthContext";
import {
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  Loader2,
  Shield,
  ShieldAlert,
  User as UserIcon,
  Check,
} from "lucide-react";
import { useToast } from "./ui/Toast";
import { PERMISSIONS, ROLE_PERMISSIONS } from "../lib/permissions";
import { api } from "../lib/api";

export const UserManagement: React.FC = () => {
  const { token, refreshPermissions } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Role Management State
  const [roleConfigs, setRoleConfigs] = useState<any[]>([]);

  // Form State
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    name: "",
    role: "guest" as "admin" | "sale" | "guest",
    permissions: [] as string[],
  });

  const loadRoles = async () => {
    try {
      const roles = await api.roles.getAll();
      setRoleConfigs(
        roles.filter((r: any) => ["sale", "guest"].includes(r.name))
      );
    } catch (e) {
      console.error(e);
    }
  };

  const handleTogglePermission = async (
    roleName: string,
    permission: string,
    hasPermission: boolean
  ) => {
    const roleIndex = roleConfigs.findIndex((r) => r.name === roleName);
    if (roleIndex === -1) return;

    const updatedRoles = [...roleConfigs];
    const currentPermissions = updatedRoles[roleIndex].permissions || [];

    let newPermissions;
    if (hasPermission) {
      newPermissions = [...new Set([...currentPermissions, permission])];
    } else {
      newPermissions = currentPermissions.filter(
        (p: string) => p !== permission
      );
    }

    updatedRoles[roleIndex].permissions = newPermissions;
    setRoleConfigs(updatedRoles);

    try {
      await api.roles.update(roleName, newPermissions);
      await refreshPermissions();
      toast({
        type: "success",
        title: "Đã cập nhật",
        message: `Đã cập nhật quyền cho nhóm ${roleName}`,
      });
    } catch (e) {
      toast({
        type: "error",
        title: "Lỗi",
        message: "Không thể lưu phân quyền",
      });
      loadRoles();
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch(
        `${
          import.meta.env.VITE_API_URL || "http://localhost:5001/api"
        }/api/users`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
      setUsers(data);
    } catch (e) {
      toast({
        type: "error",
        title: "Lỗi",
        message: "Không thể tải danh sách người dùng",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    loadRoles();
  }, [token]);

  const handleSave = async () => {
    try {
      const url = isEditing
        ? `${
            import.meta.env.VITE_API_URL || "http://localhost:5001/api"
          }/api/users/${isEditing}`
        : `${
            import.meta.env.VITE_API_URL || "http://localhost:5001/api"
          }/api/users`;

      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Save failed");
      }

      toast({
        type: "success",
        title: isEditing ? "Đã cập nhật" : "Đã tạo mới",
      });
      setIsEditing(null);
      setIsCreating(false);
      resetForm();
      fetchUsers();
    } catch (e: any) {
      toast({ type: "error", title: "Lỗi", message: e.message });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bạn có chắc muốn xóa người dùng này?")) return;
    try {
      const res = await fetch(
        `${
          import.meta.env.VITE_API_URL || "http://localhost:5001/api"
        }/api/users/${id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!res.ok) throw new Error("Delete failed");
      toast({ type: "success", title: "Đã xóa" });
      fetchUsers();
    } catch (e) {
      toast({
        type: "error",
        title: "Lỗi",
        message: "Không thể xóa người dùng",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      username: "",
      password: "",
      name: "",
      role: "guest",
      permissions: [],
    });
  };

  const startEdit = (user: User) => {
    setFormData({
      username: user.username,
      password: "", // Empty for security, only send if changing
      name: user.name || "",
      role: user.role,
      permissions: user.permissions || [],
    });
    setIsEditing(user.id);
    setIsCreating(false);
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return (
          <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-bold border border-red-200 flex items-center gap-1">
            <ShieldAlert size={10} /> Admin
          </span>
        );
      case "sale":
        return (
          <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-bold border border-blue-200 flex items-center gap-1">
            <Shield size={10} /> Sale
          </span>
        );
      default:
        return (
          <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs font-bold border border-gray-200 flex items-center gap-1">
            <UserIcon size={10} /> Guest
          </span>
        );
    }
  };

  if (isLoading)
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="animate-spin text-blue-600" />
      </div>
    );

  return (
    <div className=" mx-auto animate-in fade-in duration-300">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800">
          Quản lý người dùng
        </h2>
        {!isCreating && !isEditing && (
          <button
            onClick={() => {
              setIsCreating(true);
              resetForm();
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 h-9 text-sm rounded-lg flex items-center gap-2 font-medium transition-colors shadow-sm"
          >
            <Plus size={18} /> Thêm người dùng
          </button>
        )}
      </div>

      {(isCreating || isEditing) && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6">
          <h3 className="text-lg font-bold mb-4 text-slate-800 border-b pb-2">
            {isEditing
              ? `Chỉnh sửa: ${formData.username}`
              : "Tạo người dùng mới"}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Tên đăng nhập
              </label>
              <input
                type="text"
                disabled={!!isEditing}
                value={formData.username}
                onChange={(e) =>
                  setFormData({ ...formData, username: e.target.value })
                }
                className="w-full p-2 border border-slate-200 rounded disabled:bg-slate-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {isEditing
                  ? "Mật khẩu mới (Để trống nếu không đổi)"
                  : "Mật khẩu"}
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                className="w-full p-2 border border-slate-200 rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Họ tên hiển thị
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full p-2 border border-slate-200 rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Phân quyền
              </label>
              <select
                value={formData.role}
                onChange={(e) =>
                  setFormData({ ...formData, role: e.target.value as any })
                }
                className="w-full p-2 border border-slate-200 rounded"
              >
                <option value="guest">Guest</option>
                <option value="sale">Sale</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {/* Permissions Section */}
            <div className="md:col-span-2 mt-2 border-t pt-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Quyền hạn bổ sung
              </label>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.values(PERMISSIONS).map((perm) => {
                  const isInherited =
                    ROLE_PERMISSIONS[formData.role]?.includes(perm);
                  const isChecked =
                    isInherited || formData.permissions.includes(perm);

                  return (
                    <label
                      key={perm}
                      className={`flex items-center gap-2 p-2 border rounded text-xs select-none cursor-pointer duration-200 ${
                        isInherited
                          ? "bg-slate-100 text-slate-500 border-slate-200"
                          : isChecked
                          ? "bg-indigo-50 border-indigo-200 text-indigo-700 font-semibold"
                          : "hover:bg-slate-50 border-slate-200 text-slate-600"
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center ${
                          isInherited
                            ? "bg-slate-200 border-slate-300"
                            : isChecked
                            ? "bg-indigo-600 border-indigo-600"
                            : "bg-white border-slate-300"
                        }`}
                      >
                        {isChecked && (
                          <Check
                            size={10}
                            className={
                              isInherited ? "text-slate-500" : "text-white"
                            }
                          />
                        )}
                      </div>
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={isChecked}
                        disabled={isInherited}
                        onChange={(e) => {
                          if (isInherited) return;
                          if (e.target.checked) {
                            setFormData({
                              ...formData,
                              permissions: [...formData.permissions, perm],
                            });
                          } else {
                            setFormData({
                              ...formData,
                              permissions: formData.permissions.filter(
                                (p) => p !== perm
                              ),
                            });
                          }
                        }}
                      />
                      <span>{perm}</span>
                      {isInherited && (
                        <span className="ml-auto text-[10px] bg-slate-200 px-1 rounded text-slate-600">
                          Role
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setIsEditing(null);
                setIsCreating(false);
              }}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg flex items-center gap-2"
            >
              <X size={18} /> Hủy
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 font-medium"
            >
              <Save size={18} /> Lưu
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase font-semibold">
            <tr>
              <th className="p-4">Username</th>
              <th className="p-4">Tên hiển thị</th>
              <th className="p-4">Vai trò</th>
              <th className="p-4 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                <td className="p-4 text-sm text-slate-700">{u.username}</td>
                <td className="p-4 font-medium text-slate-800">{u.name}</td>
                <td className="p-4">{getRoleBadge(u.role)}</td>
                <td className="p-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => startEdit(u)}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                      title="Sửa"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(u.id)}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                      title="Xóa"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && (
          <div className="p-8 text-center text-slate-500">
            Chưa có người dùng nào
          </div>
        )}
      </div>

      {/* Role Permission Management */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mt-6">
        <div className="mb-6 pb-6 border-b border-slate-100 flex items-center gap-2">
          <Shield className="text-indigo-600" />
          <div>
            <h3 className="text-lg font-semibold text-slate-800">
              Quản lý Phân quyền theo Role
            </h3>
            <p className="text-sm text-slate-500">
              Cấu hình quyền mặc định cho các nhóm người dùng
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {roleConfigs.map((role) => (
            <div key={role.name} className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-slate-700 capitalize text-lg">
                  Nhóm{" "}
                  {role.name === "sale" ? "Nhân viên (Sale)" : "Khách (Guest)"}
                </h4>
                <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-500">
                  {role.permissions?.length || 0} quyền
                </span>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 space-y-2 max-h-96 overflow-y-auto">
                {Object.values(PERMISSIONS).map((perm) => {
                  const isChecked = role.permissions?.includes(perm);
                  return (
                    <label
                      key={`${role.name}-${perm}`}
                      className="flex items-center gap-3 p-2 hover:bg-white rounded cursor-pointer transition-colors"
                    >
                      <div
                        className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                          isChecked
                            ? "bg-indigo-600 border-indigo-600"
                            : "bg-white border-slate-300"
                        }`}
                      >
                        {isChecked && (
                          <Shield size={12} className="text-white" />
                        )}
                      </div>
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={isChecked}
                        onChange={(e) =>
                          handleTogglePermission(
                            role.name,
                            perm,
                            e.target.checked
                          )
                        }
                      />
                      <span
                        className={`text-sm ${
                          isChecked
                            ? "text-indigo-900 font-medium"
                            : "text-slate-600"
                        }`}
                      >
                        {perm}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
