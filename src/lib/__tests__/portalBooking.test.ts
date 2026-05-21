import { buildEmptyReturnInstruction, decoratePortalBooking, deriveBookingEtaStatus } from '../portalBooking';

describe('portal booking helpers', () => {
  const now = new Date('2026-05-21T08:00:00.000Z');

  it('labels booking ETA for portal-friendly urgency', () => {
    expect(deriveBookingEtaStatus('2026-05-21T12:00:00.000Z', 'confirmed', now)).toMatchObject({
      code: 'today',
      days: 0,
    });
    expect(deriveBookingEtaStatus('2026-05-24T12:00:00.000Z', 'confirmed', now)).toMatchObject({
      code: 'soon',
      days: 3,
    });
    expect(deriveBookingEtaStatus('2026-05-19T12:00:00.000Z', 'confirmed', now)).toMatchObject({
      code: 'overdue',
      days: -2,
    });
  });

  it('builds empty return instructions only for empty return bookings', () => {
    expect(buildEmptyReturnInstruction({ booking_type: 'export' })).toBeNull();

    const instruction = buildEmptyReturnInstruction({
      booking_type: 'empty_return',
      booking_number: 'BK-EMPTY-1',
      valid_to: '2026-05-25T00:00:00.000Z',
      vessel_name: 'CYMS STAR',
      voyage_number: 'V001',
    }, now);

    expect(instruction).toMatchObject({
      title: 'Empty Return Instruction',
      cut_off_status: 'open',
    });
    expect(instruction?.steps.join(' ')).toContain('BK-EMPTY-1');
    expect(instruction?.steps.join(' ')).toContain('CYMS STAR V001');
  });

  it('decorates booking rows with ETA and empty return fields', () => {
    const row = decoratePortalBooking({
      booking_id: 1,
      booking_number: 'BK-1',
      booking_type: 'empty_return',
      status: 'confirmed',
      eta: '2026-05-21T12:00:00.000Z',
      valid_to: '2026-05-25T00:00:00.000Z',
    }, now);

    expect(row.eta_status.code).toBe('today');
    expect(row.empty_return_instruction?.cut_off_status).toBe('open');
  });
});
