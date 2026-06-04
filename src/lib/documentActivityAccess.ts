import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import type { RequestActor } from '@/lib/apiAuth';
import {
  isEntityAccessResponse,
  requireResolvedEntityYardAccess,
  resolveEntityScope,
  type EntityDb,
  type EntityScope,
  type EntityType,
} from '@/lib/entityAccessResolver';

export type DocumentActivityType = 'invoice' | 'receipt' | 'credit_note' | 'eir';

export type DocumentActivityLocator = {
  entityType: EntityType;
  entityId: number | null;
  entityRef: string | null;
  lifecycleDocumentType: DocumentActivityType;
};

export function inferDocumentActivityType(documentNumber: string | null | undefined): DocumentActivityType | null {
  const value = documentNumber?.trim().toUpperCase() || '';
  if (value.startsWith('EIR')) return 'eir';
  if (value.startsWith('INV')) return 'invoice';
  if (value.startsWith('CN')) return 'credit_note';
  if (value.startsWith('REC') || value.startsWith('RCP')) return 'receipt';
  return null;
}

export function normalizeDocumentActivityType(value: string | null | undefined): DocumentActivityType | null {
  const normalized = value?.trim().toLowerCase().replace(/-/g, '_') || '';
  if (normalized === 'tax_receipt') return 'receipt';
  if (
    normalized === 'invoice' ||
    normalized === 'receipt' ||
    normalized === 'credit_note' ||
    normalized === 'eir'
  ) {
    return normalized;
  }
  return null;
}

export function resolveDocumentActivityEntityLocator({
  documentType,
  documentId,
  documentNumber,
}: {
  documentType: DocumentActivityType;
  documentId: number | null;
  documentNumber: string | null;
}): DocumentActivityLocator {
  if (documentType === 'eir') {
    return {
      entityType: 'eir',
      entityId: documentId,
      entityRef: documentNumber,
      lifecycleDocumentType: 'eir',
    };
  }

  if (documentType === 'invoice') {
    return {
      entityType: 'invoice',
      entityId: documentId,
      entityRef: documentNumber,
      lifecycleDocumentType: 'invoice',
    };
  }

  return {
    entityType: 'invoice',
    entityId: null,
    entityRef: null,
    lifecycleDocumentType: documentType,
  };
}

async function resolveReceiptOrCreditNoteInvoiceScope({
  db,
  documentType,
  documentId,
  documentNumber,
}: {
  db: EntityDb;
  documentType: 'receipt' | 'credit_note';
  documentId: number | null;
  documentNumber: string | null;
}): Promise<EntityScope | NextResponse> {
  const result = await db.request()
    .input('documentType', sql.NVarChar(30), documentType)
    .input('documentId', sql.Int, documentId)
    .input('documentNumber', sql.NVarChar(80), documentNumber)
    .query(`
      SELECT TOP 1
        COALESCE(related_document_id, document_id) AS invoice_id,
        COALESCE(related_document_number, document_number) AS invoice_number
      FROM DocumentLifecycle
      WHERE document_type = @documentType
        AND (
          (@documentId IS NOT NULL AND document_id = @documentId)
          OR (@documentNumber IS NOT NULL AND document_number = @documentNumber)
        )
      ORDER BY created_at DESC, lifecycle_id DESC
    `);

  const row = result.recordset[0] as Record<string, unknown> | undefined;
  if (!row) {
    return NextResponse.json({ error: 'ไม่พบรายการเอกสารที่ต้องการดู Activity Feed' }, { status: 404 });
  }

  const invoiceId = Number(row.invoice_id);
  return resolveEntityScope({
    db,
    entityType: 'invoice',
    entityId: Number.isInteger(invoiceId) && invoiceId > 0 ? invoiceId : null,
    entityRef: typeof row.invoice_number === 'string' ? row.invoice_number : null,
  });
}

export async function requireDocumentActivityAccess({
  request,
  db,
  actor,
  documentType,
  documentId,
  documentNumber,
}: {
  request: NextRequest;
  db: EntityDb;
  actor: RequestActor;
  documentType: DocumentActivityType;
  documentId: number | null;
  documentNumber: string | null;
}) {
  const locator = resolveDocumentActivityEntityLocator({ documentType, documentId, documentNumber });
  const scope = documentType === 'receipt' || documentType === 'credit_note'
    ? await resolveReceiptOrCreditNoteInvoiceScope({ db, documentType, documentId, documentNumber })
    : await resolveEntityScope({
      db,
      entityType: locator.entityType,
      entityId: locator.entityId,
      entityRef: locator.entityRef,
    });

  if (isEntityAccessResponse(scope)) return scope;

  const access = await requireResolvedEntityYardAccess({
    request,
    db,
    actor,
    scope,
    message: 'คุณไม่มีสิทธิ์ดู Activity Feed เอกสารของลานนี้',
  });
  if (access instanceof NextResponse) return access;

  return {
    scope,
    lifecycleDocumentType: locator.lifecycleDocumentType,
  };
}
