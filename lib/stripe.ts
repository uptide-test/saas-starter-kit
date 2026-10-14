import Stripe from 'stripe';
import env from '@/lib/env';
import { updateTeam } from 'models/team';

export const stripe = new Stripe(env.stripe.secretKey ?? '', { apiVersion: '2026-09-30.endive' });

export async function getStripeCustomerId(teamMember, session?: any) {
  let customerId = '';
  if (!teamMember.team.billingId) {
    const customerData: {
      metadata: { teamId: string };
      email?: string;
    } = {
      metadata: {
        teamId: teamMember.teamId,
      },
    };
    if (session?.user?.email) {
      customerData.email = session?.user?.email;
    }
    const customer = await stripe.customers.create({
      ...customerData,
      name: session?.user?.name as string,
    });
    await updateTeam(teamMember.team.slug, {
      billingId: customer.id,
      billingProvider: 'stripe',
    });
    customerId = customer.id;
  } else {
    customerId = teamMember.team.billingId;
  }
  return customerId;
}

type PeriodItem = { current_period_start?: number; current_period_end?: number };
/**
 * Use both values from the latest-ending item, identical to the old subscription-level
 * period for a single-item subscription. Webhook endpoints can still send the old shape
 * after the SDK is upgraded. Undefined when neither shape has a complete, finite period.
 */
export function subscriptionPeriod(s: PeriodItem & { items?: { data: PeriodItem[] } }): { start: number; end: number } | undefined {
  const latest = (s.items?.data ?? []).reduce<{ start: number; end: number } | undefined>(
    (best, item) => (typeof item.current_period_start === 'number' && Number.isFinite(item.current_period_start) &&
      typeof item.current_period_end === 'number' && Number.isFinite(item.current_period_end) &&
      (best === undefined || item.current_period_end > best.end)
      ? { start: item.current_period_start, end: item.current_period_end } : best),
    undefined,
  );
  if (latest) return latest;
  return typeof s.current_period_start === 'number' && Number.isFinite(s.current_period_start) &&
    typeof s.current_period_end === 'number' && Number.isFinite(s.current_period_end)
    ? { start: s.current_period_start, end: s.current_period_end } : undefined;
}
