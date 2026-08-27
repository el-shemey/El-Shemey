import { db } from "@/lib/server/db";
import type { EntitlementProvider } from "@/lib/domain/access";
import { isSubscriptionActive } from "@/lib/domain/subscriptions";

/**
 * Subscription-backed entitlement provider (Phase 5).
 *
 * This replaces `noEntitlements` as the production implementation:
 * PRO access = at least one ACTIVE subscription whose period is current.
 * Payment method (CARD/VODAFONE_CASH/FAWRY/INSTAPAY/manual) is irrelevant
 * here by design — only confirmed subscription state matters.
 */
export const subscriptionEntitlements: EntitlementProvider = {
  async hasProAccess(userId: string): Promise<boolean> {
    const subs = await db.subscription.findMany({
      where: { userId },
      select: { status: true, currentPeriodEnd: true },
    });
    return subs.some((s) => isSubscriptionActive(s));
  },
};

export function getEntitlementProvider(): EntitlementProvider {
  return subscriptionEntitlements;
}
