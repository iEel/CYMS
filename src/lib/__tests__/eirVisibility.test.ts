import {
  buildEirViewPayload,
  canViewContainerGrade,
  maskPersonName,
  maskPhone,
  maskTruckPlate,
  sanitizeEirLifecycle,
} from '../eirVisibility';

const eirRow = {
  eir_number: 'EIR-IN-2026-000077',
  transaction_type: 'gate_in',
  created_at: '2026-05-21T08:00:00.000Z',
  gate_datetime: '2026-05-21T08:15:00.000Z',
  date: '2026-05-21T08:15:00.000Z',
  verification_status: 'verified',
  document_status: 'issued',
  version_no: 3,
  container_number: 'MSKU1234567',
  yard_name: 'Main Yard',
  yard_code: 'MYD',
  container_condition: 'damage',
  container_grade: 'C',
  container_grade_label: 'Cargo worthy',
  driver_name: 'Somchai Driver',
  driver_phone: '0812345678',
  truck_plate: '70-1234',
  truck_company: 'ACME Trucking',
  damage_summary: {
    condition: 'C',
    damage_points: 1,
  },
  damage_report: {
    condition_grade: 'C',
    inspector_notes: 'Internal handling note',
    photo_evidence: [{ url: 'https://example.test/private.jpg' }],
    photos: ['https://example.test/photo.jpg'],
    points: [
      {
        side: 'left',
        type: 'dent',
        severity: 'major',
        note: 'Panel dent',
        photo_url: 'https://example.test/point.jpg',
      },
    ],
  },
  invoice_amount: 1250,
};

describe('EIR visibility helpers', () => {
  it('masks sensitive contact and trucking fields for constrained views', () => {
    expect(maskPhone('0812345678')).toBe('081****678');
    expect(maskTruckPlate('70-1234')).toBe('70-****');
    expect(maskPersonName('Somchai Driver')).toBe('Somchai D.');
  });

  it('returns only minimal public verification fields and hides sensitive EIR fields', () => {
    const payload = buildEirViewPayload(eirRow, { viewType: 'public' });

    expect(payload).toEqual({
      eir: {
        eir_number: 'EIR-IN-2026-000077',
        transaction_type: 'gate_in',
        created_at: '2026-05-21T08:00:00.000Z',
        gate_datetime: '2026-05-21T08:15:00.000Z',
        date: '2026-05-21T08:15:00.000Z',
        verification_status: 'verified',
        document_status: 'issued',
        version_no: 3,
        container_number: 'MSKU1234567',
        yard_name: 'Main Yard',
        yard_code: 'MYD',
        container_condition: 'damage',
        damage_summary: {
          condition: 'damage',
          damage_points: 1,
        },
        copy_type_label: 'Public Verification Copy',
      },
    });
    expect(payload.eir).not.toHaveProperty('container_grade');
    expect(payload.eir).not.toHaveProperty('driver_name');
    expect(payload.eir).not.toHaveProperty('truck_plate');
    expect(payload.eir).not.toHaveProperty('damage_report');
    expect(payload.eir).not.toHaveProperty('invoice_amount');
  });

  it('does not leak raw public damage summary fields and keeps copy label serializable', () => {
    const payload = buildEirViewPayload(
      {
        ...eirRow,
        damage_summary: { secret: 'x' },
        damage_report: {
          condition_grade: 'B',
          points: [
            { side: 'front', type: 'scratch', severity: 'minor', photo_url: 'https://example.test/private.jpg' },
            { side: 'left', type: 'dent', severity: 'major', inspector_notes: 'private' },
          ],
        },
      },
      { viewType: 'public' },
    );

    expect(payload.eir.damage_summary).toEqual({
      condition: 'damage',
      damage_points: 2,
    });
    expect(payload.eir.damage_summary).not.toHaveProperty('secret');
    expect(payload.eir.damage_summary).not.toHaveProperty('condition_grade');
    expect(JSON.stringify(payload)).toContain('Public Verification Copy');
  });

  it('includes required public metadata without exposing grade-like damage condition values', () => {
    const payload = buildEirViewPayload(
      {
        ...eirRow,
        container_condition: 'sound',
        damage_summary: { condition: 'C', damage_points: 7, secret: 'internal' },
        damage_report: {
          condition_grade: 'C',
          inspector_notes: 'Internal handling note',
          points: [{ side: 'front', type: 'scratch', severity: 'minor' }],
        },
      },
      { viewType: 'public' },
    );

    expect(payload.eir).toMatchObject({
      yard_name: 'Main Yard',
      yard_code: 'MYD',
      gate_datetime: '2026-05-21T08:15:00.000Z',
      date: '2026-05-21T08:15:00.000Z',
      document_status: 'issued',
      version_no: 3,
      container_condition: 'sound',
      damage_summary: {
        condition: 'sound',
        damage_points: 1,
      },
    });
    expect(payload.eir.damage_summary).not.toHaveProperty('condition_grade');
    expect(payload.eir.damage_summary).not.toHaveProperty('secret');
    expect(payload.eir.damage_summary).not.toHaveProperty('inspector_notes');
    expect(payload.eir.damage_summary).not.toMatchObject({ condition: 'C' });
  });

  it('sanitizes customer damage report without exposing photos or internal notes', () => {
    const payload = buildEirViewPayload(eirRow, { viewType: 'customer' });

    expect(payload.eir.damage_report).toEqual({
      condition_grade: 'C',
      points: [{ side: 'left', type: 'dent', severity: 'major', note: 'Panel dent' }],
    });
    expect(payload.eir.damage_report).not.toBe(eirRow.damage_report);
    expect(payload.eir.damage_report).not.toHaveProperty('photo_evidence');
    expect(payload.eir.damage_report).not.toHaveProperty('photos');
    expect(payload.eir.damage_report).not.toHaveProperty('inspector_notes');
  });

  it('does not expose truck company to customer-like EIR views', () => {
    for (const viewType of ['customer', 'shipping_line', 'booking_customer', 'billing'] as const) {
      const payload = buildEirViewPayload(eirRow, { viewType });

      expect(payload.eir).not.toHaveProperty('truck_company');
      expect(payload.eir.driver_name).toBe('Somchai D.');
      expect(payload.eir.truck_plate).toBe('70-****');
    }
  });

  it('keeps truck company available for driver and trucking views', () => {
    expect(buildEirViewPayload(eirRow, { viewType: 'driver' }).eir).toMatchObject({
      truck_company: 'ACME Trucking',
      truck_plate: '70-1234',
    });
    expect(buildEirViewPayload(eirRow, { viewType: 'trucking' }).eir).toMatchObject({
      truck_company: 'ACME Trucking',
      truck_plate: '70-1234',
    });
  });

  it('sanitizes portal lifecycle events to the public-safe field set', () => {
    const lifecycle = sanitizeEirLifecycle([
      {
        lifecycle_id: 1,
        document_type: 'eir',
        document_number: 'EIR-IN-2026-000077',
        status: 'issued',
        action: 'created',
        event_type: 'issued',
        user_name: 'Operator',
        yard_name: 'Main Yard',
        created_at: '2026-05-21T08:00:00.000Z',
        reason: 'Internal dispute reason',
        details: '{"private":true}',
        internal_note: 'manager only',
        billing_clearance_id: 12,
      },
    ]);

    expect(lifecycle).toEqual([
      {
        lifecycle_id: 1,
        document_type: 'eir',
        document_number: 'EIR-IN-2026-000077',
        status: 'issued',
        action: 'created',
        event_type: 'issued',
        user_name: 'Operator',
        yard_name: 'Main Yard',
        created_at: '2026-05-21T08:00:00.000Z',
      },
    ]);
    expect(lifecycle[0]).not.toHaveProperty('reason');
    expect(lifecycle[0]).not.toHaveProperty('details');
    expect(lifecycle[0]).not.toHaveProperty('internal_note');
    expect(lifecycle[0]).not.toHaveProperty('billing_clearance_id');
  });

  it('does not show container grade to customers by default', () => {
    expect(canViewContainerGrade({ viewType: 'customer' })).toBe(false);

    const payload = buildEirViewPayload(eirRow, { viewType: 'customer' });

    expect(payload.eir).not.toHaveProperty('container_grade');
    expect(payload.eir).not.toHaveProperty('container_grade_label');
  });

  it('does not show customer container grade when the field grant scope is closed', () => {
    const viewContext = {
      viewType: 'customer' as const,
      permissions: ['portal.eir.view', 'portal.eir.grade.view'],
      permission_scope: {
        eir: {
          fields: {
            container_grade: false,
          },
        },
      },
    };

    expect(canViewContainerGrade(viewContext)).toBe(false);

    const payload = buildEirViewPayload(eirRow, viewContext);

    expect(payload.eir).not.toHaveProperty('container_grade');
    expect(payload.eir).not.toHaveProperty('container_grade_label');
  });

  it('shows customer container grade only with both permissions and an open field grant scope', () => {
    const viewContext = {
      viewType: 'customer' as const,
      permissions: ['portal.eir.view', 'portal.eir.grade.view'],
      permission_scope: {
        eir: {
          fields: {
            container_grade: true,
          },
        },
      },
    };

    expect(canViewContainerGrade(viewContext)).toBe(true);

    const payload = buildEirViewPayload(eirRow, viewContext);

    expect(payload.eir).toMatchObject({
      container_grade: 'C',
      container_grade_label: 'Cargo worthy',
    });
  });

  it('shows container grade internally but hides it from trucking and driver views', () => {
    expect(canViewContainerGrade({ viewType: 'internal' })).toBe(true);
    expect(canViewContainerGrade({ viewType: 'trucking' })).toBe(false);
    expect(canViewContainerGrade({ viewType: 'driver' })).toBe(false);

    expect(buildEirViewPayload(eirRow, { viewType: 'internal' }).eir).toMatchObject({
      container_grade: 'C',
      container_grade_label: 'Cargo worthy',
    });
    expect(buildEirViewPayload(eirRow, { viewType: 'trucking' }).eir).not.toHaveProperty('container_grade');
    expect(buildEirViewPayload(eirRow, { viewType: 'driver' }).eir).not.toHaveProperty('container_grade');
  });
});
