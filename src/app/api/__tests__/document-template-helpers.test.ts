import { buildDefaultContinuousTemplateConfig, validateTemplateConfig } from '@/lib/documentTemplates';

describe('document template helpers', () => {
  it('builds the default continuous tax invoice and receipt template config', () => {
    const config = buildDefaultContinuousTemplateConfig();

    expect(config.paper.width_mm).toBe(241.3);
    expect(config.paper.height_mm).toBe(139.7);
    expect(config.mode).toBe('full');
    expect(config.copy_mode).toBe('carbonless');
    expect(config.copy_labels).toHaveLength(5);
    expect(config.fields.some((field) => field.field_key === 'customer.customer_name')).toBe(true);
    expect(config.fields.some((field) => field.field_key === 'totals.grand_total')).toBe(true);
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
});
