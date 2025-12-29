
import React from "react";
import { Printer } from "lucide-react";
import { Button } from "./ui/Button";
import { formatCurrency } from "../utils/formatters";

interface BookingPrintProps {
  items: any[];
  bookingForm: { phone: string };
  paidCash: number;
  paidTransfer: number;
  finalTotal: number;
  getSeatValues: (
    tripId: string,
    seat: any,
    pickup: string,
    dropoff: string,
    basePrice: number
  ) => any;
  disabled?: boolean;
  bookingId?: string;
}

export const BookingPrint: React.FC<BookingPrintProps> = ({
  items,
  bookingForm,
  paidCash,
  paidTransfer,
  finalTotal,
  getSeatValues,
  disabled = false,
  bookingId,
}) => {
  const handlePrintReceipt = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const nowStr = new Date().toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const pagesHtml = items
      .map((trip, tripIndex) => {
        const seatLabels = trip.seats.map((s: any) => s.label).join(", ");
        const baseUrl = window.location.origin + window.location.pathname;
        const qrData = `${baseUrl}?bookingId=${bookingId || ""}`;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(
          qrData
        )}&color=0-0-0&bgcolor=ffffff`;
        const departureTimeOnly = trip.tripDate.split(" ")[1] || "";

        const renderLien = (title: string) => `
        <div class="w-[98mm] h-[64mm] border-[1.5pt] border-black p-[2.5mm] flex flex-col bg-white rounded-none">
          <div class="flex justify-between items-start border-b-[1.8pt] border-black pb-[1mm] mb-[1.5mm] rounded-none">
            <div class="flex flex-col">
              <div class="text-[16px] font-black leading-none tracking-[0.5px]">VINABUS</div>
              <div class="text-[8px] mt-[1px]">Ngày in: ${nowStr}</div>
            </div>
            <div class="text-[10px] font-black uppercase border-[1.5pt] border-black px-[5px] py-[1px] rounded-none">${title}</div>
          </div>
          
          <div class="flex-1 flex gap-[2mm] overflow-hidden">
            <div class="flex-1 flex flex-col gap-[1.2mm]">
              <div class="flex gap-[2mm]">
                <div class="flex-1">
                  <div class="text-[7.5px] font-black uppercase mb-[0.5px]">SĐT KHÁCH:</div>
                  <div class="text-[10.5px] font-bold leading-none">${bookingForm.phone || "---"}</div>
                </div>
                <div class="flex-1">
                  <div class="text-[7.5px] font-black uppercase mb-[0.5px]">BIỂN SỐ XE:</div>
                  <div class="text-[10.5px] font-bold leading-none">${trip.licensePlate}</div>
                </div>
              </div>
              <div class="flex gap-[2mm]">
                <div class="flex-1">
                  <div class="text-[7.5px] font-black uppercase mb-[0.5px]">NGÀY ĐI:</div>
                  <div class="text-[10.5px] font-bold leading-none">${new Date(trip.tripDate).toLocaleDateString("vi-VN")}</div>
                </div>
                <div class="flex-1">
                  <div class="text-[7.5px] font-black uppercase mb-[0.5px]">XUẤT BẾN (DỰ KIẾN):</div>
                  <div class="text-[10.5px] font-bold leading-none">${departureTimeOnly}</div>
                </div>
              </div>
              <div class="w-full flex flex-col">
                <div class="text-[7.5px] font-black uppercase mb-[0.5px]">TUYẾN ĐƯỜNG:</div>
                <div class="text-[10.5px] font-black uppercase mt-[1px] border-l-[3pt] border-black pl-[2mm] leading-none">
                  ${trip.route}
                </div>
              </div>
              <div class="w-full flex flex-col">
                <div class="text-[7.5px] font-black uppercase mb-[0.5px]">VỊ TRÍ GHẾ:</div>
                <div class="text-[15px] font-black border-t-[1pt] border-black pt-[0.5mm] mt-[0.5mm] leading-[1.1] rounded-none">
                  ${seatLabels}
                </div>
              </div>
            </div>
            
            <div class="w-[30mm] flex flex-col items-center justify-between border-l-[1pt] border-dashed border-black pl-[2mm]">
              <div class="border-[1pt] border-black p-[0.5mm] bg-white leading-none rounded-none">
                <img src="${qrUrl}" width="65" height="65" />
              </div>
              <div class="w-full text-center border-[1.2pt] border-black py-[1mm] mt-[1mm] rounded-none">
                 <div class="text-[7.5px] font-black">TỔNG THU</div>
                 <div class="text-[14px] font-black">${formatCurrency(finalTotal)}đ</div>
              </div>
            </div>
          </div>

          <div class="mt-[1.2mm] border-t-[1.5pt] border-black pt-[1.2mm] flex justify-between items-center text-[8px] font-black rounded-none">
            <div>Thanh toán: TM ${formatCurrency(paidCash)} | CK ${formatCurrency(paidTransfer)}</div>
            <div class="italic">CHÚC QUÝ KHÁCH THƯỢNG LỘ BÌNH AN!</div>
          </div>
        </div>
      `;

        return `
        <div class="w-[210mm] h-[148mm] relative overflow-hidden bg-white p-[5mm] flex flex-col print:break-after-page">
          <!-- Hàng trên -->
          <div class="flex justify-between w-full mb-[8mm]">
            ${renderLien("LIÊN KHÁCH HÀNG")}
            <div class="w-[4mm]"></div> <!-- Spacer cho đường cắt dọc -->
            ${renderLien("LIÊN SOÁT VÉ")}
          </div>
          
          <!-- Hàng dưới -->
          <div class="flex justify-center w-full">
            ${renderLien("LIÊN ĐỐI SOÁT")}
          </div>

          <!-- Đường cắt tuyệt đối -->
          <div class="absolute left-1/2 top-[5mm] h-[64mm] border-l-[1pt] border-dashed border-black z-50">
            <span class="absolute top-1/2 left-[-6px] -translate-y-1/2 text-[11px] bg-white px-[2px] leading-none">✂</span>
          </div>
          <div class="absolute top-[73mm] left-[5mm] right-[5mm] border-t-[1pt] border-dashed border-black z-50">
            <span class="absolute left-1/2 top-[-6px] -translate-x-1/2 text-[11px] bg-white px-[2px] leading-none">✂</span>
          </div>
        </div>
      `;
      })
      .join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>PhieuIn_VINABUS</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap" rel="stylesheet">
          <style>
            @page { size: A5 landscape; margin: 0; }
            * { -webkit-print-color-adjust: exact; border-radius: 0 !important; }
            body { font-family: 'Inter', sans-serif; margin: 0; padding: 0; }
            @media print { .no-print { display: none !important; } }
          </style>
        </head>
        <body class="bg-white text-black">
          <div class="no-print bg-black text-white p-3 text-center sticky top-0 z-[1000] border-b border-gray-800">
            <button class="bg-white text-black font-black py-2 px-12 text-sm hover:bg-gray-200 transition-colors" onclick="window.print()">
              XÁC NHẬN IN PHIẾU
            </button>
            <p class="mt-2 text-[11px]">Cài đặt in: Khổ <b>A5</b> • Hướng <b>Ngang (Landscape)</b> • Tỷ lệ <b>100%</b></p>
          </div>
          <div class="flex flex-col items-center">
            ${pagesHtml}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <Button
      variant="outline"
      onClick={handlePrintReceipt}
      disabled={disabled}
      className="border-indigo-700 text-indigo-100 hover:bg-indigo-800 bg-indigo-900/40 h-11 px-6 text-sm font-bold flex items-center justify-center gap-2 min-w-[120px]"
    >
      <Printer size={16} />
      In phiếu
    </Button>
  );
};
