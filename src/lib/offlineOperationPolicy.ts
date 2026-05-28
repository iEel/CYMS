export type OfflineOperationDecision = {
  allowed: boolean;
  reasonCode?: string;
  message: string;
};

export type OfflineOperationContext = {
  url?: string;
  method?: string;
};

const ALLOWED_OFFLINE_OPERATIONS = new Set([
  'gate_in',
  'gate_out',
  'gate_out_pickup_request',
  'photo_upload',
  'reefer_check',
  'yard_audit',
  'yard_audit_log',
  'yard_position_update',
  'yard_position_swap',
  'yard_position_float',
]);

const BLOCKED_OPERATION_REASONS: Record<string, string> = {
  invoice_create: 'งานออก invoice ต้องออนไลน์เพื่อคุมเลขเอกสารและยอดบัญชี',
  payment_capture: 'การรับชำระเงินต้องออนไลน์เพื่อป้องกันยอดซ้ำ',
  billing_clearance_approval: 'การอนุมัติ billing clearance ต้องออนไลน์',
  portal_visibility_change: 'การเปลี่ยนสิทธิ์ Portal ต้องออนไลน์และมี audit ทันที',
  customer_master_change: 'การแก้ข้อมูลลูกค้าต้องออนไลน์',
  document_template_publish: 'การ publish/import document template ต้องออนไลน์',
};

function inferBlockedReasonFromUrl(url?: string) {
  if (!url) return null;
  if (url.includes('/api/billing/')) return BLOCKED_OPERATION_REASONS.invoice_create;
  if (url.includes('/api/settings/') || url.includes('/api/customers/')) return BLOCKED_OPERATION_REASONS.customer_master_change;
  if (url.includes('/api/document-templates')) return BLOCKED_OPERATION_REASONS.document_template_publish;
  if (url.includes('/api/portal/grants') || url.includes('/api/portal/permissions')) return BLOCKED_OPERATION_REASONS.portal_visibility_change;
  return null;
}

export function canQueueOfflineOperation(
  operation?: string | null,
  context: OfflineOperationContext = {},
): OfflineOperationDecision {
  const normalizedOperation = String(operation || '').trim();

  if (!normalizedOperation) {
    return {
      allowed: false,
      reasonCode: 'missing_operation',
      message: 'ไม่สามารถบันทึกออฟไลน์ได้ เพราะไม่ได้ระบุชนิดงาน',
    };
  }

  if (ALLOWED_OFFLINE_OPERATIONS.has(normalizedOperation)) {
    return {
      allowed: true,
      message: 'งานนี้สามารถบันทึกเข้าคิวออฟไลน์ได้',
    };
  }

  const explicitReason = BLOCKED_OPERATION_REASONS[normalizedOperation];
  if (explicitReason) {
    return {
      allowed: false,
      reasonCode: normalizedOperation,
      message: explicitReason,
    };
  }

  const urlReason = inferBlockedReasonFromUrl(context.url);
  if (urlReason) {
    return {
      allowed: false,
      reasonCode: 'online_only_route',
      message: urlReason,
    };
  }

  return {
    allowed: false,
    reasonCode: 'not_allowlisted',
    message: 'งานนี้ยังไม่ได้อยู่ใน allowlist สำหรับออฟไลน์ กรุณาทำเมื่อออนไลน์',
  };
}

export function listAllowedOfflineOperations() {
  return Array.from(ALLOWED_OFFLINE_OPERATIONS).sort();
}
