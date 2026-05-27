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

  it('keeps preview tied to the selected draft config instead of falling back to an unrelated sample', () => {
    const manager = read('src/app/(dashboard)/settings/DocumentTemplateManager.tsx');

    expect(manager).toContain('const ensurePreviewReady = async ()');
    expect(manager).toContain('await saveDraft()');
    expect(manager).toContain("setError('เลือกหรือสร้าง document template ก่อน Preview')");
    expect(manager).toContain('if (selectedTemplate) params.templateId');
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

  it('selects the line items region on focus and keyboard activation', () => {
    const source = read('src/components/document-templates/TemplateCanvas.tsx');
    expect(source).toContain('onFocus={onSelectLineItems}');
    expect(source).toContain("event.key === 'Enter'");
    expect(source).toContain("event.key === ' '");
    expect(source).toContain('event.preventDefault()');
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

  it('shows LineItemsInspector for line item selection', () => {
    const source = read('src/components/document-templates/DocumentTemplateDesigner.tsx');
    expect(source).toContain('<LineItemsInspector');
    expect(source).toContain("selection?.type === 'line_items'");
  });
});
