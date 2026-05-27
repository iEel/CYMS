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
});
