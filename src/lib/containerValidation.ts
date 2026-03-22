/**
 * ISO 6346 Container Number Validation
 * Validates container numbers and calculates check digits
 */

// Character values per ISO 6346 (skip multiples of 11: 11, 22, 33)
const CHAR_VALUES: Record<string, number> = {
  'A': 10, 'B': 12, 'C': 13, 'D': 14, 'E': 15, 'F': 16, 'G': 17,
  'H': 18, 'I': 19, 'J': 20, 'K': 21, 'L': 23, 'M': 24, 'N': 25,
  'O': 26, 'P': 27, 'Q': 28, 'R': 29, 'S': 30, 'T': 31, 'U': 32,
  'V': 34, 'W': 35, 'X': 36, 'Y': 37, 'Z': 38,
  '0': 0, '1': 1, '2': 2, '3': 3, '4': 4,
  '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
};

/**
 * Calculate the check digit for the first 10 characters of a container number
 */
export function calculateCheckDigit(first10: string): number {
  if (first10.length !== 10) return -1;
  
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const ch = first10[i].toUpperCase();
    const value = CHAR_VALUES[ch];
    if (value === undefined) return -1;
    // Weight = 2^i
    sum += value * Math.pow(2, i);
  }
  
  const remainder = sum % 11;
  // If remainder is 10, check digit is 0
  return remainder === 10 ? 0 : remainder;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  checkDigit?: number;
  prefix?: string;       // First 4 chars (owner code)
  equipmentCat?: string; // 5th char (U/J/Z)
}

/**
 * Validate a full 11-character container number
 * Returns { valid, error?, checkDigit?, prefix? }
 */
export function validateContainerNumber(containerNo: string): ValidationResult {
  if (!containerNo) return { valid: false, error: 'กรุณากรอกเลขตู้' };
  
  const num = containerNo.toUpperCase().replace(/[\s-]/g, '');
  
  if (num.length < 11) {
    return { valid: false, error: 'เลขตู้ต้องมี 11 หลัก' };
  }
  
  if (num.length > 11) {
    return { valid: false, error: 'เลขตู้เกิน 11 หลัก' };
  }
  
  // Check format: 4 letters + 1 equipment category (U/J/Z) + 6 digits + 1 check digit
  const ownerCode = num.substring(0, 3);    // 3 letters
  const equipCat = num[3];                   // Equipment category letter
  const serial = num.substring(4, 10);       // 6 digits
  const checkDigitChar = num[10];            // Check digit
  
  // Owner code: 3 uppercase letters
  if (!/^[A-Z]{3}$/.test(ownerCode)) {
    return { valid: false, error: 'รหัสเจ้าของตู้ต้องเป็นตัวอักษร 3 ตัว' };
  }
  
  // Equipment category: U, J, or Z
  if (!['U', 'J', 'Z'].includes(equipCat)) {
    return { valid: false, error: 'ตัวที่ 4 ต้องเป็น U, J, หรือ Z' };
  }
  
  // Serial: 6 digits
  if (!/^\d{6}$/.test(serial)) {
    return { valid: false, error: 'หมายเลขซีเรียลต้องเป็นตัวเลข 6 หลัก' };
  }
  
  // Check digit: 1 digit
  if (!/^\d$/.test(checkDigitChar)) {
    return { valid: false, error: 'Check digit ต้องเป็นตัวเลข 1 หลัก' };
  }
  
  // Calculate and compare check digit
  const first10 = num.substring(0, 10);
  const expectedCheckDigit = calculateCheckDigit(first10);
  const actualCheckDigit = parseInt(checkDigitChar);
  
  if (expectedCheckDigit !== actualCheckDigit) {
    return {
      valid: false,
      error: `เลขตู้ไม่ถูกต้อง (Invalid Check Digit) — ค่าที่ถูกต้องคือ ${expectedCheckDigit}`,
      checkDigit: expectedCheckDigit,
      prefix: num.substring(0, 4),
      equipmentCat: equipCat,
    };
  }
  
  return {
    valid: true,
    checkDigit: expectedCheckDigit,
    prefix: num.substring(0, 4),
    equipmentCat: equipCat,
  };
}

/**
 * Parse ISO size/type code (group_st) to size and type
 * e.g. "22G1" → { size: "20", type: "GP" }
 *      "42G1" → { size: "40", type: "GP" }
 *      "45R1" → { size: "40", type: "RF" }
 */
export function parseSizeTypeCode(groupSt: string): { size: string; type: string } | null {
  if (!groupSt || groupSt.length < 2) return null;
  
  // First char = length code
  const lengthCode = groupSt[0];
  const sizeMap: Record<string, string> = {
    '2': '20', '3': '30', '4': '40', 'L': '45', 'M': '48',
  };
  
  // Second char = height + type group  
  // Third char = type detail
  const typeChar = groupSt.length >= 3 ? groupSt[2] : groupSt[1];
  const typeMap: Record<string, string> = {
    'G': 'GP', 'V': 'GP', 'R': 'RF', 'H': 'HC', 'U': 'OT',
    'T': 'TK', 'P': 'FR', 'B': 'GP', 'S': 'GP',
  };
  
  const size = sizeMap[lengthCode] || '20';
  const type = typeMap[typeChar] || 'GP';
  
  // Special: 45xx = 40' High Cube
  if (lengthCode === '4' && groupSt[1] === '5') {
    return { size: '40', type: 'HC' };
  }
  if (lengthCode === 'L') {
    return { size: '45', type: type };
  }
  
  return { size, type };
}
