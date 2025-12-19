
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

    // 1. Thu thập thông tin khách hàng từ manifest gắn vào seatId
    const seatDataMap = new Map<string, { 
      phone: string; 
      pickup: string; 
      dropoff: string; 
      price: number; 
      status: 'sold' | 'booked' | 'held';
      note?: string;
    }>();

    manifest.forEach((booking) => {
      const tripItem = booking.items.find((i) => i.tripId === selectedTrip.id);
      if (!tripItem) return;

      const totalPaid = (booking.payment?.paidCash || 0) + (booking.payment?.paidTransfer || 0);
      const isPaid = totalPaid >= booking.totalPrice || booking.status === 'payment';
      const isHold = booking.status === 'hold';

      let status: 'sold' | 'booked' | 'held' = isPaid ? 'sold' : (isHold ? 'held' : 'booked');

      tripItem.seatIds.forEach((seatId) => {
        const ticket = tripItem.tickets?.find((t) => t.seatId === seatId);
        seatDataMap.set(seatId, {
          phone: booking.passenger.phone,
          pickup: ticket?.pickup || booking.passenger.pickupPoint || "",
          dropoff: ticket?.dropoff || booking.passenger.dropoffPoint || "",
          price: ticket?.price || 0,
          status: status,
          note: booking.passenger.note
        });
      });
    });

    // 2. Kiểm tra các ghế 'held' thủ công (không qua booking manifest)
    selectedTrip.seats.forEach(s => {
      if (s.status === SeatStatus.HELD && !seatDataMap.has(s.id)) {
        seatDataMap.set(s.id, {
          phone: "---",
          pickup: "---",
          dropoff: "---",
          price: 0,
          status: 'held',
          note: s.note
        });
      }
    });

    // Hàm render HTML cho ô ghế
    const renderSeatHtml = (seat: Seat | undefined) => {
      if (!seat) return `<div class="seat empty-spacer"></div>`;
      
      const data = seatDataMap.get(seat.id);
      const label = seat.label;

      if (!data) {
        return `<div class="seat empty"><div class="seat-label">${label}</div><div class="empty-txt">TRỐNG</div></div>`;
      }

      let statusLabel = "ĐẶT VÉ";
      if (data.status === 'sold') statusLabel = "MUA VÉ";
      if (data.status === 'held') statusLabel = "GIỮ CHỖ";

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
            <div class="info-price">${data.price > 0 ? data.price.toLocaleString('vi-VN') + ' đ' : ''}</div>
          </div>
        </div>
      `;
    };

    // 3. Xây dựng Layout theo loại xe
    let layoutContent = "";
    const isCabin = selectedTrip.type === BusType.CABIN;

    if (isCabin) {
      // XE CABIN 22 PHÒNG + 6 SÀN
      layoutContent = `<div class="cabin-container">`;
      
      // Dãy B (11 phòng bên trái)
      layoutContent += `<div class="side-col"><h3>DÃY B (11 PHÒNG)</h3>`;
      for (let r = 0; r < 11; r++) {
          const s = selectedTrip.seats.find(seat => seat.col === 0 && seat.row === r && !seat.isFloorSeat);
          layoutContent += renderSeatHtml(s);
      }
      layoutContent += `</div>`;

      // Dãy Sàn (6 chỗ ở giữa)
      const floorSeats = selectedTrip.seats.filter(s => s.isFloorSeat).sort((a,b) => (a.row||0) - (b.row||0));
      layoutContent += `<div class="floor-col"><h3>SÀN (6 CHỖ)</h3>`;
      for (let i = 0; i < 6; i++) {
          layoutContent += renderSeatHtml(floorSeats[i]);
      }
      layoutContent += `</div>`;

      // Dãy A (11 phòng bên phải)
      layoutContent += `<div class="side-col"><h3>DÃY A (11 PHÒNG)</h3>`;
      for (let r = 0; r < 11; r++) {
          const s = selectedTrip.seats.find(seat => seat.col === 1 && seat.row === r && !seat.isFloorSeat);
          layoutContent += renderSeatHtml(s);
      }
      layoutContent += `</div>`;
      
      layoutContent += `</div>`;

    } else {
      // XE GIƯỜNG 41 CHỖ (Tầng 1 + Băng cuối & Tầng 2)
      layoutContent = `<div class="sleeper-container">`;
      
      [1, 2].forEach(floor => {
        layoutContent += `<div class="deck">
          <h3>TẦNG ${floor}</h3>
          <div class="deck-grid">`;
        
        // 6 hàng tiêu chuẩn (3 cột)
        for (let r = 0; r < 6; r++) {
          for (let c = 0; c < 3; c++) {
            const s = selectedTrip.seats.find(seat => seat.floor === floor && seat.row === r && seat.col === c && !seat.isFloorSeat);
            layoutContent += renderSeatHtml(s);
          }
        }

        // Băng cuối 5 chỗ (Chỉ hiển thị dưới Tầng 1 cho gọn hoặc Tầng nào có dữ liệu)
        const benchSeats = selectedTrip.seats.filter(s => s.floor === floor && s.row === 6);
        if (benchSeats.length > 0) {
            layoutContent += `<div class="rear-bench">`;
            benchSeats.sort((a,b) => (a.col||0) - (b.col||0)).forEach(s => {
                layoutContent += renderSeatHtml(s);
            });
            layoutContent += `</div>`;
        }
        
        layoutContent += `</div></div>`;
      });
      layoutContent += `</div>`;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Sơ đồ in - ${selectedTrip.licensePlate}</title>
        <meta charset="UTF-8">
        <style>
          @page { size: A4; margin: 8mm; }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1e293b; margin: 0; padding: 0; background: #fff; font-size: 12px; }
          .container { width: 100%; max-width: 195mm; margin: 0 auto; }
          
          /* Header */
          .header { text-align: center; margin-bottom: 10px; border-bottom: 2px solid #000; padding-bottom: 5px; }
          .header h1 { margin: 0; font-size: 20px; text-transform: uppercase; }
          .trip-summary { display: flex; justify-content: space-between; background: #f1f5f9; padding: 8px; border-radius: 4px; margin-bottom: 15px; font-weight: bold; border: 1px solid #cbd5e1; }
          
          /* Seat Styles */
          h3 { font-size: 10px; text-align: center; margin: 0 0 5px 0; background: #334155; color: #fff; padding: 3px; border-radius: 2px; }
          .seat { border: 1px solid #94a3b8; border-radius: 4px; padding: 3px; min-height: 52px; display: flex; flex-direction: column; background: #fff; margin-bottom: 4px; position: relative; }
          .seat.empty { border-style: dashed; opacity: 0.5; justify-content: center; align-items: center; background: #f8fafc; }
          .seat.empty-spacer { border: none; background: transparent; visibility: hidden; }
          
          /* Màu sắc trạng thái */
          .seat.occupied.sold { border-color: #059669; border-width: 2px; background: #ecfdf5; }
          .seat.occupied.booked { border-color: #d97706; border-width: 2px; background: #fffbeb; }
          .seat.occupied.held { border-color: #7c3aed; border-width: 2px; background: #f5f3ff; }
          
          .seat-head { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(0,0,0,0.1); margin-bottom: 2px; }
          .seat-label { font-weight: 900; font-size: 11px; color: #000; }
          .status-tag { font-size: 8px; font-weight: bold; padding: 0 3px; border-radius: 2px; }
          .sold .status-tag { background: #059669; color: #fff; }
          .booked .status-tag { background: #d97706; color: #fff; }
          .held .status-tag { background: #7c3aed; color: #fff; }
          
          .seat-info { display: flex; flex-direction: column; gap: 0px; }
          .info-phone { font-weight: bold; font-size: 10px; color: #000; }
          .info-loc { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 9px; color: #475569; line-height: 1.1; }
          .info-price { font-weight: bold; font-size: 9px; color: #b91c1c; text-align: right; margin-top: auto; }
          
          /* Layout Cabin (Dàn trang 11 hàng dọc) */
          .cabin-container { display: flex; gap: 8px; justify-content: center; }
          .side-col { width: 180px; }
          .floor-col { width: 150px; }
          
          /* Layout Sleeper (Tầng 1 & Tầng 2) */
          .sleeper-container { display: flex; gap: 20px; justify-content: center; }
          .deck { width: 340px; }
          .deck-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; }
          .rear-bench { grid-column: span 3; display: flex; gap: 5px; margin-top: 5px; padding-top: 5px; border-top: 1px dashed #94a3b8; }
          .rear-bench .seat { flex: 1; }

          /* Footer */
          .footer { margin-top: 20px; border-top: 1px solid #cbd5e1; padding-top: 5px; font-size: 10px; color: #64748b; display: flex; justify-content: space-between; }
          .print-btn-container { text-align: center; margin-top: 20px; }
          .btn-print { padding: 8px 20px; background: #000; color: #fff; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; }

          @media print {
            .print-btn-container { display: none; }
            body { padding: 0; }
            .header h1 { color: #000; }
            .trip-summary { border-color: #000; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>SƠ ĐỒ HÀNH KHÁCH</h1>
            <p style="margin: 2px 0 0 0; font-size: 10px;">VinaBus Manager - Chúc Thượng Lộ Bình An</p>
          </div>
          
          <div class="trip-summary">
            <div>
              TUYẾN: ${selectedTrip.route}<br>
              CHUYẾN: ${selectedTrip.name}
            </div>
            <div style="text-align: right;">
              NGÀY: ${dateFormatted} (${lunarFormatted})<br>
              XE: ${selectedTrip.licensePlate} | TÀI XẾ: ${selectedTrip.driver || '---'}
            </div>
          </div>

          ${layoutContent}

          <div class="footer">
            <span>Ngày in: ${new Date().toLocaleString('vi-VN')}</span>
            <div style="display: flex; gap: 10px;">
                <span style="color: #059669;">■ Mua vé</span>
                <span style="color: #d97706;">■ Đặt vé</span>
                <span style="color: #7c3aed;">■ Giữ chỗ</span>
            </div>
          </div>
          
          <div class="print-btn-container">
            <button class="btn-print" onclick="window.print()">TIẾN HÀNH IN (Ctrl + P)</button>
          </div>
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
