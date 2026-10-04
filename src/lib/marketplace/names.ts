import { V } from "@/config";

/**
 * Customers book the brand, not the individual's business. Telling them
 * "Roberts Carpet Care will clean your carpets" undercuts the brand they chose
 * and reads like the job has been handed to a stranger — so customer-facing
 * messages use the operative's first name only. Their trading name still
 * belongs on admin screens and on their own pages.
 */
export function firstName(fullName: string, fallback = `your ${V.one}`): string {
  const first = String(fullName ?? "").trim().split(/\s+/)[0];
  return first || fallback;
}
