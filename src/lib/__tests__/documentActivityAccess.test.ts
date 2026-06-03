jest.mock('@/lib/apiAuth', () => ({
  requireYardAccess: jest.fn(),
}));

import {
  inferDocumentActivityType,
  normalizeDocumentActivityType,
  resolveDocumentActivityEntityLocator,
} from '../documentActivityAccess';

describe('document activity access helper', () => {
  it.each([
    ['INV-001', 'invoice'],
    ['RCP-001', 'receipt'],
    ['REC-001', 'receipt'],
    ['CN-001', 'credit_note'],
    ['EIR-001', 'eir'],
  ])('infers %s as %s', (documentNumber, expected) => {
    expect(inferDocumentActivityType(documentNumber)).toBe(expected);
  });

  it.each([
    ['invoice', 'invoice'],
    ['receipt', 'receipt'],
    ['tax_receipt', 'receipt'],
    ['credit_note', 'credit_note'],
    ['credit-note', 'credit_note'],
    ['eir', 'eir'],
  ])('normalizes %s as %s', (input, expected) => {
    expect(normalizeDocumentActivityType(input)).toBe(expected);
  });

  it('maps invoice documents to invoice entity resolver locators', () => {
    expect(resolveDocumentActivityEntityLocator({
      documentType: 'invoice',
      documentId: 10,
      documentNumber: 'INV-001',
    })).toEqual({
      entityType: 'invoice',
      entityId: 10,
      entityRef: 'INV-001',
      lifecycleDocumentType: 'invoice',
    });
  });

  it('maps EIR documents to the EIR resolver locator', () => {
    expect(resolveDocumentActivityEntityLocator({
      documentType: 'eir',
      documentId: null,
      documentNumber: 'EIR-001',
    })).toEqual({
      entityType: 'eir',
      entityId: null,
      entityRef: 'EIR-001',
      lifecycleDocumentType: 'eir',
    });
  });

  it('keeps receipt and credit note lifecycle types while resolving through invoice access', () => {
    expect(resolveDocumentActivityEntityLocator({
      documentType: 'receipt',
      documentId: 15,
      documentNumber: 'RCP-001',
    })).toMatchObject({
      entityType: 'invoice',
      entityId: null,
      entityRef: null,
      lifecycleDocumentType: 'receipt',
    });

    expect(resolveDocumentActivityEntityLocator({
      documentType: 'credit_note',
      documentId: 16,
      documentNumber: 'CN-001',
    })).toMatchObject({
      entityType: 'invoice',
      entityId: null,
      entityRef: null,
      lifecycleDocumentType: 'credit_note',
    });
  });
});
