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
  damage_report: {
    condition_grade: 'C',
    points: [{ side: 'left', type: 'dent', severity: 'major' }],
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
      },
    });
    expect(payload.eir).not.toHaveProperty('container_grade');
    expect(payload.eir).not.toHaveProperty('driver_name');
    expect(payload.eir).not.toHaveProperty('truck_plate');
    expect(payload.eir).not.toHaveProperty('damage_report');
    expect(payload.eir).not.toHaveProperty('invoice_amount');
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
