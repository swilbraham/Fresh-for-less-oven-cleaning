import { NextResponse } from "next/server";
import {
  coveredServices,
  getOpenSlots,
  getServices,
  getSettings,
} from "@/lib/marketplace/repo";
import { outwardOf } from "@/lib/marketplace/postcode";

export const dynamic = "force-dynamic";

const BOOKING_WINDOW_DAYS = 27;

type Slot = { day: string; am: boolean; pm: boolean };

/**
 * Generic dates for a trade nobody covers here yet. A provisional booking with
 * a date and a basket is worth far more than a dead end, both to the customer
 * and as something to recruit against.
 */
function genericSlots(minNoticeDays: number): Slot[] {
  const slots: Slot[] = [];
  for (
    let day = minNoticeDays;
    day <= minNoticeDays + BOOKING_WINDOW_DAYS;
    day++
  ) {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + day);
    slots.push({
      day: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
      am: true,
      pm: true,
    });
  }
  return slots;
}

/**
 * Half-days someone is actually free in this postcode, per trade.
 *
 * Availability is answered for every requested service in one request because
 * that is how the customer experiences it — they have carpets and gutters in
 * one basket and want to see both diaries at once.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const outward = outwardOf(params.get("postcode") ?? "");

  if (!outward) {
    return NextResponse.json(
      { ok: false, error: "Enter a full UK postcode, e.g. CH41 5AB." },
      { status: 400 }
    );
  }

  const [settings, allServices, covered] = await Promise.all([
    getSettings(),
    getServices(true),
    coveredServices(outward),
  ]);

  // No `services` parameter means "tell me about everything you sell".
  const requested = (params.get("services") ?? "")
    .split(",")
    .map((code) => code.trim())
    .filter(Boolean);
  const wanted = allServices.filter(
    (service) => requested.length === 0 || requested.includes(service.code)
  );

  const from = settings.min_notice_days;
  const to = settings.min_notice_days + BOOKING_WINDOW_DAYS;

  const entries = await Promise.all(
    wanted.map(async (service) => {
      if (!covered.includes(service.code)) {
        return [
          service.code,
          { covered: false, provisional: true, slots: genericSlots(from) },
        ] as const;
      }
      const slots = await getOpenSlots(outward, service.code, from, to);
      return [
        service.code,
        {
          covered: true,
          provisional: false,
          slots: slots.filter((s) => s.am || s.pm),
        },
      ] as const;
    })
  );

  return NextResponse.json({
    ok: true,
    outward,
    services: Object.fromEntries(entries),
  });
}
