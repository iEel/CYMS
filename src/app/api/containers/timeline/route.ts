import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';
import { requireAnyPermission, requireYardAccess } from '@/lib/apiAuth';

const TIMELINE_READ_PERMISSIONS = [
  'gate.in',
  'gate.out',
  'yard.location.assign',
  'yard.slot.move',
  'reports.view',
];

/**
 * GET /api/containers/timeline?container_id=X
 * Returns unified timeline of all events for a container
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const containerId = searchParams.get('container_id');
    const containerNumber = searchParams.get('container_number');

    if (!containerId && !containerNumber) {
      return NextResponse.json({ error: 'container_id or container_number required' }, { status: 400 });
    }

    const db = await getDb();
    const permission = await requireAnyPermission(
      request,
      db,
      TIMELINE_READ_PERMISSIONS,
      'คุณไม่มีสิทธิ์ดู Timeline ตู้'
    );
    if (permission instanceof NextResponse) return permission;

    // Resolve container and yard before reading timeline details.
    let cid = containerId ? parseInt(containerId) : 0;
    let containerResult;
    if (cid) {
      containerResult = await db.request()
        .input('cid4', sql.Int, cid)
        .query(`
          SELECT c.container_id, c.container_number, c.size, c.type, c.status,
                 c.shipping_line, c.gate_in_date, c.gate_out_date, c.is_laden,
                 c.zone_id, c.bay, c.row, c.tier, c.yard_id,
                 z.zone_name, y.yard_name,
                 DATEDIFF(day, c.gate_in_date, ISNULL(c.gate_out_date, GETDATE())) as dwell_days
          FROM Containers c
          LEFT JOIN YardZones z ON c.zone_id = z.zone_id
          LEFT JOIN Yards y ON c.yard_id = y.yard_id
          WHERE c.container_id = @cid4
        `);
    } else {
      containerResult = await db.request()
        .input('cn', sql.NVarChar, containerNumber)
        .query(`
          SELECT c.container_id, c.container_number, c.size, c.type, c.status,
                 c.shipping_line, c.gate_in_date, c.gate_out_date, c.is_laden,
                 c.zone_id, c.bay, c.row, c.tier, c.yard_id,
                 z.zone_name, y.yard_name,
                 DATEDIFF(day, c.gate_in_date, ISNULL(c.gate_out_date, GETDATE())) as dwell_days
          FROM Containers c
          LEFT JOIN YardZones z ON c.zone_id = z.zone_id
          LEFT JOIN Yards y ON c.yard_id = y.yard_id
          WHERE c.container_number = @cn
        `);
    }

    if (!containerResult.recordset.length) {
      return NextResponse.json({ error: 'ไม่พบตู้' }, { status: 404 });
    }

    const containerRow = containerResult.recordset[0];
    cid = containerRow.container_id;
    const yardAccess = await requireYardAccess(
      request,
      db,
      containerRow.yard_id,
      'คุณไม่มีสิทธิ์ดู Timeline ของตู้ในลานนี้'
    );
    if (yardAccess instanceof NextResponse) return yardAccess;

    // 1. Gate Transactions (gate_in, gate_out)
    const gateResult = await db.request()
      .input('cid', sql.Int, cid)
      .query(`
        SELECT gt.transaction_id, gt.transaction_type, gt.driver_name, gt.truck_plate,
               gt.seal_number, gt.booking_ref, gt.eir_number, gt.notes, gt.damage_report,
               gt.created_at, u.full_name as processed_by_name,
               y.yard_name
        FROM GateTransactions gt
        LEFT JOIN Users u ON gt.processed_by = u.user_id
        LEFT JOIN Yards y ON gt.yard_id = y.yard_id
        WHERE gt.container_id = @cid
        ORDER BY gt.created_at
      `);

    // 2. Audit Log events (move, hold, release, status_change, etc.)
    const auditResult = await db.request()
      .input('cid2', sql.Int, cid)
      .query(`
        SELECT al.log_id, al.action, al.details, al.created_at,
               u.full_name as user_name
        FROM AuditLog al
        LEFT JOIN Users u ON al.user_id = u.user_id
        WHERE al.entity_type = 'container' AND al.entity_id = @cid2
        ORDER BY al.created_at
      `);

    // 3. Invoices/Payments
    const invoiceResult = await db.request()
      .input('cid3', sql.Int, cid)
      .query(`
        SELECT invoice_id, invoice_number, description, grand_total, status, paid_at, created_at
        FROM Invoices
        WHERE container_id = @cid3
        ORDER BY created_at
      `);

    // Build unified timeline
    interface TimelineEvent {
      id: string;
      type: string;
      icon: string;
      color: string;
      title: string;
      description: string;
      details?: Record<string, unknown>;
      timestamp: string;
    }

    const events: TimelineEvent[] = [];

    // Gate transactions
    for (const gt of gateResult.recordset) {
      const isGateIn = gt.transaction_type === 'gate_in';
      events.push({
        id: `gate-${gt.transaction_id}`,
        type: isGateIn ? 'gate_in' : 'gate_out',
        icon: isGateIn ? '📥' : '📤',
        color: isGateIn ? '#10B981' : '#3B82F6',
        title: isGateIn ? 'Gate-In' : 'Gate-Out',
        description: [
          gt.processed_by_name ? `โดย ${gt.processed_by_name}` : '',
          gt.yard_name ? `ลาน: ${gt.yard_name}` : '',
          gt.driver_name ? `คนขับ: ${gt.driver_name}` : '',
          gt.truck_plate ? `ทะเบียน: ${gt.truck_plate}` : '',
        ].filter(Boolean).join(' • '),
        details: {
          eir_number: gt.eir_number,
          booking_ref: gt.booking_ref,
          seal_number: gt.seal_number,
          notes: gt.notes,
          has_damage: gt.damage_report ? true : false,
        },
        timestamp: gt.created_at,
      });
    }

    // Audit log events
    for (const al of auditResult.recordset) {
      let parsed: Record<string, string> = {};
      try { parsed = JSON.parse(al.details || '{}'); } catch { /* */ }

      const eventConfig = getAuditEventConfig(al.action, parsed);
      events.push({
        id: `audit-${al.log_id}`,
        type: al.action,
        icon: eventConfig.icon,
        color: eventConfig.color,
        title: eventConfig.title,
        description: [
          eventConfig.desc,
          al.user_name ? `โดย ${al.user_name}` : '',
        ].filter(Boolean).join(' • '),
        details: parsed,
        timestamp: al.created_at,
      });
    }

    // Invoices
    for (const inv of invoiceResult.recordset) {
      // Invoice created
      events.push({
        id: `inv-${inv.invoice_id}`,
        type: 'invoice',
        icon: '📄',
        color: '#F59E0B',
        title: `ใบแจ้งหนี้ ${inv.invoice_number}`,
        description: `${inv.description || ''} — ฿${inv.grand_total?.toLocaleString()}`,
        details: { status: inv.status, grand_total: inv.grand_total },
        timestamp: inv.created_at,
      });

      // Payment
      if (inv.paid_at) {
        events.push({
          id: `pay-${inv.invoice_id}`,
          type: 'payment',
          icon: '💰',
          color: '#10B981',
          title: `ชำระเงิน ${inv.invoice_number}`,
          description: `฿${inv.grand_total?.toLocaleString()}`,
          details: { invoice_number: inv.invoice_number },
          timestamp: inv.paid_at,
        });
      }
    }

    // Sort by timestamp
    events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const container = Object.fromEntries(
      Object.entries(containerRow).filter(([key]) => key !== 'yard_id')
    );

    return NextResponse.json({
      container,
      events,
      total_events: events.length,
    });
  } catch (error) {
    console.error('❌ GET timeline error:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึง timeline ได้' }, { status: 500 });
  }
}

function getAuditEventConfig(action: string, details: Record<string, string>): { icon: string; color: string; title: string; desc: string } {
  const configs: Record<string, { icon: string; color: string; title: string; desc: string }> = {
    gate_in: { icon: '📥', color: '#10B981', title: 'Gate-In', desc: '' },
    gate_out: { icon: '📤', color: '#3B82F6', title: 'Gate-Out', desc: '' },
    move: { icon: '🔄', color: '#8B5CF6', title: 'ย้ายตู้', desc: details.to_zone ? `ไป ${details.to_zone}` : '' },
    container_move: { icon: '🔄', color: '#8B5CF6', title: 'ย้ายตู้', desc: details.to_zone || '' },
    hold: { icon: '⛔', color: '#EF4444', title: 'ระงับตู้ (Hold)', desc: details.reason || '' },
    release: { icon: '✅', color: '#10B981', title: 'ปลดระงับ (Release)', desc: '' },
    billing_hold: { icon: '🔒', color: '#DC2626', title: 'Billing Hold', desc: 'ระงับรอชำระเงิน' },
    billing_release: { icon: '🔓', color: '#059669', title: 'Billing Release', desc: 'ปลดระงับ (ชำระแล้ว)' },
    repair: { icon: '🔧', color: '#F97316', title: 'แจ้งซ่อม M&R', desc: details.description || '' },
    mnr_create: { icon: '🔧', color: '#F97316', title: 'สร้างใบซ่อม M&R', desc: '' },
    mnr_complete: { icon: '✅', color: '#10B981', title: 'ซ่อมเสร็จ', desc: '' },
    status_change: { icon: '🔄', color: '#6366F1', title: 'เปลี่ยนสถานะ', desc: details.new_status ? `→ ${details.new_status}` : '' },
    inspection: { icon: '🔍', color: '#0EA5E9', title: 'ตรวจสภาพ', desc: details.condition || '' },
  };

  return configs[action] || {
    icon: '📋',
    color: '#64748B',
    title: action.replace(/_/g, ' '),
    desc: '',
  };
}
