/** Provider-neutral billing interface. Paddle implements it today; another provider could be swapped in. */

export interface SubscriptionInfo {
  id: string;
  /** Provider status, e.g. active, trialing, past_due, paused, canceled. */
  status: string;
  customerId: string;
  /** ISO date of the next renewal charge, when known. */
  renewsAt?: string;
  /** ISO date when a scheduled cancellation takes effect. */
  cancelsAt?: string;
  /** ms epoch: until when a past_due subscription still counts as Pro. */
  graceUntil?: number;
}

export interface BillingProvider {
  readonly name: string;
  /** The best current subscription for this email (active > trialing > past_due), or null. */
  findActiveSubscription(email: string): Promise<SubscriptionInfo | null>;
  /** A short-lived, signed link to the provider's customer portal (manage, cancel, invoices). */
  createPortalUrl(customerId: string, subscriptionIds?: string[]): Promise<string>;
}
