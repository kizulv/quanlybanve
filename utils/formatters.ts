
export const formatPhoneNumber = (value: string): string => {
  const raw = value.replace(/\D/g, "");
  if (raw.length > 15) return raw.slice(0, 15);
  if (raw.length > 7) {
    return `${raw.slice(0, 4)} ${raw.slice(4, 7)} ${raw.slice(7)}`;
  }
  if (raw.length > 4) {
    return `${raw.slice(0, 4)} ${raw.slice(4)}`;
  }
  return raw;
};

export const validatePhoneNumber = (phone: string): string | null => {
  const raw = phone.replace(/\D/g, "");
  if (raw.length === 0) return "Vui lòng nhập số điện thoại";
  if (!raw.startsWith("0")) return "SĐT phải bắt đầu bằng số 0";
  if (raw.length !== 10) return "SĐT phải đủ 10 số";
  return null;
};

export const getStandardizedLocation = (input: string): string => {
  if (!input) return "";
  let value = input.trim();
  const lower = value.toLowerCase();
  
  const mappings: Record<string, string> = {
    "lai chau": "BX Lai Châu",
    "lai châu": "BX Lai Châu",
    "ha tinh": "BX Hà Tĩnh",
    "hà tĩnh": "BX Hà Tĩnh",
    "lao cai": "BX Lào Cai",
    "vinh": "BX Vinh",
    "nghe an": "BX Vinh",
    "nghệ an": "BX Vinh",
  };
  
  if (mappings[lower]) return mappings[lower];

  // Nếu đã có chữ BX ở đầu thì chuẩn hóa viết hoa chữ BX
  if (/^bx\s/i.test(value)) {
    value = value.replace(/^bx\s/i, "BX ");
  } 
  // Nếu chưa có BX và là bến xe thì gợi ý thêm (logic cũ: tự động viết hoa chữ cái đầu)
  else if (value.length > 2) {
    // Không tự động thêm BX ở đây để tránh làm phiền người dùng, chỉ chuẩn hóa viết hoa
  }
  
  return value.replace(/(?:^|\s)\S/g, (a) => a.toUpperCase());
};
