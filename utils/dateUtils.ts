
export const daysOfWeek = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

export const getDaysInMonth = (year: number, month: number): Date[] => {
  const date = new Date(year, month, 1);
  const days: Date[] = [];
  while (date.getMonth() === month) {
    days.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  return days;
};

// Simplified Lunar Date calculation for UI demonstration
// In a real production app, use a library like 'lunisolar' or 'am-lich'
export const getLunarDate = (date: Date): { day: number; month: number } => {
  // Mock logic: Lunar is roughly ~1 month behind solar, sometimes 29, sometimes 30 days
  // This is a visual approximation for the demo
  const solarDay = date.getDate();
  const solarMonth = date.getMonth() + 1;
  
  let lunarDay = solarDay - 10;
  let lunarMonth = solarMonth - 1;

  if (lunarDay <= 0) {
    lunarDay += 30;
    lunarMonth -= 1;
  }
  if (lunarMonth <= 0) {
    lunarMonth += 12;
  }

  return { day: lunarDay, month: lunarMonth };
};

export const formatLunarDate = (date: Date): string => {
  const { day, month } = getLunarDate(date);
  return `${day}/${month} ÂL`;
};

export const formatTime = (dateStr: string): string => {
  if (!dateStr) return "";
  // Handles "YYYY-MM-DD HH:MM"
  const parts = dateStr.split(' ');
  return parts.length > 1 ? parts[1] : dateStr;
};

export const isSameDay = (d1: Date, d2: Date): boolean => {
  return d1.getDate() === d2.getDate() && 
         d1.getMonth() === d2.getMonth() && 
         d1.getFullYear() === d2.getFullYear();
};
