import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';
import { logAudit } from '@/lib/audit';

async function ensureContainerGradeColumn(db: sql.ConnectionPool) {
  await db.request().query(`
    IF COL_LENGTH('Containers', 'container_grade') IS NULL
      ALTER TABLE Containers ADD container_grade NVARCHAR(1) NOT NULL CONSTRAINT DF_Containers_Grade DEFAULT 'A'
  `);
}

// GET — ดึง containers ตาม yard_id + filter, หรือ check_position (conflict detection)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yardId = searchParams.get('yard_id');
    const zoneId = searchParams.get('zone_id');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const checkPosition = searchParams.get('check_position');
    const bay = searchParams.get('bay');
    const row = searchParams.get('row');
    const tier = searchParams.get('tier');

    const db = await getDb();
    await ensureContainerGradeColumn(db);

    // Position check mode — ตรวจว่ามีตู้ที่ตำแหน่งนี้ไหม
    if (checkPosition === '1' && zoneId && bay && row && tier) {
      const checkReq = db.request()
        .input('zoneId', sql.Int, parseInt(zoneId))
        .input('bay', sql.Int, parseInt(bay))
        .input('row', sql.Int, parseInt(row))
        .input('tier', sql.Int, parseInt(tier));
      if (yardId) checkReq.input('yardId', sql.Int, parseInt(yardId));

      const checkResult = await checkReq.query(`
        SELECT container_id, container_number FROM Containers
        WHERE zone_id = @zoneId AND bay = @bay AND [row] = @row AND tier = @tier AND status = 'in_yard'
        ${yardId ? 'AND yard_id = @yardId' : ''}
      `);

      return NextResponse.json({
        conflict: checkResult.recordset.length > 0 ? checkResult.recordset[0] : null,
      });
    }

    // Normal listing mode
    const conditions: string[] = [];
    const req = db.request();

    if (yardId) {
      conditions.push('c.yard_id = @yardId');
      req.input('yardId', sql.Int, parseInt(yardId));
    }
    if (zoneId) {
      conditions.push('c.zone_id = @zoneId');
      req.input('zoneId', sql.Int, parseInt(zoneId));
    }
    if (status) {
      conditions.push('c.status = @status');
      req.input('status', sql.NVarChar, status);
    }
    if (search) {
      conditions.push('(c.container_number LIKE @search OR c.shipping_line LIKE @search)');
      req.input('search', sql.NVarChar, `%${search}%`);
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const result = await req.query(`
      SELECT c.*, y.yard_name, z.zone_name, z.zone_type
      FROM Containers c
      LEFT JOIN Yards y ON c.yard_id = y.yard_id
      LEFT JOIN YardZones z ON c.zone_id = z.zone_id
      ${where}
      ORDER BY c.updated_at DESC
    `);

    return NextResponse.json(result.recordset);
  } catch (error) {
    console.error('❌ GET containers error:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึงข้อมูลตู้ได้' }, { status: 500 });
  }
}

// POST — เพิ่มตู้ใหม่ (Gate-In)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const db = await getDb();
    await ensureContainerGradeColumn(db);

    const result = await db.request()
      .input('containerNumber', sql.NVarChar, body.container_number)
      .input('size', sql.NVarChar, body.size)
      .input('type', sql.NVarChar, body.type)
      .input('status', sql.NVarChar, body.status || 'in_yard')
      .input('yardId', sql.Int, body.yard_id || null)
      .input('zoneId', sql.Int, body.zone_id || null)
      .input('bay', sql.Int, body.bay || null)
      .input('row', sql.Int, body.row || null)
      .input('tier', sql.Int, body.tier || null)
      .input('shippingLine', sql.NVarChar, body.shipping_line || null)
      .input('isLaden', sql.Bit, body.is_laden || false)
      .input('containerGrade', sql.NVarChar, body.container_grade || 'A')
      .input('sealNumber', sql.NVarChar, body.seal_number || null)
      .input('gateInDate', sql.DateTime2, new Date())
      .query(`
        INSERT INTO Containers (container_number, size, type, status, yard_id, zone_id,
          bay, [row], tier, shipping_line, is_laden, container_grade, seal_number, gate_in_date)
        OUTPUT INSERTED.*
        VALUES (@containerNumber, @size, @type, @status, @yardId, @zoneId,
          @bay, @row, @tier, @shippingLine, @isLaden, @containerGrade, @sealNumber, @gateInDate)
      `);

    const created = result.recordset[0];

    await logAudit({ action: 'container_create', entityType: 'container', entityId: created.container_id, details: { container_number: body.container_number, size: body.size, type: body.type, yard_id: body.yard_id } });

    return NextResponse.json({ success: true, data: created });
  } catch (error: unknown) {
    console.error('❌ POST container error:', error);
    const msg = error instanceof Error && error.message.includes('UNIQUE')
      ? 'หมายเลขตู้นี้มีอยู่ในระบบแล้ว' : 'ไม่สามารถเพิ่มตู้ได้';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PUT — อัปเดตตู้ (ย้ายตำแหน่ง, เปลี่ยนสถานะ)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const db = await getDb();
    await ensureContainerGradeColumn(db);

    // Build dynamic SET clauses — only update fields that are provided
    const setClauses: string[] = ['updated_at = GETDATE()'];
    const req = db.request().input('containerId', sql.Int, body.container_id);

    if (body.status !== undefined) {
      setClauses.push('status = @status');
      req.input('status', sql.NVarChar, body.status);
    }
    if (body.yard_id !== undefined) {
      setClauses.push('yard_id = @yardId');
      req.input('yardId', sql.Int, body.yard_id);
    }
    if (body.zone_id !== undefined) {
      setClauses.push('zone_id = @zoneId');
      req.input('zoneId', sql.Int, body.zone_id);
    }
    if (body.bay !== undefined) {
      setClauses.push('bay = @bay');
      req.input('bay', sql.Int, body.bay);
    }
    if (body.row !== undefined) {
      setClauses.push('[row] = @row');
      req.input('row', sql.Int, body.row);
    }
    if (body.tier !== undefined) {
      setClauses.push('tier = @tier');
      req.input('tier', sql.Int, body.tier);
    }
    if (body.seal_number !== undefined) {
      setClauses.push('seal_number = @sealNumber');
      req.input('sealNumber', sql.NVarChar, body.seal_number);
    }
    if (body.container_grade !== undefined) {
      const grade = String(body.container_grade).toUpperCase();
      if (!['A', 'B', 'C', 'D'].includes(grade)) {
        return NextResponse.json({ error: 'container_grade ต้องเป็น A, B, C หรือ D' }, { status: 400 });
      }
      setClauses.push('container_grade = @containerGrade');
      req.input('containerGrade', sql.NVarChar, grade);
    }
    if (body.status === 'released') {
      setClauses.push('gate_out_date = GETDATE()');
    }

    await req.query(`UPDATE Containers SET ${setClauses.join(', ')} WHERE container_id = @containerId`);

    await logAudit({ action: 'container_update', entityType: 'container', entityId: body.container_id, details: { status: body.status, container_grade: body.container_grade, zone_id: body.zone_id, bay: body.bay, row: body.row, tier: body.tier } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ PUT container error:', error);
    return NextResponse.json({ error: 'ไม่สามารถอัปเดตตู้ได้' }, { status: 500 });
  }
}
