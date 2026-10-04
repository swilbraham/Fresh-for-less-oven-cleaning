import type {
  PriceBundle,
  PriceItem,
  Quote,
  QuoteLine,
  Service,
  ServiceQuote,
} from "./types";

/** Item code -> quantity. One basket can span every service. */
export type Basket = Record<string, number>;

/** Service code -> whether the customer opted into that service's add-on. */
export type ProtectionChoice = Record<string, boolean>;

/**
 * Work out the cheapest way to buy `qty` of one item given its unit price and
 * any fixed-price bundles ("3 rooms for £99").
 *
 * Quantities are small (max_qty caps at ~24) so an exact dynamic-programming
 * pass is both trivially cheap and avoids the surprises a greedy rule produces
 * when two overlapping bundles exist.
 */
function cheapestFor(
  qty: number,
  unitPence: number,
  bundles: PriceBundle[]
): { pence: number; usedBundles: PriceBundle[]; singles: number } {
  const best: number[] = new Array(qty + 1).fill(Infinity);
  const choice: (PriceBundle | null)[] = new Array(qty + 1).fill(null);
  best[0] = 0;

  for (let n = 1; n <= qty; n++) {
    best[n] = best[n - 1] + unitPence;
    choice[n] = null;
    for (const bundle of bundles) {
      if (bundle.qty > n) continue;
      const candidate = best[n - bundle.qty] + bundle.price_pence;
      if (candidate < best[n]) {
        best[n] = candidate;
        choice[n] = bundle;
      }
    }
  }

  const usedBundles: PriceBundle[] = [];
  let singles = 0;
  let n = qty;
  while (n > 0) {
    const picked = choice[n];
    if (picked) {
      usedBundles.push(picked);
      n -= picked.qty;
    } else {
      singles += 1;
      n -= 1;
    }
  }

  return { pence: best[qty], usedBundles, singles };
}

/** Which services the basket actually touches, in display order. */
export function servicesInBasket(
  basket: Basket,
  services: Service[],
  items: PriceItem[]
): Service[] {
  const wanted = new Set<string>();
  for (const item of items) {
    if (!item.active) continue;
    if (Math.floor(Number(basket[item.code] ?? 0)) > 0) wanted.add(item.service_code);
  }
  return [...services]
    .filter((s) => s.active && wanted.has(s.code))
    .sort((a, b) => a.sort - b.sort);
}

/**
 * Price one service's share of the basket. This is what becomes a single job:
 * one trade, one visit, one cleaner, one commission line.
 */
function quoteOneService(
  service: Service,
  basket: Basket,
  items: PriceItem[],
  bundles: PriceBundle[],
  commissionPct: number,
  wantsProtection: boolean
): ServiceQuote {
  const lines: QuoteLine[] = [];
  let subtotal = 0;
  let listPrice = 0;

  const ordered = items
    .filter((i) => i.active && i.service_code === service.code)
    .sort((a, b) => a.sort - b.sort);

  for (const item of ordered) {
    const requested = Math.floor(Number(basket[item.code] ?? 0));
    if (!Number.isFinite(requested) || requested <= 0) continue;
    const qty = Math.min(requested, item.max_qty);

    const itemBundles = bundles.filter(
      (b) => b.active && b.item_code === item.code && b.qty <= qty
    );
    const { pence, usedBundles, singles } = cheapestFor(
      qty,
      item.unit_price_pence,
      itemBundles
    );

    listPrice += qty * item.unit_price_pence;
    subtotal += pence;

    const bundleNote = usedBundles.length
      ? usedBundles.map((b) => b.label).join(" + ") +
        (singles > 0 ? ` + ${singles} at ${item.unit_price_pence / 100} each` : "")
      : "";

    lines.push({
      code: item.code,
      label: item.label,
      qty,
      amount_pence: pence,
      note: bundleNote,
    });
  }

  const minimumCharge = service.minimum_charge_pence;
  const minimumApplied = subtotal > 0 && subtotal < minimumCharge;

  // The minimum applies to the cleaning itself; the protection add-on is
  // charged on top of whatever the clean actually comes to.
  const cleaning = subtotal === 0 ? 0 : Math.max(subtotal, minimumCharge);

  const protectionPct = Number(service.protection_pct ?? 0);
  const protection =
    wantsProtection && protectionPct > 0 && cleaning > 0
      ? Math.round((cleaning * protectionPct) / 100)
      : 0;

  if (protection > 0) {
    lines.push({
      code: `${service.code}__protection`,
      label: service.protection_label || "Protection",
      qty: 1,
      amount_pence: protection,
      note: `${protectionPct}% of the clean`,
    });
  }

  const total = cleaning + protection;

  return {
    service_code: service.code,
    service_label: service.label,
    lines,
    subtotal_pence: subtotal,
    minimum_applied: minimumApplied,
    minimum_charge_pence: minimumCharge,
    cleaning_pence: cleaning,
    protection_pence: protection,
    total_pence: total,
    commission_pct: commissionPct,
    commission_pence: Math.round((total * commissionPct) / 100),
    savings_pence: Math.max(0, listPrice - subtotal),
  };
}

/**
 * Turn a basket of quantities into the instant fixed price the customer sees.
 *
 * The result is split by service rather than totalled flat, because each
 * service is booked, allocated, minimum-charged and invoiced on its own. Every
 * figure comes from the admin-controlled national price list.
 */
export function buildQuote(
  basket: Basket,
  services: Service[],
  items: PriceItem[],
  bundles: PriceBundle[],
  opts: {
    commissionPct: number;
    /** Service code -> whether the customer opted into its add-on. */
    protection?: ProtectionChoice;
  }
): Quote {
  const quotes = servicesInBasket(basket, services, items)
    .map((service) =>
      quoteOneService(
        service,
        basket,
        items,
        bundles,
        opts.commissionPct,
        Boolean(opts.protection?.[service.code])
      )
    )
    .filter((q) => q.total_pence > 0);

  return {
    services: quotes,
    total_pence: quotes.reduce((sum, q) => sum + q.total_pence, 0),
    commission_pence: quotes.reduce((sum, q) => sum + q.commission_pence, 0),
    savings_pence: quotes.reduce((sum, q) => sum + q.savings_pence, 0),
  };
}
