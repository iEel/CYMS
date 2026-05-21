import { buildGateOperationalGuardrails, buildGateQrPass } from '../gateOperationalGuardrails';

describe('gate operational guardrails', () => {
  const now = new Date('2026-05-21T08:00:00.000Z');

  it('builds a deterministic appointment QR pass payload', () => {
    const pass = buildGateQrPass({
      mode: 'gate_in',
      container_number: 'msku1234567',
      booking_ref: 'bk-100',
      truck_plate: ' 1กก-1234 ',
      driver_name: 'Somchai',
      now,
      validForMinutes: 45,
    });

    expect(pass.pass_id).toBe('GI-MSKU1234567-BK-100-1กก1234');
    expect(pass.expires_at).toBe('2026-05-21T08:45:00.000Z');
    expect(JSON.parse(pass.qr_text)).toMatchObject({
      v: 1,
      mode: 'gate_in',
      container_number: 'MSKU1234567',
      booking_ref: 'BK-100',
      truck_plate: '1กก1234',
      driver_name: 'Somchai',
    });
  });

  it('flags duplicate seal and truck plate from recent gate transactions', () => {
    const snapshot = buildGateOperationalGuardrails({
      mode: 'gate_in',
      now,
      form: {
        container_number: 'MSKU1234567',
        seal_number: 'seal-001',
        truck_plate: '1กก 1234',
        driver_name: 'Somchai',
      },
      recentTransactions: [
        {
          transaction_id: 1,
          transaction_type: 'gate_in',
          container_number: 'TGHU7654321',
          seal_number: 'SEAL001',
          truck_plate: '1กก-1234',
          driver_name: 'Other driver',
          created_at: '2026-05-21T06:00:00.000Z',
          eir_number: 'EIR-IN-0001',
        },
      ],
    });

    expect(snapshot.alerts.map(alert => alert.key)).toEqual(
      expect.arrayContaining(['duplicate_seal_number', 'duplicate_truck_plate']),
    );
  });

  it('reports gate-in missing seal photo and inspection evidence gaps', () => {
    const snapshot = buildGateOperationalGuardrails({
      mode: 'gate_in',
      form: {
        container_number: 'MSKU1234567',
        truck_plate: '1กก 1234',
        driver_name: 'Somchai',
        is_laden: true,
      },
      sealPhotoCaptured: false,
      inspectionCompleteness: {
        required: 5,
        completed: 3,
        total: 3,
        missing_categories: ['ด้านซ้าย', 'ป้าย CSC / ข้อมูลตู้'],
      },
    });

    expect(snapshot.photo_status).toMatchObject({
      required: 6,
      completed: 3,
      ok: false,
    });
    expect(snapshot.alerts.map(alert => alert.key)).toEqual(
      expect.arrayContaining(['missing_seal_photo', 'missing_inspection_photos']),
    );
  });

  it('recommends exit photos before final gate-out release', () => {
    const snapshot = buildGateOperationalGuardrails({
      mode: 'gate_out',
      releasePhase: 'confirm_release',
      form: {
        container_number: 'MSKU1234567',
        truck_plate: '1กก 1234',
        driver_name: 'Somchai',
      },
      exitPhotosCount: 1,
    });

    expect(snapshot.photo_status).toMatchObject({
      required: 2,
      completed: 1,
      ok: false,
    });
    expect(snapshot.alerts.find(alert => alert.key === 'exit_photo_recommended')?.severity).toBe('warning');
  });
});
