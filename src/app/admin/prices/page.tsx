import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/marketplace/auth";
import {
  getBundles,
  getPriceItems,
  getServices,
  getSettings,
} from "@/lib/marketplace/repo";
import { gbpShort } from "@/lib/marketplace/money";
import {
  addBundleAction,
  addPriceItemAction,
  deleteBundleAction,
  deletePriceItemAction,
  removePriceItemAction,
  savePricesAction,
} from "../actions";
import { AdminNav, Alert, Card } from "@/components/marketplace/shell";
import ConfirmButton from "@/components/marketplace/ConfirmButton";
import { BRAND, IS_SOLO, V } from "@/config";

export const dynamic = "force-dynamic";

export const metadata = {
  title: IS_SOLO ? "Prices" : "Prices & commission",
  robots: { index: false, follow: false },
};

export default async function AdminPricesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  if (!(await isAdmin())) redirect("/admin");
  const { error, saved } = await searchParams;

  const [settings, services, items, bundles] = await Promise.all([
    getSettings(),
    getServices(),
    getPriceItems(),
    getBundles(),
  ]);

  return (
    <main className="min-h-screen bg-slate-50">
      <AdminNav />

      <div className="mx-auto max-w-5xl px-4 py-8">
        {error && <Alert>{error}</Alert>}
        {saved && <Alert tone="success">Prices updated. Live on /book now.</Alert>}

        <form id="prices-form" action={savePricesAction} className="space-y-6">
          <Card
            title={IS_SOLO ? "Booking settings" : "Platform settings"}
            description={
              IS_SOLO
                ? "These apply to every job the site takes."
                : `These apply nationally to every job and every ${V.one}.`
            }
          >
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {IS_SOLO ? (
                // Nothing to set: you keep the whole job value. The hidden
                // input still posts a figure because savePricesAction validates
                // the field and would reject the entire form without one.
                <input type="hidden" name="commissionPct" value="0" />
              ) : (
                <div>
                  <label
                    htmlFor="commissionPct"
                    className="block text-sm font-semibold text-slate-700"
                  >
                    Commission rate (%)
                  </label>
                  <input
                    id="commissionPct"
                    name="commissionPct"
                    type="number"
                    step="0.5"
                    min="0"
                    max="90"
                    defaultValue={Number(settings.commission_pct)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-primary-500"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Charged to the {V.one} on completed jobs. The rate in force
                    when a job is booked is locked to that job.
                  </p>
                </div>
              )}
              <div>
                <label
                  htmlFor="minNoticeDays"
                  className="block text-sm font-semibold text-slate-700"
                >
                  Minimum notice (days)
                </label>
                <input
                  id="minNoticeDays"
                  name="minNoticeDays"
                  type="number"
                  min="0"
                  max="30"
                  defaultValue={settings.min_notice_days}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-primary-500"
                />
              </div>
              <div>
                <label
                  htmlFor="cancellationNoticeHours"
                  className="block text-sm font-semibold text-slate-700"
                >
                  Free cancellation notice (hours)
                </label>
                <input
                  id="cancellationNoticeHours"
                  name="cancellationNoticeHours"
                  type="number"
                  min="0"
                  max="336"
                  defaultValue={settings.cancellation_notice_hours}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-primary-500"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Customers can always cancel themselves, but anything inside
                  this window is flagged as a late cancellation
                  {IS_SOLO ? "" : ` for you and the ${V.one}`}.
                </p>
              </div>
              <div className="sm:col-span-2 rounded-xl border border-primary-200 bg-primary-50/40 p-4">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    name="adminSmsEnabled"
                    defaultChecked={settings.admin_sms_enabled}
                    className="mt-1 h-5 w-5 rounded border-slate-300 accent-primary-600"
                  />
                  <span className="font-semibold text-slate-800">
                    Text me every booking
                  </span>
                </label>
                <div className="mt-3">
                  <label
                    htmlFor="adminMobile"
                    className="block text-sm font-semibold text-slate-700"
                  >
                    Your mobile
                  </label>
                  <input
                    id="adminMobile"
                    name="adminMobile"
                    type="tel"
                    defaultValue={settings.admin_mobile}
                    placeholder="07700 900123"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-2.5 sm:w-64"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    {IS_SOLO
                      ? "A text the moment any booking lands, wherever it is — or a warning if it's outside the postcodes you cover."
                      : `A text the moment any booking lands, wherever it is, with how many ${V.many} it went to — or a warning if nobody covers it. Separate from the job offers you get as a ${V.one}.`}
                  </p>
                </div>
              </div>

              <div>
                <label
                  htmlFor="bookingEmail"
                  className="block text-sm font-semibold text-slate-700"
                >
                  Office email
                </label>
                <input
                  id="bookingEmail"
                  name="bookingEmail"
                  type="email"
                  defaultValue={settings.booking_email}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-primary-500"
                />
              </div>
            </div>
          </Card>

          <Card
            title="Services"
            description="Each trade is priced, minimum-charged and allocated on its own. Untick to stop taking bookings for one without losing its history."
          >
            <div className="mt-4 space-y-4">
              {services.map((service) => (
                <div
                  key={service.code}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <div className="flex flex-wrap items-center gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        name={`sactive-${service.code}`}
                        defaultChecked={service.active}
                        aria-label={`${service.label} live`}
                        className="h-5 w-5 rounded border-slate-300 accent-accent-600"
                      />
                      <span className="text-sm font-semibold text-slate-700">
                        Live
                      </span>
                    </label>
                    <span className="text-xs text-slate-400">{service.code}</span>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor={`slabel-${service.code}`}
                        className="block text-sm font-semibold text-slate-700"
                      >
                        Name
                      </label>
                      <input
                        id={`slabel-${service.code}`}
                        name={`slabel-${service.code}`}
                        defaultValue={service.label}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor={`shint-${service.code}`}
                        className="block text-sm font-semibold text-slate-700"
                      >
                        One-line summary
                      </label>
                      <input
                        id={`shint-${service.code}`}
                        name={`shint-${service.code}`}
                        defaultValue={service.hint}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor={`min-${service.code}`}
                        className="block text-sm font-semibold text-slate-700"
                      >
                        Minimum charge (£)
                      </label>
                      <input
                        id={`min-${service.code}`}
                        name={`min-${service.code}`}
                        defaultValue={(service.minimum_charge_pence / 100).toFixed(2)}
                        className="mt-1 w-32 rounded-lg border border-slate-300 px-3 py-2 tabular-nums"
                      />
                      <p className="mt-1 text-xs text-slate-500">
                        No {service.label.toLowerCase()} job is priced below this.
                      </p>
                    </div>
                    <div>
                      <label
                        htmlFor={`protection-${service.code}`}
                        className="block text-sm font-semibold text-slate-700"
                      >
                        Add-on (% of the clean)
                      </label>
                      <input
                        id={`protection-${service.code}`}
                        name={`protection-${service.code}`}
                        type="number"
                        step="0.5"
                        min="0"
                        max="100"
                        defaultValue={Number(service.protection_pct)}
                        className="mt-1 w-32 rounded-lg border border-slate-300 px-3 py-2 tabular-nums"
                      />
                      <p className="mt-1 text-xs text-slate-500">
                        Zero means this service offers no add-on.
                      </p>
                    </div>
                    <div>
                      <label
                        htmlFor={`plabel-${service.code}`}
                        className="block text-sm font-semibold text-slate-700"
                      >
                        Add-on name
                      </label>
                      <input
                        id={`plabel-${service.code}`}
                        name={`plabel-${service.code}`}
                        defaultValue={service.protection_label}
                        placeholder="e.g. Stain guard"
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor={`phint-${service.code}`}
                        className="block text-sm font-semibold text-slate-700"
                      >
                        Add-on description
                      </label>
                      <input
                        id={`phint-${service.code}`}
                        name={`phint-${service.code}`}
                        defaultValue={service.protection_hint}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card
            title="National price list"
            description="Every price the instant quote is built from. Untick to hide an item from customers without deleting its history."
          >
            {services.map((service) => (
            <div key={service.code} className="mt-6 overflow-x-auto">
              <h3 className="text-sm font-bold text-slate-900">
                {service.label}
              </h3>
              <table className="mt-2 w-full min-w-[860px] text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="py-2 font-semibold">Live</th>
                    <th className="py-2 font-semibold">Label</th>
                    <th className="py-2 font-semibold">Hint shown to customer</th>
                    <th className="py-2 font-semibold">Group</th>
                    <th className="py-2 font-semibold">Price (£)</th>
                    <th className="py-2 font-semibold">Max qty</th>
                    <th className="py-2 font-semibold" />
                    <th className="py-2 text-right font-semibold">Remove</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.filter((i) => i.service_code === service.code).map((item) => (
                    <tr key={item.code}>
                      <td className="py-2">
                        <input
                          type="checkbox"
                          name={`active-${item.code}`}
                          defaultChecked={item.active}
                          aria-label={`${item.label} live`}
                          className="h-5 w-5 rounded border-slate-300 accent-accent-600"
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          name={`label-${item.code}`}
                          defaultValue={item.label}
                          aria-label={`${item.code} label`}
                          className="w-full rounded-lg border border-slate-300 px-3 py-1.5"
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          name={`hint-${item.code}`}
                          defaultValue={item.hint}
                          aria-label={`${item.code} hint`}
                          className="w-full rounded-lg border border-slate-300 px-3 py-1.5"
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          name={`kind-${item.code}`}
                          defaultValue={item.kind}
                          aria-label={`${item.code} group`}
                          placeholder="e.g. Upholstery"
                          className="w-32 rounded-lg border border-slate-300 px-3 py-1.5"
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          name={`price-${item.code}`}
                          defaultValue={(item.unit_price_pence / 100).toFixed(2)}
                          aria-label={`${item.code} price`}
                          className="w-24 rounded-lg border border-slate-300 px-3 py-1.5 tabular-nums"
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          name={`max-${item.code}`}
                          type="number"
                          min="1"
                          max="50"
                          defaultValue={item.max_qty}
                          aria-label={`${item.code} max quantity`}
                          className="w-20 rounded-lg border border-slate-300 px-3 py-1.5 tabular-nums"
                        />
                      </td>
                      <td className="py-2 text-right text-xs text-slate-400">
                        {item.code}
                      </td>
                      <td className="py-2 text-right">
                        <ConfirmButton
                          action={removePriceItemAction.bind(null, item.code)}
                          confirmText={`Delete "${item.label}" permanently? Untick Live instead if you only want to hide it from customers.`}
                          className="text-xs font-semibold text-red-600 underline"
                        >
                          Remove
                        </ConfirmButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            ))}
          </Card>

          <button
            type="submit"
            className="w-full rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white transition hover:bg-slate-800"
          >
            Save prices &amp; settings
          </button>
        </form>

        <Card
          title={IS_SOLO ? "Invoice & legal details" : "Commission payment details"}
          description={
            IS_SOLO
              ? "Your trading disclosure, shown on anything the site prints. The bank details below are only used on commission invoices, which a solo site never raises."
              : `Shown on every commission invoice so ${V.many} know who to pay and how. Stored here rather than in the code — this repository is public.`
          }
          className="mt-8"
        >
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="payeeName" className="block text-sm font-semibold text-slate-700">
                Account name
              </label>
              <input
                id="payeeName"
                name="payeeName"
                form="prices-form"
                defaultValue={settings.payee_name}
                placeholder={`e.g. ${BRAND.registeredName || BRAND.tradingName}`}
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-2.5"
              />
            </div>
            <div>
              <label htmlFor="payeeSortCode" className="block text-sm font-semibold text-slate-700">
                Sort code
              </label>
              <input
                id="payeeSortCode"
                name="payeeSortCode"
                form="prices-form"
                defaultValue={settings.payee_sort_code}
                placeholder="000000"
                inputMode="numeric"
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-2.5 tabular-nums"
              />
            </div>
            <div>
              <label htmlFor="payeeAccount" className="block text-sm font-semibold text-slate-700">
                Account number
              </label>
              <input
                id="payeeAccount"
                name="payeeAccount"
                form="prices-form"
                defaultValue={settings.payee_account}
                placeholder="00000000"
                inputMode="numeric"
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-2.5 tabular-nums"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="payeeAddress" className="block text-sm font-semibold text-slate-700">
                Your business address (appears on the invoice)
              </label>
              <textarea
                id="payeeAddress"
                name="payeeAddress"
                form="prices-form"
                rows={3}
                defaultValue={settings.payee_address}
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-2.5"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="legalFooter" className="block text-sm font-semibold text-slate-700">
                Legal footer (appears at the bottom of every invoice)
              </label>
              <textarea
                id="legalFooter"
                name="legalFooter"
                form="prices-form"
                rows={2}
                defaultValue={settings.legal_footer}
                placeholder={`${BRAND.tradingName} is a trading name of …, registered in England and Wales no. 00000000. Registered office: …`}
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-2.5"
              />
              <p className="mt-1 text-xs text-slate-500">
                A limited company must show its registered name, company number
                and registered office on business documents — include all three.
              </p>
            </div>

            <div>
              <label htmlFor="paymentTermsDays" className="block text-sm font-semibold text-slate-700">
                Payment terms (days)
              </label>
              <input
                id="paymentTermsDays"
                name="paymentTermsDays"
                form="prices-form"
                type="number"
                min="0"
                max="90"
                defaultValue={settings.payment_terms_days}
                className="mt-1 w-32 rounded-xl border border-slate-300 px-4 py-2.5"
              />
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Saved with the <strong>Save prices &amp; settings</strong> button above.
          </p>
        </Card>

        {/* Bundle offers */}
        <Card
          title="Fixed-price offers"
          description="e.g. 4 rooms for £99. The quote automatically works out the cheapest combination for the customer."
          className="mt-8"
        >
          {bundles.length > 0 && (
            <ul className="mt-4 divide-y divide-slate-100">
              {bundles.map((bundle) => {
                const item = items.find((i) => i.code === bundle.item_code);
                return (
                  <li
                    key={bundle.id}
                    className="flex items-center justify-between gap-4 py-2 text-sm"
                  >
                    <span className="text-slate-700">
                      <strong>{bundle.label}</strong> — {bundle.qty} ×{" "}
                      {item?.label ?? bundle.item_code} for{" "}
                      {gbpShort(bundle.price_pence)}
                    </span>
                    <form action={deleteBundleAction}>
                      <input type="hidden" name="id" value={bundle.id} />
                      <button
                        type="submit"
                        className="text-xs font-semibold text-red-600 underline"
                      >
                        Remove
                      </button>
                    </form>
                  </li>
                );
              })}
            </ul>
          )}

          <form
            action={addBundleAction}
            className="mt-5 grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-5"
          >
            <select
              name="itemCode"
              aria-label="Offer applies to"
              className="rounded-xl border border-slate-300 px-3 py-2.5"
            >
              {items.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.label}
                </option>
              ))}
            </select>
            <input
              name="qty"
              type="number"
              min="2"
              max="50"
              placeholder="Qty"
              aria-label="Offer quantity"
              className="rounded-xl border border-slate-300 px-3 py-2.5"
            />
            <input
              name="price"
              placeholder="Price £"
              aria-label="Offer price"
              className="rounded-xl border border-slate-300 px-3 py-2.5"
            />
            <input
              name="label"
              placeholder="Label, e.g. 4 rooms for £99"
              aria-label="Offer label"
              className="rounded-xl border border-slate-300 px-3 py-2.5"
            />
            <button
              type="submit"
              className="rounded-xl bg-primary-600 px-4 py-2.5 font-semibold text-white"
            >
              Add offer
            </button>
          </form>
        </Card>

        {/* New item */}
        <Card title="Add a new priced item" className="mt-8">
          <form action={addPriceItemAction} className="mt-4 grid gap-3 sm:grid-cols-3">
            <input
              name="code"
              placeholder="Code, e.g. curtains"
              aria-label="Item code"
              className="rounded-xl border border-slate-300 px-3 py-2.5"
            />
            <input
              name="label"
              placeholder="Label, e.g. Curtains (per pair)"
              aria-label="Item label"
              className="rounded-xl border border-slate-300 px-3 py-2.5"
            />
            <input
              name="price"
              placeholder="Price £"
              aria-label="Item price"
              className="rounded-xl border border-slate-300 px-3 py-2.5"
            />
            <input
              name="hint"
              placeholder="Hint shown to customer"
              aria-label="Item hint"
              className="rounded-xl border border-slate-300 px-3 py-2.5 sm:col-span-2"
            />
            <select
              name="serviceCode"
              aria-label="Service"
              className="rounded-xl border border-slate-300 px-3 py-2.5"
            >
              {services.map((service) => (
                <option key={service.code} value={service.code}>
                  {service.label}
                </option>
              ))}
            </select>
            <input
              name="kind"
              placeholder="Group, e.g. Upholstery"
              aria-label="Item group"
              className="rounded-xl border border-slate-300 px-3 py-2.5"
            />
            <button
              type="submit"
              className="rounded-xl bg-primary-600 px-4 py-2.5 font-semibold text-white sm:col-span-3"
            >
              Add item
            </button>
          </form>
        </Card>
      </div>
    </main>
  );
}
