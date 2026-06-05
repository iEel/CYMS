#!/usr/bin/env node

/**
 * CYMS — Transport Portal Smoke Seed
 *
 * Preview:
 *   node scripts/seed-transport-smoke.js
 *
 * Execute:
 *   node scripts/seed-transport-smoke.js --confirm --reset-smoke-job
 *
 * Cleanup:
 *   node scripts/seed-transport-smoke.js --cleanup
 *
 * Safety notes:
 *   - preview mode only by default.
 *   - Updates passwords for smoke users only.
 *   - Uses exact smoke identifiers from scripts/transport-smoke-fixture.cjs.
 *   - Smoke credentials are smoke_transport_driver / SmokeDriver123!
 *     and smoke_transport_trucking / SmokeTransport123!.
 */

require('dotenv').config({ path: '.env.local' });

const fs = require('fs');
const path = require('path');
const sql = require('mssql');
const bcrypt = require('bcryptjs');

const {
  SMOKE_PREFIX,
  SMOKE_CUSTOMER,
  SMOKE_USERS,
  SMOKE_CONTAINER,
  SMOKE_BOOKING,
  SMOKE_GATE_OUT_REQUEST,
  SMOKE_PROOF,
  buildPreviewRows,
} = require('./transport-smoke-fixture.cjs');

const args = new Set(process.argv.slice(2));
const isHelp = args.has('--help') || args.has('-h');
const isCleanup = args.has('--cleanup');
const isConfirmed = args.has('--confirm');
const shouldResetSmokeJob = args.has('--reset-smoke-job');

const config = {
  server: process.env.DB_SERVER || 'localhost',
  port: parseInt(process.env.DB_PORT || '1433', 10),
  database: process.env.DB_NAME || 'CYMS_DB',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || '',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    instanceName: process.env.DB_INSTANCE || undefined,
  },
};

const REQUIRED_TABLES = [
  'Roles',
  'Users',
  'Customers',
  'Yards',
  'YardZones',
  'Containers',
  'Bookings',
  'BookingContainers',
  'GateOutRequests',
  'PortalEntityAccess',
  'TransportJobActivities',
  'TransportJobProofs',
];

const REQUIRED_COLUMNS = [
  ['Users', 'customer_id'],
  ['Users', 'customer_portal_role'],
  ['Customers', 'customer_code'],
  ['Customers', 'is_trucking'],
  ['Customers', 'portal_enabled'],
  ['Bookings', 'trucking_company_id'],
  ['GateOutRequests', 'trucking_company_id'],
  ['GateOutRequests', 'driver_user_id'],
  ['PortalEntityAccess', 'permission_scope'],
  ['PortalEntityAccess', 'valid_from'],
  ['PortalEntityAccess', 'valid_until'],
  ['PortalEntityAccess', 'updated_at'],
];

function usage() {
  console.log(`
CYMS — Transport Portal Smoke Seed

Preview only:
  node scripts/seed-transport-smoke.js

Execute seed:
  node scripts/seed-transport-smoke.js --confirm

Execute seed and reset smoke job action history:
  node scripts/seed-transport-smoke.js --confirm --reset-smoke-job

Cleanup smoke-only data:
  node scripts/seed-transport-smoke.js --cleanup

Smoke credentials:
  ${SMOKE_USERS.driver.username} / ${SMOKE_USERS.driver.password}
  ${SMOKE_USERS.trucking.username} / ${SMOKE_USERS.trucking.password}

Required migration:
  node scripts/migrate-runtime-core-schema.js
`);
}

function printPreview() {
  console.log('');
  console.log('🚚 CYMS — Transport Portal Smoke Seed');
  console.log('='.repeat(72));
  console.log(`Database: ${config.server}:${config.port}/${config.database}`);
  console.log('');
  console.log('Planned smoke-only records:');
  for (const row of buildPreviewRows()) {
    console.log(`  - ${row.entity.padEnd(22)} ${row.identifier.padEnd(34)} ${row.action}`);
  }
  console.log('');
  console.log('No database changes were made.');
  console.log('To execute, run:');
  console.log('  node scripts/seed-transport-smoke.js --confirm --reset-smoke-job');
  console.log('');
}

function hasDbValue(value) {
  return value !== null && value !== undefined;
}

async function tableExists(pool, tableName) {
  const result = await pool.request()
    .input('tableName', sql.NVarChar(128), tableName)
    .query(`
      SELECT 1 AS exists_flag
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = 'dbo'
        AND TABLE_NAME = @tableName
    `);
  return result.recordset.length > 0;
}

async function columnExists(pool, tableName, columnName) {
  const result = await pool.request()
    .input('tableName', sql.NVarChar(128), tableName)
    .input('columnName', sql.NVarChar(128), columnName)
    .query(`
      SELECT 1 AS exists_flag
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo'
        AND TABLE_NAME = @tableName
        AND COLUMN_NAME = @columnName
    `);
  return result.recordset.length > 0;
}

async function assertRequiredSchema(pool) {
  const missingTables = [];
  for (const tableName of REQUIRED_TABLES) {
    if (!(await tableExists(pool, tableName))) missingTables.push(tableName);
  }

  const missingColumns = [];
  for (const [tableName, columnName] of REQUIRED_COLUMNS) {
    if (missingTables.includes(tableName)) continue;
    if (!(await columnExists(pool, tableName, columnName))) {
      missingColumns.push(`${tableName}.${columnName}`);
    }
  }

  if (missingTables.length > 0 || missingColumns.length > 0) {
    const details = [
      missingTables.length ? `Missing tables: ${missingTables.join(', ')}` : null,
      missingColumns.length ? `Missing columns: ${missingColumns.join(', ')}` : null,
    ].filter(Boolean).join('\n');
    throw new Error(`${details}\nRun: node scripts/migrate-runtime-core-schema.js`);
  }
}

async function firstScalar(pool, query, inputs = []) {
  const request = pool.request();
  for (const input of inputs) request.input(input.name, input.type, input.value);
  const result = await request.query(query);
  const row = result.recordset[0];
  if (!row) return null;
  return row[Object.keys(row)[0]];
}

async function ensureCustomerRole(pool) {
  const existingRoleId = await firstScalar(pool, `
    SELECT role_id FROM Roles WHERE role_code = N'customer'
  `);
  if (hasDbValue(existingRoleId)) return Number(existingRoleId);

  const result = await pool.request()
    .input('roleCode', sql.NVarChar(30), 'customer')
    .input('roleName', sql.NVarChar(100), 'Customer Portal')
    .input('description', sql.NVarChar(500), 'Customer portal user role')
    .query(`
      INSERT INTO Roles (role_code, role_name, description, is_system)
      OUTPUT INSERTED.role_id
      VALUES (@roleCode, @roleName, @description, 1)
    `);
  return Number(result.recordset[0].role_id);
}

async function ensureYard(pool) {
  const existingYardId = await firstScalar(pool, `
    SELECT TOP 1 yard_id FROM Yards WHERE ISNULL(is_active, 1) = 1 ORDER BY yard_id
  `);
  if (hasDbValue(existingYardId)) return Number(existingYardId);

  const result = await pool.request()
    .input('yardName', sql.NVarChar(100), `${SMOKE_PREFIX} Yard`)
    .input('yardCode', sql.NVarChar(20), 'SMK-YARD')
    .input('address', sql.NVarChar(500), 'Smoke transport yard')
    .query(`
      INSERT INTO Yards (yard_name, yard_code, address, is_active)
      OUTPUT INSERTED.yard_id
      VALUES (@yardName, @yardCode, @address, 1)
    `);
  return Number(result.recordset[0].yard_id);
}

async function ensureZone(pool, yardId) {
  const existingZoneId = await firstScalar(pool, `
    SELECT TOP 1 zone_id
    FROM YardZones
    WHERE yard_id = @yardId
      AND ISNULL(is_active, 1) = 1
    ORDER BY zone_id
  `, [{ name: 'yardId', type: sql.Int, value: yardId }]);
  if (hasDbValue(existingZoneId)) return Number(existingZoneId);

  const result = await pool.request()
    .input('yardId', sql.Int, yardId)
    .input('zoneName', sql.NVarChar(50), 'SMOKE')
    .input('zoneType', sql.NVarChar(30), 'dry')
    .query(`
      INSERT INTO YardZones (yard_id, zone_name, zone_type, max_tier, max_bay, max_row, size_restriction, is_active)
      OUTPUT INSERTED.zone_id
      VALUES (@yardId, @zoneName, @zoneType, 5, 20, 10, N'any', 1)
    `);
  return Number(result.recordset[0].zone_id);
}

async function upsertSmokeCustomer(pool) {
  const existingCustomerId = await firstScalar(pool, `
    SELECT customer_id FROM Customers WHERE customer_code = @customerCode
  `, [{ name: 'customerCode', type: sql.VarChar(20), value: SMOKE_CUSTOMER.customer_code }]);

  if (hasDbValue(existingCustomerId)) {
    await pool.request()
      .input('customerId', sql.Int, Number(existingCustomerId))
      .input('customerName', sql.NVarChar(200), SMOKE_CUSTOMER.customer_name)
      .input('customerType', sql.NVarChar(30), SMOKE_CUSTOMER.customer_type)
      .query(`
        UPDATE Customers
        SET customer_name = @customerName,
            customer_type = @customerType,
            is_trucking = 1,
            portal_enabled = 1,
            is_active = 1,
            updated_at = GETDATE()
        WHERE customer_id = @customerId
      `);
    return Number(existingCustomerId);
  }

  const result = await pool.request()
    .input('customerCode', sql.VarChar(20), SMOKE_CUSTOMER.customer_code)
    .input('customerName', sql.NVarChar(200), SMOKE_CUSTOMER.customer_name)
    .input('customerType', sql.NVarChar(30), SMOKE_CUSTOMER.customer_type)
    .input('contactEmail', sql.NVarChar(100), 'smoke.transport@example.test')
    .query(`
      INSERT INTO Customers (
        customer_code, customer_name, customer_type,
        is_line, is_forwarder, is_trucking, is_shipper, is_consignee,
        contact_email, portal_enabled, is_active
      )
      OUTPUT INSERTED.customer_id
      VALUES (
        @customerCode, @customerName, @customerType,
        0, 0, 1, 0, 0,
        @contactEmail, 1, 1
      )
    `);
  return Number(result.recordset[0].customer_id);
}

async function upsertSmokeUser(pool, user, roleId, customerId) {
  const passwordHash = await bcrypt.hash(user.password, 10);
  const existingUserId = await firstScalar(pool, `
    SELECT user_id FROM Users WHERE username = @username
  `, [{ name: 'username', type: sql.NVarChar(50), value: user.username }]);

  if (hasDbValue(existingUserId)) {
    await pool.request()
      .input('userId', sql.Int, Number(existingUserId))
      .input('passwordHash', sql.NVarChar(255), passwordHash)
      .input('fullName', sql.NVarChar(100), user.fullName)
      .input('roleId', sql.Int, roleId)
      .input('email', sql.NVarChar(100), user.email)
      .input('customerId', sql.Int, customerId)
      .input('portalRole', sql.NVarChar(40), user.portalRole)
      .query(`
        UPDATE Users
        SET password_hash = @passwordHash,
            full_name = @fullName,
            role_id = @roleId,
            email = @email,
            status = 'active',
            customer_id = @customerId,
            customer_portal_role = @portalRole,
            failed_login_count = 0,
            locked_at = NULL,
            updated_at = GETDATE()
        WHERE user_id = @userId
          AND username IN (N'smoke_transport_driver', N'smoke_transport_trucking')
      `);
    return Number(existingUserId);
  }

  const result = await pool.request()
    .input('username', sql.NVarChar(50), user.username)
    .input('passwordHash', sql.NVarChar(255), passwordHash)
    .input('fullName', sql.NVarChar(100), user.fullName)
    .input('roleId', sql.Int, roleId)
    .input('email', sql.NVarChar(100), user.email)
    .input('customerId', sql.Int, customerId)
    .input('portalRole', sql.NVarChar(40), user.portalRole)
    .query(`
      INSERT INTO Users (
        username, password_hash, full_name, role_id, email, status,
        customer_id, customer_portal_role, password_changed_at
      )
      OUTPUT INSERTED.user_id
      VALUES (
        @username, @passwordHash, @fullName, @roleId, @email, 'active',
        @customerId, @portalRole, GETDATE()
      )
    `);
  return Number(result.recordset[0].user_id);
}

async function upsertSmokeContainer(pool, yardId, zoneId) {
  const existingContainerId = await firstScalar(pool, `
    SELECT container_id FROM Containers WHERE container_number = @containerNumber
  `, [{ name: 'containerNumber', type: sql.NVarChar(11), value: SMOKE_CONTAINER.container_number }]);

  if (hasDbValue(existingContainerId)) {
    await pool.request()
      .input('containerId', sql.Int, Number(existingContainerId))
      .input('size', sql.NVarChar(5), SMOKE_CONTAINER.size)
      .input('type', sql.NVarChar(10), SMOKE_CONTAINER.type)
      .input('status', sql.NVarChar(20), SMOKE_CONTAINER.status)
      .input('yardId', sql.Int, yardId)
      .input('zoneId', sql.Int, zoneId)
      .input('bay', sql.Int, SMOKE_CONTAINER.bay)
      .input('rowNo', sql.Int, SMOKE_CONTAINER.row)
      .input('tier', sql.Int, SMOKE_CONTAINER.tier)
      .query(`
        UPDATE Containers
        SET size = @size,
            type = @type,
            status = @status,
            yard_id = @yardId,
            zone_id = @zoneId,
            bay = @bay,
            [row] = @rowNo,
            tier = @tier,
            shipping_line = N'SMOKE LINE',
            is_laden = 0,
            is_soc = 0,
            updated_at = GETDATE()
        WHERE container_id = @containerId
      `);
    return Number(existingContainerId);
  }

  const result = await pool.request()
    .input('containerNumber', sql.NVarChar(11), SMOKE_CONTAINER.container_number)
    .input('size', sql.NVarChar(5), SMOKE_CONTAINER.size)
    .input('type', sql.NVarChar(10), SMOKE_CONTAINER.type)
    .input('status', sql.NVarChar(20), SMOKE_CONTAINER.status)
    .input('yardId', sql.Int, yardId)
    .input('zoneId', sql.Int, zoneId)
    .input('bay', sql.Int, SMOKE_CONTAINER.bay)
    .input('rowNo', sql.Int, SMOKE_CONTAINER.row)
    .input('tier', sql.Int, SMOKE_CONTAINER.tier)
    .query(`
      INSERT INTO Containers (
        container_number, size, type, status, yard_id, zone_id,
        bay, [row], tier, shipping_line, is_laden, is_soc, gate_in_date
      )
      OUTPUT INSERTED.container_id
      VALUES (
        @containerNumber, @size, @type, @status, @yardId, @zoneId,
        @bay, @rowNo, @tier, N'SMOKE LINE', 0, 0, GETDATE()
      )
    `);
  return Number(result.recordset[0].container_id);
}

async function inputOptional(request, pool, tableName, columnName, type, value, columns, values) {
  if (!(await columnExists(pool, tableName, columnName))) return;
  const param = columnName.replace(/[^A-Za-z0-9_]/g, '');
  request.input(param, type, value);
  columns.push(columnName);
  values.push(`@${param}`);
}

async function reseedIdentityToCurrentMax(pool, tableName, idColumn) {
  const maxValue = await firstScalar(pool, `
    SELECT ISNULL(MAX(${idColumn}), 0) AS max_id
    FROM ${tableName}
  `);
  const safeMax = Number.isInteger(Number(maxValue)) && Number(maxValue) >= 0
    ? Number(maxValue)
    : 0;
  await pool.request().query(`DBCC CHECKIDENT ('dbo.${tableName}', RESEED, ${safeMax}) WITH NO_INFOMSGS`);
}

async function deleteInvalidSmokeBooking(pool, bookingId) {
  await pool.request()
    .input('bookingId', sql.Int, bookingId)
    .input('bookingNumber', sql.NVarChar(100), SMOKE_BOOKING.booking_number)
    .input('containerNumber', sql.NVarChar(20), SMOKE_CONTAINER.container_number)
    .input('bookingRef', sql.NVarChar(100), SMOKE_GATE_OUT_REQUEST.booking_ref)
    .input('notes', sql.NVarChar(500), SMOKE_GATE_OUT_REQUEST.notes)
    .query(`
      DELETE p
      FROM TransportJobProofs p
      JOIN GateOutRequests gor ON gor.request_id = p.job_id
        AND p.job_source = N'gate_out_request'
      WHERE gor.booking_ref = @bookingRef
        AND gor.notes = @notes;

      DELETE a
      FROM TransportJobActivities a
      JOIN GateOutRequests gor ON gor.request_id = a.job_id
        AND a.job_source = N'gate_out_request'
      WHERE gor.booking_ref = @bookingRef
        AND gor.notes = @notes;

      DELETE pea
      FROM PortalEntityAccess pea
      WHERE pea.access_role = N'trucking'
        AND (
          pea.entity_ref IN (@bookingNumber, @containerNumber, @bookingRef)
          OR pea.source_table IN (N'Bookings', N'BookingContainers', N'GateOutRequests')
        )
        AND (
          pea.source_id = @bookingId
          OR pea.entity_id = @bookingId
          OR pea.entity_ref IN (@bookingNumber, @containerNumber, @bookingRef)
        );

      DELETE gor
      FROM GateOutRequests gor
      WHERE gor.booking_ref = @bookingRef
        AND gor.notes = @notes;

      DELETE bc
      FROM BookingContainers bc
      WHERE bc.booking_id = @bookingId
        AND bc.container_number = @containerNumber;

      DELETE b
      FROM Bookings b
      WHERE b.booking_id = @bookingId
        AND b.booking_number = @bookingNumber;
    `);
  await reseedIdentityToCurrentMax(pool, 'Bookings', 'booking_id');
  await reseedIdentityToCurrentMax(pool, 'GateOutRequests', 'request_id');
}

async function upsertSmokeBooking(pool, yardId, customerId) {
  const existingBookingId = await firstScalar(pool, `
    SELECT booking_id FROM Bookings WHERE booking_number = @bookingNumber
  `, [{ name: 'bookingNumber', type: sql.NVarChar(100), value: SMOKE_BOOKING.booking_number }]);

  if (hasDbValue(existingBookingId)) {
    const bookingId = Number(existingBookingId);
    if (!Number.isInteger(bookingId) || bookingId <= 0) {
      await deleteInvalidSmokeBooking(pool, bookingId);
      return upsertSmokeBooking(pool, yardId, customerId);
    }

    await pool.request()
      .input('bookingId', sql.Int, bookingId)
      .input('yardId', sql.Int, yardId)
      .input('customerId', sql.Int, customerId)
      .input('status', sql.NVarChar(20), SMOKE_BOOKING.status)
      .input('notes', sql.NVarChar(500), `${SMOKE_PREFIX} smoke booking`)
      .query(`
        UPDATE Bookings
        SET yard_id = @yardId,
            customer_id = @customerId,
            booking_customer_id = @customerId,
            trucking_company_id = @customerId,
            bill_to_customer_id = @customerId,
            booking_type = N'gate_out',
            status = @status,
            container_count = 1,
            container_size = N'20',
            container_type = N'GP',
            notes = @notes
        WHERE booking_id = @bookingId
      `);
    return bookingId;
  }

  const request = pool.request()
    .input('bookingNumber', sql.NVarChar(100), SMOKE_BOOKING.booking_number)
    .input('yardId', sql.Int, yardId)
    .input('customerId', sql.Int, customerId)
    .input('bookingType', sql.NVarChar(20), 'gate_out')
    .input('status', sql.NVarChar(20), SMOKE_BOOKING.status)
    .input('vesselName', sql.NVarChar(100), `${SMOKE_PREFIX} VESSEL`)
    .input('voyageNumber', sql.NVarChar(50), 'SMK001')
    .input('containerCount', sql.Int, 1)
    .input('containerSize', sql.NVarChar(5), SMOKE_CONTAINER.size)
    .input('containerType', sql.NVarChar(10), SMOKE_CONTAINER.type)
    .input('notes', sql.NVarChar(500), `${SMOKE_PREFIX} smoke booking`);
  const columns = [
    'booking_number',
    'yard_id',
    'customer_id',
    'booking_type',
    'status',
    'vessel_name',
    'voyage_number',
    'container_count',
    'container_size',
    'container_type',
    'notes',
  ];
  const values = [
    '@bookingNumber',
    '@yardId',
    '@customerId',
    '@bookingType',
    '@status',
    '@vesselName',
    '@voyageNumber',
    '@containerCount',
    '@containerSize',
    '@containerType',
    '@notes',
  ];

  await inputOptional(request, pool, 'Bookings', 'booking_customer_id', sql.Int, customerId, columns, values);
  await inputOptional(request, pool, 'Bookings', 'trucking_company_id', sql.Int, customerId, columns, values);
  await inputOptional(request, pool, 'Bookings', 'bill_to_customer_id', sql.Int, customerId, columns, values);
  await inputOptional(request, pool, 'Bookings', 'valid_from', sql.DateTime2, new Date(), columns, values);

  const result = await request.query(`
    INSERT INTO Bookings (${columns.join(', ')})
    OUTPUT INSERTED.booking_id AS booking_id
    VALUES (${values.join(', ')})
  `);
  const bookingId = Number(result.recordset[0].booking_id);
  if (!Number.isInteger(bookingId) || bookingId <= 0) {
    await deleteInvalidSmokeBooking(pool, bookingId);
    return upsertSmokeBooking(pool, yardId, customerId);
  }
  return bookingId;
}

async function upsertBookingContainer(pool, bookingId, containerId) {
  const existingId = await firstScalar(pool, `
    SELECT id
    FROM BookingContainers
    WHERE booking_id = @bookingId
      AND container_number = @containerNumber
  `, [
    { name: 'bookingId', type: sql.Int, value: bookingId },
    { name: 'containerNumber', type: sql.NVarChar(20), value: SMOKE_CONTAINER.container_number },
  ]);

  if (hasDbValue(existingId)) {
    await pool.request()
      .input('id', sql.Int, Number(existingId))
      .input('containerId', sql.Int, containerId)
      .query(`
        UPDATE BookingContainers
        SET container_id = @containerId,
            status = N'received',
            gate_in_at = COALESCE(gate_in_at, GETDATE())
        WHERE id = @id
      `);
    return Number(existingId);
  }

  const result = await pool.request()
    .input('bookingId', sql.Int, bookingId)
    .input('containerId', sql.Int, containerId)
    .input('containerNumber', sql.NVarChar(20), SMOKE_CONTAINER.container_number)
    .query(`
      INSERT INTO BookingContainers (booking_id, container_id, container_number, status, gate_in_at)
      OUTPUT INSERTED.id
      VALUES (@bookingId, @containerId, @containerNumber, N'received', GETDATE())
    `);
  return Number(result.recordset[0].id);
}

async function deleteInvalidSmokeGateOutRequest(pool, requestId) {
  await resetSmokeJob(pool, requestId);
  await pool.request()
    .input('requestId', sql.Int, requestId)
    .input('bookingRef', sql.NVarChar(100), SMOKE_GATE_OUT_REQUEST.booking_ref)
    .input('notes', sql.NVarChar(500), SMOKE_GATE_OUT_REQUEST.notes)
    .query(`
      DELETE gor
      FROM GateOutRequests gor
      WHERE gor.request_id = @requestId
        AND gor.booking_ref = @bookingRef
        AND gor.notes = @notes
    `);
  await reseedIdentityToCurrentMax(pool, 'GateOutRequests', 'request_id');
}

async function upsertGateOutRequest(pool, yardId, containerId, bookingId, customerId, driverUserId) {
  const existingRequestId = await firstScalar(pool, `
    SELECT TOP 1 request_id
    FROM GateOutRequests
    WHERE container_id = @containerId
      AND booking_ref = @bookingRef
      AND notes = @notes
    ORDER BY request_id DESC
  `, [
    { name: 'containerId', type: sql.Int, value: containerId },
    { name: 'bookingRef', type: sql.NVarChar(100), value: SMOKE_GATE_OUT_REQUEST.booking_ref },
    { name: 'notes', type: sql.NVarChar(500), value: SMOKE_GATE_OUT_REQUEST.notes },
  ]);

  if (hasDbValue(existingRequestId)) {
    const requestId = Number(existingRequestId);
    if (!Number.isInteger(requestId) || requestId <= 0) {
      await deleteInvalidSmokeGateOutRequest(pool, requestId);
      return upsertGateOutRequest(pool, yardId, containerId, bookingId, customerId, driverUserId);
    }

    await pool.request()
      .input('requestId', sql.Int, requestId)
      .input('yardId', sql.Int, yardId)
      .input('containerId', sql.Int, containerId)
      .input('bookingId', sql.Int, bookingId)
      .input('bookingRef', sql.NVarChar(100), SMOKE_GATE_OUT_REQUEST.booking_ref)
      .input('truckingCompanyId', sql.Int, customerId)
      .input('driverUserId', sql.Int, driverUserId)
      .input('driverName', sql.NVarChar(100), SMOKE_GATE_OUT_REQUEST.driver_name)
      .input('driverLicense', sql.NVarChar(50), SMOKE_GATE_OUT_REQUEST.driver_license)
      .input('truckPlate', sql.NVarChar(20), SMOKE_GATE_OUT_REQUEST.truck_plate)
      .input('notes', sql.NVarChar(500), SMOKE_GATE_OUT_REQUEST.notes)
      .query(`
        UPDATE GateOutRequests
        SET yard_id = @yardId,
            container_id = @containerId,
            booking_id = @bookingId,
            booking_ref = @bookingRef,
            trucking_company_id = @truckingCompanyId,
            billing_customer_id = @truckingCompanyId,
            driver_user_id = @driverUserId,
            driver_name = @driverName,
            driver_license = @driverLicense,
            truck_plate = @truckPlate,
            notes = @notes,
            status = N'requested',
            completed_at = NULL,
            updated_at = GETDATE()
        WHERE request_id = @requestId
      `);
    return requestId;
  }

  const result = await pool.request()
    .input('yardId', sql.Int, yardId)
    .input('containerId', sql.Int, containerId)
    .input('bookingId', sql.Int, bookingId)
    .input('bookingRef', sql.NVarChar(100), SMOKE_GATE_OUT_REQUEST.booking_ref)
    .input('truckingCompanyId', sql.Int, customerId)
    .input('driverUserId', sql.Int, driverUserId)
    .input('driverName', sql.NVarChar(100), SMOKE_GATE_OUT_REQUEST.driver_name)
    .input('driverLicense', sql.NVarChar(50), SMOKE_GATE_OUT_REQUEST.driver_license)
    .input('truckPlate', sql.NVarChar(20), SMOKE_GATE_OUT_REQUEST.truck_plate)
    .input('notes', sql.NVarChar(500), SMOKE_GATE_OUT_REQUEST.notes)
    .query(`
      INSERT INTO GateOutRequests (
        yard_id, container_id, booking_id, booking_ref,
        trucking_company_id, billing_customer_id, driver_user_id,
        driver_name, driver_license, truck_plate, notes, status, requested_at
      )
      OUTPUT INSERTED.request_id AS request_id
      VALUES (
        @yardId, @containerId, @bookingId, @bookingRef,
        @truckingCompanyId, @truckingCompanyId, @driverUserId,
        @driverName, @driverLicense, @truckPlate, @notes, N'requested', GETDATE()
      )
    `);
  const requestId = Number(result.recordset[0].request_id);
  if (!Number.isInteger(requestId) || requestId <= 0) {
    throw new Error(`GateOutRequests returned invalid smoke request id: ${requestId}`);
  }
  return requestId;
}

async function resetSmokeJob(pool, requestId) {
  await pool.request()
    .input('jobSource', sql.NVarChar(40), 'gate_out_request')
    .input('jobId', sql.Int, requestId)
    .query(`
      DELETE FROM TransportJobProofs
      WHERE job_source = @jobSource
        AND job_id = @jobId;

      DELETE FROM TransportJobActivities
      WHERE job_source = @jobSource
        AND job_id = @jobId;
    `);
}

async function upsertPortalGrant(pool, grant) {
  const permissionScope = JSON.stringify({
    view: true,
    download: false,
    transport: true,
    actions: ['confirm_job', 'add_proof', 'report_issue', 'mark_arrived'],
    smoke: true,
  });

  await pool.request()
    .input('customerId', sql.Int, grant.customerId)
    .input('entityType', sql.NVarChar(40), grant.entityType)
    .input('entityId', sql.Int, grant.entityId || null)
    .input('entityRef', sql.NVarChar(100), grant.entityRef || null)
    .input('accessRole', sql.NVarChar(40), grant.accessRole)
    .input('permissionScope', sql.NVarChar(sql.MAX), permissionScope)
    .input('sourceTable', sql.NVarChar(80), grant.sourceTable)
    .input('sourceId', sql.Int, grant.sourceId || null)
    .query(`
      IF EXISTS (
        SELECT 1
        FROM PortalEntityAccess
        WHERE customer_id = @customerId
          AND entity_type = @entityType
          AND access_role = @accessRole
          AND source_table = @sourceTable
          AND ISNULL(source_id, -1) = ISNULL(@sourceId, -1)
          AND (
            (entity_id IS NOT NULL AND entity_id = @entityId)
            OR (entity_ref IS NOT NULL AND entity_ref = @entityRef)
          )
      )
      BEGIN
        UPDATE PortalEntityAccess
        SET entity_id = @entityId,
            entity_ref = @entityRef,
            permission_scope = @permissionScope,
            valid_from = COALESCE(valid_from, GETDATE()),
            valid_until = NULL,
            is_active = 1,
            updated_at = GETDATE()
        WHERE customer_id = @customerId
          AND entity_type = @entityType
          AND access_role = @accessRole
          AND source_table = @sourceTable
          AND ISNULL(source_id, -1) = ISNULL(@sourceId, -1)
          AND (
            (entity_id IS NOT NULL AND entity_id = @entityId)
            OR (entity_ref IS NOT NULL AND entity_ref = @entityRef)
          );
      END
      ELSE
      BEGIN
        INSERT INTO PortalEntityAccess (
          customer_id, entity_type, entity_id, entity_ref, access_role,
          permission_scope, valid_from, valid_until, source_table, source_id,
          is_active, created_at, updated_at
        )
        VALUES (
          @customerId, @entityType, @entityId, @entityRef, @accessRole,
          @permissionScope, GETDATE(), NULL, @sourceTable, @sourceId,
          1, GETDATE(), GETDATE()
        );
      END
    `);
}

async function ensureSmokeGrants(pool, ids) {
  await upsertPortalGrant(pool, {
    customerId: ids.customerId,
    entityType: 'booking',
    entityId: ids.bookingId,
    entityRef: SMOKE_BOOKING.booking_number,
    accessRole: 'trucking',
    sourceTable: 'Bookings',
    sourceId: ids.bookingId,
  });
  await upsertPortalGrant(pool, {
    customerId: ids.customerId,
    entityType: 'container',
    entityId: ids.containerId,
    entityRef: SMOKE_CONTAINER.container_number,
    accessRole: 'trucking',
    sourceTable: 'BookingContainers',
    sourceId: ids.bookingContainerId,
  });
  await upsertPortalGrant(pool, {
    customerId: ids.customerId,
    entityType: 'gate_out_request',
    entityId: ids.requestId,
    entityRef: `request-${ids.requestId}`,
    accessRole: 'trucking',
    sourceTable: 'GateOutRequests',
    sourceId: ids.requestId,
  });
}

function ensureSmokeProofFile() {
  const absolutePath = path.resolve(process.cwd(), SMOKE_PROOF.relativePath);
  const uploadsRoot = path.resolve(process.cwd(), 'public', 'uploads');
  if (!absolutePath.startsWith(uploadsRoot + path.sep)) {
    throw new Error(`Refusing to create proof outside public/uploads: ${absolutePath}`);
  }
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  if (fs.existsSync(absolutePath)) return absolutePath;

  const tinyJpegBase64 =
    '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAEFAqf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/ASP/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/ASP/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAY/Ar//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/IV//2gAMAwEAAgADAAAAEP/EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQMBAT8QH//EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQIBAT8QH//EABQQAQAAAAAAAAAAAAAAAAAAABD/2gAIAQEAAT8QH//Z';
  fs.writeFileSync(absolutePath, Buffer.from(tinyJpegBase64, 'base64'));
  return absolutePath;
}

function deleteSmokeProofFile() {
  const absolutePath = path.resolve(process.cwd(), SMOKE_PROOF.relativePath);
  const uploadsRoot = path.resolve(process.cwd(), 'public', 'uploads');
  if (!absolutePath.startsWith(uploadsRoot + path.sep)) {
    throw new Error(`Refusing to delete proof outside public/uploads: ${absolutePath}`);
  }
  if (fs.existsSync(absolutePath)) {
    fs.rmSync(absolutePath, { force: true });
    return 1;
  }
  return 0;
}

function bindSmokeInputs(request) {
  request.input('customerCode', sql.VarChar(20), SMOKE_CUSTOMER.customer_code);
  request.input('driverUsername', sql.NVarChar(50), SMOKE_USERS.driver.username);
  request.input('truckingUsername', sql.NVarChar(50), SMOKE_USERS.trucking.username);
  request.input('containerNumber', sql.NVarChar(20), SMOKE_CONTAINER.container_number);
  request.input('bookingNumber', sql.NVarChar(100), SMOKE_BOOKING.booking_number);
  request.input('bookingRef', sql.NVarChar(100), SMOKE_GATE_OUT_REQUEST.booking_ref);
  request.input('notes', sql.NVarChar(500), SMOKE_GATE_OUT_REQUEST.notes);
  request.input('driverName', sql.NVarChar(100), SMOKE_GATE_OUT_REQUEST.driver_name);
  request.input('truckPlate', sql.NVarChar(20), SMOKE_GATE_OUT_REQUEST.truck_plate);
  request.input('smokeScopeMarker', sql.NVarChar(100), '%"smoke":true%');
  return request;
}

async function runSmokeDelete(transaction, label, query) {
  const request = bindSmokeInputs(new sql.Request(transaction));
  const result = await request.query(query);
  const rows = result.rowsAffected.reduce((sum, count) => sum + count, 0);
  return { label, rows };
}

async function cleanupSmokeData() {
  let pool;
  let transaction;
  try {
    console.log('');
    console.log('🧹 CYMS — Transport Portal Smoke Cleanup');
    console.log('='.repeat(72));
    console.log(`Database: ${config.server}:${config.port}/${config.database}`);
    console.log('');

    pool = await sql.connect(config);
    await assertRequiredSchema(pool);

    transaction = new sql.Transaction(pool);
    await transaction.begin();

    const results = [];
    results.push(await runSmokeDelete(transaction, 'transport proof rows', `
      DELETE p
      FROM TransportJobProofs p
      JOIN GateOutRequests gor
        ON gor.request_id = p.job_id
       AND p.job_source = N'gate_out_request'
      WHERE gor.booking_ref = @bookingRef
        AND (gor.notes = @notes OR gor.driver_name = @driverName OR gor.truck_plate = @truckPlate);
    `));
    results.push(await runSmokeDelete(transaction, 'transport activity rows', `
      DELETE a
      FROM TransportJobActivities a
      JOIN GateOutRequests gor
        ON gor.request_id = a.job_id
       AND a.job_source = N'gate_out_request'
      WHERE gor.booking_ref = @bookingRef
        AND (gor.notes = @notes OR gor.driver_name = @driverName OR gor.truck_plate = @truckPlate);
    `));
    results.push(await runSmokeDelete(transaction, 'portal grants', `
      DELETE pea
      FROM PortalEntityAccess pea
      LEFT JOIN Customers c ON c.customer_id = pea.customer_id
      WHERE (
          c.customer_code = @customerCode
          OR pea.entity_ref IN (@bookingNumber, @containerNumber, @bookingRef)
          OR pea.permission_scope LIKE @smokeScopeMarker
        )
        AND (
          pea.entity_type IN (N'booking', N'container', N'gate_out_request')
          OR pea.source_table IN (N'Bookings', N'BookingContainers', N'GateOutRequests')
          OR pea.access_role = N'trucking'
        );
    `));
    results.push(await runSmokeDelete(transaction, 'gate-out requests', `
      DELETE gor
      FROM GateOutRequests gor
      WHERE gor.booking_ref = @bookingRef
        AND (gor.notes = @notes OR gor.driver_name = @driverName OR gor.truck_plate = @truckPlate);
    `));
    results.push(await runSmokeDelete(transaction, 'booking/container links', `
      DELETE bc
      FROM BookingContainers bc
      LEFT JOIN Bookings b ON b.booking_id = bc.booking_id
      WHERE bc.container_number = @containerNumber
         OR b.booking_number = @bookingNumber;
    `));
    results.push(await runSmokeDelete(transaction, 'bookings', `
      DELETE b
      FROM Bookings b
      WHERE b.booking_number = @bookingNumber;
    `));
    results.push(await runSmokeDelete(transaction, 'containers', `
      DELETE c
      FROM Containers c
      WHERE c.container_number = @containerNumber;
    `));
    results.push(await runSmokeDelete(transaction, 'audit logs', `
      DELETE al
      FROM AuditLog al
      JOIN Users u ON u.user_id = al.user_id
      WHERE u.username IN (@driverUsername, @truckingUsername);
    `));
    results.push(await runSmokeDelete(transaction, 'user yard access', `
      DELETE uya
      FROM UserYardAccess uya
      JOIN Users u ON u.user_id = uya.user_id
      WHERE u.username IN (@driverUsername, @truckingUsername);
    `));
    results.push(await runSmokeDelete(transaction, 'smoke users', `
      DELETE u
      FROM Users u
      WHERE u.username IN (@driverUsername, @truckingUsername);
    `));
    results.push(await runSmokeDelete(transaction, 'smoke customer', `
      DELETE c
      FROM Customers c
      WHERE c.customer_code = @customerCode;
    `));

    await transaction.commit();
    transaction = null;

    await reseedIdentityToCurrentMax(pool, 'Bookings', 'booking_id');
    await reseedIdentityToCurrentMax(pool, 'GateOutRequests', 'request_id');

    const deletedProofFile = deleteSmokeProofFile();

    console.log('Cleanup complete. Smoke-only records deleted:');
    for (const result of results) {
      console.log(`  - ${result.label.padEnd(26)} ${result.rows}`);
    }
    console.log(`  - ${'proof file'.padEnd(26)} ${deletedProofFile}`);
    console.log('');
  } finally {
    if (transaction) await transaction.rollback();
    if (pool) await pool.close();
  }
}

async function seed() {
  let pool;
  try {
    console.log('');
    console.log('🚚 CYMS — Transport Portal Smoke Seed');
    console.log('='.repeat(72));
    console.log(`Database: ${config.server}:${config.port}/${config.database}`);
    console.log('');

    pool = await sql.connect(config);
    await assertRequiredSchema(pool);

    const roleId = await ensureCustomerRole(pool);
    const yardId = await ensureYard(pool);
    const zoneId = await ensureZone(pool, yardId);
    const customerId = await upsertSmokeCustomer(pool);
    const truckingUserId = await upsertSmokeUser(pool, SMOKE_USERS.trucking, roleId, customerId);
    const driverUserId = await upsertSmokeUser(pool, SMOKE_USERS.driver, roleId, customerId);
    const containerId = await upsertSmokeContainer(pool, yardId, zoneId);
    const bookingId = await upsertSmokeBooking(pool, yardId, customerId);
    const bookingContainerId = await upsertBookingContainer(pool, bookingId, containerId);
    const requestId = await upsertGateOutRequest(pool, yardId, containerId, bookingId, customerId, driverUserId);

    if (shouldResetSmokeJob) {
      await resetSmokeJob(pool, requestId);
    }

    await ensureSmokeGrants(pool, {
      customerId,
      containerId,
      bookingId,
      bookingContainerId,
      requestId,
    });
    const proofPath = ensureSmokeProofFile();

    console.log('Seed complete. Smoke users only passwords were set for deterministic login.');
    console.log('');
    console.log('Smoke credentials:');
    console.log(`  Driver:   ${SMOKE_USERS.driver.username} / ${SMOKE_USERS.driver.password}`);
    console.log(`  Trucking: ${SMOKE_USERS.trucking.username} / ${SMOKE_USERS.trucking.password}`);
    console.log('');
    console.log('Smoke records:');
    console.log(`  Customer ID: ${customerId} (${SMOKE_CUSTOMER.customer_code})`);
    console.log(`  Driver User ID: ${driverUserId}`);
    console.log(`  Trucking User ID: ${truckingUserId}`);
    console.log(`  Container: ${SMOKE_CONTAINER.container_number} (#${containerId})`);
    console.log(`  Booking: ${SMOKE_BOOKING.booking_number} (#${bookingId})`);
    console.log(`  Transport Job: request-${requestId}`);
    console.log(`  Proof file: ${proofPath}`);
    console.log('');
    console.log('Open: http://localhost:3005/transport');
  } finally {
    if (pool) await pool.close();
  }
}

async function run() {
  if (isHelp) {
    usage();
    return;
  }

  if (isCleanup) {
    try {
      await cleanupSmokeData();
    } catch (error) {
      console.error('');
      console.error('❌ Transport smoke cleanup failed:', error instanceof Error ? error.message : error);
      process.exitCode = 1;
    }
    return;
  }

  if (!isConfirmed) {
    printPreview();
    return;
  }

  try {
    await seed();
  } catch (error) {
    console.error('');
    console.error('❌ Transport smoke seed failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

run();
