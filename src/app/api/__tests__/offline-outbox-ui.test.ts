import fs from 'fs';
import path from 'path';

const root = process.cwd();

describe('Offline Outbox visibility', () => {
  it('hides the topbar button when there are no active queued or conflict items', () => {
    const source = fs.readFileSync(path.join(root, 'src/components/offline/OfflineOutbox.tsx'), 'utf8');

    expect(source).toContain('if (!open && activeCount === 0) return null;');
    expect(source).not.toContain('<Wifi size={18} />');
  });
});
