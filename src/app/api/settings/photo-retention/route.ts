import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import fs from 'fs';
import path from 'path';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

// Folder → retention config key mapping
const FOLDER_RETENTION: Record<string, string> = {
  'gate': 'gate_photos_days',
  'damage': 'damage_photos_days',
  'seal': 'seal_photos_days',
  'eir': 'eir_pdf_days',
};

// Folders that should never be cleaned up
const EXCLUDED_FOLDERS = ['logos'];

async function getRetentionConfig() {
  try {
    const db = await getDb();
    const result = await db.request().query(
      "SELECT setting_key, setting_value FROM SystemSettings WHERE setting_key LIKE 'photo_retention_%'"
    );
    const config: Record<string, number | boolean | string | null> = {
      gate_photos_days: 90,
      damage_photos_days: 365,
      seal_photos_days: 180,
      eir_pdf_days: 730,
      auto_cleanup_enabled: false,
      auto_cleanup_time: '03:00',
      last_cleanup_at: null,
      last_cleanup_deleted: 0,
    };
    for (const row of result.recordset) {
      const key = row.setting_key.replace('photo_retention_', '');
      if (key === 'auto_cleanup_enabled') {
        config[key] = row.setting_value === 'true';
      } else if (key === 'last_cleanup_at' || key === 'auto_cleanup_time') {
        config[key] = row.setting_value;
      } else {
        config[key] = parseInt(row.setting_value) || config[key];
      }
    }
    return config;
  } catch {
    return {
      gate_photos_days: 90,
      damage_photos_days: 365,
      seal_photos_days: 180,
      eir_pdf_days: 730,
      auto_cleanup_enabled: false,
      last_cleanup_at: null,
      last_cleanup_deleted: 0,
    };
  }
}

function scanUploads(config: Record<string, number | boolean | string | null>) {
  const stats = {
    total_files: 0,
    total_size_mb: 0,
    by_folder: [] as { folder: string; files: number; size_mb: number }[],
    cleanable_files: 0,
    cleanable_size_mb: 0,
  };

  if (!fs.existsSync(UPLOAD_DIR)) return stats;

  try {
    const folders = fs.readdirSync(UPLOAD_DIR, { withFileTypes: true }).filter(d => d.isDirectory());

    for (const folder of folders) {
      if (EXCLUDED_FOLDERS.includes(folder.name)) continue;
      const folderPath = path.join(UPLOAD_DIR, folder.name);
      let folderFiles = 0;
      let folderSize = 0;

      // Get retention days for this folder type
      const retentionKey = FOLDER_RETENTION[folder.name] || 'gate_photos_days';
      const retentionDays = (config[retentionKey] as number) || 90;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      // Scan year-month subdirs
      try {
        const yearMonthDirs = fs.readdirSync(folderPath, { withFileTypes: true }).filter(d => d.isDirectory());

        for (const ymDir of yearMonthDirs) {
          const ymPath = path.join(folderPath, ymDir.name);
          try {
            const files = fs.readdirSync(ymPath);
            for (const file of files) {
              const filePath = path.join(ymPath, file);
              try {
                const stat = fs.statSync(filePath);
                if (stat.isFile()) {
                  const sizeMB = stat.size / (1024 * 1024);
                  folderFiles++;
                  folderSize += sizeMB;
                  stats.total_files++;
                  stats.total_size_mb += sizeMB;

                  // Check if file is past retention
                  if (stat.mtime < cutoffDate) {
                    stats.cleanable_files++;
                    stats.cleanable_size_mb += sizeMB;
                  }
                }
              } catch { /* skip */ }
            }
          } catch { /* skip */ }
        }
      } catch { /* skip */ }

      if (folderFiles > 0) {
        stats.by_folder.push({
          folder: folder.name,
          files: folderFiles,
          size_mb: Math.round(folderSize * 10) / 10,
        });
      }
    }
  } catch { /* skip */ }

  stats.total_size_mb = Math.round(stats.total_size_mb * 10) / 10;
  stats.cleanable_size_mb = Math.round(stats.cleanable_size_mb * 10) / 10;
  return stats;
}

// GET — Load config + storage stats
export async function GET() {
  try {
    const config = await getRetentionConfig();
    const stats = scanUploads(config);
    return NextResponse.json({ config, stats });
  } catch (error) {
    console.error('❌ Photo retention GET error:', error);
    return NextResponse.json({ error: 'ไม่สามารถโหลดข้อมูลได้' }, { status: 500 });
  }
}

// PUT — Save config
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const db = await getDb();

    // Ensure SystemSettings table exists
    await db.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SystemSettings')
      CREATE TABLE SystemSettings (
        setting_key NVARCHAR(100) PRIMARY KEY,
        setting_value NVARCHAR(500),
        updated_at DATETIME2 DEFAULT GETDATE()
      )
    `);

    const keys = ['gate_photos_days', 'damage_photos_days', 'seal_photos_days', 'eir_pdf_days', 'auto_cleanup_enabled', 'auto_cleanup_time'];
    for (const key of keys) {
      if (body[key] !== undefined) {
        const value = String(body[key]);
        const dbKey = `photo_retention_${key}`;
        await db.request().query(`
          MERGE SystemSettings AS target
          USING (SELECT '${dbKey}' AS setting_key) AS source
          ON target.setting_key = source.setting_key
          WHEN MATCHED THEN UPDATE SET setting_value = '${value}', updated_at = GETDATE()
          WHEN NOT MATCHED THEN INSERT (setting_key, setting_value) VALUES ('${dbKey}', '${value}');
        `);
      }
    }

    // Reload scheduler with new settings
    try {
      const { reloadPhotoCleanupScheduler } = await import('@/lib/photoCleanupScheduler');
      await reloadPhotoCleanupScheduler();
    } catch { /* scheduler reload is optional */ }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ Photo retention PUT error:', error);
    return NextResponse.json({ error: 'ไม่สามารถบันทึกได้' }, { status: 500 });
  }
}
