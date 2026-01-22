import React from "react";
import { Dialog } from "../ui/Dialog";
import { Button } from "../ui/Button";
import { Ban, Flower2, Zap } from "lucide-react";
import { formatLunarDate, getDaysInMonth } from "../../utils/dateUtils";

export interface ScheduleSettingsData {
  shutdownStartDate: string;
  shutdownEndDate: string;
  peakDays: string[]; // List of date strings "YYYY-MM-DD"
}

interface ScheduleSettingProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ScheduleSettingsData;
  onSettingsChange: (newSettings: ScheduleSettingsData) => void;
  onSave: () => Promise<void>;
  currentMonthDate: Date;
}

export const ScheduleSetting: React.FC<ScheduleSettingProps> = ({
  isOpen,
  onClose,
  settings,
  onSettingsChange,
  onSave,
  currentMonthDate,
}) => {
  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();
  const days = getDaysInMonth(year, month);
  const daysOfWeek = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

  const isShutdownDay = (date: Date) => {
    if (!settings.shutdownStartDate || !settings.shutdownEndDate) return false;

    const check = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    ).getTime();
    const start = new Date(settings.shutdownStartDate).setHours(0, 0, 0, 0);
    const end = new Date(settings.shutdownEndDate).setHours(0, 0, 0, 0);

    return check >= start && check <= end;
  };

  const isPeakDay = (date: Date) => {
    const dateStr = `${date.getFullYear()}-${String(
      date.getMonth() + 1,
    ).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return settings.peakDays.includes(dateStr);
  };

  const togglePeakDay = (date: Date) => {
    const dateStr = `${date.getFullYear()}-${String(
      date.getMonth() + 1,
    ).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const newPeakDays = settings.peakDays.includes(dateStr)
      ? settings.peakDays.filter((d) => d !== dateStr)
      : [...settings.peakDays, dateStr];

    onSettingsChange({ ...settings, peakDays: newPeakDays });
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Cấu hình lịch trình"
      className="max-w-2xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Đóng
          </Button>
          <Button onClick={onSave}>Lưu cấu hình</Button>
        </>
      }
    >
      <div className="space-y-6 py-2">
        {/* Section 1: Shutdown Range */}
        <div className="space-y-3">
          <div className="bg-red-50 p-3 rounded-lg border border-red-100 flex gap-3 items-start">
            <div className="bg-red-100 p-2 rounded-full text-red-600">
              <Ban size={18} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-red-800">
                Lịch Ngưng Hoạt Động (Nghỉ Tết)
              </h4>
              <p className="text-xs text-red-600 mt-1">
                Chọn khoảng thời gian toàn bộ hệ thống ngưng hoạt động. Trong
                những ngày này,{" "}
                <strong>không thể thêm chuyến hoặc đặt vé</strong>.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 px-2">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                Từ ngày
              </label>
              <input
                title="Chọn ngày bắt đầu nghỉ Tết"
                type="date"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none text-sm"
                value={settings.shutdownStartDate}
                onChange={(e) =>
                  onSettingsChange({
                    ...settings,
                    shutdownStartDate: e.target.value,
                  })
                }
              />
              <div className="text-[11px] text-slate-500 mt-1.5 pl-1 italic flex items-center gap-1">
                <Flower2 size={10} className="text-red-400" />
                {settings.shutdownStartDate
                  ? `Âm lịch: ${formatLunarDate(
                      new Date(settings.shutdownStartDate),
                    )}`
                  : "--"}
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                Đến ngày
              </label>
              <input
                title="Chọn ngày kết thúc nghỉ Tết"
                type="date"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none text-sm"
                value={settings.shutdownEndDate}
                onChange={(e) =>
                  onSettingsChange({
                    ...settings,
                    shutdownEndDate: e.target.value,
                  })
                }
              />
              <div className="text-[11px] text-slate-500 mt-1.5 pl-1 italic flex items-center gap-1">
                <Flower2 size={10} className="text-red-400" />
                {settings.shutdownEndDate
                  ? `Âm lịch: ${formatLunarDate(
                      new Date(settings.shutdownEndDate),
                    )}`
                  : "--"}
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 my-4"></div>

        {/* Section 2: Peak Days Selection */}
        <div className="space-y-3">
          <div className="bg-orange-50 p-3 rounded-lg border border-orange-100 flex gap-3 items-start">
            <div className="bg-orange-100 p-2 rounded-full text-orange-600">
              <Zap size={18} className="fill-orange-600" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-orange-800">
                Cấu hình Ngày Cao Điểm
              </h4>
              <p className="text-xs text-orange-700 mt-1">
                Chọn các ngày cụ thể là ngày cao điểm. Các ngày này sẽ được đánh
                dấu màu cam trên lịch trình để dễ dàng nhận biết.
              </p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <span className="font-bold text-slate-700">
                Chọn ngày cao điểm (Tháng {month + 1}/{year})
              </span>
              <div className="text-xs text-slate-400 flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm bg-orange-500"></span> Đang
                chọn
                <span className="w-3 h-3 rounded-sm bg-slate-100 border border-slate-200 ml-2"></span>{" "}
                Bình thường
              </div>
            </div>

            {/* Simple Month Grid */}
            <div className="grid grid-cols-7 gap-2">
              {daysOfWeek.map((d) => (
                <div
                  key={d}
                  className="text-center text-xs font-bold text-slate-400 py-1"
                >
                  {d}
                </div>
              ))}

              {/* Empty slots for start of month */}
              {Array.from({ length: new Date(year, month, 1).getDay() }).map(
                (_, i) => (
                  <div key={`empty-${i}`} />
                ),
              )}

              {/* Days */}
              {days.map((d) => {
                const isPeak = isPeakDay(d);
                const isShutdown = isShutdownDay(d);
                return (
                  <button
                    key={d.toISOString()}
                    onClick={() => !isShutdown && togglePeakDay(d)}
                    disabled={isShutdown}
                    className={`
                                        h-12 rounded-lg flex flex-col items-center justify-center border text-sm transition-all relative
                                        ${
                                          isShutdown
                                            ? "bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed"
                                            : isPeak
                                              ? "bg-orange-500 text-white border-orange-600 shadow-sm font-bold"
                                              : "bg-white text-slate-700 border-slate-200 hover:border-orange-300 hover:bg-orange-50"
                                        }
                                    `}
                  >
                    <span className="leading-none">{d.getDate()}</span>
                    <span
                      className={`text-[9px] leading-none mt-1 ${
                        isPeak
                          ? "opacity-80 font-normal"
                          : "text-slate-400 font-medium"
                      }`}
                    >
                      {formatLunarDate(d).replace(" ÂL", "")}
                    </span>
                    {isPeak && (
                      <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-white rounded-full"></div>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-slate-400 mt-3 text-center italic">
              * Bạn đang cấu hình cho tháng {month + 1}/{year}. Đóng bảng này và
              chuyển tháng ở màn hình chính để cấu hình cho tháng khác.
            </p>
          </div>
        </div>
      </div>
    </Dialog>
  );
};
