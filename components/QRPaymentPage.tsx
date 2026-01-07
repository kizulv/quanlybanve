import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Loader2, QrCode, CheckCircle2 } from "lucide-react";
import { formatCurrency } from "../utils/formatters";
import { Button } from "./ui/Button";
import { useToast } from "./ui/Toast";

export const QRPaymentPage: React.FC = () => {
  const { toast } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes in seconds

  const fetchData = async () => {
    try {
      const res = await api.qrgeneral.get();
      const newData = res?.data || null;
      // Only update if data changed (deep comparison) prevents timer reset
      setData((prev: any) => {
        if (JSON.stringify(prev) !== JSON.stringify(newData)) {
          setTimeLeft(300); // Reset timer on new data
          return newData;
        }
        return prev;
      });
    } catch (error) {
      console.error("Failed to fetch QR data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000); // Poll every 3 seconds
    return () => clearInterval(interval);
  }, []);

  // Auto-delete after 5 minutes = 300s of displaying data
  // Countdown timer logic
  useEffect(() => {
    if (!data) return;

    const timer = setInterval(async () => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Time is up
          api.qrgeneral.delete().catch((e) => console.error(e));
          setData(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [data]);

  // Format seconds to mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const handleSimulateSuccess = async () => {
    if (!data) return;
    try {
      await api.qrgeneral.simulateSuccess();
      toast({
        type: "success",
        title: "Đã giả lập thành công",
        message: "Trạng thái thanh toán đã được cập nhật.",
      });
      fetchData(); // Immediate refresh
    } catch (error) {
      toast({
        type: "error",
        title: "Lỗi",
        message: "Không thể cập nhật trạng thái.",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-125">
        <Loader2 className="animate-spin text-slate-400 mb-2" size={32} />
        <p className="text-slate-500">Đang tải dữ liệu...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-125 text-slate-400">
        <QrCode size={48} className="opacity-20 mb-4" />
        <p className="font-bold">Chưa có dữ liệu tạo mã QR</p>
        <p className="text-xs">Vui lòng tạo mã từ màn hình thanh toán.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3 pb-4 border-b border-slate-200">
        <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
          <QrCode size={24} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Tạo mã QR thanh toán
          </h1>
          <p className="text-sm text-slate-500">
            Dữ liệu gần nhất được lưu từ hệ thống
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* RAW DATA VIEW */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wider">
            Thông tin đơn hàng
          </h3>
          <div className="space-y-4 text-sm">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                Khách hàng
              </label>
              <div className="font-medium">
                {data.passenger?.name} - {data.passenger?.phone}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                Tổng tiền cần thanh toán
              </label>
              <div className="text-xl font-black text-indigo-600">
                {formatCurrency(data.payment?.totalAmount || 0)} đ
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                Số tiền chuyển khoản
              </label>
              <div className="font-bold text-green-600">
                {formatCurrency(data.payment?.paidTransfer || 0)} đ
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                Ghi chú
              </label>
              <div className="p-2 bg-slate-50 rounded border border-slate-100 italic text-slate-600">
                {data.passenger?.note || "Không có ghi chú"}
              </div>
            </div>
          </div>
        </div>

        {/* JSON VIEW (DEBUG) */}
        <div className="flex flex-col gap-6">
          <div className="bg-slate-900 rounded-xl p-4 shadow-sm overflow-hidden flex-1">
            <h3 className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">
              Raw JSON Data
            </h3>
            <pre className="text-[10px] text-green-400 font-mono overflow-auto max-h-60">
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center space-y-3">
            <h3 className="font-bold text-slate-900 uppercase text-xs">
              Khu vực kiểm thử
            </h3>
            <Button
              onClick={handleSimulateSuccess}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold"
            >
              <CheckCircle2 size={16} className="mr-2" />
              Giả lập chuyển khoản thành công
            </Button>
            <p className="text-xs text-slate-500 italic">
              Hành động này sẽ cập nhật trạng thái thanh toán và tự động hoàn
              tất đơn hàng bên màn hình bán vé.
            </p>
          </div>
        </div>
      </div>

      {/* Countdown Display */}
      <div className="text-center pt-8 pb-4">
        <p className="text-slate-400 text-sm mb-1">Thời gian còn lại</p>
        <div className="text-3xl font-mono font-bold text-slate-700">
          {formatTime(timeLeft)}
        </div>
      </div>
    </div>
  );
};
