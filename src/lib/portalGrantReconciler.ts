import sql from 'mssql';

export interface PortalGrantReconcilerDbRequest {
  input(name: string, type: unknown, value: unknown): PortalGrantReconcilerDbRequest;
  query(statement: string): Promise<{ recordset: Array<Record<string, unknown>>; rowsAffected?: number[] }>;
}

export interface PortalGrantReconcilerDb {
  request(): PortalGrantReconcilerDbRequest;
}

export interface PortalGrantPreview {
  missing: Array<Record<string, unknown>>;
  stale: Array<Record<string, unknown>>;
  summary: {
    missing_count: number;
    stale_count: number;
  };
}

export interface PortalGrantRepairResult {
  before: PortalGrantPreview;
  after: PortalGrantPreview;
  repaired_missing: number;
  deactivated_stale: number;
}

const MANAGED_SOURCE_TABLES = [
  'Bookings',
  'BookingContainers',
  'Containers',
  'GateTransactions',
  'Invoices',
];

function normalizeLimit(limit?: number) {
  if (!Number.isInteger(limit)) return 500;
  return Math.min(Math.max(Number(limit), 1), 5000);
}

function managedSourceTableList() {
  return MANAGED_SOURCE_TABLES.map((table) => `N'${table}'`).join(', ');
}

function activeGrantMatch(expectedAlias = 'eg', grantAlias = 'pea') {
  return `
    ${grantAlias}.customer_id = ${expectedAlias}.customer_id
    AND ${grantAlias}.entity_type = ${expectedAlias}.entity_type
    AND ${grantAlias}.access_role = ${expectedAlias}.access_role
    AND ${grantAlias}.is_active = 1
    AND (
      (${expectedAlias}.entity_id IS NOT NULL AND ${grantAlias}.entity_id = ${expectedAlias}.entity_id)
      OR (
        ${expectedAlias}.entity_id IS NULL
        AND ${expectedAlias}.entity_ref IS NOT NULL
        AND ${grantAlias}.entity_ref = ${expectedAlias}.entity_ref
      )
    )
  `;
}

export function buildPortalExpectedGrantsSql() {
  return `
    WITH RawExpectedGrants AS (
      SELECT
        party.customer_id,
        CAST(N'booking' AS NVARCHAR(40)) AS entity_type,
        b.booking_id AS entity_id,
        b.booking_number AS entity_ref,
        party.access_role,
        CAST(N'Bookings' AS NVARCHAR(80)) AS source_table,
        b.booking_id AS source_id
      FROM Bookings b
      CROSS APPLY (VALUES
        (COALESCE(b.booking_customer_id, b.customer_id), CAST(N'booking_customer' AS NVARCHAR(40))),
        (b.shipping_line_id, CAST(N'shipping_line' AS NVARCHAR(40))),
        (b.forwarder_id, CAST(N'forwarder' AS NVARCHAR(40))),
        (b.shipper_id, CAST(N'shipper' AS NVARCHAR(40))),
        (b.consignee_id, CAST(N'consignee' AS NVARCHAR(40))),
        (b.trucking_company_id, CAST(N'trucking' AS NVARCHAR(40))),
        (b.bill_to_customer_id, CAST(N'billing' AS NVARCHAR(40)))
      ) party(customer_id, access_role)
      WHERE party.customer_id IS NOT NULL

      UNION ALL

      SELECT
        c.container_owner_id AS customer_id,
        CAST(N'container' AS NVARCHAR(40)) AS entity_type,
        c.container_id AS entity_id,
        c.container_number AS entity_ref,
        CAST(N'owner' AS NVARCHAR(40)) AS access_role,
        CAST(N'Containers' AS NVARCHAR(80)) AS source_table,
        c.container_id AS source_id
      FROM Containers c
      WHERE c.container_owner_id IS NOT NULL

      UNION ALL

      SELECT
        party.customer_id,
        CAST(N'container' AS NVARCHAR(40)) AS entity_type,
        bc.container_id AS entity_id,
        bc.container_number AS entity_ref,
        party.access_role,
        CAST(N'BookingContainers' AS NVARCHAR(80)) AS source_table,
        bc.id AS source_id
      FROM BookingContainers bc
      JOIN Bookings b ON b.booking_id = bc.booking_id
      CROSS APPLY (VALUES
        (COALESCE(b.booking_customer_id, b.customer_id), CAST(N'booking_customer' AS NVARCHAR(40))),
        (b.shipping_line_id, CAST(N'shipping_line' AS NVARCHAR(40))),
        (b.forwarder_id, CAST(N'forwarder' AS NVARCHAR(40))),
        (b.shipper_id, CAST(N'shipper' AS NVARCHAR(40))),
        (b.consignee_id, CAST(N'consignee' AS NVARCHAR(40))),
        (b.trucking_company_id, CAST(N'trucking' AS NVARCHAR(40))),
        (b.bill_to_customer_id, CAST(N'billing' AS NVARCHAR(40)))
      ) party(customer_id, access_role)
      WHERE party.customer_id IS NOT NULL
        AND (bc.container_id IS NOT NULL OR bc.container_number IS NOT NULL)

      UNION ALL

      SELECT
        party.customer_id,
        target.entity_type,
        target.entity_id,
        target.entity_ref,
        party.access_role,
        CAST(N'GateTransactions' AS NVARCHAR(80)) AS source_table,
        gt.transaction_id AS source_id
      FROM GateTransactions gt
      LEFT JOIN Containers c ON c.container_id = gt.container_id
      CROSS APPLY (VALUES
        (gt.container_owner_id, CAST(N'owner' AS NVARCHAR(40))),
        (gt.billing_customer_id, CAST(N'billing' AS NVARCHAR(40))),
        (gt.trucking_company_id, CAST(N'trucking' AS NVARCHAR(40))),
        (gt.driver_user_id, CAST(N'driver' AS NVARCHAR(40)))
      ) party(customer_id, access_role)
      CROSS APPLY (VALUES
        (CAST(N'gate_transaction' AS NVARCHAR(40)), gt.transaction_id, gt.eir_number),
        (CAST(N'eir' AS NVARCHAR(40)), gt.transaction_id, gt.eir_number),
        (CAST(N'container' AS NVARCHAR(40)), gt.container_id, c.container_number)
      ) target(entity_type, entity_id, entity_ref)
      WHERE party.customer_id IS NOT NULL
        AND (target.entity_id IS NOT NULL OR target.entity_ref IS NOT NULL)

      UNION ALL

      SELECT
        bookingGateCustomer.customer_id,
        target.entity_type,
        target.entity_id,
        target.entity_ref,
        CAST(N'booking_customer' AS NVARCHAR(40)) AS access_role,
        CAST(N'GateTransactions' AS NVARCHAR(80)) AS source_table,
        gt.transaction_id AS source_id
      FROM GateTransactions gt
      LEFT JOIN Containers c ON c.container_id = gt.container_id
      OUTER APPLY (
        SELECT TOP 1 COALESCE(gt.booking_customer_id, b.booking_customer_id, b.customer_id) AS customer_id
        FROM Bookings b
        WHERE b.booking_number = gt.booking_ref
        ORDER BY COALESCE(b.eta, b.created_at) DESC, b.booking_id DESC
      ) bookingGateCustomer
      CROSS APPLY (VALUES
        (CAST(N'gate_transaction' AS NVARCHAR(40)), gt.transaction_id, gt.eir_number),
        (CAST(N'eir' AS NVARCHAR(40)), gt.transaction_id, gt.eir_number),
        (CAST(N'container' AS NVARCHAR(40)), gt.container_id, c.container_number)
      ) target(entity_type, entity_id, entity_ref)
      WHERE bookingGateCustomer.customer_id IS NOT NULL
        AND (target.entity_id IS NOT NULL OR target.entity_ref IS NOT NULL)

      UNION ALL

      SELECT
        i.customer_id,
        CAST(N'invoice' AS NVARCHAR(40)) AS entity_type,
        i.invoice_id AS entity_id,
        i.invoice_number AS entity_ref,
        CAST(N'invoice_customer' AS NVARCHAR(40)) AS access_role,
        CAST(N'Invoices' AS NVARCHAR(80)) AS source_table,
        i.invoice_id AS source_id
      FROM Invoices i
      WHERE i.customer_id IS NOT NULL
    ),
    ExpectedGrants AS (
      SELECT
        customer_id,
        entity_type,
        MAX(entity_id) AS entity_id,
        MAX(entity_ref) AS entity_ref,
        access_role,
        MIN(source_table) AS source_table,
        MIN(source_id) AS source_id
      FROM RawExpectedGrants
      WHERE customer_id IS NOT NULL
        AND (entity_id IS NOT NULL OR entity_ref IS NOT NULL)
      GROUP BY
        customer_id,
        entity_type,
        access_role,
        CASE
          WHEN entity_id IS NOT NULL THEN CONCAT(N'id:', entity_id)
          ELSE CONCAT(N'ref:', entity_ref)
        END
    )
  `;
}

function missingGrantsQuery() {
  return `
    ${buildPortalExpectedGrantsSql()},
    MissingGrants AS (
      SELECT
        eg.customer_id,
        eg.entity_type,
        eg.entity_id,
        eg.entity_ref,
        eg.access_role,
        eg.source_table,
        eg.source_id
      FROM ExpectedGrants eg
      WHERE NOT EXISTS (
        SELECT 1
        FROM PortalEntityAccess pea
        WHERE ${activeGrantMatch('eg', 'pea')}
      )
    )
    SELECT TOP (@limit) *
    FROM MissingGrants
    ORDER BY entity_type, customer_id, access_role, entity_id, entity_ref
  `;
}

function staleGrantsQuery() {
  return `
    ${buildPortalExpectedGrantsSql()},
    StaleGrants AS (
      SELECT
        pea.access_id,
        pea.customer_id,
        pea.entity_type,
        pea.entity_id,
        pea.entity_ref,
        pea.access_role,
        pea.source_table,
        pea.source_id
      FROM PortalEntityAccess pea
      WHERE pea.is_active = 1
        AND pea.source_table IN (${managedSourceTableList()})
        AND NOT EXISTS (
          SELECT 1
          FROM ExpectedGrants eg
          WHERE ${activeGrantMatch('eg', 'pea')}
        )
    )
    SELECT TOP (@limit) *
    FROM StaleGrants
    ORDER BY entity_type, customer_id, access_role, entity_id, entity_ref
  `;
}

function insertMissingGrantsQuery() {
  return `
    ${buildPortalExpectedGrantsSql()}
    INSERT INTO PortalEntityAccess (
      customer_id,
      entity_type,
      entity_id,
      entity_ref,
      access_role,
      source_table,
      source_id
    )
    SELECT
      eg.customer_id,
      eg.entity_type,
      eg.entity_id,
      eg.entity_ref,
      eg.access_role,
      eg.source_table,
      eg.source_id
    FROM ExpectedGrants eg
    WHERE NOT EXISTS (
      SELECT 1
      FROM PortalEntityAccess pea
      WHERE ${activeGrantMatch('eg', 'pea')}
    )
  `;
}

function deactivateStaleGrantsQuery() {
  return `
    ${buildPortalExpectedGrantsSql()}
    UPDATE pea
    SET is_active = 0,
        updated_at = GETDATE()
    FROM PortalEntityAccess pea
    WHERE pea.is_active = 1
      AND pea.source_table IN (${managedSourceTableList()})
      AND NOT EXISTS (
        SELECT 1
        FROM ExpectedGrants eg
        WHERE ${activeGrantMatch('eg', 'pea')}
      )
  `;
}

export async function previewPortalEntityAccessGrants(
  db: PortalGrantReconcilerDb,
  options: { limit?: number } = {},
): Promise<PortalGrantPreview> {
  const limit = normalizeLimit(options.limit);
  const missingResult = await db.request()
    .input('limit', sql.Int, limit)
    .query(missingGrantsQuery());
  const staleResult = await db.request()
    .input('limit', sql.Int, limit)
    .query(staleGrantsQuery());

  return {
    missing: missingResult.recordset,
    stale: staleResult.recordset,
    summary: {
      missing_count: missingResult.recordset.length,
      stale_count: staleResult.recordset.length,
    },
  };
}

export async function repairPortalEntityAccessGrants(
  db: PortalGrantReconcilerDb,
  options: { limit?: number } = {},
): Promise<PortalGrantRepairResult> {
  const before = await previewPortalEntityAccessGrants(db, options);

  await db.request().query(insertMissingGrantsQuery());
  await db.request().query(deactivateStaleGrantsQuery());

  const after = await previewPortalEntityAccessGrants(db, options);

  return {
    before,
    after,
    repaired_missing: before.summary.missing_count,
    deactivated_stale: before.summary.stale_count,
  };
}
