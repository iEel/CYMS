import {
  buildDefaultContinuousTemplateConfig,
  normalizeTemplateConfig,
  parseStoredTemplateConfig,
  validateTemplateConfig,
} from '@/lib/documentTemplates';
import { buildDefaultContinuousTemplateConfig as buildDefaultFallbackTemplateConfig } from '@/lib/documentTemplateDefaults';
import { validateDesignerTemplateConfig } from '@/lib/documentTemplateDesigner';

describe('document template helpers', () => {
  it('builds the default continuous tax invoice and receipt template config', () => {
    const config = buildDefaultContinuousTemplateConfig();

    expect(config.paper.width_mm).toBe(241.3);
    expect(config.paper.height_mm).toBe(139.7);
    expect(config.paper.top_offset_mm).toBe(0);
    expect(config.paper.left_offset_mm).toBe(0);
    expect(config.paper.print_scale).toBe(1);
    expect(config.mode).toBe('full');
    expect(config.copy_mode).toBe('carbonless');
    expect(config.copy_labels).toHaveLength(5);
    expect(config.fields.some((field) => field.field_key === 'document.document_title')).toBe(true);
    expect(config.fields.some((field) => field.field_key === 'document.receipt_number')).toBe(true);
    expect(config.fields.some((field) => field.field_key === 'customer.customer_name')).toBe(true);
    expect(config.fields.some((field) => field.field_key === 'totals.grand_total')).toBe(true);
    expect(config.fields.some((field) => field.field_key === 'totals.amount_text_th')).toBe(true);
    expect(config.fields.find((field) => field.field_key === 'customer.customer_name')?.layer).toBe('data');
    expect(config.sections.line_items.start_y_mm).toBeGreaterThanOrEqual(0);
    expect(config.sections.line_items.columns.some((column) => column.field_key === 'lines[].qty')).toBe(true);
    expect(validateTemplateConfig(config)).toEqual({ valid: true, errors: [] });
  });

  it('rejects fields with negative x coordinates', () => {
    const config = buildDefaultContinuousTemplateConfig();
    const invalidConfig = {
      ...config,
      fields: config.fields.map((field, index) => (index === 0 ? { ...field, x_mm: -1 } : field)),
    };

    expect(validateTemplateConfig(invalidConfig).valid).toBe(false);
  });

  it('rejects invalid overlay calibration values', () => {
    const config = buildDefaultContinuousTemplateConfig();

    expect(validateTemplateConfig({ ...config, paper: { ...config.paper, print_scale: 0 } }).valid).toBe(false);
    expect(validateTemplateConfig({ ...config, paper: { ...config.paper, top_offset_mm: -1 } }).valid).toBe(false);
    expect(validateTemplateConfig({ ...config, paper: { ...config.paper, left_offset_mm: -1 } }).valid).toBe(false);
  });

  it('returns validation errors for malformed parsed JSON without throwing', () => {
    expect(() => validateTemplateConfig({})).not.toThrow();
    expect(validateTemplateConfig({}).valid).toBe(false);
  });

  it('keeps the preview fallback default compatible with designer validation', () => {
    const config = buildDefaultFallbackTemplateConfig();

    expect(config.sections.line_items.start_y_mm).toBe(
      config.sections.line_items.y_mm + config.sections.line_items.row_height_mm,
    );
    expect(validateDesignerTemplateConfig(config)).toEqual({ valid: true, errors: [] });
  });

  it('normalizes legacy stored line item start position before designer validation', () => {
    const config = buildDefaultContinuousTemplateConfig();
    const legacy = {
      ...config,
      sections: {
        ...config.sections,
        line_items: {
          ...config.sections.line_items,
          y_mm: 55.1,
          row_height_mm: 6.2,
          start_y_mm: 55.1,
        },
      },
      calibration_profiles: undefined,
      default_calibration_profile_id: undefined,
    };

    const parsed = parseStoredTemplateConfig(JSON.stringify(legacy));

    expect(parsed).not.toBeNull();
    expect(parsed?.sections.line_items.start_y_mm).toBe(61.3);
    expect(parsed?.calibration_profiles).toEqual([]);
    expect(parsed?.default_calibration_profile_id).toBeUndefined();
  });

  it('keeps raw config normalization strict for legacy line item start positions', () => {
    const config = buildDefaultContinuousTemplateConfig();
    const legacy = {
      ...config,
      sections: {
        ...config.sections,
        line_items: {
          ...config.sections.line_items,
          start_y_mm: config.sections.line_items.y_mm,
        },
      },
    };

    const result = normalizeTemplateConfig(legacy);

    expect(result.config).toBeNull();
    expect(result.errors).toContain('sections.line_items.start_y_mm must equal y_mm + row_height_mm');
  });

  it('allows duplicate field keys when field ids differ', () => {
    const config = buildDefaultContinuousTemplateConfig();
    const duplicateBindingConfig = {
      ...config,
      fields: [
        ...config.fields,
        {
          ...config.fields[0],
          field_id: 'document-title-copy',
        },
      ],
    };

    expect(validateTemplateConfig(duplicateBindingConfig)).toEqual({ valid: true, errors: [] });
  });

  it('rejects negative line item start positions', () => {
    const config = buildDefaultContinuousTemplateConfig();

    expect(
      validateTemplateConfig({
        ...config,
        sections: {
          ...config.sections,
          line_items: {
            ...config.sections.line_items,
            start_y_mm: -1,
          },
        },
      }).valid,
    ).toBe(false);
  });

  it('normalizes only designer-safe fields inside the paper bounds', () => {
    const config = buildDefaultContinuousTemplateConfig();
    const invalidConfig = {
      ...config,
      fields: config.fields.map((field, index) => index === 0
        ? {
          ...field,
          binding_source: 'document.cookie',
          x_mm: config.paper.width_mm - 2,
          width_mm: 10,
        }
        : field),
    };

    const result = normalizeTemplateConfig(invalidConfig);

    expect(result.config).toBeNull();
    expect(result.errors.join('\n')).toContain('binding_source document.cookie is not allowed');
    expect(result.errors.join('\n')).toContain('document-title exceeds paper width');
  });
});
