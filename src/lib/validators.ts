import { z } from 'zod';
import { NextResponse } from 'next/server';

// ======================== Common Schemas ========================

export const idSchema = z.number().int().positive('ID ต้องเป็นจำนวนเต็มบวก');
export const yardIdSchema = z.coerce.number().int().positive();

export const containerNumberSchema = z.string()
  .min(11, 'เลขตู้ต้องมีอย่างน้อย 11 ตัวอักษร')
  .max(11, 'เลขตู้ต้องมี 11 ตัวอักษร')
  .regex(/^[A-Z]{4}\d{7}$/, 'รูปแบบเลขตู้ไม่ถูกต้อง (ตัวอย่าง: MSCU1234567)')
  .transform(v => v.toUpperCase());

export const containerNumberLoose = z.string()
  .min(4, 'เลขตู้สั้นเกินไป')
  .max(15)
  .transform(v => v.toUpperCase());

export const containerSizeSchema = z.enum(['20', '40', '45'], {
  error: 'ขนาดตู้ต้องเป็น 20, 40 หรือ 45',
});

export const containerTypeSchema = z.enum(['dry', 'reefer', 'open_top', 'flat_rack', 'tank', 'other'], {
  error: 'ประเภทตู้ไม่ถูกต้อง',
});

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'รูปแบบวันที่ต้องเป็น YYYY-MM-DD');

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(50),
});

export const searchSchema = z.string().max(100).optional();

// ======================== Gate Schemas ========================

export const gateInSchema = z.object({
  transaction_type: z.literal('gate_in'),
  container_number: containerNumberLoose,
  size: containerSizeSchema.optional(),
  type: containerTypeSchema.optional(),
  shipping_line: z.string().max(50).optional(),
  seal_number: z.string().max(50).optional(),
  driver_name: z.string().max(100).optional(),
  truck_plate: z.string().max(20).optional(),
  booking_ref: z.string().max(50).optional(),
  yard_id: z.coerce.number().int().positive(),
  zone_id: z.coerce.number().int().positive().optional(),
  bay: z.coerce.number().int().min(0).optional(),
  row: z.coerce.number().int().min(0).optional(),
  tier: z.coerce.number().int().min(0).optional(),
  is_laden: z.boolean().optional(),
  damage_report: z.any().optional(),
  processed_by: z.number().int().optional(),
});

export const gateOutSchema = z.object({
  transaction_type: z.literal('gate_out'),
  container_id: idSchema,
  driver_name: z.string().max(100).optional(),
  truck_plate: z.string().max(20).optional(),
  yard_id: z.coerce.number().int().positive(),
  damage_report: z.any().optional(),
  processed_by: z.number().int().optional(),
});

// ======================== Billing Schemas ========================

export const invoiceCreateSchema = z.object({
  customer_id: z.number().int().optional().nullable(),
  customer_name: z.string().max(200).optional(),
  container_id: z.number().int().optional().nullable(),
  charge_type: z.string().max(50).optional(),
  subtotal: z.number().min(0).optional(),
  vat: z.number().min(0).optional(),
  grand_total: z.number().min(0).optional(),
  status: z.enum(['draft', 'issued', 'paid', 'overdue', 'credit_note']).optional(),
  notes: z.string().optional(),
  payment_method: z.string().max(20).optional(),
  yard_id: z.coerce.number().int().positive().optional(),
});

// ======================== Settings Schemas ========================

export const userCreateSchema = z.object({
  username: z.string().min(3, 'ชื่อผู้ใช้ต้องมีอย่างน้อย 3 ตัวอักษร').max(50),
  password: z.string().min(6, 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร').max(100).optional(),
  full_name: z.string().min(1, 'กรุณากรอกชื่อ-นามสกุล').max(100),
  role_id: z.number().int().positive(),
  yard_ids: z.array(z.number().int().positive()).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

export const customerCreateSchema = z.object({
  customer_name: z.string().min(1, 'กรุณากรอกชื่อลูกค้า').max(200),
  customer_type: z.enum(['shipping_line', 'trucking', 'general']).optional(),
  tax_id: z.string().max(20).optional(),
  address: z.string().max(500).optional(),
  contact_person: z.string().max(100).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email('อีเมลไม่ถูกต้อง').max(100).optional().or(z.literal('')),
  credit_term: z.coerce.number().int().min(0).max(365).optional(),
});

export const ediEndpointSchema = z.object({
  name: z.string().min(1).max(100),
  shipping_line: z.string().max(50).optional().nullable(),
  type: z.enum(['sftp', 'ftp', 'api']).default('sftp'),
  host: z.string().min(1, 'กรุณากรอก Host').max(255),
  port: z.coerce.number().int().min(1).max(65535).default(22),
  username: z.string().max(100).optional().nullable(),
  password: z.string().max(255).optional().nullable(),
  remote_path: z.string().max(255).default('/'),
  format: z.enum(['EDIFACT', 'CSV', 'JSON']).default('EDIFACT'),
});

// ======================== Validation Helper ========================

/**
 * Validate request body against a zod schema
 * Returns parsed data on success, or NextResponse with 400 on failure
 */
export function validateBody<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; response: NextResponse } {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
    return {
      success: false,
      response: NextResponse.json(
        { error: 'ข้อมูลไม่ถูกต้อง', details: errors },
        { status: 400 }
      ),
    };
  }
  return { success: true, data: result.data };
}

/**
 * Validate search params against a zod schema
 */
export function validateParams<T>(
  schema: z.ZodSchema<T>,
  params: Record<string, string | null>
): { success: true; data: T } | { success: false; response: NextResponse } {
  const result = schema.safeParse(params);
  if (!result.success) {
    const errors = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
    return {
      success: false,
      response: NextResponse.json(
        { error: 'พารามิเตอร์ไม่ถูกต้อง', details: errors },
        { status: 400 }
      ),
    };
  }
  return { success: true, data: result.data };
}
