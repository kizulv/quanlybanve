import React, { useState } from "react";
import { Printer, FileText, Layout, Check } from "lucide-react";
import { Button } from "./ui/Button";
import { formatCurrency } from "../utils/formatters";
import { formatLunarDate } from "../utils/dateUtils";
import { BASE_URL } from "../constants";
import QRCode from "qrcode";

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

type PrintFormat = "A5_LANDSCAPE" | "A4_PORTRAIT";

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
  // Mặc định chọn khổ A4 đứng
  const [format, setFormat] = useState<PrintFormat>("A4_PORTRAIT");

  const handlePrintReceipt = async () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const nowStr = new Date().toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    // Cấu hình theo khổ in
    const isA4 = format === "A4_PORTRAIT";
    const pageSizeCss = isA4 ? "A4 portrait" : "A5 landscape";
    const containerHeight = isA4 ? "min-h-[280mm]" : "h-[147mm]";
    const contentMarginTop = isA4 ? "mt-0" : "mt-0";

    // Tạo các mã QR trước khi render HTML
    const qrDataUrls = await Promise.all(
      items.map(async (trip) => {
        const qrData = `${BASE_URL}?bookingId=${bookingId || ""}`;

        try {
          return await QRCode.toDataURL(qrData, {
            margin: 1,
            width: 100,
            color: {
              dark: "#000000",
              light: "#ffffff",
            },
          });
        } catch (err) {
          console.error("QR Generation error", err);
          return "";
        }
      })
    );

    const pagesHtml = items
      .map((trip, tripIndex) => {
        const seatLabels = trip.seats.map((s: any) => s.label).join(", ");
        const qrUrl = qrDataUrls[tripIndex];
        const departureTimeOnly = trip.tripDate.split(" ")[1] || "";

        const tripTotal = trip.seats.reduce((sum: number, seat: any) => {
          const vals = getSeatValues(
            trip.tripId,
            seat,
            trip.pickup,
            trip.dropoff,
            trip.basePrice
          );
          return sum + (vals.price || 0);
        }, 0);

        const renderLien = (title: string) => `
        <div class="w-[97.5mm] h-[64mm] border-[1.5pt] border-black p-[2.5mm] pb-[1.5mm] flex flex-col bg-white rounded-none">
          <div class="flex justify-between items-start border-b-[1.8pt] border-black pb-[1mm] mb-[1.5mm] rounded-none">
            <div class="flex flex-col">
              <div class="text-[10px] font-bold">CÔNG TY TNHH MTV LÊ DŨNG</div>
              <div class="text-[20px] mt-1 font-black leading-none tracking-[0.5px]">PHIẾU ĐẶT VÉ</div>
            </div>
            <div class="flex flex-col w-[110px]">
              <div class="text-[10px] uppercase border-[1.5pt] border-black text-center py-[2px] font-semibold rounded-none">${title}</div>
               <div class="text-[8px] italic text-center mt-[3px]">Ngày in: ${nowStr}</div>
            </div>
          </div>
          
          <div class="flex-1 flex gap-[2mm] overflow-hidden">
            <div class="flex-1 flex flex-col gap-[1.2mm]">
              <div class="flex gap-[2mm]">
                <div class="flex-1">
                  <div class="text-[7.5px] uppercase mb-[0.5px]">SĐT KHÁCH:</div>
                  <div class="text-[10.5px] font-bold leading-none">${
                    bookingForm.phone || "---"
                  }</div>
                </div>
                <div class="flex-1">
                  <div class="text-[7.5px] uppercase mb-[0.5px]">BIỂN SỐ XE:</div>
                  <div class="text-[10.5px] font-bold leading-none">${
                    trip.licensePlate
                  }</div>
                </div>
              </div>
              <div class="my-[2px]">
                <div class="text-[7.5px] uppercase mb-[1px]">NGÀY KHỞI HÀNH:</div>
                <div class="text-[10.5px] font-bold leading-none">${new Date(
                  trip.tripDate
                ).toLocaleDateString("vi-VN")} 
                ${" - "} 
                ${"(" + formatLunarDate(new Date(trip.tripDate)) + ")"}</div>
              </div>
              <div class="w-full">
                <span class="text-base font-black uppercase mt-2 leading-none">
                  ${trip.route}
                </span>
              </div>
              <div class="w-full flex flex-col">
                <div class="text-[7.5px] uppercase border-t-[1pt] border-black pt-1 mt-1 mb-[0.5px]">VỊ TRÍ GHẾ:</div>
                <div class="text-[15px] font-black rounded-none leading-none">
                  ${seatLabels}
                </div>
              </div>
            </div>
            
            <div class="flex flex-col items-center justify-between border-l-[1pt] border-dashed border-black pl-[2mm]">
              <div class="flex items-center border-2 border-black p-1 rounded-none w-[110px] margin-auto justify-center">
                <img src="${qrUrl}" width="65" height="65" />
              </div>
              <div class="w-[110px] text-center border-[1.5pt] border-black py-[1mm] mt-[1mm] rounded-none">
                 <div class="text-[7.5px] font-black">GIÁ VÉ</div>
                 <div class="text-[10px] font-black">${formatCurrency(
                   tripTotal
                 )}đ</div>
                 <div class="text-[6px] font-semibold">Tổng thanh toán:</div>
                 <div class="text-[7px] font-semibold">TM ${formatCurrency(
                   paidCash
                 )} | CK ${formatCurrency(paidTransfer)}</div>
              </div>
            </div>
          </div>

          <div class="mt-[1.2mm] border-t-[1.5pt] border-black pt-[1.2mm] flex justify-between items-center text-sm rounded-none">
            <div class="flex items-center justify-between">
              <span class="font-black">Xuất bến: ${departureTimeOnly}</span>
              <span class="ml-[3px] text-[9px] mt-[1.5px] italic">(Dự kiến)</span>
            </div>
            <div class="font-black flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-top: 1px;"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l2.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
              ${trip.busPhoneNumber || "---"}
            </div>
          </div>
        </div>
      `;

        return `
        <div class="page-container w-[210mm] ${containerHeight} relative overflow-hidden bg-white p-[5mm] flex flex-col items-center">
          <div class="${contentMarginTop} flex flex-col items-center w-full">
            <div class="flex justify-between w-full mb-[8mm]">
              ${renderLien("LIÊN HÀNH KHÁCH")}
              ${renderLien("LIÊN SOÁT VÉ")}
            </div>
            <div class="flex justify-center w-full">
              ${renderLien("LIÊN ĐỐI SOÁT")}
            </div>
            <div class="absolute left-[105mm-1pt] top-[5mm] h-[64mm] border-l-[1pt] border-dashed border-black z-50">
              <span class="absolute top-1/2 left-[-7.5px] -translate-y-1/2 text-[11px] bg-white px-[2px] leading-none">✂</span>
            </div>
            <div class="absolute top-[73mm] left-[5mm] right-[5mm] border-t-[1pt] border-dashed border-black z-50">
              <span class="absolute left-1/2 top-[-6px] -translate-x-1/2 text-[11px] bg-white px-[2px] leading-none">✂</span>
            </div>
            ${
              isA4
                ? `<div class="absolute top-[145mm] left-[5mm] right-[5mm] border-t-[1pt] border-dashed border-black z-50">
                    <span class="absolute left-1/2 top-[-6px] -translate-x-1/2 text-[11px] bg-white px-[2px] leading-none">✂</span>
                  </div>`
                : ""
            }
          </div>
        </div>
      `;
      })
      .join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>In phiếu đặt vé - [${bookingForm.phone}]</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap" rel="stylesheet">
          <style>
            @page { size: ${pageSizeCss}; margin: 0; }
            * { -webkit-print-color-adjust: exact; border-radius: 0 !important; box-sizing: border-box; }
            body { font-family: 'Inter', sans-serif; margin: 0; padding: 0; background: white; }
            .page-container { page-break-after: always; }
            .page-container:last-child { page-break-after: auto; }
            @media print { 
              .no-print { display: none !important; }
              html, body { width: 210mm; height: auto; overflow: visible; }
            }
          </style>
        </head>
        <body class="bg-white text-black">
          <div class="no-print bg-black text-white p-3 text-center sticky top-0 z-[1000] border-b border-gray-800">
            <button class="bg-white text-black font-black py-2 px-12 text-sm hover:bg-gray-200 transition-colors" onclick="window.print()">
              IN PHIẾU
            </button>
            <p class="mt-2 text-[11px]">Cài đặt in: Khổ <b>${
              isA4 ? "A4" : "A5"
            }</b> • Hướng <b>${
      isA4 ? "Đứng (Portrait)" : "Ngang (Landscape)"
    }</b></p>
          </div>
          <div class="print-wrapper flex flex-col items-center justify-between">
            ${pagesHtml}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex bg-indigo-950/40 border border-indigo-800/60 rounded-lg h-[36px]">
        <button
          onClick={() => setFormat("A5_LANDSCAPE")}
          disabled={disabled}
          className={`flex items-center gap-2 px-4 rounded-md transition-all h-full ${
            format === "A5_LANDSCAPE"
              ? "bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-400/30"
              : "text-indigo-400 hover:text-indigo-200 hover:bg-indigo-900/30"
          }`}
          title="In khổ A5 ngang"
        >
          <Layout
            size={14}
            className={
              format === "A5_LANDSCAPE" ? "text-white" : "text-indigo-500"
            }
          />
          <span className="text-[11px] tracking-tight">A5 Ngang</span>
        </button>
        <button
          onClick={() => setFormat("A4_PORTRAIT")}
          disabled={disabled}
          className={`flex items-center gap-2 px-4 rounded-md transition-all h-full ${
            format === "A4_PORTRAIT"
              ? "bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-400/30"
              : "text-indigo-400 hover:text-indigo-200 hover:bg-indigo-900/30"
          }`}
          title="In khổ A4 đứng"
        >
          <FileText
            size={14}
            className={
              format === "A4_PORTRAIT" ? "text-white" : "text-indigo-500"
            }
          />
          <span className="text-[11px] tracking-tight">A4 Đứng</span>
        </button>
      </div>

      <Button
        variant="outline"
        disabled={disabled}
        onClick={handlePrintReceipt}
        className="border-indigo-700 text-indigo-100 hover:bg-indigo-600 hover:text-white bg-indigo-900/40 h-10 px-8 text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-indigo-900/20"
      >
        <Printer size={18} />
        In phiếu
      </Button>
    </div>
  );
};
