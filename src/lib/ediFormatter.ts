/**
 * EDI Formatter — Shared CODECO format generator
 * Supports template-based field mapping, custom headers, date formats, and delimiters.
 * Used by both codeco/route.ts (preview/download) and codeco/send/route.ts (delivery).
 */

export interface EDITemplate {
  template_id: number;
  template_name: string;
  base_format: 'csv' | 'json' | 'edifact';
  field_mapping: string | null; // JSON
  required_fields?: string | null; // JSON string[]
  csv_delimiter: string;
  csv_headers: string | null;
  date_format: string;
  edifact_version: string;
  edifact_sender: string | null;
  edifact_config?: string | null; // JSON rules for EDIFACT segment/qualifier variants
}

export interface CODECOTransaction {
  transaction_id: number;
  transaction_type: string;
  eir_number: string;
  driver_name: string;
  truck_plate: string;
  truck_company?: string;
  seal_number: string;
  booking_ref: string;
  transaction_date: string;
  container_number: string;
  size: string;
  container_type: string;
  container_grade?: string;
  condition?: string;
  shipping_line: string;
  is_laden: boolean;
  yard_name: string;
  yard_code: string;
}

interface FieldDef {
  source: string;
  header: string;
  enabled: boolean;
  format?: string;
}

interface FieldMapping {
  fields: FieldDef[];
}

interface EDIFACTConfig {
  bgm_code?: string;
  gate_in_function?: string;
  gate_out_function?: string;
  location_qualifier?: string;
  location_agency?: string;
  container_agency?: string;
  seal_issuer?: string;
  truck_mode?: string;
  include_driver?: boolean;
  include_truck_company?: boolean;
  include_condition?: boolean;
  include_grade?: boolean;
  include_booking?: boolean;
  free_text_qualifier?: string;
}

// ========== Date Formatters ==========

function formatDateStr(date: Date, fmt: string): string {
  const y4 = date.getFullYear().toString();
  const y2 = y4.slice(-2);
  const M = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const H = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');

  switch (fmt) {
    case 'YYYYMMDD': return `${y4}${M}${d}`;
    case 'YYMMDD:HHmm': return `${y2}${M}${d}:${H}${m}`;
    case 'DD/MM/YYYY': return `${d}/${M}/${y4}`;
    case 'DD/MM/YYYY HH:mm': return `${d}/${M}/${y4} ${H}:${m}`;
    case 'YYYY-MM-DD': return `${y4}-${M}-${d}`;
    case 'YYYY-MM-DD HH:mm': return `${y4}-${M}-${d} ${H}:${m}`;
    case 'ISO8601': return date.toISOString();
    case 'MM/DD/YYYY': return `${M}/${d}/${y4}`;
    case 'MM/DD/YYYY HH:mm': return `${M}/${d}/${y4} ${H}:${m}`;
    default: return `${d}/${M}/${y4} ${H}:${m}`;
  }
}

// ========== Field Value Resolver ==========

function resolveValue(tx: CODECOTransaction, field: FieldDef, dateFormat: string): string {
  const raw = (tx as unknown as Record<string, unknown>)[field.source];

  // Special format handlers
  if (field.format === 'laden_fe' || field.source === 'is_laden') {
    return tx.is_laden ? 'F' : 'E';
  }
  if (field.source === 'transaction_date' && raw) {
    return formatDateStr(new Date(raw as string), dateFormat);
  }
  if (raw === null || raw === undefined) return '';
  return String(raw);
}

// ========== Parse Field Mapping ==========

function parseFieldMapping(mappingJson: string | null): FieldMapping {
  if (!mappingJson) return getDefaultFieldMapping();
  try {
    const parsed = JSON.parse(mappingJson) as FieldMapping;
    const defaults = getDefaultFieldMapping().fields;
    const fields = Array.isArray(parsed.fields) ? parsed.fields : [];
    const missing = defaults.filter(df => !fields.some(f => f.source === df.source));
    return { fields: [...fields, ...missing] };
  } catch {
    return getDefaultFieldMapping();
  }
}

function getDefaultFieldMapping(): FieldMapping {
  return {
    fields: [
      { source: 'container_number', header: 'CONTAINER NO', enabled: true },
      { source: 'transaction_type', header: 'MOVE TYPE', enabled: true },
      { source: 'eir_number', header: 'EIR', enabled: true },
      { source: 'transaction_date', header: 'DATE', enabled: true },
      { source: 'size', header: 'SIZE', enabled: true },
      { source: 'container_type', header: 'TYPE', enabled: true },
      { source: 'shipping_line', header: 'SHIPPING LINE', enabled: true },
      { source: 'is_laden', header: 'F/E', format: 'laden_fe', enabled: true },
      { source: 'seal_number', header: 'SEAL', enabled: true },
      { source: 'truck_plate', header: 'TRUCK', enabled: true },
      { source: 'truck_company', header: 'TRUCK COMPANY', enabled: true },
      { source: 'driver_name', header: 'DRIVER', enabled: true },
      { source: 'booking_ref', header: 'BOOKING', enabled: true },
      { source: 'container_grade', header: 'GRADE', enabled: true },
      { source: 'condition', header: 'CONDITION', enabled: true },
      { source: 'yard_code', header: 'YARD', enabled: true },
    ],
  };
}

function parseStringArray(json: string | null | undefined, fallback: string[]): string[] {
  if (!json) return fallback;
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : fallback;
  } catch {
    return fallback;
  }
}

function parseEDIFACTConfig(json: string | null | undefined): EDIFACTConfig {
  if (!json) return {};
  try {
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === 'object' ? parsed as EDIFACTConfig : {};
  } catch {
    return {};
  }
}

export function getDefaultRequiredFields(): string[] {
  return [
    'container_number',
    'transaction_type',
    'eir_number',
    'transaction_date',
    'size',
    'container_type',
    'shipping_line',
    'yard_code',
  ];
}

export function validateCODECOTransactions(transactions: CODECOTransaction[], template: EDITemplate | null): {
  valid: boolean;
  errors: { transaction_id: number; container_number: string; field: string; message: string }[];
  required_fields: string[];
} {
  const requiredFields = parseStringArray(template?.required_fields, getDefaultRequiredFields());
  const errors: { transaction_id: number; container_number: string; field: string; message: string }[] = [];

  transactions.forEach(tx => {
    requiredFields.forEach(field => {
      const value = (tx as unknown as Record<string, unknown>)[field];
      if (value === null || value === undefined || String(value).trim() === '') {
        errors.push({
          transaction_id: tx.transaction_id,
          container_number: tx.container_number || '-',
          field,
          message: `รายการ ${tx.eir_number || tx.transaction_id} ขาดข้อมูล ${field}`,
        });
      }
    });
  });

  return { valid: errors.length === 0, errors, required_fields: requiredFields };
}

// ========== CSV Formatter ==========

function formatCSV(transactions: CODECOTransaction[], template: EDITemplate): string {
  const mapping = parseFieldMapping(template.field_mapping);
  const enabledFields = mapping.fields.filter(f => f.enabled);
  const delimiter = template.csv_delimiter || ',';
  const dateFormat = template.date_format || 'DD/MM/YYYY HH:mm';

  // Build header row
  const headerRow = enabledFields.map(f => f.header).join(delimiter);

  // Build data rows
  const dataRows = transactions.map(tx => {
    return enabledFields.map(f => {
      const val = resolveValue(tx, f, dateFormat);
      // Quote values containing delimiter or quotes
      if (val.includes(delimiter) || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    }).join(delimiter);
  });

  return [headerRow, ...dataRows].join('\n');
}

// ========== JSON Formatter ==========

function formatJSON(transactions: CODECOTransaction[], template: EDITemplate, companyName: string): string {
  const mapping = parseFieldMapping(template.field_mapping);
  const enabledFields = mapping.fields.filter(f => f.enabled);
  const dateFormat = template.date_format || 'ISO8601';

  const records = transactions.map(tx => {
    const obj: Record<string, string> = {};
    enabledFields.forEach(f => {
      obj[f.header] = resolveValue(tx, f, dateFormat);
    });
    return obj;
  });

  return JSON.stringify({
    message_type: 'CODECO',
    sender: companyName,
    generated_at: new Date().toISOString(),
    record_count: transactions.length,
    transactions: records,
  }, null, 2);
}

// ========== EDIFACT Formatter ==========

function formatEDIFACT(transactions: CODECOTransaction[], template: EDITemplate, companyName: string, shippingLine?: string): string {
  const now = new Date();
  const fmtDT = (d: Date) => {
    const y = d.getFullYear().toString().slice(-2);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${y}${m}${dd}:${hh}${mi}`;
  };

  const sender = template.edifact_sender || companyName.substring(0, 35);
  const version = template.edifact_version || 'D:95B:UN';
  const config = parseEDIFACTConfig(template.edifact_config);
  const msgRef = `CODECO${now.getTime()}`;

  const lines: string[] = [];
  // Interchange header
  lines.push(`UNB+UNOC:3+${sender}+${shippingLine || 'SHIPPING_LINE'}+${fmtDT(now)}+${msgRef}'`);
  // Message header
  lines.push(`UNH+1+CODECO:${version}'`);
  // Beginning of message
  lines.push(`BGM+${config.bgm_code || '36'}+${msgRef}+9'`);

  transactions.forEach(tx => {
    const txDate = new Date(tx.transaction_date);
    const giFn = tx.transaction_type === 'gate_in'
      ? (config.gate_in_function || '34')
      : (config.gate_out_function || '36');
    lines.push(`TDT+${giFn}'`);
    lines.push(`LOC+${config.location_qualifier || '89'}+${tx.yard_code || 'YARD'}:${config.location_agency || '139'}:6'`);
    lines.push(`DTM+137:${fmtDT(txDate)}:203'`);

    const sizeCode = tx.size === '40' ? '42' : tx.size === '45' ? '45' : '22';
    const typeCode = tx.container_type || 'GP';
    const isoType = typeCode === 'GP' || typeCode === 'HC' ? 'G1' : typeCode === 'RF' ? 'R1' : 'G1';
    lines.push(`EQD+CN+${tx.container_number}+${sizeCode}${isoType}:${config.container_agency || '102'}:5'`);
    lines.push(`MEA+AAE+VGM+KGM'`);
    if (tx.seal_number) lines.push(`SEL+${tx.seal_number}+${config.seal_issuer || 'CA'}'`);
    if (tx.truck_plate) lines.push(`TDT+1++${config.truck_mode || '3'}+++++${tx.truck_plate}'`);
    if (config.include_driver !== false && tx.driver_name) lines.push(`NAD+CA+${tx.driver_name}'`);
    if (config.include_truck_company && tx.truck_company) lines.push(`NAD+TR+${tx.truck_company}'`);
    if (config.include_booking !== false && tx.booking_ref) lines.push(`RFF+BN:${tx.booking_ref}'`);
    const freeText = [tx.is_laden ? 'LADEN' : 'EMPTY'];
    if (config.include_grade && tx.container_grade) freeText.push(`GRADE ${tx.container_grade}`);
    if (config.include_condition && tx.condition) freeText.push(tx.condition);
    lines.push(`FTX+${config.free_text_qualifier || 'AAA'}+++${freeText.join(' / ')}'`);
  });

  lines.push(`UNT+${lines.length - 1}+1'`);
  lines.push(`UNZ+1+${msgRef}'`);

  return lines.join('\n');
}

// ========== Main Entry Point ==========

export interface FormatResult {
  content: string;
  filename: string;
  contentType: string;
}

export function formatCODECO(
  transactions: CODECOTransaction[],
  template: EDITemplate | null,
  companyName: string,
  shippingLine?: string,
): FormatResult {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
  const suffix = now.getTime().toString().slice(-6);
  const slLabel = shippingLine || 'ALL';

  // If no template, create a default based on 'csv'
  const tpl: EDITemplate = template || {
    template_id: 0,
    template_name: 'Default CSV',
    base_format: 'csv',
    field_mapping: null,
    required_fields: JSON.stringify(getDefaultRequiredFields()),
    csv_delimiter: ',',
    csv_headers: null,
    date_format: 'DD/MM/YYYY HH:mm',
    edifact_version: 'D:95B:UN',
    edifact_sender: null,
    edifact_config: null,
  };

  let content: string;
  let ext: string;
  let contentType: string;

  switch (tpl.base_format) {
    case 'edifact':
      content = formatEDIFACT(transactions, tpl, companyName, shippingLine);
      ext = 'edi';
      contentType = 'text/plain; charset=utf-8';
      break;
    case 'json':
      content = formatJSON(transactions, tpl, companyName);
      ext = 'json';
      contentType = 'application/json; charset=utf-8';
      break;
    case 'csv':
    default:
      content = formatCSV(transactions, tpl);
      ext = 'csv';
      contentType = 'text/csv; charset=utf-8';
      break;
  }

  return {
    content,
    filename: `CODECO_${slLabel}_${dateStr}_${suffix}.${ext}`,
    contentType,
  };
}

/**
 * Build a default template from the legacy 'format' field (backward compat)
 */
export function legacyFormatToTemplate(format: string): EDITemplate {
  const base = format.toLowerCase() as 'csv' | 'json' | 'edifact';
  return {
    template_id: 0,
    template_name: `Legacy ${format}`,
    base_format: base === 'edifact' ? 'edifact' : base === 'json' ? 'json' : 'csv',
    field_mapping: null,
    required_fields: JSON.stringify(getDefaultRequiredFields()),
    csv_delimiter: ',',
    csv_headers: null,
    date_format: base === 'edifact' ? 'YYMMDD:HHmm' : base === 'json' ? 'ISO8601' : 'DD/MM/YYYY HH:mm',
    edifact_version: 'D:95B:UN',
    edifact_sender: null,
    edifact_config: null,
  };
}
