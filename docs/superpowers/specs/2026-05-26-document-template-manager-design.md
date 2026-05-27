# Document Template Manager + Continuous Tax Invoice / Receipt Design

Date: 2026-05-26
Status: Approved design for Phase 1 planning

## Summary

CYMS already has A4 invoice and receipt printing, billing/payment lifecycle, and document running numbers through `DocumentSequences` and `nextDocumentNumber()`. This design adds a document template layer on top of those systems instead of replacing them.

Phase 1 builds a structured Document Template Manager and a Continuous Tax Invoice / Receipt print flow for 5-copy continuous paper. It supports full-form printing, pre-printed overlay printing, preview, test print, calibration, template versioning, print snapshots, and reprint labels. Phase 2 will add the drag-and-drop visual designer using the same template schema.

## Existing System Context

The current system already provides:

- A4 invoice and receipt route: `/billing/print?id={invoice_id}&type=invoice|receipt`.
- Document numbers through `src/lib/documentNumber.ts`.
- Runtime document sequence data in `DocumentSequences`.
- Settings UI for document running numbers in `DocumentNumberSettings`.
- Invoice, payment, receipt, statement, lifecycle, and audit flows.
- Gate In and Gate Out print entry points that open the existing A4 billing print page.

The new work must not create a second document-number engine. It should consume numbers that already exist on invoice, receipt, payment, and statement records.

## Goals

1. Add a new continuous tax invoice / receipt template without breaking A4 print.
2. Add a reusable Document Template Manager for future forms.
3. Support preview with sample data and real documents.
4. Support test print and calibration without consuming document numbers.
5. Support full-form mode and pre-printed overlay mode.
6. Support carbonless one-page mode and separate five-page mode.
7. Support reprint logging and optional reprint labels.
8. Preserve old document numbers and old template versions for reprint.
9. Use existing billing, payment, receipt, and document lifecycle data.
10. Keep Phase 1 structured and stable while preparing schema for Phase 2 visual designer.

## Non-Goals For Phase 1

1. No drag-and-drop visual designer.
2. No replacement of the current A4 invoice / receipt route.
3. No new independent document-number running system.
4. No automatic OCR or scanner alignment.
5. No runtime DDL inside API routes.
6. No duplicate invoice, payment, or receipt creation from print actions.

## Recommended Phase Split

### Phase 1: Structured Template Manager

Phase 1 creates the data model, helper APIs, template settings UI, continuous print route, print log, reprint behavior, and preview/test print.

The editor is a structured form, not a freeform designer. It exposes paper size, mode, copy behavior, offsets, font sizes, line heights, row heights, reprint labels, reference source, red reference source, and a field-position table. The field schema already stores coordinates in millimeters so Phase 2 can edit the same config visually.

### Phase 2: Visual Designer

Phase 2 adds drag/drop field placement, resize, rulers, snap grid, zoom, layer list, lock/unlock, duplicate, delete, undo/redo, and publish workflow. It edits the same template version config introduced in Phase 1.

## Data Model

All schema changes go into `scripts/migrate-runtime-core-schema.js` and the canonical schema file. API routes must not run `ALTER TABLE` or `CREATE TABLE`.

### DocumentTemplates

Purpose: template identity and current default/published state.

Fields:

- `template_id`
- `template_code`
- `template_name`
- `document_type`
- `description`
- `status`: `draft`, `active`, `inactive`
- `is_default`
- `current_version_no`
- `created_by`
- `updated_by`
- `created_at`
- `updated_at`

Recommended unique rules:

- `template_code` unique.
- At most one default active template per `document_type`.

### DocumentTemplateVersions

Purpose: immutable layout/version config used by print and reprint.

Fields:

- `version_id`
- `template_id`
- `template_code`
- `version_no`
- `status`: `draft`, `published`, `archived`
- `paper_width_mm`
- `paper_height_mm`
- `paper_size_code`: `continuous_9_5x5_5`, `continuous_9_5x11`, `a4`, `custom`
- `mode`: `full`, `overlay`
- `copy_mode`: `carbonless`, `separate`
- `top_offset_mm`
- `left_offset_mm`
- `font_size`
- `line_height`
- `row_height`
- `print_scale`
- `show_reprint_label`
- `reprint_label_template`
- `reprint_label_position`
- `reprint_label_x_mm`
- `reprint_label_y_mm`
- `reprint_label_font_size`
- `reprint_label_color`
- `require_reprint_reason`
- `print_red_ref`
- `red_ref_source`
- `manual_preprinted_form_no_required`
- `invoice_number_source`
- `receipt_number_source`
- `tax_invoice_number_source`
- `top_reference_source`
- `config_json`
- `published_by`
- `published_at`
- `created_by`
- `created_at`

`config_json` stores field definitions, copy labels, section rules, calibration marks, and future visual-designer metadata.

### DocumentPrintLogs

Purpose: audit every real print and reprint.

Fields:

- `print_id`
- `document_type`
- `document_id`
- `document_no`
- `template_code`
- `template_version`
- `print_no`
- `is_reprint`
- `reprint_count`
- `reprint_reason`
- `manual_preprinted_form_no`
- `mode`
- `copy_mode`
- `printed_by`
- `printed_at`
- `ip_address`
- `user_agent`

Preview and test print are not real tax-document prints. They may be logged as audit events, but they must not increment `print_no`.

### DocumentPrintSnapshots

Purpose: preserve what was printed for tax and audit traceability.

Fields:

- `snapshot_id`
- `print_id`
- `document_type`
- `document_id`
- `document_no`
- `template_code`
- `template_version`
- `snapshot_json`
- `created_at`

The snapshot stores normalized company, customer, document, line, total, payment, and template metadata. Reprint should prefer the original snapshot when available.

### AuditLog Usage

Use existing audit infrastructure for template administration:

- `document_template_create`
- `document_template_update_draft`
- `document_template_publish`
- `document_template_set_default`
- `document_template_deactivate`
- `document_template_import`
- `document_template_export`
- `document_template_test_print`
- `document_template_preview`

## Template Config Schema

The template config must be JSON and versioned. It should be readable and exportable.

Top-level shape:

```json
{
  "paper": {
    "width_mm": 241.3,
    "height_mm": 139.7,
    "top_offset_mm": 0,
    "left_offset_mm": 0,
    "print_scale": 1
  },
  "mode": "full",
  "copy_mode": "carbonless",
  "copy_labels": [
    "Original Tax Invoice / Receipt",
    "Copy Tax Invoice / Receipt",
    "Accounting Copy",
    "Customer Copy",
    "Archive Copy"
  ],
  "fields": [
    {
      "field_id": "customer_name",
      "field_key": "customer.customer_name",
      "label": "Customer Name",
      "binding_source": "customer.customer_name",
      "x_mm": 18,
      "y_mm": 42,
      "width_mm": 130,
      "height_mm": 6,
      "font_size": 10,
      "font_weight": "normal",
      "text_align": "left",
      "visible": true,
      "layer": "data",
      "locked": false,
      "format": "text",
      "default_value": "",
      "sample_value": "ABC Logistics Co., Ltd."
    }
  ],
  "sections": {
    "line_items": {
      "start_y_mm": 76,
      "row_height_mm": 6,
      "max_rows": 8
    }
  }
}
```

Labels can be Thai in the UI, but the exported binding keys should remain stable English keys.

## Continuous Template Defaults

Default template:

- Template code: `continuous_tax_invoice_receipt`
- Template name: `Continuous Tax Invoice / Receipt`
- Document type: `tax_invoice_receipt`
- Paper size: `9.5in x 5.5in`
- Width: `241.3mm`
- Height: `139.7mm`
- Mode: `full`
- Copy mode: `carbonless`
- Reprint label: enabled by default for real reprints
- Reprint label template: `Reprint #{reprint_count}`

Separate copy labels:

1. `Original Tax Invoice / Receipt`
2. `Copy Tax Invoice / Receipt`
3. `Accounting Copy`
4. `Customer Copy`
5. `Archive Copy`

Thai labels can be shown on the rendered document:

1. `ต้นฉบับใบกำกับภาษี/ใบเสร็จรับเงิน`
2. `สำเนาใบกำกับภาษี/ใบเสร็จรับเงิน`
3. `สำเนาสำหรับบัญชี`
4. `สำเนาสำหรับลูกค้า`
5. `สำเนาสำหรับเก็บ`

## Backend Helpers

### `src/lib/thaiBahtText.ts`

Extract the Thai amount-text logic from the existing A4 print page into a reusable helper.

Requirements:

- Support zero.
- Support decimals.
- Support negative amounts for line items.
- Return stable Thai baht text for totals.

### `src/lib/billingContinuousPrint.ts`

Build a normalized print payload.

Responsibilities:

- Load invoice/payment/customer/company/yard data.
- Normalize company fields.
- Normalize customer tax and branch fields.
- Normalize document numbers.
- Parse invoice `notes` charges without dropping negative lines.
- Normalize line items with `description`, `qty`, `unit_price`, `amount`, and optional container/job refs.
- Normalize totals, VAT, grand total, amount in Thai words.
- Normalize payment method, cheque, bank, date, ref, and collector.
- Support sample data without DB reads.
- Return one payload shape for JSON preview and print rendering.

### `src/lib/documentTemplates.ts`

Responsibilities:

- Load active default template by document type.
- Load template by code/version.
- Create draft version when editing published templates.
- Publish a version.
- Set default template.
- Export/import template JSON.
- Validate template config before publish.

### `src/lib/documentPrintLog.ts`

Responsibilities:

- Calculate next print number for a real document/template pair.
- Enforce reprint reason if configured.
- Insert `DocumentPrintLogs`.
- Insert `DocumentPrintSnapshots`.
- Build reprint label context.
- Log preview/test print audit events without incrementing print numbers.

## API Routes

### Template Manager APIs

Recommended routes:

- `GET /api/document-templates`
- `POST /api/document-templates`
- `GET /api/document-templates/[templateId]`
- `PUT /api/document-templates/[templateId]`
- `POST /api/document-templates/[templateId]/duplicate`
- `POST /api/document-templates/[templateId]/publish`
- `POST /api/document-templates/[templateId]/set-default`
- `POST /api/document-templates/[templateId]/deactivate`
- `POST /api/document-templates/import`
- `GET /api/document-templates/[templateId]/export`
- `POST /api/document-templates/preview`
- `POST /api/document-templates/test-print`

All mutation routes require `settings.manage` or a more specific future permission such as `settings.document_templates.manage`.

### Continuous Print Route

Route:

- `/billing/print/continuous?id={invoice_id}&type=receipt|tax_invoice_receipt`

Query support:

- `mode=full|overlay`
- `copyMode=carbonless|separate`
- `copyIndex=0..4`
- `templateCode={template_code}`
- `templateVersion={version_no}`
- `preview=sample|real|false`
- `testPrint=1`

Behavior:

- `preview=sample` uses sample data and does not log print or consume numbers.
- `preview=real` uses real document data and does not increment print count.
- `testPrint=1` shows calibration marks and does not increment print count.
- Real print uses existing invoice/receipt/payment numbers and inserts print log/snapshot.
- Reprint uses the same numbers and renders a label when configured.

## Print Rendering

### Full Form Mode

The system renders:

- Logo.
- Company Thai/English name and address.
- Tax ID and branch.
- Copy label box.
- Customer box.
- Reference/date box.
- Item table.
- Payment method section.
- Totals and VAT.
- Amount in words.
- Collector/signature area.
- Footer note.
- Red reference number when enabled.

### Overlay Mode

The system renders only real data fields in absolute millimeter positions.

Overlay mode must support:

- Top offset.
- Left offset.
- Print scale.
- Font size.
- Line height.
- Row height.
- Calibration grid.
- Test marks.
- Field position display in millimeters.

If `print_red_ref` is false, the red reference is not rendered because it is expected to exist on the pre-printed paper. The user can still record `manual_preprinted_form_no` in the print log.

## Document Number Integration

The existing document-number system remains the source of truth.

Rules:

- Preview must not call `nextDocumentNumber()`.
- Test print must not call `nextDocumentNumber()`.
- Reprint must not call `nextDocumentNumber()`.
- Real print must not issue new invoice/receipt numbers. It uses numbers already assigned by invoice/payment flow.
- If a continuous-form red reference needs its own sequence, use the existing `DocumentSequences` system with a new document type such as `continuous_form_ref`.
- If using pre-printed paper with a red reference already printed, store `manual_preprinted_form_no` instead of generating a new number.

The template manager may show a simulated next number by reading `DocumentSequences.next_number`; it must not increment it.

## UI / UX Design

Visual thesis: a precise operations workspace for printed-document control, with a stable preview canvas, compact settings, and clear audit confidence.

Content plan:

1. Template list and status.
2. Selected template preview.
3. Structured settings inspector.
4. Preview/test print actions.
5. Version and audit context.

Interaction thesis:

1. Switching templates updates the preview immediately.
2. Offset and paper settings refresh the preview with a restrained transition.
3. Publish/default actions use confirmation dialogs because they affect production documents.

### Settings Navigation

Add a new tab under Settings:

- Label: `Document Templates`
- Group: customer/finance settings
- Description: layout, print forms, preview, test print, reprint behavior

Keep `Document Number Settings` separate. Add cross-links between the two pages:

- From template detail to document number settings.
- From document number settings to template manager.

### Template Manager Layout

Use an operations workspace, not a landing page.

Recommended layout:

- Top action bar: document type filter, status filter, search, create template.
- Left: template table/list.
- Center: print preview canvas.
- Right: inspector panel.

Inspector sections:

- Identity: code, name, document type, version, status.
- Paper: size, custom dimensions, scale.
- Print mode: full or overlay.
- Copy behavior: carbonless or separate.
- Calibration: top/left offsets, row height, line height.
- Number mapping: invoice, receipt, tax invoice, top ref, red ref.
- Reprint label: show/hide, text, position, require reason.
- Field positions: structured table with millimeter values.

### Preview Modes

Provide three actions:

- Preview with sample data.
- Preview with real document.
- Test print / calibration.

Preview must clearly display:

- Template code and version.
- Preview mode.
- Paper size.
- Full/overlay mode.
- Copy mode.
- Reprint label state.

### Billing Integration

In Billing invoice/payment actions, add:

- `Print A4`
- `Print Continuous Form`

Do not create a new invoice/payment from these buttons.

### Gate Integration

After billing clearance or payment from Gate In/Gate Out, add:

- `Print A4 Receipt`
- `Print Continuous Receipt`

The continuous button opens the new route with the existing invoice id.

## Reprint Behavior

First real print:

- `print_no = 1`
- `is_reprint = false`
- `reprint_count = 0`
- No reprint label.

Second real print:

- `print_no = 2`
- `is_reprint = true`
- `reprint_count = 1`
- Show reprint label if template setting is enabled.

Third real print:

- `print_no = 3`
- `is_reprint = true`
- `reprint_count = 2`

If `require_reprint_reason` is enabled, real reprint must require a reason. Preview and test print do not require a reason.

## Security And Permissions

Recommended permissions:

- `settings.document_templates.view`
- `settings.document_templates.manage`
- `billing.document.print`
- `billing.document.reprint`
- `billing.document.test_print`

Initial implementation can map these to existing `settings.manage`, `billing.invoice.create`, and `billing.payment.receive` if the granular permissions are not seeded yet. The design should keep route checks centralized so dedicated permissions can be enabled later.

## Testing Plan

Unit tests:

- Thai baht text formatting.
- Negative line item handling.
- Template config validation.
- Reprint count calculation.
- Reprint label rendering conditions.
- Preview/test print does not request a new document number.

API tests:

- Template list/create/update/publish/default.
- Preview with sample data.
- Preview with real invoice.
- Test print without print-log increment.
- First print creates print log and snapshot.
- Reprint increments count and preserves document number.
- Reprint reason is required when configured.
- Manual pre-printed form number is stored when required.

Print/page tests:

- Continuous route renders full form.
- Continuous route renders overlay mode.
- Carbonless mode renders one page.
- Separate mode renders five pages with copy labels.
- Reprint label appears only when configured and applicable.
- Existing `/billing/print` A4 route remains unchanged.

Integration tests:

- Billing page exposes continuous print action.
- Gate In/Gate Out expose continuous print action after clearance/payment.
- No duplicate invoice/payment is created by print actions.

## Migration And Rollout

1. Add schema in migration script and canonical schema.
2. Seed default continuous template and version if missing.
3. Keep existing A4 print route untouched.
4. Add template manager behind settings permission.
5. Add continuous print route.
6. Add billing and gate entry points.
7. Run tests, TypeScript, and lint.
8. Update `DEVELOPER_HANDOFF.md` after implementation.

## Acceptance Criteria

1. Existing A4 invoice/receipt still works.
2. Continuous Tax Invoice / Receipt exists as a separate template.
3. `/billing/print/continuous?id=...` renders the continuous layout.
4. Full form mode prints all labels, borders, and data.
5. Overlay mode prints only positioned data fields.
6. Paper size, offsets, font size, line height, row height, and scale are configurable.
7. Carbonless mode prints one page.
8. Separate mode prints five pages with copy labels.
9. Preview with sample data works.
10. Preview with real document works.
11. Test print/calibration works.
12. Negative line items are preserved.
13. VAT, grand total, and Thai baht text are correct.
14. Payment method checkbox renders correctly.
15. Company, customer, invoice, and payment data come from existing records.
16. Billing page can open continuous print.
17. Gate In/Gate Out can open continuous print after billing flow.
18. Reprint count is correct.
19. Reprint label follows template setting.
20. Reprint reason is enforced when configured.
21. Preview/test print does not consume document numbers.
22. Reprint uses old numbers.
23. Red reference source is configurable.
24. Manual pre-printed form number is supported.
25. Template schema supports future visual designer.
26. Template changes are audited.
27. Real prints are logged and snapshotted.
28. Tests, TypeScript, and lint pass.
