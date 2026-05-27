# Document Template Designer 2.1 Design

Date: 2026-05-27
Status: Approved design, pending implementation plan
Scope: Continuous Tax Invoice / Receipt only

## Goal

Document Template Designer 2.1 makes the existing Continuous Tax Invoice / Receipt designer usable for real continuous paper operations. The work extends the current template config, canvas designer, renderer, preview, and print-log model. It does not create a new document-number system or a second renderer.

The main outcomes are:

- Operators can edit the line-item table region from the designer instead of treating it as a fixed placeholder.
- Staff can save calibration profiles for real printers and paper stock.
- Billing staff can review print/reprint history and use the stored snapshot/version when reprinting.
- A publish confirmation can show meaningful layout changes before a draft becomes active.

## Existing Context

The current system already has:

- `DocumentTemplateField` with mm-based geometry and a canvas designer.
- `DocumentTemplateConfig.sections.line_items` with `x_mm`, `y_mm`, `width_mm`, `row_height_mm`, `max_rows`, and columns.
- `ContinuousTaxReceipt` renderer for full and overlay mode.
- `DocumentTemplates`, `DocumentTemplateVersions`, `DocumentPrintLogs`, and `DocumentPrintSnapshots`.
- Draft, publish, preview, test print, print-log, import/export, and permission-guarded APIs.
- Settings deep link `/settings?tab=document-templates`.

Designer 2.1 should reuse these foundations.

## Non-Goals

- Do not build designers for EIR, statement, or other document types in this round.
- Do not build a spreadsheet-like table cell editor.
- Do not add formula editor or conditional expression language.
- Do not replace `ContinuousTaxReceipt`.
- Do not create a new document number sequence system.
- Do not consume document numbers for sample preview, calibration, or test print.

## Recommended Approach

Use the current config as the source of truth and extend it conservatively.

Line items remain a structured section under `config.sections.line_items`, not individual fake fields for each row. The canvas shows the line-item region as a selectable block, and the inspector edits the block and its columns. The print renderer consumes the same section config.

Calibration should be stored as optional template-level config first. If future users need customer/printer-level sharing, the same shape can later move into a table without changing the renderer contract.

Print history should read from `DocumentPrintLogs` and `DocumentPrintSnapshots` rather than inventing a separate audit stream.

## Data Model And Config

### Template Config Additions

Extend `DocumentTemplateConfig` with optional `calibration_profiles` and `default_calibration_profile_id`.

```ts
type DocumentTemplateCalibrationProfile = {
  profile_id: string;
  profile_name: string;
  paper_label: string;
  width_mm: number;
  height_mm: number;
  top_offset_mm: number;
  left_offset_mm: number;
  print_scale: number;
  notes?: string;
};
```

The existing `paper` object remains the active paper settings. Selecting a calibration profile applies its values to `paper` for preview/test print. Published templates continue to store the complete config snapshot in `DocumentTemplateVersions.config_json`.

### Line Item Section

Keep the existing structure:

- `section_id`
- `binding_source`
- `x_mm`
- `y_mm`
- `start_y_mm`
- `width_mm`
- `row_height_mm`
- `max_rows`
- `columns[]`

Add no new table schema for line items in this round. Validation should become stricter:

- section must stay inside paper bounds
- `row_height_mm * max_rows` must stay inside paper bounds
- columns must have unique `column_id`
- total column widths must be positive and render proportionally inside section width
- each column `field_key` must be an allowed `lines[]` binding
- labels and sample text must reject unsafe script-like content

## UI Design

### Canvas

The canvas should render the line-item table as a selectable region with a clear label, header preview, row grid, and column guides. It should be visually distinct from normal text fields but not behave like an unrelated object.

When selected, the designer status should show `Line items · lines`.

Allowed interactions:

- click to select
- drag to move region
- resize width/height using snap mm
- keyboard nudge with the same Arrow / Shift+Arrow / Alt+Arrow behavior
- respect layer visibility, but line items should not be hidden accidentally by data field filters

Locked behavior:

- if template is active/read-only, region is selectable but not movable
- if line item section is locked in future config, inspector should be read-only

### Inspector

Add a dedicated inspector mode for line items:

- section label
- x/y/width
- row height
- max rows
- binding source, read-only `lines`
- columns list
- add column from allowed `lines[]` bindings
- remove column, except prevent zero-column table
- reorder columns up/down
- edit label, width, align, format

Column format options should be simple:

- `text`
- `number`
- `currency:THB`

### Calibration Panel

Add a compact calibration area in Document Template Manager or the designer side panel:

- profile selector
- create profile from current paper settings
- update profile
- delete profile, except prevent deleting the selected default profile without choosing another
- apply profile to current draft
- Test Print with calibration marks

The UI copy should make it clear that calibration affects physical alignment, not tax/document numbering.

### Print History

Add a print history panel for the selected real document or template context:

- document type
- document id/no
- template code/version
- print no
- reprint count
- reprint reason
- printed by
- printed at
- mode/copy mode
- manual pre-printed form number

For template manager MVP, show recent prints for the selected template code/version. A later Billing integration can show history for a selected invoice.

Actions:

- view snapshot metadata
- open reprint using original template version
- show reprint label policy state

## API Design

### Existing APIs To Extend

- `GET /api/document-templates/[templateId]`
  - already returns version config; no response shape change required beyond config additions.

- `PUT /api/document-templates/[templateId]`
  - validate line-item section and calibration profiles.

- `GET /api/document-templates/preview`
  - accept `calibrationProfileId` optionally.
  - if supplied, apply profile values for preview/test print only.

- `POST /api/document-templates/test-print`
  - accept calibration profile details.
  - must not write `DocumentPrintLogs`.

### New API

Add `GET /api/document-templates/print-history`.

Query:

- `templateCode`
- `templateVersion`
- optional `documentType`
- optional `documentId`
- optional `limit`, capped at 100

Permission:

- `document_templates.view` or `settings.manage`

Response:

```ts
{
  history: Array<{
    print_id: number;
    document_type: string;
    document_id: number;
    document_no: string | null;
    template_code: string;
    template_version: number;
    print_no: number;
    is_reprint: boolean;
    reprint_count: number;
    reprint_reason: string | null;
    manual_preprinted_form_no: string | null;
    mode: string | null;
    copy_mode: string | null;
    printed_by: number | null;
    printed_by_name: string | null;
    printed_at: string;
    has_snapshot: boolean;
  }>
}
```

No mutation endpoint is required for history in this round.

## Renderer Behavior

`ContinuousTaxReceipt` should keep using `config.sections.line_items`.

Enhancements:

- use section `x_mm`, `y_mm`, `width_mm`, and calculated height in full form where practical
- columns render proportionally inside the configured section width
- text wraps safely without expanding the paper frame
- negative amounts continue to render
- test print still shows calibration marks

Overlay mode can keep field-based rendering for normal fields and use absolute section placement for line items if the section is visible in overlay template mode.

## Publish Diff

Before `publish`, compute a client-side summary comparing the draft config to the current published config.

Diff categories:

- paper size/offset/scale changed
- line item section moved/resized
- line item columns added/removed/reordered/renamed/resized
- fields moved/resized/added/removed
- calibration profile changed

The confirmation modal can remain `window.confirm` in MVP, but the text should be specific and scannable. A richer modal can follow later.

## Security And Permissions

Use existing permissions:

- view/history: `document_templates.view`
- draft edit: `document_templates.update_draft`
- publish/default/deactivate: `document_templates.publish`
- test print: `document_templates.test_print`
- import/export: existing import/export permissions

Validation rules:

- all SQL parameterized
- no runtime DDL in API routes
- import JSON validates line item columns and calibration profiles
- unsafe text rejected
- test print and preview do not consume document numbers or write real print logs
- real reprint uses existing print-log policy and template version validation

## Tests

Add focused tests for:

- line-item section validation rejects out-of-bounds region
- column ids must be unique
- column field keys must be allowed `lines[]` bindings
- canvas source includes selectable line item region behavior
- line item inspector supports column add/remove/reorder/edit
- renderer keeps table inside section/paper frame
- calibration profiles validate and can be applied to preview/test print
- print history API filters by template code/version with parameterized SQL
- test print does not insert into `DocumentPrintLogs`
- publish diff includes paper, field, and line item changes
- `tsc`, lint, and relevant Jest suites pass

## Acceptance Criteria

1. Existing templates continue to load without config migration errors.
2. A user can select `LineItemsRegion` on the canvas.
3. A draft user can move/resize the line-item region in mm units.
4. A draft user can edit row height and max rows.
5. A draft user can add, remove, reorder, and resize columns.
6. Invalid line-item config is rejected before save/import.
7. Full-form preview and print keep the line-item table inside the paper frame.
8. Calibration profiles can be created from current paper settings and applied to draft preview/test print.
9. Test print with calibration does not create a real print log.
10. Print history shows recent prints for selected template code/version.
11. Reprint opens with the original template version.
12. Publish confirmation lists meaningful changes from current published version.
13. `DEVELOPER_HANDOFF.md` is updated.
14. Focused tests, TypeScript, lint, and relevant route checks pass.

## Implementation Order

1. Extend types and validation helpers for line items and calibration profiles.
2. Add line-item selection and region editing to `TemplateCanvas`.
3. Add a line-item inspector panel.
4. Update `ContinuousTaxReceipt` to honor section placement and column constraints.
5. Add calibration profile UI and preview/test print parameter support.
6. Add print-history API and UI panel.
7. Add publish diff helper and confirmation text.
8. Add tests and update handoff.

