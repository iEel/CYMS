import fs from 'fs';
import path from 'path';

describe('Yard 3D visual polish', () => {
  const root = process.cwd();

  function read(filePath: string) {
    return fs.readFileSync(path.join(root, filePath), 'utf8');
  }

  it('keeps scene visual primitives outside the main YardViewer3D integration component', () => {
    const viewer = read('src/components/yard/YardViewer3D.tsx');

    expect(viewer).toContain('yard3dScene');
    expect(viewer).toContain('yard3dGeometry');
    expect(viewer).toContain('Yard3DCameraToolbar');
  });

  it('adds operational yard context to the 3D scene', () => {
    const geometry = read('src/components/yard/yard3dGeometry.ts');

    expect(geometry).toContain('createLaneMarkings');
    expect(geometry).toContain('createDirectionArrow');
    expect(geometry).toContain('createBayRowTicks');
    expect(geometry).toContain('createReeferPlugPosts');
  });

  it('adds a selected-container outline instead of relying only on material brightening', () => {
    const geometry = read('src/components/yard/yard3dGeometry.ts');
    const viewer = read('src/components/yard/YardViewer3D.tsx');

    expect(geometry).toContain('createSelectionOutline');
    expect(viewer).toContain('selectionOutlineRef');
  });

  it('exposes camera presets for common operator views', () => {
    const toolbar = read('src/components/yard/Yard3DCameraToolbar.tsx');

    expect(toolbar).toContain('ภาพรวม');
    expect(toolbar).toContain('ด้านบน');
    expect(toolbar).toContain('โฟกัสตู้');
  });
});
