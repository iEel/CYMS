import { deriveReeferEscalation } from '../reeferEscalation';

describe('deriveReeferEscalation', () => {
  const now = new Date('2026-05-22T08:00:00.000Z');

  it('marks critical exceptions as breached after 30 minutes', () => {
    const result = deriveReeferEscalation({
      severity: 'critical',
      status: 'open',
      created_at: '2026-05-22T07:20:00.000Z',
    }, now);

    expect(result).toEqual(expect.objectContaining({
      level: 'critical',
      breached: true,
      due_minutes: 30,
      age_minutes: 40,
      label: 'Critical escalation',
    }));
  });

  it('marks high severity open exceptions for supervisor after two hours', () => {
    const result = deriveReeferEscalation({
      severity: 'high',
      status: 'in_progress',
      created_at: '2026-05-22T05:30:00.000Z',
    }, now);

    expect(result).toEqual(expect.objectContaining({
      level: 'supervisor',
      breached: true,
      due_minutes: 120,
      age_minutes: 150,
    }));
  });

  it('does not escalate resolved exceptions', () => {
    const result = deriveReeferEscalation({
      severity: 'critical',
      status: 'resolved',
      created_at: '2026-05-22T05:30:00.000Z',
    }, now);

    expect(result).toEqual(expect.objectContaining({
      level: 'none',
      breached: false,
    }));
  });
});
