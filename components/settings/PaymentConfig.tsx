import React, { useState, useEffect } from "react";
import { Button } from "../ui/Button";
import { useToast } from "../ui/Toast";
import { api } from "../../lib/api";
import {
  Save,
  CreditCard,
  Building2,
  User,
  Image as ImageIcon,
  Key,
  CheckCircle2,
  WalletCards,
} from "lucide-react";

export const PaymentConfig: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [systemSettings, setSystemSettings] = useState({
    bankName: "",
    bankAccount: "",
    accountName: "",
    bankBin: "",
    qrTemplate: "compact",
    qrExpiryTime: 300,
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.systemSettings.get();
        if (res) setSystemSettings(res);
      } catch (e) {
        console.error("Failed to fetch settings", e);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    try {
      await api.systemSettings.update(systemSettings);
      toast({
        type: "success",
        title: "Đã lưu cài đặt",
        message: "Thông tin cấu hình đã được cập nhật.",
      });
    } catch (e) {
      toast({
        type: "error",
        title: "Lỗi",
        message: "Không thể lưu cài đặt.",
      });
    }
  };

  if (loading) return <div>Đang tải cấu hình...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
          <div className="p-2 bg-indigo-50 rounded text-indigo-600">
            <WalletCards size={24} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Cấu hình thanh toán
            </h2>
            <p className="text-sm text-slate-500">
              Thiết lập thông tin nhận tiền và thời gian mã QR
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
              Thông tin tài khoản ngân hàng
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Tên ngân hàng (Short Name)
                </label>
                <input
                  className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="VD: BIDV, VCB, MB..."
                  value={systemSettings.bankName}
                  onChange={(e) =>
                    setSystemSettings({
                      ...systemSettings,
                      bankName: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Bin ngân hàng
                </label>
                <input
                  className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Mã Bin (VietQR)"
                  type="text"
                  value={systemSettings.bankBin}
                  onChange={(e) =>
                    setSystemSettings({
                      ...systemSettings,
                      bankBin: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Số tài khoản
                </label>
                <input
                  className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Nhập số tài khoản"
                  type="text"
                  value={systemSettings.bankAccount}
                  onChange={(e) =>
                    setSystemSettings({
                      ...systemSettings,
                      bankAccount: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Tên chủ tài khoản
                </label>
                <input
                  className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Tên in hoa không dấu"
                  value={systemSettings.accountName}
                  onChange={(e) =>
                    setSystemSettings({
                      ...systemSettings,
                      accountName: e.target.value.toUpperCase(),
                    })
                  }
                />
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
              Thiết lập mã QR
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Thời gian hết hạn (giây)
                </label>
                <div className="flex items-center gap-2 relative">
                  <input
                    type="number"
                    className="absolute top-0 left-0 flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={systemSettings.qrExpiryTime}
                    onChange={(e) =>
                      setSystemSettings({
                        ...systemSettings,
                        qrExpiryTime: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                  <span className="absolute top-2.25 right-2 text-sm text-slate-500 whitespace-nowrap">
                    {Math.floor(systemSettings.qrExpiryTime / 60)} {"phút : "}{" "}
                    {systemSettings.qrExpiryTime % 60}s
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Mẫu QR (Template)
                </label>
                <select
                  className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={systemSettings.qrTemplate}
                  onChange={(e) =>
                    setSystemSettings({
                      ...systemSettings,
                      qrTemplate: e.target.value,
                    })
                  }
                >
                  <option value="compact">Compact (Mặc định)</option>
                  <option value="compact2">Compact 2 (Kèm thông tin)</option>
                  <option value="qr_only">QR Only (Chỉ mã QR)</option>
                  <option value="print">Print (In ấn)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="pt-6 flex justify-end">
            <Button
              className="bg-indigo-600 hover:bg-indigo-700 min-w-30"
              onClick={handleSave}
            >
              <CheckCircle2 size={16} className="mr-2" /> Lưu thay đổi
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
