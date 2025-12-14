import React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/Sheet";
import { Button } from "./ui/Button";
import { History, Phone, Clock } from "lucide-react";
import { Badge } from "./ui/Badge";
import { ActivityLog } from "../types";

interface RightSheetProps {
  activities: ActivityLog[];
}

export const RightSheet: React.FC<RightSheetProps> = ({ activities }) => {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="bg-white border-slate-200 text-slate-600 hover:text-primary hover:border-primary/50 shrink-0"
          title="Lịch sử phiên"
        >
          <History size={20} />
        </Button>
      </SheetTrigger>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Lịch sử phiên làm việc</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto mt-4 space-y-4 h-[calc(100vh-100px)]">
          {activities.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-400 text-sm text-center">
              <History size={32} className="mb-2 opacity-20" />
              <p>
                Chưa có hoạt động nào
                <br />
                trong phiên này.
              </p>
            </div>
          ) : (
            activities.map((log) => (
              <div
                key={log.id}
                className="border border-slate-200 rounded-xl p-3 bg-white shadow-sm relative overflow-hidden group"
              >
                {/* Header */}
                <div className="flex justify-between items-start mb-2 pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-1.5 font-bold text-primary">
                    <Phone size={14} />
                    <span>{log.phone}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-slate-400">
                    <Clock size={10} />
                    {log.timestamp.toLocaleTimeString("vi-VN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>

                {/* Details List */}
                <div className="space-y-2">
                  {log.details.map((detail, idx) => (
                    <div key={idx} className="text-xs">
                      <div
                        className="font-medium text-slate-700 truncate"
                        title={detail.tripInfo}
                      >
                        {detail.tripInfo}
                      </div>
                      <div className="flex justify-between items-start mt-0.5">
                        <div className="flex items-center gap-1">
                          <Badge
                            variant="secondary"
                            className="px-1 py-0 h-4 text-[10px]"
                          >
                            {detail.seats.length} vé
                          </Badge>
                          <span className="text-slate-500 font-medium">
                            {detail.seats.join(", ")}
                          </span>
                        </div>
                        <div
                          className={`font-bold ${
                            detail.isPaid ? "text-green-600" : "text-yellow-600"
                          }`}
                        >
                          {detail.isPaid
                            ? detail.totalPrice.toLocaleString("vi-VN")
                            : "Vé đặt"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="absolute top-0 left-0 w-1 h-full bg-primary/20"></div>
              </div>
            ))
          )}
          <div className="pt-4 text-center">
            <div className="text-[10px] text-slate-400 bg-slate-50 p-2 rounded border border-slate-100">
              Danh sách này sẽ được làm mới khi tải lại trang.
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};