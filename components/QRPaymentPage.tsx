import React, { useEffect, useState, useMemo } from "react";
import { api } from "../lib/api";
import {
  Loader2,
  QrCode,
  CheckCircle2,
  Bus,
  MapPin,
  CalendarIcon,
  ArrowRight,
  Clock,
  Phone,
  User,
  Banknote,
  NotepadText,
} from "lucide-react";
import {
  formatCurrency,
  formatDate,
  formatPhoneNumber,
} from "../utils/formatters";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { useToast } from "./ui/Toast";
import { BusTrip, BusType, Seat } from "../types";

// --- SEAT MAP PREVIEW COMPONENT (Copied from OrderInformation.tsx) ---
const SeatMapPreview: React.FC<{ trip: BusTrip; bookedSeatIds: string[] }> = ({
  trip,
  bookedSeatIds,
}) => {
  const isCabin = trip.type === BusType.CABIN;
  const seats = trip.seats || [];

  const renderSeat = (seat: Seat | undefined) => {
    if (!seat)
      return (
        <div
          className={`${
            isCabin ? "h-8 w-15" : "h-9 w-9 sm:w-11"
          } rounded-md border border-dashed border-slate-200 bg-slate-50/50`}
        />
      );

    const isBooked = bookedSeatIds.includes(seat.id);
    return (
      <div
        key={seat.id}
        className={`
          relative flex items-center justify-center border transition-all duration-200 rounded-md shadow-sm
          ${
            isCabin
              ? "h-[35.5px] w-15 text-[10px]"
              : "h-8 w-9 sm:w-11 text-[10px]"
          }
          ${
            isBooked
              ? "bg-slate-900 border-slate-900 text-white font-black ring-2 ring-slate-100"
              : "bg-slate-200 border-slate-300 text-slate-500 font-bold"
          }
        `}
        title={`${seat.label} ${isBooked ? "(Ghế của bạn)" : ""}`}
      >
        {seat.label}
      </div>
    );
  };

  if (isCabin) {
    const regularSeats = seats.filter(
      (s) => !s.isFloorSeat && (s.row ?? 0) < 90
    );
    const benchSeats = seats.filter(
      (s) => !s.isFloorSeat && (s.row ?? 0) >= 90
    );
    const rows = Array.from(new Set(regularSeats.map((s) => s.row ?? 0))).sort(
      (a: number, b: number) => a - b
    );

    return (
      <div className="flex flex-col items-center md:gap-4 bg-slate-50 py-4 rounded border border-slate-100 w-full overflow-hidden">
        <div className="md:hidden text-slate-400 font-semibold text-xs text-center uppercase">
          Sơ đồ vị trí
        </div>
        <div className="grid grid-cols-2 gap-4 w-full">
          <div className="flex flex-col items-center">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
              Dãy B
            </div>
            <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
              <div className="text-[10px] font-bold text-slate-300 text-center uppercase">
                T1
              </div>
              <div className="text-[10px] font-bold text-slate-300 text-center uppercase">
                T2
              </div>
              {rows.map((r) => (
                <React.Fragment key={`row-b-${r}`}>
                  {renderSeat(
                    regularSeats.find(
                      (s) => s.row === r && s.col === 0 && s.floor === 1
                    )
                  )}
                  {renderSeat(
                    regularSeats.find(
                      (s) => s.row === r && s.col === 0 && s.floor === 2
                    )
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
          <div className="flex flex-col items-center">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
              Dãy A
            </div>
            <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
              <div className="text-[10px] font-bold text-slate-300 text-center uppercase">
                T1
              </div>
              <div className="text-[10px] font-bold text-slate-300 text-center uppercase">
                T2
              </div>
              {rows.map((r) => (
                <React.Fragment key={`row-a-${r}`}>
                  {renderSeat(
                    regularSeats.find(
                      (s) => s.row === r && s.col === 1 && s.floor === 1
                    )
                  )}
                  {renderSeat(
                    regularSeats.find(
                      (s) => s.row === r && s.col === 1 && s.floor === 2
                    )
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
        {benchSeats.length > 0 && (
          <div className="pt-4 border-t border-slate-200 border-dashed w-full flex flex-col items-center gap-2">
            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
              Băng cuối
            </div>
            <div className="flex gap-2 justify-center">
              {benchSeats
                .sort((a, b) => (a.col ?? 0) - (b.col ?? 0))
                .map((s) => renderSeat(s))}
            </div>
          </div>
        )}
      </div>
    );
  }

  const standardSeats = seats.filter((s) => !s.isFloorSeat && (s.row ?? 0) < 6);
  const benchSeats = seats.filter((s) => !s.isFloorSeat && (s.row ?? 0) >= 6);
  const rows = [0, 1, 2, 3, 4, 5];

  return (
    <div className="flex flex-col gap-3 bg-slate-50 p-4 rounded border border-slate-100 w-full overflow-hidden">
      <div className="md:hidden text-slate-400 font-semibold text-xs text-center uppercase">
        Sơ đồ vị trí
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-6 w-full">
        {[1, 2].map((f) => (
          <div key={`floor-${f}`} className="flex flex-col items-center">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
              Tầng {f}
            </div>
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              {rows.map((r) => (
                <React.Fragment key={`row-${f}-${r}`}>
                  {[0, 1, 2].map((c) => {
                    const s = standardSeats.find(
                      (st) => st.row === r && st.col === c && st.floor === f
                    );
                    return s ? (
                      renderSeat(s)
                    ) : (
                      <div
                        key={`empty-${f}-${r}-${c}`}
                        className="h-9 w-9 sm:w-11"
                      />
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        ))}
      </div>
      {benchSeats.length > 0 && (
        <div className="w-full flex flex-col items-center">
          <div className="flex flex-col gap-4 w-full px-2 lg:px-0">
            {[1, 2].map((f) => {
              const floorBench = benchSeats
                .filter((s) => s.floor === f)
                .sort((a, b) => (a.col ?? 0) - (b.col ?? 0));
              if (floorBench.length === 0) return null;
              return (
                <div
                  key={`bench-row-${f}`}
                  className="flex justify-between items-center w-full"
                >
                  <div className="text-[10px] font-black text-slate-300 uppercase tracking-tighter">
                    Tầng {f}
                  </div>
                  <div className="flex  gap-1.5 sm:gap-2 justify-center">
                    {floorBench.map((s) => renderSeat(s))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
// -----------------------------------------------------------------------

export const QRPaymentPage: React.FC = () => {
  const { toast } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [systemSettings, setSystemSettings] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState(300); // Default 5 mins
  const [trips, setTrips] = useState<BusTrip[]>([]);

  // Fetch all trips and settings once
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [tripsRes, settingsRes] = await Promise.all([
          api.trips.getAll(),
          api.systemSettings.get(),
        ]);
        setTrips(tripsRes);
        setSystemSettings(settingsRes);
        if (settingsRes?.qrExpiryTime) {
          setTimeLeft(settingsRes.qrExpiryTime);
        }
      } catch (e) {
        console.error("Failed to fetch initial data", e);
      }
    };
    fetchInitialData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await api.qrgeneral.get();
      const newData = res?.data || null;
      // Only update if data changed (deep comparison) prevents timer reset
      setData((prev: any) => {
        if (JSON.stringify(prev) !== JSON.stringify(newData)) {
          setTimeLeft(systemSettings?.qrExpiryTime || 300); // Reset timer on new data
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
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
        <div className="relative mb-12">
          <div className="absolute inset-0 bg-slate-100 rounded-md animate-ping opacity-75"></div>
          <div className="relative bg-slate-50 text-slate-600 p-6 rounded-md">
            <QrCode size={48} />
          </div>
        </div>
        <h2 className="text-xl md:text-2xl font-black text-slate-800 uppercase tracking-tight text-center mb-2">
          Không có mã thanh toán nào
        </h2>
        <p className="text-slate-500 text-sm md:text-base text-center max-w-md">
          Hiện tại không có mã QR nào cần thanh toán. Giao dịch đã hoàn tất hoặc
          đã hết hạn.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-350 mx-auto flex flex-row gap-6">
        {/* LEFT COLUMN: QR & PAYMENT INFO (35-40%) */}
        <div className="w-90 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm sticky top-6">
            <div className="bg-indigo-950 px-6 h-9 flex items-center justify-between text-white">
              <h1 className="text-xs font-bold uppercase tracking-wide flex items-center gap-2">
                <QrCode size={20} /> Thanh toán
              </h1>
            </div>

            <div className="p-6 flex flex-col items-center justify-center border-b border-slate-100 bg-white space-y-4">
              <div className="w-76 h-auto min-h-76 bg-white rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center overflow-hidden p-2">
                {systemSettings?.bankAccount && data ? (
                  <img
                    src={`https://img.vietqr.io/image/${
                      systemSettings.bankBin ||
                      systemSettings.bankName ||
                      "BIDV"
                    }-${systemSettings.bankAccount}-${
                      systemSettings.qrTemplate || "qr_only"
                    }.png?amount=${(data.items || []).reduce(
                      (acc: number, item: any) =>
                        acc +
                        (item.seats || []).reduce(
                          (s: number, seat: any) => s + (seat.price || 0),
                          0
                        ),
                      0
                    )}&addInfo=${encodeURIComponent(
                      data.passenger?.note ||
                        `${data.passenger?.phone} THANH TOAN`
                    )}&accountName=${encodeURIComponent(
                      systemSettings.accountName || ""
                    )}`}
                    alt="Mã QR Thanh toán"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-400 space-y-2 py-10">
                    <QrCode size={80} className="opacity-10" />
                    <p className="text-xs font-bold uppercase tracking-widest text-center px-4">
                      Chưa cấu hình tài khoản ngân hàng
                    </p>
                  </div>
                )}
              </div>
              <div className="text-slate-400 text-sm font-bold">
                Hết hạn trong:{" "}
                <span className="text-rose-600">{formatTime(timeLeft)}</span>
              </div>
              <div className="w-full space-y-4">
                <div className="flex items-center flex-col bg-slate-50 border border-slate-200 rounded space-y-4 p-3">
                  <div className="flex justify-between items-center w-full">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-600">
                        Ngân hàng nhận
                      </span>
                    </div>
                    <div className="flex items-center text-xs">
                      <span className="font-bold uppercase">
                        {systemSettings?.bankName || "Unknown Bank"}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center w-full">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-600">
                        Chủ tài khoản
                      </span>
                    </div>
                    <div className="flex items-center text-xs ">
                      <span className="font-bold uppercase">
                        {systemSettings?.accountName || "Unknown Name"}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center w-full">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-600">
                        Số tài khoản nhận
                      </span>
                    </div>
                    <div className="flex items-center text-xs">
                      <span className="font-bold uppercase">
                        {systemSettings?.bankAccount || "Unknown Account"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="w-full space-y-4 border-t border-slate-200 pt-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 text-xs flex items-center gap-2 font-bold uppercase tracking-tight mt-1">
                    SĐT đặt vé
                  </span>
                  <span className="font-black text-slate-900 text-lg">
                    {formatPhoneNumber(data.passenger?.phone || "")}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm px-3 h-11 bg-rose-50 rounded border border-rose-100">
                  <div className="text-rose-800 flex items-center gap-1 font-bold uppercase text-xs mt-1">
                    <Banknote size={18} />
                    <span className="mt-px">Số tiền</span>
                  </div>
                  <span className="font-black text-rose-700 text-lg">
                    {formatCurrency(
                      (data.items || []).reduce(
                        (acc: number, item: any) =>
                          acc +
                          (item.seats || []).reduce(
                            (s: number, seat: any) => s + (seat.price || 0),
                            0
                          ),
                        0
                      )
                    )}{" "}
                    VNĐ
                  </span>
                </div>

                <div className="space-y-1 pt-2">
                  <span className="text-slate-500 text-xs font-bold uppercase flex items-center gap-2">
                    Nội dung
                  </span>
                  <div className="p-3 bg-slate-100 rounded text-sm font-mono text-slate-600 break-all border border-slate-200">
                    {data.passenger?.note ||
                      `${data.passenger?.phone} THANH TOAN`}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: TRIP INFO (60-65%) */}
        <div className="flex-1 animate-in slide-in-from-right-4 duration-500">
          {/* TRIP DETAILS BLOCK */}
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden flex flex-col shadow-sm">
            <h3 className="bg-slate-50 text-xs font-semibold text-slate-400 uppercase flex items-center gap-2 px-4 h-9 border-b border-slate-200">
              <Bus size={16} /> Chi tiết chuyến ({data.items?.length || 0}{" "}
              chuyến)
            </h3>
            <div className="overflow-hidden py-6">
              {(data.items || []).map((item: any, idx: number) => {
                const tripDate = new Date(item.tripDate);
                const fullTrip = trips.find((t) => t.id === item.tripId);

                // Map seats to match the structure OrderInformation expects
                const ticketList = item.seats || [];
                // Need to extract just string IDs for seat map highlighting
                const bookedSeatIds = ticketList.map((s: any) => s.id);

                return (
                  <div
                    key={idx}
                    className="flex flex-col lg:flex-row justify-between gap-6 border-b-2 border-slate-300 border-dashed last:border-0 pb-6 mb-6 last:mb-0 last:pb-0 px-6"
                  >
                    {/* Left Side: Info & Tickets */}
                    <div className="flex-1 lg:pr-0">
                      <div className="bg-slate-50 rounded border border-slate-100 space-y-1 lg:space-y-3 p-4">
                        <div className="flex items-center gap-2">
                          <Bus size={16} className="text-slate-400 rounded" />
                          <h4 className="text-sm font-black text-slate-900 uppercase">
                            {item.route}
                          </h4>
                        </div>
                        <div className="grid md:grid-cols-2 gap-2 lg:gap-6">
                          <div className="space-y-1">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                              Biển số xe (dự kiến)
                            </span>
                            <div className="text-xl font-black text-slate-800">
                              {item.licensePlate}
                            </div>
                          </div>
                          <div className="space-y-1">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                              Thời gian xuất bến (Dự kiến)
                            </span>
                            <div
                              className="font-bold text-slate-800 truncate text-lg"
                              title="Thời gian xuất bến dự kiến"
                            >
                              {formatDate(item.tripDate)}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="pt-4">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
                            Tổng số vé
                          </span>
                          <Badge className="bg-slate-900 text-white font-semibold border-transparent px-4 h-7 rounded-full uppercase ">
                            {ticketList.length} vé
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                          {ticketList.map((t: any) => {
                            return (
                              <div
                                key={t.id}
                                className="flex flex-col bg-white border-2 border-slate-300 rounded py-2 px-3 md:px-4 hover:border-indigo-500 transition-all duration-300 group/ticket"
                              >
                                <div className="flex justify-between items-center">
                                  <span className="text-xl font-black text-slate-900 group-hover/ticket:scale-110 transition-transform">
                                    {t.label || t.id}
                                  </span>
                                  <span className="text-sm text-slate-900 font-black">
                                    {formatCurrency(t.price)} đ
                                  </span>
                                </div>
                                <div className="mt-1 pt-2 border-t border-slate-50 flex flex-col md:flex-row md:gap-2 items-center justify-center">
                                  <div className="flex items-center gap-1 text-[10px] text-slate-500 font-medium truncate">
                                    <MapPin
                                      size={10}
                                      className="text-slate-500 shrink-0"
                                    />{" "}
                                    <span className="truncate">
                                      {item.pickup || "---"}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1 text-[10px] text-slate-500 font-medium truncate">
                                    <ArrowRight
                                      size={10}
                                      className="text-slate-500 shrink-0"
                                    />{" "}
                                    <span className="truncate">
                                      {item.dropoff || "---"}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className="px-4 py-3 bg-blue-50/70 rounded border-2 border-dashed border-slate-200 flex justify-between items-center mt-6">
                        <span className="text-sm font-black text-slate-600">
                          Tổng thanh toán
                        </span>
                        <span className="text-xl font-black text-slate-700">
                          {formatCurrency(
                            ticketList.reduce(
                              (sum: number, seat: any) =>
                                sum + (seat.price || 0),
                              0
                            )
                          )}{" "}
                          đ
                        </span>
                      </div>
                    </div>

                    {/* Right Side: Seat Map */}
                    <div className="w-85 flex flex-col items-center lg:items-start overflow-hidden md:pl-0">
                      {fullTrip ? (
                        <div className="w-full">
                          <div className="flex justify-center w-full overflow-hidden">
                            <SeatMapPreview
                              trip={fullTrip}
                              bookedSeatIds={bookedSeatIds}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="h-full w-full flex flex-col items-center justify-center text-slate-300 py-20 border-2 border-dashed border-slate-100 rounded">
                          <Bus
                            size={64}
                            className="opacity-10 mb-4 animate-pulse"
                          />
                          <p className="text-sm font-bold uppercase tracking-widest">
                            Đang tải sơ đồ ghế...
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
