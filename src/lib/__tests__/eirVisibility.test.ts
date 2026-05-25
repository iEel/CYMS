import {
  buildEirViewPayload,
  canViewContainerGrade,
  maskPersonName,
  maskPhone,
  maskTruckPlate,
} from '../eirVisibility';

const eirRow = {
  eir_number: 'EIR-IN-2026-000077',
  transaction_type: 'gate_in',
  created_at: '2026-05-21T08:00:00.000Z',
  verification_status: 'verified',
  container_number: 'MSKU1234567',
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
        verification_status: 'verified',
        container_number: 'MSKU1234567',
        damage_summary: {
          condition: 'C',
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
      condition: 'B',
      damage_points: 2,
    });
    expect(payload.eir.damage_summary).not.toHaveProperty('secret');
    expect(JSON.stringify(payload)).toContain('Public Verification Copy');
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
