import React, { useRef, useEffect } from "react";
import { formatCurrency, parseCurrency, formatCurrencyInput } from "../../utils/formatters";

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: number | string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

/**
 * Component Input chuyên dụng cho tiền tệ
 * Giải quyết lỗi nhảy con trỏ về cuối khi thêm dấu phân cách hàng nghìn
 */
export const CurrencyInput: React.FC<CurrencyInputProps> = ({ 
  value, 
  onChange, 
  className = "", 
  ...props 
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const lastCursorInfo = useRef<{ pos: number; digitsBefore: number } | null>(null);

  const displayValue = formatCurrency(value);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const rawValue = input.value;
    const cursor = input.selectionStart || 0;
    
    // Đếm số lượng chữ số đứng trước con trỏ hiện tại
    const digitsBefore = rawValue.substring(0, cursor).replace(/\D/g, "").length;
    
    // Lưu thông tin để khôi phục sau khi React re-render
    lastCursorInfo.current = { pos: cursor, digitsBefore };

    // Tạo giá trị đã format
    const formattedValue = formatCurrencyInput(rawValue);
    
    // Giả lập sự kiện để tương thích với các logic onChange cũ
    const simulatedEvent = {
      ...e,
      target: {
        ...e.target,
        value: formattedValue,
        name: props.name || ""
      }
    } as React.ChangeEvent<HTMLInputElement>;

    onChange(simulatedEvent);
  };

  useEffect(() => {
    if (inputRef.current && lastCursorInfo.current) {
      const input = inputRef.current;
      const { digitsBefore } = lastCursorInfo.current;
      const currentValue = input.value;
      
      // Tìm vị trí mới sao cho số lượng chữ số phía trước vẫn giữ nguyên
      let newPos = 0;
      let digitsFound = 0;
      
      for (let i = 0; i < currentValue.length; i++) {
        if (/\d/.test(currentValue[i])) {
          digitsFound++;
        }
        newPos = i + 1;
        if (digitsFound === digitsBefore) break;
      }

      input.setSelectionRange(newPos, newPos);
      lastCursorInfo.current = null;
    }
  }, [displayValue]);

  return (
    <input
      ref={inputRef}
      type="text"
      value={displayValue}
      onChange={handleChange}
      className={className}
      {...props}
    />
  );
};