
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

// Accurate Lunar Date calculation using Native Intl API
export const getLunarDate = (date: Date): { day: number; month: number; year: number } => {
  try {
    // Use en-US with chinese calendar to ensure we get ASCII numeric values
    // zh-CN might return Chinese characters for numbers which parseInt fails on
    const formatter = new Intl.DateTimeFormat('en-US-u-ca-chinese', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
    });
    
    const parts = formatter.formatToParts(date);
    let day = 0;
    let month = 0;
    let year = 0;

    parts.forEach(p => {
      if (p.type === 'day') {
        day = parseInt(p.value, 10);
      }
      if (p.type === 'month') {
        month = parseInt(p.value, 10);
      }
      // relatedYear is the numeric year (e.g., 2024), while year might be cyclic
      if ((p.type as string) === 'relatedYear') {
        year = parseInt(p.value, 10);
      } else if (p.type === 'year' && year === 0) {
        year = parseInt(p.value, 10);
      }
    });

    if (!day || !month || !year) {
       // Fallback for environments that return non-numeric despite the options
       throw new Error("Invalid Lunar Date Parts");
    }

    return { day, month, year };
  } catch (e) {
    // Fallback if Intl is not supported or fails
    // Note: This falls back to Solar date, which might be confusing but better than crashing
    return { day: date.getDate(), month: date.getMonth() + 1, year: date.getFullYear() };
  }
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
