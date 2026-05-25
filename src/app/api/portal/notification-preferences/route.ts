import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb } from '@/lib/db';
import { getPortalCustomerId } from '@/lib/portalAccess';
import { requirePortalAction } from '@/lib/customerPortalPermissions';
import {
  PORTAL_NOTIFICATION_TYPES,
  getPortalNotificationPreferences,
  mergePreferencePatch,
} from '@/lib/portalNotificationPreferences';

export async function GET(request: NextRequest) {
  try {
    const customerId = getPortalCustomerId(request);
    if (customerId instanceof NextResponse) return customerId;

    const db = await getDb();
    const portalActor = await requirePortalAction(request, db, 'portal.container.view');
    if (portalActor instanceof NextResponse) return portalActor;

    const preferences = await getPortalNotificationPreferences(db, customerId);
    return NextResponse.json({ preferences });
  } catch (error) {
    console.error('❌ Portal notification preferences error:', error);
    return NextResponse.json({ error: 'ไม่สามารถโหลดตั้งค่าการแจ้งเตือนได้' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const customerId = getPortalCustomerId(request);
    if (customerId instanceof NextResponse) return customerId;

    const db = await getDb();
    const portalActor = await requirePortalAction(request, db, 'portal.container.view');
    if (portalActor instanceof NextResponse) return portalActor;

    const body = await request.json();
    const preferences = mergePreferencePatch(body);

    for (const type of PORTAL_NOTIFICATION_TYPES) {
      await db.request()
        .input('customerId', sql.Int, customerId)
        .input('notificationType', sql.NVarChar(40), type)
        .input('enabled', sql.Bit, preferences[type])
        .query(`
          MERGE PortalNotificationPreferences AS target
          USING (
            SELECT @customerId AS customer_id, @notificationType AS notification_type
          ) AS source
          ON target.customer_id = source.customer_id
            AND target.notification_type = source.notification_type
          WHEN MATCHED THEN
            UPDATE SET enabled = @enabled, updated_at = GETDATE()
          WHEN NOT MATCHED THEN
            INSERT (customer_id, notification_type, enabled)
            VALUES (@customerId, @notificationType, @enabled);
        `);
    }

    return NextResponse.json({ success: true, preferences });
  } catch (error) {
    console.error('❌ Update portal notification preferences error:', error);
    return NextResponse.json({ error: 'ไม่สามารถบันทึกตั้งค่าการแจ้งเตือนได้' }, { status: 500 });
  }
}
