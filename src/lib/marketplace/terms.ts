import { COMMERCIALS, V } from "@/config";

/**
 * Commission terms, stated in one place so the booking page, the operative's
 * dashboard, the offer card and the invoice page can never contradict each
 * other. Vague payment terms are what arguments are made of.
 *
 * Unused on a solo site, where the operator keeps the whole job value and
 * nothing is ever invoiced to anybody.
 */

export const COMMISSION_TERMS_SHORT =
  "Commission is invoiced every Monday for the week before.";

export const COMMISSION_TERMS_LONG = [
  "You collect the full job price from the customer on the day. We total up",
  "commission on everything you completed that week and invoice it the",
  `following Monday, payable within ${COMMERCIALS.paymentTermsDays} days.`,
  "Nothing is due on jobs that are cancelled or that you never took.",
].join(" ");

/** Who the commission invoice is addressed to, for headings and columns. */
export const PAYEE_LABEL = V.One;

/** The Monday on which this week's completed work gets invoiced. */
export function nextCommissionMonday(from: Date = new Date()): Date {
  const monday = new Date(from);
  monday.setHours(0, 0, 0, 0);
  // 0 = Sunday. Jobs completed this week are billed on the Monday that starts
  // the next one, so a Monday today still means seven days away.
  const daysAhead = (8 - monday.getDay()) % 7 || 7;
  monday.setDate(monday.getDate() + daysAhead);
  return monday;
}

export function formatCommissionMonday(from: Date = new Date()): string {
  return nextCommissionMonday(from).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}
