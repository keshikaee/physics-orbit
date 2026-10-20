#!/usr/bin/env node
/**
 * Run Supabase CLI migration commands against SUPABASE_DB_URL from .env.local.
 *
 *   npm run db:status          # which migrations are applied
 *   npm run db:push -- --dry-run
 *   npm run db:push            # apply pending migrations in supabase/migrations/
 *
 * The connection string is passed straight to the CLI and redacted from output.
 */
import { spawn } from "node:child_process";

const CLI = "supabase@2.121.0";
const COMMANDS = {
  status: ["migration", "list"],
  push: ["db", "push"],
};

const [command, ...extra] = process.argv.slice(2);
if (!COMMANDS[command]) {
  console.error(`Usage: node scripts/db.mjs <${Object.keys(COMMANDS).join("|")}> [flags]`);
  process.exit(1);
}

const raw = process.env.SUPABASE_DB_URL;
if (!raw) {
  console.error("Set SUPABASE_DB_URL in .env.local (Supabase → Connect → connection string).");
  process.exit(1);
}

// Re-encode the password so special characters can't break the URL.
const match = raw.match(/^(postgres(?:ql)?:\/\/[^:]+:)(.*)(@[^@]+)$/);
let dbUrl = raw;
if (match) {
  let password = match[2];
  try {
    password = decodeURIComponent(password);
  } catch {}
  dbUrl = match[1] + encodeURIComponent(password) + match[3];
}

// No IPv6 on this network? The direct host (db.<ref>.supabase.co) is IPv6-only.
// Set SUPABASE_POOLER_HOST (e.g. aws-0-ap-northeast-1.pooler.supabase.com) to
// connect through Supabase's IPv4 session pooler with the same password.
const poolerHost = process.env.SUPABASE_POOLER_HOST;
if (poolerHost) {
  const u = new URL(dbUrl);
  const ref = u.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/)?.[1];
  if (ref && u.username === "postgres") {
    u.username = `postgres.${ref}`;
    u.hostname = poolerHost;
    u.port = "5432";
    dbUrl = u.toString();
  }
}

const redact = (text) => text.replace(/postgres(?:ql)?:\/\/\S+/g, "<db-url>");
const child = spawn("npx", ["--yes", CLI, ...COMMANDS[command], ...extra, "--db-url", dbUrl], {
  stdio: ["inherit", "pipe", "pipe"],
});
child.stdout.on("data", (d) => process.stdout.write(redact(d.toString())));
child.stderr.on("data", (d) => process.stderr.write(redact(d.toString())));
child.on("exit", (code) => process.exit(code ?? 1));
