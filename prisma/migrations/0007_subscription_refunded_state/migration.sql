-- Phase 7A: explicit REFUNDED subscription state.
-- Refunds previously collapsed to CANCELLED; they now carry their own
-- terminal state so audit/entitlement policy can distinguish them.
ALTER TYPE "SubscriptionStatus" ADD VALUE 'REFUNDED';
