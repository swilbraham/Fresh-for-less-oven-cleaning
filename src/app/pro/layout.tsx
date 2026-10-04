import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { IS_SOLO } from "@/config";

/**
 * The contractor area, gated at the layout so every current and future page
 * under /pro is covered by one check rather than each remembering to make it.
 *
 * On a solo site there is no contractor pool: nothing to sign up for, no offers
 * to list, no commission to invoice. `notFound()` rather than a redirect
 * because these routes genuinely do not exist on this site — bouncing someone
 * to the homepage would still confirm that a contractor area is there to find,
 * and a redirect from a route the sign-in flow also redirects *into* is how
 * loops get built.
 */
export default function ProLayout({ children }: { children: ReactNode }) {
  if (IS_SOLO) notFound();
  return children;
}
