import { NextResponse } from "next/server";
import {
  generateCommissionInvoices,
  getSettings,
  notify,
  notifyInvoiceRaised,
} from "@/lib/marketplace/repo";
import { gbpShort } from "@/lib/marketplace/money";
import { IS_SOLO, V } from "@/config";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function iso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function longDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/**
 * Daily commission run — Vercel cron hits this each evening.
 *
 * It bills every completed job that isn't already on an invoice, not just the
 * ones inside the labelled day, so a job marked complete late still gets
 * picked up rather than falling through the gap. The unique index on invoice
 * lines means a double trigger can't double-bill.
 *
 * Inert on a solo site: there is no commission to bill and nobody to bill it
 * to. The route still answers 200 so the cron entry can stay in vercel.json
 * across both modes without its failures filling the operator's logs.
 */
export async function GET(request: Request) {
  if (IS_SOLO) {
    return NextResponse.json({
      ok: true,
      skipped: "solo",
      reason: `Commission invoicing is off on a solo site — the ${V.one} keeps the whole job value.`,
      invoicesRaised: 0,
    });
  }

  // Vercel signs scheduled requests with CRON_SECRET. Without this the endpoint
  // would be a public button for raising everyone's invoices.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }

  // The run covers today, and is labelled as today. Commission is payable on
  // the day it is raised, so there is no due date to carry around.
  const today = new Date();
  const dayLabel = longDate(today);

  const raised = await generateCommissionInvoices(iso(today), iso(today));

  for (const invoice of raised) {
    await notifyInvoiceRaised(invoice, dayLabel);
  }

  if (raised.length > 0) {
    const settings = await getSettings();
    const total = raised.reduce((sum, i) => sum + i.totalPence, 0);
    await notify({
      recipient: settings.booking_email,
      subject: `Commission run ${iso(today)} — ${raised.length} payment link${raised.length === 1 ? "" : "s"}, ${gbpShort(total)}`,
      body:
        `Commission raised for ${dayLabel}:\n\n` +
        raised
          .map((i) => `${i.ref} — ${gbpShort(i.totalPence)} (${i.jobs} job${i.jobs === 1 ? "" : "s"})`)
          .join("\n") +
        `\n\nTotal: ${gbpShort(total)}, due today.\n` +
        `Send each payment link from Stripe or Square, then mark it paid in /admin/invoices.`,
    });
  }

  return NextResponse.json({
    ok: true,
    period: { from: iso(today), to: iso(today) },
    invoicesRaised: raised.length,
    totalPence: raised.reduce((sum, i) => sum + i.totalPence, 0),
  });
}
