/**
 * Tests for ISO 6346 Container Number Validation
 * @module containerValidation
 */

import {
  calculateCheckDigit,
  validateContainerNumber,
  parseSizeTypeCode,
} from '../containerValidation';

// ======================== calculateCheckDigit ========================

describe('calculateCheckDigit', () => {
  it('should calculate correct check digit for MSCU618095 → 0', () => {
    expect(calculateCheckDigit('MSCU618095')).toBe(0);
  });

  it('should calculate correct check digit for CSQU305438 → 3', () => {
    expect(calculateCheckDigit('CSQU305438')).toBe(3);
  });

  it('should calculate correct check digit for MEDU335643 → 0', () => {
    expect(calculateCheckDigit('MEDU335643')).toBe(0);
  });

  it('should calculate correct check digit for TEMU840709 → 2', () => {
    expect(calculateCheckDigit('TEMU840709')).toBe(2);
  });

  it('should return -1 for input shorter than 10 chars', () => {
    expect(calculateCheckDigit('MSCU6180')).toBe(-1);
  });

  it('should return -1 for input longer than 10 chars', () => {
    expect(calculateCheckDigit('MSCU61809512')).toBe(-1);
  });

  it('should return -1 for invalid characters', () => {
    expect(calculateCheckDigit('MSC!618095')).toBe(-1);
  });

  it('should handle lowercase by converting to uppercase', () => {
    expect(calculateCheckDigit('mscu618095')).toBe(0);
  });
});

// ======================== validateContainerNumber ========================

describe('validateContainerNumber', () => {
  describe('valid container numbers', () => {
    it('should validate MSCU6180950 as valid (check digit 0)', () => {
      const result = validateContainerNumber('MSCU6180950');
      expect(result.valid).toBe(true);
      expect(result.checkDigit).toBe(0);
      expect(result.prefix).toBe('MSCU');
      expect(result.equipmentCat).toBe('U');
    });

    it('should validate CSQU3054383 as valid', () => {
      const result = validateContainerNumber('CSQU3054383');
      expect(result.valid).toBe(true);
      expect(result.checkDigit).toBe(3);
      expect(result.prefix).toBe('CSQU');
    });

    it('should validate lowercase input', () => {
      const result = validateContainerNumber('mscu6180950');
      expect(result.valid).toBe(true);
    });

    it('should strip spaces and dashes', () => {
      const result = validateContainerNumber('MSCU 618095-0');
      expect(result.valid).toBe(true);
    });

    it('should accept J equipment category', () => {
      const result = validateContainerNumber('ABCJ1234563');
      expect(result.equipmentCat).toBe('J');
    });

    it('should accept Z equipment category', () => {
      const result = validateContainerNumber('ABCZ1234564');
      expect(result.equipmentCat).toBe('Z');
    });
  });

  describe('invalid container numbers', () => {
    it('should reject empty input', () => {
      const result = validateContainerNumber('');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('กรุณากรอก');
    });

    it('should reject input shorter than 11 chars', () => {
      const result = validateContainerNumber('MSCU61809');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('11 หลัก');
    });

    it('should reject input longer than 11 chars', () => {
      const result = validateContainerNumber('MSCU618095123');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('เกิน 11 หลัก');
    });

    it('should reject owner code with digits', () => {
      const result = validateContainerNumber('M1CU6180950');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('ตัวอักษร 3 ตัว');
    });

    it('should reject invalid equipment category (not U/J/Z)', () => {
      const result = validateContainerNumber('MSCA6180950');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('U, J, หรือ Z');
    });

    it('should reject non-digit serial number', () => {
      const result = validateContainerNumber('MSCU61AB950');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('ตัวเลข 6 หลัก');
    });

    it('should reject wrong check digit', () => {
      // MSCU618095 correct check digit is 0, we pass 1
      const result = validateContainerNumber('MSCU6180951');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid Check Digit');
      expect(result.checkDigit).toBe(0);
      expect(result.prefix).toBe('MSCU');
    });
  });
});

// ======================== parseSizeTypeCode ========================

describe('parseSizeTypeCode', () => {
  it('should parse 22G1 → 20/GP', () => {
    expect(parseSizeTypeCode('22G1')).toEqual({ size: '20', type: 'GP' });
  });

  it('should parse 42G1 → 40/GP', () => {
    expect(parseSizeTypeCode('42G1')).toEqual({ size: '40', type: 'GP' });
  });

  it('should parse 45R1 → 40/HC (45xx special case)', () => {
    expect(parseSizeTypeCode('45R1')).toEqual({ size: '40', type: 'HC' });
  });

  it('should parse 22R1 → 20/RF (reefer)', () => {
    expect(parseSizeTypeCode('22R1')).toEqual({ size: '20', type: 'RF' });
  });

  it('should parse 42R1 → 40/RF (reefer)', () => {
    expect(parseSizeTypeCode('42R1')).toEqual({ size: '40', type: 'RF' });
  });

  it('should parse L5R1 → 45/RF (45-foot)', () => {
    expect(parseSizeTypeCode('L5R1')).toEqual({ size: '45', type: 'RF' });
  });

  it('should parse 42U1 → 40/OT (open top)', () => {
    expect(parseSizeTypeCode('42U1')).toEqual({ size: '40', type: 'OT' });
  });

  it('should parse 42T1 → 40/TK (tank)', () => {
    expect(parseSizeTypeCode('42T1')).toEqual({ size: '40', type: 'TK' });
  });

  it('should parse 42P1 → 40/FR (flat rack)', () => {
    expect(parseSizeTypeCode('42P1')).toEqual({ size: '40', type: 'FR' });
  });

  it('should return null for empty string', () => {
    expect(parseSizeTypeCode('')).toBeNull();
  });

  it('should return null for single character', () => {
    expect(parseSizeTypeCode('2')).toBeNull();
  });

  it('should default to 20/GP for unknown codes', () => {
    const result = parseSizeTypeCode('99X9');
    expect(result).toEqual({ size: '20', type: 'GP' });
  });
});
