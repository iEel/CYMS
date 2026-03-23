/**
 * Tests for utility functions
 * @module utils
 */

import {
  formatContainerNumber,
  getStatusColor,
  getStatusLabel,
} from '../utils';

// Note: formatDate, formatDateTime, formatTime, formatShortDate
// depend on locale and timezone, tested separately below

// ======================== formatContainerNumber ========================

describe('formatContainerNumber', () => {
  it('should format 11-char number as "XXXX 123456-7"', () => {
    expect(formatContainerNumber('MSCU6180951')).toBe('MSCU 618095-1');
  });

  it('should format another 11-char number', () => {
    expect(formatContainerNumber('MEDU3356435')).toBe('MEDU 335643-5');
  });

  it('should return original string if not 11 chars', () => {
    expect(formatContainerNumber('MSCU')).toBe('MSCU');
  });

  it('should return original for empty string', () => {
    expect(formatContainerNumber('')).toBe('');
  });

  it('should return original for 10-char string', () => {
    expect(formatContainerNumber('MSCU618095')).toBe('MSCU618095');
  });

  it('should return original for 12-char string', () => {
    expect(formatContainerNumber('MSCU61809512')).toBe('MSCU61809512');
  });
});

// ======================== getStatusColor ========================

describe('getStatusColor', () => {
  const expectedColors: Record<string, string> = {
    available: 'bg-emerald-500',
    in_yard: 'bg-blue-500',
    in_transit: 'bg-amber-500',
    under_repair: 'bg-rose-500',
    gated_out: 'bg-gray-400',
    pending: 'bg-amber-500',
    approved: 'bg-emerald-500',
    rejected: 'bg-rose-500',
    hold: 'bg-rose-600',
  };

  Object.entries(expectedColors).forEach(([status, color]) => {
    it(`should return "${color}" for status "${status}"`, () => {
      expect(getStatusColor(status)).toBe(color);
    });
  });

  it('should return gray for unknown status', () => {
    expect(getStatusColor('unknown_status')).toBe('bg-gray-400');
  });

  it('should return gray for empty string', () => {
    expect(getStatusColor('')).toBe('bg-gray-400');
  });
});

// ======================== getStatusLabel ========================

describe('getStatusLabel', () => {
  const expectedLabels: Record<string, string> = {
    available: 'พร้อมใช้งาน',
    in_yard: 'อยู่ในลาน',
    in_transit: 'กำลังขนส่ง',
    under_repair: 'กำลังซ่อม',
    gated_out: 'ออกจากลานแล้ว',
    pending: 'รอดำเนินการ',
    approved: 'อนุมัติแล้ว',
    rejected: 'ปฏิเสธ',
    hold: 'ระงับ',
  };

  Object.entries(expectedLabels).forEach(([status, label]) => {
    it(`should return Thai label for status "${status}"`, () => {
      expect(getStatusLabel(status)).toBe(label);
    });
  });

  it('should return input string for unknown status', () => {
    expect(getStatusLabel('custom_status')).toBe('custom_status');
  });

  it('should return empty string for empty input', () => {
    expect(getStatusLabel('')).toBe('');
  });
});
