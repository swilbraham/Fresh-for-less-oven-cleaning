import { readFileSync } from "node:fs";

/**
 * Read DATABASE_URL from the environment, or failing that from .env.local or
 * .env in the project root.
 *
 * Pasting a connection string onto a command line is where this goes wrong:
 * the shell eats characters out of it, and an example value copied by mistake
 * fails with a DNS error that reads like the database is down. Neon's console
 * hands over a ready-made .env.local, so reading that file is both fewer steps
 * and harder to get wrong. Those files are gitignored.
 */
export function databaseUrl() {
  const fromEnv = process.env.DATABASE_URL?.trim();
  if (fromEnv) return check(fromEnv, "the DATABASE_URL you passed on the command line");

  for (const file of [".env.local", ".env", ".env.development.local"]) {
    let text;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    // Only DATABASE_URL, never DATABASE_URL_UNPOOLED — the anchored name and
    // the line start keep the two apart.
    const match = text.match(/^\s*(?:export\s+)?DATABASE_URL\s*=\s*(.+)$/m);
    const value = match
      ? match[1].trim().replace(/^["']|["']$/g, "")
      // A file holding nothing but the connection string is what you get from
      // piping the clipboard straight in, so accept that shape too rather
      // than making the DATABASE_URL= prefix the difference between working
      // and a confusing failure.
      : (text.split(/\r?\n/).map((l) => l.trim()).find((l) => /^postgres(ql)?:\/\//.test(l)) ?? "");
    if (value) return check(value, file);
  }

  fail(`No database connection string found.

  Copy it from Neon (Quickstart, the .env.local tab, Show secret then Copy
  Snippet) or from Vercel (Settings, Environment Variables, DATABASE_URL),
  and save it in this folder as .env.local:

      DATABASE_URL=postgres://...

  That file is gitignored, and every script here will pick it up.`);
}

function check(value, source) {
  if (value.includes("...") || value.includes("<") || !/^postgres(ql)?:\/\//.test(value)) {
    fail(`The connection string in ${source} is not a real one:

      ${value}

  A placeholder with "..." or angle brackets has been copied instead of the
  value. The real one starts postgres:// and has no dots in a row.`);
  }
  return value;
}

function fail(message) {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}
