
import React from "react";
import { Printer } from "lucide-react";
import { Button } from "./ui/Button";
import { BusTrip, Booking, BusType, Seat, SeatStatus } from "../types";
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
        title: "Lỗi trình duyệt",
        message: "Vui lòng cho phép trình duyệt mở tab mới để in bảng kê.",
      });
      return;
    }

    const tripDate = new Date(selectedTrip.departureTime);
    const dateFormatted = `${tripDate.getDate()}/${tripDate.getMonth() + 1}/${tripDate.getFullYear()}`;
    const lunarFormatted = formatLunarDate(tripDate);

    // 1. Bản đồ dữ liệu ghế
    const seatDataMap = new Map<string, { 
      phone: string; 
      pickup: string; 
      dropoff: string; 
      price: number; 
      status: 'sold' | 'booked' | 'held';
    }>();

    manifest.forEach((booking) => {
      const tripItem = booking.items.find((i) => i.tripId === selectedTrip.id);
      if (!tripItem) return;

      const totalPaid = (booking.payment?.paidCash || 0) + (booking.payment?.paidTransfer || 0);
      const isPaid = totalPaid >= booking.totalPrice || booking.status === 'payment';
      const isHold = booking.status === 'hold';

      const status: 'sold' | 'booked' | 'held' = isPaid ? 'sold' : (isHold ? 'held' : 'booked');

      tripItem.seatIds.forEach((seatId) => {
        const ticket = tripItem.tickets?.find((t) => t.seatId === seatId);
        seatDataMap.set(seatId, {
          phone: booking.passenger.phone,
          pickup: ticket?.pickup || booking.passenger.pickupPoint || "",
          dropoff: ticket?.dropoff || booking.passenger.dropoffPoint || "",
          price: ticket?.price || 0,
          status: status
        });
      });
    });

    // Bổ sung các ghế giữ thủ công (Held)
    selectedTrip.seats.forEach(s => {
      if (s.status === SeatStatus.HELD && !seatDataMap.has(s.id)) {
        seatDataMap.set(s.id, { phone: "---", pickup: "---", dropoff: "---", price: 0, status: 'held' });
      }
    });

    const renderSeatHtml = (seat: Seat | undefined) => {
      if (!seat) return `<div class="seat empty-spacer"></div>`;
      const data = seatDataMap.get(seat.id);
      const label = seat.label;

      if (!data) {
        return `<div class="seat empty"><div class="seat-label">${label}</div><div class="empty-txt">TRỐNG</div></div>`;
      }

      let statusLabel = data.status === 'sold' ? "MUA VÉ" : (data.status === 'held' ? "GIỮ CHỖ" : "ĐẶT VÉ");

      return `
        <div class="seat occupied ${data.status}">
          <div class="seat-head">
            <span class="seat-label">${label}</span>
            <span class="status-tag">${statusLabel}</span>
          </div>
          <div class="seat-info">
            <div class="info-phone">${data.phone}</div>
            <div class="info-loc">${data.pickup || '---'}</div>
            <div class="info-loc">${data.dropoff || '---'}</div>
            <div class="info-price">${data.price > 0 ? data.price.toLocaleString('vi-VN') : ''}</div>
          </div>
        </div>
      `;
    };

    const isCabin = selectedTrip.type === BusType.CABIN;
    let layoutHtml = "";

    if (isCabin) {
      // --- LAYOUT CABIN 22 + 6 (Khổ Ngang A4) ---
      const regularSeats = selectedTrip.seats.filter(s => !s.isFloorSeat);
      const floorSeats = selectedTrip.seats.filter(s => s.isFloorSeat).sort((a,b) => (a.row||0) - (b.row||0));
      
      const colBSeats = regularSeats.filter(s => s.col === 0);
      const colASeats = regularSeats.filter(s => s.col === 1);
      const rows = Array.from(new Set(regularSeats.map(s => s.row ?? 0))).sort((a,b) => a-b);

      layoutHtml = `<div class="cabin-landscape">
        <div class="cabin-column">
          <div class="col-title">DÃY B (PHÒNG LẺ)</div>
          <div class="cabin-grid">
            <div class="floor-header"><span>Tầng 1</span><span>Tầng 2</span></div>
            ${rows.map(r => `
              <div class="cabin-row">
                ${renderSeatHtml(colBSeats.find(s => s.row === r && s.floor === 1))}
                ${renderSeatHtml(colBSeats.find(s => s.row === r && s.floor === 2))}
              </div>
            `).join('')}
          </div>
        </div>

        <div class="cabin-column floor-col">
          <div class="col-title">DÃY SÀN</div>
          <div class="floor-list">
            ${floorSeats.map(s => renderSeatHtml(s)).join('')}
          </div>
        </div>

        <div class="cabin-column">
          <div class="col-title">DÃY A (PHÒNG CHẴN)</div>
          <div class="cabin-grid">
            <div class="floor-header"><span>Tầng 1</span><span>Tầng 2</span></div>
            ${rows.map(r => `
              <div class="cabin-row">
                ${renderSeatHtml(colASeats.find(s => s.row === r && s.floor === 1))}
                ${renderSeatHtml(colASeats.find(s => s.row === r && s.floor === 2))}
              </div>
            `).join('')}
          </div>
        </div>
      </div>`;
    } else {
      // --- LAYOUT GIƯỜNG 41 (Khổ Đứng A4) ---
      layoutHtml = `<div class="sleeper-portrait">`;
      [1, 2].forEach(floor => {
        const floorSeats = selectedTrip.seats.filter(s => s.floor === floor && !s.isFloorSeat && (s.row ?? 0) < 6);
        const benchSeats = selectedTrip.seats.filter(s => s.floor === floor && s.row === 6);
        
        layoutHtml += `<div class="deck-block">
          <div class="col-title">TẦNG ${floor}</div>
          <div class="deck-grid">
            ${[0,1,2,3,4,5].map(r => 
              [0,1,2].map(c => renderSeatHtml(selectedTrip.seats.find(s => s.floor === floor && s.row === r && s.col === c && !s.isFloorSeat))).join('')
            ).join('')}
            ${benchSeats.length > 0 ? `<div class="bench-row">${benchSeats.sort((a,b) => (a.col||0)-(b.col||0)).map(s => renderSeatHtml(s)).join('')}</div>` : ''}
          </div>
        </div>`;
      });
      
      const totalFloorSeats = selectedTrip.seats.filter(s => s.isFloorSeat);
      if (totalFloorSeats.length > 0) {
        layoutHtml += `<div class="sleeper-floor-block">
          <div class="col-title">VÉ SÀN (GIỮA LỐI ĐI)</div>
          <div class="floor-grid-sleeper">
            ${totalFloorSeats.sort((a,b) => a.label.localeCompare(b.label, undefined, {numeric: true})).map(s => renderSeatHtml(s)).join('')}
          </div>
        </div>`;
      }
      layoutHtml += `</div>`;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Bảng kê - ${selectedTrip.licensePlate}</title>
        <meta charset="UTF-8">
        <style>
          @page { size: A4 ${isCabin ? 'landscape' : 'portrait'}; margin: 10mm; }
          body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; margin: 0; padding: 0; background: #fff; font-size: 11px; }
          .header { text-align: center; margin-bottom: 10px; border-bottom: 2px solid #000; padding-bottom: 5px; }
          .header h1 { margin: 0; font-size: 20px; text-transform: uppercase; }
          .trip-info { display: flex; justify-content: space-between; background: #f8fafc; padding: 10px; border-radius: 4px; margin-bottom: 15px; font-weight: bold; border: 1px solid #cbd5e1; }
          
          /* Seat Styles */
          .col-title { font-size: 10px; font-weight: 900; text-align: center; background: #334155; color: #fff; padding: 4px; margin-bottom: 6px; border-radius: 3px; text-transform: uppercase; }
          .seat { border: 1px solid #94a3b8; border-radius: 4px; padding: 4px; height: 58px; display: flex; flex-direction: column; background: #fff; position: relative; }
          .seat.empty { border-style: dashed; opacity: 0.5; justify-content: center; align-items: center; background: #f8fafc; }
          .seat.empty-spacer { border: none; visibility: hidden; }
          
          .seat.occupied.sold { border-color: #059669; border-width: 2px; background: #ecfdf5; }
          .seat.occupied.booked { border-color: #d97706; border-width: 2px; background: #fffbeb; }
          .seat.occupied.held { border-color: #7c3aed; border-width: 2px; background: #f5f3ff; }
          
          .seat-head { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(0,0,0,0.1); margin-bottom: 2px; padding-bottom: 1px; }
          .seat-label { font-weight: 900; font-size: 11px; color: #000; }
          .status-tag { font-size: 8px; font-weight: bold; color: #fff; padding: 0 3px; border-radius: 2px; }
          .sold .status-tag { background: #059669; }
          .booked .status-tag { background: #d97706; }
          .held .status-tag { background: #7c3aed; }
          
          .seat-info { flex: 1; display: flex; flex-direction: column; justify-content: space-between; }
          .info-phone { font-weight: bold; font-size: 10px; color: #000; }
          .info-loc { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 9px; color: #475569; line-height: 1.1; }
          .info-price { font-weight: 800; font-size: 9px; color: #b91c1c; text-align: right; }

          /* Layout Cabin (Ngang) */
          .cabin-landscape { display: flex; gap: 20px; justify-content: center; }
          .cabin-column { flex: 1; min-width: 250px; }
          .floor-col { flex: 0 0 140px; }
          .cabin-grid { display: flex; flex-direction: column; gap: 5px; }
          .cabin-row { display: flex; gap: 5px; }
          .cabin-row .seat { flex: 1; }
          .floor-header { display: flex; justify-content: space-around; font-weight: bold; font-size: 9px; color: #94a3b8; margin-bottom: 2px; }
          .floor-list { display: flex; flex-direction: column; gap: 5px; }

          /* Layout Giường (Đứng) */
          .sleeper-portrait { display: flex; flex-direction: column; gap: 20px; }
          .deck-block { border: 1px solid #e2e8f0; padding: 10px; border-radius: 8px; }
          .deck-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
          .bench-row { grid-column: span 3; display: flex; gap: 6px; margin-top: 10px; padding-top: 10px; border-top: 1px dashed #cbd5e1; }
          .bench-row .seat { flex: 1; }
          .floor-grid-sleeper { display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; }

          .footer { margin-top: 20px; border-top: 1px solid #000; padding-top: 5px; display: flex; justify-content: space-between; font-size: 10px; font-weight: bold; }
          .print-btn-container { text-align: center; margin-top: 20px; }
          .btn-print { padding: 10px 30px; background: #000; color: #fff; border: none; border-radius: 5px; cursor: pointer; font-weight: 900; }

          @media print {
            .print-btn-container { display: none; }
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>SƠ ĐỒ BẢNG KÊ HÀNH KHÁCH</h1>
          <p style="margin: 2px 0 0 0; font-size: 10px;">VinaBus Manager - Hệ thống quản lý chuyên nghiệp</p>
        </div>
        
        <div class="trip-info">
          <div>
            TUYẾN: ${selectedTrip.route}<br>
            CHUYẾN: ${selectedTrip.name}
          </div>
          <div style="text-align: right;">
            NGÀY CHẠY: ${dateFormatted} (${lunarFormatted})<br>
            BIỂN SỐ: ${selectedTrip.licensePlate} | TÀI XẾ: ${selectedTrip.driver || '---'}
          </div>
        </div>

        ${layoutHtml}

        <div class="footer">
          <span>Ngày in: ${new Date().toLocaleString('vi-VN')}</span>
          <div style="display: flex; gap: 15px;">
            <span style="color: #059669;">■ Đã thanh toán</span>
            <span style="color: #d97706;">■ Đặt chỗ (Nợ)</span>
            <span style="color: #7c3aed;">■ Giữ chỗ (Held)</span>
          </div>
        </div>
        
        <div class="print-btn-container">
          <button class="btn-print" onclick="window.print()">TIẾN HÀNH IN (CTRL + P)</button>
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
