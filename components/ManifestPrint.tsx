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
    const dateFormatted = `${tripDate.getDate()}/${
      tripDate.getMonth() + 1
    }/${tripDate.getFullYear()}`;
    const lunarFormatted = formatLunarDate(tripDate);

    const seatDataMap = new Map<
      string,
      {
        phone: string;
        pickup: string;
        dropoff: string;
        price: number;
        note: string;
        status: "sold" | "booked" | "held";
        groupIndex?: number;
        groupTotal?: number;
      }
    >();

    manifest.forEach((booking) => {
      const tripItem = booking.items.find((i) => i.tripId === selectedTrip.id);
      if (!tripItem) return;

      const isHold = booking.status === "hold";
      const status =
        booking.status === "payment" ? "sold" : isHold ? "held" : "booked";

      // Lấy danh sách seatIds và sắp xếp để đánh số thứ tự ổn định
      const seatIds = [...tripItem.seatIds].sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true })
      );
      const groupTotal = seatIds.length;

      tripItem.seatIds.forEach((seatId) => {
        const ticket = tripItem.tickets?.find((t) => t.seatId === seatId);
        const groupIndex = seatIds.indexOf(seatId) + 1;

        seatDataMap.set(seatId, {
          phone: booking.passenger.phone,
          pickup: ticket?.pickup || booking.passenger.pickupPoint || "",
          dropoff: ticket?.dropoff || booking.passenger.dropoffPoint || "",
          price: ticket?.price || 0,
          // FIX: Ưu tiên ghi chú của từng vé, sau đó mới đến ghi chú chung của khách hàng
          note: ticket?.note || booking.passenger.note || "",
          status: status,
          groupIndex,
          groupTotal,
        });
      });
    });

    selectedTrip.seats.forEach((s) => {
      if (s.status === SeatStatus.HELD && !seatDataMap.has(s.id)) {
        seatDataMap.set(s.id, {
          phone: "---",
          pickup: "---",
          dropoff: "---",
          price: 0,
          note: s.note || "",
          status: "held",
        });
      }
    });

    // TÍNH TỔNG TIỀN VÉ
    const totalAmount = Array.from(seatDataMap.values()).reduce(
      (sum, data) => sum + data.price,
      0
    );

    const isCabin = selectedTrip.type === BusType.CABIN;
    const A4_landscape = isCabin
      ? "size: A4 landscape; margin: 3mm;"
      : "size: A4 portrait; margin: 0;";
    const A4_margin = isCabin ? "ml-[20mm]" : "mt-0";
    const Manifest_RecordHight = "h-[94px]";
    const Manifest_SeatFontSize = isCabin ? "text-[12px]" : "text-[10px]";
    let layoutHtml = "";

    const renderSeatHtml = (seat: Seat | undefined) => {
      if (!seat)
        return `<div class="border-transparent bg-transparent ${Manifest_RecordHight}"></div>`;

      const data = seatDataMap.get(seat.id);
      const label = seat.label;

      if (!data) {
        return `
        <div class="border-2 border-slate-900 flex flex-col p-1 relative overflow-hidden ${Manifest_RecordHight}">
          <div class="flex justify-between items-center border-b border-black/5 pb-0.5">
            <span class="font-black text-[11px] text-black leading-none">${label}</span>
          </div>
          <div class="flex-1 flex flex-col justify-between overflow-hidden">
            <div class="flex-1 border-b border-gray-300 opacity-50"></div>
            <div class="flex-1 border-b border-gray-300 opacity-50"></div>
            <div class="flex-1 border-b border-gray-300 opacity-50"></div>
          </div>
        </div>
        `;
      }

      const statusColors = {
        sold: "border-slate-600 bg-slate-200",
        booked: "border-slate-600",
        held: "border-slate-600",
      };

      // Case: HELD - Only show label and note
      if (data.status === "held") {
        return `
          <div class="border-2 flex flex-col p-1 relative overflow-hidden ${
            statusColors.held
          } ${Manifest_RecordHight}">
            <div class="flex justify-between items-center border-b border-black/5 pb-0.5 mb-1">
              <span class="font-black text-[11px] text-black leading-none">${label}</span>
            </div>
            <div class="flex-1 flex flex-col items-center justify-center text-center overflow-hidden">
              <div class="text-[10px] leading-tight italic font-medium w-full truncate px-1">
                ${data.note || ""}
              </div>
            </div>
          </div>
        `;
      }

      // Case: SOLD or BOOKED - Full Info
      return `
        <div class="border-2 flex flex-col p-1 relative overflow-hidden ${
          statusColors[data.status]
        } ${Manifest_RecordHight}">
          <div class="flex justify-between items-center border-b border-black/5 pb-0.5 mb-1">
            <span class="font-black text-[11px] text-black leading-none">${label}</span>
          </div>
          <div class="flex-1 flex flex-col overflow-hidden text-center">
            <div class="flex justify-center">
            <span class="font-black text-[12px] leading-tight mr-1">${
              data.phone
            }</span>
            ${
              data.groupTotal && data.groupTotal > 1
                ? ` <span class="text-[10px] font-normal">(${data.groupIndex}/${data.groupTotal})</span>`
                : ""
            }</div>
            <div class="${Manifest_SeatFontSize} leading-tight opacity-90 mt-0.5">${
        data.pickup || "---"
      } - ${data.dropoff || "---"}</div>
            <div class="text-[10px] leading-tight opacity-90 mt-1 italic">${
              data.note || ""
            }</div>
          </div>
          ${
            data.price > 0
              ? `<div class="absolute bottom-0.5 right-1 font-black text-[8px] bg-white/60 px-0.5 rounded">${
                  data.price / 1000
                }</div>`
              : ""
          }
        </div>
      `;
    };

    if (isCabin) {
      const regularSeats = selectedTrip.seats.filter((s) => !s.isFloorSeat);
      const floorSeats = selectedTrip.seats
        .filter((s) => s.isFloorSeat)
        .sort((a, b) => (a.row || 0) - (b.row || 0));
      const colB = regularSeats.filter((s) => s.col === 0);
      const colA = regularSeats.filter((s) => s.col === 1);
      const rows = [0, 1, 2, 3, 4, 5];

      layoutHtml = `
        <div class="flex gap-6 w-full h-[165mm] overflow-hidden">
          <div class="flex-1 flex flex-col">
            <div class="text-sm font-bold py-1 px-2 mb-1.5 text-center uppercase tracking-wider">Dãy B</div>
            <div class="flex flex-col justify-around h-full">
              ${rows
                .map(
                  (r) => `
                <div class="grid grid-cols-2 gap-1.5">
                  ${renderSeatHtml(
                    colB.find((s) => s.row === r && s.floor === 1)
                  )}
                  ${renderSeatHtml(
                    colB.find((s) => s.row === r && s.floor === 2)
                  )}
                </div>
              `
                )
                .join("")}
            </div>
          </div>
          <div class="w-45 flex flex-col">
            <div class="text-sm font-bold py-1 px-2 mb-1.5 text-center uppercase tracking-wider">SÀN</div>
            <div class="flex flex-col justify-around h-full">
              ${[0, 1, 2, 3, 4, 5]
                .map((i) => renderSeatHtml(floorSeats[i]))
                .join("")}
            </div>
          </div>
          <div class="flex-1 flex flex-col">
            <div class="text-sm font-bold py-1 px-2 mb-1.5 text-center uppercase tracking-wider">Dãy A</div>
            <div class="flex flex-col justify-around h-full">
              ${rows
                .map(
                  (r) => `
                <div class="grid grid-cols-2 gap-1.5">
                  ${renderSeatHtml(
                    colA.find((s) => s.row === r && s.floor === 1)
                  )}
                  ${renderSeatHtml(
                    colA.find((s) => s.row === r && s.floor === 2)
                  )}
                </div>
              `
                )
                .join("")}
            </div>
          </div>
        </div>
      `;
    } else {
      const floorSeats = selectedTrip.seats
        .filter((s) => s.isFloorSeat)
        .sort((a, b) =>
          a.label.localeCompare(b.label, undefined, { numeric: true })
        );

      const benchSeatsF1 = selectedTrip.seats
        .filter(
          (s) =>
            s.floor === 1 &&
            !s.isFloorSeat &&
            (s.row === 6 ||
              (s.id && s.id.startsWith("B1-")) ||
              (s.label && s.label.startsWith("B1-")))
        )
        .sort((a, b) => (a.col || 0) - (b.col || 0));

      const benchSeatsF2 = selectedTrip.seats
        .filter(
          (s) =>
            s.floor === 2 &&
            !s.isFloorSeat &&
            (s.row === 6 ||
              (s.id && s.id.startsWith("B2-")) ||
              (s.label && s.label.startsWith("B2-")))
        )
        .sort((a, b) => (a.col || 0) - (b.col || 0));

      layoutHtml = `<div class="grid grid-cols-2 gap-4 max-h-[170mm] overflow-hidden">`;
      [1, 2].forEach((floor) => {
        layoutHtml += `
          <div class="bg-white">
            <div class="flex flex-col items-center text-sm font-bold py-1 px-3 rounded mb-1 uppercase">Tầng ${floor}</div>
            <div class="grid grid-cols-3 gap-1.5">
              ${[0, 1, 2, 3, 4, 5]
                .map((r) =>
                  [0, 1, 2]
                    .map((c) =>
                      renderSeatHtml(
                        selectedTrip.seats.find(
                          (s) =>
                            s.floor === floor &&
                            s.row === r &&
                            s.col === c &&
                            !s.isFloorSeat
                        )
                      )
                    )
                    .join("")
                )
                .join("")}
            </div>
          </div>
        `;
      });
      layoutHtml += `</div>`;

      if (benchSeatsF1.length > 0 || benchSeatsF2.length > 0) {
        layoutHtml += `<div class="pt-2 space-y-3">`;
        if (benchSeatsF1.length > 0) {
          layoutHtml += `
              <div>
                <div class="grid gap-1.5" style="grid-template-columns: repeat(${
                  benchSeatsF1.length
                }, 1fr)">
                  ${benchSeatsF1.map((s) => renderSeatHtml(s)).join("")}
                </div>
              </div>
            `;
        }
        if (benchSeatsF2.length > 0) {
          layoutHtml += `
              <div class="">
                <div class="grid gap-1.5" style="grid-template-columns: repeat(${
                  benchSeatsF2.length
                }, 1fr)">
                  ${benchSeatsF2.map((s) => renderSeatHtml(s)).join("")}
                </div>
              </div>
            `;
        }
        layoutHtml += `</div>`;
      }

      if (floorSeats.length > 0) {
        layoutHtml += `
          <div class="pt-2">
            <div class="text-center font-black text-2.5 uppercase mb-1.5 tracking-widest text-slate-500">SÀN</div>
            <div class="grid grid-cols-6 gap-1.5">
              ${floorSeats.map((s) => renderSeatHtml(s)).join("")}
            </div>
          </div>
        `;
      }
    }

    const styles = Array.from(
      document.querySelectorAll("style, link[rel='stylesheet']")
    )
      .map((el) => el.outerHTML)
      .join("\n");

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Bảng kê - ${dateFormatted} (${lunarFormatted}) - ${
      selectedTrip.licensePlate
    }</title>
        <meta charset="UTF-8">
        ${styles}
        <style>
          @page { ${A4_landscape};}
          @media print {
            .no-print { display: none; }
            body { padding: 0; margin: 0; }
            .container-page { height: 100vh; max-height: 100vh; overflow: hidden; }
          }
          body { font-family: 'Inter', sans-serif; -webkit-print-color-adjust: exact; background: white; }
          .container-page { width: 100%; margin: 0 auto; display: flex; flex-direction: column; }
        </style>
      </head>
      <body class="p-0 ${A4_margin} flex flex-col h-full">
        <div class="container-page px-4 max-w-[297mm]">
          <div class="flex justify-between items-center border-b-2 border-black py-2 mb-1">
            <div class="flex flex-col">
              <h1 class="text-md font-black uppercase leading-tight">BẢNG KÊ TUYẾN: ${
                selectedTrip.route
              }</h1>
              <span class="text-sm font-bold text-slate-500 uppercase tracking-widest">XUẤT BẾN:  ${
                selectedTrip.departureTime.split(" ")[1]
              }</span>
            </div>
            
            <div class="text-right flex items-center gap-4">
              <div class="flex flex-col items-end px-4 border-r border-slate-300">
                <span class="text-[10px] font-black text-slate-500 uppercase tracking-tighter">Đã thanh toán:</span>
                <span class="text-lg font-black text-red-600 leading-none">${totalAmount.toLocaleString(
                  "vi-VN"
                )} đ</span>
              </div>
              <span class="bg-white border-2 border-slate-900 text-slate-900 px-3 py-1 rounded text-lg font-black">${
                selectedTrip.licensePlate
              }</span>
              <div class="flex flex-col text-right">
                <span class="text-md font-bold">${dateFormatted}</span>
                <span class="text-xs font-bold text-slate-500 uppercase">${lunarFormatted}</span>
              </div>
            </div>
          </div>
          <div class="flex-1 min-h-0 overflow-hidden">
            ${layoutHtml}
          </div>
          <div class="flex justify-between items-center text-slate-500 text-[10px] shrink-0 mt-2">
            <div>Thời gian in: ${new Date().toLocaleString("vi-VN")} </div>
            <div class="no-print">
               <button onclick="window.print()" class="bg-slate-900 text-white hover:bg-slate-700 px-8 py-2 rounded text-sm font-bold uppercase tracking-wider">In bảng kê</button>
            </div>
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
      className="h-7 text-[12px] font-bold text-blue-600 hover:bg-blue-50 border border-blue-100"
      disabled={disabled || !selectedTrip}
    >
      <Printer size={12} className="mr-1" /> In bảng kê
    </Button>
  );
};
