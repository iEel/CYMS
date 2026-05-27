import { amountToThaiBahtText } from '@/lib/thaiBahtText';
import type { ContinuousPrintPayload } from './billingContinuousPrintTypes';

export function buildSampleContinuousPrintPayload(): ContinuousPrintPayload {
  const subtotal = 1000;
  const vatAmount = 70;
  const grandTotal = 1070;

  return {
    company: {
      name: 'บริษัท ลานตู้คอนเทนเนอร์ จำกัด',
      company_name: 'บริษัท ลานตู้คอนเทนเนอร์ จำกัด',
      tax_id: '',
      address: '',
      phone: '',
      email: '',
      logo_url: '',
      branch_type: 'head_office',
      branch_number: '00000',
      yard_name: 'Bangkok Yard',
      yard_code: 'BKK',
    },
    customer: {
      name: 'ACME Logistics',
      customer_name: 'ACME Logistics',
      tax_id: '0105559000000',
      address: '99 Test Road, Bangkok',
      branch_type: 'head_office',
      branch_number: '00000',
      branch_name: 'สำนักงานใหญ่',
    },
    document: {
      document_title: 'ใบกำกับภาษี / ใบแจ้งหนี้',
      document_type: 'invoice',
      invoice_id: 7,
      invoice_number: 'INV-202605-000007',
      tax_invoice_number: 'INV-202605-000007',
      receipt_number: 'RCPT-202605-000007',
      document_number: 'INV-202605-000007',
      issue_date: '2026-05-26T00:00:00.000Z',
      document_date: '2026-05-26T00:00:00.000Z',
      due_date: '2026-06-25T00:00:00.000Z',
      paid_at: '',
      status: 'issued',
      ref_invoice_number: '',
      replaces_invoice_number: '',
    },
    lines: [
      {
        description: 'Storage charge',
        qty: 2,
        unit_price: 500,
        amount: subtotal,
        container_refs: ['TCLU1234567'],
      },
    ],
    totals: {
      subtotal,
      vat_rate: 0.07,
      vat_amount: vatAmount,
      grand_total: grandTotal,
      amount_text_th: amountToThaiBahtText(grandTotal),
    },
    payment: {
      method: '',
      status: 'issued',
      receipt_number: 'RCPT-202605-000007',
      paid_at: '',
    },
  };
}
