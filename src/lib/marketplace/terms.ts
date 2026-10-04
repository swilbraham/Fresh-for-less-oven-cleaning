import { BRAND, V } from "@/config";

/**
 * Commission terms, stated in one place so the booking page, the operative's
 * dashboard, the offer card and the invoice page can never contradict each
 * other. Vague payment terms are what arguments are made of.
 *
 * Settled daily rather than weekly. The operative has already been paid in
 * full by the customer on the day, so the money is in their hands before the
 * commission is asked for — which is exactly why a week of credit is not
 * needed, and why a week of unpaid jobs is a debt worth avoiding.
 *
 * Unused on a solo site, where the operator keeps the whole job value and
 * nothing is ever invoiced to anybody.
 */

export const COMMISSION_TERMS_SHORT =
  "A payment link is sent at the end of each day for that day's commission.";

export const COMMISSION_TERMS_LONG = [
  "You collect the full job price from the customer on the day.",
  "At the end of each day we total the commission on everything you completed",
  "and send you a payment link by text and email, payable by card through",
  "Stripe or Square.",
  "Nothing is due on jobs that were cancelled or that you never took.",
].join(" ");

/**
 * The consequence, stated plainly and in the same words everywhere it appears.
 * A sanction a contractor can say they never saw is not a sanction.
 */
export const COMMISSION_ENFORCEMENT = [
  `Commission is due the day it is invoiced. If a payment link is not settled,`,
  `your account is suspended immediately and you stop being offered work.`,
  `${BRAND.shortName} treats unpaid commission as a permanent suspension from`,
  `the platform, not a temporary hold.`,
].join(" ");

/** Shorter form, for a dashboard panel or an SMS where space is tight. */
export const COMMISSION_ENFORCEMENT_SHORT =
  "Unpaid commission means permanent suspension from the platform.";

/** Who the commission invoice is addressed to, for headings and columns. */
export const PAYEE_LABEL = V.One;

/**
 * When the next run goes out. Daily, at the end of the working day, so from
 * any moment today the answer is "tonight" unless the run has already been.
 */
export function formatCommissionRun(from: Date = new Date()): string {
  return from.getHours() >= 20 ? "tomorrow evening" : "this evening";
}
