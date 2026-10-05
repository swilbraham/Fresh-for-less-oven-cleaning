export type CleanerStatus = "pending" | "approved" | "suspended" | "rejected";
export type JobStatus =
  | "provisional"
  | "offered"
  | "accepted"
  | "completed"
  | "cancelled"
  | "unfilled";
export type SlotWindow = "am" | "pm";

export type Settings = {
  commission_pct: string | number;
  min_notice_days: number;
  booking_email: string;
  cancellation_notice_hours: number;
  payee_name: string;
  payee_account: string;
  payee_sort_code: string;
  payee_address: string;
  payment_terms_days: number;
  legal_footer: string;
  admin_mobile: string;
  admin_sms_enabled: boolean;
};

/** One trade. Everything bookable belongs to exactly one of these. */
export type Service = {
  code: string;
  label: string;
  hint: string;
  blurb: string;
  minimum_charge_pence: number;
  /** Above zero means this service offers a protection add-on. */
  protection_pct: string | number;
  protection_label: string;
  protection_hint: string;
  sort: number;
  active: boolean;
};

export type PriceItem = {
  code: string;
  service_code: string;
  label: string;
  hint: string;
  /** Groups items within a service on the booking form, e.g. "Upholstery". */
  kind: string;
  unit_price_pence: number;
  max_qty: number;
  sort: number;
  active: boolean;
};

export type PriceBundle = {
  id: number;
  item_code: string;
  qty: number;
  price_pence: number;
  label: string;
  active: boolean;
};

export type QuoteLine = {
  code: string;
  label: string;
  qty: number;
  amount_pence: number;
  note: string;
};

/** The price of one service's worth of a basket — becomes one job. */
export type ServiceQuote = {
  service_code: string;
  service_label: string;
  lines: QuoteLine[];
  subtotal_pence: number;
  minimum_applied: boolean;
  minimum_charge_pence: number;
  cleaning_pence: number;
  /** Protection add-on, when the customer opts in and the service offers it. */
  protection_pence: number;
  total_pence: number;
  commission_pct: number;
  commission_pence: number;
  savings_pence: number;
};

/** The whole basket. One booking, one job per entry in `services`. */
export type Quote = {
  services: ServiceQuote[];
  total_pence: number;
  commission_pence: number;
  savings_pence: number;
};

export type Cleaner = {
  id: number;
  name: string;
  business_name: string;
  email: string;
  phone: string;
  status: CleanerStatus;
  insurance_provider: string;
  insurance_expiry: string | null;
  years_experience: number;
  equipment: string;
  dbs_checked: boolean;
  admin_notes: string;
  notify_sms: boolean;
  notify_email: boolean;
  created_at: string;
  reviewed_at: string | null;
};

export type Job = {
  /** The site that sent this customer, '' when they came here directly. */
  source: string;
  id: number;
  ref: string;
  booking_id: number | null;
  service_code: string;
  service_label: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  address_line: string;
  town: string;
  postcode: string;
  outward: string;
  slot_date: string;
  slot_window: SlotWindow;
  items: QuoteLine[];
  notes: string;
  subtotal_pence: number;
  total_pence: number;
  commission_pct: string | number;
  commission_pence: number;
  status: JobStatus;
  cleaner_id: number | null;
  created_at: string;
  accepted_at: string | null;
  completed_at: string | null;
  cancelled_by: string;
  late_cancellation: boolean;
  rescheduled_count: number;
  /** Hours until the slot opens; negative once it has passed. */
  hours_until_slot: string | number;
};

/** A submitted basket: the customer once, plus one job per trade. */
export type Booking = {
  id: number;
  ref: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  address_line: string;
  town: string;
  postcode: string;
  outward: string;
  notes: string;
  total_pence: number;
  /** The site that sent this customer, '' when they came here directly. */
  source: string;
  created_at: string;
};
