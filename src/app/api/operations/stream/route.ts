import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';

/**
 * GET /api/operations/stream?yard_id=X
 * Server-Sent Events endpoint for real-time work order updates
 * Polls DB every 5 seconds and sends updates when data changes
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const yardId = searchParams.get('yard_id') || '1';

  const encoder = new TextEncoder();
  let lastHash = '';
  let isActive = true;

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection event
      controller.enqueue(encoder.encode(`event: connected\ndata: {"status":"connected"}\n\n`));

      const poll = async () => {
        while (isActive) {
          try {
            const db = await getDb();
            const result = await db.request()
              .input('yardId', sql.Int, parseInt(yardId))
              .query(`
                SELECT w.*,
                  c.container_number, c.size, c.type, c.shipping_line,
                  fz.zone_name as from_zone_name,
                  tz.zone_name as to_zone_name,
                  ua.full_name as assigned_name,
                  uc.full_name as created_name
                FROM WorkOrders w
                LEFT JOIN Containers c ON w.container_id = c.container_id
                LEFT JOIN YardZones fz ON w.from_zone_id = fz.zone_id
                LEFT JOIN YardZones tz ON w.to_zone_id = tz.zone_id
                LEFT JOIN Users ua ON w.assigned_to = ua.user_id
                LEFT JOIN Users uc ON w.created_by = uc.user_id
                WHERE w.yard_id = @yardId
                ORDER BY
                  CASE w.status WHEN 'in_progress' THEN 0 WHEN 'assigned' THEN 1 WHEN 'pending' THEN 2 ELSE 3 END,
                  w.priority ASC,
                  w.created_at DESC
              `);

            const orders = result.recordset;
            // Simple hash to detect changes
            const hash = JSON.stringify(orders.map((o: { order_id: number; status: string; updated_at?: string; created_at?: string }) => `${o.order_id}:${o.status}:${o.updated_at || o.created_at}`));

            if (hash !== lastHash) {
              lastHash = hash;
              const data = JSON.stringify({ orders });
              controller.enqueue(encoder.encode(`event: orders\ndata: ${data}\n\n`));
            } else {
              // Send heartbeat to keep connection alive
              controller.enqueue(encoder.encode(`: heartbeat\n\n`));
            }
          } catch (err) {
            console.error('SSE poll error:', err);
            controller.enqueue(encoder.encode(`event: error\ndata: {"error":"db_error"}\n\n`));
          }

          // Wait 5 seconds before next poll
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      };

      poll().catch(() => { /* stream closed */ });

      // Cleanup on abort
      request.signal.addEventListener('abort', () => {
        isActive = false;
      });
    },
    cancel() {
      isActive = false;
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
