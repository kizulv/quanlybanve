import React, { useState } from "react";
import { useAuth } from "./AuthContext";
import { useToast } from "./ui/Toast";
import { KeyRound, Save, Loader2 } from "lucide-react";

export const AccountSettings: React.FC = () => {
  const { user, token } = useAuth();
  const { toast } = useToast();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({
        type: "error",
        title: "Lỗi",
        message: "Mật khẩu mới không khớp",
      });
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(
        `${
          import.meta.env.VITE_API_URL || "http://localhost:5001/api"
        }/api/auth/change-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ oldPassword, newPassword }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");

      toast({
        type: "success",
        title: "Thành công",
        message: "Đổi mật khẩu thành công",
      });
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e: any) {
      toast({ type: "error", title: "Lỗi", message: e.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto animate-in fade-in duration-300">
      <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
        <KeyRound className="text-blue-600" /> Cài đặt tài khoản
      </h2>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="mb-6 pb-6 border-b border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800 mb-1">
            Thông tin cá nhân
          </h3>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase">
                Username
              </label>
              <div className="text-slate-700 font-medium">{user?.username}</div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase">
                Họ Tên
              </label>
              <div className="text-slate-700 font-medium">
                {user?.name || "Chưa cập nhật"}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase">
                Vai trò
              </label>
              <div className="text-slate-700 font-medium capitalized">
                {user?.role}
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleChangePassword}>
          <h3 className="text-lg font-semibold text-slate-800 mb-4">
            Đổi mật khẩu
          </h3>
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Mật khẩu hiện tại
              </label>
              <input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Mật khẩu mới
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Xác nhận mật khẩu mới
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-all shadow-sm shadow-blue-200"
          >
            {isLoading ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              <Save size={18} />
            )}
            Lưu thay đổi
          </button>
        </form>
      </div>
    </div>
  );
};
