/**
 * Tests for Zod validation schemas
 * @module validators
 */

import {
  containerNumberSchema,
  containerNumberLoose,
  containerSizeSchema,
  containerTypeSchema,
  dateSchema,
  paginationSchema,
  gateInSchema,
  gateOutSchema,
  invoiceCreateSchema,
  userCreateSchema,
  customerCreateSchema,
  ediEndpointSchema,
} from '../validators';

// ======================== containerNumberSchema ========================

describe('containerNumberSchema', () => {
  it('should accept valid container number MSCU1234567', () => {
    const result = containerNumberSchema.safeParse('MSCU1234567');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe('MSCU1234567');
  });

  it('should reject lowercase (regex requires uppercase)', () => {
    const result = containerNumberSchema.safeParse('mscu1234567');
    expect(result.success).toBe(false);
  });

  it('should reject too short', () => {
    const result = containerNumberSchema.safeParse('MSCU12345');
    expect(result.success).toBe(false);
  });

  it('should reject too long', () => {
    const result = containerNumberSchema.safeParse('MSCU12345678');
    expect(result.success).toBe(false);
  });

  it('should reject wrong format (no letters prefix)', () => {
    const result = containerNumberSchema.safeParse('12341234567');
    expect(result.success).toBe(false);
  });

  it('should reject format with letters in serial', () => {
    const result = containerNumberSchema.safeParse('MSCU123AB67');
    expect(result.success).toBe(false);
  });
});

// ======================== containerNumberLoose ========================

describe('containerNumberLoose', () => {
  it('should accept full container number', () => {
    const result = containerNumberLoose.safeParse('MSCU1234567');
    expect(result.success).toBe(true);
  });

  it('should accept partial (min 4 chars)', () => {
    const result = containerNumberLoose.safeParse('MSCU');
    expect(result.success).toBe(true);
  });

  it('should reject too short (< 4)', () => {
    const result = containerNumberLoose.safeParse('MS');
    expect(result.success).toBe(false);
  });

  it('should reject too long (> 15)', () => {
    const result = containerNumberLoose.safeParse('MSCU12345678901234');
    expect(result.success).toBe(false);
  });
});

// ======================== containerSizeSchema ========================

describe('containerSizeSchema', () => {
  it.each(['20', '40', '45'])('should accept size "%s"', (size) => {
    expect(containerSizeSchema.safeParse(size).success).toBe(true);
  });

  it('should reject invalid size', () => {
    expect(containerSizeSchema.safeParse('30').success).toBe(false);
  });
});

// ======================== containerTypeSchema ========================

describe('containerTypeSchema', () => {
  it.each(['dry', 'reefer', 'open_top', 'flat_rack', 'tank', 'other'])(
    'should accept type "%s"',
    (type) => {
      expect(containerTypeSchema.safeParse(type).success).toBe(true);
    }
  );

  it('should reject invalid type', () => {
    expect(containerTypeSchema.safeParse('invalid').success).toBe(false);
  });
});

// ======================== dateSchema ========================

describe('dateSchema', () => {
  it('should accept valid date YYYY-MM-DD', () => {
    expect(dateSchema.safeParse('2026-03-23').success).toBe(true);
  });

  it('should reject DD/MM/YYYY', () => {
    expect(dateSchema.safeParse('23/03/2026').success).toBe(false);
  });

  it('should reject invalid format', () => {
    expect(dateSchema.safeParse('2026-3-23').success).toBe(false);
  });
});

// ======================== paginationSchema ========================

describe('paginationSchema', () => {
  it('should use defaults when empty', () => {
    const result = paginationSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(50);
    }
  });

  it('should accept valid page and limit', () => {
    const result = paginationSchema.safeParse({ page: '3', limit: '25' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(3);
      expect(result.data.limit).toBe(25);
    }
  });

  it('should reject page < 1', () => {
    const result = paginationSchema.safeParse({ page: '0' });
    expect(result.success).toBe(false);
  });

  it('should reject limit > 500', () => {
    const result = paginationSchema.safeParse({ limit: '1000' });
    expect(result.success).toBe(false);
  });
});

// ======================== gateInSchema ========================

describe('gateInSchema', () => {
  const validGateIn = {
    transaction_type: 'gate_in' as const,
    container_number: 'MSCU1234567',
    yard_id: 1,
  };

  it('should accept valid gate-in payload (minimal)', () => {
    const result = gateInSchema.safeParse(validGateIn);
    expect(result.success).toBe(true);
  });

  it('should accept gate-in with all optional fields', () => {
    const result = gateInSchema.safeParse({
      ...validGateIn,
      size: '40',
      type: 'dry',
      shipping_line: 'EVERGREEN',
      seal_number: 'SEAL001',
      driver_name: 'John Doe',
      truck_plate: 'กท 1234',
      booking_ref: 'BK-001',
      zone_id: 1,
      bay: 5,
      row: 3,
      tier: 2,
      is_laden: true,
    });
    expect(result.success).toBe(true);
  });

  it('should reject wrong transaction_type', () => {
    const result = gateInSchema.safeParse({
      ...validGateIn,
      transaction_type: 'gate_out',
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing container_number', () => {
    const result = gateInSchema.safeParse({
      transaction_type: 'gate_in',
      yard_id: 1,
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing yard_id', () => {
    const result = gateInSchema.safeParse({
      transaction_type: 'gate_in',
      container_number: 'MSCU1234567',
    });
    expect(result.success).toBe(false);
  });
});

// ======================== gateOutSchema ========================

describe('gateOutSchema', () => {
  it('should accept valid gate-out payload', () => {
    const result = gateOutSchema.safeParse({
      transaction_type: 'gate_out',
      container_id: 1,
      yard_id: 1,
    });
    expect(result.success).toBe(true);
  });

  it('should reject negative container_id', () => {
    const result = gateOutSchema.safeParse({
      transaction_type: 'gate_out',
      container_id: -1,
      yard_id: 1,
    });
    expect(result.success).toBe(false);
  });

  it('should reject zero container_id', () => {
    const result = gateOutSchema.safeParse({
      transaction_type: 'gate_out',
      container_id: 0,
      yard_id: 1,
    });
    expect(result.success).toBe(false);
  });
});

// ======================== invoiceCreateSchema ========================

describe('invoiceCreateSchema', () => {
  it('should accept valid invoice', () => {
    const result = invoiceCreateSchema.safeParse({
      customer_name: 'Test Customer',
      subtotal: 1000,
      vat: 70,
      grand_total: 1070,
      status: 'draft',
    });
    expect(result.success).toBe(true);
  });

  it('should accept empty object (all optional)', () => {
    const result = invoiceCreateSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should reject invalid status', () => {
    const result = invoiceCreateSchema.safeParse({
      status: 'invalid_status',
    });
    expect(result.success).toBe(false);
  });

  it('should accept all valid statuses', () => {
    const statuses = ['draft', 'issued', 'paid', 'overdue', 'credit_note'];
    statuses.forEach((status) => {
      const result = invoiceCreateSchema.safeParse({ status });
      expect(result.success).toBe(true);
    });
  });

  it('should reject negative grand_total', () => {
    const result = invoiceCreateSchema.safeParse({ grand_total: -100 });
    expect(result.success).toBe(false);
  });
});

// ======================== userCreateSchema ========================

describe('userCreateSchema', () => {
  it('should accept valid user', () => {
    const result = userCreateSchema.safeParse({
      username: 'testuser',
      password: 'password123',
      full_name: 'Test User',
      role_id: 1,
    });
    expect(result.success).toBe(true);
  });

  it('should reject username shorter than 3 chars', () => {
    const result = userCreateSchema.safeParse({
      username: 'ab',
      full_name: 'Test',
      role_id: 1,
    });
    expect(result.success).toBe(false);
  });

  it('should reject password shorter than 6 chars', () => {
    const result = userCreateSchema.safeParse({
      username: 'testuser',
      password: '12345',
      full_name: 'Test',
      role_id: 1,
    });
    expect(result.success).toBe(false);
  });

  it('should accept without password (optional)', () => {
    const result = userCreateSchema.safeParse({
      username: 'testuser',
      full_name: 'Test User',
      role_id: 1,
    });
    expect(result.success).toBe(true);
  });

  it('should reject missing full_name', () => {
    const result = userCreateSchema.safeParse({
      username: 'testuser',
      role_id: 1,
    });
    expect(result.success).toBe(false);
  });
});

// ======================== customerCreateSchema ========================

describe('customerCreateSchema', () => {
  it('should accept valid customer', () => {
    const result = customerCreateSchema.safeParse({
      customer_name: 'Evergreen',
      customer_type: 'shipping_line',
      email: 'test@example.com',
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid email', () => {
    const result = customerCreateSchema.safeParse({
      customer_name: 'Test',
      email: 'not-an-email',
    });
    expect(result.success).toBe(false);
  });

  it('should accept empty email string', () => {
    const result = customerCreateSchema.safeParse({
      customer_name: 'Test',
      email: '',
    });
    expect(result.success).toBe(true);
  });

  it('should reject credit_term > 365', () => {
    const result = customerCreateSchema.safeParse({
      customer_name: 'Test',
      credit_term: 400,
    });
    expect(result.success).toBe(false);
  });

  it('should accept all valid customer types', () => {
    ['shipping_line', 'trucking', 'general'].forEach((type) => {
      const result = customerCreateSchema.safeParse({
        customer_name: 'Test',
        customer_type: type,
      });
      expect(result.success).toBe(true);
    });
  });
});

// ======================== ediEndpointSchema ========================

describe('ediEndpointSchema', () => {
  it('should accept valid SFTP endpoint', () => {
    const result = ediEndpointSchema.safeParse({
      name: 'Evergreen SFTP',
      host: 'sftp.evergreen.com',
      port: 22,
      type: 'sftp',
      format: 'EDIFACT',
    });
    expect(result.success).toBe(true);
  });

  it('should apply defaults (port=22, type=sftp, format=EDIFACT)', () => {
    const result = ediEndpointSchema.safeParse({
      name: 'Test',
      host: 'example.com',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.port).toBe(22);
      expect(result.data.type).toBe('sftp');
      expect(result.data.format).toBe('EDIFACT');
      expect(result.data.remote_path).toBe('/');
    }
  });

  it('should reject missing name', () => {
    const result = ediEndpointSchema.safeParse({
      host: 'example.com',
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing host', () => {
    const result = ediEndpointSchema.safeParse({
      name: 'Test',
    });
    expect(result.success).toBe(false);
  });

  it('should reject port > 65535', () => {
    const result = ediEndpointSchema.safeParse({
      name: 'Test',
      host: 'example.com',
      port: 70000,
    });
    expect(result.success).toBe(false);
  });

  it('should reject port < 1', () => {
    const result = ediEndpointSchema.safeParse({
      name: 'Test',
      host: 'example.com',
      port: 0,
    });
    expect(result.success).toBe(false);
  });

  it('should accept all valid types', () => {
    ['sftp', 'ftp', 'api'].forEach((type) => {
      const result = ediEndpointSchema.safeParse({
        name: 'Test',
        host: 'example.com',
        type,
      });
      expect(result.success).toBe(true);
    });
  });

  it('should accept all valid formats', () => {
    ['EDIFACT', 'CSV', 'JSON'].forEach((format) => {
      const result = ediEndpointSchema.safeParse({
        name: 'Test',
        host: 'example.com',
        format,
      });
      expect(result.success).toBe(true);
    });
  });
});
