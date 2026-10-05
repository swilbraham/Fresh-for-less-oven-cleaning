import { NextResponse } from "next/server";
import { createBooking } from "@/lib/marketplace/repo";
import { normalisePostcode } from "@/lib/marketplace/postcode";
import { hitRateLimit } from "@/lib/marketplace/rate-limit";
import { CONTACT } from "@/config";

export const dynamic = "force-dynamic";

function text(value: unknown, max = 200): string {
  return String(value ?? "").trim().slice(0, max);
}

export async function POST(request: Request) {
  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Malformed request." },
      { status: 400 }
    );
  }

  const customerName = text(payload.customerName, 80);
  const customerEmail = text(payload.customerEmail, 120);
  const customerPhone = text(payload.customerPhone, 30);
  const addressLine = text(payload.addressLine, 160);
  const town = text(payload.town, 80);
  const postcode = normalisePostcode(text(payload.postcode, 12));
  const notes = text(payload.notes, 600);

  // One chosen slot per service in the basket. Each becomes its own job, so a
  // missing or malformed entry is caught here rather than half-booking someone.
  const slots: Record<string, { date: string; window: "am" | "pm" }> = {};
  for (const [code, value] of Object.entries(
    (payload.slots ?? {}) as Record<string, unknown>
  )) {
    const slot = (value ?? {}) as Record<string, unknown>;
    const date = text(slot.date, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    slots[text(code, 40)] = {
      date,
      window: text(slot.window, 2) === "pm" ? "pm" : "am",
    };
  }

  // Which services the customer took an add-on for, e.g. stain guard.
  const protection: Record<string, boolean> = {};
  for (const [code, value] of Object.entries(
    (payload.protection ?? {}) as Record<string, unknown>
  )) {
    if (value === true) protection[text(code, 40)] = true;
  }

  const problems: string[] = [];
  if (customerName.length < 2) problems.push("your name");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(customerEmail)) problems.push("a valid email");
  if (customerPhone.replace(/\D/g, "").length < 10) problems.push("a valid phone number");
  if (addressLine.length < 4) problems.push("your address");
  if (!postcode) problems.push("a valid postcode");
  if (Object.keys(slots).length === 0) problems.push("a date and time");
  if (problems.length) {
    return NextResponse.json(
      { ok: false, error: `Please add ${problems.join(", ")}.` },
      { status: 400 }
    );
  }

  const rawBasket = (payload.basket ?? {}) as Record<string, unknown>;
  const basket: Record<string, number> = {};
  for (const [code, qty] of Object.entries(rawBasket)) {
    const n = Math.floor(Number(qty));
    if (Number.isFinite(n) && n > 0) basket[text(code, 40)] = n;
  }

  // Each booking in network mode texts every covering operative, so an
  // unthrottled endpoint is a way to spend someone else's SMS budget and spam
  // their whole pool.
  const perContact = await hitRateLimit(
    "book:contact",
    customerPhone.replace(/\D/g, "") || customerEmail,
    5,
    60 * 60
  );
  const overall = await hitRateLimit("book:global", "all", 60, 60 * 60);
  if (!perContact.allowed || !overall.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error:
          `We've had a lot of booking attempts just now. Please call ${CONTACT.phone} and we'll book you in.`,
      },
      { status: 429 }
    );
  }

  try {
    // The price is recalculated server-side here — the browser's total is only
    // ever a display value.
    const { booking, jobs, offered } = await createBooking({
      basket,
      customerName,
      customerEmail,
      customerPhone,
      addressLine,
      town,
      postcode: postcode!,
      slots,
      notes,
      protection,
      source: text(payload.source, 40),
    });

    return NextResponse.json({
      ok: true,
      ref: booking.ref,
      total_pence: booking.total_pence,
      jobs: jobs.length,
      offered,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: String((error as Error)?.message ?? "Booking failed.") },
      { status: 400 }
    );
  }
}
