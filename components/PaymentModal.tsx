import React from "react";
import { Dialog } from "./ui/Dialog";
import { Button } from "./ui/Button";
import { CheckCircle2, DollarSign, CreditCard } from "lucide-react";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  totalPrice: number;
  paidCash: number;
  paidTransfer: number;
  onMoneyChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isProcessing?: boolean;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  totalPrice,
  paidCash,
  paidTransfer,
  onMoneyChange,
  isProcessing = false,
}) => {
  const remaining = totalPrice - paidCash - paidTransfer;
  const isPaidEnough = remaining <= 0;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Xác nhận thanh toán"
      className="max-w-md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            Quay lại
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isProcessing}
            className="bg-green-600 hover:bg-green-700 text-white min-w-[120px]"
          >
            {isProcessing ? (
              "Đang xử lý..."
            ) : (
              <>
                <CheckCircle2 size={16} className="mr-2" /> Hoàn tất
              </>
            )}
          </Button>
        </>
      }
    >
      <div className="space-y-6 py-2">
        {/* Total Summary */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
          <div className="text-sm text-slate-500 font-medium uppercase mb-1">
            Tổng tiền cần thanh toán
          </div>
          <div className="text-3xl font-bold text-primary">
            {totalPrice.toLocaleString("vi-VN")} <span className="text-sm">đ</span>
          </div>
        </div>

        {/* Inputs */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Tiền mặt
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-green-600">
                <DollarSign size={16} />
              </div>
              <input
                type="text"
                name="paidCash"
                value={paidCash.toLocaleString("vi-VN")}
                onChange={onMoneyChange}
                className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none bg-white text-slate-900 font-bold text-lg shadow-sm text-right"
                placeholder="0"
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Chuyển khoản
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-blue-600">
                <CreditCard size={16} />
              </div>
              <input
                type="text"
                name="paidTransfer"
                value={paidTransfer.toLocaleString("vi-VN")}
                onChange={onMoneyChange}
                className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white text-slate-900 font-bold text-lg shadow-sm text-right"
                placeholder="0"
              />
            </div>
          </div>
        </div>

        {/* Remaining / Status */}
        <div className="border-t border-slate-100 pt-4 flex justify-between items-center">
          <span className="text-sm font-medium text-slate-600">Còn lại:</span>
          <span
            className={`font-bold text-lg ${
              remaining > 0
                ? "text-red-600"
                : remaining < 0
                ? "text-blue-600"
                : "text-green-600"
            }`}
          >
            {remaining > 0
              ? remaining.toLocaleString("vi-VN")
              : Math.abs(remaining).toLocaleString("vi-VN")}{" "}
            <span className="text-xs font-normal text-slate-500">
              {remaining > 0 ? "đ (Thiếu)" : remaining < 0 ? "đ (Thừa)" : "đ (Đủ)"}
            </span>
          </span>
        </div>
      </div>
    </Dialog>
  );
};
