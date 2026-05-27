const THAI_DIGITS = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
const THAI_UNITS = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน'];

function toFiniteNumber(input: number | string | null | undefined): number {
  if (typeof input === 'number') return Number.isFinite(input) ? input : 0;
  if (typeof input !== 'string') return 0;

  const normalized = input.replace(/,/g, '').trim();
  if (!normalized) return 0;

  const value = Number(normalized);
  return Number.isFinite(value) ? value : 0;
}

function chunkToThaiText(value: number): string {
  if (value === 0) return '';

  const digits = String(value);
  let result = '';

  for (let i = 0; i < digits.length; i += 1) {
    const digit = Number(digits[i]);
    const position = digits.length - 1 - i;

    if (digit === 0) continue;
    if (position === 1 && digit === 1) {
      result += 'สิบ';
      continue;
    }
    if (position === 1 && digit === 2) {
      result += 'ยี่สิบ';
      continue;
    }
    if (position === 0 && digit === 1 && digits.length > 1) {
      result += 'เอ็ด';
      continue;
    }

    result += THAI_DIGITS[digit] + THAI_UNITS[position];
  }

  return result;
}

function integerToThaiText(value: number): string {
  if (value === 0) return '';
  if (value < 1_000_000) return chunkToThaiText(value);

  const high = Math.floor(value / 1_000_000);
  const low = value % 1_000_000;

  return `${integerToThaiText(high)}ล้าน${chunkToThaiText(low)}`;
}

export function amountToThaiBahtText(input: number | string | null | undefined): string {
  let amount = toFiniteNumber(input);
  if (amount === 0) return 'ศูนย์บาทถ้วน';

  const prefix = amount < 0 ? 'ลบ' : '';
  amount = Math.abs(amount);

  let baht = Math.floor(amount);
  let satang = Math.round((amount - baht) * 100);
  if (satang === 100) {
    baht += 1;
    satang = 0;
  }

  let text = `${integerToThaiText(baht) || 'ศูนย์'}บาท`;
  if (satang > 0) {
    text += `${integerToThaiText(satang)}สตางค์`;
  } else {
    text += 'ถ้วน';
  }

  return prefix + text;
}
