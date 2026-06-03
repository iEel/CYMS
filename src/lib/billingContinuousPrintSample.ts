import { amountToThaiBahtText } from '@/lib/thaiBahtText';
import type { ContinuousPrintPayload } from './billingContinuousPrintTypes';

export type CompanyProfileSampleSource = Partial<{
  company_name: unknown;
  name: unknown;
  name_th: unknown;
  name_en: unknown;
  tax_id: unknown;
  address: unknown;
  address_th: unknown;
  address_en: unknown;
  phone: unknown;
  email: unknown;
  logo_url: unknown;
  branch_type: unknown;
  branch_number: unknown;
  yard_name: unknown;
  yard_code: unknown;
}>;

function sampleString(value: unknown, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value).trim() || fallback;
}

export function mergeCompanyProfileIntoContinuousPrintPayload(
  payload: ContinuousPrintPayload,
  companyProfile?: CompanyProfileSampleSource | null,
): ContinuousPrintPayload {
  if (!companyProfile) return payload;

  const companyName = sampleString(
    companyProfile.company_name ?? companyProfile.name_th ?? companyProfile.name,
    payload.company.company_name,
  );

  return {
    ...payload,
    company: {
      ...payload.company,
      name: companyName,
      company_name: companyName,
      name_th: sampleString(companyProfile.name_th ?? companyProfile.company_name, companyName),
      name_en: sampleString(companyProfile.name_en, ''),
      tax_id: sampleString(companyProfile.tax_id, payload.company.tax_id),
      address: sampleString(companyProfile.address, payload.company.address),
      address_th: sampleString(companyProfile.address_th ?? companyProfile.address, payload.company.address),
      address_en: sampleString(companyProfile.address_en, ''),
      phone: sampleString(companyProfile.phone, payload.company.phone),
      email: sampleString(companyProfile.email, payload.company.email),
      logo_url: sampleString(companyProfile.logo_url, ''),
      branch_type: sampleString(companyProfile.branch_type, payload.company.branch_type),
      branch_number: sampleString(companyProfile.branch_number, payload.company.branch_number),
      yard_name: sampleString(companyProfile.yard_name, payload.company.yard_name),
      yard_code: sampleString(companyProfile.yard_code, payload.company.yard_code),
    },
  };
}

export function buildSampleContinuousPrintPayload(companyProfile?: CompanyProfileSampleSource | null): ContinuousPrintPayload {
  const subtotal = 4094.5;
  const vatAmount = 286.61;
  const grandTotal = 4381.11;

  const payload: ContinuousPrintPayload = {
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

  return mergeCompanyProfileIntoContinuousPrintPayload(payload, companyProfile);
}
