import { amountToThaiBahtText } from '@/lib/thaiBahtText';

describe('amountToThaiBahtText', () => {
  it('formats an integer baht amount', () => {
    expect(amountToThaiBahtText(1070)).toBe('หนึ่งพันเจ็ดสิบบาทถ้วน');
  });

  it('formats baht and satang', () => {
    expect(amountToThaiBahtText(1234.56)).toBe('หนึ่งพันสองร้อยสามสิบสี่บาทห้าสิบหกสตางค์');
  });

  it('formats zero baht', () => {
    expect(amountToThaiBahtText(0)).toBe('ศูนย์บาทถ้วน');
  });

  it('formats negative amounts', () => {
    expect(amountToThaiBahtText(-250)).toBe('ลบสองร้อยห้าสิบบาทถ้วน');
  });
});
