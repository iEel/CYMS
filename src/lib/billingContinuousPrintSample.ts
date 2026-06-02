import { amountToThaiBahtText } from '@/lib/thaiBahtText';
import type { ContinuousPrintPayload } from './billingContinuousPrintTypes';

export function buildSampleContinuousPrintPayload(): ContinuousPrintPayload {
  const subtotal = 4094.5;
  const vatAmount = 286.61;
  const grandTotal = 4381.11;

  return {
    company: {
      name: 'บริษัท โซนิค อินเตอร์เฟรท จำกัด (มหาชน)',
      company_name: 'บริษัท โซนิค อินเตอร์เฟรท จำกัด (มหาชน)',
      name_th: 'บริษัท โซนิค อินเตอร์เฟรท จำกัด (มหาชน)',
      name_en: 'SONIC INTERFREIGHT PUBLIC COMPANY LIMITED',
      tax_id: '0107560000427',
      address: '509/10 หมู่ 3 ต.หนองขาม อ.ศรีราชา จ.ชลบุรี 20110',
      address_th: '509/10 หมู่ 3 ต.หนองขาม อ.ศรีราชา จ.ชลบุรี 20110',
      address_en: '509/10 MOO 3 NONG KHAM SUB-DISTRICT, SRI RACHA DISTRICT, CHONBURI 20110',
      phone: '',
      email: '',
      logo_url: '',
      branch_type: 'branch',
      branch_number: '00004',
      yard_name: 'Sonic Yard',
      yard_code: 'SONIC',
    },
    customer: {
      name: 'GLOBAL MARITIME (THAILAND) CO., LTD.',
      customer_name: 'GLOBAL MARITIME (THAILAND) CO., LTD.',
      tax_id: '0105564071815',
      address: '56/9-10 SOI SOMDET PHRACHAO TAKSIN 12/1, SOMDET PHRACHAO TAKSIN ROAD, BUKKHALO, THONBURI, BANGKOK 10600, THAILAND',
      branch_type: 'head_office',
      branch_number: '00000',
      branch_name: 'HEAD OFFICE',
    },
    document: {
      document_title: 'ใบกำกับภาษี/ใบเสร็จรับเงิน',
      document_type: 'sample',
      invoice_id: 7,
      invoice_number: 'P2603-0215',
      tax_invoice_number: 'P2603-0215',
      receipt_number: 'P2603-0215',
      document_number: 'P2603-0215',
      reference_no: 'P2603-0215',
      copy_label: 'ต้นฉบับใบกำกับภาษี/ใบเสร็จรับเงิน',
      issue_date: '2026-03-25T00:00:00.000Z',
      document_date: '2026-03-25T00:00:00.000Z',
      due_date: '',
      paid_at: '2026-03-25T00:00:00.000Z',
      status: 'paid',
      ref_invoice_number: 'P2603-0215',
      replaces_invoice_number: '',
    },
    lines: [
      {
        description: 'CONTAINER REPAIR CHARGES',
        qty: 1,
        unit_price: 3105,
        amount: 3105,
      },
      {
        description: 'DEPOT REFUND',
        qty: 1,
        unit_price: -110.5,
        amount: -110.5,
      },
      {
        description: 'DEPOT TRUCKING CHARGES',
        qty: 1,
        unit_price: 1100,
        amount: 1100,
        job_refs: ['CNSI26030029', 'INSI26021183', 'INSI26030239'],
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
      method: 'cash',
      status: 'paid',
      receipt_number: 'P2603-0215',
      paid_at: '2026-03-25T00:00:00.000Z',
      collector_name: 'KIT',
    },
  };
}
