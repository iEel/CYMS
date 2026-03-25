import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';
import fs from 'fs';
import path from 'path';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

const FOLDER_RETENTION: Record<string, string> = {
  'gate': 'gate_photos_days',
  'damage': 'damage_photos_days',
  'seal': 'seal_photos_days',
  'eir': 'eir_pdf_days',
};

// Folders that should never be cleaned up
const EXCLUDED_FOLDERS = ['logos'];

// POST — Run cleanup (delete files past retention period)
export async function POST() {
  try {
    // Load config
    const db = await getDb();
    let config: Record<string, number> = {
      gate_photos_days: 90,
      damage_photos_days: 365,
      seal_photos_days: 180,
      eir_pdf_days: 730,
    };

    try {
      const result = await db.request().query(
        "SELECT setting_key, setting_value FROM SystemSettings WHERE setting_key LIKE 'photo_retention_%'"
      );
      for (const row of result.recordset) {
        const key = row.setting_key.replace('photo_retention_', '');
        if (key in config) {
          config[key] = parseInt(row.setting_value) || config[key];
        }
      }
    } catch { /* use defaults */ }

    if (!fs.existsSync(UPLOAD_DIR)) {
      return NextResponse.json({ success: true, deleted: 0, freed_mb: 0 });
    }

    let totalDeleted = 0;
    let totalFreedMB = 0;

    const folders = fs.readdirSync(UPLOAD_DIR, { withFileTypes: true }).filter(d => d.isDirectory());

    for (const folder of folders) {
      if (EXCLUDED_FOLDERS.includes(folder.name)) continue;
      const folderPath = path.join(UPLOAD_DIR, folder.name);
      const retentionKey = FOLDER_RETENTION[folder.name] || 'gate_photos_days';
      const retentionDays = config[retentionKey] || 90;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

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
                if (stat.isFile() && stat.mtime < cutoffDate) {
                  const sizeMB = stat.size / (1024 * 1024);
                  fs.unlinkSync(filePath);
                  totalDeleted++;
                  totalFreedMB += sizeMB;
                }
              } catch { /* skip individual file */ }
            }

            // Remove empty year-month directory
            try {
              const remaining = fs.readdirSync(ymPath);
              if (remaining.length === 0) {
                fs.rmdirSync(ymPath);
              }
            } catch { /* skip */ }
          } catch { /* skip */ }
        }
      } catch { /* skip */ }
    }

    totalFreedMB = Math.round(totalFreedMB * 10) / 10;

    // Update last cleanup timestamp
    try {
      await db.request()
        .input('val', sql.NVarChar, new Date().toISOString())
        .query(`
          MERGE SystemSettings AS target
          USING (SELECT 'photo_retention_last_cleanup_at' AS setting_key) AS source
          ON target.setting_key = source.setting_key
          WHEN MATCHED THEN UPDATE SET setting_value = @val, updated_at = GETDATE()
          WHEN NOT MATCHED THEN INSERT (setting_key, setting_value) VALUES ('photo_retention_last_cleanup_at', @val);
        `);
      await db.request()
        .input('val', sql.NVarChar, String(totalDeleted))
        .query(`
          MERGE SystemSettings AS target
          USING (SELECT 'photo_retention_last_cleanup_deleted' AS setting_key) AS source
          ON target.setting_key = source.setting_key
          WHEN MATCHED THEN UPDATE SET setting_value = @val, updated_at = GETDATE()
          WHEN NOT MATCHED THEN INSERT (setting_key, setting_value) VALUES ('photo_retention_last_cleanup_deleted', @val);
        `);
    } catch { /* ignore logging failure */ }

    console.log(`🧹 Photo cleanup: deleted ${totalDeleted} files, freed ${totalFreedMB} MB`);
    return NextResponse.json({ success: true, deleted: totalDeleted, freed_mb: totalFreedMB });
  } catch (error) {
    console.error('❌ Cleanup error:', error);
    return NextResponse.json({ error: 'Cleanup ล้มเหลว' }, { status: 500 });
  }
}
