const SMOKE_PREFIX = 'SMOKE-TRANSPORT';

const SMOKE_CUSTOMER = {
  customer_code: 'SMK-TRUCK',
  customer_name: 'SMOKE TRANSPORT CO., LTD.',
  customer_type: 'Transport',
  is_trucking: true,
  portal_enabled: true,
};

const SMOKE_USERS = {
  trucking: {
    username: 'smoke_transport_trucking',
    password: 'SmokeTransport123!',
    fullName: 'Smoke Trucking Coordinator',
    email: 'smoke.transport.trucking@example.test',
    portalRole: 'trucking_coordinator',
  },
  driver: {
    username: 'smoke_transport_driver',
    password: 'SmokeDriver123!',
    fullName: 'Smoke Transport Driver',
    email: 'smoke.transport.driver@example.test',
    portalRole: 'driver_user',
  },
};

const SMOKE_CONTAINER = {
  container_number: 'SMKU2026001',
  size: '20',
  type: 'GP',
  status: 'in_yard',
  bay: 1,
  row: 1,
  tier: 1,
};

const SMOKE_BOOKING = {
  booking_number: 'SMOKE-TRANSPORT-BK-001',
  status: 'approved',
  reference_no: 'SMOKE-TRANSPORT-REF-001',
};

const SMOKE_GATE_OUT_REQUEST = {
  status: 'requested',
  driver_name: 'Smoke Transport Driver',
  driver_license: 'SMOKE-DL-001',
  truck_plate: 'SMK-1001',
  booking_ref: SMOKE_BOOKING.booking_number,
  notes: `${SMOKE_PREFIX} smoke pickup job`,
};

const SMOKE_PROOF = {
  relativePath: 'public/uploads/smoke/transport-proof.jpg',
  url: '/uploads/smoke/transport-proof.jpg',
  type: 'pickup',
};

function buildPreviewRows() {
  return [
    {
      entity: 'customer',
      identifier: SMOKE_CUSTOMER.customer_code,
      action: 'upsert smoke trucking customer',
    },
    {
      entity: 'user',
      identifier: SMOKE_USERS.trucking.username,
      action: 'upsert smoke trucking coordinator user and smoke users only password',
    },
    {
      entity: 'user',
      identifier: SMOKE_USERS.driver.username,
      action: 'upsert smoke driver user and smoke users only password',
    },
    {
      entity: 'container',
      identifier: SMOKE_CONTAINER.container_number,
      action: 'upsert smoke in-yard container',
    },
    {
      entity: 'booking',
      identifier: SMOKE_BOOKING.booking_number,
      action: 'upsert smoke booking linked to smoke trucking customer',
    },
    {
      entity: 'gate_out_request',
      identifier: SMOKE_GATE_OUT_REQUEST.booking_ref,
      action: 'upsert smoke transport pickup request',
    },
    {
      entity: 'portal_entity_access',
      identifier: SMOKE_PREFIX,
      action: 'refresh active trucking grants for smoke entities',
    },
    {
      entity: 'proof_file',
      identifier: SMOKE_PROOF.url,
      action: 'ensure smoke proof file exists',
    },
  ];
}

function isSmokeIdentifier(value) {
  if (typeof value !== 'string') return false;
  return (
    value.includes(SMOKE_PREFIX) ||
    value === SMOKE_CUSTOMER.customer_code ||
    value === SMOKE_USERS.trucking.username ||
    value === SMOKE_USERS.driver.username ||
    value === SMOKE_CONTAINER.container_number ||
    value === SMOKE_BOOKING.booking_number ||
    value === SMOKE_GATE_OUT_REQUEST.booking_ref ||
    value === SMOKE_PROOF.url
  );
}

module.exports = {
  SMOKE_PREFIX,
  SMOKE_CUSTOMER,
  SMOKE_USERS,
  SMOKE_CONTAINER,
  SMOKE_BOOKING,
  SMOKE_GATE_OUT_REQUEST,
  SMOKE_PROOF,
  buildPreviewRows,
  isSmokeIdentifier,
};
