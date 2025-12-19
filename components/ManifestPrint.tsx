
import React from "react";
import { Printer } from "lucide-react";
import { Button } from "./ui/Button";
import { BusTrip, Booking, BusType, SeatStatus } from "../types";
import { formatLunarDate } from "../utils/dateUtils";
import { useToast } from "./ui/Toast";

interface ManifestPrintProps {
  selectedTrip: BusTrip | null;
  manifest: Booking[];
  disabled?: boolean;
}

export const ManifestPrint: React.FC<ManifestPrintProps> = ({
  selectedTrip,
  manifest,
  disabled = false,
}) => {
  const { toast } = useToast();

  const handlePrint = () => {
    if (!selectedTrip) return;

    const manifestWindow = window.open("", "_blank");
    if (!manifestWindow) {
      toast({
        type: "error",
        title: "Lỗi",
        message: "Vui lòng cho phép trình duyệt mở tab mới để xuất bảng kê.",
      });
      return;
    }

    const tripDate = new Date(selectedTrip.departureTime);
    const dateFormatted = `${tripDate.getDate()}/${tripDate.getMonth() + 1}/${tripDate.getFullYear()}`;
    const lunarFormatted = formatLunarDate(tripDate);

    // Chuẩn bị Map dữ liệu để tra cứu nhanh thông tin khách theo Seat ID
    const seatInfoMap = new Map<string, { phone: string; pickup: string; dropoff: string; price: number; isPaid: boolean }>();
    manifest.forEach((booking) => {
      const tripItem = booking.items.find((i) => i.tripId === selectedTrip.id);
      if (!tripItem) return;

      const totalPaid = (booking.payment?.paidCash || 0) + (booking.payment?.paidTransfer || 0);
      const isPaid = totalPaid >= booking.totalPrice;

      tripItem.seatIds.forEach((seatId) => {
        const ticket = tripItem.tickets?.find((t) => t.seatId === seatId);
        seatInfoMap.set(seatId, {
          phone: booking.passenger.phone,
          pickup: ticket?.pickup || booking.passenger.pickupPoint || "",
          dropoff: ticket?.dropoff || booking.passenger.dropoffPoint || "",
          price: ticket?.price || 0,
          isPaid: isPaid
        });
      });
    });

    const renderSeatHtml = (seatId: string, label: string) => {
      const info = seatInfoMap.get(seatId);
      if (!info) {
        return `<div class="seat empty"><div class="label">${label}</div><div class="status">Trống</div></div>`;
      }
      return `
        <div class="seat occupied ${info.isPaid ? 'paid' : 'booked'}">
          <div class="seat-header">
            <span class="label">${label}</span>
            <span class="price">${info.price > 0 ? info.price.toLocaleString('vi-VN') : ''}</span>
          </div>
          <div class="seat-body">
            <div class="phone">${info.phone}</div>
            <div class="loc">${info.pickup || '---'}</div>
            <div class="loc">${info.dropoff || '---'}</div>
          </div>
        </div>
      `;
    };

    // LOGIC VẼ SƠ ĐỒ THEO LOẠI XE
    let layoutHtml = "";
    const isCabin = selectedTrip.type === BusType.CABIN;

    if (isCabin) {
      // Sơ đồ Cabin: Dãy B | Sàn | Dãy A
      const rows = 11;
      layoutHtml = `<div class="cabin-grid">`;
      
      // Dãy B
      layoutHtml += `<div class="column"><div class="col-title">DÃY B (LẺ)</div>`;
      for (let r = 0; r < rows; r++) {
        layoutHtml += `<div class="row-pair">
          ${renderSeatHtml(`1-${r}-0`, `B${r*2+1}`)}
          ${renderSeatHtml(`2-${r}-0`, `B${r*2+2}`)}
        </div>`;
      }
      layoutHtml += `</div>`;

      // Sàn
      layoutHtml += `<div class="column floor-col"><div class="col-title">SÀN</div>`;
      for (let i = 0; i < 6; i++) {
        layoutHtml += renderSeatHtml(`1-floor-${i}`, `Sàn ${i+1}`);
      }
      layoutHtml += `</div>`;

      // Dãy A
      layoutHtml += `<div class="column"><div class="col-title">DÃY A (CHẴN)</div>`;
      for (let r = 0; r < rows; r++) {
        layoutHtml += `<div class="row-pair">
          ${renderSeatHtml(`1-${r}-1`, `A${r*2+1}`)}
          ${renderSeatHtml(`2-${r}-1`, `A${r*2+2}`)}
        </div>`;
      }
      layoutHtml += `</div></div>`;
    } else {
      // Sơ đồ Giường đơn 41: Tầng 1 | Tầng 2
      layoutHtml = `<div class="sleeper-container">`;
      [1, 2].forEach(floor => {
        layoutHtml += `<div class="deck">
          <div class="col-title">TẦNG ${floor}</div>
          <div class="deck-grid">`;
        
        // Render 6 hàng tiêu chuẩn (mỗi hàng 3 ghế)
        for (let r = 0; r < 6; r++) {
           for (let c = 0; c < 3; c++) {
              const seat = selectedTrip.seats.find(s => s.floor === floor && s.row === r && s.col === c && !s.isFloorSeat);
              if (seat) layoutHtml += renderSeatHtml(seat.id, seat.label);
              else layoutHtml += `<div class="seat spacer"></div>`;
           }
        }
        
        // Băng cuối (chỉ tầng 1)
        if (floor === 1) {
            layoutHtml += `<div class="rear-bench">`;
            for (let i = 0; i < 5; i++) {
                const seat = selectedTrip.seats.find(s => s.floor === 1 && s.row === 6 && s.col === i);
                if (seat) layoutHtml += renderSeatHtml(seat.id, seat.label);
            }
            layoutHtml += `</div>`;
        }
        
        layoutHtml += `</div></div>`;
      });
      layoutHtml += `</div>`;

      // Phần vé Sàn của xe giường
      const floorSeats = selectedTrip.seats.filter(s => s.isFloorSeat);
      if (floorSeats.length > 0) {
        layoutHtml += `<div class="floor-section">
          <div class="col-title">DÃY VÉ SÀN</div>
          <div class="floor-grid">
            ${floorSeats.map(s => renderSeatHtml(s.id, s.label)).join('')}
          </div>
        </div>`;
      }
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Sơ đồ khách - ${selectedTrip.licensePlate}</title>
        <meta charset="UTF-8">
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; color: #333; background: #fff; }
          .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #2563eb; padding-bottom: 10px; }
          .header h1 { margin: 0; color: #1e40af; text-transform: uppercase; font-size: 22px; }
          .trip-info { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 13px; font-weight: bold; background: #f1f5f9; padding: 10px; border-radius: 5px; }
          
          /* Sơ đồ chung */
          .col-title { font-size: 11px; font-weight: 900; text-align: center; background: #e2e8f0; padding: 4px; margin-bottom: 10px; border-radius: 4px; color: #475569; }
          .seat { border: 1px solid #cbd5e1; border-radius: 6px; padding: 4px; height: 65px; display: flex; flex-direction: column; font-size: 10px; background: #fff; page-break-inside: avoid; }
          .seat.empty { background: #f8fafc; border-style: dashed; color: #94a3b8; justify-content: center; align-items: center; }
          .seat.occupied.booked { border-color: #f59e0b; background: #fffbeb; }
          .seat.occupied.paid { border-color: #10b981; background: #ecfdf5; }
          
          .seat-header { display: flex; justify-content: space-between; border-bottom: 1px solid rgba(0,0,0,0.05); padding-bottom: 2px; margin-bottom: 2px; }
          .label { font-weight: 900; color: #1e293b; font-size: 11px; }
          .price { font-weight: bold; color: #b91c1c; font-size: 9px; }
          .phone { font-weight: bold; color: #000; margin-bottom: 2px; font-size: 11px; }
          .loc { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #475569; font-size: 9px; line-height: 1.2; }
          
          /* Layout Cabin */
          .cabin-grid { display: flex; gap: 15px; justify-content: center; }
          .column { width: 220px; display: flex; flex-direction: column; gap: 8px; }
          .floor-col { width: 100px; }
          .row-pair { display: flex; gap: 6px; }
          .row-pair .seat { flex: 1; }

          /* Layout Sleeper */
          .sleeper-container { display: flex; gap: 30px; justify-content: center; }
          .deck { width: 320px; }
          .deck-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
          .rear-bench { grid-column: span 3; display: flex; gap: 4px; margin-top: 10px; border-top: 1px dashed #ccc; padding-top: 10px; }
          .rear-bench .seat { flex: 1; }
          .floor-section { margin-top: 20px; border-top: 2px solid #eee; pt: 15px; }
          .floor-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; max-width: 800px; margin: 0 auto; }
          
          .footer { margin-top: 30px; text-align: right; font-size: 12px; font-style: italic; border-top: 1px solid #eee; padding-top: 10px; }

          @media print {
            button { display: none; }
            body { padding: 0; }
            .trip-info { border: 1px solid #ddd; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Sơ đồ hành khách</h1>
          <p style="margin: 5px 0 0 0; font-size: 12px; color: #64748b;">Hệ thống quản lý VinaBus Manager</p>
        </div>
        
        <div class="trip-info">
          <div>
            TUYẾN: ${selectedTrip.route}<br>
            CHUYẾN: ${selectedTrip.name}
          </div>
          <div style="text-align: right;">
            NGÀY: ${dateFormatted} (${lunarFormatted})<br>
            XE: ${selectedTrip.licensePlate} | TX: ${selectedTrip.driver || '---'}
          </div>
        </div>

        ${layoutHtml}

        <div class="footer">
          Thời gian xuất bản: ${new Date().toLocaleString('vi-VN')}
        </div>
        
        <div style="margin-top: 30px; text-align: center;">
          <button onclick="window.print()" style="padding: 12px 30px; background: #2563eb; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">Xác nhận in sơ đồ</button>
        </div>
      </body>
      </html>
    `;

    manifestWindow.document.write(htmlContent);
    manifestWindow.document.close();
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handlePrint}
      className="h-7 text-[10px] font-bold text-blue-600 hover:bg-blue-50 border border-blue-100"
      disabled={disabled || !selectedTrip}
    >
      <Printer size={12} className="mr-1" /> Xuất sơ đồ in
    </Button>
  );
};
