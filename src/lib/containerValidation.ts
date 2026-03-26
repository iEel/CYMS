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
 * Extract a container number from raw OCR text.
 * Handles OCR noise like spaces, hyphens, O/0 confusion, I/1 confusion.
 * Returns the best candidate or null.
 */
export function extractContainerNumber(rawText: string): { value: string; confidence: 'high' | 'medium' | 'low' } | null {
  if (!rawText) return null;

  // Normalize: uppercase, collapse whitespace
  const text = rawText.toUpperCase().replace(/\s+/g, ' ').trim();

  // Strategy 1: Direct regex match — ISO 6346 pattern
  // Pattern: 3 letters + U/J/Z + 6 digits + 1 digit
  const directMatch = text.match(/\b([A-Z]{3}[UJZ])\s*[-]?\s*(\d{6})\s*[-]?\s*(\d)\b/);
  if (directMatch) {
    const candidate = `${directMatch[1]}${directMatch[2]}${directMatch[3]}`;
    if (candidate.length === 11) {
      const validation = validateContainerNumber(candidate);
      if (validation.valid) return { value: candidate, confidence: 'high' };
    }
  }

  // Strategy 2: OCR noise correction — O↔0, I↔1, S↔5, B↔8, G↔6
  const corrected = text
    .replace(/\bO(\d)/g, '0$1') // O before digit → 0
    .replace(/([A-Z]{4})\s*I(\d)/g, '$1 1$2') // I after 4 letters → 1
    .replace(/([A-Z]{3}[UJZ]\d{6})S\b/g, '$15') // trailing S → 5
    .replace(/([A-Z]{3}[UJZ]\d{6})B\b/g, '$18');

  // Look for all 11-char sequences that could be container numbers
  const candidates: string[] = [];
  
  // Remove all non-alphanumeric except spaces
  const cleaned = corrected.replace(/[^A-Z0-9 ]/g, ' ');
  
  // Find any word that looks like a container prefix (4 letters with U/J/Z as 4th)
  const prefixMatches = cleaned.match(/[A-Z]{3}[UJZ]/g) || [];
  
  for (const prefix of prefixMatches) {
    const prefixIdx = cleaned.indexOf(prefix);
    const after = cleaned.substring(prefixIdx + 4).replace(/\s/g, '');
    const digits = after.match(/^\d{7}/);
    if (digits) {
      candidates.push(`${prefix}${digits[0]}`);
    }
  }

  for (const candidate of candidates) {
    const validation = validateContainerNumber(candidate);
    if (validation.valid) return { value: candidate, confidence: 'high' };
  }

  // Strategy 3: Fuzzy — try check digit correction
  for (const candidate of candidates) {
    if (candidate.length === 11) {
      const first10 = candidate.substring(0, 10);
      const expectedCheck = calculateCheckDigit(first10);
      if (expectedCheck >= 0) {
        const fixed = `${first10}${expectedCheck}`;
        return { value: fixed, confidence: 'medium' };
      }
    }
  }

  // Strategy 4: Closest 11-char alphanumeric sequence (low confidence)
  const words = cleaned.split(/\s+/).filter(w => w.length >= 8);
  for (const word of words) {
    if (/^[A-Z]{3}[UJZ]\d/.test(word)) {
      const padded = `${word.substring(0, 10).padEnd(10, '0')}0`;
      const expectedCheck = calculateCheckDigit(padded.substring(0, 10));
      if (expectedCheck >= 0) {
        return { value: `${padded.substring(0, 10)}${expectedCheck}`, confidence: 'low' };
      }
    }
  }

  return null;
}

/**
 * Extract a Thai license plate from OCR text.
 * Formats like: 1กก 1234, กข 1234, 1กข-1234
 */
export function extractTruckPlate(rawText: string): string {
  if (!rawText) return '';
  const text = rawText.trim().replace(/\s+/g, ' ');
  // Just return cleaned upper-case — plates are hard to regex reliably across regions
  return text.replace(/[^ก-ฮA-Z0-9\s-]/g, '').trim().substring(0, 20);
}

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
