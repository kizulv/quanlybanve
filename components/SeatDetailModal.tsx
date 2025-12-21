
import React, { useState, useEffect, useMemo } from "react";
import { Dialog } from "./ui/Dialog";
import { Button } from "./ui/Button";
import { Booking, Seat, Passenger } from "../types";
import {
  Save,
  MapPin,
  Locate,
  Notebook,
  Phone,
  History,
  X,
  Clock,
  ArrowRight,
  AlertCircle,
  Lock
} from "lucide-react";
import { formatLunarDate } from "../utils/dateUtils";
import { formatPhoneNumber, getStandardizedLocation } from "../utils/formatters";

interface SeatDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  seat: Seat | null;
  bookings: Booking[]; 
  onSave: (passenger: Passenger) => Promise<void>;
}

export const SeatDetailModal: React.FC<SeatDetailModalProps> = ({
  isOpen,
  onClose,
  booking,
  seat,
  bookings,
  onSave,
}) => {
  const [form, setForm] = useState({
    phone: "",
    pickup: "",
    dropoff: "",
    note: "",
  });
  
  const [showHistory, setShowHistory] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
        if (booking && seat) {
          let initialNote = "";
          let initialPickup = booking.passenger.pickupPoint || "";
          let initialDropoff = booking.passenger.dropoffPoint || "";
          
          const bookingItem = booking.items.find(i => i.seatIds.includes(seat.id));
          if (bookingItem && bookingItem.tickets) {
              const ticket = bookingItem.tickets.find(t => t.seatId === seat.id);
              if (ticket) {
                  initialNote = ticket.note !== undefined && ticket.note !== null ? ticket.note : (booking.passenger.note || "");
                  initialPickup = ticket.pickup || initialPickup;
                  initialDropoff = ticket.dropoff || initialDropoff;
              }
          } else {
              initialNote = booking.passenger.note || "";
          }

          setForm({
            phone: formatPhoneNumber(booking.passenger.phone),
            pickup: initialPickup,
            dropoff: initialDropoff,
            note: initialNote,
          });
        } else if (seat) {
            setForm({
                phone: "",
                pickup: "",
                dropoff: "",
                note: seat.note || ""
            });
        }
      setShowHistory(false);
    }
  }, [isOpen, booking, seat]);

  const historyMatches = useMemo(() => {
    if (!form.phone) return [];
    const cleanInput = form.phone.replace(/\D/g, "");
    if (cleanInput.length < 3) return [];
    return bookings.filter((b) =>
      b.passenger.phone.replace(/\D/g, "").includes(cleanInput)
    );
  }, [bookings, form.phone]);

  const passengerHistory = useMemo(() => {
    const uniqueRoutes = new Map<
      string,
      { pickup: string; dropoff: string; phone: string; lastDate: string }
    >();

    historyMatches.forEach((b) => {
      const pickup = b.passenger.pickupPoint || "";
      const dropoff = b.passenger.dropoffPoint || "";
      if (!pickup && !dropoff) return;

      const key = `${pickup.toLowerCase().trim()}|${dropoff.toLowerCase().trim()}`;
      const existing = uniqueRoutes.get(key);
      const isNewer = existing
        ? new Date(b.createdAt) > new Date(existing.lastDate)
        : true;

      if (!existing || isNewer) {
        uniqueRoutes.set(key, {
          pickup: b.passenger.pickupPoint || "",
          dropoff: b.passenger.dropoffPoint || "",
          phone: formatPhoneNumber(b.passenger.phone),
          lastDate: b.createdAt,
        });
      }
    });

    return Array.from(uniqueRoutes.values())
      .sort(
        (a, b) =>
          new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime()
      )
      .slice(0, 5);
  }, [historyMatches]);

  const applyHistory = (item: (typeof passengerHistory)[0]) => {
    setForm((prev) => ({
      ...prev,
      phone: item.phone,
      pickup: item.pickup,
      dropoff: item.dropoff,
    }));
    setShowHistory(false);
  };

  const handleSave = async () => {
      setIsSaving(true);
      try {
          const passengerData: Passenger = {
              phone: form.phone,
              pickupPoint: form.pickup,
              dropoffPoint: form.dropoff,
              note: form.note,
              name: booking?.passenger.name 
          };
          await onSave(passengerData);
      } finally {
          setIsSaving(false);
      }
  };

  if (!seat) return null;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={booking ? "Cập nhật thông tin khách hàng" : "Cập nhật ghi chú giữ vé"}
      className="max-w-md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Hủy bỏ
          </Button>
          <Button
            onClick={handleSave}
            className="bg-blue-600 hover:bg-blue-700 text-white"
            disabled={isSaving}
          >
            <Save size={16} className="mr-2" /> {isSaving ? 'Đang lưu...' : 'Lưu thông tin'}
          </Button>
        </>
      }
    >
      <div className="space-y-4 py-2">
        <div className="flex items-center gap-2 bg-blue-50 p-3 rounded-lg border border-blue-100 text-sm text-blue-800">
          <span className="font-bold">Ghế: {seat.label}</span>
          <span>•</span>
          {booking ? (
              <span className="text-blue-900 font-semibold">
                {booking.passenger.name || "Khách lẻ"}
              </span>
          ) : (
              <span className="text-purple-700 font-bold flex items-center gap-1">
                  <Lock size={12}/> Đang giữ
              </span>
          )}
        </div>

        {booking ? (
        <div className="space-y-3">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-blue-600">
              <Phone size={16} />
            </div>
            <input
              placeholder="Số điện thoại"
              value={form.phone}
              onChange={(e) => {
                const formatted = formatPhoneNumber(e.target.value);
                setForm({ ...form, phone: formatted });
              }}
              onFocus={() => {
                if (form.phone.length >= 3) setShowHistory(true);
              }}
              onBlur={() => setTimeout(() => setShowHistory(false), 200)}
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none text-sm"
            />

            {showHistory && passengerHistory.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden z-[50] animate-in fade-in zoom-in-95 duration-200">
                <div className="bg-slate-50 px-3 py-1.5 border-b border-slate-100 flex justify-between items-center">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase">
                    <History size={10} />
                    Lịch sử
                  </div>
                  <button
                    title="Đóng"
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setShowHistory(false);
                    }}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X size={12} />
                  </button>
                </div>
                <div className="max-h-[200px] overflow-y-auto">
                  {passengerHistory.map((item, idx) => (
                    <div
                      key={idx}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        applyHistory(item);
                      }}
                      className="px-3 py-2 hover:bg-indigo-50 cursor-pointer border-b border-slate-50 last:border-0 group"
                    >
                      <div className="flex justify-between items-start mb-0.5">
                        <span className="text-xs font-bold text-indigo-700">
                          {item.phone}
                        </span>
                        <span className="text-[9px] text-slate-400 flex items-center gap-1">
                          <Clock size={9} />
                          {new Date(item.lastDate).toLocaleDateString("vi-VN")}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
                        <span className="truncate max-w-[45%] font-medium">
                          {item.pickup}
                        </span>
                        <ArrowRight size={10} className="text-slate-300" />
                        <span className="truncate max-w-[45%] font-medium">
                          {item.dropoff}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-green-600">
              <MapPin size={16} />
            </div>
            <input
              placeholder="Điểm đón"
              value={form.pickup}
              onChange={(e) => {
                const val = e.target.value.replace(/(?:^|\s)\S/g, (a) =>
                  a.toUpperCase()
                );
                setForm({ ...form, pickup: val });
              }}
              onBlur={() => {
                const std = getStandardizedLocation(form.pickup);
                if (std !== form.pickup) {
                  setForm({ ...form, pickup: std });
                }
              }}
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none text-sm"
            />
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-red-600">
              <Locate size={16} />
            </div>
            <input
              placeholder="Điểm trả"
              value={form.dropoff}
              onChange={(e) => {
                const val = e.target.value.replace(/(?:^|\s)\S/g, (a) =>
                  a.toUpperCase()
                );
                setForm({ ...form, dropoff: val });
              }}
              onBlur={() => {
                const std = getStandardizedLocation(form.dropoff);
                if (std !== form.dropoff) {
                  setForm({ ...form, dropoff: std });
                }
              }}
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none text-sm"
            />
          </div>
        </div>
        ) : (
            <div className="bg-orange-50 p-3 rounded-lg border border-orange-100 text-xs text-orange-700">
                Bạn đang chỉnh sửa ghi chú cho ghế giữ.
            </div>
        )}
        
        <div className="relative">
            <div className="absolute top-2.5 left-3 flex items-start pointer-events-none text-amber-600">
              <Notebook size={16} />
            </div>
            <textarea
              placeholder="Ghi chú"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none text-sm resize-none h-20"
            />
        </div>
      </div>
    </Dialog>
  );
};
