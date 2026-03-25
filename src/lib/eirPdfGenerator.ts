/**
 * Server-side EIR PDF Generator
 * ใช้ jsPDF สร้าง EIR PDF บน server สำหรับแนบกับ email
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { sarabunBase64 } from './sarabunFont';
import fs from 'fs';
import path from 'path';

const FONT_NAME = 'Sarabun';

// Load Bold font from filesystem
let boldBase64: string | null = null;
function getBoldFont(): string | null {
  if (boldBase64) return boldBase64;
  try {
    const fontPath = path.join(process.cwd(), 'public', 'fonts', 'Sarabun-Bold.ttf');
    const buffer = fs.readFileSync(fontPath);
    boldBase64 = buffer.toString('base64');
    return boldBase64;
  } catch {
    return null;
  }
}

export interface EIRData {
  eir_number: string;
  transaction_type: 'gate_in' | 'gate_out';
  container_number: string;
  size?: string;
  type?: string;
  shipping_line?: string;
  is_laden?: boolean;
  seal_number?: string;
  driver_name?: string;
  driver_license?: string;
  truck_plate?: string;
  booking_ref?: string;
  yard_name?: string;
  yard_code?: string;
  zone_name?: string;
  bay?: number;
  row?: number;
  tier?: number;
  processed_by?: string;
  notes?: string;
  date: string;
  company?: {
    company_name?: string;
    address?: string;
    phone?: string;
    tax_id?: string;
  };
}

export function generateEIRPDF(data: EIRData): Buffer {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  doc.addFileToVFS('Sarabun-Regular.ttf', sarabunBase64);
  doc.addFont('Sarabun-Regular.ttf', FONT_NAME, 'normal');

  // Register Bold font
  const bold = getBoldFont();
  if (bold) {
    doc.addFileToVFS('Sarabun-Bold.ttf', bold);
    doc.addFont('Sarabun-Bold.ttf', FONT_NAME, 'bold');
  }

  doc.setFont(FONT_NAME, 'normal');

  const pw = doc.internal.pageSize.getWidth();
  let y = 15;

  // ─── Header ───
  doc.setFont(FONT_NAME, bold ? 'bold' : 'normal');
  doc.setFontSize(16);
  doc.text(data.company?.company_name || 'CYMS - Container Yard', pw / 2, y, { align: 'center' });
  doc.setFont(FONT_NAME, 'normal');
  y += 6;
  if (data.company?.address) {
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(data.company.address, pw / 2, y, { align: 'center' });
    y += 4;
  }
  if (data.company?.phone) {
    doc.setFontSize(9);
    doc.text(`โทร: ${data.company.phone}`, pw / 2, y, { align: 'center' });
    y += 4;
  }
  doc.setTextColor(0);
  y += 4;

  // ─── Title ───
  const isIn = data.transaction_type === 'gate_in';
  doc.setFont(FONT_NAME, bold ? 'bold' : 'normal');
  doc.setFontSize(14);
  doc.text(`Equipment Interchange Receipt (EIR)`, pw / 2, y, { align: 'center' });
  y += 7;

  doc.setFontSize(12);
  const typeLabel = isIn ? '📥 Gate-In (รับเข้า)' : '📤 Gate-Out (ปล่อยออก)';
  doc.text(typeLabel, pw / 2, y, { align: 'center' });
  doc.setFont(FONT_NAME, 'normal');
  y += 8;

  // ─── EIR Number + Date ───
  doc.setFontSize(10);
  doc.text(`EIR No: ${data.eir_number}`, 14, y);
  doc.text(`Date: ${data.date}`, pw - 14, y, { align: 'right' });
  y += 8;

  // ─── Container Info ───
  const containerInfo = [
    ['Container No.', data.container_number || '-'],
    ['Size', data.size ? `${data.size}'` : '-'],
    ['Type', data.type || '-'],
    ['Shipping Line', data.shipping_line || '-'],
    ['Status', data.is_laden ? 'Laden (มีของ)' : 'Empty (เปล่า)'],
    ['Seal No.', data.seal_number || '-'],
  ];

  autoTable(doc, {
    startY: y,
    head: [['Container Information', '']],
    body: containerInfo,
    theme: 'grid',
    styles: { font: FONT_NAME, fontSize: 10, cellPadding: 3 },
    headStyles: { fontStyle: 'normal', fillColor: isIn ? [59, 130, 246] : [239, 68, 68], textColor: 255 },
    columnStyles: { 0: { cellWidth: 45, fontStyle: 'bold' as const } },
    margin: { left: 14, right: 14 },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 6;

  // ─── Location Info ───
  const locationInfo = [
    ['Yard', `${data.yard_name || '-'} ${data.yard_code ? `(${data.yard_code})` : ''}`],
    ['Zone', data.zone_name || '-'],
    ['Position', data.bay != null ? `Bay ${data.bay} / Row ${data.row} / Tier ${data.tier}` : '-'],
    ['Booking Ref', data.booking_ref || '-'],
  ];

  autoTable(doc, {
    startY: y,
    head: [['Location', '']],
    body: locationInfo,
    theme: 'grid',
    styles: { font: FONT_NAME, fontSize: 10, cellPadding: 3 },
    headStyles: { fontStyle: 'normal', fillColor: [16, 185, 129], textColor: 255 },
    columnStyles: { 0: { cellWidth: 45, fontStyle: 'bold' as const } },
    margin: { left: 14, right: 14 },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 6;

  // ─── Transport Info ───
  const transportInfo = [
    ['Driver', data.driver_name || '-'],
    ['License', data.driver_license || '-'],
    ['Truck Plate', data.truck_plate || '-'],
    ['Processed By', data.processed_by || '-'],
  ];

  autoTable(doc, {
    startY: y,
    head: [['Transport', '']],
    body: transportInfo,
    theme: 'grid',
    styles: { font: FONT_NAME, fontSize: 10, cellPadding: 3 },
    headStyles: { fontStyle: 'normal', fillColor: [245, 158, 11], textColor: 255 },
    columnStyles: { 0: { cellWidth: 45, fontStyle: 'bold' as const } },
    margin: { left: 14, right: 14 },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 6;

  // ─── Notes ───
  if (data.notes) {
    doc.setFontSize(10);
    doc.text('หมายเหตุ:', 14, y);
    y += 5;
    doc.setFontSize(9);
    doc.text(data.notes, 14, y, { maxWidth: pw - 28 });
    y += 10;
  }

  // ─── Signature Lines ───
  y = Math.max(y + 10, 230);
  doc.setFontSize(9);
  doc.setTextColor(100);
  const sigWidth = 55;
  const sigLeft = 45;
  const sigRight = pw - 45;
  doc.line(sigLeft - sigWidth / 2, y, sigLeft + sigWidth / 2, y);
  doc.text('ผู้ส่ง / Delivered by', sigLeft, y + 5, { align: 'center' });
  doc.line(sigRight - sigWidth / 2, y, sigRight + sigWidth / 2, y);
  doc.text('ผู้รับ / Received by', sigRight, y + 5, { align: 'center' });
  doc.setTextColor(0);

  // ─── Footer ───
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(`CYMS — EIR ${data.eir_number}`, pw / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' });

  // Return as Buffer (for email attachment)
  const arrayBuffer = doc.output('arraybuffer');
  return Buffer.from(arrayBuffer);
}
