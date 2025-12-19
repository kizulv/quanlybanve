
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

    // Xử lý dữ liệu khách hàng theo từng ghế để tra cứu nhanh
    const seatDataMap = new Map<string, { 
      phone: string; 
      pickup: string; 
      dropoff: string; 
      price: number; 
      isPaid: boolean;
      note?: string;
    }>();

    manifest.forEach((booking) => {
      const tripItem = booking.items.find((i) => i.tripId === selectedTrip.id);
      if (!tripItem) return;

      const totalPaid = (booking.payment?.paidCash || 0) + (booking.payment?.paidTransfer || 0);
      const isPaid = totalPaid >= booking.totalPrice || booking.status === 'payment';

      tripItem.seatIds.forEach((seatId) => {
        const ticket = tripItem.tickets?.find((t) => t.seatId === seatId);
        seatDataMap.set(seatId, {
          phone: booking.passenger.phone,
          pickup: ticket?.pickup || booking.passenger.pickupPoint || "",
          dropoff: ticket?.dropoff || booking.passenger.dropoffPoint || "",
          price: ticket?.price || 0,
          isPaid: isPaid,
          note: booking.passenger.note
        });
      });
    });

    // Hàm render HTML cho từng ô ghế
    const renderSeatHtml = (seatId: string, label: string) => {
      const data = seatDataMap.get(seatId);
      if (!data) {
        return `<div class="seat empty"><div class="seat-label">${label}</div><div class="empty-txt">TRỐNG</div></div>`;
      }
      return `
        <div class="seat occupied ${data.isPaid ? 'paid' : 'booked'}">
          <div class="seat-head">
            <span class="seat-label">${label}</span>
            <span class="seat-price">${data.price > 0 ? data.price.toLocaleString('vi-VN') : ''}</span>
          </div>
          <div class="seat-info">
            <div class="info-phone">${data.phone}</div>
            <div class="info-loc" title="${data.pickup}">${data.pickup || '---'}</div>
            <div class="info-loc" title="${data.dropoff}">${data.dropoff || '---'}</div>
          </div>
        </div>
      `;
    };

    // LOGIC XÂY DỰNG LAYOUT THEO LOẠI XE
    let layoutContent = "";
    const isCabin = selectedTrip.type === BusType.CABIN;

    if (isCabin) {
      // BỐ TRÍ XE CABIN 22 PHÒNG (Dãy B - Sàn - Dãy A)
      const rows = 11;
      layoutContent = `<div class="cabin-layout">`;
      
      // Dãy B (Lẻ)
      layoutContent += `<div class="side-col"><h3>DÃY B (PHÒNG LẺ)</h3>`;
      for (let r = 0; r < rows; r++) {
        layoutContent += `<div class="row-pair">
          ${renderSeatHtml(`1-${r}-0`, `B${r*2+1}`)}
          ${renderSeatHtml(`2-${r}-0`, `B${r*2+2}`)}
        </div>`;
      }
      layoutContent += `</div>`;

      // Dãy Sàn (Nếu có)
      const floorSeats = selectedTrip.seats.filter(s => s.isFloorSeat);
      if (floorSeats.length > 0) {
        layoutContent += `<div class="floor-col"><h3>SÀN</h3>`;
        floorSeats.forEach(s => {
          layoutContent += renderSeatHtml(s.id, s.label);
        });
        layoutContent += `</div>`;
      }

      // Dãy A (Chẵn)
      layoutContent += `<div class="side-col"><h3>DÃY A (PHÒNG CHẴN)</h3>`;
      for (let r = 0; r < rows; r++) {
        layoutContent += `<div class="row-pair">
          ${renderSeatHtml(`1-${r}-1`, `A${r*2+1}`)}
          ${renderSeatHtml(`2-${r}-1`, `A${r*2+2}`)}
        </div>`;
      }
      layoutContent += `</div>`;
      layoutContent += `</div>`;

    } else {
      // BỐ TRÍ XE GIƯỜNG ĐƠN 41 (Tầng 1 | Tầng 2)
      layoutContent = `<div class="sleeper-layout">`;
      
      [1, 2].forEach(floor => {
        layoutContent += `<div class="deck">
          <h3>TẦNG ${floor}</h3>
          <div class="deck-grid">`;
        
        // Render 6 hàng chính (3 cột)
        for (let r = 0; r < 6; r++) {
          for (let c = 0; c < 3; c++) {
            const seat = selectedTrip.seats.find(s => s.floor === floor && s.row === r && s.col === c && !s.isFloorSeat);
            if (seat) layoutContent += renderSeatHtml(seat.id, seat.label);
            else layoutContent += `<div class="seat spacer"></div>`;
          }
        }
        
        // Băng cuối (Tầng 1)
        if (floor === 1) {
          layoutContent += `<div class="rear-bench">`;
          const benchSeats = selectedTrip.seats.filter(s => s.floor === 1 && s.row === 6);
          benchSeats.sort((a,b) => (a.col||0) - (b.col||0)).forEach(s => {
             layoutContent += renderSeatHtml(s.id, s.label);
          });
          layoutContent += `</div>`;
        }
        
        layoutContent += `</div></div>`;
      });
      layoutContent += `</div>`;

      // Phần vé sàn của xe giường
      const floorSeats = selectedTrip.seats.filter(s => s.isFloorSeat);
      if (floorSeats.length > 0) {
        layoutContent += `
          <div class="sleeper-floor-section">
            <h3>DANH SÁCH VÉ SÀN</h3>
            <div class="floor-grid">
              ${floorSeats.map(s => renderSeatHtml(s.id, s.label)).join('')}
            </div>
          </div>
        `;
      }
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Bảng kê sơ đồ - ${selectedTrip.licensePlate}</title>
        <meta charset="UTF-8">
        <style>
          @page { size: A4; margin: 10mm; }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1e293b; margin: 0; padding: 0; background: #fff; }
          .container { width: 100%; max-width: 190mm; margin: 0 auto; }
          
          /* Header */
          .header { text-align: center; margin-bottom: 15px; border-bottom: 2px solid #2563eb; padding-bottom: 10px; }
          .header h1 { margin: 0; font-size: 24px; color: #1e40af; text-transform: uppercase; }
          .trip-summary { display: flex; justify-content: space-between; background: #f8fafc; padding: 10px; border-radius: 6px; margin-bottom: 20px; font-size: 13px; font-weight: bold; border: 1px solid #e2e8f0; }
          
          /* Seat Styles */
          h3 { font-size: 11px; text-align: center; margin: 0 0 8px 0; background: #f1f5f9; padding: 4px; border-radius: 4px; color: #64748b; text-transform: uppercase; }
          .seat { border: 1px solid #cbd5e1; border-radius: 6px; padding: 4px; min-height: 60px; display: flex; flex-direction: column; font-size: 10px; background: #fff; }
          .seat.empty { border-style: dashed; background: #f8fafc; color: #cbd5e1; justify-content: center; align-items: center; }
          .seat.occupied.booked { border-color: #f59e0b; background: #fffbeb; }
          .seat.occupied.paid { border-color: #10b981; background: #ecfdf5; }
          .seat.spacer { border: none; background: transparent; visibility: hidden; }
          
          .seat-head { display: flex; justify-content: space-between; border-bottom: 1px solid rgba(0,0,0,0.05); margin-bottom: 2px; padding-bottom: 2px; }
          .seat-label { font-weight: 900; font-size: 12px; color: #1e293b; }
          .seat-price { font-weight: bold; color: #b91c1c; font-size: 9px; }
          .empty-txt { font-size: 8px; font-weight: bold; }
          
          .seat-info { display: flex; flex-direction: column; gap: 1px; }
          .info-phone { font-weight: bold; color: #000; font-size: 11px; }
          .info-loc { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #475569; font-size: 9px; }
          
          /* Layout Cabin */
          .cabin-layout { display: flex; gap: 10px; justify-content: center; align-items: flex-start; }
          .side-col { width: 220px; display: flex; flex-direction: column; gap: 6px; }
          .floor-col { width: 120px; display: flex; flex-direction: column; gap: 6px; }
          .row-pair { display: flex; gap: 4px; }
          .row-pair .seat { flex: 1; }

          /* Layout Sleeper */
          .sleeper-layout { display: flex; gap: 20px; justify-content: center; }
          .deck { width: 330px; }
          .deck-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
          .rear-bench { grid-column: span 3; display: flex; gap: 4px; margin-top: 10px; border-top: 1px dashed #cbd5e1; padding-top: 10px; }
          .rear-bench .seat { flex: 1; }
          .sleeper-floor-section { margin-top: 20px; padding-top: 15px; border-top: 1px solid #e2e8f0; }
          .floor-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; }

          /* Footer */
          .footer { margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 10px; font-size: 11px; color: #94a3b8; display: flex; justify-content: space-between; }
          .print-btn-container { text-align: center; margin-top: 30px; }
          .btn-print { padding: 10px 25px; background: #2563eb; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 15px; box-shadow: 0 4px 6px rgba(37,99,235,0.2); }

          @media print {
            .print-btn-container { display: none; }
            body { padding: 0; }
            .header h1 { color: #000; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Bảng kê hành khách theo sơ đồ</h1>
            <p style="margin: 5px 0 0 0; font-size: 12px; color: #64748b;">Hệ thống VinaBus Manager - Chúc thượng lộ bình an</p>
          </div>
          
          <div class="trip-summary">
            <div>
              TUYẾN: ${selectedTrip.route}<br>
              CHUYẾN: ${selectedTrip.name}
            </div>
            <div style="text-align: right;">
              NGÀY CHẠY: ${dateFormatted} (${lunarFormatted})<br>
              BIỂN SỐ: ${selectedTrip.licensePlate} | TÀI XẾ: ${selectedTrip.driver || '---'}
            </div>
          </div>

          ${layoutContent}

          <div class="footer">
            <span>Ngày xuất bản: ${new Date().toLocaleString('vi-VN')}</span>
            <span>Trang 1/1</span>
          </div>
          
          <div class="print-btn-container">
            <button class="btn-print" onclick="window.print()">BẮT ĐẦU IN (PHÍM P)</button>
          </div>
        </div>
        <script>
          window.addEventListener('keydown', (e) => {
            if(e.key.toLowerCase() === 'p') window.print();
          });
        </script>
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
