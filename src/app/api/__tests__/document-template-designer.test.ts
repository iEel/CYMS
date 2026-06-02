import {
  addFieldFromBinding,
  addLineItemColumn,
  applyCalibrationProfileToConfig,
  applyFieldPatch,
  applyLineItemColumnPatch,
  applyLineItemsPatch,
  applyPaperPatchToConfig,
  canUseTemplateBinding,
  createDesignerHistory,
  moveLineItemColumn,
  nudgeField,
  pushDesignerHistory,
  redoDesignerHistory,
  snapMm,
  summarizeTemplateDiff,
  undoDesignerHistory,
  validateDesignerTemplateConfig,
} from '@/lib/documentTemplateDesigner';
import { normalizeTemplateCanvasConfig } from '@/lib/documentTemplateCanvas';
import { buildDefaultContinuousTemplateConfig as buildFallbackDefaultContinuousTemplateConfig } from '@/lib/documentTemplateDefaults';
import {
  buildDefaultContinuousTemplateConfig,
  normalizeTemplateConfig,
  parseStoredTemplateConfig,
} from '@/lib/documentTemplates';

function expectElementsInsidePaper(config: ReturnType<typeof normalizeTemplateCanvasConfig>) {
  expect(config.elements?.every(element => element.x_mm >= 0)).toBe(true);
  expect(config.elements?.every(element => element.y_mm >= 0)).toBe(true);
  expect(config.elements?.every(element => element.width_mm >= 1)).toBe(true);
  expect(config.elements?.every(element => element.height_mm >= 1)).toBe(true);
  expect(config.elements?.every(element => element.x_mm + element.width_mm <= config.paper.width_mm)).toBe(true);
  expect(config.elements?.every(element => element.y_mm + element.height_mm <= config.paper.height_mm)).toBe(true);
}

describe('document template designer helpers', () => {
  it('creates default continuous templates with full-form canvas elements', () => {
    const config = buildDefaultContinuousTemplateConfig();

    expect(config.elements?.map(element => element.element_id)).toEqual(expect.arrayContaining([
      'sonic-logo',
      'sonic-company-header',
      'sonic-copy-box',
      'sonic-customer-box',
      'sonic-line-items',
    ]));
  });

  it('creates fallback default continuous templates with full-form canvas elements', () => {
    const config = buildFallbackDefaultContinuousTemplateConfig();

    expect(config.elements?.map(element => element.element_id)).toEqual(expect.arrayContaining([
      'sonic-logo',
      'sonic-company-header',
      'sonic-copy-box',
      'sonic-customer-box',
      'sonic-line-items',
    ]));
  });

  it('normalizes stored legacy templates with generated canvas elements', () => {
    const config = buildDefaultContinuousTemplateConfig();
    const legacy = { ...config };
    delete (legacy as { elements?: unknown }).elements;

    const normalized = normalizeTemplateConfig(legacy).config;
    const parsed = parseStoredTemplateConfig(JSON.stringify(legacy));

    expect(normalized?.elements?.some(element => element.element_id === 'sonic-line-items')).toBe(true);
    expect(parsed?.elements?.some(element => element.element_id === 'sonic-line-items')).toBe(true);
  });

  it('normalizes legacy full-form templates into canvas elements', () => {
    const config = buildDefaultContinuousTemplateConfig();
    const legacy = { ...config };
    delete (legacy as { elements?: unknown }).elements;

    const normalized = normalizeTemplateCanvasConfig(legacy);

    expect(normalized.elements?.some(element => element.element_id === 'sonic-company-header')).toBe(true);
    expect(normalized.elements?.some(element => element.type === 'line_items')).toBe(true);
    expectElementsInsidePaper(normalized);
  });

  it('syncs line item element geometry when line item section geometry changes', () => {
    const config = buildDefaultContinuousTemplateConfig();
    const next = applyLineItemsPatch(config, {
      x_mm: 22,
      y_mm: 68,
      width_mm: 180,
      row_height_mm: 7,
      max_rows: 8,
    });
    const lineItems = next.sections.line_items;
    const element = next.elements?.find(item => item.type === 'line_items');

    expect(element).toMatchObject({
      x_mm: lineItems.x_mm,
      y_mm: lineItems.y_mm,
      width_mm: lineItems.width_mm,
      height_mm: (lineItems.start_y_mm - lineItems.y_mm) + lineItems.row_height_mm * lineItems.max_rows,
    });
  });

  it('does not persist generated line item elements for legacy configs during line item edits', () => {
    const config = buildDefaultContinuousTemplateConfig();
    const legacy = { ...config };
    delete (legacy as { elements?: unknown }).elements;

    const next = applyLineItemsPatch(legacy, { x_mm: 18 });

    expect(next.elements).toBeUndefined();
  });

  it('clamps default canvas elements into smaller custom paper', () => {
    const config = buildDefaultContinuousTemplateConfig();
    const legacy = {
      ...config,
      paper: {
        ...config.paper,
        width_mm: 90,
        height_mm: 80,
      },
    };
    delete (legacy as { elements?: unknown }).elements;

    const normalized = normalizeTemplateCanvasConfig(legacy);

    expectElementsInsidePaper(normalized);
    expect(normalized.elements?.find(element => element.element_id === 'sonic-copy-box')?.x_mm).toBeLessThan(90);
    expect(normalized.elements?.find(element => element.element_id === 'sonic-footer')?.y_mm).toBeLessThan(80);
  });

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

  it('returns structured errors for malformed configs without throwing', () => {
    expect(() => validateDesignerTemplateConfig({})).not.toThrow();
    expect(validateDesignerTemplateConfig({}).errors).toContain('paper must be an object');
  });

  it('rejects imported config with invalid field keys', () => {
    const config = buildDefaultContinuousTemplateConfig();
    const invalid = {
      ...config,
      fields: config.fields.map((field, index) => index === 0
        ? { ...field, binding_source: 'document.invoice_number', field_key: 'not.allowed' }
        : field),
    };

    expect(validateDesignerTemplateConfig(invalid).errors).toContain('field document-title field_key not.allowed is not allowed');
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

describe('document template designer 2.1 validation', () => {
  it('rejects duplicate line item column ids', () => {
    const config = buildDefaultContinuousTemplateConfig();
    config.sections.line_items.columns = [
      { column_id: 'description', field_key: 'description', label: 'Description', width_mm: 100, text_align: 'left', format: 'text' },
      { column_id: 'description', field_key: 'amount', label: 'Amount', width_mm: 30, text_align: 'right', format: 'currency:THB' },
    ];

    expect(validateDesignerTemplateConfig(config).errors).toContain('sections.line_items column_id description must be unique');
  });

  it('rejects line item columns that are not backed by lines[] bindings', () => {
    const config = buildDefaultContinuousTemplateConfig();
    config.sections.line_items.columns[0].field_key = 'invoice_number';

    expect(validateDesignerTemplateConfig(config).errors).toContain('sections.line_items column invoice_number is not allowed');
  });

  it('rejects bare line item field keys in persisted config', () => {
    const config = buildDefaultContinuousTemplateConfig();
    config.sections.line_items.columns[0].field_key = 'description';

    expect(validateDesignerTemplateConfig(config).errors).toContain('sections.line_items column description is not allowed');
  });

  it('persists added line item columns as lines bindings', () => {
    const config = buildDefaultContinuousTemplateConfig();
    config.sections.line_items.columns = config.sections.line_items.columns.filter(column => column.column_id !== 'amount');

    const next = addLineItemColumn(config, 'amount');

    expect(next.sections.line_items.columns.at(-1)?.field_key).toBe('lines[].amount');
  });

  it('clamps line item column width patches to the section width', () => {
    const config = buildDefaultContinuousTemplateConfig();

    const wide = applyLineItemColumnPatch(config, 'description', { width_mm: 999 });
    const narrow = applyLineItemColumnPatch(config, 'description', { width_mm: -10 });

    expect(wide.sections.line_items.columns[0].width_mm).toBe(config.sections.line_items.width_mm);
    expect(narrow.sections.line_items.columns[0].width_mm).toBe(1);
  });

  it('ignores unsafe line item column label patches', () => {
    const config = buildDefaultContinuousTemplateConfig();
    const next = applyLineItemColumnPatch(config, 'description', { label: '<script>alert(1)</script>' });

    expect(next.sections.line_items.columns[0].label).toBe(config.sections.line_items.columns[0].label);
  });

  it('ignores invalid line item column field key patches', () => {
    const config = buildDefaultContinuousTemplateConfig();
    const next = applyLineItemColumnPatch(config, 'description', { field_key: 'description' });

    expect(next.sections.line_items.columns[0].field_key).toBe('lines[].description');
  });

  it('moves line item columns with numeric directions', () => {
    const config = buildDefaultContinuousTemplateConfig();

    const movedLeft = moveLineItemColumn(config, 'amount', -1);
    const movedRight = moveLineItemColumn(movedLeft, 'amount', 1);

    expect(movedLeft.sections.line_items.columns.map(column => column.column_id)).toEqual([
      'description',
      'quantity',
      'amount',
      'unit_price',
    ]);
    expect(movedRight.sections.line_items.columns.map(column => column.column_id)).toEqual([
      'description',
      'quantity',
      'unit_price',
      'amount',
    ]);
  });

  it('rejects line item geometry outside strict numeric bounds', () => {
    const config = buildDefaultContinuousTemplateConfig();
    config.sections.line_items.width_mm = 10;
    config.sections.line_items.row_height_mm = 2;
    config.sections.line_items.max_rows = 1.5;

    const errors = validateDesignerTemplateConfig(config).errors;

    expect(errors).toContain('sections.line_items.width_mm must be between 20 and paper width');
    expect(errors).toContain('sections.line_items.row_height_mm must be between 4 and 20');
    expect(errors).toContain('sections.line_items.max_rows must be an integer between 1 and 50');
  });

  it('clamps line item row height to the print-safe minimum', () => {
    const config = buildDefaultContinuousTemplateConfig();
    const next = applyLineItemsPatch(config, { row_height_mm: 3 });

    expect(next.sections.line_items.row_height_mm).toBe(4);
    expect(next.sections.line_items.start_y_mm).toBe(next.sections.line_items.y_mm + 4);
  });

  it('rejects string paper metrics', () => {
    const config = buildDefaultContinuousTemplateConfig();
    const invalid = {
      ...config,
      paper: {
        ...config.paper,
        width_mm: '241.3',
      },
    };

    expect(validateDesignerTemplateConfig(invalid).errors).toContain('paper.width_mm must be greater than 0');
  });

  it('rejects string line item metrics', () => {
    const config = buildDefaultContinuousTemplateConfig();
    const invalid = {
      ...config,
      sections: {
        ...config.sections,
        line_items: {
          ...config.sections.line_items,
          width_mm: '222',
        },
      },
    };

    expect(validateDesignerTemplateConfig(invalid).errors).toContain('sections.line_items.width_mm must be between 20 and paper width');
  });

  it('rejects string line item column widths', () => {
    const config = buildDefaultContinuousTemplateConfig();
    const invalid = {
      ...config,
      sections: {
        ...config.sections,
        line_items: {
          ...config.sections.line_items,
          columns: config.sections.line_items.columns.map((column, index) => index === 0
            ? { ...column, width_mm: '120' }
            : column),
        },
      },
    };

    expect(validateDesignerTemplateConfig(invalid).errors).toContain('sections.line_items column description width_mm must be greater than 0');
  });

  it('rejects string calibration profile numeric values', () => {
    const config = buildDefaultContinuousTemplateConfig();
    const invalid = {
      ...config,
      calibration_profiles: [{
        profile_id: 'string-scale',
        profile_name: 'String Scale',
        paper_label: '9.5in x 5.5in',
        width_mm: 241.3,
        height_mm: 139.7,
        top_offset_mm: 0,
        left_offset_mm: 0,
        print_scale: '1',
      }],
    };

    expect(validateDesignerTemplateConfig(invalid).errors).toContain('calibration_profile string-scale print_scale must be greater than 0');
  });

  it('rejects line items when start y does not follow y plus row height', () => {
    const config = buildDefaultContinuousTemplateConfig();
    config.sections.line_items.start_y_mm = config.sections.line_items.y_mm;

    expect(validateDesignerTemplateConfig(config).errors).toContain('sections.line_items.start_y_mm must equal y_mm + row_height_mm');
  });

  it('accepts start y values that match rounded helper geometry', () => {
    const config = buildDefaultContinuousTemplateConfig();
    config.sections.line_items.y_mm = 55.1;
    config.sections.line_items.row_height_mm = 6.2;
    config.sections.line_items.start_y_mm = 61.3;

    expect(validateDesignerTemplateConfig(config).errors).not.toContain('sections.line_items.start_y_mm must equal y_mm + row_height_mm');
  });

  it('rejects tiny start y mismatches', () => {
    const config = buildDefaultContinuousTemplateConfig();
    config.sections.line_items.start_y_mm = config.sections.line_items.y_mm + config.sections.line_items.row_height_mm + 0.0005;

    expect(validateDesignerTemplateConfig(config).errors).toContain('sections.line_items.start_y_mm must equal y_mm + row_height_mm');
  });

  it('clamps line item movement to paper bounds', () => {
    const config = buildDefaultContinuousTemplateConfig();
    const moved = applyLineItemsPatch(config, { x_mm: 400, y_mm: 400 });
    const lineItemsHeight = (moved.sections.line_items.start_y_mm - moved.sections.line_items.y_mm)
      + moved.sections.line_items.row_height_mm * moved.sections.line_items.max_rows;

    expect(moved.sections.line_items.x_mm + moved.sections.line_items.width_mm).toBeLessThanOrEqual(moved.paper.width_mm);
    expect(moved.sections.line_items.y_mm + lineItemsHeight).toBeLessThanOrEqual(moved.paper.height_mm);
  });

  it('clamps line item movement using header plus row height', () => {
    const config = buildDefaultContinuousTemplateConfig();
    config.paper.height_mm = 64;
    config.sections.line_items.y_mm = 0;
    config.sections.line_items.row_height_mm = 10;
    config.sections.line_items.start_y_mm = 10;
    config.sections.line_items.max_rows = 5;

    const moved = applyLineItemsPatch(config, { y_mm: 10 });

    expect(moved.sections.line_items.y_mm).toBe(4);
    expect(moved.sections.line_items.y_mm
      + (moved.sections.line_items.start_y_mm - moved.sections.line_items.y_mm)
      + moved.sections.line_items.row_height_mm * moved.sections.line_items.max_rows).toBe(64);
  });

  it('rejects line item geometry outside paper using header plus row height', () => {
    const config = buildDefaultContinuousTemplateConfig();
    config.paper.height_mm = 64;
    config.sections.line_items.y_mm = 5;
    config.sections.line_items.row_height_mm = 10;
    config.sections.line_items.start_y_mm = 15;
    config.sections.line_items.max_rows = 5;

    expect(validateDesignerTemplateConfig(config).errors).toContain('sections.line_items exceeds paper height');
  });

  it('preserves valid line item geometry when patches contain non-finite numbers', () => {
    const config = buildDefaultContinuousTemplateConfig();
    const next = applyLineItemsPatch(config, {
      x_mm: Number.NaN,
      row_height_mm: Number.NaN,
      max_rows: Number.NaN,
    });

    expect(next.sections.line_items.x_mm).toBe(config.sections.line_items.x_mm);
    expect(next.sections.line_items.row_height_mm).toBe(config.sections.line_items.row_height_mm);
    expect(next.sections.line_items.max_rows).toBe(config.sections.line_items.max_rows);
    expect(Number.isNaN(next.sections.line_items.x_mm)).toBe(false);
    expect(Number.isNaN(next.sections.line_items.y_mm)).toBe(false);
    expect(Number.isNaN(next.sections.line_items.width_mm)).toBe(false);
    expect(Number.isNaN(next.sections.line_items.row_height_mm)).toBe(false);
    expect(Number.isNaN(next.sections.line_items.max_rows)).toBe(false);
    expect(Number.isNaN(next.sections.line_items.start_y_mm)).toBe(false);
  });

  it('clamps line item row count to keep the section inside paper bounds', () => {
    const config = buildDefaultContinuousTemplateConfig();
    const resized = applyLineItemsPatch(config, { row_height_mm: 20, max_rows: 50 });
    const lineItemsHeight = (resized.sections.line_items.start_y_mm - resized.sections.line_items.y_mm)
      + resized.sections.line_items.row_height_mm * resized.sections.line_items.max_rows;

    expect(resized.sections.line_items.y_mm + lineItemsHeight).toBeLessThanOrEqual(resized.paper.height_mm);
  });

  it('caps max rows using available height after the header band', () => {
    const config = buildDefaultContinuousTemplateConfig();
    config.paper.height_mm = 64;
    config.sections.line_items.y_mm = 0;
    config.sections.line_items.row_height_mm = 10;
    config.sections.line_items.start_y_mm = 10;

    const resized = applyLineItemsPatch(config, { max_rows: 50 });

    expect(resized.sections.line_items.max_rows).toBe(5);
  });

  it('applies a calibration profile to paper settings without changing profile data', () => {
    const config = buildDefaultContinuousTemplateConfig();
    const withProfile = {
      ...config,
      calibration_profiles: [{
        profile_id: 'epson-lq-310-95x55',
        profile_name: 'Epson LQ-310 9.5 x 5.5',
        paper_label: '9.5in x 5.5in',
        width_mm: 241.3,
        height_mm: 139.7,
        top_offset_mm: 2,
        left_offset_mm: 3,
        print_scale: 0.98,
        notes: 'Billing counter printer',
      }],
      default_calibration_profile_id: 'epson-lq-310-95x55',
    };

    const calibrated = applyCalibrationProfileToConfig(withProfile, 'epson-lq-310-95x55');

    expect(calibrated.paper.top_offset_mm).toBe(2);
    expect(calibrated.paper.left_offset_mm).toBe(3);
    expect(calibrated.paper.print_scale).toBe(0.98);
    expect(calibrated.calibration_profiles?.[0].profile_name).toBe('Epson LQ-310 9.5 x 5.5');
  });

  it('keeps direct A4 paper size edits valid by clamping layout into the new paper', () => {
    const config = buildDefaultContinuousTemplateConfig();

    const a4 = applyPaperPatchToConfig(config, {
      width_mm: 210,
      height_mm: 297,
    });
    const lineItems = a4.sections.line_items;

    expect(a4.paper.width_mm).toBe(210);
    expect(a4.paper.height_mm).toBe(297);
    expect(validateDesignerTemplateConfig(a4)).toEqual({ valid: true, errors: [] });
    expect(a4.fields.every(field => field.x_mm + field.width_mm <= a4.paper.width_mm)).toBe(true);
    expect(a4.fields.every(field => field.y_mm + field.height_mm <= a4.paper.height_mm)).toBe(true);
    expect(lineItems.x_mm + lineItems.width_mm).toBeLessThanOrEqual(a4.paper.width_mm);
  });

  it('keeps geometry valid when applying a smaller calibration profile', () => {
    const config = buildDefaultContinuousTemplateConfig();
    const withProfile = {
      ...config,
      fields: config.fields.map((field, index) => index === 0
        ? { ...field, x_mm: 225, y_mm: 120, width_mm: 16, height_mm: 10 }
        : field),
      sections: {
        ...config.sections,
        line_items: {
          ...config.sections.line_items,
          x_mm: 180,
          y_mm: 110,
          width_mm: 60,
          row_height_mm: 10,
          start_y_mm: 120,
          max_rows: 3,
        },
      },
      calibration_profiles: [{
        profile_id: 'small-paper',
        profile_name: 'Small paper',
        paper_label: '120 x 80mm',
        width_mm: 120,
        height_mm: 80,
        top_offset_mm: 0,
        left_offset_mm: 0,
        print_scale: 1,
      }],
    };

    const calibrated = applyCalibrationProfileToConfig(withProfile, 'small-paper');
    const lineItems = calibrated.sections.line_items;

    expect(validateDesignerTemplateConfig(calibrated)).toEqual({ valid: true, errors: [] });
    expect(calibrated.fields.every(field => field.x_mm + field.width_mm <= calibrated.paper.width_mm)).toBe(true);
    expect(calibrated.fields.every(field => field.y_mm + field.height_mm <= calibrated.paper.height_mm)).toBe(true);
    expect(lineItems.x_mm + lineItems.width_mm).toBeLessThanOrEqual(calibrated.paper.width_mm);
    expect(lineItems.y_mm + (lineItems.start_y_mm - lineItems.y_mm) + lineItems.row_height_mm * lineItems.max_rows).toBeLessThanOrEqual(calibrated.paper.height_mm);
  });

  it('keeps usable field size when calibration moves fields onto smaller paper', () => {
    const config = buildDefaultContinuousTemplateConfig();
    const withProfile = {
      ...config,
      fields: config.fields.map((field, index) => index === 0
        ? { ...field, x_mm: 180, y_mm: 130, width_mm: 40, height_mm: 20 }
        : field),
      calibration_profiles: [{
        profile_id: 'smaller-usable-paper',
        profile_name: 'Smaller usable paper',
        paper_label: '150 x 100mm',
        width_mm: 150,
        height_mm: 100,
        top_offset_mm: 0,
        left_offset_mm: 0,
        print_scale: 1,
      }],
    };

    const calibrated = applyCalibrationProfileToConfig(withProfile, 'smaller-usable-paper');
    const field = calibrated.fields[0];

    expect(field.x_mm + field.width_mm).toBeLessThanOrEqual(calibrated.paper.width_mm);
    expect(field.y_mm + field.height_mm).toBeLessThanOrEqual(calibrated.paper.height_mm);
    expect(field.width_mm).toBeGreaterThan(1);
    expect(field.height_mm).toBeGreaterThan(1);
  });

  it('rejects calibration profiles with zero positive dimensions or scale', () => {
    const config = buildDefaultContinuousTemplateConfig();
    const result = validateDesignerTemplateConfig({
      ...config,
      calibration_profiles: [{
        profile_id: 'zero-paper',
        profile_name: 'Zero Paper',
        paper_label: 'Zero',
        width_mm: 0,
        height_mm: 0,
        top_offset_mm: 0,
        left_offset_mm: 0,
        print_scale: 0,
      }],
    });

    expect(result.errors).toContain('calibration_profile zero-paper width_mm must be greater than 0');
    expect(result.errors).toContain('calibration_profile zero-paper height_mm must be greater than 0');
    expect(result.errors).toContain('calibration_profile zero-paper print_scale must be greater than 0');
  });

  it('rejects calibration profiles with missing required display text', () => {
    const config = buildDefaultContinuousTemplateConfig();
    const result = validateDesignerTemplateConfig({
      ...config,
      calibration_profiles: [{
        profile_id: 'missing-text',
        profile_name: '',
        paper_label: '',
        width_mm: 241.3,
        height_mm: 139.7,
        top_offset_mm: 0,
        left_offset_mm: 0,
        print_scale: 1,
      }],
    });

    expect(result.errors).toContain('calibration_profile missing-text profile_name is required');
    expect(result.errors).toContain('calibration_profile missing-text paper_label is required');
  });
});

describe('document template publish diff', () => {
  it('summarizes line item movement and field movement', () => {
    const before = buildDefaultContinuousTemplateConfig();
    const after = buildDefaultContinuousTemplateConfig();
    after.sections.line_items.x_mm += 5;
    after.fields[0].x_mm += 10;

    expect(summarizeTemplateDiff(before, after)).toEqual(expect.arrayContaining([
      'Line item section moved or resized',
      `Field moved/resized: ${after.fields[0].label}`,
    ]));
  });

  it('summarizes calibration profile changes', () => {
    const before = buildDefaultContinuousTemplateConfig();
    const after = buildDefaultContinuousTemplateConfig();
    after.calibration_profiles = [{
      profile_id: 'profile-a',
      profile_name: 'Printer A',
      paper_label: '9.5 x 5.5',
      width_mm: 241.3,
      height_mm: 139.7,
      top_offset_mm: 0,
      left_offset_mm: 0,
      print_scale: 1,
    }];

    expect(summarizeTemplateDiff(before, after)).toContain('Calibration profiles changed');
  });
});
