import sql from 'mssql';
import { getDb } from '@/lib/db';

type DbPool = Awaited<ReturnType<typeof getDb>>;

export async function ensureDocumentSequences(db: DbPool) {
  await db.request().query(`
    IF OBJECT_ID('DocumentSequences', 'U') IS NULL
    BEGIN
      CREATE TABLE DocumentSequences (
        sequence_id INT PRIMARY KEY IDENTITY(1,1),
        yard_id INT NOT NULL,
        document_type NVARCHAR(30) NOT NULL,
        sequence_year INT NOT NULL,
        prefix NVARCHAR(20) NOT NULL,
        next_number INT NOT NULL DEFAULT 1,
        padding INT NOT NULL DEFAULT 6,
        updated_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        CONSTRAINT UQ_DocumentSequences UNIQUE (yard_id, document_type, sequence_year)
      );
    END
  `);
}

export async function nextDocumentNumber({
  db,
  yardId,
  documentType,
  prefix,
  year = new Date().getFullYear(),
  padding = 6,
}: {
  db?: DbPool;
  yardId: number;
  documentType: string;
  prefix: string;
  year?: number;
  padding?: number;
}) {
  const pool = db || await getDb();
  await ensureDocumentSequences(pool);

  const result = await pool.request()
    .input('yardId', sql.Int, yardId)
    .input('documentType', sql.NVarChar(30), documentType)
    .input('year', sql.Int, year)
    .input('prefix', sql.NVarChar(20), prefix)
    .input('padding', sql.Int, padding)
    .query(`
      DECLARE @lockName NVARCHAR(200) = CONCAT('DocumentSequence:', @yardId, ':', @documentType, ':', @year);
      DECLARE @lockResult INT;
      DECLARE @documentNumber NVARCHAR(80);

      EXEC @lockResult = sp_getapplock
        @Resource = @lockName,
        @LockMode = 'Exclusive',
        @LockOwner = 'Session',
        @LockTimeout = 10000;

      IF @lockResult < 0
        THROW 51000, 'Cannot acquire document sequence lock', 1;

      BEGIN TRY
        IF NOT EXISTS (
          SELECT 1 FROM DocumentSequences WITH (UPDLOCK, HOLDLOCK)
          WHERE yard_id = @yardId AND document_type = @documentType AND sequence_year = @year
        )
        BEGIN
          INSERT INTO DocumentSequences (yard_id, document_type, sequence_year, prefix, next_number, padding)
          VALUES (@yardId, @documentType, @year, @prefix, 1, @padding);
        END

        SELECT TOP 1
          @documentNumber = CONCAT(prefix, '-', @year, '-', RIGHT(REPLICATE('0', padding) + CAST(next_number AS NVARCHAR(20)), padding))
        FROM DocumentSequences WITH (UPDLOCK, HOLDLOCK)
        WHERE yard_id = @yardId AND document_type = @documentType AND sequence_year = @year;

        UPDATE DocumentSequences
        SET next_number = next_number + 1, updated_at = GETDATE()
        WHERE yard_id = @yardId AND document_type = @documentType AND sequence_year = @year;

        EXEC sp_releaseapplock @Resource = @lockName, @LockOwner = 'Session';
        SELECT @documentNumber AS document_number;
      END TRY
      BEGIN CATCH
        EXEC sp_releaseapplock @Resource = @lockName, @LockOwner = 'Session';
        THROW;
      END CATCH
    `);

  return result.recordset[0]?.document_number;
}
