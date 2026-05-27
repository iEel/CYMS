import {
  addFieldFromBinding,
  applyFieldPatch,
  canUseTemplateBinding,
  createDesignerHistory,
  nudgeField,
  pushDesignerHistory,
  redoDesignerHistory,
  snapMm,
  undoDesignerHistory,
  validateDesignerTemplateConfig,
} from '@/lib/documentTemplateDesigner';
import { buildDefaultContinuousTemplateConfig } from '@/lib/documentTemplates';

describe('document template designer helpers', () => {
  it('snaps and nudges field geometry in mm without storing pixels', () => {
    const config = buildDefaultContinuousTemplateConfig();
    const moved = nudgeField(config, 'customer-name', { dxMm: 1.24, dyMm: -0.24, snapMm: 0.5 });

    const field = moved.fields.find(item => item.field_id === 'customer-name');
    expect(snapMm(1.24, 0.5)).toBe(1);
    expect(field?.x_mm).toBe(10);
    expect(field?.y_mm).toBe(36);
  });

  it('does not move, resize, or edit locked fields', () => {
    const config = buildDefaultContinuousTemplateConfig();
    const locked = {
      ...config,
      fields: config.fields.map((field, index) => index === 0 ? { ...field, locked: true } : field),
    };

    const moved = nudgeField(locked, locked.fields[0].field_id, { dxMm: 10, dyMm: 10, snapMm: 1 });
    const patched = applyFieldPatch(locked, locked.fields[0].field_id, { label: 'Changed' });

    expect(moved.fields[0]).toEqual(locked.fields[0]);
    expect(patched.fields[0]).toEqual(locked.fields[0]);
  });

  it('validates bindings against the continuous receipt allowlist', () => {
    expect(canUseTemplateBinding('customer.customer_name')).toBe(true);
    expect(canUseTemplateBinding('lines[].amount')).toBe(true);
    expect(canUseTemplateBinding('window.location')).toBe(false);
  });

  it('rejects imported config with invalid binding or fields outside the paper', () => {
    const config = buildDefaultContinuousTemplateConfig();
    const invalid = {
      ...config,
      fields: [
        {
          ...config.fields[0],
          binding_source: 'window.location',
        },
        {
          ...config.fields[1],
          field_id: 'outside-paper',
          x_mm: config.paper.width_mm - 2,
          width_mm: 10,
        },
      ],
    };

    const result = validateDesignerTemplateConfig(invalid);

    expect(result.valid).toBe(false);
    expect(result.errors.join('\n')).toContain('binding_source window.location is not allowed');
    expect(result.errors.join('\n')).toContain('outside-paper exceeds paper width');
  });

  it('adds a binding field with unique id and safe default geometry', () => {
    const config = buildDefaultContinuousTemplateConfig();
    const next = addFieldFromBinding(config, 'payment.cheque_no', { xMm: 20, yMm: 22 });

    const field = next.fields.find(item => item.binding_source === 'payment.cheque_no');
    expect(field).toMatchObject({
      field_key: 'payment.cheque_no',
      label: 'Cheque No',
      x_mm: 20,
      y_mm: 22,
      width_mm: 42,
      height_mm: 6,
      layer: 'data',
      locked: false,
    });
    expect(field?.field_id).toMatch(/^payment-cheque-no-/);
  });

  it('keeps undo and redo history in client state', () => {
    const config = buildDefaultContinuousTemplateConfig();
    const history = createDesignerHistory(config);
    const edited = applyFieldPatch(config, 'customer-name', { label: 'Buyer name' });
    const pushed = pushDesignerHistory(history, edited);
    const undone = undoDesignerHistory(pushed);
    const redone = redoDesignerHistory(undone);

    expect(undone.current.fields.find(field => field.field_id === 'customer-name')?.label).toBe('Customer name');
    expect(redone.current.fields.find(field => field.field_id === 'customer-name')?.label).toBe('Buyer name');
  });
});
