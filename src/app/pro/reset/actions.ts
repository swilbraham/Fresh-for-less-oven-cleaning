"use server";

import { notFound, redirect } from "next/navigation";
import {
  cleanerIdFromResetToken,
  hashPassword,
  startCleanerSession,
  verifyResetToken,
} from "@/lib/marketplace/auth";
import {
  getCleanerPasswordHash,
  setCleanerPassword,
} from "@/lib/marketplace/repo";
import { IS_SOLO } from "@/config";

function field(data: FormData, name: string, max = 200): string {
  return String(data.get(name) ?? "").trim().slice(0, max);
}

export async function resetPasswordAction(data: FormData) {
  // Reachable without a session, and by its own id rather than by route — so
  // the /pro layout's 404 doesn't cover it. Solo mode has no portal to reset a
  // password for, and this action would otherwise hand out a session cookie.
  if (IS_SOLO) notFound();
  const token = field(data, "token", 200);
  const password = field(data, "password", 200);
  const confirm = field(data, "confirm", 200);

  const back = (message: string) =>
    redirect(`/pro/reset/${token}?error=${encodeURIComponent(message)}`);

  if (password.length < 8) back("Choose a password of at least 8 characters.");
  if (password !== confirm) back("Those two passwords don't match.");

  const cleanerId = cleanerIdFromResetToken(token);
  if (!cleanerId) back("That reset link isn't valid.");

  // The signature covers the current hash, so a link already used to change the
  // password no longer verifies.
  const currentHash = await getCleanerPasswordHash(cleanerId!);
  if (!currentHash || !verifyResetToken(token, currentHash)) {
    back("That reset link has expired or has already been used.");
  }

  await setCleanerPassword(cleanerId!, hashPassword(password));
  await startCleanerSession(cleanerId!);
  redirect("/pro/dashboard");
}
