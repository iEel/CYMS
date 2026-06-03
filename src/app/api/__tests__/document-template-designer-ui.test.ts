import fs from 'fs';
import path from 'path';

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('document template visual designer UI', () => {
  it('wires the manager to a canvas designer instead of only form settings', () => {
    const manager = read('src/app/(dashboard)/settings/DocumentTemplateManager.tsx');

    expect(manager).toContain('DocumentTemplateDesigner');
    expect(manager).toContain('createDraft');
    expect(manager).toContain('createDefaultTemplate');
    expect(manager).toContain('ensurePreviewReady');
    expect(manager).toContain('/api/document-templates/');
    expect(manager).toContain('/draft');
    expect(manager).toContain('ยังไม่มี template ให้แก้ไข');
  });

  it('provides the required designer panels and mm-based canvas interactions', () => {
    const designer = read('src/components/document-templates/DocumentTemplateDesigner.tsx');
    const canvas = read('src/components/document-templates/TemplateCanvas.tsx');
    const inspector = read('src/components/document-templates/FieldInspector.tsx');
    const palette = read('src/components/document-templates/BindingPalette.tsx');
    const layers = read('src/components/document-templates/LayerList.tsx');
    const toolbar = read('src/components/document-templates/DesignerToolbar.tsx');

    expect(designer).toContain('createDesignerHistory');
    expect(designer).toContain('undoDesignerHistory');
    expect(designer).toContain('redoDesignerHistory');
    expect(designer).toContain("activePanel === 'bindings'");
    expect(designer).toContain("activePanel === 'layers'");
    expect(canvas).toContain('onPointerDown');
    expect(canvas).toContain('resize');
    expect(canvas).toContain('mmToPx');
    expect(canvas).toContain('snapMm');
    expect(inspector).toContain('binding_source');
    expect(inspector).toContain('font_weight');
    expect(palette).toContain('DESIGNER_BINDINGS');
    expect(palette).toContain('draggable');
    expect(layers).toContain('Layer');
    expect(layers).toContain('locked');
    expect(toolbar).toContain('Save Draft');
    expect(toolbar).toContain('Test Print');
    expect(toolbar).toContain('Publish');
  });

  it('renders full-form template elements in the designer canvas', () => {
    const source = read('src/components/document-templates/TemplateCanvas.tsx');

    expect(source).toContain('normalizeTemplateCanvasConfig(config)');
    expect(source).toContain('normalizedConfig.elements');
    expect(source).toContain('element.type ===');
  });

  it('lets full-form canvas elements be selected and moved instead of staying passive background', () => {
    const designer = read('src/components/document-templates/DocumentTemplateDesigner.tsx');
    const canvas = read('src/components/document-templates/TemplateCanvas.tsx');

    expect(designer).toContain("type: 'element'");
    expect(designer).toContain('nudgeElement');
    expect(designer).toContain('<ElementInspector');
    expect(canvas).toContain('onSelectElement');
    expect(canvas).toContain('beginElementDrag');
    expect(canvas).toContain('resizeElement');
    expect(canvas).not.toContain('className={`pointer-events-none absolute z-0');
  });

  it('shows a compact print mode hint in the designer toolbar area', () => {
    const source = read('src/components/document-templates/DocumentTemplateDesigner.tsx');

    expect(source).toContain('Full mode: canvas elements print');
    expect(source).toContain('Overlay mode: data layer only prints');
    expect(source).toContain('modePrintHint');
  });

  it('defaults designer selection to the table region instead of the first data field', () => {
    const source = read('src/components/document-templates/DocumentTemplateDesigner.tsx');

    expect(source).toContain('const firstSelection = (config: DocumentTemplateConfig): DesignerSelection =>');
    expect(source).toContain("return { type: 'line_items' };");
    expect(source).not.toContain("config.fields[0]?.field_id ? { type: 'field'");
  });

  it('separates designer work modes for layout, data fields, and table editing', () => {
    const designer = read('src/components/document-templates/DocumentTemplateDesigner.tsx');
    const canvas = read('src/components/document-templates/TemplateCanvas.tsx');
    const layers = read('src/components/document-templates/LayerList.tsx');

    expect(designer).toContain("type DesignerWorkMode = 'layout' | 'data' | 'table'");
    expect(designer).toContain("setWorkMode('layout')");
    expect(designer).toContain("setWorkMode('data')");
    expect(designer).toContain("setWorkMode('table')");
    expect(canvas).toContain('workMode: DesignerWorkMode');
    expect(canvas).toContain("workMode === 'data'");
    expect(canvas).toContain("workMode === 'table'");
    expect(layers).toContain('Form elements');
    expect(layers).toContain('Data fields');
    expect(layers).toContain('Line item table');
  });

  it('keeps preview tied to the selected draft config instead of falling back to an unrelated sample', () => {
    const manager = read('src/app/(dashboard)/settings/DocumentTemplateManager.tsx');

    expect(manager).toContain('const ensurePreviewReady = async ()');
    expect(manager).toContain('await saveDraft()');
    expect(manager).toContain("setError('เลือกหรือสร้าง document template ก่อน Preview')");
    expect(manager).toContain('templateId: String(selectedTemplate.template_id)');
  });

  it('passes return path and selected template version identity to preview windows', () => {
    const manager = read('src/app/(dashboard)/settings/DocumentTemplateManager.tsx');

    expect(manager).toContain("returnTo: '/settings?tab=document-templates'");
    expect(manager).toContain('templateId: String(selectedTemplate.template_id)');
    expect(manager).toContain('versionNo: String(editingVersion.version_no)');
  });

  it('labels print preview from the selected template family instead of hard-coded continuous text', () => {
    const previewPage = read('src/app/billing/print/continuous/page.tsx');
    const previewRoute = read('src/app/api/document-templates/preview/route.ts');

    expect(previewRoute).toContain('t.template_name');
    expect(previewRoute).toContain('template_family');
    expect(previewPage).toContain("config?.template_family === 'a4_tax_receipt'");
    expect(previewPage).toContain('previewTitle');
    expect(previewPage).not.toContain('<strong>Continuous Tax Invoice / Receipt</strong>');
  });

  it('lets settings deep-link back into the document template designer tab', () => {
    const settingsPage = read('src/app/(dashboard)/settings/page.tsx');

    expect(settingsPage).toContain('urlTab');
    expect(settingsPage).toContain("new URLSearchParams(window.location.search).get('tab')");
    expect(settingsPage).toContain("url.searchParams.set('tab', tabId)");
    expect(settingsPage).toContain("tab.id === 'portal-access'");
  });

  it('keeps create and duplicate route response table variables aligned with selected output fields', () => {
    const createRoute = read('src/app/api/document-templates/route.ts');
    const duplicateRoute = read('src/app/api/document-templates/[templateId]/duplicate/route.ts');

    [createRoute, duplicateRoute].forEach(source => {
      expect(source).toContain('reprint_label_template NVARCHAR(120)');
      expect(source).toContain('red_ref_source NVARCHAR(50)');
      expect(source).toContain('INSERTED.reprint_label_template');
      expect(source).toContain('INSERTED.red_ref_source');
      expect(source).toContain('v.red_ref_source AS version_red_ref_source');
    });
  });
});

describe('document template designer line item UI wiring', () => {
  it('uses a field-or-line-items selection model', () => {
    const source = read('src/components/document-templates/DocumentTemplateDesigner.tsx');
    expect(source).toContain("type DesignerSelection");
    expect(source).toContain("type: 'line_items'");
    expect(source).toContain('nudgeLineItems');
  });

  it('prevents keyboard nudges for locked line item and field layers', () => {
    const source = read('src/components/document-templates/DocumentTemplateDesigner.tsx');
    expect(source).toContain('layerState.data.locked');
    expect(source).toContain('selectedField.locked');
    expect(source).toContain('layerState[selectedField.layer].locked');
  });

  it('renders line items as a selectable table region instead of passive text', () => {
    const source = read('src/components/document-templates/TemplateCanvas.tsx');
    expect(source).toContain('Line items · lines[]');
    expect(source).toContain('beginLineItemsDrag');
    expect(source).toContain('resizeLineItems');
    expect(source).toContain('lineRegion.columns.map');
  });

  it('measures line item canvas height with header plus body rows', () => {
    const source = read('src/components/document-templates/TemplateCanvas.tsx');

    expect(source).toContain('const lineItemsHeaderHeightMm = Math.max(0, lineRegion.start_y_mm - lineRegion.y_mm)');
    expect(source).toContain('const lineItemsCanvasHeightMm = Math.max(0, lineRegion.start_y_mm - lineRegion.y_mm) + lineRegion.row_height_mm * lineRegion.max_rows');
    expect(source).toContain('height: mmToPx(lineItemsCanvasHeightMm, zoom)');
    expect(source).toContain('heightMm: snapMm(lineItemsCanvasHeightMm + dyMm, snapStep)');
  });

  it('keeps line item chrome outside the measured canvas rows', () => {
    const source = read('src/components/document-templates/TemplateCanvas.tsx');

    expect(source).toContain('height: mmToPx(lineItemsHeaderHeightMm, zoom)');
    expect(source).toContain('pointer-events-none absolute');
    expect(source).not.toContain('className="flex h-5 items-center border-b border-slate-300 bg-slate-100/90 px-1 font-semibold text-slate-600"');
  });

  it('selects the line items region on focus and keyboard activation', () => {
    const source = read('src/components/document-templates/TemplateCanvas.tsx');
    expect(source).toContain('onFocus={onSelectLineItems}');
    expect(source).toContain("event.key === 'Enter'");
    expect(source).toContain("event.key === ' '");
    expect(source).toContain('event.preventDefault()');
  });

  it('offers separate default template creation for continuous and A4 receipt layouts', () => {
    const manager = read('src/app/(dashboard)/settings/DocumentTemplateManager.tsx');

    expect(manager).toContain('buildDefaultA4TaxReceiptTemplateConfig');
    expect(manager).toContain("createDefaultTemplate('continuous')");
    expect(manager).toContain("createDefaultTemplate('a4')");
    expect(manager).toContain('Create Continuous Template');
    expect(manager).toContain('Create A4 Template');
    expect(manager).toContain('A4 layout เป็น template แยก');
  });

  it('keeps field clicks from being cleared by the canvas click handler', () => {
    const source = read('src/components/document-templates/TemplateCanvas.tsx');
    const stopClickPropagationCount = (source.match(/onClick=\{event => event\.stopPropagation\(\)\}/g) || []).length;

    expect(source).toContain('onClick={onClearSelection}');
    expect(source).toContain('onSelectField(field.field_id)');
    expect(stopClickPropagationCount).toBeGreaterThanOrEqual(2);
  });

  it('shows line items in status and layer list', () => {
    expect(read('src/components/document-templates/DesignerStatusBar.tsx')).toContain('selectedKind');
    expect(read('src/components/document-templates/LayerList.tsx')).toContain('onSelectLineItems');
  });
});

describe('line item inspector source wiring', () => {
  it('provides a dedicated inspector for line item geometry and columns', () => {
    const source = read('src/components/document-templates/LineItemsInspector.tsx');
    expect(source).toContain('Line items');
    expect(source).toContain('row_height_mm');
    expect(source).toContain('max_rows');
    expect(source).toContain('Number.isFinite');
    expect(source).toContain('addLineItemColumn');
    expect(source).toContain('moveLineItemColumn');
    expect(source).toContain('removeLineItemColumn');
  });

  it('lets line item labels be edited and previewed across multiple lines', () => {
    const inspector = read('src/components/document-templates/LineItemsInspector.tsx');
    const canvas = read('src/components/document-templates/TemplateCanvas.tsx');

    expect(inspector).toContain('<textarea');
    expect(inspector).toContain('rows={2}');
    expect(canvas).toContain('whitespace-pre-line');
    expect(canvas).not.toContain('className="truncate border-r border-slate-300 px-1 py-0.5 font-semibold last:border-r-0"');
  });

  it('uses the print renderer as the layout canvas backdrop so designer and preview align', () => {
    const canvas = read('src/components/document-templates/TemplateCanvas.tsx');

    expect(canvas).toContain("import { TemplateCanvasReceipt } from '@/components/billing/TemplateCanvasReceipt'");
    expect(canvas).toContain("import { buildSampleContinuousPrintPayload } from '@/lib/billingContinuousPrintSample'");
    expect(canvas).toContain('function printContentOriginMm(config: DocumentTemplateConfig)');
    expect(canvas).toContain('margin_left_mm');
    expect(canvas).toContain('const showPrintBackdrop = workMode ===');
    expect(canvas).toContain('<TemplateCanvasReceipt');
    expect(canvas).toContain('payload={previewPayload}');
    expect(canvas).toContain('style={previewBackplateStyle}');
  });

  it('feeds company profile sample data into the designer canvas logo preview', () => {
    const manager = read('src/app/(dashboard)/settings/DocumentTemplateManager.tsx');
    const designer = read('src/components/document-templates/DocumentTemplateDesigner.tsx');
    const canvas = read('src/components/document-templates/TemplateCanvas.tsx');

    expect(manager).toContain("import { buildSampleContinuousPrintPayload, type CompanyProfileSampleSource } from '@/lib/billingContinuousPrintSample'");
    expect(manager).toContain('loadCompanyPreview');
    expect(manager).toContain("fetch('/api/settings/company')");
    expect(manager).toContain('buildSampleContinuousPrintPayload(companyPreview)');
    expect(manager).toContain('samplePayload={designerSamplePayload}');
    expect(designer).toContain('samplePayload?: ContinuousPrintPayload');
    expect(designer).toContain('samplePayload={samplePayload}');
    expect(canvas).toContain('samplePayload?: ContinuousPrintPayload');
    expect(canvas).toContain('const previewPayload = samplePayload || fallbackSamplePayload');
    expect(canvas).toContain('payload={previewPayload}');
    expect(canvas).not.toContain('payload={samplePayload}');
  });

  it('shows LineItemsInspector for line item selection', () => {
    const source = read('src/components/document-templates/DocumentTemplateDesigner.tsx');
    expect(source).toContain('<LineItemsInspector');
    expect(source).toContain("selection?.type === 'line_items'");
  });
});

describe('calibration profile UI wiring', () => {
  it('exposes create, apply, update, delete, and test print actions', () => {
    const source = read('src/components/document-templates/CalibrationProfilesPanel.tsx');
    expect(source).toContain('Create profile from current paper');
    expect(source).toContain('Apply profile');
    expect(source).toContain('Update profile');
    expect(source).toContain('Delete profile');
    expect(source).toContain('Test Print with marks');
    expect(source).toContain('formToProfile(nextForm,');
    expect(source).toContain('profiles.map(profile => profile.profile_id === selectedProfile?.profile_id ? nextProfile : profile)');
    expect(source).not.toContain('formWithCurrentPaper');
  });

  it('renders calibration panel from manager', () => {
    expect(read('src/app/(dashboard)/settings/DocumentTemplateManager.tsx')).toContain('<CalibrationProfilesPanel');
  });
});

describe('print history panel wiring', () => {
  it('renders recent print history for selected template version', () => {
    expect(read('src/components/document-templates/PrintHistoryPanel.tsx')).toContain('Recent prints');
    expect(read('src/app/(dashboard)/settings/DocumentTemplateManager.tsx')).toContain('<PrintHistoryPanel');
  });
});

describe('publish diff dialog wiring', () => {
  it('shows a diff dialog before publishing', () => {
    expect(read('src/components/document-templates/PublishDiffDialog.tsx')).toContain('Publish this draft');
    expect(read('src/app/(dashboard)/settings/DocumentTemplateManager.tsx')).toContain('<PublishDiffDialog');
    expect(read('src/app/(dashboard)/settings/DocumentTemplateManager.tsx')).toContain('summarizeTemplateDiff');
  });

  it('compares publish diff against the published current version instead of the loaded draft', () => {
    const manager = read('src/app/(dashboard)/settings/DocumentTemplateManager.tsx');

    expect(manager).toContain('function choosePublishedBaselineConfig');
    expect(manager).toContain('version.version_no === detail.template.current_version_no');
    expect(manager).toContain("version.status === 'published' || version.status === 'active'");
    expect(manager).toContain('summarizeTemplateDiff(choosePublishedBaselineConfig(detail), config)');
    expect(manager).not.toContain('loadedVersionConfig');
  });

  it('publishes the snapshotted draft context instead of live selection state', () => {
    const manager = read('src/app/(dashboard)/settings/DocumentTemplateManager.tsx');

    expect(manager).toContain('type PublishDraftContext');
    expect(manager).toContain('publishDraftContext');
    expect(manager).toContain('config: cloneTemplateConfig(config)');
    expect(manager).toContain('const context = publishDraftContext');
    expect(manager).toContain('saveDraftForContext(context)');
    expect(manager).toContain('`/api/document-templates/${context.templateId}/publish`');
    expect(manager).toContain('JSON.stringify({ version_no: context.versionNo })');
    expect(manager).toContain('if (publishInFlightRef.current) return');
    expect(manager).not.toContain('const saved = await saveDraft();');
    expect(manager).not.toContain('`/api/document-templates/${selectedTemplate.template_id}/publish`');
    expect(manager).not.toContain('JSON.stringify({ version_no: editingVersion.version_no })');
  });
});
