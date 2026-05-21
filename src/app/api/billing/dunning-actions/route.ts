import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAnyPermission, requireRequestActor, requireYardAccess } from '@/lib/apiAuth';
import { logAudit } from '@/lib/audit';
import {
  buildARDunningContactAuditDetails,
  type ARDunningContactMethod,
  type ARDunningContactOutcome,
  type ARDunningStage,
} from '@/lib/arDunning';

const CONTACT_METHODS: ARDunningContactMethod[] = ['email', 'phone', 'portal', 'note'];
const CONTACT_OUTCOMES: ARDunningContactOutcome[] = ['sent', 'reached', 'no_answer', 'promise_to_pay', 'disputed', 'escalated'];
const DUNNING_STAGES: ARDunningStage[] = ['friendly_reminder', 'second_notice', 'credit_hold_review', 'final_notice'];

function positiveInt(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function validChoice<T extends string>(value: unknown, allowed: T[]): value is T {
  return typeof value === 'string' && allowed.includes(value as T);
}

export async function POST(request: NextRequest) {
  try {
    const actor = requireRequestActor(request);
    if (actor instanceof NextResponse) return actor;

    const body = await request.json();
    const yardId = positiveInt(body.yard_id);
    const customerId = positiveInt(body.customer_id);
    const contactMethod = body.contact_method;
    const outcome = body.outcome;
    const stage = body.stage;

    if (!yardId || !customerId) {
      return NextResponse.json({ error: 'ต้องระบุ yard_id และ customer_id ที่ถูกต้อง' }, { status: 400 });
    }
    if (!validChoice(contactMethod, CONTACT_METHODS) || !validChoice(outcome, CONTACT_OUTCOMES)) {
      return NextResponse.json({ error: 'contact_method หรือ outcome ไม่ถูกต้อง' }, { status: 400 });
    }
    if (stage && !validChoice(stage, DUNNING_STAGES)) {
      return NextResponse.json({ error: 'stage ไม่ถูกต้อง' }, { status: 400 });
    }

    const db = await getDb();
    const yardAccess = await requireYardAccess(request, db, yardId);
    if (yardAccess instanceof NextResponse) return yardAccess;
    const permission = await requireAnyPermission(
      request,
      db,
      ['billing.payment.receive', 'billing.invoice.create', 'reports.view'],
      'คุณไม่มีสิทธิ์บันทึก AR dunning action'
    );
    if (permission instanceof NextResponse) return permission;

    const details = buildARDunningContactAuditDetails({
      customer_id: customerId,
      customer_name: body.customer_name,
      stage: stage || null,
      contact_method: contactMethod,
      outcome,
      note: body.note,
      promise_to_pay_date: body.promise_to_pay_date,
      promise_to_pay_amount: body.promise_to_pay_amount,
    });

    await logAudit({
      userId: actor.userId,
      yardId,
      action: 'ar_dunning_contact',
      entityType: 'customer',
      entityId: customerId,
      details,
    });

    return NextResponse.json({ success: true, details });
  } catch (error) {
    console.error('❌ AR dunning action error:', error);
    return NextResponse.json({ error: 'ไม่สามารถบันทึก AR dunning action ได้' }, { status: 500 });
  }
}
