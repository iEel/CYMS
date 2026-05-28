import fs from 'fs';
import path from 'path';
import sql from 'mssql';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

const FOLDER_RETENTION: Record<string, string> = {
  photos: 'gate_photos_days',
  gate: 'gate_photos_days',
  damage: 'damage_photos_days',
  seal: 'seal_photos_days',
  eir: 'eir_pdf_days',
  mnr: 'mnr_photos_days',
  documents: 'document_files_days',
};

const EXCLUDED_FOLDERS = ['logos'];

type CleanupDbRequest = {
  input(name: string, type: unknown, value: unknown): CleanupDbRequest;
  query(statement: string): Promise<{ recordset: Array<{ setting_key: string; setting_value: string }> }>;
};

type CleanupDb = {
  request(): CleanupDbRequest;
};

export type PhotoRetentionCleanupResult = {
  success: true;
  deleted: number;
  freed_mb: number;
};

async function loadRetentionConfig(db: CleanupDb) {
  const config: Record<string, number> = {
    gate_photos_days: 90,
    damage_photos_days: 365,
    seal_photos_days: 180,
    eir_pdf_days: 730,
    mnr_photos_days: 730,
    document_files_days: 730,
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
  } catch {
    // Defaults keep cleanup safe if settings cannot be loaded.
  }

  return config;
}

async function updateCleanupStats(db: CleanupDb, deleted: number) {
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
      .input('val', sql.NVarChar, String(deleted))
      .query(`
        MERGE SystemSettings AS target
        USING (SELECT 'photo_retention_last_cleanup_deleted' AS setting_key) AS source
        ON target.setting_key = source.setting_key
        WHEN MATCHED THEN UPDATE SET setting_value = @val, updated_at = GETDATE()
        WHEN NOT MATCHED THEN INSERT (setting_key, setting_value) VALUES ('photo_retention_last_cleanup_deleted', @val);
      `);
  } catch {
    // Cleanup stats are best-effort and must not fail the cleanup itself.
  }
}

export async function runPhotoRetentionCleanup(db: CleanupDb): Promise<PhotoRetentionCleanupResult> {
  const config = await loadRetentionConfig(db);

  if (!fs.existsSync(UPLOAD_DIR)) {
    await updateCleanupStats(db, 0);
    return { success: true, deleted: 0, freed_mb: 0 };
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
            } catch {
              // Skip individual file errors so one bad file does not stop cleanup.
            }
          }

          try {
            const remaining = fs.readdirSync(ymPath);
            if (remaining.length === 0) {
              fs.rmdirSync(ymPath);
            }
          } catch {
            // Empty-directory cleanup is best-effort.
          }
        } catch {
          // Skip unreadable year-month folders.
        }
      }
    } catch {
      // Skip unreadable upload folders.
    }
  }

  totalFreedMB = Math.round(totalFreedMB * 10) / 10;
  await updateCleanupStats(db, totalDeleted);

  console.log(`🧹 Photo cleanup: deleted ${totalDeleted} files, freed ${totalFreedMB} MB`);
  return { success: true, deleted: totalDeleted, freed_mb: totalFreedMB };
}
