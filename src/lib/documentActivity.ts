export type DocumentActivityTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

export interface DocumentActivityItem {
  lifecycle_id: number;
  document_type: string;
  document_id: number | null;
  document_number: string | null;
  event_type: string;
  title: string;
  summary: string;
  tone: DocumentActivityTone;
  user_name: string;
  yard_name: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

const EVENT_LABELS: Record<string, { title: string; tone: DocumentActivityTone }> = {
  created: { title: 'สร้างเอกสาร', tone: 'info' },
  issued: { title: 'ออกเอกสาร', tone: 'success' },
  paid: { title: 'รับชำระเงิน', tone: 'success' },
  receipt_issued: { title: 'ออกใบเสร็จรับเงิน', tone: 'success' },
  cancelled: { title: 'ยกเลิกเอกสาร', tone: 'danger' },
  credit_note_created: { title: 'ออกใบลดหนี้', tone: 'warning' },
  cancelled_by_credit_note: { title: 'ยกเลิกด้วยใบลดหนี้', tone: 'warning' },
  partially_credited: { title: 'ลดหนี้บางส่วน', tone: 'warning' },
  revised_invoice_created: { title: 'ออกเอกสารใหม่', tone: 'info' },
  submitted: { title: 'ส่งเอกสารเข้ากระบวนการ', tone: 'info' },
  approved: { title: 'อนุมัติเอกสาร', tone: 'success' },
  rejected: { title: 'ไม่อนุมัติเอกสาร', tone: 'danger' },
};

function parseMetadata(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === 'object') return value as Record<string, unknown>;
  if (typeof value !== 'string') return null;
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function describeActivity(row: Record<string, unknown>, metadata: Record<string, unknown> | null) {
  const documentNumber = String(row.document_number || 'ไม่ระบุเลขเอกสาร');
  const eventType = String(row.event_type || '');
  const label = EVENT_LABELS[eventType] || { title: eventType || 'อัปเดตเอกสาร', tone: 'neutral' as const };
  const amount = metadata?.amount || metadata?.grand_total || metadata?.paid_amount || metadata?.credit_amount;
  const ref = metadata?.receipt_number || metadata?.credit_note_number || metadata?.revised_invoice_number;
  const parts = [`${label.title} ${documentNumber}`];

  if (ref) parts.push(`อ้างอิง ${ref}`);
  if (typeof amount === 'number') parts.push(`ยอด ${amount.toLocaleString('th-TH')} บาท`);

  return {
    title: label.title,
    summary: parts.join(' · '),
    tone: label.tone,
  };
}

export function formatDocumentActivity(rows: Array<Record<string, unknown>>): DocumentActivityItem[] {
  return rows.map(row => {
    const metadata = parseMetadata(row.metadata);
    const description = describeActivity(row, metadata);

    return {
      lifecycle_id: Number(row.lifecycle_id || 0),
      document_type: String(row.document_type || ''),
      document_id: row.document_id == null ? null : Number(row.document_id),
      document_number: row.document_number ? String(row.document_number) : null,
      event_type: String(row.event_type || ''),
      title: description.title,
      summary: description.summary,
      tone: description.tone,
      user_name: String(row.user_name || row.full_name || 'ระบบ'),
      yard_name: row.yard_name ? String(row.yard_name) : null,
      created_at: row.created_at ? new Date(row.created_at as string).toISOString() : new Date().toISOString(),
      metadata,
    };
  });
}
