
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

    // 1. Thu thập dữ liệu từ Manifest
    const seatDataMap = new Map<string, { 
      phone: string; 
      name: string;
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
          name: booking.passenger.name || "Khách lẻ",
          phone: booking.passenger.phone,
          pickup: ticket?.pickup || booking.passenger.pickupPoint || "",
          dropoff: ticket?.dropoff || booking.passenger.dropoffPoint || "",
          price: ticket?.price || 0,
          status: status
        });
      });
    });

    // Bổ sung ghế held thủ công
    selectedTrip.seats.forEach(s => {
      if (s.status === SeatStatus.HELD && !seatDataMap.has(s.id)) {
        seatDataMap.set(s.id, { name: "ĐANG GIỮ", phone: "---", pickup: "---", dropoff: "---", price: 0, status: 'held' });
      }
    });

    // Hàm render từng ô ghế (được thiết kế to hơn)
    const renderSeatHtml = (seat: Seat | undefined) => {
      if (!seat) return `<div class="seat-cell empty-spacer"></div>`;
      const data = seatDataMap.get(seat.id);
      const label = seat.label;

      if (!data) {
        return `
          <div class="seat-cell empty">
            <div class="seat-label">${label}</div>
            <div class="empty-txt">TRỐNG</div>
          </div>
        `;
      }

      let statusText = data.status === 'sold' ? "MUA VÉ" : (data.status === 'held' ? "GIỮ CHỖ" : "ĐẶT VÉ");

      return `
        <div class="seat-cell occupied ${data.status}">
          <div class="seat-top">
            <span class="seat-label">${label}</span>
            <span class="status-badge">${statusText}</span>
          </div>
          <div class="seat-body">
            <div class="passenger-phone">${data.phone}</div>
            <div class="route-info">Đón: ${data.pickup || '---'}</div>
            <div class="route-info">Trả: ${data.dropoff || '---'}</div>
          </div>
          <div class="seat-footer">
            <span class="price-tag">${data.price > 0 ? data.price.toLocaleString('vi-VN') + 'đ' : ''}</span>
          </div>
        </div>
      `;
    };

    const isCabin = selectedTrip.type === BusType.CABIN;
    let layoutHtml = "";

    if (isCabin) {
      // --- XE CABIN: LAYOUT 3 CỘT RỘNG (Dãy B - Sàn - Dãy A) ---
      const regularSeats = selectedTrip.seats.filter(s => !s.isFloorSeat);
      const floorSeats = selectedTrip.seats.filter(s => s.isFloorSeat).sort((a,b) => (a.row||0) - (b.row||0));
      const colB = regularSeats.filter(s => s.col === 0);
      const colA = regularSeats.filter(s => s.col === 1);
      const rows = [0,1,2,3,4,5,6,7,8,9,10]; // 11 hàng

      layoutHtml = `
        <div class="cabin-landscape-grid">
          <!-- DÃY B -->
          <div class="bus-column side">
            <div class="column-header">DÃY B (PHÒNG LẺ)</div>
            <div class="floor-labels"><span>TẦNG 1</span><span>TẦNG 2</span></div>
            <div class="seats-grid">
              ${rows.map(r => `
                <div class="seat-row">
                  ${renderSeatHtml(colB.find(s => s.row === r && s.floor === 1))}
                  ${renderSeatHtml(colB.find(s => s.row === r && s.floor === 2))}
                </div>
              `).join('')}
            </div>
          </div>

          <!-- DÃY SÀN -->
          <div class="bus-column floor">
            <div class="column-header">DÃY SÀN</div>
            <div class="floor-labels"><span>GIỮA LỐI ĐI</span></div>
            <div class="seats-grid">
              ${[0,1,2,3,4,5].map(i => `
                <div class="seat-row-single">
                  ${renderSeatHtml(floorSeats[i])}
                </div>
              `).join('')}
              <div class="empty-fill"></div>
            </div>
          </div>

          <!-- DÃY A -->
          <div class="bus-column side">
            <div class="column-header">DÃY A (PHÒNG CHẴN)</div>
            <div class="floor-labels"><span>TẦNG 1</span><span>TẦNG 2</span></div>
            <div class="seats-grid">
              ${rows.map(r => `
                <div class="seat-row">
                  ${renderSeatHtml(colA.find(s => s.row === r && s.floor === 1))}
                  ${renderSeatHtml(colA.find(s => s.row === r && s.floor === 2))}
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    } else {
      // --- XE GIƯỜNG ĐƠN: LAYOUT ĐỨNG ---
      layoutHtml = `<div class="sleeper-portrait-layout">`;
      [1, 2].forEach(floor => {
        layoutHtml += `
          <div class="floor-block">
            <div class="column-header">TẦNG ${floor}</div>
            <div class="sleeper-grid">
              ${[0,1,2,3,4,5].map(r => 
                [0,1,2].map(c => renderSeatHtml(selectedTrip.seats.find(s => s.floor === floor && s.row === r && s.col === c && !s.isFloorSeat))).join('')
              ).join('')}
              <div class="bench-row">
                ${selectedTrip.seats.filter(s => s.floor === floor && s.row === 6).sort((a,b)=>(a.col||0)-(b.col||0)).map(s => renderSeatHtml(s)).join('')}
              </div>
            </div>
          </div>
        `;
      });
      layoutHtml += `</div>`;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Bảng kê sơ đồ - ${selectedTrip.licensePlate}</title>
        <meta charset="UTF-8">
        <style>
          @page { size: A4 ${isCabin ? 'landscape' : 'portrait'}; margin: 8mm; }
          body { font-family: 'Segoe UI', Arial, sans-serif; color: #000; margin: 0; padding: 0; background: #fff; }
          .container { width: 100%; margin: 0 auto; }
          
          /* Header */
          .header { text-align: center; margin-bottom: 8px; border-bottom: 3px solid #000; padding-bottom: 5px; }
          .header h1 { margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 1px; }
          .trip-bar { display: flex; justify-content: space-between; background: #f0f0f0; padding: 8px 15px; border-radius: 5px; margin-bottom: 15px; font-weight: bold; border: 1px solid #ccc; font-size: 14px; }
          
          /* Cabin Landscape Layout */
          .cabin-landscape-grid { display: flex; gap: 15px; justify-content: space-between; align-items: flex-start; }
          .bus-column { flex: 1; border: 1px solid #ccc; border-radius: 8px; background: #fafafa; padding: 8px; }
          .bus-column.floor { flex: 0 0 160px; } /* Cột sàn hẹp hơn */
          
          .column-header { background: #333; color: #fff; text-align: center; font-weight: bold; padding: 5px; border-radius: 4px; font-size: 13px; margin-bottom: 5px; }
          .floor-labels { display: flex; justify-content: space-around; font-size: 10px; font-weight: bold; color: #666; margin-bottom: 5px; }
          
          .seats-grid { display: flex; flex-direction: column; gap: 4px; }
          .seat-row { display: flex; gap: 4px; }
          .seat-row-single { display: flex; justify-content: center; }
          .seat-row > div { flex: 1; }

          /* Seat Cell Styling - TO HƠN */
          .seat-cell { border: 1.5px solid #666; border-radius: 6px; background: #fff; min-height: 75px; display: flex; flex-direction: column; padding: 5px; position: relative; }
          .seat-cell.empty { border-style: dashed; border-color: #bbb; opacity: 0.6; justify-content: center; align-items: center; }
          .seat-cell.empty-spacer { border: none; visibility: hidden; }
          
          /* Status Colors */
          .seat-cell.sold { border-color: #059669; border-width: 2.5px; background: #f0fdf4; }
          .seat-cell.booked { border-color: #d97706; border-width: 2.5px; background: #fffbeb; }
          .seat-cell.held { border-color: #7c3aed; border-width: 2.5px; background: #f5f3ff; }

          .seat-top { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; margin-bottom: 4px; padding-bottom: 2px; }
          .seat-label { font-weight: 900; font-size: 16px; color: #000; }
          .status-badge { font-size: 9px; font-weight: bold; padding: 1px 4px; border-radius: 3px; color: #fff; }
          .sold .status-badge { background: #059669; }
          .booked .status-badge { background: #d97706; }
          .held .status-badge { background: #7c3aed; }

          .seat-body { flex: 1; display: flex; flex-direction: column; gap: 2px; }
          .passenger-phone { font-weight: 800; font-size: 13px; color: #000; }
          .route-info { font-size: 10.5px; color: #444; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.2; }
          
          .seat-footer { text-align: right; margin-top: auto; }
          .price-tag { font-weight: 900; font-size: 11px; color: #b91c1c; }
          .empty-txt { font-size: 10px; font-weight: bold; color: #ccc; }

          /* Sleeper Portrait Styling */
          .sleeper-portrait-layout { display: flex; flex-direction: column; gap: 20px; }
          .floor-block { border: 1px solid #ccc; border-radius: 10px; padding: 10px; }
          .sleeper-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
          .bench-row { grid-column: span 3; display: flex; gap: 10px; border-top: 2px dashed #ccc; margin-top: 10px; padding-top: 10px; }
          .bench-row > div { flex: 1; }

          /* Footer */
          .footer-info { margin-top: 15px; border-top: 2px solid #000; padding-top: 8px; display: flex; justify-content: space-between; font-size: 12px; font-weight: bold; }
          .print-actions { text-align: center; margin-top: 30px; }
          .btn-p { padding: 12px 40px; background: #000; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-weight: 900; font-size: 16px; box-shadow: 0 4px 10px rgba(0,0,0,0.2); }

          @media print {
            .print-actions { display: none; }
            body { padding: 0; }
            .bus-column { background: #fff !important; }
            .seat-cell { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>BẢNG KÊ SƠ ĐỒ HÀNH KHÁCH</h1>
            <div style="font-size: 12px; font-weight: bold; margin-top: 3px;">Hệ thống quản lý chuyên nghiệp VinaBus</div>
          </div>
          
          <div class="trip-bar">
            <div>TUYẾN: ${selectedTrip.route}</div>
            <div>NGÀY: ${dateFormatted} (${lunarFormatted})</div>
            <div>XE: ${selectedTrip.licensePlate} | TÀI XẾ: ${selectedTrip.driver || '---'}</div>
          </div>

          ${layoutHtml}

          <div class="footer-info">
            <span>Ngày in: ${new Date().toLocaleString('vi-VN')}</span>
            <div style="display: flex; gap: 20px;">
              <span style="color: #059669;">● MUA VÉ (Đã thu)</span>
              <span style="color: #d97706;">● ĐẶT VÉ (Nợ)</span>
              <span style="color: #7c3aed;">● GIỮ CHỖ (Tạm)</span>
            </div>
          </div>
          
          <div class="print-actions">
            <button class="btn-p" onclick="window.print()">BẮT ĐẦU IN NGAY (Ctrl + P)</button>
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
