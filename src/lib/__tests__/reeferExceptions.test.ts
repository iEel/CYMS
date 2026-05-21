import { buildReeferExceptionDraft, nextReeferExceptionStatus } from '../reeferExceptions';

describe('reeferExceptions', () => {
  it('creates a high severity draft for out-of-range temperature checks', () => {
    const draft = buildReeferExceptionDraft({
      check_id: 555,
      container_id: 123,
      booking_id: 77,
      yard_id: 1,
      customer_id: 42,
      status: 'out_of_range',
      measured_temp_c: -14.5,
      policy_snapshot: JSON.stringify({ min_temp_c: -20, max_temp_c: -16 }),
    });

    expect(draft).toEqual(expect.objectContaining({
      severity: 'high',
      status: 'open',
      reason: 'temperature_out_of_range',
      recommended_action: 'ตรวจปลั๊กไฟ/เครื่อง reefer และแจ้ง supervisor',
    }));
  });

  it('does not create an exception draft for normal checks', () => {
    expect(buildReeferExceptionDraft({
      check_id: 556,
      container_id: 123,
      yard_id: 1,
      status: 'normal',
    })).toBeNull();
  });

  it('allows only supported operator transitions', () => {
    expect(nextReeferExceptionStatus('open', 'acknowledge')).toBe('in_progress');
    expect(nextReeferExceptionStatus('in_progress', 'resolve')).toBe('resolved');
    expect(nextReeferExceptionStatus('open', 'ignore')).toBe('ignored');
    expect(nextReeferExceptionStatus('resolved', 'acknowledge')).toBeNull();
  });
});
